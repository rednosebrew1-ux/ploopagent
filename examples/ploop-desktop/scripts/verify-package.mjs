// Boots the chat server that electron-builder put inside the packaged app, so a
// package that is missing files fails the build instead of failing on a Mac.
// Usage: node scripts/verify-package.mjs release/mac-arm64/ploop.app
import path from 'node:path';
import { bootCheck } from './boot-check.mjs';

const app = process.argv[2];
if (app == null) throw new Error('Pass the path of the packaged .app (or its Resources folder).');
const resources = app.endsWith('.app') ? path.join(app, 'Contents', 'Resources') : app;
await bootCheck(path.join(resources, 'next', 'examples', 'next-agent'));
console.log(`Packaged server in ${app} starts and serves its files.`);
