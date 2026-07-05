'use strict';
/* ============================================================
   CHAT SESSIONS — powerful multi-session manager
   Features: tags, pin, export, stats, search, preview, timeline
   ============================================================ */
const ChatSessions = {
  _KEY: 'ci_chat_sessions',
  _ACTIVE: 'ci_active_session',
  _PINNED_KEY: 'ci_chat_pinned',

  getSessions() {
    try { return JSON.parse(localStorage.getItem(this._KEY) || '{}'); } catch { return {}; }
  },

  saveSessions(sessions) {
    try { localStorage.setItem(this._KEY, JSON.stringify(sessions)); } catch {}
  },

  getActiveId() {
    return localStorage.getItem(this._ACTIVE) || 'default';
  },

  setActive(id) {
    localStorage.setItem(this._ACTIVE, id);
  },

  getPinned() {
    try { return JSON.parse(localStorage.getItem(this._PINNED_KEY) || '[]'); } catch { return []; }
  },

  togglePin(id) {
    const pinned = this.getPinned();
    const idx = pinned.indexOf(id);
    if (idx >= 0) pinned.splice(idx, 1); else pinned.push(id);
    try { localStorage.setItem(this._PINNED_KEY, JSON.stringify(pinned)); } catch {}
  },

  isPinned(id) {
    return this.getPinned().includes(id);
  },

  createSession(name) {
    const sessions = this.getSessions();
    const id = 'session_' + Date.now();
    sessions[id] = {
      id,
      name: name || 'Session ' + (Object.keys(sessions).length + 1),
      history: [],
      created: Date.now(),
      updated: Date.now(),
      tags: [],
      pinned: false,
      stats: { messages: 0, tokens: 0 }
    };
    this.saveSessions(sessions);
    return id;
  },

  saveCurrentHistory(history) {
    const sessions = this.getSessions();
    const id = this.getActiveId();
    if (!sessions[id]) {
      sessions[id] = {
        id, name: 'Default', history: [], created: Date.now(),
        updated: Date.now(), tags: [], pinned: false, stats: { messages: 0, tokens: 0 }
      };
    }
    sessions[id].history = history;
    sessions[id].updated = Date.now();
    sessions[id].stats.messages = history.filter(m => m.role !== 'system').length;
    // Track tokens if available
    if (API._lastUsage) {
      sessions[id].stats.tokens = (sessions[id].stats.tokens || 0) +
        (API._lastUsage.prompt_tokens || 0) + (API._lastUsage.completion_tokens || 0);
    }
    this.saveSessions(sessions);
  },

  loadSession(id) {
    const sessions = this.getSessions();
    return sessions[id]?.history || [];
  },

  deleteSession(id) {
    const sessions = this.getSessions();
    delete sessions[id];
    this.saveSessions(sessions);
    if (this.getActiveId() === id) this.setActive('default');
  },

  renameSession(id, newName) {
    const sessions = this.getSessions();
    if (sessions[id]) {
      sessions[id].name = newName;
      sessions[id].updated = Date.now();
      this.saveSessions(sessions);
    }
  },

  addTag(id, tag) {
    const sessions = this.getSessions();
    if (sessions[id] && !sessions[id].tags.includes(tag)) {
      sessions[id].tags.push(tag);
      sessions[id].updated = Date.now();
      this.saveSessions(sessions);
    }
  },

  removeTag(id, tag) {
    const sessions = this.getSessions();
    if (sessions[id]) {
      sessions[id].tags = sessions[id].tags.filter(t => t !== tag);
      this.saveSessions(sessions);
    }
  },

  exportSession(id) {
    const sessions = this.getSessions();
    const s = sessions[id];
    if (!s) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-session-${s.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Session exported', 'ok');
  },

  exportAll() {
    const sessions = this.getSessions();
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orin-chat-sessions.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('All sessions exported', 'ok');
  },

  async importSessions(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const sessions = this.getSessions();
      let count = 0;
      for (const [id, s] of Object.entries(data)) {
        if (s.history && Array.isArray(s.history)) {
          sessions[id] = { ...s, updated: Date.now() };
          count++;
        }
      }
      this.saveSessions(sessions);
      toast(`Imported ${count} session(s)`, 'ok');
      this.renderList();
    } catch (e) {
      toast('Import failed: ' + e.message, 'err');
    }
  },

  open() {
    openModal('chat-sessions-modal');
    this.renderList();
  },

  _groupTimeline(ts) {
    if (!ts) return 'Older';
    const now = new Date();
    const d = new Date(ts);
    const diff = now - d;
    const day = 86400000;
    if (diff < day && d.getDate() === now.getDate()) return 'Today';
    if (diff < 2 * day && d.getDate() === now.getDate() - 1) return 'Yesterday';
    if (diff < 7 * day) return 'This Week';
    if (diff < 30 * day) return 'This Month';
    return 'Older';
  },

  _searchFilter(sessions, query) {
    if (!query) return sessions;
    const q = query.toLowerCase();
    const result = {};
    for (const [id, s] of Object.entries(sessions)) {
      if (s.name.toLowerCase().includes(q) ||
          (s.tags || []).some(t => t.toLowerCase().includes(q))) {
        result[id] = s;
      }
    }
    return result;
  },

  _getPreview(history) {
    if (!history || history.length < 2) return 'Empty conversation';
    // Get last user message as preview
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        const text = history[i].content || '';
        return text.length > 80 ? text.slice(0, 80) + '...' : text;
      }
    }
    return 'Empty conversation';
  },

  _formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return d.toLocaleDateString();
  },

  renderList() {
    const container = document.getElementById('sessions-list');
    if (!container) return;
    const searchQuery = document.getElementById('sessions-search')?.value?.trim() || '';
    const allSessions = this.getSessions();
    const sessions = this._searchFilter(allSessions, searchQuery);
    const activeId = this.getActiveId();
    const pinned = this.getPinned();

    if (!Object.keys(sessions).length) {
      container.innerHTML = `<div class="sessions-empty">
        <div class="sessions-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p>${searchQuery ? 'No sessions match your search.' : 'No saved sessions yet.'}</p>
        <p style="color:var(--tx3);font-size:11px">Start a chat to create your first session</p>
      </div>`;
      return;
    }

    // Separate pinned and unpinned
    const pinnedSessions = {};
    const unpinnedSessions = {};
    for (const [id, s] of Object.entries(sessions)) {
      if (pinned.includes(id)) pinnedSessions[id] = s;
      else unpinnedSessions[id] = s;
    }

    // Group unpinned by timeline
    const groups = {};
    for (const [id, s] of Object.entries(unpinnedSessions)) {
      const group = this._groupTimeline(s.updated || s.created);
      if (!groups[group]) groups[group] = [];
      groups[group].push({ id, ...s });
    }
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    let html = '';

    // Render pinned sessions
    if (Object.keys(pinnedSessions).length > 0) {
      html += '<div class="sessions-group-title"><svg width="10" height="10" viewBox="0 0 24 24" fill="var(--yw)" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg> Pinned</div>';
      for (const [id, s] of Object.entries(pinnedSessions)) {
        html += this._renderItem(s, id === activeId);
      }
    }

    // Render timeline groups
    for (const g of groupOrder) {
      const items = groups[g];
      if (!items || !items.length) continue;
      items.sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
      html += `<div class="sessions-group-title">${g}</div>`;
      for (const s of items) {
        html += this._renderItem(s, s.id === activeId);
      }
    }

    container.innerHTML = html;
  },

  _renderItem(s, isActive) {
    const msgs = s.stats?.messages || s.history?.length || 0;
    const tokens = s.stats?.tokens || 0;
    const preview = this._getPreview(s.history);
    const time = this._formatTime(s.updated || s.created);
    const tags = (s.tags || []);
    const isPinned = this.isPinned(s.id);

    return `<div class="session-item${isActive ? ' active' : ''}" data-sid="${s.id}">
      <div class="session-item-main">
        <div class="session-item-header">
          <span class="session-item-name">${esc(s.name)}</span>
          ${isActive ? '<span class="session-active-badge">ACTIVE</span>' : ''}
          ${isPinned ? '<span class="session-pin-badge" title="Pinned">&#9733;</span>' : ''}
        </div>
        <div class="session-item-preview">${esc(preview)}</div>
        <div class="session-item-meta">
          <span class="session-meta-item">${msgs} msg${msgs !== 1 ? 's' : ''}</span>
          ${tokens > 0 ? `<span class="session-meta-item">${tokens.toLocaleString()} tok</span>` : ''}
          <span class="session-meta-item">${time}</span>
          ${tags.map(t => `<span class="session-tag">${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="session-item-actions">
        <button class="ib sm" onclick="ChatSessions.switchTo('${s.id}')" title="Open" ${isActive ? 'disabled style="opacity:0.3"' : ''}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="ib sm" onclick="ChatSessions.togglePin('${s.id}');ChatSessions.renderList()" title="${isPinned ? 'Unpin' : 'Pin'}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="${isPinned ? 'var(--yw)' : 'none'}" stroke="${isPinned ? 'var(--yw)' : 'currentColor'}" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
        </button>
        <button class="ib sm" onclick="ChatSessions._promptRename('${s.id}')" title="Rename">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ib sm" onclick="ChatSessions.exportSession('${s.id}')" title="Export">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="ib sm" onclick="ChatSessions.deleteSession('${s.id}');ChatSessions.renderList()" title="Delete" style="color:var(--rd)">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
  },

  _promptRename(id) {
    const sessions = this.getSessions();
    const s = sessions[id];
    if (!s) return;
    const newName = prompt('Rename session:', s.name);
    if (newName && newName.trim()) {
      this.renameSession(id, newName.trim());
      this.renderList();
    }
  },

  switchTo(id) {
    this.setActive(id);
    const hist = this.loadSession(id);
    if (window.ChatMgr && typeof ChatMgr.loadHistory === 'function') {
      ChatMgr.loadHistory(hist);
    }
    closeModal('chat-sessions-modal');
  },

  // Initialize new session button and import
  init() {
    document.getElementById('btn-new-session')?.addEventListener('click', () => {
      const name = document.getElementById('new-session-name')?.value?.trim();
      const id = this.createSession(name || '');
      this.switchTo(id);
      document.getElementById('new-session-name').value = '';
    });

    document.getElementById('btn-import-sessions')?.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json';
      inp.onchange = (e) => {
        const file = e.target.files[0];
        if (file) this.importSessions(file);
      };
      inp.click();
    });

    document.getElementById('btn-export-all-sessions')?.addEventListener('click', () => {
      this.exportAll();
    });

    // Create default session if none exists
    const sessions = this.getSessions();
    if (!Object.keys(sessions).length) {
      this.createSession('Default');
    }
  }
};
window.ChatSessions = ChatSessions;
