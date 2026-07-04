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
  storage: multer.memoryStorage(),
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

// ── batch read (project-wide AI context) ──────────────────────────────
// Returns { files: [{ path, content }] } for every text file in the project.
// Binary files (images, zips, etc.) are skipped — too large and not useful for AI.
const TEXT_EXTS = new Set([
  'js','ts','jsx','tsx','html','htm','css','scss','sass','json','md','txt',
  'py','rb','php','java','cpp','c','h','go','rs','sh','bash','sql','xml',
  'yaml','yml','env','toml','ini','conf','gitignore','npmignore','lock',
  'svg','vue','svelte','astro','kt','swift','dart','lua','r','pl','ex','exs'
]);

router.post('/:proj/files/batch-read', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const base = path.resolve(path.join(BASE, req.params.proj));
    if (!fs.existsSync(base)) return res.json({ files: [] });

    const MAX_FILE_SIZE = 200 * 1024; // 200 KB per file
    const MAX_TOTAL     = 800 * 1024; // 800 KB total context
    const files = [];
    let totalBytes = 0;

    function walk(dir, rel) {
      let entries;
      try { entries = fs.readdirSync(dir); } catch { return; }
      for (const e of entries) {
        if (SKIP.includes(e) || e.startsWith('.')) continue;
        const full    = path.join(dir, e);
        const relPath = rel ? `${rel}/${e}` : e;
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat.isDirectory()) {
          walk(full, relPath);
        } else {
          const ext = e.split('.').pop().toLowerCase();
          if (!TEXT_EXTS.has(ext)) continue;
          if (stat.size > MAX_FILE_SIZE) continue;
          if (totalBytes + stat.size > MAX_TOTAL) continue;
          try {
            const content = fs.readFileSync(full, 'utf8');
            files.push({ path: relPath, content });
            totalBytes += stat.size;
          } catch { /* skip unreadable */ }
        }
      }
    }

    walk(base, '');
    res.json({ files });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Normalizes `s` the same way normalize() does (CRLF->LF, tabs->2 spaces,
// strip trailing line whitespace, collapse 3+ blank lines to 2) while
// recording, for every character emitted, the index in the ORIGINAL string
// it came from. This lets us find a match against normalized text and
// still splice the replacement into the real, unmodified file content.
function normalizeWithMap(s) {
  let expanded = '', map1 = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\r') {
      expanded += '\n'; map1.push(i);
      if (s[i + 1] === '\n') i++;
    } else if (c === '\t') {
      expanded += '  '; map1.push(i); map1.push(i);
    } else {
      expanded += c; map1.push(i);
    }
  }
  // Strip trailing spaces/tabs at end of each line
  let stripped = '', map2 = [];
  let lineStart = 0;
  for (let k = 0; k <= expanded.length; k++) {
    if (k === expanded.length || expanded[k] === '\n') {
      let end = k;
      while (end > lineStart && expanded[end - 1] === ' ') end--;
      for (let t = lineStart; t < end; t++) { stripped += expanded[t]; map2.push(map1[t]); }
      if (k < expanded.length) { stripped += '\n'; map2.push(map1[k]); }
      lineStart = k + 1;
    }
  }
  // Collapse runs of 3+ newlines down to 2
  let out = '', map3 = [];
  let j = 0;
  while (j < stripped.length) {
    if (stripped[j] === '\n') {
      const runStart = j;
      while (j < stripped.length && stripped[j] === '\n') j++;
      const keep = Math.min(j - runStart, 2);
      for (let t = 0; t < keep; t++) { out += '\n'; map3.push(map2[runStart + t]); }
    } else {
      out += stripped[j]; map3.push(map2[j]); j++;
    }
  }
  return { text: out, map: map3 };
}

// Maps an index into normalize(original) back to the corresponding index
// in `original`. Recomputes the mapping fresh (cheap for editor-sized
// files) so callers don't need to thread map state through.
function mapNormalizedIndex(original, normalizedTextUnused, normIdx) {
  const { map } = normalizeWithMap(original);
  if (normIdx <= 0) return 0;
  if (normIdx >= map.length) return original.length;
  return map[normIdx];
}

// ── surgical patch (edit without full rewrite) ────────────────────────
// Body: { path, hunks: [{ search, replace }] }
// Each hunk replaces the FIRST occurrence of `search` with `replace`.
// Returns { success, applied, failed, content } where content is the final file.
router.post('/:proj/files/patch', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    const fp = safe(req.params.proj, req.body.path);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File not found' });
    let content = fs.readFileSync(fp, 'utf8');

    const hunks  = Array.isArray(req.body.hunks) ? req.body.hunks : [];
    let applied  = 0;
    let failed   = 0;
    const detail = [];

    // Helper: normalize whitespace for fuzzy matching
    function normalize(s) {
      return s.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    }

    for (const hunk of hunks) {
      let { search, replace } = hunk;
      if (typeof search !== 'string' || typeof replace !== 'string') {
        failed++; detail.push({ search: search?.slice(0,40), ok: false, reason: 'invalid hunk' });
        continue;
      }

      // Try exact match first
      let idx = content.indexOf(search);

      // Fallback: normalize line endings/whitespace to *locate* the match,
      // but always splice into the ORIGINAL, un-normalized `content` so a
      // whitespace-tolerant match never rewrites formatting elsewhere in
      // the file. We never assign a normalized full-file string back.
      if (idx === -1) {
        const normSearch = normalize(search);
        const normContent = normalize(content);
        const normIdx = normContent.indexOf(normSearch);
        if (normIdx !== -1) {
          // Count how many times normSearch occurs — if ambiguous, refuse
          // rather than guess at the wrong location.
          let occurrences = 0;
          for (let from = 0; ; ) {
            const at = normContent.indexOf(normSearch, from);
            if (at === -1) break;
            occurrences++;
            from = at + Math.max(1, normSearch.length);
          }
          if (occurrences > 1) {
            failed++; detail.push({ search: search.slice(0,40), ok: false, reason: 'ambiguous match (normalized whitespace) — search text not unique' });
            continue;
          }

          // Map the normalized match window back to real offsets in the
          // original content by walking both strings in lockstep through
          // the same normalization rules used above.
          const origIdx = mapNormalizedIndex(content, normContent, normIdx);
          const origEndIdx = mapNormalizedIndex(content, normContent, normIdx + normSearch.length);
          if (origIdx !== -1 && origEndIdx !== -1 && origEndIdx >= origIdx) {
            content = content.slice(0, origIdx) + replace + content.slice(origEndIdx);
            applied++; detail.push({ search: search.slice(0,40), ok: true, note: 'fuzzy (whitespace-normalized match)' });
            continue;
          }
          failed++; detail.push({ search: search.slice(0,40), ok: false, reason: 'could not map normalized match back to original text' });
          continue;
        }
      }

      if (idx === -1) {
        failed++; detail.push({ search: search.slice(0,40), ok: false, reason: 'search string not found' });
        continue;
      }
      content = content.slice(0, idx) + replace + content.slice(idx + search.length);
      applied++; detail.push({ search: search.slice(0,40), ok: true });
    }

    fs.writeFileSync(fp, content, 'utf8');
    res.json({ success: true, applied, failed, detail, content });
  } catch (e) { res.status(e.message.includes('traversal') ? 400 : 500).json({ error: e.message }); }
});

// ── project-wide search ───────────────────────────────────────────────────
// Walks every text file in the project and returns every matching line,
// with the file path, 1-based line number, column, and a snippet — enough
// for the client to render results grouped by file and jump straight to
// the matching location when clicked.
const SEARCH_SKIP_EXT = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.svg','.woff','.woff2','.ttf','.eot','.mp4','.mp3','.wav','.zip','.pdf','.bin','.exe','.so','.dll','.pyc','.class','.lock']);
const SEARCH_MAX_FILE_SIZE = 1.5 * 1024 * 1024; // skip files over 1.5MB
const SEARCH_MAX_RESULTS = 500;

router.get('/:proj/search', (req, res) => {
  if (!safeProjectName(req.params.proj)) return res.status(400).json({ error: 'Invalid project name' });
  const query = (req.query.q || '').toString();
  if (!query.trim()) return res.json({ results: [], truncated: false, fileCount: 0 });

  const caseSensitive = req.query.case === '1';
  const wholeWord = req.query.word === '1';
  const useRegex = req.query.regex === '1';

  let matcher;
  try {
    if (useRegex) {
      matcher = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
      matcher = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid search pattern: ' + e.message });
  }

  try {
    const base = path.resolve(path.join(BASE, req.params.proj));
    if (!base.startsWith(BASE + path.sep) && base !== BASE) {
      return res.status(400).json({ error: 'Path traversal blocked' });
    }
    if (!fs.existsSync(base)) return res.json({ results: [], truncated: false, fileCount: 0 });

    const results = [];
    let fileCount = 0;
    let truncated = false;

    function walk(dir, rel) {
      if (truncated) return;
      let entries;
      try { entries = fs.readdirSync(dir); } catch { return; }
      for (const entry of entries) {
        if (truncated) return;
        if (SKIP.includes(entry) || entry.startsWith('.')) continue;
        const full = path.join(dir, entry);
        const relPath = rel ? `${rel}/${entry}` : entry;
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat.isDirectory()) { walk(full, relPath); continue; }
        if (stat.size > SEARCH_MAX_FILE_SIZE) continue;
        const ext = path.extname(entry).toLowerCase();
        if (SEARCH_SKIP_EXT.has(ext)) continue;

        fileCount++;
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        // Skip files that look binary (contain null bytes)
        if (content.indexOf('\u0000') !== -1) continue;

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (truncated) break;
          const line = lines[i];
          matcher.lastIndex = 0;
          let m;
          while ((m = matcher.exec(line)) !== null) {
            results.push({
              file: relPath,
              line: i + 1,
              col: m.index + 1,
              text: line.length > 300 ? line.slice(0, 300) + '…' : line,
              matchLength: m[0].length
            });
            if (results.length >= SEARCH_MAX_RESULTS) { truncated = true; break; }
            if (m.index === matcher.lastIndex) matcher.lastIndex++; // avoid infinite loop on zero-width matches
          }
        }
      }
    }

    walk(base, '');
    res.json({ results, truncated, fileCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
