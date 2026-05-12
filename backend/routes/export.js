'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const multer = require('multer');
const unzipper = require('unzipper');

const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');
const ensureBase = () => { if (!fs.existsSync(BASE)) fs.mkdirSync(BASE, { recursive: true }); };
const SKIP = ['node_modules', '.git', '__pycache__'];

const upload = multer({ storage: new multer.MemoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

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

  const arc = archiver('zip', { zlib: { level: 9 } });
  arc.on('error', e => { console.error(e); res.status(500).end(); });
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

// --- IMPORT ZIP ---
router.post('/import', localOnly, upload.single('zipfile'), async (req, res) => {
  ensureBase();
  if (!req.file) return res.status(400).json({ error: 'No ZIP file provided' });
  try {
    const dir = await unzipper.Open.buffer(req.file.buffer);
    const entries = dir.files;
    if (!entries.length) return res.status(400).json({ error: 'ZIP is empty' });

    // detect common root prefix
    const filePaths = entries.map(e => e.path);
    const roots = [...new Set(filePaths.map(p => p.split('/')[0]))];
    let strip = '';
    if (roots.length === 1) {
      const candidate = roots[0] + '/';
      if (filePaths.every(p => p.startsWith(candidate) || p === roots[0])) strip = candidate;
    }

    let projName = (req.query.project || '').trim();
    if (!projName) projName = strip ? strip.replace(/\/$/, '') : req.file.originalname.replace(/\.zip$/i, '');
    projName = projName.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'imported-project';

    const projPath = path.join(BASE, projName);
    fs.mkdirSync(projPath, { recursive: true });

    let count = 0;
    for (const entry of entries) {
      if (entry.type === 'Directory') continue;
      let rel = entry.path;
      if (strip && rel.startsWith(strip)) rel = rel.slice(strip.length);
      if (!rel) continue;
      if (SKIP.some(s => rel.startsWith(s + '/'))) continue;
      const dest = path.resolve(projPath, rel);
      if (!dest.startsWith(projPath)) continue; // zip-slip guard
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, await entry.buffer());
      count++;
    }
    res.json({ success: true, projectName: projName, filesExtracted: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Import failed: ' + e.message });
  }
});

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
