'use strict';
/* ================================================================
   ORIN IDE — EXTRAS: chat extras popup, mobile nav, ZIP I/O,
   model health, upload, git, AgentTask, skill chip
   ================================================================ */

/* ── ChatExtras popup ────────────────────────────────────────── */
const ChatExtras = {
  _open: false,
  toggle(btn) {
    this._open = !this._open;
    const p = document.getElementById('chat-extras-popup');
    if (p) p.classList.toggle('hidden', !this._open);
    if (btn) btn.classList.toggle('active', this._open);
  },
  close() {
    this._open = false;
    document.getElementById('chat-extras-popup')?.classList.add('hidden');
    document.getElementById('btn-chat-extras')?.classList.remove('active');
  }
};
window.ChatExtras = ChatExtras;
document.addEventListener('click', e => {
  if (ChatExtras._open && !e.target.closest('#chat-extras-popup') && !e.target.closest('#btn-chat-extras'))
    ChatExtras.close();
});

/* Mode buttons in the extras popup are bound once, centrally, in
   ModeSwitch.init() (app.js) — not duplicated here. */

/* ── AgentTask ─────────────────────────────────────────────────── */
window.AgentTask = {
  _active: false, _cancelled: false,
  async run(prompt) {
    if (this._active) { toast('Task already running', 'wrn'); return; }
    this._active = true; this._cancelled = false;
    this._showBar(true);
    for (const phase of ['thinking','planning','coding','integrating']) {
      if (this._cancelled) break;
      this._setPhase(phase);
      await new Promise(r => setTimeout(r, 700 + Math.random()*400));
    }
    if (!this._cancelled) this._setPhase('done');
    setTimeout(() => { this._showBar(false); this._active = false; }, 1600);
  },
  cancel() {
    this._cancelled = true; this._active = false; this._showBar(false);
    toast('Task cancelled', 'wrn');
  },
  _setPhase(phase) {
    const labels = { thinking:'Thinking...', planning:'Planning...', coding:'Generating code...', integrating:'Integrating...', done:'Done' };
    const l = document.getElementById('task-phase-label');
    if (l) l.textContent = labels[phase] || phase;
    ['thinking','planning','coding','integrating'].forEach(p => {
      const d = document.getElementById('phase-'+p);
      if (d) { d.className = 'task-phase-dot'; if (p === phase) d.classList.add(p); }
      document.getElementById('aphase-'+p)?.classList.toggle('active', p === phase);
    });
    document.getElementById('agents-task-phases')?.classList.toggle('visible', phase !== 'done');
    const dot = document.querySelector('.agents-status-dot');
    if (dot) dot.className = 'agents-status-dot ' + (phase === 'done' ? 'done' : 'running');
    const sl = document.querySelector('.agents-status-label');
    if (sl) sl.textContent = labels[phase] || phase;
  },
  _showBar(show) {
    document.getElementById('task-status-bar')?.classList.toggle('active', show);
    if (!show) {
      ['thinking','planning','coding','integrating'].forEach(p => {
        document.getElementById('phase-'+p)?.setAttribute('class','task-phase-dot');
        document.getElementById('aphase-'+p)?.classList.remove('active');
      });
      document.getElementById('agents-task-phases')?.classList.remove('visible');
      const l = document.getElementById('task-phase-label');
      if (l) l.textContent = 'Running...';
      const dot = document.querySelector('.agents-status-dot');
      if (dot) dot.className = 'agents-status-dot';
      const sl = document.querySelector('.agents-status-label');
      if (sl) sl.textContent = 'Idle — configure agents and send a prompt';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-agents-send')?.addEventListener('click', () => {
    const inp = document.getElementById('agents-input');
    if (inp?.value.trim()) AgentTask.run(inp.value.trim());
  }, { capture: true });
});

/* ── Skill chip sync ──────────────────────────────────────────── */
window.addEventListener('load', () => {
  if (typeof SkillsMgr === 'undefined') return;
  const orig = SkillsMgr._updateActiveIndicator.bind(SkillsMgr);
  SkillsMgr._updateActiveIndicator = function() {
    orig();
    const chip = document.getElementById('active-skill-chip');
    const lbl = document.getElementById('skill-chip-label');
    const skill = this.getActiveSkill();
    if (chip) chip.style.display = skill ? 'flex' : 'none';
    if (lbl && skill) lbl.textContent = skill.name + ' skill active';
  };
});

/* ── Mobile single-column navigation ─────────────────────────── */
;(function() {
  const PANELS = { sidebar: 'sidebar', editor: 'center', chat: 'chat-panel', agents: 'agents-panel', terminal: 'center' };
  const ALL = ['sidebar','center','chat-panel','agents-panel'];
  function isMob() { return window.innerWidth <= 768; }

  function showPanel(key) {
    if (!isMob()) return;
    const target = PANELS[key] || 'center';
    ALL.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const show = id === target;
      el.classList.toggle('mob-active', show);
    });
    // Terminal: show bottom panel fullscreen
    const bp = document.getElementById('bottom-panel');
    const ew = document.getElementById('editor-wrap');
    if (key === 'terminal') {
      if (ew) ew.style.display = 'none';
      if (bp) { bp.classList.add('active'); bp.style.height = '100%'; }
    } else {
      if (ew) ew.style.display = '';
      if (bp && key !== 'editor') { bp.classList.remove('active'); bp.style.height = ''; }
    }
    // Trigger Monaco layout
    setTimeout(() => window.EditorMgr?.layout?.(), 50);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mob-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mob-tab').forEach(b => b.classList.toggle('active', b === btn));
        if (isMob()) showPanel(btn.dataset.panel);
        document.getElementById('mob-fab-menu')?.classList.remove('visible');
        document.getElementById('mob-fab-btn')?.classList.remove('open');
      });
    });
    // Mobile FAB
    document.getElementById('mob-fab-btn')?.addEventListener('click', () => {
      const menu = document.getElementById('mob-fab-menu');
      const btn = document.getElementById('mob-fab-btn');
      const open = menu?.classList.toggle('visible');
      btn?.classList.toggle('open', open);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#mob-fab')) {
        document.getElementById('mob-fab-menu')?.classList.remove('visible');
        document.getElementById('mob-fab-btn')?.classList.remove('open');
      }
    }, { capture: false });
    // Initial mobile state
    if (isMob()) {
      showPanel('sidebar');
      document.querySelector('.mob-tab[data-panel="sidebar"]')?.classList.add('active');
    }
  });

  window.addEventListener('resize', () => {
    if (!isMob()) {
      ALL.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('mob-active'); el.style.display = ''; }
      });
    } else {
      const cur = document.querySelector('.mob-tab.active')?.dataset.panel || 'sidebar';
      showPanel(cur);
    }
    window.EditorMgr?.layout?.();
  });
})();

/* ── Upload button in chat ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-upload-asset-ciub')?.addEventListener('click', () => {
    if (!window.FileTree?.project) { toast('Open a project first', 'wrn'); return; }
    const inp = document.getElementById('chat-asset-upload-input') || document.getElementById('asset-file-input');
    if (inp) { inp.value = ''; inp.click(); }
  });
  document.getElementById('chat-asset-upload-input')?.addEventListener('change', e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length || !window.FileTree?.project) return;
    files.forEach(f => window.MediaMgr?._uploadFile?.(f, 'assets'));
    toast(`Uploading ${files.length} file(s) to assets/`, 'inf');
  });
  // Whole-app drag-drop for ZIP/files
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith('.zip')) window.ImportMgr?._doImport?.(file);
    else if (window.FileTree?.project) window.MediaMgr?._uploadFile?.(file, 'assets');
    else window.ImportMgr?._doImport?.(file);
  });
});

/* ── ZIP export wiring ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-dl-zip')?.addEventListener('click', () => {
    if (!window.FileTree?.project) { toast('No project open', 'wrn'); return; }
    const url = window.API?.exportZipUrl?.(FileTree.project);
    if (!url) { toast('Export unavailable in this environment', 'err'); return; }
    const a = document.createElement('a'); a.href = url;
    a.download = FileTree.project + '.zip'; document.body.appendChild(a); a.click(); a.remove();
    toast('Downloading ' + FileTree.project + '.zip', 'ok');
  });
  document.getElementById('btn-export-termux')?.addEventListener('click', async () => {
    if (!window.FileTree?.project) return;
    const dir = document.getElementById('inp-termux-path')?.value.trim() || '/storage/emulated/0/';
    const msg = document.getElementById('export-msg');
    if (msg) msg.textContent = 'Exporting...';
    try {
      const r = await window.API?.exportTermux?.(FileTree.project, dir);
      if (msg) msg.textContent = r?.error ? 'Failed: ' + r.error : 'Exported to: ' + (r?.exportedTo || dir);
      toast(r?.error ? r.error : 'Exported successfully', r?.error ? 'err' : 'ok');
    } catch (e) {
      if (msg) msg.textContent = 'Failed: ' + e.message;
      toast(e.message, 'err');
    }
  });
});

/* ── Model Health full wiring ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const openHealth = () => { openModal('model-health-modal'); window.ModelHealth?.init?.(); };
  document.getElementById('btn-model-health')?.addEventListener('click', openHealth);
  // Watch for modal open
  const mo = new MutationObserver(() => {
    if (!document.getElementById('model-health-modal')?.classList.contains('hidden'))
      window.ModelHealth?.init?.();
  });
  const mEl = document.getElementById('model-health-modal');
  if (mEl) mo.observe(mEl, { attributes: true, attributeFilter: ['class'] });
});

/* AIFixBugs, AIOptimize, AIAddComments, AITranslate, AIRefactor, and
   TokenEstimator are all defined once, completely, in features.js. The
   window.X = window.X || {...} stub copies that used to live here never
   actually ran: every call site uses the bare identifier (e.g.
   "AIFixBugs.run()"), which resolves to the const-declared object in
   features.js regardless of what gets assigned onto window.X — assigning
   a property on window does not redefine what a bare identifier resolves
   to. They were dead code; removed rather than left as misleading
   duplicates of the real implementation. */
window.setHint = function(text) {
  const i = document.getElementById('chat-input');
  if (i) { i.value = text; i.focus(); }
  window.ActivityBar?.toggleAI?.();
};
window.ImportMgr = window.ImportMgr || {};
ImportMgr.openFilePicker = ImportMgr.openFilePicker || function() {
  const inp = document.getElementById('global-zip-input');
  if (!inp) return; inp.value = ''; inp.onchange = e => { if (e.target.files[0]) this._doImport?.(e.target.files[0]); inp.value = ''; }; inp.click();
};
window.LivePreview = window.LivePreview || { open() { window.PreviewMgr?.open?.(); } };
window.ExportMgr = window.ExportMgr || { downloadZip() { document.getElementById('btn-export')?.click() || openModal('export-modal'); } };
window.ChatSessions = window.ChatSessions || { open() { openModal('chat-sessions-modal'); } };
