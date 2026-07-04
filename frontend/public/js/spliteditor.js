'use strict';
/* ============================================================
   SPLIT EDITOR — side-by-side editing (Ctrl+\)
   ============================================================ */
const SplitEditor = {
  _split: false,
  _secondEditor: null,
  _secondTabs: [],
  _secondActive: null,
  _container: null,

  toggle() {
    if (this._split) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    if (this._split) return;
    this._split = true;

    // Create split container
    const editorWrap = document.getElementById('editor-wrap');
    if (!editorWrap) return;

    // Create splitter
    const splitter = document.createElement('div');
    splitter.className = 'editor-splitter';
    splitter.id = 'editor-splitter';
    splitter.innerHTML = '<div class="splitter-handle"></div>';

    // Create second editor container
    this._container = document.createElement('div');
    this._container.className = 'editor-split-pane';
    this._container.id = 'second-editor-pane';
    this._container.innerHTML = `
      <div class="tab-bar" id="second-tab-bar">
        <div class="tab-list" id="second-tab-list"></div>
      </div>
      <div class="monaco-host" id="second-monaco-host"></div>
    `;

    // Insert after the main editor
    editorWrap.parentNode.insertBefore(splitter, editorWrap.nextSibling);
    editorWrap.parentNode.insertBefore(this._container, splitter.nextSibling);

    // Create second Monaco editor
    const s = Cfg.all();
    this._secondEditor = monaco.editor.create(
      document.getElementById('second-monaco-host'),
      {
        value: '',
        language: 'plaintext',
        theme: monaco.editor.getThemes().length > 0 ? (ThemeMgr?.current || 'vs-dark') : 'vs-dark',
        fontSize: s.fontSize || 14,
        tabSize: s.tabSize || 2,
        wordWrap: s.wordWrap ? 'on' : 'off',
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'all',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        padding: { top: 10, bottom: 10 },
        lineNumbers: 'on',
        folding: true,
        emmet: { enabled: true },
        inlineSuggest: { enabled: true, mode: 'subwordSmart' },
        // Same fix as the primary editor — see editor.js for details.
        acceptSuggestionOnCommitCharacter: false,
        acceptSuggestionOnEnter: 'smart',
        wordBasedSuggestions: 'off',
        snippetSuggestions: 'bottom',
        suggestSelection: 'recentlyUsed',
        quickSuggestionsDelay: 120,
      }
    );

    // Make splitter draggable
    this._initSplitter(splitter);

    // Layout both editors
    setTimeout(() => {
      EditorMgr.layout();
      this._secondEditor.layout();
    }, 100);

    toast('Split view opened', 'ok', 1000);
  },

  close() {
    if (!this._split) return;
    this._split = false;

    // Dispose second editor
    if (this._secondEditor) {
      this._secondTabs.forEach(t => t.model.dispose());
      this._secondEditor.dispose();
      this._secondEditor = null;
    }
    this._secondTabs = [];
    this._secondActive = null;

    // Remove DOM elements
    document.getElementById('editor-splitter')?.remove();
    document.getElementById('second-editor-pane')?.remove();
    this._container = null;

    // Layout main editor
    setTimeout(() => EditorMgr.layout(), 100);
    toast('Split view closed', 'ok', 1000);
  },

  _initSplitter(splitter) {
    let startX, startWidth;
    const editorWrap = document.getElementById('editor-wrap');

    const onMouseMove = (e) => {
      const dx = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(startWidth + dx, startWidth * 2));
      editorWrap.style.flex = 'none';
      editorWrap.style.width = newWidth + 'px';
      EditorMgr.layout();
      if (this._secondEditor) this._secondEditor.layout();
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    splitter.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startWidth = editorWrap.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  },

  // Open file in second pane
  openInSecond(path, content) {
    if (!this._split || !this._secondEditor) return;

    const existing = this._secondTabs.find(t => t.path === path);
    if (existing) {
      this._activateSecond(path);
      return;
    }

    const lang = langFromExt(path);
    const model = monaco.editor.createModel(
      content,
      lang,
      monaco.Uri.parse('file:///second/' + path)
    );
    this._secondTabs.push({ path, model });
    this._renderSecondTabs();
    this._activateSecond(path);
  },

  _activateSecond(path) {
    this._secondActive = path;
    const tab = this._secondTabs.find(t => t.path === path);
    if (!tab || !this._secondEditor) return;
    this._secondEditor.setModel(tab.model);
    this._renderSecondTabs();
  },

  _renderSecondTabs() {
    const list = document.getElementById('second-tab-list');
    if (!list) return;
    list.innerHTML = this._secondTabs.map(t => `
      <button class="tab${t.path === this._secondActive ? ' active' : ''}" data-path="${esc(t.path)}">
        <span class="tab-name" title="${esc(t.path)}">${esc(t.path.split('/').pop())}</span>
        <span class="tab-x" data-x="${esc(t.path)}">x</span>
      </button>
    `).join('');

    list.querySelectorAll('.tab').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-x]')) return;
        this._activateSecond(el.dataset.path);
      });
    });
    list.querySelectorAll('[data-x]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._closeSecondTab(btn.dataset.x);
      });
    });
  },

  _closeSecondTab(path) {
    const i = this._secondTabs.findIndex(t => t.path === path);
    if (i < 0) return;
    const t = this._secondTabs[i];
    t.model.dispose();
    this._secondTabs.splice(i, 1);
    if (this._secondActive === path) {
      const next = this._secondTabs[Math.min(i, this._secondTabs.length - 1)];
      if (next) this._activateSecond(next.path);
      else {
        this._secondActive = null;
        this._secondEditor.setModel(monaco.editor.createModel('', 'plaintext'));
      }
    }
    this._renderSecondTabs();
  },

  get isSplit() { return this._split; },
  get secondEditor() { return this._secondEditor; }
};
window.SplitEditor = SplitEditor;
