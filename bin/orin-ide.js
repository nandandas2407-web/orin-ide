#!/usr/bin/env node
'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execSync, spawn, spawnSync } = require('child_process');

const pkg        = require('../package.json');
const serverPath = path.join(__dirname, '..', 'backend', 'server.js');
const setupScript= path.join(__dirname, '..', 'setup.sh');

// Flag written BEFORE setup starts so a killed setup never re-runs
const firstRunFlag = path.join(os.homedir(), '.orin-ide-setup-done');

const G = '\x1b[32m';
const C = '\x1b[36m';
const Y = '\x1b[33m';
const B = '\x1b[1m';
const R = '\x1b[0m';

console.log(`
${B}${C}╔══════════════════════════════════════════╗
║         OrinIDE  v${pkg.version}                 ║
║    AI-Powered Browser Coding Environment ║
║         Made by Nandan Das (MIT)         ║
╚══════════════════════════════════════════╝${R}
`);

// ── Detect Termux ─────────────────────────────────────────────
const isTermux = !!(
  process.env.PREFIX && process.env.PREFIX.includes('com.termux')
);

// ── First-run setup (Termux only) ─────────────────────────────
if (isTermux && !fs.existsSync(firstRunFlag)) {
  console.log(`${Y}${B}First run on Termux — running full setup...${R}\n`);

  // Write flag FIRST so a Ctrl+C mid-setup never causes re-install
  fs.writeFileSync(firstRunFlag, pkg.version);

  if (fs.existsSync(setupScript)) {
    spawnSync('chmod', ['+x', setupScript]);
    const result = spawnSync('bash', [setupScript], { stdio: 'inherit' });
    if (result.status !== 0) {
      console.log(`\n${Y}⚠  Some packages had warnings — non-fatal.${R}\n`);
    }
  } else {
    console.log(`${Y}⚠  setup.sh not found, skipping.${R}\n`);
  }

  console.log(`\n${G}${B}✔ Setup complete! Starting OrinIDE...${R}\n`);
}

// ── Parse --port flag ─────────────────────────────────────────
const args = process.argv.slice(2);
let port = 3000;
const portIdx = args.findIndex(a => a === '--port' || a === '-p');
if (portIdx !== -1 && args[portIdx + 1]) {
  port = parseInt(args[portIdx + 1], 10);
}
process.env.PORT = port;

// ── Launch server ─────────────────────────────────────────────
const server = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port }
});

const url = `http://127.0.0.1:${port}`;
console.log(`\n🚀  OrinIDE is starting on ${url}`);
console.log(`   Press Ctrl+C to stop.\n`);

// Auto-open browser on PC (skip Termux / CI)
if (!isTermux && !process.env.CI) {
  try {
    const open =
      process.platform === 'darwin' ? 'open' :
      process.platform === 'win32'  ? 'start' : 'xdg-open';
    setTimeout(() => {
      try { execSync(`${open} ${url}`, { stdio: 'ignore' }); } catch (_) {}
    }, 1200);
  } catch (_) {}
}

server.on('error', err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

server.on('close', code => { process.exit(code ?? 0); });

process.on('SIGINT',  () => { server.kill('SIGINT');  });
process.on('SIGTERM', () => { server.kill('SIGTERM'); });
