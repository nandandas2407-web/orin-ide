'use strict';
/* ============================================================
   PANEL POSITION — lets the user dock the Explorer sidebar and
   the AI chat panel to the left or right independently. Each is
   persisted via Cfg (localStorage) under its own key.
   Defaults: sidebar = left, chat panel = right, center = editor.
   ============================================================ */
const SidebarPosition = {
  VALID: ['left', 'right'],
  current: 'left',

  init() {
    this.current = this._sanitize(Cfg.get('sidebarPos', 'left'));
    this.apply(this.current, { skipSave: true, skipToast: true });

    document.querySelectorAll('.sbpos-opt:not(.cppos-opt)').forEach(btn => {
      btn.addEventListener('click', () => this.apply(btn.dataset.pos));
    });

    this._bindQuickMenu();
  },

  _bindQuickMenu() {
    const trigger = document.getElementById('btn-sidebar-pos');
    const menu = document.getElementById('sbpos-quick-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    menu.querySelectorAll('button[data-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.apply(btn.dataset.pos);
        menu.classList.add('hidden');
      });
    });
    document.addEventListener('click', e => {
      if (!menu.classList.contains('hidden') && !e.target.closest('.sbpos-quick-wrap')) {
        menu.classList.add('hidden');
      }
    });
  },

  _sanitize(pos) {
    return this.VALID.includes(pos) ? pos : 'left';
  },

  apply(pos, opts = {}) {
    pos = this._sanitize(pos);
    this.current = pos;

    const layout = document.getElementById('layout-main');
    if (layout) layout.dataset.sidebarPos = pos;

    document.querySelectorAll('.sbpos-opt:not(.cppos-opt)').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pos === pos);
    });
    document.querySelectorAll('#sbpos-quick-menu button[data-pos]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pos === pos);
    });

    // Re-layout Monaco / xterm after the editor area changes shape.
    requestAnimationFrame(() => {
      try { if (window.EditorMgr) EditorMgr.layout(); } catch {}
      try { if (window.TermMgr?.fitAddon) TermMgr.fitAddon.fit(); } catch {}
    });

    if (!opts.skipSave) Cfg.set('sidebarPos', pos);
    if (!opts.skipToast) toast('Explorer moved to ' + pos, 'ok', 1400);
  }
};
window.SidebarPosition = SidebarPosition;

/* ============================================================
   CHAT PANEL POSITION — same left/right docking, independent of
   the sidebar. Defaults to 'right'. The chat panel and agents
   panel share this setting since only one is visible at a time.
   ============================================================ */
const ChatPosition = {
  VALID: ['left', 'right'],
  current: 'right',

  init() {
    this.current = this._sanitize(Cfg.get('chatPos', 'right'));
    this.apply(this.current, { skipSave: true, skipToast: true });

    document.querySelectorAll('.cppos-opt').forEach(btn => {
      btn.addEventListener('click', () => this.apply(btn.dataset.pos));
    });

    this._bindQuickMenu();
  },

  _bindQuickMenu() {
    const trigger = document.getElementById('btn-chat-pos');
    const menu = document.getElementById('cppos-quick-menu');
    if (!trigger || !menu) return;

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    menu.querySelectorAll('button[data-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.apply(btn.dataset.pos);
        menu.classList.add('hidden');
      });
    });
    document.addEventListener('click', e => {
      if (!menu.classList.contains('hidden') && !e.target.closest('.cppos-quick-wrap')) {
        menu.classList.add('hidden');
      }
    });
  },

  _sanitize(pos) {
    return this.VALID.includes(pos) ? pos : 'right';
  },

  apply(pos, opts = {}) {
    pos = this._sanitize(pos);
    this.current = pos;

    const layout = document.getElementById('layout-main');
    if (layout) layout.dataset.chatPos = pos;

    document.querySelectorAll('.cppos-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pos === pos);
    });
    document.querySelectorAll('#cppos-quick-menu button[data-pos]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pos === pos);
    });

    requestAnimationFrame(() => {
      try { if (window.EditorMgr) EditorMgr.layout(); } catch {}
      try { if (window.TermMgr?.fitAddon) TermMgr.fitAddon.fit(); } catch {}
    });

    if (!opts.skipSave) Cfg.set('chatPos', pos);
    if (!opts.skipToast) toast('AI panel moved to ' + pos, 'ok', 1400);
  }
};
window.ChatPosition = ChatPosition;

document.addEventListener('DOMContentLoaded', () => {
  // Cfg is declared with `const` in utils.js, so — unlike `var` — it never
  // becomes a `window` property. Checking `window.Cfg` here was always
  // false, which meant SidebarPosition.init() silently never ran and the
  // quick-access popover button did nothing when clicked.
  if (typeof Cfg !== 'undefined') {
    SidebarPosition.init();
    ChatPosition.init();
  }
});
