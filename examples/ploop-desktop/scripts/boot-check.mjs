// Starts a built ploop server (the folder holding server.js) the way the app
// does, and asks it for a page and one static file.
import { spawn } from 'node:child_process';

export async function bootCheck(appDir) {
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
}
