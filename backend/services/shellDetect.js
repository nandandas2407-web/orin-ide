'use strict';
const fs = require('fs');

// Candidate shells to try, in priority order, after $SHELL. Covers Termux
// (both the modern and legacy prefix path), common Linux locations, and
// macOS/BSD locations. `sh` is the final fallback since POSIX guarantees it.
const CANDIDATES = [
  '/data/data/com.termux/files/usr/bin/bash',
  '/data/data/com.termux/files/usr/bin/sh',
  '/usr/bin/bash',
  '/bin/bash',
  '/usr/local/bin/bash',
  '/bin/sh',
  '/usr/bin/sh',
];

let cached = null;

/**
 * Resolve a real, existing shell binary to spawn commands with.
 * Priority: $SHELL (if it actually exists on disk) -> known-good
 * candidate paths -> 'sh' (let PATH resolution find it as a last resort).
 *
 * Previously this was hardcoded per-callsite to
 * `process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash'`,
 * which meant any PC, server, or container where $SHELL isn't exported
 * (common — many non-interactive/service environments never set it)
 * would try to spawn a Termux-only path that doesn't exist there,
 * causing every terminal command to fail with ENOENT.
 */
function detectShell() {
  if (cached) return cached;

  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
    return (cached = process.env.SHELL);
  }
  for (const candidate of CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return (cached = candidate);
    }
  }
  // Nothing found on disk at the usual spots — fall back to the bare
  // name and let the OS resolve it via PATH. Better than guaranteed ENOENT.
  return (cached = 'sh');
}

module.exports = { detectShell };
