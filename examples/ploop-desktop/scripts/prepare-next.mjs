// Builds ploop's chat server (examples/next-agent) as a self-contained Next.js
// "standalone" app and copies it into build-next/, which electron-builder puts
// inside the packaged app. The copy keeps pnpm's relative symlinks, because the
// packages find their own dependencies through them, and then starts the copy
// to prove it runs before anything is packaged.
import { execFileSync } from 'node:child_process';
import {
  cp,
  lstat,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDanglingLinks } from './after-pack.mjs';
import { bootCheck } from './boot-check.mjs';

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

// electron-builder silently drops a top-level node_modules folder when it copies
// extra resources, which leaves pnpm's links dangling inside the app. Ship the
// dependencies as "deps" instead and point the links at the new name. Packages
// still resolve each other through the node_modules folders inside deps/.pnpm.
const oldRoot = path.join(out, 'node_modules');
const newRoot = path.join(out, 'deps');
async function retarget(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if ((await lstat(full)).isSymbolicLink()) {
      const target = path.resolve(dir, await readlink(full));
      const inside = path.relative(oldRoot, target);
      const linkIsOutside = path.relative(oldRoot, full).startsWith('..');
      if (linkIsOutside && !inside.startsWith('..')) {
        await unlink(full);
        await symlink(path.relative(dir, path.join(newRoot, inside)), full);
      }
    } else if (entry.isDirectory() && full !== oldRoot) {
      await retarget(full);
    }
  }
}
await retarget(out);
await rename(oldRoot, newRoot);

// Next's file tracing can leave a pnpm link whose target it never copied (on the
// macOS runner, styled-jsx). Nothing in the app loads it, and code signing stops
// at a link that points nowhere, so drop those links. The boot check below
// proves the server still runs without them.
for (const link of await findDanglingLinks(out)) {
  console.warn(`Removing a link whose target was not copied: ${path.relative(out, link)}`);
  await unlink(link);
}

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

await bootCheck(appDir);

console.log(`Prepared ${out}`);
