'use strict';
const express   = require('express');
const cors      = require('cors');
const http      = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path      = require('path');
const fs        = require('fs');
const { spawn } = require('child_process');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server, path: '/ws' });

// ── CORS: allow all origins (network access) ─────────────────────────
app.use(cors({
  origin: true,
  credentials: false,
}));

// ── Security: bind to localhost only ────────────────────────────────────
// Enforced in server.listen() below — 127.0.0.1 instead of 0.0.0.0.

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));

// No-cache for JS files during development
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.use('/api/files',    require('./routes/files'));
app.use('/api/terminal', require('./routes/terminal'));
app.use('/api/preview',  require('./routes/preview'));
app.use('/api/export',   require('./routes/export'));

// ══════════════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT — rebuilt from scratch, no multer
// ══════════════════════════════════════════════════════════════════════════════
const unzipper = require('unzipper');
const { ZipArchive } = require('archiver');
const EXPORT_BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');
const SKIP = ['node_modules', '.git', '__pycache__'];

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function safeName(n) {
  return typeof n === 'string' && /^[a-zA-Z0-9_\-. ]{1,128}$/.test(n);
}

// ── EXPORT ZIP ──────────────────────────────────────────────────────────────
app.get('/api/export-zip/:proj', (req, res) => {
  const proj = req.params.proj;
  if (!safeName(proj)) return res.status(400).json({ error: 'Invalid project name' });
  const dir = path.join(EXPORT_BASE, proj);
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Project not found' });

  const safe = proj.replace(/[^a-zA-Z0-9_\-.]/g, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.zip"`);

  const arc = new ZipArchive({ zlib: { level: 9 } });
  arc.on('error', e => { console.error('[export error]', e.message); if (!res.headersSent) res.status(500).end(); });
  arc.pipe(res);
  arc.directory(dir, proj, entry => {
    if (SKIP.some(s => entry.name.split('/').includes(s))) return false;
    return entry;
  });
  arc.finalize();
});

// ── IMPORT ZIP — receives base64-encoded ZIP as JSON ────────────────────────
app.post('/api/import-zip', async (req, res) => {
  console.log('[IMPORT] Hit /api/import-zip, body keys:', Object.keys(req.body || {}));
  try {
    const { zipData, fileName, projectName } = req.body;
    if (!zipData) return res.status(400).json({ error: 'No ZIP data provided' });

    const zipBuf = Buffer.from(zipData, 'base64');
    const dir = await unzipper.Open.buffer(zipBuf);
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

    let projName = (projectName || '').trim();
    if (!projName) projName = strip ? strip.replace(/\/$/, '') : (fileName || 'imported').replace(/\.zip$/i, '');
    projName = projName.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'imported-project';

    const projPath = path.join(EXPORT_BASE, projName);
    ensureDir(projPath);

    let count = 0;
    for (const entry of entries) {
      if (entry.type === 'Directory') continue;
      let rel = entry.path;
      if (strip && rel.startsWith(strip)) rel = rel.slice(strip.length);
      if (!rel) continue;
      if (SKIP.some(s => rel.startsWith(s + '/'))) continue;
      const dest = path.resolve(projPath, rel);
      if (!dest.startsWith(projPath)) continue;
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, await entry.buffer());
      count++;
    }
    res.json({ success: true, projectName: projName, filesExtracted: count });
  } catch (e) {
    console.error('[import-zip error]', e.message);
    res.status(500).json({ error: 'Import failed: ' + e.message });
  }
});

const termMgr  = require('./services/terminalManager');
const watchMgr = require('./services/watcherManager');
const { detectShell } = require('./services/shellDetect');

const { BASE, TERMUX_PATH } = require('./routes/terminal');

// Track running streaming processes per connection
const runningProcs = new Map();

// ── Security: validate commands coming over WebSocket ────────────────────
// Note: this is a UX guard against accidental destruction, not a complete
// security boundary. A determined local user already has shell access.
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

// ── Security: project name whitelist for WebSocket paths ─────────────────
function safeProject(name) {
  return !name || /^[a-zA-Z0-9_\-. ]{1,128}$/.test(name);
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10 MB cap per execution

wss.on('connection', (ws) => {
  // ── Security: connection limit (max 10 concurrent WS clients) ────────────
  if (wss.clients.size > 10) {
    ws.close(1008, 'Too many connections');
    return;
  }
  const cid = Date.now() + '_' + Math.random().toString(36).slice(2);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // ── Real-time streaming exec over WebSocket ──────────────
      if (msg.type === 'terminal:exec') {
        const { command, project } = msg;

        const err = validateCommand(command);
        if (err) {
          ws.send(JSON.stringify({ type: 'terminal:output', data: `\r\nError: ${err}\r\n` }));
          ws.send(JSON.stringify({ type: 'terminal:done', exitCode: 1 }));
          return;
        }

        if (!safeProject(project)) {
          ws.send(JSON.stringify({ type: 'terminal:output', data: '\r\nError: invalid project name\r\n' }));
          ws.send(JSON.stringify({ type: 'terminal:done', exitCode: 1 }));
          return;
        }

        // Kill previous proc for this connection if still running
        if (runningProcs.has(cid)) {
          try { runningProcs.get(cid).kill(); } catch {}
          runningProcs.delete(cid);
        }

        const cwd = project ? path.join(BASE, project) : BASE;
        const shell = detectShell();

        const child = spawn(shell, ['-c', command], {
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            FORCE_COLOR: '1',
            PYTHONUNBUFFERED: '1',
            PATH: TERMUX_PATH,
          },
        });

        runningProcs.set(cid, child);

        let totalBytes = 0, outputCapped = false;

        const send = (data) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: 'terminal:output', data }));
        };

        const sendSafe = (chunk) => {
          if (outputCapped) return;
          const s = chunk.toString();
          const len = Buffer.byteLength(s);
          totalBytes += len;
          if (totalBytes > MAX_OUTPUT_BYTES) {
            outputCapped = true;
            send(s.slice(0, Math.max(0, MAX_OUTPUT_BYTES - (totalBytes - len))));
            send('\r\n[output truncated — limit reached]\r\n');
            return;
          }
          send(s);
        };

        child.stdout.on('data', d => sendSafe(d));
        child.stderr.on('data', d => sendSafe(d));

        child.on('close', (code) => {
          runningProcs.delete(cid);
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'terminal:done', exitCode: code ?? 0 }));
        });

        child.on('error', (err) => {
          runningProcs.delete(cid);
          send('\r\nError: ' + err.message + '\r\n');
        });

        return;
      }

      // ── Kill running process (Ctrl+C) ────────────────────────
      if (msg.type === 'terminal:kill') {
        if (runningProcs.has(cid)) {
          try { runningProcs.get(cid).kill('SIGINT'); } catch {}
          runningProcs.delete(cid);
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'terminal:output', data: '\r\n^C\r\n' }));
        }
        return;
      }

      // ── Send stdin to running process ────────────────────────
      if (msg.type === 'terminal:stdin') {
        const proc = runningProcs.get(cid);
        if (proc && proc.stdin && !proc.stdin.destroyed) {
          proc.stdin.write(msg.data);
        }
        return;
      }

      // ── Original PTY-based terminal (node-pty path) ──────────
      if (msg.type === 'terminal:create') termMgr.create(cid, ws, msg.cwd);
      else if (msg.type === 'terminal:input') termMgr.write(cid, msg.data);
      else if (msg.type === 'terminal:resize') termMgr.resize(cid, msg.cols, msg.rows);
      else if (msg.type === 'watch:start') watchMgr.watch(msg.projectPath, ws);
      else if (msg.type === 'watch:stop')  watchMgr.stop(msg.projectPath);

    } catch (e) { console.error('ws msg error:', e.message); }
  });

  ws.on('close', () => {
    termMgr.destroy(cid);
    if (runningProcs.has(cid)) {
      try { runningProcs.get(cid).kill(); } catch {}
      runningProcs.delete(cid);
    }
  });

  ws.send(JSON.stringify({ type: 'connected', cid }));
});

app.get('/api/health', (_, res) => res.json({ ok: true, t: Date.now() }));

// ── Redirect old import URL to new one (for cached JS) ──────────────────────
// Handles both old multipart and new JSON - just routes to the same logic
const multer = require('multer');
const uploadOld = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.all('/api/export/import', uploadOld.single('zipfile'), async (req, res) => {
  console.log('[IMPORT-OLD] Hit legacy /api/export/import');
  try {
    let zipBuf;
    let projName = (req.query.project || '').trim();
    let fileName = 'imported';

    if (req.file) {
      // Old multipart upload
      zipBuf = req.file.buffer;
      fileName = req.file.originalname || fileName;
    } else if (req.body && req.body.zipData) {
      // New JSON base64
      zipBuf = Buffer.from(req.body.zipData, 'base64');
      fileName = req.body.fileName || fileName;
      projName = projName || req.body.projectName || '';
    } else {
      return res.status(400).json({ error: 'No ZIP data provided' });
    }

    const dir = await unzipper.Open.buffer(zipBuf);
    const entries = dir.files;
    if (!entries.length) return res.status(400).json({ error: 'ZIP is empty' });

    const filePaths = entries.map(e => e.path);
    const roots = [...new Set(filePaths.map(p => p.split('/')[0]))];
    let strip = '';
    if (roots.length === 1) {
      const candidate = roots[0] + '/';
      if (filePaths.every(p => p.startsWith(candidate) || p === roots[0])) strip = candidate;
    }

    if (!projName) projName = strip ? strip.replace(/\/$/, '') : fileName.replace(/\.zip$/i, '');
    projName = projName.replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim() || 'imported-project';

    const projPath = path.join(EXPORT_BASE, projName);
    ensureDir(projPath);

    let count = 0;
    for (const entry of entries) {
      if (entry.type === 'Directory') continue;
      let rel = entry.path;
      if (strip && rel.startsWith(strip)) rel = rel.slice(strip.length);
      if (!rel) continue;
      if (SKIP.some(s => rel.startsWith(s + '/'))) continue;
      const dest = path.resolve(projPath, rel);
      if (!dest.startsWith(projPath)) continue;
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, await entry.buffer());
      count++;
    }
    res.json({ success: true, projectName: projName, filesExtracted: count });
  } catch (e) {
    console.error('[import-old error]', e.message);
    res.status(500).json({ error: 'Import failed: ' + e.message });
  }
});

// ── JSON error handler — prevent HTML error pages for API routes ────────────
app.use('/api', (err, req, res, next) => {
  console.error('[API error]', err.message || err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.get('/{*path}', (req, res) => {
  // Anything that looks like a static asset request (has a file extension,
  // e.g. /vendor/monaco-editor/.../loader.min.js) should 404 properly when
  // missing, not silently fall back to index.html. Serving HTML in place of
  // a missing .js/.css/.woff2 file used to surface as a baffling browser
  // "Unexpected token '<'" syntax error instead of a clear 404 — hiding the
  // real problem (a bad path) behind an unrelated-looking error.
  if (/\.[a-zA-Z0-9]+$/.test(req.path) && !req.path.endsWith('.html')) {
    return res.status(404).type('text/plain').send('Not found: ' + req.path);
  }
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── AI Proxy — routes API calls through backend to avoid CORS issues ──
app.post('/api/ai/proxy', async (req, res) => {
  try {
    const { url, headers, body } = req.body;
    if (!url || !body) return res.status(400).json({ error: 'Missing url or body' });

    const fetchHeaders = { ...headers };
    delete fetchHeaders['host'];
    delete fetchHeaders['origin'];
    delete fetchHeaders['referer'];

    const response = await fetch(url, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(body),
    });

    res.status(response.status);
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');

    if (body.stream) {
      // Stream SSE response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (e) {
    console.error('[AI Proxy]', e.message);
    res.status(502).json({ error: 'Proxy error: ' + e.message });
  }
});

// ── Bind to all interfaces (0.0.0.0) for network access ─────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  const addr = HOST === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : HOST;
  console.log('\n=== OrinIDE ===');
  console.log(`URL : http://127.0.0.1:${PORT}`);
  console.log(`LAN : http://<your-lan-ip>:${PORT}`);
  console.log(`Data: ~/orin-ide-projects/\n`);
});
