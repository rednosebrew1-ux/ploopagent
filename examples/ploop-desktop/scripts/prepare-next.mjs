// Builds ploop's chat server (examples/next-agent) as a self-contained Next.js
// "standalone" app and copies it into build-next/, which electron-builder puts
// inside the packaged app. The copy keeps pnpm's relative symlinks, because the
// packages find their own dependencies through them, and then starts the copy
// to prove it runs before anything is packaged.
import { execFileSync, spawn } from 'node:child_process';
import { cp, readdir, readlink, lstat, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktop = path.resolve(here, '..');
const nextAgent = path.resolve(desktop, '..', 'next-agent');
const out = path.join(desktop, 'build-next');

execFileSync('pnpm', ['--filter', '@example/next-agent', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, PLOOP_DESKTOP_BUILD: '1' },
});

await rm(out, { recursive: true, force: true });
await cp(path.join(nextAgent, '.next', 'standalone'), out, {
  recursive: true,
  verbatimSymlinks: true,
});

const appDir = path.join(out, 'examples', 'next-agent');
try {
  await stat(path.join(appDir, 'server.js'));
} catch {
  const found = await readdir(out).catch(() => []);
  throw new Error(
    `Expected ${path.join(appDir, 'server.js')} in the standalone build. Found: ${found.join(', ') || 'nothing'}.`,
  );
}

// Next serves its static files and the public folder from beside server.js.
await cp(
  path.join(nextAgent, '.next', 'static'),
  path.join(appDir, '.next', 'static'),
  { recursive: true },
);
await cp(path.join(nextAgent, 'public'), path.join(appDir, 'public'), {
  recursive: true,
}).catch(() => {});

// Every symlink must stay inside the copy; a link that reaches outside would
// work here and break on another Mac.
async function checkLinks(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if ((await lstat(full)).isSymbolicLink()) {
      const target = path.resolve(dir, await readlink(full));
      if (path.relative(out, target).startsWith('..')) {
        throw new Error(`${full} links outside the build: ${target}`);
      }
    } else if (entry.isDirectory()) {
      await checkLinks(full);
    }
  }
}
await checkLinks(out);

// Start the server exactly as the app will, and ask it for a page and a file.
const port = 40000 + Math.floor(Math.random() * 10000);
const server = spawn(process.execPath, ['server.js'], {
  cwd: appDir,
  env: {
    PATH: process.env.PATH,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', chunk => (output += chunk));
server.stderr.on('data', chunk => (output += chunk));

try {
  const base = `http://127.0.0.1:${port}`;
  let page;
  for (let attempt = 0; attempt < 60 && page == null; attempt++) {
    try {
      const response = await fetch(`${base}/vault`);
      if (response.ok) page = await response.text();
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  if (page == null) throw new Error(`The packaged server did not start:\n${output}`);

  const asset = page.match(/\/_next\/static\/[^"']+\.(?:css|js)/)?.[0];
  if (asset == null || !(await fetch(`${base}${asset}`)).ok) {
    throw new Error(`The packaged server did not serve its static files (${asset}).`);
  }
} finally {
  server.kill();
}

console.log(`Prepared ${out}`);
