'use strict';
const CmdPalette = {
  cmds: [
    { label: 'New File',              key: 'Ctrl+N',  fn: () => FileTree.promptNew('file', '') },
    { label: 'New Folder',            key: '',        fn: () => FileTree.promptNew('folder', '') },
    { label: 'New Project',           key: '',        fn: () => openModal('project-modal') },
    { label: 'Save File',             key: 'Ctrl+S',  fn: () => EditorMgr.save() },
    { label: 'Close Tab',             key: 'Ctrl+W',  fn: () => { if (EditorMgr.active) EditorMgr.closeTab(EditorMgr.active); } },
    { label: 'Close All Tabs',        key: '',        fn: () => EditorMgr.closeAll() },
    { label: 'Toggle Sidebar',        key: 'Ctrl+B',  fn: () => { document.getElementById('sidebar').classList.toggle('collapsed'); setTimeout(() => EditorMgr.layout(), 180); } },
    { label: 'Toggle Terminal',       key: 'Ctrl+`',  fn: () => TermMgr.toggle() },
    { label: 'Live Preview',          key: '',        fn: () => PreviewMgr.open() },
    { label: 'Open Preview in Tab',   key: '',        fn: () => PreviewMgr.openTab() },
    { label: 'Import ZIP',            key: '',        fn: () => openModal('import-modal') },
    { label: 'Export ZIP',            key: '',        fn: () => openModal('export-modal') },
    { label: 'Settings',              key: 'Ctrl+,',  fn: () => { SettingsMgr.load(); openModal('settings-modal'); } },
    { label: 'Clear Chat',            key: '',        fn: () => ChatMgr.clear() },
    { label: 'Clear Terminal',        key: '',        fn: () => TermMgr.clear() },
    { label: 'Refresh File Tree',     key: '',        fn: () => FileTree.refresh() },
    { label: 'AI: Generate Mode',     key: '',        fn: () => { document.querySelector('[data-mode="generate"]').click(); MobNav.show('chat'); } },
    { label: 'AI: Chat Mode',         key: '',        fn: () => { document.querySelector('[data-mode="chat"]').click(); MobNav.show('chat'); } },
    { label: 'AI: Edit File Mode',    key: '',        fn: () => { document.querySelector('[data-mode="edit"]').click(); MobNav.show('chat'); } },
    { label: 'AI: Explain Mode',      key: '',        fn: () => { document.querySelector('[data-mode="explain"]').click(); MobNav.show('chat'); } },
    { label: 'Run: npm install',      key: '',        fn: () => { TermMgr.runFallback('npm install'); MobNav.show('terminal'); } },
    { label: 'Run: npm start',        key: '',        fn: () => { TermMgr.runFallback('npm start'); MobNav.show('terminal'); } },
    { label: 'Run: node index.js',    key: '',        fn: () => { TermMgr.runFallback('node index.js'); MobNav.show('terminal'); } },
    { label: 'Run: python3 app.py',   key: '',        fn: () => { TermMgr.runFallback('python3 app.py'); MobNav.show('terminal'); } },
    { label: 'Run: HTTP server 8080', key: '',        fn: () => { TermMgr.runFallback('python3 -m http.server 8080'); MobNav.show('terminal'); } },
  ],
  filtered: [], focusIdx: 0,

  init() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); this.open(); }
      if (e.key === 'Escape') this.close();
    });
    document.getElementById('cmd-bg')?.addEventListener('click', e => { if (e.target === e.currentTarget) this.close(); });
    document.getElementById('cmd-input').addEventListener('input', () => this._filter());
    document.getElementById('cmd-input').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.focusIdx = Math.min(this.focusIdx + 1, this.filtered.length - 1); this._render(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.focusIdx = Math.max(this.focusIdx - 1, 0); this._render(); }
      if (e.key === 'Enter') { const c = this.filtered[this.focusIdx]; if (c) this._run(c); }
    });
  },

  open() {
    document.getElementById('cmd-palette').classList.remove('hidden');
    document.getElementById('cmd-input').value = '';
    this._filter();
    setTimeout(() => document.getElementById('cmd-input').focus(), 40);
  },

  close() { document.getElementById('cmd-palette').classList.add('hidden'); },

  _filter() {
    const q = document.getElementById('cmd-input').value.toLowerCase().trim();
    this.filtered = q ? this.cmds.filter(c => c.label.toLowerCase().includes(q)) : [...this.cmds];
    this.focusIdx = 0;
    this._render();
  },

  _render() {
    const list = document.getElementById('cmd-list');
    list.innerHTML = this.filtered.map((c, i) => `
      <div class="cmd-row${i === this.focusIdx ? ' focused' : ''}" data-i="${i}">
        <div class="cmd-row-left"><span>${esc(c.label)}</span></div>
        ${c.key ? `<span class="cmd-key">${esc(c.key)}</span>` : ''}
      </div>`).join('');
    list.querySelectorAll('.cmd-row').forEach(el => {
      el.addEventListener('click', () => this._run(this.filtered[+el.dataset.i]));
    });
    list.querySelector('.focused')?.scrollIntoView({ block: 'nearest' });
  },

  _run(cmd) { this.close(); setTimeout(() => cmd.fn(), 50); }
};
