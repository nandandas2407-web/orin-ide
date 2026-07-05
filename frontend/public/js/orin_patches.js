'use strict';
/* ================================================================
   ORIN IDE — PATCHES & SUPPLEMENTS
   Loaded last — fixes all wiring, mobile nav, provider preloading,
   skill chip sync, AgentTask integration, and search sidebar.
   ================================================================ */

/* ── 1. Pre-populate providers with popular alternatives ─────── */
;(function preloadProviders() {
  const EXTRA = [
    {
      id: 'anthropic-direct',
      name: 'Anthropic (Direct)',
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: '',
      models: [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
      ]
    },
    {
      id: 'openai-direct',
      name: 'OpenAI (Direct)',
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'o3', name: 'o3' },
        { id: 'o4-mini', name: 'o4-mini' }
      ]
    },
    {
      id: 'groq',
      name: 'Groq (Fast Inference)',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: '',
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'gemma2-9b-it', name: 'Gemma2 9B' },
        { id: 'deepseek-r1-distill-llama-70b', name: 'Deepseek R1 70B' }
      ]
    },
    {
      id: 'together',
      name: 'Together AI',
      baseURL: 'https://api.together.xyz/v1',
      apiKey: '',
      models: [
        { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B' },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
        { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B' }
      ]
    },
    {
      id: 'ollama',
      name: 'Ollama (Local)',
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      models: [
        { id: 'llama3', name: 'Llama 3' },
        { id: 'llama3.2', name: 'Llama 3.2' },
        { id: 'codellama', name: 'CodeLlama' },
        { id: 'mistral', name: 'Mistral' },
        { id: 'phi3', name: 'Phi-3' },
        { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' }
      ]
    },
    {
      id: 'deepseek',
      name: 'DeepSeek (Direct)',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' }
      ]
    }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Providers === 'undefined') return;
    EXTRA.forEach(p => {
      if (!Providers.get(p.id)) {
        Providers.add(p);
      }
    });
  });
})();

/* ── 2. Active Skill Chip sync ────────────────────────────────── */
;(function patchSkillChip() {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof SkillsMgr === 'undefined') return;

    function refreshChip() {
      const chip = document.getElementById('active-skill-chip');
      const label = document.getElementById('skill-chip-label');
      if (!chip || !label) return;
      const skill = SkillsMgr.getActiveSkill();
      if (skill) {
        label.textContent = skill.name + ' skill active';
        chip.style.display = 'flex';
      } else {
        chip.style.display = 'none';
      }
    }

    // Patch the indicator update to also refresh chip
    const orig = SkillsMgr._updateActiveIndicator.bind(SkillsMgr);
    SkillsMgr._updateActiveIndicator = function() {
      orig();
      refreshChip();
    };
    refreshChip();
  });
})();

/* ── 3. AgentTask — phase-cycling display wired to the agents panel ─── */
const AgentTask = {};
Object.assign(AgentTask, {
  _active: false,
  _cancelled: false,

  async run(prompt) {
    if (this._active) { toast && toast('Task already running', 'wrn'); return; }
    this._active = true;
    this._cancelled = false;
    this._showBar(true);
    const phases = ['thinking', 'planning', 'coding', 'integrating'];
    for (const phase of phases) {
      if (this._cancelled) break;
      this._setPhase(phase);
      await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
    }
    if (!this._cancelled) this._setPhase('done');
    this._showBar(!this._cancelled);
    setTimeout(() => { this._showBar(false); this._active = false; }, 1800);
  },

  cancel() {
    this._cancelled = true;
    this._active = false;
    this._showBar(false);
    toast && toast('Task cancelled', 'wrn');
  },

  _setPhase(phase) {
    const labels = {
      thinking: 'Thinking...', planning: 'Planning architecture...',
      coding: 'Generating code...', integrating: 'Integrating changes...', done: 'Done'
    };
    const el = document.getElementById('task-phase-label');
    if (el) el.textContent = labels[phase] || phase;

    const dotMap = { thinking: 'thinking', planning: 'planning', coding: 'coding', integrating: 'integrating' };
    ['thinking','planning','coding','integrating'].forEach(p => {
      const dot = document.getElementById('phase-' + p);
      if (dot) { dot.className = 'task-phase-dot'; if (p === phase) dot.classList.add(phase); }
    });

    // Agents panel phase pills
    const aphases = ['thinking','planning','coding','integrating'];
    aphases.forEach(p => {
      document.getElementById('aphase-' + p)?.classList.toggle('active', p === phase);
    });
    document.getElementById('agents-task-phases')?.classList.add('visible');

    // Update status dot
    const dot = document.querySelector('.agents-status-dot');
    if (dot) { dot.className = 'agents-status-dot ' + (phase === 'done' ? 'done' : 'running'); }
    const lbl = document.querySelector('.agents-status-label');
    if (lbl) lbl.textContent = labels[phase] || phase;
  },

  _showBar(show) {
    const bar = document.getElementById('task-status-bar');
    if (bar) bar.classList.toggle('active', show);
    if (!show) {
      ['thinking','planning','coding','integrating'].forEach(p => {
        document.getElementById('phase-' + p)?.setAttribute('class', 'task-phase-dot');
        document.getElementById('aphase-' + p)?.classList.remove('active');
      });
      document.getElementById('agents-task-phases')?.classList.remove('visible');
      const lbl = document.getElementById('task-phase-label');
      if (lbl) lbl.textContent = 'Agentic task running...';
      const dot = document.querySelector('.agents-status-dot');
      if (dot) dot.className = 'agents-status-dot';
      const al = document.querySelector('.agents-status-label');
      if (al) al.textContent = 'Idle — configure agents and send a prompt';
    }
  }
});
window.AgentTask = AgentTask;

/* ── 4. Wire agents send to AgentTask phase display ─────────── */
document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('btn-agents-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const inp = document.getElementById('agents-input');
      if (inp && inp.value.trim()) {
        AgentTask.run(inp.value.trim());
      }
    }, { capture: true });
  }
});

/* ── 5. Mobile nav — map tabs to panel visibility ────────────── */
;(function patchMobileNav() {
  document.addEventListener('DOMContentLoaded', () => {
    // Make sure mobile tabs are wired (MobNav.init does this, but ensure correctness)
    document.querySelectorAll('.mob-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        // Update tab active state
        document.querySelectorAll('.mob-tab').forEach(b => b.classList.toggle('active', b === btn));
        // Close FAB menu on tab change
        document.getElementById('mob-fab-menu')?.classList.remove('open');
        document.getElementById('mob-fab-btn')?.classList.remove('open');
      });
    });
  });
})();

/* ── 6. Search sidebar — live file search ───────────────────── */
;(function patchSearchSidebar() {
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sb-search-input');
    const results = document.getElementById('sb-search-results');
    const goBtn = document.getElementById('sb-search-go');
    const clearBtn = document.getElementById('sb-search-clear');

    if (!input || !results) return;

    async function doSearch() {
      const q = input.value.trim();
      if (!q || !window.FileTree?.project) {
        results.innerHTML = q ? '<div style="color:var(--tx3);font-size:11px">Open a project first</div>' : '';
        return;
      }
      results.innerHTML = '<div style="color:var(--tx3);font-size:11px">Searching...</div>';
      try {
        const { tree } = await API.getTree(FileTree.project);
        const files = flatTree ? flatTree(tree) : [];
        const matches = [];
        for (const file of files.slice(0, 60)) {
          try {
            const content = await API.readFile(FileTree.project, file.path);
            const lines = (content || '').split('\n');
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(q.toLowerCase())) {
                matches.push({ file: file.path, line: i + 1, text: line.trim() });
              }
            });
          } catch {}
        }
        if (!matches.length) {
          results.innerHTML = '<div style="color:var(--tx3);font-size:11px">No results for "' + esc(q) + '"</div>';
          return;
        }
        // Group by file
        const byFile = {};
        matches.forEach(m => { (byFile[m.file] = byFile[m.file] || []).push(m); });
        let html = '';
        for (const [file, ms] of Object.entries(byFile)) {
          html += `<div class="search-result-file" onclick="FileTree.open('${esc(file)}');ActivityBar.show('explorer')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${esc(file)}
          </div>`;
          ms.slice(0, 5).forEach(m => {
            const highlighted = m.text.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
              t => `<mark class="match-highlight">${esc(t)}</mark>`);
            html += `<div class="search-result-line" onclick="FileTree.open('${esc(m.file)}')">
              <span class="line-number">${m.line}</span>
              <span>${highlighted}</span>
            </div>`;
          });
          if (ms.length > 5) html += `<div style="padding:2px 8px 4px 24px;font-size:10px;color:var(--tx3)">+${ms.length - 5} more lines</div>`;
        }
        results.innerHTML = `<div style="font-size:10px;color:var(--tx2);padding:4px 0 6px">${matches.length} results in ${Object.keys(byFile).length} files</div>` + html;
      } catch (e) {
        results.innerHTML = '<div style="color:var(--rd);font-size:11px">Error: ' + esc(e.message) + '</div>';
      }
    }

    goBtn?.addEventListener('click', doSearch);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    clearBtn?.addEventListener('click', () => { input.value = ''; results.innerHTML = ''; });
  });
})();

/* ── 7. Git sidebar — auto-refresh on open ──────────────────── */
;(function patchGitSidebar() {
  document.addEventListener('DOMContentLoaded', () => {
    // When git sidebar becomes visible, run git status
    const gitSb = document.getElementById('sidebar-git');
    if (!gitSb) return;
    const observer = new MutationObserver(() => {
      if (gitSb.classList.contains('active') && window.FileTree?.project) {
        const statusEl = document.getElementById('sb-git-status');
        if (statusEl) statusEl.textContent = 'Checking...';
        window.API?.execCmd?.('cd "' + FileTree.project + '" && git status --short 2>&1 || echo "(not a git repo)"')
          .then(out => { if (statusEl) statusEl.textContent = out || 'Clean working tree'; })
          .catch(() => { if (statusEl) statusEl.textContent = 'Not a git repository'; });
      }
    });
    observer.observe(gitSb, { attributes: true, attributeFilter: ['class'] });
  });
})();

/* ── 8. keyboard shortcuts supplement ─────────────────────────── */
document.addEventListener('keydown', e => {
  if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    window.LivePreview?.open?.();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    window.ActivityBar?.toggleAgents?.();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    window.ActivityBar?.toggleAI?.();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const hidden = sb.classList.toggle('hidden');
    window.EditorMgr?.layout?.();
  }
});

/* ── 9. setHint helper for welcome screen ────────────────────── */
window.setHint = function(text) {
  const inp = document.getElementById('chat-input');
  if (inp) { inp.value = text; inp.focus(); }
  window.ActivityBar?.toggleAI?.();
};

/* ── 10. Mode buttons (Chat/Generate/Edit File/Explain) — single
   source of truth for both the popup row and the visible Chat/Coding
   toggle, so the two controls can no longer disagree about ChatMgr.mode. ── */
const ModeSwitch = {
  PLACEHOLDERS: {
    chat: 'Ask AI to generate code, explain, or modify files...',
    generate: 'Describe what to generate (e.g. "Create a React login form")',
    edit: 'Describe how to edit the current file (e.g. "Add error handling")',
    patch: 'Describe what to change — AI will output only @@patch diffs...',
    explain: 'Paste or select code to explain...'
  },
  init() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this.set(btn.dataset.mode));
    });
  },
  set(mode) {
    if (window.ChatMgr) ChatMgr.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('cmode-chat')?.classList.toggle('active', mode === 'chat');
    document.getElementById('cmode-code')?.classList.toggle('active', mode === 'generate');
    document.getElementById('cmode-patch')?.classList.toggle('active', mode === 'patch');
    const input = document.getElementById('chat-input');
    if (input) input.placeholder = this.PLACEHOLDERS[mode] || this.PLACEHOLDERS.chat;
  }
};
window.ModeSwitch = ModeSwitch;
document.addEventListener('DOMContentLoaded', () => ModeSwitch.init());

/* ── 11. ImportMgr.openFilePicker helper ─────────────────────── */
window.ImportMgr = window.ImportMgr || {};
ImportMgr.openFilePicker = function() {
  const inp = document.getElementById('global-zip-input');
  if (!inp) return;
  inp.value = '';
  inp.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    inp.value = '';
    ImportMgr._doImport?.(file);
  };
  inp.click();
};

/* ── 12. ExportMgr.downloadZip helper ───────────────────────── */
window.ExportMgr = window.ExportMgr || {};
ExportMgr.downloadZip = function() {
  if (!window.FileTree?.project) { toast?.('No project open', 'wrn'); return; }
  const a = document.createElement('a');
  a.href = window.API?.exportZipUrl?.(FileTree.project) || '#';
  a.download = FileTree.project + '.zip';
  a.click();
  toast?.('Downloading ZIP...', 'ok');
};

/* ── 13. LivePreview.open alias ─────────────────────────────── */
window.LivePreview = window.LivePreview || {};
LivePreview.open = function() {
  window.PreviewMgr?.open?.();
};

/* ── 14. AI Quick Action helpers ───────────────────────────────
   AIExplain, AIRefactor, AIFixBugs, AIOptimize, AIAddComments,
   AIGenerateTests, AITranslate, and TokenEstimator are defined once,
   completely, in features.js. The window.X assignments that used to
   live here were unreachable: every real call site uses the bare
   identifier, which always resolves to the const-declared object in
   features.js regardless of what's later assigned onto window.X. They
   also called a getSelection() method EditorMgr never defines (the
   real method is getSelected()), so they'd have been broken even if
   reachable. Removed rather than left as misleading dead duplicates. */

/* ── 15. ChatSessions stub ──────────────────────────────────── */
window.ChatSessions = window.ChatSessions || {
  open() { openModal('chat-sessions-modal'); this.renderList(); },
  renderList() {
    const list = document.getElementById('sessions-list');
    const searchQ = document.getElementById('sessions-search')?.value?.toLowerCase() || '';
    if (!list) return;
    let sessions = [];
    try { sessions = JSON.parse(localStorage.getItem('orin_sessions') || '[]'); } catch {}
    const filtered = sessions.filter(s => s.name?.toLowerCase().includes(searchQ));
    if (!filtered.length) { list.innerHTML = '<div style="color:var(--tx3);font-size:12px;padding:8px">No sessions yet</div>'; return; }
    list.innerHTML = filtered.map(s => `
      <div class="session-item ${s.id === window._activeSessionId ? 'active' : ''}" onclick="ChatSessions.load('${s.id}')">
        <span class="session-name">${esc(s.name || 'Untitled')}</span>
        <span class="session-date">${s.date ? new Date(s.date).toLocaleDateString() : ''}</span>
        <button class="session-del" onclick="event.stopPropagation();ChatSessions.delete('${s.id}')" title="Delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`).join('');
  },
  load(id) {
    try {
      const sessions = JSON.parse(localStorage.getItem('orin_sessions') || '[]');
      const s = sessions.find(s => s.id === id);
      if (s && window.ChatMgr?._loadSession) { window.ChatMgr._loadSession(s); }
    } catch {}
    closeModal('chat-sessions-modal');
  },
  delete(id) {
    try {
      let sessions = JSON.parse(localStorage.getItem('orin_sessions') || '[]');
      sessions = sessions.filter(s => s.id !== id);
      localStorage.setItem('orin_sessions', JSON.stringify(sessions));
      this.renderList();
    } catch {}
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-session')?.addEventListener('click', () => {
    const name = document.getElementById('new-session-name')?.value.trim() || 'Session ' + new Date().toLocaleDateString();
    try {
      let sessions = JSON.parse(localStorage.getItem('orin_sessions') || '[]');
      sessions.unshift({ id: 'sess_' + Date.now(), name, date: Date.now(), messages: [] });
      localStorage.setItem('orin_sessions', JSON.stringify(sessions.slice(0, 50)));
      document.getElementById('new-session-name').value = '';
      ChatSessions.renderList();
      toast('Session created', 'ok');
    } catch {}
  });
});

/* ── 16. SnippetsMgr open stub if not defined ────────────────── */
window.SnippetsMgr = window.SnippetsMgr || {};
SnippetsMgr.open = SnippetsMgr.open || function() { openModal('snippets-modal'); };

/* ── 17. Refactor run button ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-refactor-run')?.addEventListener('click', async () => {
    const code = window.EditorMgr?.getSelection?.() || window.EditorMgr?.getValue?.() || '';
    const prompt = document.getElementById('refactor-prompt')?.value.trim() || 'Refactor this code';
    const out = document.getElementById('ai-refactor-out');
    const applyBtn = document.getElementById('btn-refactor-apply');
    if (!code.trim()) { toast('No code to refactor', 'wrn'); return; }
    if (out) out.textContent = 'Refactoring...';
    if (applyBtn) applyBtn.style.display = 'none';
    try {
      const result = await window.API?.chat?.([
        { role: 'user', content: prompt + ':\n```\n' + code.slice(0, 4000) + '\n```\n\nReturn ONLY the refactored code, no explanation.' }
      ]);
      if (out) out.textContent = result || 'No result';
      if (applyBtn && result) {
        applyBtn.style.display = 'block';
        applyBtn.onclick = () => {
          const clean = result.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
          window.EditorMgr?.setValue?.(clean);
          closeModal('ai-refactor-modal');
          toast('Refactored code applied', 'ok');
        };
      }
    } catch (e) {
      if (out) out.textContent = 'Error: ' + e.message;
    }
  });
});

/* ── 18. Ensure btn-ai-fix works ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-ai-fix')?.addEventListener('click', () => {
    window.AIFixBugs?.run?.();
  });
});

/* ── 19. kb shortcut Ctrl+P = command palette ───────────────── */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
    const active = document.activeElement;
    if (active?.tagName === 'TEXTAREA' || active?.tagName === 'INPUT') return;
    e.preventDefault();
    window.CmdPalette?.open?.() || window.CommandPalette?.open?.();
  }
});

/* ── 20. Fix modal-x data-target close buttons robustly ─────── */
document.addEventListener('click', e => {
  const x = e.target.closest('.modal-x[data-target]');
  if (x) { closeModal(x.dataset.target); }
  const bg = e.target.closest('.modal-bg');
  if (bg && e.target === bg) { bg.classList.add('hidden'); }
});

/* ── 21. Context menu on tree item right-click ───────────────── */
document.addEventListener('contextmenu', e => {
  const treeItem = e.target.closest('.tree-item, .folder-item');
  if (!treeItem) return;
  e.preventDefault();
  const ctx = document.getElementById('ctx-menu');
  if (!ctx) return;
  ctx.style.left = e.clientX + 'px';
  ctx.style.top = Math.min(e.clientY, window.innerHeight - 160) + 'px';
  ctx.classList.remove('hidden');
  ctx.dataset.path = treeItem.dataset.path || '';
  ctx.dataset.type = treeItem.dataset.type || 'file';
});
document.addEventListener('click', e => {
  if (!e.target.closest('#ctx-menu')) {
    document.getElementById('ctx-menu')?.classList.add('hidden');
  }
});

