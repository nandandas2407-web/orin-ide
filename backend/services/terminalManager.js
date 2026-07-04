'use strict';
const path = require('path');
const { detectShell } = require('./shellDetect');
const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');

let pty;
try { pty = require('node-pty'); } catch { pty = null; }

const terms = new Map();

// Build a full PATH that includes Termux bin dirs, npm globals, Go, Rust, etc.
function buildEnv() {
  const extra = [
    '/data/data/com.termux/files/usr/bin',
    '/data/data/com.termux/files/usr/local/bin',
    '/data/data/com.termux/files/home/.cargo/bin',
    '/data/data/com.termux/files/home/go/bin',
    '/data/data/com.termux/files/usr/lib/node_modules/.bin',
  ].join(':');

  return {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: 'en_US.UTF-8',
    HOME: process.env.HOME || '/data/data/com.termux/files/home',
    PATH: extra + ':' + (process.env.PATH || ''),
    JAVA_HOME: process.env.JAVA_HOME || '',
    GOPATH: process.env.HOME + '/go',
    CARGO_HOME: process.env.HOME + '/.cargo',
    FORCE_COLOR: '1',
  };
}

function create(cid, ws, cwd) {
  destroy(cid);
  const shell = detectShell();
  const dir = cwd || BASE;
  const env = buildEnv();

  if (!pty) {
    ws.send(JSON.stringify({
      type: 'terminal:output',
      data: '\r\n\x1b[33m⚠ node-pty not available — using exec fallback.\x1b[0m\r\n' +
            '\x1b[90mRun setup.sh to enable full interactive terminal.\x1b[0m\r\n$ '
    }));
    return;
  }

  try {
    const t = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 36,
      cwd: dir,
      env,
    });

    t.onData(d => {
      if (ws.readyState === 1)
        ws.send(JSON.stringify({ type: 'terminal:output', data: d }));
    });

    t.onExit(() => {
      if (ws.readyState === 1)
        ws.send(JSON.stringify({ type: 'terminal:exit' }));
      terms.delete(cid);
    });

    terms.set(cid, t);

    ws.send(JSON.stringify({
      type: 'terminal:ready',
      data: `\r\n\x1b[32m✔ OrinIDE Terminal ready\x1b[0m  \x1b[90m(${dir})\x1b[0m\r\n`
    }));
  } catch (e) {
    ws.send(JSON.stringify({
      type: 'terminal:output',
      data: `\r\n\x1b[31m✘ Failed to spawn terminal: ${e.message}\x1b[0m\r\n`
    }));
  }
}

function write(cid, data)          { terms.get(cid)?.write(data); }
function resize(cid, cols, rows)   { terms.get(cid)?.resize(cols, rows); }
function destroy(cid)              { try { terms.get(cid)?.kill(); } catch {} terms.delete(cid); }

module.exports = { create, write, resize, destroy };
