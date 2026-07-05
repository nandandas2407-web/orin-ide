'use strict';
/* ============================================================
   VOICE COMMANDS — "open file server.js", "run the project"
   ============================================================ */
const VoiceCommands = {
  _recognition: null,
  _active: false,

  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    this._recognition = new SR();
    this._recognition.continuous = false;
    this._recognition.interimResults = false;
    this._recognition.lang = 'en-US';

    this._recognition.onresult = (e) => {
      const text = e.results[0][0].transcript.toLowerCase().trim();
      this._handleCommand(text);
    };

    this._recognition.onend = () => { this._active = false; };
    this._recognition.onerror = () => { this._active = false; };

    // Add voice command button to terminal toolbar
    this._injectButton();
  },

  _injectButton() {
    const termToolbar = document.querySelector('.term-toolbar');
    if (!termToolbar || document.getElementById('btn-voice-cmd')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-voice-cmd';
    btn.className = 'term-btn';
    btn.title = 'Voice command (say: open file, run project, etc)';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>`;
    btn.addEventListener('click', () => this.toggle());
    termToolbar.appendChild(btn);
  },

  toggle() {
    if (this._active) {
      this._recognition?.stop();
      this._active = false;
    } else {
      try {
        this._recognition?.start();
        this._active = true;
        toast('Speak a command...', 'inf', 2000);
      } catch {}
    }
  },

  async _handleCommand(text) {
    toast(`Heard: "${text}"`, 'inf', 1500);

    // Open file
    const openMatch = text.match(/(?:open|show|go to)\s+(?:file\s+)?(.+)/);
    if (openMatch) {
      const fileName = openMatch[1].trim();
      if (typeof FileTree !== 'undefined' && FileTree.project) {
        const tree = await API.getTree(FileTree.project);
        const found = this._findFile(tree, fileName);
        if (found) {
          EditorMgr.openFile(found);
          toast(`Opened ${found}`, 'ok');
          return;
        }
      }
      toast(`File "${fileName}" not found`, 'wrn');
      return;
    }

    // Run project
    if (text.includes('run') && (text.includes('project') || text.includes('app') || text.includes('server'))) {
      const termInput = document.getElementById('terminal-input');
      if (termInput) {
        termInput.value = 'npm start';
        termInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        toast('Running project...', 'ok');
      }
      return;
    }

    // Install packages
    const installMatch = text.match(/install\s+(.+)/);
    if (installMatch) {
      const pkg = installMatch[1].trim();
      const termInput = document.getElementById('terminal-input');
      if (termInput) {
        termInput.value = `npm install ${pkg}`;
        termInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        toast(`Installing ${pkg}...`, 'ok');
      }
      return;
    }

    // Save
    if (text.includes('save')) {
      if (typeof EditorMgr !== 'undefined') EditorMgr.save();
      toast('Saved', 'ok');
      return;
    }

    toast('Command not recognized. Try: "open file X", "run project", "install X"', 'wrn', 3000);
  },

  _findFile(tree, name) {
    if (!tree) return null;
    const lower = name.toLowerCase();
    for (const item of (tree.children || tree)) {
      if (item.type === 'file' && item.name.toLowerCase().includes(lower)) return item.path;
      if (item.type === 'directory') {
        const found = this._findFile(item, name);
        if (found) return found;
      }
    }
    return null;
  }
};
window.VoiceCommands = VoiceCommands;
