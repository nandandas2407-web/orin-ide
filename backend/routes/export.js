'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { ZipArchive } = require('archiver');
const multer = require('multer');
const unzipper = require('unzipper');

const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');
const ensureBase = () => { if (!fs.existsSync(BASE)) fs.mkdirSync(BASE, { recursive: true }); };
const SKIP = ['node_modules', '.git', '__pycache__'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

// ── Security: project name whitelist ─────────────────────────────────────
function safeProjectName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_\-. ]{1,128}$/.test(name);
}

// ── Security: localhost-only middleware ───────────────────────────────────
function localOnly(req, res, next) {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  res.status(403).json({ error: 'Forbidden' });
}

// ── Security: allowed roots for Termux export ────────────────────────────
const ALLOWED_EXPORT_ROOTS = [
  '/storage/emulated/0/',
  '/sdcard/',
  (process.env.HOME || '/root') + '/',
];

// --- EXPORT ZIP ---
router.get('/:proj/zip', localOnly, (req, res) => {
  if (!safeProjectName(req.params.proj))
    return res.status(400).json({ error: 'Invalid project name' });

  const projPath = path.join(BASE, req.params.proj);
  if (!fs.existsSync(projPath)) return res.status(404).json({ error: 'Not found' });

  // Safe filename: safeProjectName already ensures no quotes/newlines
  const safeName = req.params.proj.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const arc = new ZipArchive({ zlib: { level: 9 } });
  arc.on('error', e => {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed: ' + e.message });
    } else {
      // Streaming already began — can't send a fresh status/JSON body now.
      // Just end the response so the client gets a truncated-but-terminated
      // stream instead of a hung connection, and never let this throw.
      try { res.end(); } catch {}
    }
  });
  arc.pipe(res);
  arc.directory(projPath, req.params.proj, entry => {
    if (SKIP.some(s => entry.name.split('/').includes(s))) return false;
    return entry;
  });
  arc.finalize();
});

// --- EXPORT TO TERMUX PATH ---
router.post('/:proj/termux', localOnly, (req, res) => {
  if (!safeProjectName(req.params.proj))
    return res.status(400).json({ error: 'Invalid project name' });

  const { targetDir } = req.body;
  if (!targetDir) return res.status(400).json({ error: 'targetDir required' });

  // ── Security: restrict targetDir to allowed roots ─────────────────────
  const normalised = targetDir.endsWith('/') ? targetDir : targetDir + '/';
  const allowed = ALLOWED_EXPORT_ROOTS.some(r => normalised.startsWith(r));
  if (!allowed)
    return res.status(400).json({ error: 'targetDir outside allowed paths' });

  const src = path.join(BASE, req.params.proj);
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'Not found' });

  const dest = path.join(targetDir, req.params.proj);
  try {
    fs.mkdirSync(dest, { recursive: true });
    copyDir(src, dest);
    res.json({ success: true, exportedTo: dest });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- IMPORT ZIP --- (moved to server.js as /api/import to avoid Express 5 routing issues)

function copyDir(src, dest) {
  for (const f of fs.readdirSync(src)) {
    if (SKIP.includes(f)) continue;
    const s = path.join(src, f), d = path.join(dest, f);
    fs.statSync(s).isDirectory()
      ? (fs.mkdirSync(d, { recursive: true }), copyDir(s, d))
      : fs.copyFileSync(s, d);
  }
}

module.exports = router;
