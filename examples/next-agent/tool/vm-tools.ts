import { getVm, type PloopVm } from '@/lib/vm';
import { safeParseJSON } from '@ai-sdk/provider-utils';
import { tool } from 'ai';
import path from 'node:path';
import { z } from 'zod';

const MAX_OUTPUT_CHARS = 8_000;

function clip(text: string) {
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n…[truncated ${text.length - MAX_OUTPUT_CHARS} characters]`
    : text;
}

function resolvePath(vm: PloopVm, file: string) {
  return path.posix.resolve(vm.workspace, file);
}

// Ploop's agent config requires user approval before this tool runs.
export const runCommandTool = tool({
  description:
    'Run a shell command on your own VM (a Linux computer that belongs to you, not the user’s machine). Use it for scripts, downloads, data processing and installing packages. The working directory is your workspace.',
  inputSchema: z.object({
    command: z.string().describe('A bash command line.'),
    why: z
      .string()
      .describe('One short sentence for the user on why you are running it.'),
  }),
  async execute({ command }, { abortSignal }) {
    const vm = await getVm();
    const result = await vm.session.run({
      command,
      workingDirectory: vm.workspace,
      abortSignal,
    });
    return {
      exitCode: result.exitCode,
      stdout: clip(result.stdout),
      stderr: clip(result.stderr),
    };
  },
});

export const readFileTool = tool({
  description:
    'Read a text file from your VM. Paths are relative to your workspace unless absolute.',
  inputSchema: z.object({
    path: z.string(),
    startLine: z.number().int().min(1).optional(),
    endLine: z.number().int().min(1).optional(),
  }),
  async execute({ path: file, startLine, endLine }, { abortSignal }) {
    const vm = await getVm();
    const content = await vm.session.readTextFile({
      path: resolvePath(vm, file),
      startLine,
      endLine,
      abortSignal,
    });
    if (content == null) {
      throw new Error(`No file at ${file}.`);
    }
    return { path: file, content: clip(content) };
  },
});

export const writeFileTool = tool({
  description:
    'Create or overwrite a text file on your VM (notes, drafts, scripts, data). Parent folders are created automatically.',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  async execute({ path: file, content }, { abortSignal }) {
    const vm = await getVm();
    await vm.session.writeTextFile({
      path: resolvePath(vm, file),
      content,
      abortSignal,
    });
    return { path: file, bytes: Buffer.byteLength(content) };
  },
});

export const listFilesTool = tool({
  description: 'List files in a folder on your VM.',
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe('Folder to list; defaults to your workspace.'),
  }),
  async execute({ path: dir }, { abortSignal }) {
    const vm = await getVm();
    const result = await vm.session.run({
      command: 'ls -la -- "$PLOOP_DIR"',
      env: { PLOOP_DIR: resolvePath(vm, dir ?? '.') },
      workingDirectory: vm.workspace,
      abortSignal,
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || 'Could not list that folder.');
    }
    return { listing: clip(result.stdout) };
  },
});

// Headless Chromium runs inside the VM, installed on first use.
const BROWSER_DIR = '.ploop/browser';
const PLAYWRIGHT_VERSION = '1.61.1';

const BROWSE_SCRIPT = `
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.env.PLOOP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  const text = await page.evaluate(() => document.body?.innerText ?? '');
  console.log(JSON.stringify({ url: page.url(), title: await page.title(), text }));
} finally {
  await browser.close();
}
`;

// Shared libraries Chromium needs on the VM's Amazon Linux image.
const CHROMIUM_DEPS = [
  'nss',
  'nspr',
  'atk',
  'at-spi2-atk',
  'cups-libs',
  'libdrm',
  'libxkbcommon',
  'libXcomposite',
  'libXdamage',
  'libXfixes',
  'libXrandr',
  'mesa-libgbm',
  'alsa-lib',
  'pango',
  'cairo',
].join(' ');

let browserReady: Promise<void> | undefined;

async function ensureBrowser(vm: PloopVm, abortSignal?: AbortSignal) {
  const dir = resolvePath(vm, BROWSER_DIR);
  const marker = await vm.session.readTextFile({
    path: `${dir}/ready`,
    abortSignal,
  });
  if (marker != null) return;

  const install = await vm.session.run({
    command: [
      `sudo dnf install -y ${CHROMIUM_DEPS}`,
      `mkdir -p "${dir}" && cd "${dir}"`,
      'npm init -y >/dev/null',
      `npm install playwright@${PLAYWRIGHT_VERSION}`,
      'npx playwright install chromium',
    ].join(' && '),
    workingDirectory: vm.workspace,
    abortSignal,
  });
  if (install.exitCode !== 0) {
    throw new Error(
      `Setting up the browser failed: ${clip(install.stderr || install.stdout)}`,
    );
  }

  await vm.session.writeTextFile({
    path: `${dir}/browse.mjs`,
    content: BROWSE_SCRIPT,
    abortSignal,
  });
  await vm.session.writeTextFile({
    path: `${dir}/ready`,
    content: PLAYWRIGHT_VERSION,
    abortSignal,
  });
}

const browseResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  text: z.string(),
});

export const browseTool = tool({
  description:
    'Open a web page in the headless browser on your VM and read its text. Works on pages that need JavaScript. The first use sets the browser up, which takes a minute.',
  inputSchema: z.object({
    url: z.string().url(),
  }),
  async execute({ url }, { abortSignal }) {
    const vm = await getVm();
    if (vm.kind !== 'vercel') {
      throw new Error(
        'The browser is only set up on ploop’s Vercel VM, not on the linked VM. Use readPage instead.',
      );
    }

    browserReady ??= ensureBrowser(vm, abortSignal).catch(error => {
      browserReady = undefined;
      throw error;
    });
    await browserReady;

    const result = await vm.session.run({
      command: 'node browse.mjs',
      env: { PLOOP_URL: url },
      workingDirectory: resolvePath(vm, BROWSER_DIR),
      abortSignal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`The browser failed: ${clip(result.stderr)}`);
    }

    const parsed = await safeParseJSON({
      text: result.stdout.trim(),
      schema: browseResultSchema,
    });
    if (!parsed.success) {
      throw new Error('The browser returned an unexpected result.');
    }

    return { ...parsed.value, text: clip(parsed.value.text) };
  },
});
