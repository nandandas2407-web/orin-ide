'use strict';
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const BASE = path.join(process.env.HOME || '/root', 'orin-ide-projects');
const watchers = new Map();

function watch(projPath, ws) {
  // Safety guard: never watch root or paths outside orin-ide-projects
  if (!projPath || projPath === '/' || projPath === process.env.HOME) {
    console.warn('[watcherManager] Refused to watch unsafe path:', projPath);
    return;
  }

  // Ensure path is inside BASE
  const resolved = path.resolve(projPath);
  if (!resolved.startsWith(BASE)) {
    console.warn('[watcherManager] Path outside projects dir, skipping:', resolved);
    return;
  }

  // Ensure directory actually exists before watching
  if (!fs.existsSync(resolved)) {
    console.warn('[watcherManager] Path does not exist, skipping:', resolved);
    return;
  }

  if (watchers.has(resolved)) {
    try { watchers.get(resolved).close(); } catch {}
  }

  try {
    const w = chokidar.watch(resolved, {
      ignored: /(node_modules|\.git|__pycache__|\.pyc$)/,
      persistent: true,
      ignoreInitial: true,
      ignorePermissionErrors: true,   // don't crash on permission errors
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    const send = (ev, fp) => {
      if (ws.readyState === 1)
        ws.send(JSON.stringify({
          type: 'watch:change',
          event: ev,
          path: fp.replace(resolved, '').replace(/^\//, ''),
        }));
    };

    w.on('change', p => send('change', p));
    w.on('add',    p => send('add', p));
    w.on('unlink', p => send('remove', p));
    w.on('error',  e => console.warn('[watcherManager] watcher error (ignored):', e.message));

    watchers.set(resolved, w);
  } catch (e) {
    console.warn('[watcherManager] Failed to start watcher:', e.message);
  }
}

function stop(projPath) {
  const resolved = path.resolve(projPath || '');
  try { watchers.get(resolved)?.close(); } catch {}
  watchers.delete(resolved);
}

module.exports = { watch, stop };
