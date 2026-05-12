'use strict';
const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const mime    = require('mime-types');

const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');
const ensureBase = () => { if (!fs.existsSync(BASE)) fs.mkdirSync(BASE, { recursive: true }); };

// ── Security: path traversal guard ──────────────────────────────────────
// Always resolves relative to the project directory and verifies the result
// still starts with that directory. Applies to EVERY file operation.
const safe = (proj, rel) => {
  ensureBase();
  const b = path.resolve(path.join(BASE, proj)); // resolve project dir itself
  const r = path.resolve(b, rel || '');
  if (!r.startsWith(b + path.sep) && r !== b) {
    throw new Error('Path traversal blocked');
  }
  return r;
};

// ── Security: project name whitelist ────────────────────────────────────
// Validates :name / :proj params so they can never escape BASE via the
// project segment (e.g. `../../etc`).
function safeProjectName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_\-. ]{1,128}$/.test(name);
}

const SKIP = ['node_modules', '.git', '__pycache__', '.DS_Store'];

// ── Security: localhost-only middleware ──────────────────────────────────
// All file-management APIs are restricted to localhost.
function localOnly(req, res, next) {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: local access only' });
}

// Apply to all routes in this router
router.use(localOnly);

// ── list projects ────────────────────────────────────────────────────────
router.get('/projects', (_, res) => {
  ensureBase();
  try {
    const items = fs.readdirSync(BASE).filter(f => {
      try { return fs.statSync(path.join(BASE, f)).isDirectory(); } catch { return false; }
    });
    res.json({ projects: items });
  } catch { res.json({ projects: [] }); }
});

// ── create project ───────────────────────────────────────────────────────
router.post('/projects', (req, res) => {
  ensureBase();
  const name = (req.body.name || '').replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim();
  if (!name || !safeProjectName(name)) return res.status(400).json({ error: 'Invalid name' });
  try { fs.mkdirSync(path.join(BASE, name), { recursive: true }); res.json({ success: true, name }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── delete project ───────────────────────────────────────────────────────
// FIX: previously used req.params.name directly with no validation.
router.delete('/projects/:name', (req, res) => {
  const name = req.params.name;
  if (!safeProjectName(name)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    // Resolve to prevent any edge-case traversal
    const target = path.resolve(path.join(BASE, name));
    if (!target.startsWith(BASE + path.sep) && target !== BASE) {
      return res.status(400).json({ error: 'Path traversal blocked' });
    }
    fs.rmSync(target, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── file tree ────────────────────────────────────────────────────────────
// FIX: previously used req.params.proj directly with no validation.
router.get('/:proj/tree', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const base = path.resolve(path.join(BASE, req.params.proj));
    if (!base.startsWith(BASE + path.sep) && base !== BASE) {
      return res.status(400).json({ error: 'Path traversal blocked' });
    }
    if (!fs.existsSync(base)) return res.json({ tree: [] });
    function build(dir, rel) {
      return fs.readdirSync(dir)
        .filter(e => !SKIP.includes(e) && !e.startsWith('.'))
        .map(e => {
          const full = path.join(dir, e);
          const relPath = rel ? `${rel}/${e}` : e;
          try {
            const stat = fs.statSync(full);
            if (stat.isDirectory()) return { name: e, path: relPath, type: 'dir', children: build(full, relPath) };
            return { name: e, path: relPath, type: 'file', size: stat.size };
          } catch { return null; }
        })
        .filter(Boolean);
    }
    res.json({ tree: build(base, '') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── read file ────────────────────────────────────────────────────────────
router.get('/:proj/file', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const fp = safe(req.params.proj, req.query.path);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(fp, 'utf8');
    res.json({ content, mimeType: mime.lookup(fp) || 'text/plain' });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── write file ───────────────────────────────────────────────────────────
router.post('/:proj/file', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const fp = safe(req.params.proj, req.body.path);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, req.body.content || '', 'utf8');
    res.json({ success: true });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── batch write (AI apply) ───────────────────────────────────────────────
router.post('/:proj/files/batch', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  const results = [];
  for (const file of (req.body.files || [])) {
    try {
      const fp = safe(req.params.proj, file.path);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, file.content || '', 'utf8');
      results.push({ path: file.path, success: true });
    } catch (e) { results.push({ path: file.path, success: false, error: e.message }); }
  }
  res.json({ results });
});

// ── delete file/folder ───────────────────────────────────────────────────
router.delete('/:proj/file', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const fp = safe(req.params.proj, req.query.path);
    const stat = fs.statSync(fp);
    stat.isDirectory() ? fs.rmSync(fp, { recursive: true, force: true }) : fs.unlinkSync(fp);
    res.json({ success: true });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── create folder ────────────────────────────────────────────────────────
router.post('/:proj/folder', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    fs.mkdirSync(safe(req.params.proj, req.body.path), { recursive: true });
    res.json({ success: true });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── upload binary asset ──────────────────────────────────────────────────
const multer = require('multer');
const uploadAsset = multer({
  storage: new multer.MemoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.post('/:proj/asset', uploadAsset.single('asset'), (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const destPath = req.body.path || ('assets/' + req.file.originalname);
    const fp = safe(req.params.proj, destPath);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, req.file.buffer);
    const mimeType = req.file.mimetype || mime.lookup(fp) || 'application/octet-stream';
    res.json({ success: true, path: destPath, size: req.file.size, mimeType });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── serve binary asset ───────────────────────────────────────────────────
router.get('/:proj/asset', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const fp = safe(req.params.proj, req.query.path);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Not found' });
    const mimeType = mime.lookup(fp) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(fs.readFileSync(fp));
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── rename ───────────────────────────────────────────────────────────────
router.post('/:proj/rename', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const oldFp = safe(req.params.proj, req.body.oldPath);
    const newFp = safe(req.params.proj, req.body.newPath);
    fs.mkdirSync(path.dirname(newFp), { recursive: true });
    fs.renameSync(oldFp, newFp);
    res.json({ success: true });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

module.exports = router;
