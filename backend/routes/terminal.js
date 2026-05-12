'use strict';
const express = require('express');
const router  = express.Router();
const { spawn } = require('child_process');
const path    = require('path');

const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');

const TERMUX_PATH = [
  '/data/data/com.termux/files/usr/bin',
  '/data/data/com.termux/files/usr/local/bin',
  process.env.PATH || '',
].join(':');

// ── Security: localhost-only middleware ──────────────────────────────────
// Blocks any request that didn't originate from 127.0.0.1 / ::1.
function localOnly(req, res, next) {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: local access only' });
}

// ── Security: project name sanitiser ────────────────────────────────────
function safeProject(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_\-. ]{1,128}$/.test(name);
}

// ── Security: command validation ─────────────────────────────────────────
// Note: UX guard against accidental destruction, not a complete security boundary.
const BANNED_PATTERNS = [
  /\brm\b.*\s+[\/~]/,          // catches -rf, -r -f, --no-preserve-root, etc.
  /\bmkfs\b/,
  /\bdd\b.*\bif=/,
  /:\(\)\s*\{.*:\s*\|.*:\s*&\s*\}.*:/,  // fork bomb
];
const MAX_CMD_LEN = 4096;

function validateCommand(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0) return 'command required';
  if (cmd.length > MAX_CMD_LEN) return 'command too long';
  for (const pat of BANNED_PATTERNS) {
    if (pat.test(cmd)) return 'command not allowed';
  }
  return null;
}

// ── Security: cap buffered output ────────────────────────────────────────
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/terminal/exec
 * Buffered exec (kept for backward compatibility).
 * Real streaming goes through WebSocket (terminal:exec).
 *
 * SECURITY: localhost-only, validated command, capped output.
 */
router.post('/exec', localOnly, (req, res) => {
  const { command, project } = req.body;

  const err = validateCommand(command);
  if (err) return res.status(400).json({ error: err });

  if (project !== undefined && !safeProject(project)) {
    return res.status(400).json({ error: 'Invalid project name' });
  }

  const cwd = project ? path.join(BASE, project) : BASE;
  const shell = process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash';

  let stdoutBuf = '', stderrBuf = '', totalBytes = 0, truncated = false;

  const appendSafe = (target, chunk) => {
    if (truncated) return target;
    const s = chunk.toString();
    const len = Buffer.byteLength(s);
    totalBytes += len;
    if (totalBytes > MAX_OUTPUT_BYTES) {
      truncated = true;
      const remaining = MAX_OUTPUT_BYTES - (totalBytes - len);
      return target + s.slice(0, Math.max(0, remaining)) + '\n[output truncated]';
    }
    return target + s;
  };

  const child = spawn(shell, ['-c', command], {
    cwd,
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1', PATH: TERMUX_PATH },
    timeout: 120000,
  });

  child.stdout.on('data', d => { stdoutBuf = appendSafe(stdoutBuf, d); });
  child.stderr.on('data', d => { stderrBuf = appendSafe(stderrBuf, d); });
  child.on('close', code => res.json({ stdout: stdoutBuf, stderr: stderrBuf, exitCode: code ?? 0 }));
  child.on('error', err => res.json({ stdout: stdoutBuf, stderr: stderrBuf + '\n' + err.message, exitCode: 1 }));
});

module.exports = router;
module.exports.BASE = BASE;
module.exports.TERMUX_PATH = TERMUX_PATH;
