'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');

// ── Security: project name whitelist ─────────────────────────────────────
function safeProjectName(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_\-. ]{1,128}$/.test(name);
}

// ── Security: localhost-only middleware ───────────────────────────────────
function localOnly(req, res, next) {
  const ip = req.socket.remoteAddress || '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  res.status(403).send('Forbidden');
}

router.get('/:proj/*filePath', localOnly, (req, res) => {
  if (!safeProjectName(req.params.proj))
    return res.status(400).send('Invalid project name');

  const filePath = req.params.filePath || 'index.html';
  const projBase = path.join(BASE, req.params.proj);
  const full = path.resolve(projBase, filePath);

  // path traversal guard
  if (!full.startsWith(projBase)) return res.status(403).send('Forbidden');

  if (!fs.existsSync(full)) {
    const idx = path.join(projBase, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.status(404).send('Not found');
  }
  if (fs.statSync(full).isDirectory()) {
    const idx = path.join(full, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.status(404).send('No index.html');
  }

  res.setHeader('Content-Type', mime.lookup(full) || 'application/octet-stream');
  res.sendFile(full);
});

module.exports = router;
