#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const G  = '\x1b[32m';
const C  = '\x1b[36m';
const Y  = '\x1b[33m';
const B  = '\x1b[1m';
const R  = '\x1b[0m';

console.log(`
${B}${C}╔══════════════════════════════════════════╗
║         OrinIDE  — by Nandan Das         ║
║       AI-Powered Browser IDE (MIT)       ║
╚══════════════════════════════════════════╝${R}
`);

const isTermux = !!(
  process.env.PREFIX && process.env.PREFIX.includes('com.termux')
);

if (!isTermux) {
  // Non-Termux: just print ready message
  console.log(`${G}✔ OrinIDE installed!${R}\n`);
  console.log(`Start it with:\n`);
  console.log(`  ${G}${B}orin-ide${R}\n`);
  console.log(`Then open: ${C}http://127.0.0.1:3000${R}\n`);
  process.exit(0);
}

// ── Termux: auto-run setup.sh ─────────────────────────────────
console.log(`${Y}${B}Termux detected — running full setup automatically...${R}\n`);

const setupScript = path.join(__dirname, '..', 'setup.sh');

if (!fs.existsSync(setupScript)) {
  console.log(`${Y}⚠ setup.sh not found, skipping.${R}`);
  console.log(`\nStart OrinIDE with: ${G}${B}orin-ide${R}\n`);
  process.exit(0);
}

// Make sure setup.sh is executable
spawnSync('chmod', ['+x', setupScript]);

// Run setup.sh — inherit stdio so user sees full output
const result = spawnSync('bash', [setupScript], { stdio: 'inherit' });

if (result.status !== 0) {
  console.log(`\n${Y}⚠ Setup finished with some warnings (non-fatal).${R}`);
}

console.log(`\n${G}${B}✔ All done! Start OrinIDE with:${R}`);
console.log(`\n  ${C}${B}orin-ide${R}\n`);
