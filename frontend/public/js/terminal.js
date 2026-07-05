'use strict';
/* ============================================================
   TERMINAL MANAGER — Termux-style sessions with persistence
   Sessions survive tab switches and page refreshes.
   Cleared when user exits workspace or clicks "New Session".
   ============================================================ */
const TermMgr = {
  term: null, fitAddon: null, ws: null,
  history: [], histIdx: -1, fallback: false,
  BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/root/orin-ide-projects' : '/root/orin-ide-projects',

  // Session management
  _sessions: {},      // { id: { id, name, lines: [], history: [], created: ts } }
  _activeSession: null,
  _sessionKey: 'ci_term_sessions',
  _activeKey: 'ci_term_active',

  init() {
    this._loadSessions();
    this._connectWS();
    this._initXterm();
    this._bindUI();
    this._renderSessionBar();
  },

  // ── Session persistence ────────────────────────────────────
  _loadSessions() {
    try {
      this._sessions = JSON.parse(localStorage.getItem(this._sessionKey) || '{}');
    } catch { this._sessions = {}; }
    const activeId = localStorage.getItem(this._activeKey);
    if (activeId && this._sessions[activeId]) {
      this._activeSession = activeId;
    } else {
      // Create default session
      this._createSession('Session 1');
    }
  },

  _saveSessions() {
    try { localStorage.setItem(this._sessionKey, JSON.stringify(this._sessions)); } catch {}
    if (this._activeSession) {
      try { localStorage.setItem(this._activeKey, this._activeSession); } catch {}
    }
  },

  _createSession(name) {
    const id = 's_' + Date.now();
    this._sessions[id] = {
      id,
      name: name || 'Session ' + Object.keys(this._sessions).length + 1,
      lines: [],
      history: [],
      created: Date.now()
    };
    this._activeSession = id;
    this._saveSessions();
    this._renderSessionBar();
    return id;
  },

  _switchSession(id) {
    if (!this._sessions[id]) return;
    this._activeSession = id;
    this._saveSessions();
    this._replaySession();
    this._renderSessionBar();
  },

  _deleteSession(id) {
    if (Object.keys(this._sessions).length <= 1) {
      toast('Cannot delete the last session', 'wrn');
      return;
    }
    delete this._sessions[id];
    if (this._activeSession === id) {
      this._activeSession = Object.keys(this._sessions)[0];
    }
    this._saveSessions();
    this._replaySession();
    this._renderSessionBar();
  },

  _getActive() {
    return this._sessions[this._activeSession];
  },

  _replaySession() {
    const session = this._getActive();
    if (!session) return;

    // Clear terminal display
    if (this.fallback || !this.term) {
      const c = document.getElementById('term-lines');
      if (c) c.innerHTML = '';
    } else {
      this.term.clear();
    }

    // Replay saved lines
    session.lines.forEach(line => {
      if (this.fallback || !this.term) {
        this._printFallback(line.type, line.text);
      } else {
        this.term.writeln(line.text);
      }
    });

    // Restore command history
    this.history = [...(session.history || [])];
    this.histIdx = -1;
  },

  _renderSessionBar() {
    let bar = document.getElementById('term-session-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'term-session-bar';
      bar.className = 'term-session-bar';
      const termWrap = document.getElementById('terminal-wrap');
      if (termWrap) termWrap.parentNode.insertBefore(bar, termWrap);
    }

    const sessions = Object.values(this._sessions);
    const active = this._activeSession;

    bar.innerHTML = `
      <div class="term-sess-tabs">
        ${sessions.map(s => `
          <div class="term-sess-tab${s.id === active ? ' active' : ''}" data-sid="${s.id}">
            <span class="term-sess-name">${esc(s.name)}</span>
            <button class="term-sess-close" data-sid="${s.id}" title="Close session">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      <button class="term-sess-add" id="btn-term-add-session" title="New session">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    `;

    // Click to switch session
    bar.querySelectorAll('.term-sess-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.target.closest('.term-sess-close')) return;
        this._switchSession(tab.dataset.sid);
      });
      // Double-click to rename
      tab.addEventListener('dblclick', () => {
        const s = this._sessions[tab.dataset.sid];
        if (!s) return;
        const newName = prompt('Rename session:', s.name);
        if (newName && newName.trim()) {
          s.name = newName.trim();
          this._saveSessions();
          this._renderSessionBar();
        }
      });
    });

    // Close session
    bar.querySelectorAll('.term-sess-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._deleteSession(btn.dataset.sid);
      });
    });

    // New session
    document.getElementById('btn-term-add-session')?.addEventListener('click', () => {
      this._createSession();
      this._replaySession();
      this._printFallback('inf', 'New session started.');
    });
  },

  // ── Xterm.js init ──────────────────────────────────────────
  _initXterm() {
    try {
      this.term = new window.Terminal({
        theme: {
          background: '#080808', foreground: '#d4d4d4', cursor: '#3b82f6',
          selection: 'rgba(59,130,246,0.25)',
          black:'#1e1e1e', brightBlack:'#555',
          blue:'#60a5fa', brightBlue:'#93c5fd',
          green:'#4ade80', brightGreen:'#86efac',
          red:'#f87171', brightRed:'#fca5a5',
          yellow:'#fbbf24', brightYellow:'#fde68a',
          cyan:'#22d3ee', brightCyan:'#67e8f9',
          magenta:'#c084fc', brightMagenta:'#e879f9',
          white:'#e2e8f0', brightWhite:'#f8fafc'
        },
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        fontSize: 12, lineHeight: 1.4, cursorBlink: true, cursorStyle: 'block',
        allowTransparency: true, scrollback: 8000
      });
      this.fitAddon = new window.FitAddon.FitAddon();
      this.term.loadAddon(this.fitAddon);
      this.term.open(document.getElementById('xterm-host'));
      setTimeout(() => { try { this.fitAddon.fit(); } catch (e) {} }, 200);
      window.addEventListener('resize', debounce(() => { try { this.fitAddon.fit(); } catch (e) {} }, 250));

      // Print header + replay saved session
      this.term.writeln('\x1b[1;34mOrinIDE Terminal\x1b[0m');
      this._replaySession();
    } catch (e) {
      console.warn('xterm.js unavailable, using fallback terminal:', e.message);
      this.fallback = true;
      this._showFallback();
    }
  },

  // ── WebSocket connection ────────────────────────────────────
  _connectWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      this.ws = new WebSocket(`${proto}//${location.host}/ws`);

      this.ws.onopen = () => {
        if (!this.fallback) {
          this.fallback = true;
          this._showFallback();
        }
        this._printFallback('inf', 'Connected to backend.');
        const cwd = (typeof FileTree !== 'undefined' && FileTree.project)
          ? `${this.BASE}/${FileTree.project}` : this.BASE;
        this.ws.send(JSON.stringify({ type: 'terminal:create', cwd }));
      };

      this.ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'terminal:output' || msg.type === 'terminal:ready') {
            const text = (msg.data || '').replace(/\r/g, '');
            // Save to session
            const session = this._getActive();
            if (session && text.trim()) {
              text.split('\n').forEach(line => {
                if (line !== '') session.lines.push({ type: 'out', text: line });
              });
              this._saveSessions();
            }
            // Display
            if (!this.fallback && this.term) this.term.write(msg.data || '');
            text.split('\n').forEach(line => { if (line !== '') this._printFallback('out', line); });
            this._outputBuf = (this._outputBuf || '') + text;
          } else if (msg.type === 'terminal:done') {
            if (msg.exitCode !== 0) {
              this._printFallback('err', `[Exit code: ${msg.exitCode}]`);
              this._healFromError(this._outputBuf || '');
            }
            this._outputBuf = '';
            this._running = false;
          } else if (msg.type === 'terminal:exit') {
            this._printFallback('inf', '[Process exited]');
          } else if (msg.type === 'watch:change') {
            if (typeof PreviewMgr !== 'undefined') PreviewMgr.onFileChange(msg.path);
          }
        } catch (err) {}
      };

      this.ws.onerror = () => {
        console.warn('WS error — will retry in 3s');
        this._printFallback('err', 'Connection error — retrying...');
      };

      this.ws.onclose = () => {
        this._printFallback('inf', '[Disconnected — reconnecting in 3s...]');
        setTimeout(() => this._connectWS(), 3000);
      };

      if (this.term) {
        this.term.onData(data => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify({ type: 'terminal:input', data }));
        });
      }
    } catch (e) {
      console.warn('WS connect failed:', e.message);
      setTimeout(() => this._connectWS(), 3000);
    }
  },

  // ── Fallback terminal (no xterm.js) ─────────────────────────
  _showFallback() {
    document.getElementById('xterm-host').classList.add('hidden');
    document.getElementById('fallback-term').classList.remove('hidden');
    this._printFallback('inf', 'OrinIDE Terminal (fallback mode)');
    if (FileTree.project) this._printFallback('inf', 'Project: ' + FileTree.project);
  },

  _bindUI() {
    const inp = document.getElementById('term-input');
    const run = () => {
      const cmd = inp.value.trim();
      if (!cmd) return;
      if (this._running) {
        this._printFallback('cmd', cmd);
        inp.value = '';
        this.sendStdin(cmd + '\n');
        return;
      }
      this.history.unshift(cmd); this.histIdx = -1; inp.value = '';

      // Save command to session history
      const session = this._getActive();
      if (session) {
        session.history = [...this.history];
        session.lines.push({ type: 'cmd', text: '$ ' + cmd });
        this._saveSessions();
      }

      this.runFallback(cmd);
    };
    document.getElementById('btn-term-run')?.addEventListener('click', run);
    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { run(); return; }
      if (e.key === 'c' && e.ctrlKey) { this.killRunning(); return; }
      if (e.key === 'ArrowUp') { if (this.histIdx < this.history.length - 1) inp.value = this.history[++this.histIdx]; }
      if (e.key === 'ArrowDown') { this.histIdx > 0 ? inp.value = this.history[--this.histIdx] : (this.histIdx = -1, inp.value = ''); }
    });
    document.getElementById('btn-term-clear')?.addEventListener('click', () => this.clear());
    document.getElementById('btn-term-toggle')?.addEventListener('click', () => this.toggle());
    document.getElementById('btn-term-new')?.addEventListener('click', () => this.newSession());
  },

  toggle() {
    const el = document.getElementById('terminal-wrap');
    el.classList.toggle('collapsed');
    setTimeout(() => { EditorMgr.layout(); try { this.fitAddon && this.fitAddon.fit(); } catch (e) {} }, 60);
  },

  // ── Command execution ──────────────────────────────────────
  runFallback(cmd) {
    this._printFallback('cmd', '$ ' + cmd);

    // Built-in commands
    if (cmd === 'clear' || cmd === 'cls') { this.clear(); return; }
    if (cmd === 'help') {
      this._printFallback('inf', 'Commands: clear, python3 <file>, node <file>, ls, pwd, cat <file>, npm install');
      this._printFallback('inf', 'Ctrl+C to kill a running process.');
      return;
    }

    // Execute via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._running = true;
      this.ws.send(JSON.stringify({
        type: 'terminal:exec',
        command: cmd,
        project: FileTree.project || null,
      }));
      return;
    }

    this._printFallback('err', 'Not connected to backend. Is start.sh running?');
  },

  sendStdin(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'terminal:stdin', data: text }));
    }
  },

  killRunning() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'terminal:kill' }));
      this._running = false;
    }
  },

  // ── Display ─────────────────────────────────────────────────
  _printFallback(type, text) {
    const c = document.getElementById('term-lines');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'tl ' + type;
    d.textContent = text;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  },

  clear() {
    if (this.fallback || !this.term) {
      const c = document.getElementById('term-lines'); if (c) c.innerHTML = '';
    } else { this.term.clear(); }
    // Clear session lines but keep metadata
    const session = this._getActive();
    if (session) { session.lines = []; this._saveSessions(); }
  },

  newSession() {
    this._createSession();
    this._replaySession();
    this._printFallback('inf', 'New session started.');

    // Reconnect WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const cwd = (typeof FileTree !== 'undefined' && FileTree.project)
        ? `${this.BASE}/${FileTree.project}` : this.BASE;
      this.ws.send(JSON.stringify({ type: 'terminal:create', cwd }));
    }
  },

  // ── Self-Healing ────────────────────────────────────────────
  _healFromError(output) {
    if (!output) return;
    const lower = output.toLowerCase();
    let suggestion = null;

    const modMatch = output.match(/Cannot find module ['"]([^'"]+)['"]/i) ||
                     output.match(/Module not found: ['"]([^'"]+)['"]/i);
    if (modMatch) {
      suggestion = { fix: `npm install ${modMatch[1]}`, reason: `Missing module: ${modMatch[1]}` };
    } else if (lower.includes('command not found') || lower.includes('not found')) {
      const cmdMatch = output.match(/(\w+): command not found/i);
      if (cmdMatch) {
        const pkgMap = { python3: 'python', pip3: 'pip', node: 'nodejs', npm: 'npm', git: 'git', gcc: 'gcc' };
        const pkg = pkgMap[cmdMatch[1]] || cmdMatch[1];
        const isTermux = lower.includes('termux') || location.hostname === 'localhost';
        suggestion = { fix: isTermux ? `pkg install ${pkg}` : `sudo apt install ${pkg}`, reason: `Command "${cmdMatch[1]}" not installed` };
      }
    } else if (lower.includes('eaddrinuse') || lower.includes('address already in use')) {
      const portMatch = output.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '3000';
      suggestion = { fix: `lsof -ti:${port} | xargs kill -9 2>/dev/null`, reason: `Port ${port} already in use` };
    } else if (lower.includes('modulenotfounderror') || lower.includes('no module named')) {
      const pyModMatch = output.match(/No module named ['"](\w+)['"]/i);
      if (pyModMatch) suggestion = { fix: `pip3 install ${pyModMatch[1]}`, reason: `Missing Python module: ${pyModMatch[1]}` };
    } else if (lower.includes('permission denied')) {
      const fileMatch = output.match(/Permission denied[:\s]+['"]?([^\s'"]+)/i);
      suggestion = { fix: `chmod +x ${fileMatch ? fileMatch[1] : 'file'}`, reason: 'Permission denied' };
    }

    if (suggestion) {
      const c = document.getElementById('term-lines');
      if (!c) return;
      const healEl = document.createElement('div');
      healEl.className = 'tl heal';
      healEl.innerHTML = `<span class="heal-icon">[fix]</span> <span class="heal-reason">${suggestion.reason}</span>`;
      if (suggestion.fix) {
        const fixBtn = document.createElement('button');
        fixBtn.className = 'heal-fix-btn';
        fixBtn.textContent = '$ ' + suggestion.fix;
        fixBtn.onclick = () => { fixBtn.remove(); this.runFallback(suggestion.fix); };
        healEl.appendChild(fixBtn);
      }
      c.appendChild(healEl);
      c.scrollTop = c.scrollHeight;
    }
  },

  write(text) {
    if (this.fallback || !this.term) this._printFallback('inf', text);
    else this.term.writeln(text);
  },

  print(type, text) {
    this._printFallback(type, text);
  },

  startWatcher() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && FileTree.project) {
      this.ws.send(JSON.stringify({ type: 'watch:start', projectPath: `${this.BASE}/${FileTree.project}` }));
    }
  }
};
window.TermMgr = TermMgr;
