import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The ploop desktop app packages this app as a self-contained "standalone"
// server (see examples/ploop-desktop). Plain `next build` and `next dev` are
// unchanged.
/** @type {import('next').NextConfig} */
const nextConfig =
  process.env.PLOOP_DESKTOP_BUILD === '1'
    ? {
        output: 'standalone',
        // This is a pnpm workspace: trace dependencies from the repo root so
        // the workspace packages are copied into the standalone build.
        outputFileTracingRoot: path.join(here, '..', '..'),
      }
    : {};

export default nextConfig;
