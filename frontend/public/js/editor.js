'use strict';
const EditorMgr = {
  instance: null,
  tabs: [],
  active: null,
  saveTimer: null,

  init() {
    if (typeof require === 'undefined' || typeof require.config !== 'function') {
      // The Monaco AMD loader (<script src="...loader.min.js">) didn't load —
      // most likely a blocked CDN, offline session, or slow network. Fail
      // soft instead of throwing, which used to abort the rest of the
      // DOMContentLoaded handler in app.js and strand the splash screen.
      console.error('[OrinIDE] Monaco loader unavailable — editor disabled.');
      this._showLoadError();
      return;
    }
    try {
      require.config({ paths: { vs: 'vendor/monaco-editor/min/vs' } });
      require(['vs/editor/editor.main'], () => this._mount(), () => this._showLoadError());
    } catch (err) {
      console.error('[OrinIDE] Monaco failed to initialize:', err);
      this._showLoadError();
    }
  },

  _showLoadError() {
    const host = document.getElementById('monaco-host');
    if (host && !document.getElementById('editor-load-error')) {
      const div = document.createElement('div');
      div.id = 'editor-load-error';
      div.className = 'editor-load-error';
      div.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="ele-title">Editor failed to load</div>
        <div class="ele-sub">The code editor couldn't reach its resources. Check your connection and reload.</div>
        <button class="w-btn" onclick="location.reload()">Reload</button>`;
      host.appendChild(div);
    }
  },

  _mount() {
      const s = Cfg.all();
      this.instance = monaco.editor.create(document.getElementById('monaco-host'), {
        value: '', language: 'plaintext', theme: 'vs-dark',
        fontSize: s.fontSize || 14, tabSize: s.tabSize || 2,
        wordWrap: s.wordWrap ? 'on' : 'off',
        minimap: { enabled: !!s.minimap },
        automaticLayout: true, scrollBeyondLastLine: false,
        renderLineHighlight: 'all', cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on', smoothScrolling: true,
        fontLigatures: true,
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        padding: { top: 10, bottom: 10 }, lineNumbers: 'on',
        folding: true, links: true, quickSuggestions: true,
        suggestOnTriggerCharacters: true, formatOnPaste: true,
        bracketPairColorization: { enabled: true },
        emmet: { enabled: true },
        inlineSuggest: { enabled: true, mode: 'subwordSmart' },
        // ---- Fixes the "typed text appears twice" bug ----
        // Root cause: Monaco's suggest widget was auto-*committing* our
        // custom snippet entries (print, fn, cl, etc.) whenever the user
        // typed a normal "commit character" like ( , ; or space while that
        // widget happened to be open with a matching item highlighted.
        // Since our snippet insertText already contains the full word
        // (e.g. "print(${1})"), that auto-commit landed ON TOP of the word
        // the user had just finished typing by hand -> "printprint(...)".
        // Disabling commit-on-punctuation, plus turning off the built-in
        // word-based suggestions (which duplicated our own snippet entries
        // in the same list), removes the accidental double-insert while
        // keeping explicit Tab/Enter acceptance working normally.
        acceptSuggestionOnCommitCharacter: false,
        acceptSuggestionOnEnter: 'smart',
        wordBasedSuggestions: 'off',
        snippetSuggestions: 'bottom',
        suggestSelection: 'recentlyUsed',
        quickSuggestionsDelay: 120,
      });

      document.getElementById('welcome-screen').style.display = 'none';

      // Register universal snippet/autocomplete engine
      if (typeof SnippetEngine !== 'undefined') SnippetEngine.register();

      this.instance.onDidChangeCursorPosition(e => {
        if (typeof StatusBar !== 'undefined') {
          StatusBar.setCursorPos(e.position.lineNumber, e.position.column);
        }
      });

      this.instance.onDidChangeModelContent(() => {
        if (this.active) {
          this._markMod(this.active, true);
          if (Cfg.get('autosave', false)) {
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.save(), 2000);
          }
          // Update code stats in status bar
          if (typeof CodeStats !== 'undefined') CodeStats.update(this.instance.getValue());
        }
      });

      // Ctrl+S
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => this.save());
      // Ctrl+P = Quick Open files
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => QuickOpen.open());
      // Ctrl+W
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => { if (this.active) this.closeTab(this.active); });
      // Ctrl+B
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        setTimeout(() => this.layout(), 180);
      });
      // Shift+Alt+F = Format Document
      this.instance.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => this.formatDocument());
      // Ctrl+\ = Split Editor
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
        if (typeof SplitEditor !== 'undefined') SplitEditor.toggle();
      });
      // Ctrl+`
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => {
        document.getElementById('terminal-wrap').classList.toggle('collapsed');
        setTimeout(() => { this.layout(); try { TermMgr.fitAddon && TermMgr.fitAddon.fit(); } catch (e) {} }, 60);
      });
  },

  openTab(path, content) {
    if (!this.instance) { toast('Editor initializing, please wait', 'wrn'); return; }
    const ex = this.tabs.find(t => t.path === path);
    if (ex) { this._activate(path); return; }
    const lang = langFromExt(path);
    const model = monaco.editor.createModel(content, lang, monaco.Uri.parse('file:///' + path));
    this.tabs.push({ path, model, modified: false });
    this._renderTabs();
    this._activate(path);
    if (window.innerWidth <= 768) MobNav.show('editor');
  },

  _activate(path) {
    this.active = path;
    const tab = this.tabs.find(t => t.path === path);
    if (!tab || !this.instance) return;
    this.instance.setModel(tab.model);
    this._renderTabs();
    if (typeof StatusBar !== 'undefined') {
      StatusBar.setLanguage(langFromExt(path).toUpperCase());
    }
    const bcFile = document.getElementById('bc-file');
    if (bcFile) bcFile.textContent = path;
    document.getElementById('welcome-screen').style.display = 'none';
    this.instance.focus();
    // Save snapshot for undo/diff
    if (typeof SnapshotMgr !== 'undefined') SnapshotMgr.save(path, tab.model.getValue());
    if (typeof CodeStats !== 'undefined') CodeStats.update(tab.model.getValue());
    // Update git diff decorations
    if (typeof GitDiffDecorations !== 'undefined') GitDiffDecorations.update(path);
  },

  async save() {
    if (!this.active || !this.instance) return;
    if (!FileTree.project) return;
    try {
      // Format on save if enabled
      const settings = typeof Cfg !== 'undefined' ? Cfg.all() : {};
      if (settings.formatOnSave) {
        await this.instance.getAction('editor.action.formatDocument')?.run();
      }
      await API.writeFile(FileTree.project, this.active, this.instance.getValue());
      this._markMod(this.active, false);
      toast('Saved', 'ok', 800);
    } catch (e) { toast('Save failed: ' + e.message, 'err'); }
  },

  _markMod(path, v) {
    const t = this.tabs.find(t => t.path === path);
    if (t && t.modified !== v) { t.modified = v; this._renderTabs(); }
  },

  closeTab(path) {
    const i = this.tabs.findIndex(t => t.path === path);
    if (i < 0) return;
    const t = this.tabs[i];
    if (t.modified && !confirm('Unsaved changes. Close anyway?')) return;
    t.model.dispose();
    this.tabs.splice(i, 1);
    if (this.active === path) {
      const next = this.tabs[Math.min(i, this.tabs.length - 1)];
      if (next) {
        this._activate(next.path);
      } else {
        this.active = null;
        if (this.instance) this.instance.setModel(monaco.editor.createModel('', 'plaintext'));
        document.getElementById('welcome-screen').style.display = 'flex';
        if (typeof StatusBar !== 'undefined') {
          StatusBar.setLanguage('');
        }
        const bcFile = document.getElementById('bc-file');
        if (bcFile) bcFile.textContent = 'no file open';
      }
    }
  },
  closeAll() {
    this.tabs.forEach(t => t.model.dispose());
    this.tabs = []; this.active = null;
    if (this.instance) this.instance.setModel(monaco.editor.createModel('', 'plaintext'));
    document.getElementById('welcome-screen').style.display = 'flex';
    if (typeof StatusBar !== 'undefined') {
      StatusBar.setLanguage('');
    }
    const bcFile = document.getElementById('bc-file');
    if (bcFile) bcFile.textContent = '(no file open)';
    this._renderTabs();
  },

  _renderTabs() {
    const list = document.getElementById('tab-list');
    list.innerHTML = this.tabs.map(t => {
      const ext = (t.path.split('.').pop() || '').toLowerCase();
      const iconLabel = {js:'JS',jsx:'JX',ts:'TS',tsx:'TX',py:'PY',css:'CSS',html:'HTM',htm:'HTM',json:'{}',md:'MD',svg:'SVG',vue:'VU',rs:'RS',go:'GO',sh:'SH'}[ext] || ext.toUpperCase().slice(0,2);
      return `<button class="tab-item${t.path === this.active ? ' active' : ''}${t.modified ? ' modified' : ''}" data-path="${esc(t.path)}">
        <span class="tab-icon" data-ext="${esc(ext)}">${esc(iconLabel)}</span>
        <span class="tab-name" title="${esc(t.path)}">${esc(t.path.split('/').pop())}</span>
        <span class="tab-close" data-x="${esc(t.path)}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      </button>`;
    }).join('');
    list.querySelectorAll('.tab-item').forEach(el => {
      el.addEventListener('click', e => { if (e.target.closest('[data-x]')) return; this._activate(el.dataset.path); });
    });
    list.querySelectorAll('[data-x]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this.closeTab(btn.dataset.x); });
    });
  },

  applySettings(s) {
    if (!this.instance) return;
    this.instance.updateOptions({
      fontSize: s.fontSize || 14, tabSize: s.tabSize || 2,
      wordWrap: s.wordWrap ? 'on' : 'off', minimap: { enabled: !!s.minimap }
    });
  },

  layout() { try { this.instance && this.instance.layout(); } catch (e) {} },
  getValue() { return this.instance ? this.instance.getValue() : ''; },
  setValue(v) { if (this.instance) this.instance.setValue(v); },
  getSelected() { const s = this.instance?.getSelection(); return this.instance?.getModel()?.getValueInRange(s) || ''; },

  // ── Code Formatting ─────────────────────────────────────
  async formatDocument() {
    if (!this.instance || !this.active) return;
    try {
      // Use Monaco's built-in formatting action
      await this.instance.getAction('editor.action.formatDocument')?.run();
      toast('Formatted', 'ok', 800);
    } catch (e) {
      // Fallback: basic indentation fix
      this._basicFormat();
    }
  },

  _basicFormat() {
    if (!this.instance) return;
    const model = this.instance.getModel();
    if (!model) return;
    const fullText = model.getValue();
    const lines = fullText.split('\n');
    const tabSize = this.instance.getOption(monaco.editor.EditorOption.tabSize) || 2;
    const indent = ' '.repeat(tabSize);
    let depth = 0;
    const formatted = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      // Decrease indent for closing brackets
      if (/^[}\])]/.test(trimmed)) depth = Math.max(0, depth - 1);
      const result = indent.repeat(depth) + trimmed;
      // Increase indent for opening brackets
      if (/[{(\[]$/.test(trimmed) || /^[{(\[]/.test(trimmed)) {
        if (!/[}\])]/.test(trimmed)) depth++;
      }
      return result;
    });
    model.setValue(formatted.join('\n'));
    toast('Basic formatted', 'ok', 800);
  },

  // ── Workspace Persistence ────────────────────────────────
  _WS_KEY: 'ci_workspace',

  saveWorkspace() {
    try {
      const data = {
        tabs: this.tabs.map(t => ({
          path: t.path,
          modified: false, // don't persist modified state
          scrollTop: this.instance && t.path === this.active
            ? this.instance.getScrollTop() : (t._scrollTop || 0),
        })),
        active: this.active,
        sidebarWidth: document.getElementById('sidebar')?.offsetWidth || 220,
        bottomPanelHeight: document.getElementById('bottom-panel')?.offsetHeight || 0,
        bottomPanelTab: document.querySelector('.bp-tab.active')?.dataset?.tab || 'terminal',
        timestamp: Date.now(),
      };
      localStorage.setItem(this._WS_KEY, JSON.stringify(data));
    } catch {}
  },

  restoreWorkspace() {
    try {
      const raw = localStorage.getItem(this._WS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.tabs || !data.tabs.length) return;
      // Restore sidebar width
      if (data.sidebarWidth) {
        const sb = document.getElementById('sidebar');
        if (sb) sb.style.width = data.sidebarWidth + 'px';
      }
      // Restore bottom panel
      if (data.bottomPanelHeight > 0) {
        const bp = document.getElementById('bottom-panel');
        if (bp) {
          bp.style.height = data.bottomPanelHeight + 'px';
          bp.classList.add('active');
        }
      }
      // Restore tabs after FileTree project is loaded (call this from app.js init)
      this._pendingRestore = data;
    } catch {}
  },

  async _doRestore() {
    const data = this._pendingRestore;
    if (!data || !data.tabs.length) return;
    this._pendingRestore = null;
    if (!FileTree.project) return;
    for (const t of data.tabs) {
      try {
        const res = await API.readFile(FileTree.project, t.path);
        if (res && res.content !== undefined) {
          this.openTab(t.path, res.content);
          // Restore scroll position
          if (this.instance && this.active === t.path) {
            this.instance.setScrollTop(t.scrollTop || 0);
          }
        }
      } catch {}
    }
    // Restore active tab
    if (data.active) {
      const tab = this.tabs.find(t => t.path === data.active);
      if (tab) this._activate(data.active);
    }
    // Restore bottom panel tab
    if (data.bottomPanelTab && typeof BottomPanel !== 'undefined') {
      BottomPanel.show(data.bottomPanelTab);
    }
  },
};

// Auto-save workspace periodically and on unload
let _wsSaveTimer = null;
function scheduleWorkspaceSave() {
  if (_wsSaveTimer) clearTimeout(_wsSaveTimer);
  _wsSaveTimer = setTimeout(() => {
    if (typeof EditorMgr !== 'undefined') EditorMgr.saveWorkspace();
  }, 1000);
}
window.addEventListener('beforeunload', () => {
  if (typeof EditorMgr !== 'undefined') EditorMgr.saveWorkspace();
});

// Hook into tab changes to auto-save
const _origOpenTab = EditorMgr.openTab;
EditorMgr.openTab = function(...args) {
  _origOpenTab.apply(this, args);
  scheduleWorkspaceSave();
};
const _origCloseTab = EditorMgr.closeTab;
EditorMgr.closeTab = function(...args) {
  _origCloseTab.apply(this, args);
  scheduleWorkspaceSave();
};
const _origActivate = EditorMgr._activate;
EditorMgr._activate = function(...args) {
  _origActivate.apply(this, args);
  scheduleWorkspaceSave();
};
window.EditorMgr = EditorMgr;
