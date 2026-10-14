import type { Experimental_SandboxSession as SandboxSession } from '@ai-sdk/provider-utils';
import { spawn as spawnProcess } from 'node:child_process';
import { Readable } from 'node:stream';

// A computer ploop reaches over SSH: any Linux machine the user can log in to,
// such as an always-free cloud VM, a spare computer or a VM on this Mac. It
// uses the `ssh` program and a key file already on this machine, so ploop never
// stores or sees the key itself.
export type SshTarget = {
  host: string;
  user: string;
  port: number;
  keyPath: string;
};

const HOST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const USER_PATTERN = /^[A-Za-z_][A-Za-z0-9._-]*$/;

export function sshTargetFromEnv(
  env: Record<string, string | undefined> = process.env,
): SshTarget | undefined {
  const host = env.PLOOP_SSH_HOST?.trim();
  if (!host) return undefined;
  const user = env.PLOOP_SSH_USER?.trim() || 'ploop';
  const port = Number(env.PLOOP_SSH_PORT || 22);
  const keyPath = env.PLOOP_SSH_KEY_PATH?.trim() ?? '';

  if (!HOST_PATTERN.test(host)) {
    throw new Error('The VM address in Settings doesn’t look right.');
  }
  if (!USER_PATTERN.test(user)) {
    throw new Error('The VM username in Settings doesn’t look right.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('The VM port in Settings must be between 1 and 65535.');
  }
  if (keyPath !== '' && !keyPath.startsWith('/')) {
    throw new Error('The VM key file in Settings must be a full path.');
  }
  return { host, user, port, keyPath };
}

function quote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function sshArgs(target: SshTarget) {
  return [
    '-p',
    String(target.port),
    ...(target.keyPath
      ? ['-i', target.keyPath, '-o', 'IdentitiesOnly=yes']
      : []),
    // Never stop to ask a question; fail with a message instead.
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=15',
    '-o',
    'ServerAliveInterval=15',
    '--',
    `${target.user}@${target.host}`,
    // The script itself arrives on stdin.
    'bash -s',
  ];
}

function script(options: {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
}) {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      lines.push(`export ${key}=${quote(value)}`);
    }
  }
  if (options.workingDirectory) {
    lines.push(`mkdir -p ${quote(options.workingDirectory)}`);
    lines.push(`cd ${quote(options.workingDirectory)} || exit 1`);
  }
  // Run in its own bash with no stdin, so a command that reads input can't
  // swallow the rest of this script.
  lines.push(`exec bash -c ${quote(options.command)} </dev/null`);
  return lines.join('\n') + '\n';
}

type RunOptions = {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
};

export function createSshSession(target: SshTarget): SandboxSession {
  function start(options: RunOptions) {
    const child = spawnProcess('ssh', sshArgs(target), {
      stdio: ['pipe', 'pipe', 'pipe'],
      signal: options.abortSignal,
    });
    child.stdin.on('error', () => {});
    child.stdin.write(script(options));
    child.stdin.end();
    return child;
  }

  async function run(options: RunOptions) {
    const child = start(options);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once('error', error =>
        reject(
          (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? new Error('This computer doesn’t have the ssh program installed.')
            : error,
        ),
      );
      child.once('close', code => resolve(code ?? 1));
    });
    const err = Buffer.concat(stderr).toString('utf8');
    if (exitCode === 255) {
      throw new Error(
        `Couldn’t reach the VM over SSH: ${err.trim() || 'connection failed'}`,
      );
    }
    return {
      exitCode,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: err,
    };
  }

  async function readBytes(path: string, abortSignal?: AbortSignal) {
    const child = start({
      command: `test -f ${quote(path)} || exit 44; cat -- ${quote(path)}`,
      abortSignal,
    });
    const chunks: Buffer[] = [];
    child.stdout.on('data', chunk => chunks.push(chunk));
    const stderr: Buffer[] = [];
    child.stderr.on('data', chunk => stderr.push(chunk));
    const exitCode = await new Promise<number>(resolve =>
      child.once('close', code => resolve(code ?? 1)),
    );
    if (exitCode === 44) return null;
    if (exitCode !== 0) {
      throw new Error(
        `Couldn’t read ${path}: ${Buffer.concat(stderr).toString('utf8').trim()}`,
      );
    }
    return new Uint8Array(Buffer.concat(chunks));
  }

  async function writeBytes(
    path: string,
    content: Uint8Array,
    abortSignal?: AbortSignal,
  ) {
    // base64 keeps the file bytes from being read as part of the script.
    const encoded = Buffer.from(content).toString('base64');
    const result = await run({
      command: `mkdir -p "$(dirname ${quote(path)})" && base64 -d > ${quote(path)} <<'PLOOP_EOF'\n${encoded}\nPLOOP_EOF`,
      abortSignal,
    });
    if (result.exitCode !== 0) {
      throw new Error(`Couldn’t write ${path}: ${result.stderr.trim()}`);
    }
  }

  return {
    description: `${target.user}@${target.host} over SSH`,
    run: options => run(options),
    async spawn(options) {
      const child = start(options);
      return {
        pid: child.pid,
        stdout: Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
        stderr: Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>,
        wait: () =>
          new Promise(resolve =>
            child.once('close', code => resolve({ exitCode: code ?? 1 })),
          ),
        kill: async () => {
          child.kill();
        },
      };
    },
    async readBinaryFile({ path, abortSignal }) {
      return readBytes(path, abortSignal);
    },
    async readFile({ path, abortSignal }) {
      const bytes = await readBytes(path, abortSignal);
      return bytes === null
        ? null
        : new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          });
    },
    async readTextFile({ path, startLine, endLine, abortSignal }) {
      const bytes = await readBytes(path, abortSignal);
      if (bytes === null) return null;
      const text = new TextDecoder().decode(bytes);
      if (startLine == null && endLine == null) return text;
      return text
        .split('\n')
        .slice((startLine ?? 1) - 1, endLine ?? undefined)
        .join('\n');
    },
    async writeBinaryFile({ path, content, abortSignal }) {
      await writeBytes(path, content, abortSignal);
    },
    async writeFile({ path, content, abortSignal }) {
      const bytes = new Uint8Array(await new Response(content).arrayBuffer());
      await writeBytes(path, bytes, abortSignal);
    },
    async writeTextFile({ path, content, abortSignal }) {
      await writeBytes(path, new TextEncoder().encode(content), abortSignal);
    },
  };
}
