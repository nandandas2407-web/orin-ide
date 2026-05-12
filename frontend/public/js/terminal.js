'use strict';
const TermMgr = {
  term: null, fitAddon: null, ws: null,
  history: [], histIdx: -1, fallback: false,
  BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/root/orin-ide-projects' : '/root/orin-ide-projects',

  init() {
    // Always connect WS first — independent of xterm.js
    this._connectWS();
    this._initXterm();
    this._bindUI();
  },

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
      this.term.writeln('\x1b[1;34mOrinIDE Terminal\x1b[0m');
      this.term.writeln('\x1b[90mConnecting to backend...\x1b[0m\r\n');
    } catch (e) {
      console.warn('xterm.js unavailable, using fallback terminal:', e.message);
      this.fallback = true;
      this._showFallback();
    }
  },

  _connectWS() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      this.ws = new WebSocket(`${proto}//${location.host}/ws`);

      this.ws.onopen = () => {
        // Show fallback UI always (no node-pty), but WS is connected
        if (!this.fallback) {
          this.fallback = true;
          this._showFallback();
        }
        this._print('inf', '✔ Connected to backend.');
        const cwd = (typeof FileTree !== 'undefined' && FileTree.project)
          ? `${this.BASE}/${FileTree.project}` : this.BASE;
        this.ws.send(JSON.stringify({ type: 'terminal:create', cwd }));
      };

      this.ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'terminal:output' || msg.type === 'terminal:ready') {
            // Stream output live line by line into fallback terminal
            const text = (msg.data || '').replace(/\r/g, '');
            text.split('\n').forEach(line => { if (line !== '') this._print('out', line); });
            if (!this.fallback && this.term) this.term.write(msg.data || '');
          } else if (msg.type === 'terminal:done') {
            if (msg.exitCode !== 0)
              this._print('err', `[Exit code: ${msg.exitCode}]`);
            this._running = false;
          } else if (msg.type === 'terminal:exit') {
            this._print('inf', '[Process exited]');
          } else if (msg.type === 'watch:change') {
            if (typeof PreviewMgr !== 'undefined') PreviewMgr.onFileChange(msg.path);
          }
        } catch (err) { /* ignore parse errors */ }
      };

      this.ws.onerror = (e) => {
        console.warn('WS error — will retry in 3s');
        this._print && this._print('err', 'Connection error — retrying...');
      };

      this.ws.onclose = () => {
        this._print && this._print('inf', '[Disconnected — reconnecting in 3s...]');
        // Auto-reconnect after 3 seconds
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

  _showFallback() {
    document.getElementById('xterm-host').classList.add('hidden');
    document.getElementById('fallback-term').classList.remove('hidden');
    this._print('inf', 'OrinIDE Terminal (fallback mode — node-pty not installed)');
    this._print('inf', 'Type commands below and press Enter or click Run.');
    if (FileTree.project) this._print('inf', 'Project: ' + FileTree.project);
  },

  _bindUI() {
    const inp = document.getElementById('term-input');
    const run = () => {
      const cmd = inp.value.trim();
      if (!cmd) return;
      // If a process is running, send as stdin instead
      if (this._running) {
        this._print('cmd', cmd);
        inp.value = '';
        this.sendStdin(cmd + '\n');
        return;
      }
      this.history.unshift(cmd); this.histIdx = -1; inp.value = '';
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
  },

  toggle() {
    const el = document.getElementById('terminal-wrap');
    el.classList.toggle('collapsed');
    setTimeout(() => { EditorMgr.layout(); try { this.fitAddon && this.fitAddon.fit(); } catch (e) {} }, 60);
  },

  runFallback(cmd) {
    this._print('cmd', '$ ' + cmd);

    // Built-in commands
    if (cmd === 'clear' || cmd === 'cls') { this.clear(); return; }
    if (cmd === 'help') {
      this._print('inf', 'Commands: clear, python3 <file>, clang <file> -o out, ./out, ls, pwd, cat <file>');
      this._print('inf', 'Ctrl+C to kill a running process.');
      return;
    }

    // Always use WebSocket streaming exec — works for non-PTY mode too
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._running = true;
      this.ws.send(JSON.stringify({
        type: 'terminal:exec',
        command: cmd,
        project: FileTree.project || null,
      }));
      return;
    }

    this._print('err', 'Not connected to backend. Is start.sh running?');
  },

  // Send stdin to a running process (e.g. Python input())
  sendStdin(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'terminal:stdin', data: text }));
    }
  },

  // Kill running process
  killRunning() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'terminal:kill' }));
      this._running = false;
    }
  },

  _print(type, text) {
    const c = document.getElementById('term-lines');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'tl ' + type;
    d.textContent = text;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  },

  _printColor(type, text, color) {
    const c = document.getElementById('term-lines');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'tl ' + type;
    d.textContent = text;
    if (color) d.style.color = color;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  },

  clear() {
    if (this.fallback || !this.term) {
      const c = document.getElementById('term-lines'); if (c) c.innerHTML = '';
    } else { this.term.clear(); }
  },

  write(text) {
    if (this.fallback || !this.term) this._print('inf', text);
    else this.term.writeln(text);
  },

  startWatcher() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && FileTree.project) {
      this.ws.send(JSON.stringify({ type: 'watch:start', projectPath: `${this.BASE}/${FileTree.project}` }));
    }
  }
};
