'use strict';
const express   = require('express');
const cors      = require('cors');
const http      = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path      = require('path');
const { spawn } = require('child_process');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server, path: '/ws' });

// ── Security: restrict CORS to localhost only ────────────────────────────
// Prevents cross-origin websites from calling the API.
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. direct curl / Termux browser) or localhost origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: false,
}));

// ── Security: bind to localhost only ────────────────────────────────────
// Enforced in server.listen() below — 127.0.0.1 instead of 0.0.0.0.

app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.use('/api/files',    require('./routes/files'));
app.use('/api/terminal', require('./routes/terminal'));
app.use('/api/preview',  require('./routes/preview'));
app.use('/api/export',   require('./routes/export'));

const termMgr  = require('./services/terminalManager');
const watchMgr = require('./services/watcherManager');

const { BASE, TERMUX_PATH } = require('./routes/terminal');

// ── Security: WebSocket localhost guard ──────────────────────────────────
// Reject WS upgrades from non-loopback IPs.
server.on('upgrade', (req, socket) => {
  const ip = socket.remoteAddress || '';
  if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
  }
});

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
        const shell = process.env.SHELL || '/data/data/com.termux/files/usr/bin/bash';

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
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../frontend/public/index.html')));

// ── Bind to localhost only (127.0.0.1) ──────────────────────────────────
// Previously bound to 0.0.0.0 (all interfaces), which exposed the API
// on the network. Now restricted to loopback.
const PORT = process.env.PORT || 3000;
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n=== OrinIDE ===');
  console.log(`URL : http://127.0.0.1:${PORT}`);
  console.log(`Data: ~/orin-ide-projects/\n`);
});
