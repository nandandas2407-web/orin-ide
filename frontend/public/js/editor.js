'use strict';
const EditorMgr = {
  instance: null,
  tabs: [],
  active: null,
  saveTimer: null,

  init() {
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
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
        bracketPairColorization: { enabled: true }
      });

      document.getElementById('welcome-screen').style.display = 'none';

      // Register universal snippet/autocomplete engine
      if (typeof SnippetEngine !== 'undefined') SnippetEngine.register();

      this.instance.onDidChangeCursorPosition(e => {
        document.getElementById('st-pos').textContent =
          `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
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
      // Ctrl+P
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => CmdPalette.open());
      // Ctrl+W
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => { if (this.active) this.closeTab(this.active); });
      // Ctrl+B
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        setTimeout(() => this.layout(), 180);
      });
      // Ctrl+`
      this.instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => {
        document.getElementById('terminal-wrap').classList.toggle('collapsed');
        setTimeout(() => { this.layout(); try { TermMgr.fitAddon && TermMgr.fitAddon.fit(); } catch (e) {} }, 60);
      });
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
    document.getElementById('st-file').textContent = path;
    document.getElementById('st-lang').textContent = langFromExt(path).toUpperCase();
    document.getElementById('welcome-screen').style.display = 'none';
    this.instance.focus();
    // Save snapshot for undo/diff
    if (typeof SnapshotMgr !== 'undefined') SnapshotMgr.save(path, tab.model.getValue());
    if (typeof CodeStats !== 'undefined') CodeStats.update(tab.model.getValue());
  },

  async save() {
    if (!this.active || !this.instance) return;
    if (!FileTree.project) return;
    try {
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
        document.getElementById('st-file').textContent = 'No file open';
        document.getElementById('st-lang').textContent = '';
      }
    }
    this._renderTabs();
  },

  closeAll() {
    this.tabs.forEach(t => t.model.dispose());
    this.tabs = []; this.active = null;
    if (this.instance) this.instance.setModel(monaco.editor.createModel('', 'plaintext'));
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('st-file').textContent = 'No file open';
    document.getElementById('st-lang').textContent = '';
    this._renderTabs();
  },

  _renderTabs() {
    const list = document.getElementById('tab-list');
    list.innerHTML = this.tabs.map(t => `
      <button class="tab${t.path === this.active ? ' active' : ''}${t.modified ? ' mod' : ''}" data-path="${esc(t.path)}">
        <span class="tab-name" title="${esc(t.path)}">${esc(t.path.split('/').pop())}</span>
        <span class="tab-x" data-x="${esc(t.path)}">x</span>
      </button>`).join('');
    list.querySelectorAll('.tab').forEach(el => {
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
  getSelected() { const s = this.instance?.getSelection(); return this.instance?.getModel()?.getValueInRange(s) || ''; }
};
