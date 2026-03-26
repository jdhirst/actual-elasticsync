const { spawn } = require('child_process');
const path = require('path');

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const SYNC_SCRIPT = path.join(__dirname, 'sync.js');

function runSync() {
  return new Promise((resolve) => {
    console.log(`\n[${new Date().toISOString()}] Starting sync`);
    const child = spawn(process.execPath, [SYNC_SCRIPT], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code !== 0) console.error(`Sync exited with code ${code}`);
      resolve();
    });
  });
}

async function loop() {
  while (true) {
    await runSync();
    const next = new Date(Date.now() + INTERVAL_MS);
    console.log(`\nNext sync at ${next.toISOString()}`);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

loop();
