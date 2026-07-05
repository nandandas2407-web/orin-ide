'use strict';
const Resizer = {
  _inited: false,
  init() {
    // Re-binding is safe — old listeners are replaced via _drag re-registration
    this._sidebarPos = (window.SidebarPosition && SidebarPosition.current) || 'left';
    this._sidebar(this._sidebarPos);
    this._chat();
    this._agents();
    this._terminal();
    this._loadSaved();
    this._inited = true;
  },

  _drag(handle, onMove, onEnd) {
    // Remove old listeners by cloning the node
    const fresh = handle.cloneNode(true);
    handle.parentNode.replaceChild(fresh, handle);
    handle = fresh;

    let active = false;
    const start = e => {
      active = true;
      fresh.classList.add('drag');
      const mv = e2 => {
        if (!active) return;
        e2.preventDefault();
        onMove(e2.touches ? e2.touches[0] : e2);
      };
      const up = () => {
        active = false;
        fresh.classList.remove('drag');
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup',   up);
        document.removeEventListener('touchmove', mv);
        document.removeEventListener('touchend',  up);
        if (onEnd) onEnd();
      };
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup',   up);
      document.addEventListener('touchmove', mv, { passive: false });
      document.addEventListener('touchend',  up);
      e.preventDefault();
    };
    fresh.addEventListener('mousedown',  start);
    fresh.addEventListener('touchstart', start, { passive: false });
    return fresh; // return the new handle so callers can re-ref if needed
  },

  // Re-binds the sidebar resize handle for the given dock position.
  // left/right drag changes width (--sidebar-w); top/bottom drag
  // changes height (--sidebar-h). Safe to call repeatedly.
  rebindSidebar(pos) {
    this._sidebarPos = pos || 'left';
    this._sidebar(this._sidebarPos);
  },

  _sidebar(pos = 'left') {
    let h = document.getElementById('rz-sidebar');
    const el = document.getElementById('sidebar');
    if (!h || !el) return;
    const horizontal = (pos === 'top' || pos === 'bottom');

    if (horizontal) {
      let sy, sh;
      const getStart = e => { sy = (e.touches ? e.touches[0] : e).clientY; sh = el.offsetHeight; };
      h = this._drag(h, e => {
        if (sy === undefined) return;
        const dy = (e.touches ? e.touches[0] : e).clientY - sy;
        const delta = pos === 'top' ? dy : -dy;
        const maxH = Math.min(560, Math.floor(window.innerHeight * 0.6));
        const ht = Math.max(120, Math.min(maxH, sh + delta));
        el.style.height = ht + 'px';
        document.documentElement.style.setProperty('--sidebar-h', ht + 'px');
        if (window.EditorMgr) EditorMgr.layout();
      }, () => { sy = undefined; Cfg.set('sidebarH', el.offsetHeight); });
      h.addEventListener('mousedown',  getStart);
      h.addEventListener('touchstart', e => getStart(e.touches[0]), { passive: true });
    } else {
      let sx, sw;
      const getStart = e => { sx = (e.touches ? e.touches[0] : e).clientX; sw = el.offsetWidth; };
      h = this._drag(h, e => {
        if (sx === undefined) return;
        const dx = (e.touches ? e.touches[0] : e).clientX - sx;
        const delta = pos === 'right' ? -dx : dx;
        const w = Math.max(140, Math.min(480, sw + delta));
        el.style.width = w + 'px';
        el.style.height = '';
        document.documentElement.style.setProperty('--sidebar-w', w + 'px');
        if (window.EditorMgr) EditorMgr.layout();
      }, () => { sx = undefined; Cfg.set('sidebarW', el.offsetWidth); });
      h.addEventListener('mousedown',  getStart);
      h.addEventListener('touchstart', e => getStart(e.touches[0]), { passive: true });
    }
  },

  _chat() {
    let h = document.getElementById('rz-chat');
    const el = document.getElementById('chat-panel');
    if (!h || !el) return;
    let sx, sw;
    const getStart = e => { sx = (e.touches ? e.touches[0] : e).clientX; sw = el.offsetWidth; };
    h = this._drag(h, e => {
      if (sx === undefined) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const maxW = isLandscape ? Math.min(400, Math.floor(window.innerWidth * 0.45)) : 600;
      const minW = isLandscape ? 160 : 180;
      const w = Math.max(minW, Math.min(maxW, sw - ((e.touches ? e.touches[0] : e).clientX - sx)));
      el.style.width = w + 'px';
      document.documentElement.style.setProperty('--chat-w', w + 'px');
      if (window.EditorMgr) EditorMgr.layout();
    }, () => { sx = undefined; Cfg.set('chatW', el.offsetWidth); });
    h.addEventListener('mousedown',  getStart);
    h.addEventListener('touchstart', e => getStart(e.touches[0]), { passive: true });
  },

  _agents() {
    let h = document.getElementById('rz-agents');
    const el = document.getElementById('agents-panel');
    if (!h || !el) return;
    let sx, sw;
    const getStart = e => { sx = (e.touches ? e.touches[0] : e).clientX; sw = el.offsetWidth; };
    h = this._drag(h, e => {
      if (sx === undefined) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const maxW = isLandscape ? Math.min(400, Math.floor(window.innerWidth * 0.45)) : 600;
      const minW = isLandscape ? 160 : 180;
      const w = Math.max(minW, Math.min(maxW, sw - ((e.touches ? e.touches[0] : e).clientX - sx)));
      el.style.width = w + 'px';
      document.documentElement.style.setProperty('--chat-w', w + 'px');
      if (window.EditorMgr) EditorMgr.layout();
    }, () => { sx = undefined; Cfg.set('chatW', el.offsetWidth); });
    h.addEventListener('mousedown',  getStart);
    h.addEventListener('touchstart', e => getStart(e.touches[0]), { passive: true });
  },

  _terminal() {
    let h = document.getElementById('rz-terminal');
    const el = document.getElementById('bottom-panel');
    if (!h || !el) return;
    let sy, sh;
    const getStart = e => { sy = (e.touches ? e.touches[0] : e).clientY; sh = el.offsetHeight; };
    h = this._drag(h, e => {
      if (sy === undefined) return;
      const ht = Math.max(60, Math.min(window.innerHeight * 0.65, sh - ((e.touches ? e.touches[0] : e).clientY - sy)));
      el.style.height = ht + 'px';
      document.documentElement.style.setProperty('--bp-h', ht + 'px');
      if (window.EditorMgr) EditorMgr.layout();
      try { if (window.TermMgr?.fitAddon) TermMgr.fitAddon.fit(); } catch {}
    }, () => { sy = undefined; Cfg.set('termH', el.offsetHeight); });
    h.addEventListener('mousedown',  getStart);
    h.addEventListener('touchstart', e => getStart(e.touches[0]), { passive: true });
  },

  _loadSaved() {
    const sw = Cfg.get('sidebarW', null);
    const sh = Cfg.get('sidebarH', null);
    const cw = Cfg.get('chatW', null);
    const th = Cfg.get('termH', null);
    const isLandscape = window.innerWidth > window.innerHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (sw) {
      const el = document.getElementById('sidebar');
      if (el) {
        // Clamp: in landscape, don't let sidebar eat more than 35% of viewport
        const maxW = isLandscape ? Math.min(320, Math.floor(vw * 0.35)) : 480;
        const clamped = Math.max(140, Math.min(maxW, sw));
        el.style.width = clamped + 'px';
        document.documentElement.style.setProperty('--sidebar-w', clamped + 'px');
      }
    }
    if (sh) {
      const clampedH = Math.max(120, Math.min(Math.floor(vh * 0.6), sh));
      document.documentElement.style.setProperty('--sidebar-h', clampedH + 'px');
    }
    if (cw) {
      const el = document.getElementById('chat-panel');
      if (el) {
        // Clamp: in landscape, don't let chat eat more than 45% of viewport
        const maxW = isLandscape ? Math.min(400, Math.floor(vw * 0.45)) : 600;
        const clamped = Math.max(160, Math.min(maxW, cw));
        el.style.width = clamped + 'px';
        document.documentElement.style.setProperty('--chat-w', clamped + 'px');
      }
    }
    if (th) {
      const el = document.getElementById('bottom-panel');
      if (el) {
        const maxH = isLandscape ? Math.min(vh * 0.55, 220) : vh * 0.65;
        const clamped = Math.max(60, Math.min(maxH, th));
        el.style.height = clamped + 'px';
        document.documentElement.style.setProperty('--bp-h', clamped + 'px');
      }
    }
  }
};
