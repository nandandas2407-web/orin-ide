'use strict';
/* ============================================================
   GLOBAL SEARCH — project-wide keyword search across every file.
   Groups results by file, shows the matching line with the term
   highlighted, and jumps straight to that line in the editor when
   a result is clicked.
   ============================================================ */
const GlobalSearch = {
  _debounceTimer: null,
  _opts: { caseSensitive: false, wholeWord: false, regex: false },
  _lastResults: [],

  init() {
    const input = document.getElementById('sb-search-input');
    const clearBtn = document.getElementById('sb-search-clear');
    if (!input) return;

    input.addEventListener('input', () => {
      clearBtn?.classList.toggle('hidden', !input.value);
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.run(input.value), 300);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(this._debounceTimer); this.run(input.value); }
      if (e.key === 'Escape') { input.value = ''; this.clear(); }
    });
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      this.clear();
      input.focus();
    });

    ['case', 'word', 'regex'].forEach(key => {
      const btn = document.getElementById('gs-opt-' + key);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const on = btn.dataset.on === '1';
        btn.dataset.on = on ? '0' : '1';
        btn.classList.toggle('on', !on);
        const map = { case: 'caseSensitive', word: 'wholeWord', regex: 'regex' };
        this._opts[map[key]] = !on;
        if (input.value.trim()) this.run(input.value);
      });
    });
  },

  clear() {
    const results = document.getElementById('sb-search-results');
    if (results) results.innerHTML = '';
    const status = document.getElementById('gs-status');
    if (status) status.textContent = '';
    this._lastResults = [];
  },

  async run(query) {
    query = (query || '').trim();
    const resultsEl = document.getElementById('sb-search-results');
    const statusEl = document.getElementById('gs-status');
    if (!resultsEl) return;

    if (!query) { this.clear(); return; }

    if (!window.FileTree || !FileTree.project) {
      statusEl.textContent = 'Open a project first';
      resultsEl.innerHTML = '';
      return;
    }

    statusEl.textContent = 'Searching...';
    resultsEl.innerHTML = '';

    let data;
    try {
      data = await API.searchProject(FileTree.project, query, this._opts);
    } catch (e) {
      statusEl.textContent = 'Search failed: ' + e.message;
      return;
    }

    if (data.error) {
      statusEl.textContent = data.error;
      return;
    }

    this._lastResults = data.results || [];
    const fileCount = new Set(this._lastResults.map(r => r.file)).size;

    if (!this._lastResults.length) {
      statusEl.textContent = `No results for "${esc(query)}"`;
      resultsEl.innerHTML = '';
      return;
    }

    statusEl.textContent = `${this._lastResults.length} result${this._lastResults.length !== 1 ? 's' : ''} in ${fileCount} file${fileCount !== 1 ? 's' : ''}`
      + (data.truncated ? ' (truncated)' : '');

    this._render(this._lastResults, query);
  },

  _render(results, query) {
    const resultsEl = document.getElementById('sb-search-results');
    if (!resultsEl) return;

    // Group by file, preserving first-seen order
    const byFile = new Map();
    for (const r of results) {
      if (!byFile.has(r.file)) byFile.set(r.file, []);
      byFile.get(r.file).push(r);
    }

    const frag = document.createDocumentFragment();
    for (const [file, matches] of byFile) {
      const group = document.createElement('div');
      group.className = 'gs-file-group';

      const header = document.createElement('button');
      header.className = 'gs-file-header';
      header.type = 'button';
      const fileName = file.split('/').pop();
      const dirPath = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
      header.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="gs-chevron"><polyline points="9 18 15 12 9 6"/></svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="gs-file-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="gs-file-name">${esc(fileName)}</span>
        ${dirPath ? `<span class="gs-file-dir">${esc(dirPath)}</span>` : ''}
        <span class="gs-file-count">${matches.length}</span>
      `;
      const list = document.createElement('div');
      list.className = 'gs-match-list';

      header.addEventListener('click', () => {
        group.classList.toggle('collapsed');
      });

      for (const m of matches) {
        const row = document.createElement('button');
        row.className = 'gs-match-row';
        row.type = 'button';
        row.innerHTML = `
          <span class="gs-match-line">${m.line}</span>
          <span class="gs-match-text">${this._highlightMatch(m.text, m.col, m.matchLength)}</span>
        `;
        row.addEventListener('click', () => this._jumpTo(m));
        list.appendChild(row);
      }

      group.appendChild(header);
      group.appendChild(list);
      frag.appendChild(group);
    }

    resultsEl.innerHTML = '';
    resultsEl.appendChild(frag);
  },

  // Escapes the line, then wraps the matched span in a <mark> using the
  // byte offset/length the server reported, so highlighting lines up
  // exactly even though the surrounding text gets HTML-escaped.
  _highlightMatch(text, col, len) {
    const start = Math.max(0, col - 1);
    const end = Math.min(text.length, start + len);
    const before = text.slice(0, start);
    const match = text.slice(start, end);
    const after = text.slice(end);
    return esc(before) + '<mark>' + esc(match) + '</mark>' + esc(after);
  },

  async _jumpTo(match) {
    if (!window.FileTree || !FileTree.project) return;
    try {
      const data = await API.readFile(FileTree.project, match.file);
      if (data.error) { toast('Could not open ' + match.file, 'err'); return; }
      if (window.EditorMgr && typeof EditorMgr.openTab === 'function') {
        EditorMgr.openTab(match.file, data.content);
      }
      // Reveal and select the matching line/column once Monaco has the file open
      requestAnimationFrame(() => {
        const ed = window.EditorMgr?.instance;
        if (!ed) return;
        const pos = { lineNumber: match.line, column: match.col };
        ed.revealLineInCenter(match.line);
        ed.setSelection({
          startLineNumber: match.line, startColumn: match.col,
          endLineNumber: match.line, endColumn: match.col + match.matchLength
        });
        ed.focus();
      });
    } catch (e) {
      toast('Failed to open file: ' + e.message, 'err');
    }
  }
};
window.GlobalSearch = GlobalSearch;
