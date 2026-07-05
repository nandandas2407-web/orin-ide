'use strict';
/* ============================================================
   QUICK OPEN — fuzzy file search (Ctrl+P)
   ============================================================ */
const QuickOpen = {
  _files: [],
  _filtered: [],
  _focusIdx: 0,

  init() {
    document.addEventListener('keydown', e => {
      // Ctrl+P = Quick Open, Ctrl+Shift+P = Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        this.open();
      }
      if (e.key === 'Escape') this.close();
    });
    document.getElementById('qo-bg')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) this.close();
    });
    const inp = document.getElementById('qo-input');
    if (inp) {
      inp.addEventListener('input', () => this._filter());
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this._focusIdx = Math.min(this._focusIdx + 1, this._filtered.length - 1); this._render(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); this._focusIdx = Math.max(this._focusIdx - 1, 0); this._render(); }
        if (e.key === 'Enter') { const f = this._filtered[this._focusIdx]; if (f) this._openFile(f); }
      });
    }
  },

  open() {
    this._files = this._collectFiles();
    this._filtered = [...this._files];
    this._focusIdx = 0;
    document.getElementById('qo-modal')?.classList.remove('hidden');
    const inp = document.getElementById('qo-input');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 40); }
    this._render();
  },

  close() {
    document.getElementById('qo-modal')?.classList.add('hidden');
  },

  _collectFiles() {
    const files = [];
    if (typeof FileTree !== 'undefined' && FileTree.tree) {
      this._walkTree(FileTree.tree, '', files);
    }
    return files;
  },

  _walkTree(node, prefix, out) {
    if (!node) return;
    const entries = node.children || node;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (entry.type === 'folder') {
        this._walkTree(entry, prefix + entry.name + '/', out);
      } else if (entry.type === 'file') {
        out.push({ path: prefix + entry.name, name: entry.name });
      }
    }
  },

  _filter() {
    const q = document.getElementById('qo-input')?.value?.toLowerCase().trim() || '';
    if (!q) {
      this._filtered = [...this._files];
    } else {
      this._filtered = this._files
        .map(f => ({ ...f, score: this._fuzzyScore(q, f.path.toLowerCase()) }))
        .filter(f => f.score > 0)
        .sort((a, b) => b.score - a.score);
    }
    this._focusIdx = 0;
    this._render();
  },

  _fuzzyScore(query, target) {
    let qi = 0, ti = 0, score = 0, consecutive = 0;
    while (qi < query.length && ti < target.length) {
      if (query[qi] === target[ti]) {
        qi++;
        consecutive++;
        score += consecutive * 10;
        // Bonus for exact start of filename
        if (ti === 0 || target[ti - 1] === '/' || target[ti - 1] === '.') score += 20;
        // Bonus for matching file extension separator
        if (target[ti] === '.' || target[ti] === '/') score += 5;
      } else {
        consecutive = 0;
      }
      ti++;
    }
    return qi === query.length ? score : 0;
  },

  _render() {
    const list = document.getElementById('qo-list');
    if (!list) return;
    if (!this._filtered.length) {
      list.innerHTML = '<div class="qo-empty">No files found</div>';
      return;
    }
    const maxShow = 12;
    const start = Math.max(0, this._focusIdx - Math.floor(maxShow / 2));
    const end = Math.min(this._filtered.length, start + maxShow);
    list.innerHTML = '';
    for (let i = start; i < end; i++) {
      const f = this._filtered[i];
      const item = document.createElement('div');
      item.className = 'qo-item' + (i === this._focusIdx ? ' active' : '');
      item.innerHTML = `
        <span class="qo-icon">${this._fileIcon(f.name)}</span>
        <span class="qo-path">${this._highlight(f.path, document.getElementById('qo-input')?.value || '')}</span>
      `;
      item.addEventListener('click', () => this._openFile(f));
      item.addEventListener('mouseenter', () => { this._focusIdx = i; this._render(); });
      list.appendChild(item);
    }
  },

  _highlight(path, query) {
    if (!query) return esc(path);
    const lower = path.toLowerCase();
    const q = query.toLowerCase();
    let result = '';
    let li = 0;
    for (let i = 0; i < path.length; i++) {
      if (li < q.length && lower[i] === q[li]) {
        result += `<span class="qo-hl">${esc(path[i])}</span>`;
        li++;
      } else {
        result += esc(path[i]);
      }
    }
    return result;
  },

  _fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      js: 'JS', ts: 'TS', jsx: 'JS', tsx: 'TS', py: 'PY', rb: 'RB',
      html: '<>', css: '{}', json: '{}', md: 'MD', yaml: 'YML', yml: 'YML',
      sh: '$_', bash: '$_', php: 'PH', java: 'JV', go: 'GO', rs: 'RS',
      c: 'C', cpp: 'C+', h: 'H', txt: 'TX', xml: 'XM', sql: 'SQ',
    };
    return icons[ext] || '📄';
  },

  _openFile(file) {
    this.close();
    if (typeof EditorMgr !== 'undefined' && EditorMgr.open) {
      EditorMgr.open(file.path);
    }
  }
};
window.QuickOpen = QuickOpen;
