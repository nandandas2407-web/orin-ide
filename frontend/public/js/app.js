'use strict';

/* ============================================================
   MOBILE NAVIGATION  — portrait tab-based, landscape PC-style
   ============================================================ */
const MobNav = {
  current: 'sidebar',

  isPortrait() {
    return window.innerWidth <= 768 && window.matchMedia('(orientation: portrait)').matches;
  },

  init() {
    document.querySelectorAll('.mob-tab').forEach(btn => {
      btn.addEventListener('click', () => this.show(btn.dataset.panel));
    });
    window.addEventListener('resize', () => this._applyLayout());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this._applyLayout(), 120);
    });
    this._applyLayout();
  },

  _applyLayout() {
    if (this.isPortrait()) {
      const tw = document.getElementById('terminal-wrap');
      if (tw) tw.style.display = 'none';
      this.show(this.current || 'sidebar');
    } else {
      this._restoreDesktopLayout();
    }
  },

  _restoreDesktopLayout() {
    ['sidebar', 'center', 'agents-panel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active'); el.style.display = ''; el.style.position = ''; el.style.inset = ''; }
    });
    // chat-panel is excluded — it manages its own visibility via toggleAI()
    // We only reset the inline styles but preserve the active class
    const chat = document.getElementById('chat-panel');
    if (chat) { chat.style.display = ''; chat.style.position = ''; chat.style.inset = ''; }
    const tw = document.getElementById('terminal-wrap');
    if (tw) { tw.style.display = ''; tw.style.height = ''; tw.style.maxHeight = ''; tw.style.minHeight = ''; tw.style.borderTop = ''; }
    const ew = document.getElementById('editor-wrap');
    if (ew) ew.style.display = '';
    document.querySelectorAll('.mob-tab').forEach(b => b.classList.remove('active'));
    // Re-init resizer so drag handles work after rotating to landscape
    if (typeof Resizer !== 'undefined') Resizer.init();
  },

  show(panel) {
    this.current = panel;
    document.querySelectorAll('.mob-tab').forEach(b => b.classList.toggle('active', b.dataset.panel === panel));
    if (!this.isPortrait()) return;

    // Remove mob-active from all panels
    ['sidebar', 'center', 'chat-panel', 'agents-panel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('mob-active'); el.classList.remove('active'); }
    });
    const map = { sidebar: 'sidebar', editor: 'center', chat: 'chat-panel', agents: 'agents-panel', terminal: 'center' };
    const target = document.getElementById(map[panel]);
    if (target) { target.classList.add('mob-active'); target.classList.add('active'); }

    const ew = document.getElementById('editor-wrap');
    const tw = document.getElementById('terminal-wrap');
    if (panel === 'terminal') {
      if (ew) ew.style.display = 'none';
      if (tw) { tw.style.display = 'flex'; tw.style.height = '100%'; tw.style.maxHeight = 'unset'; tw.style.minHeight = 'unset'; tw.style.borderTop = 'none'; tw.classList.remove('collapsed'); }
    } else if (panel === 'editor') {
      if (ew) ew.style.display = '';
      if (tw) { tw.style.display = 'none'; tw.style.height = ''; tw.style.maxHeight = ''; tw.style.minHeight = ''; tw.style.borderTop = ''; }
    } else if (panel === 'agents') {
      if (ew) ew.style.display = 'none';
      if (tw) tw.style.display = 'none';
    } else {
      if (ew) ew.style.display = '';
      if (tw) tw.style.display = '';
    }
  }
};

/* ============================================================
   ACTIVITY BAR — switch sidebar views (explorer/search/git/ext)
   ============================================================ */
const ActivityBar = {
  init() {
    document.querySelectorAll('.ab-btn[data-view]').forEach(btn => {
      // Skip the AI, Terminal, Agents, and Ollama buttons — they have dedicated onclick handlers
      // (toggleAI/toggleTerminal/toggleAgents/OllamaPanel.toggle) and should NOT go through show()
      // which would hide all sidebar panels as a side effect.
      if (btn.dataset.view === 'ai' || btn.dataset.view === 'terminal' || btn.dataset.view === 'agents' || btn.dataset.view === 'ollama') return;
      btn.addEventListener('click', () => this.show(btn.dataset.view));
    });
  },
  show(view) {
    // AI, terminal, agents, and ollama are toggled separately — never route through show()
    if (view === 'ai' || view === 'terminal' || view === 'agents' || view === 'ollama') return;

    // Update button active state (deactivate ai/terminal buttons too)
    document.querySelectorAll('.ab-btn[data-view]').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    // Hide all sidebar views
    document.querySelectorAll('.sidebar-view').forEach(sb => sb.classList.add('hidden'));
    document.getElementById('sidebar')?.classList.add('hidden');
    // Show the matching sidebar (remove hidden)
    if (view === 'explorer') {
      document.getElementById('sidebar')?.classList.remove('hidden');
    } else {
      const target = document.getElementById('sidebar-' + view);
      if (target) target.classList.remove('hidden');
    }
    // Hide chat and agents panels when switching sidebar views
    document.getElementById('chat-panel')?.classList.remove('active');
    document.getElementById('agents-panel')?.classList.remove('active');
    const aiBtn = document.querySelector('.ab-btn[data-view="ai"]');
    if (aiBtn) aiBtn.classList.remove('active');
    const agentsBtn = document.querySelector('.ab-btn[data-view="agents"]');
    if (agentsBtn) agentsBtn.classList.remove('active');
    if (window.EditorMgr) EditorMgr.layout();

    // Auto-refresh git panel when it opens; focus search input when search opens
    if (view === 'git' && window.GitMgr) {
      GitMgr._project = window.FileTree?.project || null;
      setTimeout(() => GitMgr.open(), 50);
    }
    if (view === 'search') {
      setTimeout(() => document.getElementById('sb-search-input')?.focus(), 60);
    }
  },
  toggleAI() {
    const chat = document.getElementById('chat-panel');
    if (!chat) return;
    const visible = chat.classList.toggle('active');
    const btn = document.querySelector('.ab-btn[data-view="ai"]');
    if (btn) btn.classList.toggle('active', visible);
    // Close agents panel when AI chat opens
    if (visible) {
      document.getElementById('agents-panel')?.classList.remove('active');
      document.getElementById('agents-panel')?.classList.remove('mob-active');
      document.querySelector('.ab-btn[data-view="agents"]')?.classList.remove('active');
    }
    if (window.EditorMgr) EditorMgr.layout();
  },
  toggleTerminal() {
    const bp = document.getElementById('bottom-panel');
    if (!bp) return;
    const visible = bp.classList.toggle('active');
    const btn = document.getElementById('ab-terminal');
    if (btn) btn.classList.toggle('active', visible);
    if (window.EditorMgr) EditorMgr.layout();
  },
  toggleAgents() {
    const ap = document.getElementById('agents-panel');
    if (!ap) return;
    const visible = ap.classList.toggle('active');
    // Mobile: use mob-active instead
    if (typeof MobNav !== 'undefined' && MobNav.isPortrait && MobNav.isPortrait()) {
      ap.classList.toggle('mob-active', visible);
    }
    const btn = document.querySelector('.ab-btn[data-view="agents"]');
    if (btn) btn.classList.toggle('active', visible);
    // Deactivate AI chat if agents opens
    if (visible) {
      document.getElementById('chat-panel')?.classList.remove('active');
      document.getElementById('chat-panel')?.classList.remove('mob-active');
      document.querySelector('.ab-btn[data-view="ai"]')?.classList.remove('active');
    }
    if (window.EditorMgr) EditorMgr.layout();
  }
};
window.ActivityBar = ActivityBar;

/* ============================================================
   FEATURE HUB — unified launcher for all IDE features
   ============================================================ */
const FeatureHub = {
  toggle() {
    const bg = document.getElementById('feature-hub-bg');
    if (!bg) return;
    const open = bg.classList.toggle('hidden');
    if (!open) {
      // Close any open side panels when opening hub
      document.getElementById('chat-panel')?.classList.remove('active');
      document.getElementById('chat-panel')?.classList.remove('mob-active');
      document.querySelector('.ab-btn[data-view="ai"]')?.classList.remove('active');
      document.getElementById('agents-panel')?.classList.remove('active');
      document.getElementById('agents-panel')?.classList.remove('mob-active');
      document.getElementById('ab-agents')?.classList.remove('active');
    }
  },
  close() {
    document.getElementById('feature-hub-bg')?.classList.add('hidden');
  }
};
window.FeatureHub = FeatureHub;

/* ============================================================
   BOTTOM PANEL — switch terminal/problems/output tabs
   ============================================================ */
const BottomPanel = {
  init() {
    document.querySelectorAll('.bp-tab[data-bp]').forEach(tab => {
      tab.addEventListener('click', () => this.show(tab.dataset.bp));
    });
    document.getElementById('btn-bp-close')?.addEventListener('click', () => this.hide());
    // Restore saved height (Resizer._loadSaved() also restores this on
    // boot; this covers the case where BottomPanel.init() runs first).
    const saved = Cfg.get('termH', null);
    if (saved) {
      const el = document.getElementById('bottom-panel');
      if (el) {
        const vh = window.innerHeight;
        const clamped = Math.max(60, Math.min(vh * 0.55, saved));
        el.style.height = clamped + 'px';
        document.documentElement.style.setProperty('--bp-h', clamped + 'px');
      }
    }
  },
  show(tab) {
    document.querySelectorAll('.bp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bp-content').forEach(c => c.classList.remove('active'));
    const tabEl = document.querySelector(`.bp-tab[data-bp="${tab}"]`);
    const contentEl = document.getElementById('bp-' + tab);
    if (tabEl) tabEl.classList.add('active');
    if (contentEl) contentEl.classList.add('active');
    // Make sure bottom-panel is visible
    const bp = document.getElementById('bottom-panel');
    if (bp) {
      bp.style.display = '';
      bp.classList.add('active');
    }
    if (tab === 'terminal') {
      setTimeout(() => {
        try { if (window.TermMgr?.fitAddon) TermMgr.fitAddon.fit(); } catch {}
      }, 50);
    }
    if (window.EditorMgr) EditorMgr.layout();
  },
  hide() {
    const bp = document.getElementById('bottom-panel');
    if (bp) {
      bp.style.display = 'none';
      bp.classList.remove('active');
    }
    // Also update the terminal toggle state
    const toggleBtn = document.getElementById('btn-toggle-terminal-chat');
    if (toggleBtn) toggleBtn.classList.remove('active');
    if (window.EditorMgr) EditorMgr.layout();
  },
  toggle() {
    const bp = document.getElementById('bottom-panel');
    if (!bp) return;
    const isHidden = bp.style.display === 'none' || !bp.classList.contains('active');
    if (isHidden) {
      this.show('terminal');
    } else {
      this.hide();
    }
  }
};
window.BottomPanel = BottomPanel;

/* ============================================================
   STATUS BAR — update cursor pos, git branch, errors, etc
   ============================================================ */
const StatusBar = {
  init() {
    this._updateBranch();
    this._updateCursor();
  },
  setCursorPos(line, col) {
    const el = document.getElementById('st-cursor-pos');
    if (el) el.textContent = `Ln ${line}, Col ${col}`;
  },
  setLanguage(lang) {
    const el = document.getElementById('st-language');
    if (el) el.textContent = lang || 'Plain Text';
  },
  setEncoding(enc) {
    const el = document.getElementById('st-encoding');
    if (el) el.textContent = enc || 'UTF-8';
  },
  setErrors(count) {
    const el = document.getElementById('st-error-count');
    if (el) el.textContent = count || '0';
    document.getElementById('st-errors').style.display = (count > 0) ? '' : 'none';
  },
  setWarnings(count) {
    const el = document.getElementById('st-warning-count');
    if (el) el.textContent = count || '0';
    document.getElementById('st-warnings').style.display = (count > 0) ? '' : 'none';
  },
  setBranch(name) {
    const el = document.getElementById('st-branch-name');
    if (el) el.textContent = name || 'main';
  },
  _updateBranch() {
    // Simple placeholder; could be enhanced with real git branch detection
    this.setBranch('main');
  },
  _updateCursor() {
    // Updates from editor via EditorMgr cursor listener
  }
};

/* ============================================================
   FULLSCREEN MANAGER
   ============================================================ */
const FullscreenMgr = {
  init() {
    ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(ev => {
      document.addEventListener(ev, () => this._syncIcon());
    });
  },
  toggle() { this._isActive() ? this._exit() : this._enter(); },
  _isActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement ||
              document.documentElement.classList.contains('is-fullscreen'));
  },
  _enter() {
    const el = document.documentElement;
    const fallback = () => { el.classList.add('is-fullscreen'); this._syncIcon(); };
    try {
      let p;
      if      (el.requestFullscreen)       p = el.requestFullscreen();
      else if (el.webkitRequestFullscreen) p = el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)    p = el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)     p = el.msRequestFullscreen();
      else { fallback(); return; }
      if (p && typeof p.catch === 'function') p.catch(fallback);
    } catch (_) { fallback(); }
  },
  _exit() {
    const el = document.documentElement;
    const fallback = () => { el.classList.remove('is-fullscreen'); this._syncIcon(); };
    try {
      let p;
      if      (document.exitFullscreen)       p = document.exitFullscreen();
      else if (document.webkitExitFullscreen) p = document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen)  p = document.mozCancelFullScreen();
      else if (document.msExitFullscreen)     p = document.msExitFullscreen();
      else { fallback(); return; }
      if (p && typeof p.catch === 'function') p.catch(fallback);
    } catch (_) { fallback(); }
  },
  _syncIcon() {
    const on = this._isActive();
    const ei = document.getElementById('fs-icon-enter');
    const xi = document.getElementById('fs-icon-exit');
    const btn = document.getElementById('btn-fullscreen');
    if (ei)  ei.style.display  = on ? 'none' : '';
    if (xi)  xi.style.display  = on ? ''     : 'none';
    if (btn) btn.title = on ? 'Exit Fullscreen [ ]' : 'Enter Fullscreen [ ]';
    document.documentElement.classList.toggle('is-fullscreen', on);
  }
};


/* ============================================================
   SETTINGS MANAGER
   ============================================================ */
/* ============================================================
   MODEL PICKER
   Central model management — topbar button + settings sync
   ============================================================ */
const ModelPicker = {
  init() {
    // Load saved model (accept any string — no whitelist restriction)
    const saved = Cfg.get('model', 'openrouter/free');
    this.refreshProviderModels();
    this._applyToUI(saved);

    // Toggle from mobile topbar button (model-picker-btn is the mobile header button)
    const btn = document.getElementById('model-picker-btn');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); this.toggle(btn); });

    // ab-model-picker uses onclick="ModelPicker.toggle(this)" directly — no duplicate listener needed

    // Search filter
    const search = document.getElementById('mpd-search');
    if (search) {
      search.addEventListener('input', () => this._filter(search.value));
      search.addEventListener('click', e => e.stopPropagation());
    }

    // Custom input apply button
    const applyBtn = document.getElementById('mpd-custom-apply');
    const inp      = document.getElementById('mpd-custom-input');
    const hint     = document.getElementById('mpd-custom-hint');
    if (applyBtn && inp) {
      const doApply = () => {
        const val = inp.value.trim();
        if (!val) { if (hint) { hint.textContent = 'Enter a model ID first'; hint.className = 'mpd-custom-feedback err'; } return; }
        if (!val.includes('/')) {
          if (hint) { hint.textContent = 'Format: provider/model-name'; hint.className = 'mpd-custom-feedback err'; }
          return;
        }
        this.setModel(val, val);
        if (hint) { hint.textContent = 'Active: ' + val; hint.className = 'mpd-custom-feedback'; }
        setTimeout(() => this._close(), 800);
      };
      applyBtn.addEventListener('click', doApply);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doApply(); } });
    }

    const manageBtn = document.getElementById('mpd-manage-providers');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => {
        this._close();
        SettingsMgr.load();
        openModal('settings-modal');
        document.querySelector('[data-tab="s-prov"]')?.click();
      });
    }

    // Close on outside click
    document.addEventListener('click', e => {
      const dd = document.getElementById('model-picker-dropdown');
      if (dd && !dd.classList.contains('hidden')) {
        if (!dd.contains(e.target) && !e.target.closest('#model-picker-btn, #ab-model-picker, #model-badge')) {
          this._close();
        }
      }
    });

    // Prevent dropdown scroll from closing
    const ddEl = document.getElementById('model-picker-dropdown');
    if (ddEl) ddEl.addEventListener('click', e => e.stopPropagation());
  },

  // Rebuilds the dropdown's model groups from Providers.list(). Called on
  // init and again whenever a provider's key/models change, so newly
  // discovered models (via auto-fetch) show up without a page reload.
  refreshProviderModels() {
    const groups = document.getElementById('mpd-groups');
    if (!groups || typeof Providers === 'undefined') return;

    const providers = Providers.list().filter(p => p.apiKey || p.id === 'openrouter' || p.id === 'ollama');
    groups.innerHTML = '';

    if (!providers.length) {
      groups.innerHTML = '<div class="mpd-empty">No providers configured. Add an API key in Settings → Providers.</div>';
      return;
    }

    const current = this.getModel();
    for (const p of providers) {
      const section = document.createElement('div');
      section.className = 'mpd-provider-group';
      const models = p.models || [];
      section.innerHTML = `
        <div class="mpd-section-title">${esc(p.name)}${p.apiKey ? '' : ' <span class="mpd-hint">(no key)</span>'}</div>
        <div class="mpd-list"></div>
      `;
      const list = section.querySelector('.mpd-list');
      if (!models.length) {
        const empty = document.createElement('div');
        empty.className = 'mpd-empty-sub';
        empty.textContent = p.apiKey ? 'No models found — try Test in Settings' : 'Add an API key to load models';
        list.appendChild(empty);
      }
      for (const m of models) {
        const opt = document.createElement('button');
        opt.className = 'mpd-opt' + (m.id === current ? ' active' : '');
        opt.dataset.value = m.id;
        opt.dataset.label = m.name || m.id;
        opt.innerHTML = `<span>${esc(m.name || m.id)}</span>`;
        opt.addEventListener('click', () => {
          this.setModel(m.id, m.name || m.id);
          this._close();
        });
        list.appendChild(opt);
      }
      groups.appendChild(section);
    }

    // Ollama section — show recommended models if detected
    if (typeof OllamaMgr !== 'undefined' && OllamaMgr.isDetected) {
      const section = document.createElement('div');
      section.className = 'mpd-provider-group';
      const recs = OllamaMgr.getRecommendedModels();
      const badge = OllamaMgr.isAndroid ? ' <span class="mpd-hint">(Android — small models)</span>' : '';
      section.innerHTML = `
        <div class="mpd-section-title">🔧 Ollama Local${badge}</div>
        <div class="mpd-list"></div>
      `;
      const list = section.querySelector('.mpd-list');
      for (const m of recs) {
        const installed = OllamaMgr.models.some(om => om.id === m.id || om.id.startsWith(m.id.split(':')[0]));
        const opt = document.createElement('button');
        opt.className = 'mpd-opt';
        opt.innerHTML = `<span>${esc(m.name)}</span>${installed ? ' <span class="mpd-hint">installed</span>' : ''}`;
        opt.addEventListener('click', async () => {
          if (!installed) {
            await OllamaMgr.installModel(m.id);
            this.refreshProviderModels();
          }
          this.setModel(`ollama/${m.id}`, m.name);
          this._close();
        });
        list.appendChild(opt);
      }
      // Also show already-installed models
      for (const m of OllamaMgr.models) {
        if (recs.some(r => r.id === m.id || r.id.split(':')[0] === m.id.split(':')[0])) continue;
        const opt = document.createElement('button');
        opt.className = 'mpd-opt';
        opt.innerHTML = `<span>${esc(m.name)}</span>${m.size ? ` <span class="mpd-hint">${m.size}</span>` : ''}`;
        opt.addEventListener('click', () => {
          this.setModel(`ollama/${m.id}`, m.name);
          this._close();
        });
        list.appendChild(opt);
      }
      groups.appendChild(section);
    }
  },

  _filter(query) {
    const q = query.trim().toLowerCase();
    document.querySelectorAll('.mpd-provider-group').forEach(group => {
      let anyVisible = false;
      group.querySelectorAll('.mpd-opt').forEach(opt => {
        const match = !q || opt.textContent.toLowerCase().includes(q);
        opt.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      const title = group.querySelector('.mpd-section-title')?.textContent.toLowerCase() || '';
      if (!q || title.includes(q)) anyVisible = true;
      group.style.display = anyVisible ? '' : 'none';
    });
  },

  setModel(value, label) {
    Cfg.set('model', value);
    this._applyToUI(value, label);
    if (window.ChatMgr) ChatMgr._updateBadge(value);
  },

  getModel() {
    return Cfg.get('model', 'openrouter/free');
  },

  _applyToUI(value, label) {
    const lbl = label || this._shortLabel(value);

    // Topbar button label
    const labelEl = document.getElementById('model-picker-label');
    if (labelEl) labelEl.textContent = lbl;

    // Mark active option across all provider groups
    document.querySelectorAll('.mpd-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.value === value);
    });

    // Settings display
    const disp = document.getElementById('s-model-display');
    if (disp) disp.textContent = value;
    const sInp = document.getElementById('s-model');
    if (sInp) sInp.value = value;
  },

  _shortLabel(v) {
    // "provider/some-long-model-name:tag" → "some-long-model-name"
    const parts = v.split('/');
    let name = parts[parts.length - 1] || v;
    name = name.replace(/:.*$/, ''); // strip :free / :tag
    return name.length > 14 ? name.slice(0, 13) + '…' : name;
  },

  toggle(sourceOrEvent) {
    // Accept either the trigger element or a MouseEvent (from inline onclick)
    let source = sourceOrEvent;
    if (sourceOrEvent instanceof Event) {
      sourceOrEvent.stopPropagation();
      source = sourceOrEvent.currentTarget || sourceOrEvent.target;
    } else if (sourceOrEvent && sourceOrEvent.stopPropagation) {
      sourceOrEvent.stopPropagation();
    }
    const dd  = document.getElementById('model-picker-dropdown');
    if (!dd) return;
    const isOpen = !dd.classList.contains('hidden');
    if (isOpen) { this._close(); } else { this._open(source); }
  },

  _open(source) {
    const dd  = document.getElementById('model-picker-dropdown');
    if (!dd) return;
    this.refreshProviderModels();
    dd.classList.remove('hidden');
    // Position relative to trigger
    const trigger = source || document.getElementById('ab-model-picker') || document.getElementById('model-picker-btn');
    this._activeTrigger = trigger;
    if (trigger) trigger.classList.add('open');
    if (trigger) {
      const tr = trigger.getBoundingClientRect();
      // Remove old inline styles
      dd.style.top = ''; dd.style.bottom = ''; dd.style.right = ''; dd.style.left = '';
      dd.style.position = 'fixed';
      dd.style.top = (tr.bottom + 4) + 'px';
      // If activity bar trigger, align from left
      if (trigger.id === 'ab-model-picker') {
        dd.style.left = (tr.right + 4) + 'px';
        dd.style.right = 'auto';
      } else if (trigger.id === 'model-badge') {
        // Chat panel header trigger: align right edge under the badge
        dd.style.right = (window.innerWidth - tr.right) + 'px';
        dd.style.left = 'auto';
      } else {
        // Mobile topbar: align right edge
        dd.style.right = (window.innerWidth - tr.right) + 'px';
        dd.style.left = 'auto';
      }
    }
    // Flip above if not enough space below
    requestAnimationFrame(() => {
      const rect = dd.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8) {
        dd.style.top = 'auto';
        dd.style.bottom = '8px';
      }
    });
    const search = document.getElementById('mpd-search');
    if (search) { search.value = ''; this._filter(''); setTimeout(() => search.focus(), 50); }
  },

  _close() {
    const dd  = document.getElementById('model-picker-dropdown');
    if (dd)  dd.classList.add('hidden');
    if (this._activeTrigger) this._activeTrigger.classList.remove('open');
    this._activeTrigger = null;
    if (dd) dd.style.position = '';
  }
};
window.ModelPicker = ModelPicker;

const SettingsMgr = {
  _editingProviderId: null,

  init() {
    document.getElementById('ab-settings')?.addEventListener('click', () => { this.load(); openModal('settings-modal'); });
    document.getElementById('btn-settings')?.addEventListener('click', () => { this.load(); openModal('settings-modal'); });
    document.getElementById('btn-mob-settings')?.addEventListener('click', () => { this.load(); openModal('settings-modal'); });
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.save());

    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const content = document.getElementById(tab.dataset.tab);
        if (content) {
          content.classList.add('active');
          if (tab.dataset.tab === 's-prov') this._renderProviders();
        }
      });
    });

    // Settings quick-preset buttons
    document.querySelectorAll('.s-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        document.getElementById('s-model').value = val;
      });
    });

    // Theme live preview — apply immediately on select change
    document.getElementById('s-theme')?.addEventListener('change', (e) => {
      if (typeof ThemeMgr !== 'undefined') ThemeMgr.apply(e.target.value);
    });

    // Settings apply button — immediately update active model without closing modal
    document.getElementById('s-model-apply')?.addEventListener('click', () => {
      const val = (document.getElementById('s-model').value || '').trim();
      if (!val) return;
      ModelPicker.setModel(val, val);
      const disp = document.getElementById('s-model-display');
      if (disp) disp.textContent = val;
      toast('Model updated: ' + val, 'ok', 1800);
    });

    // Provider management
    // Add Provider button is now rendered dynamically inside the list by _renderProviders()
    document.getElementById('btn-save-provider')?.addEventListener('click', () => this._saveProvider());
    document.getElementById('btn-test-provider')?.addEventListener('click', () => this._testProvider());

    // "Manage Providers" entry in model picker dropdown
    document.getElementById('mpd-manage-providers')?.addEventListener('click', () => {
      ModelPicker._close();
      this.load();
      openModal('settings-modal');
      // Switch to Providers tab
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector('.settings-tab[data-tab="s-prov"]')?.classList.add('active');
      document.getElementById('s-prov')?.classList.add('active');
      this._renderProviders();
    });
  },

  load() {
    const s = Cfg.all();
    document.getElementById('s-apikey').value = s.apiKey || '';
    const model = s.model || 'openrouter/free';
    document.getElementById('s-model').value = model;
    const disp = document.getElementById('s-model-display');
    if (disp) disp.textContent = model;
    document.getElementById('s-fontsize').value = s.fontSize || 14;
    document.getElementById('s-tabsize').value = s.tabSize || 2;
    document.getElementById('s-wordwrap').checked = s.wordWrap !== false;
    document.getElementById('s-minimap').checked = !!s.minimap;
    document.getElementById('s-autosave').checked = !!s.autosave;
    document.getElementById('s-format-onsave').checked = !!s.formatOnSave;
    document.getElementById('s-theme').value = s.theme || 'orin-dark';
    document.getElementById('s-exportpath').value = s.exportPath || '/storage/emulated/0/';
    document.getElementById('s-github-token').value = s.githubToken || '';
    document.getElementById('s-git-user').value = s.gitUser || '';
    document.getElementById('s-git-email').value = s.gitEmail || '';
    if (window.SidebarPosition) {
      document.querySelectorAll('#sbpos-grid .sbpos-opt').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pos === SidebarPosition.current);
      });
    }
    if (window.ChatPosition) {
      document.querySelectorAll('#cppos-grid .cppos-opt').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pos === ChatPosition.current);
      });
    }
  },

  save() {
    // Save OpenRouter API key from General tab
    const apiKey = document.getElementById('s-apikey').value.trim();
    const openrouter = Providers.get('openrouter');
    if (openrouter) {
      Providers.update('openrouter', { apiKey });
    }
    const s = {
      apiKey,
      model: (document.getElementById('s-model').value || '').trim() || 'openrouter/free',
      fontSize: parseInt(document.getElementById('s-fontsize').value) || 14,
      tabSize: parseInt(document.getElementById('s-tabsize').value) || 2,
      wordWrap: document.getElementById('s-wordwrap').checked,
      minimap: document.getElementById('s-minimap').checked,
      autosave: document.getElementById('s-autosave').checked,
      formatOnSave: document.getElementById('s-format-onsave').checked,
      theme: document.getElementById('s-theme').value,
      exportPath: document.getElementById('s-exportpath').value.trim(),
      githubToken: document.getElementById('s-github-token').value.trim(),
      gitUser: document.getElementById('s-git-user').value.trim(),
      gitEmail: document.getElementById('s-git-email').value.trim(),
    };
    Cfg.save(s);
    EditorMgr.applySettings(s);
    ModelPicker.setModel(s.model, s.model);
    // Apply theme
    if (typeof ThemeMgr !== 'undefined' && s.theme) ThemeMgr.apply(s.theme);
    // Apply git config
    if (s.gitUser) API.execCmd(`git config --global user.name "${s.gitUser}"`, null);
    if (s.gitEmail) API.execCmd(`git config --global user.email "${s.gitEmail}"`, null);
    closeModal('settings-modal');
    toast('Settings saved', 'ok', 1200);
  },

  // ---- Provider management ----

  _renderProviders() {
    const list = document.getElementById('s-provider-list');
    if (!list) return;
    list.innerHTML = '';
    const providers = Providers.list();
    for (const p of providers) {
      const div = document.createElement('div');
      div.className = 's-provider-item' + (p.apiKey ? ' has-key' : '');
      const isBuiltin = p.id === 'openrouter';
      const modelCount = (p.models || []).length;
      div.innerHTML = `
        <div class="s-provider-info">
          <div class="s-provider-name">
            ${esc(p.name)}
            <span class="s-provider-id">${isBuiltin ? 'built-in' : esc(p.id)}</span>
          </div>
          <div class="s-provider-meta">${p.baseURL ? esc(p.baseURL.replace(/https?:\/\//, '')) : 'No URL'} &middot; ${modelCount} model${modelCount !== 1 ? 's' : ''}</div>
          ${p.apiKey
            ? `<div class="s-provider-key-set">Key configured</div>`
            : `<div class="s-provider-key-missing">No API key &mdash; click edit to add one</div>`}
        </div>
        <div class="s-provider-actions">
          ${!isBuiltin ? `<button class="ib sm s-prov-edit" data-id="${esc(p.id)}" title="Edit key &amp; settings">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>` : ''}
          <button class="ib sm s-prov-test" data-id="${esc(p.id)}" title="Test &amp; fetch models">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </button>
          ${!isBuiltin ? `<button class="ib sm s-prov-del" data-id="${esc(p.id)}" title="Remove provider">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>` : ''}
        </div>
      `;
      list.appendChild(div);
      div.querySelector('.s-prov-test')?.addEventListener('click', () => this._testProviderById(p.id));
      div.querySelector('.s-prov-edit')?.addEventListener('click', () => this._openProviderModal(p.id));
      div.querySelector('.s-prov-del')?.addEventListener('click', () => {
        if (confirm(`Remove provider "${p.name}"?`)) {
          Providers.remove(p.id); this._renderProviders(); toast('Provider removed', 'ok');
        }
      });
    }
    const addBtn = document.createElement('button');
    addBtn.id = 'btn-add-provider-inline';
    addBtn.className = 'btn-add-prov-inline';
    addBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Provider`;
    addBtn.addEventListener('click', () => this._openProviderModal());
    list.appendChild(addBtn);
  },

  _openProviderModal(id) {
    this._editingProviderId = id || null;
    const title = document.getElementById('provider-modal-title');
    if (title) title.textContent = id ? 'Edit Provider' : 'Add Provider';
    const nameEl = document.getElementById('p-name');
    const urlEl = document.getElementById('p-baseurl');
    const keyEl = document.getElementById('p-apikey');
    const statusEl = document.getElementById('p-status');
    if (statusEl) statusEl.textContent = '';
    if (id) {
      const p = Providers.get(id);
      if (p) {
        if (nameEl) nameEl.value = p.name || '';
        if (urlEl) urlEl.value = p.baseURL || '';
        if (keyEl) keyEl.value = p.apiKey || '';
      }
    } else {
      if (nameEl) nameEl.value = '';
      if (urlEl) urlEl.value = '';
      if (keyEl) keyEl.value = '';
    }
    openModal('provider-modal');
  },

  async _saveProvider() {
    const name = document.getElementById('p-name')?.value.trim();
    const baseURL = document.getElementById('p-baseurl')?.value.trim();
    const apiKey = document.getElementById('p-apikey')?.value.trim();
    const statusEl = document.getElementById('p-status');

    if (!name || !baseURL) {
      if (statusEl) { statusEl.textContent = 'Name and Base URL are required'; statusEl.className = 's-prov-status err'; }
      return;
    }

    let savedId;
    let keyChanged = false;

    if (this._editingProviderId) {
      const existing = Providers.get(this._editingProviderId);
      if (existing) {
        keyChanged = apiKey && apiKey !== existing.apiKey;
        Providers.update(this._editingProviderId, { name, baseURL, apiKey });
        savedId = this._editingProviderId;
        toast('Provider updated', 'ok');
      }
    } else {
      const id = name.toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
      if (Providers.get(id)) {
        if (statusEl) { statusEl.textContent = 'A provider with this ID already exists'; statusEl.className = 's-prov-status err'; }
        return;
      }
      Providers.add({ id, name, baseURL, apiKey: apiKey || '', models: [] });
      savedId = id;
      keyChanged = !!apiKey;
      toast('Provider added', 'ok');
    }

    if (statusEl) { statusEl.textContent = ''; statusEl.className = 's-prov-status'; }
    closeModal('provider-modal');
    this._editingProviderId = null;
    this._renderProviders();

    // A key was just set or changed — auto-discover that provider's
    // models instead of leaving the user to type exact model IDs by hand.
    if (savedId && keyChanged) {
      toast('Fetching available models...', 'inf', 2000);
      const result = await Providers.fetchModels(savedId);
      if (result.ok && result.models.length) {
        Providers.update(savedId, { models: result.models });
        toast(`Found ${result.models.length} model${result.models.length !== 1 ? 's' : ''} for ${name}`, 'ok');
      } else if (!result.ok) {
        toast(`Couldn't auto-fetch models for ${name}: ${result.error}. You can still pick a model manually.`, 'wrn', 5000);
      }
      this._renderProviders();
      if (window.ModelPicker) ModelPicker.refreshProviderModels();
    }
  },

  async _testProviderById(id) {
    const p = Providers.get(id);
    if (!p) return;
    const statusEl = document.getElementById('p-status');
    if (statusEl) { statusEl.textContent = 'Testing...'; statusEl.className = 's-prov-status'; }
    try {
      const url = `${(p.baseURL || '').replace(/\/+$/, '')}/models`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${p.apiKey || ''}` }
      });
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).slice(0, 50).map(m => ({ id: m.id, name: m.id }));
        Providers.update(id, { models });
        if (models.length) {
          toast(`${p.name}: ${models.length} models found`, 'ok');
        } else {
          toast(`${p.name}: connected, but no models returned`, 'inf');
        }
      } else {
        toast(`${p.name}: connection failed (${res.status})`, 'err');
      }
    } catch (e) {
      toast(`${p.name}: error — ${e.message}`, 'err');
    }
    this._renderProviders();
  },

  async _testProvider() {
    const baseURL = document.getElementById('p-baseurl')?.value.trim();
    const apiKey = document.getElementById('p-apikey')?.value.trim();
    const statusEl = document.getElementById('p-status');
    if (!baseURL) {
      if (statusEl) { statusEl.textContent = 'Enter a Base URL first'; statusEl.className = 's-prov-status err'; }
      return;
    }
    if (statusEl) { statusEl.textContent = 'Testing...'; statusEl.className = 's-prov-status'; }
    try {
      const url = `${baseURL.replace(/\/+$/, '')}/models`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey || ''}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = (data.data || []).length;
        if (statusEl) { statusEl.textContent = `Connected! ${count} models available. Save provider to use.`; statusEl.className = 's-prov-status ok'; }
      } else {
        const errText = await res.text().catch(() => '');
        if (statusEl) { statusEl.textContent = `Connection failed (${res.status}): ${errText.slice(0, 100)}`; statusEl.className = 's-prov-status err'; }
      }
    } catch (e) {
      if (statusEl) { statusEl.textContent = `Error: ${e.message}`; statusEl.className = 's-prov-status err'; }
    }
  }
};
window.SettingsMgr = SettingsMgr;

/* ============================================================
   EXPORT MANAGER
   ============================================================ */
const ExportMgr = {
  init() {
    document.getElementById('btn-export')?.addEventListener('click', () => {
      if (!FileTree.project) return toast('No project open', 'wrn');
      document.getElementById('export-proj-name').textContent = FileTree.project;
      openModal('export-modal');
    });
    document.getElementById('btn-dl-zip')?.addEventListener('click', async () => {
      if (!FileTree.project) return;
      try {
        toast('Preparing ZIP download...', 'inf', 2000);
        const res = await fetch(API.exportZipUrl(FileTree.project) + '?_=' + Date.now());
        if (!res.ok) throw new Error('Export failed (' + res.status + ')');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = FileTree.project + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('ZIP downloaded', 'ok');
      } catch (e) {
        toast('Download error: ' + e.message, 'err');
      }
    });
    document.getElementById('btn-export-termux')?.addEventListener('click', async () => {
      if (!FileTree.project) return;
      const dir = document.getElementById('inp-termux-path').value.trim() || Cfg.get('exportPath', '/storage/emulated/0/');
      const msgEl = document.getElementById('export-msg');
      msgEl.className = 'msg-ok'; msgEl.textContent = 'Exporting...';
      try {
        const r = await API.exportTermux(FileTree.project, dir);
        if (r.error) { msgEl.className = 'msg-ok err'; msgEl.textContent = r.error; }
        else { msgEl.className = 'msg-ok'; msgEl.textContent = 'Exported to: ' + r.exportedTo; toast('Exported', 'ok'); }
      } catch (e) { msgEl.className = 'msg-ok err'; msgEl.textContent = e.message; }
    });
  }
};

/* ============================================================
   IMPORT MANAGER
   ============================================================ */
const ImportMgr = {
  init() {
    // Topbar import button — single action: click → file picker → import directly
    document.getElementById('btn-import')?.addEventListener('click', () => {
      let inp = document.getElementById('global-zip-input');
      if (!inp) return;
      // Reset so same file can be re-selected
      inp.value = '';
      inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        inp.value = '';
        // For ZIP files: show modal for optional naming, then auto-import
        if (file.name.endsWith('.zip')) {
          openModal('import-modal');
          // Pre-fill name from filename and auto-trigger after short delay
          const nameEl = document.getElementById('inp-import-name');
          if (nameEl && !nameEl.value) nameEl.value = file.name.replace(/\.zip$/i, '');
          this._doImport(file);
        } else {
          // Non-ZIP: import directly, no modal needed
          this._doImport(file);
        }
      };
      inp.click();
    });

    // Global hidden file input (used by welcome screen)
    const globalInput = document.getElementById('global-zip-input');
    // Note: onchange handler set dynamically above to avoid double-fire

    // Dropzone click — same single-action
    document.getElementById('dropzone')?.addEventListener('click', () => {
      let inp = document.getElementById('global-zip-input');
      if (!inp) return;
      inp.value = '';
      inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        inp.value = '';
        this._doImport(file);
      };
      inp.click();
    });

    // Drag and drop onto dropzone
    const dz = document.getElementById('dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('over');
      const file = e.dataTransfer.files[0];
      if (file) this._doImport(file);
    });

    // Also allow drag onto the whole app
    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', e => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) this._doImport(file);
    });
  },

  async _doImport(file) {
    const nameEl = document.getElementById('inp-import-name');
    const name = nameEl ? nameEl.value.trim() : '';
    const msgEl = document.getElementById('import-msg');

    // Non-ZIP: treat as individual file — if project is open, upload as asset; else create project
    if (!file.name.endsWith('.zip')) {
      if (FileTree.project) {
        // Upload directly into current project as an asset
        closeModal('import-modal');
        await MediaMgr._uploadFile(file);
        return;
      }
      // No project: create one and write the file
      msgEl.className = 'msg-ok'; msgEl.textContent = 'Importing...';
      showLoading('Importing ' + file.name + '...');
      try {
        const projName = (name || file.name.replace(/\.[^.]+$/,'')).replace(/[^a-zA-Z0-9_\-. ]/g,'_').trim() || 'imported';
        const cr = await API.createProject(projName);
        if (cr.error) throw new Error(cr.error);
        const isBinary = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mp3|wav|ogg|pdf|woff|woff2|ttf|ico)$/i.test(file.name);
        if (isBinary) {
          await API.uploadAsset(projName, file, file.name);
        } else {
          const text = await file.text();
          await API.writeFile(projName, file.name, text);
        }
        hideLoading();
        msgEl.className = 'msg-ok'; msgEl.textContent = `Imported "${projName}" (1 file)`;
        toast(`Imported "${projName}"`, 'ok');
        await FileTree.loadProjects();
        await FileTree.openProject(projName);
        closeModal('import-modal');
        document.getElementById('inp-import-name').value = '';
      } catch(e) {
        hideLoading();
        msgEl.className = 'msg-ok err'; msgEl.textContent = e.message;
        toast('Import error: ' + e.message, 'err');
      }
      return;
    }

    msgEl.className = 'msg-ok'; msgEl.textContent = 'Importing...';
    showLoading('Importing ' + file.name + '...');
    try {
      const r = await API.importZip(file, name);
      hideLoading();
      if (r.error) {
        msgEl.className = 'msg-ok err'; msgEl.textContent = r.error;
        toast('Import failed: ' + r.error, 'err');
      } else {
        msgEl.className = 'msg-ok';
        msgEl.textContent = `Imported "${r.projectName}" (${r.filesExtracted} files)`;
        toast(`Imported "${r.projectName}"`, 'ok');
        await FileTree.loadProjects();
        await FileTree.openProject(r.projectName);
        closeModal('import-modal');
        document.getElementById('inp-import-name').value = '';
      }
    } catch (e) {
      hideLoading();
      msgEl.className = 'msg-ok err'; msgEl.textContent = e.message;
      toast('Import error: ' + e.message, 'err');
    }
  }
};

/* ============================================================
   RUN BUTTON
   ============================================================ */
async function initRunBtn() {
  document.getElementById('btn-run')?.addEventListener('click', async () => {
    if (!FileTree.project) return toast('No project open', 'wrn');
    MobNav.show('terminal');
    document.getElementById('terminal-wrap').classList.remove('collapsed');
    try {
      const { tree } = await API.getTree(FileTree.project);
      const names = flatTree(tree).map(f => f.name);
      let cmd = '';
      if (names.includes('package.json')) cmd = 'npm start 2>&1 || node index.js 2>&1 || node app.js 2>&1';
      else if (names.includes('app.py')) cmd = 'python3 app.py';
      else if (names.includes('main.py')) cmd = 'python3 main.py';
      else if (names.includes('index.html')) { cmd = 'python3 -m http.server 8080'; toast('HTTP server starting on :8080', 'inf'); }
      else if (names.includes('index.js')) cmd = 'node index.js';
      else if (names.includes('app.js')) cmd = 'node app.js';
      else return toast('Cannot detect project type. Run manually in terminal.', 'wrn');
      TermMgr.runFallback(cmd);
      OutputLog.append('[Run] ' + cmd, 'cmd');
      BottomPanel.show('output');
    } catch (e) { toast('Run error: ' + e.message, 'err'); }
  });
}

// Output log helper — appends to the Output panel tab
const OutputLog = {
  append(text, type = 'out') {
    const log = document.getElementById('output-log');
    const ph = document.getElementById('output-placeholder');
    if (!log) return;
    if (ph) ph.style.display = 'none';
    const line = document.createElement('div');
    line.className = 'out-line out-' + type;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  },
  clear() {
    const log = document.getElementById('output-log');
    const ph = document.getElementById('output-placeholder');
    if (log) log.innerHTML = '';
    if (ph) ph.style.display = '';
  }
};
window.OutputLog = OutputLog;

/* ============================================================
   GLOBAL KEYBOARD SHORTCUTS
   ============================================================ */
function initKeys() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); SettingsMgr.load(); openModal('settings-modal'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); FileTree.promptNew('file', ''); }

    // Activity bar shortcuts advertised in the button tooltips but never
    // actually bound — Explorer/Search/Source Control were dead keybinds.
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      ActivityBar.show('explorer');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      ActivityBar.show('search');
      setTimeout(() => document.getElementById('sb-search-input')?.focus(), 60);
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
      e.preventDefault();
      ActivityBar.show('git');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      ActivityBar.toggleAgents();
    }
    // Chat sessions shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
      // Only if chat panel is active and not in an input
      const chatPanel = document.getElementById('chat-panel');
      if (chatPanel?.classList.contains('active') && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        if (typeof ChatSessions !== 'undefined') ChatSessions.open();
      }
    }
  });
}

/* ============================================================
   MODAL CLOSE BUTTONS
   ============================================================ */
function initModals() {
  document.querySelectorAll('.modal-x').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.target));
  });
  document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.add('hidden'); });
  });
  // Command palette overlay click-outside
  document.getElementById('cmd-palette')?.addEventListener('click', e => {
    if (e.target === document.getElementById('cmd-palette')) CmdPalette.close();
  });
}

/* ============================================================
   CLOSE ALL TABS BUTTON
   ============================================================ */
function initEditorBtns() {
  document.getElementById('btn-close-all')?.addEventListener('click', () => EditorMgr.closeAll());
}

/* ============================================================
   SPLASH → APP
   ============================================================ */
function hideSplash() {
  const splash = document.getElementById('splash');
  splash.classList.add('out');
  setTimeout(() => { splash.classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); }, 450);
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // Splash dismissal is scheduled up front and unconditionally — previously
  // it sat at the end of this whole block, so any module below that threw
  // synchronously (e.g. a blocked CDN inside EditorMgr.init()) would leave
  // the user stuck on the splash screen forever with no visible error.
  setTimeout(hideSplash, 1300);

  try {
    // Init all modules
    try { FileTree.init(); } catch(e) { console.error('[FileTree]', e.message); }
    try { EditorMgr.init(); } catch(e) { console.error('[EditorMgr]', e.message); }
    try { TermMgr.init(); } catch(e) { console.error('[TermMgr]', e.message); }
    try { ChatMgr.init(); } catch(e) { console.error('[ChatMgr]', e.message); }
    if (typeof SkillsMgr !== 'undefined') try { SkillsMgr.init(); } catch(e) { console.error('[SkillsMgr]', e.message); }
    try { PreviewMgr.init(); } catch(e) { console.error('[PreviewMgr]', e.message); }
    try { CmdPalette.init(); } catch(e) { console.error('[CmdPalette]', e.message); }
    if (typeof QuickOpen !== 'undefined') try { QuickOpen.init(); } catch(e) { console.error('[QuickOpen]', e.message); }
    if (typeof ThemeMgr !== 'undefined') try { ThemeMgr.init(); } catch(e) { console.error('[ThemeMgr]', e.message); }
    if (typeof VoiceInput !== 'undefined') try { VoiceInput.init(); } catch(e) { console.error('[VoiceInput]', e.message); }
    try { if (typeof AICompletions !== 'undefined') AICompletions.init(); } catch(e) { console.warn('[AICompletions]', e.message); }
    try { if (typeof AICodeActions !== 'undefined') AICodeActions.init(); } catch(e) { console.warn('[AICodeActions]', e.message); }
    try { if (typeof AITerminal !== 'undefined') AITerminal.init(); } catch(e) { console.warn('[AITerminal]', e.message); }
    try { if (typeof AIReview !== 'undefined') AIReview.init(); } catch(e) { console.warn('[AIReview]', e.message); }
    try { if (typeof AIExplainTooltip !== 'undefined') AIExplainTooltip.init(); } catch(e) { console.warn('[AIExplainTooltip]', e.message); }
    try { if (typeof AIRefactorInline !== 'undefined') AIRefactorInline.init(); } catch(e) { console.warn('[AIRefactorInline]', e.message); }
    try { if (typeof AIInline !== 'undefined') AIInline.init(); } catch(e) { console.warn('[AIInline]', e.message); }
    try { if (typeof ShortcutsPanel !== 'undefined') ShortcutsPanel.init(); } catch(e) { console.warn('[ShortcutsPanel]', e.message); }
    try { if (typeof Breadcrumb !== 'undefined') Breadcrumb.init(); } catch(e) { console.warn('[Breadcrumb]', e.message); }
    try { if (typeof VoiceCommands !== 'undefined') VoiceCommands.init(); } catch(e) { console.warn('[VoiceCommands]', e.message); }
    try { if (typeof TerminalThemes !== 'undefined') TerminalThemes.syncWithEditor(); } catch(e) { console.warn('[TerminalThemes]', e.message); }
    try { MobNav.init(); } catch(e) { console.error('[MobNav]', e.message); }
    try { ActivityBar.init(); } catch(e) { console.error('[ActivityBar]', e.message); }
    try { BottomPanel.init(); } catch(e) { console.error('[BottomPanel]', e.message); }
    try { StatusBar.init(); } catch(e) { console.error('[StatusBar]', e.message); }
    try { FullscreenMgr.init(); } catch(e) { console.error('[FullscreenMgr]', e.message); }
    try { MobFAB.init(); } catch(e) { console.error('[MobFAB]', e.message); }
    try { SettingsMgr.init(); } catch(e) { console.error('[SettingsMgr]', e.message); }
    try { ExportMgr.init(); } catch(e) { console.error('[ExportMgr]', e.message); }
    try { ImportMgr.init(); } catch(e) { console.error('[ImportMgr]', e.message); }

    // Wire search sidebar (full project-wide search panel)
    if (window.GlobalSearch) try { GlobalSearch.init(); } catch(e) { console.error('[GlobalSearch]', e.message); }
    try { MediaMgr.init(); } catch(e) { console.error('[MediaMgr]', e.message); }
    try { initVibeFeatures(); } catch(e) { console.error('[Vibe]', e.message); }
    try { Resizer.init(); } catch(e) { console.error('[Resizer]', e.message); }
    try { initRunBtn(); } catch(e) { console.error('[RunBtn]', e.message); }
    try { initKeys(); } catch(e) { console.error('[Keys]', e.message); }
    try { initModals(); } catch(e) { console.error('[Modals]', e.message); }
    try { initEditorBtns(); } catch(e) { console.error('[EditorBtns]', e.message); }

    // Restore workspace after everything is initialized
    if (typeof EditorMgr !== 'undefined') {
      EditorMgr.restoreWorkspace();
      // Restore tabs after a short delay to allow FileTree to load
      setTimeout(() => EditorMgr._doRestore(), 500);
    }

    if (typeof Providers !== 'undefined') try { Providers.init(); } catch(e) { console.error('[Providers]', e.message); }
    if (typeof OllamaMgr !== 'undefined') try { OllamaMgr.init(); } catch(e) { console.error('[OllamaMgr]', e.message); }
    if (typeof OllamaPanel !== 'undefined') try { OllamaPanel.init(); } catch(e) { console.error('[OllamaPanel]', e.message); }
    if (typeof AgentsMgr !== 'undefined') try { AgentsMgr.init(); } catch(e) { console.error('[AgentsMgr]', e.message); }

    // Wire up vibe toolbar buttons in chat
    document.getElementById('btn-snippets')?.addEventListener('click', () => SnippetsMgr.open());
    document.getElementById('btn-findreplace')?.addEventListener('click', () => FindReplace.open());
    document.getElementById('btn-upload-asset-chat')?.addEventListener('click', () => {
      if (!FileTree.project) return toast('Open a project first', 'wrn');
      document.getElementById('asset-dest-folder').value = 'assets';
      document.getElementById('asset-rename-inp').value = '';
      document.getElementById('asset-import-msg').textContent = '';
      openModal('asset-import-modal');
    });

    // Upload btn in the ciub bar (same asset-import-modal logic)
    document.getElementById('btn-upload-asset-ciub')?.addEventListener('click', () => {
      if (!FileTree.project) return toast('Open a project first', 'wrn');
      document.getElementById('asset-dest-folder').value = 'assets';
      document.getElementById('asset-rename-inp').value = '';
      document.getElementById('asset-import-msg').textContent = '';
      openModal('asset-import-modal');
    });

    // Editor toolbar: Save, Undo, Redo, Diff/Revert
    document.getElementById('btn-save-file')?.addEventListener('click', () => {
      EditorMgr.save();
    });
    document.getElementById('btn-editor-undo')?.addEventListener('click', () => {
      if (EditorMgr.editor) EditorMgr.editor.trigger('keyboard', 'undo', null);
    });
    document.getElementById('btn-editor-redo')?.addEventListener('click', () => {
      if (EditorMgr.editor) EditorMgr.editor.trigger('keyboard', 'redo', null);
    });
    document.getElementById('btn-editor-diff')?.addEventListener('click', () => {
      const path = EditorMgr.active;
      if (!path) return toast('No file open', 'wrn');
      // Try snapshot revert first, else open diff modal if available
      if (SnapshotMgr.has(path)) {
        const prev = SnapshotMgr.pop(path);
        if (prev !== null) {
          EditorMgr.setValue(prev);
          toast('Reverted to previous snapshot', 'ok');
        } else {
          toast('No earlier snapshot available', 'wrn');
        }
      } else if (DiffViewer._orig && DiffViewer._new) {
        openModal('diff-modal');
      } else {
        toast('No diff or snapshot available for this file', 'wrn');
      }
    });

    // Init model picker with saved model
    try { ModelPicker.init(); } catch(e) { console.error('[ModelPicker]', e.message); }

    // Show API key reminder if not set
    if (!Cfg.get('apiKey', '')) {
      setTimeout(() => toast('Set your OpenRouter API key in Settings to use AI features', 'wrn', 6000), 1500);
    }
  } catch (err) {
    // A single module failing to init should never strand the user on the
    // splash screen or silently break the rest of the app — surface it.
    console.error('[OrinIDE] Boot sequence error:', err);
    setTimeout(() => toast('Some features failed to load — check the console for details', 'err', 6000), 1500);
  }

});

// ======= MOBILE FAB MENU =======
const MobFAB = {
  _open: false,
  _dragging: false,
  _dragMoved: false,

  init() {
    this._makeDraggable();
    this._restorePosition();
  },

  toggle() {
    if (this._dragMoved) { this._dragMoved = false; return; } // swallow tap after drag
    this._open = !this._open;
    const btn  = document.getElementById('mob-fab-btn');
    const menu = document.getElementById('mob-fab-menu');
    if (this._open) { btn.classList.add('open');  menu.classList.add('visible'); }
    else            { btn.classList.remove('open'); menu.classList.remove('visible'); }
  },

  close() { if (this._open) this.toggle(); },

  run(action) {
    this.close();
    switch(action) {
      case 'run':      document.getElementById('btn-run')?.click(); break;
      case 'settings': openModal('settings-modal'); break;
      case 'project':  openModal('project-modal'); break;
      case 'import':   document.getElementById('global-zip-input')?.click(); break;
      case 'export':   document.getElementById('btn-export')?.click(); break;
      case 'preview':  document.getElementById('btn-preview')?.click(); break;
      case 'features': FeatureHub.toggle(); break;
      case 'model':    openModal('model-health-modal'); if(typeof ModelHealth !== 'undefined') ModelHealth.init(); break;
    }
  },

  _makeDraggable() {
    const fab = document.getElementById('mob-fab');
    const btn = document.getElementById('mob-fab-btn');
    if (!fab || !btn) return;

    let startX, startY, startRight, startBottom;
    const DRAG_THRESHOLD = 6; // px — below this is a tap not a drag

    const onStart = e => {
      if (e.target.closest('#mob-fab-menu')) return; // don't drag when interacting with menu
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;

      // Read current position
      const style = window.getComputedStyle(fab);
      startRight  = parseInt(style.right)  || 12;
      startBottom = parseInt(style.bottom) || 72;

      fab.classList.add('dragging');
      this._dragging = false;
      this._dragMoved = false;

      document.addEventListener('mousemove', onMove, { passive: false });
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('mouseup',   onEnd);
      document.addEventListener('touchend',  onEnd);
      // Don't preventDefault here — allow the click to fire if not dragged
    };

    const onMove = e => {
      const touch = e.touches ? e.touches[0] : e;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!this._dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      this._dragging = true;
      this._dragMoved = true;
      e.preventDefault();

      // Convert delta to right/bottom (FAB anchors from bottom-right)
      const newRight  = Math.max(4,  Math.min(window.innerWidth  - 54, startRight  - dx));
      const newBottom = Math.max(4,  Math.min(window.innerHeight - 54, startBottom + dy));

      fab.style.right  = newRight  + 'px';
      fab.style.bottom = newBottom + 'px';

      // Close menu while dragging
      if (this._open) {
        document.getElementById('mob-fab-menu')?.classList.remove('visible');
        btn.classList.remove('open');
        this._open = false;
      }
    };

    const onEnd = () => {
      fab.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup',   onEnd);
      document.removeEventListener('touchend',  onEnd);

      if (this._dragging) {
        // Save position
        const style = window.getComputedStyle(fab);
        try { localStorage.setItem('fabRight',  style.right); } catch{}
        try { localStorage.setItem('fabBottom', style.bottom); } catch{}
      }
      this._dragging = false;
    };

    btn.addEventListener('mousedown',  onStart);
    btn.addEventListener('touchstart', onStart, { passive: true });
  },

  _restorePosition() {
    const fab = document.getElementById('mob-fab');
    if (!fab) return;
    try {
      const r = localStorage.getItem('fabRight');
      const b = localStorage.getItem('fabBottom');
      if (r) fab.style.right  = r;
      if (b) fab.style.bottom = b;
    } catch {}
  }
};
window.MobFAB = MobFAB;

// Close FAB on outside click
document.addEventListener('click', e => {
  const fab = document.getElementById('mob-fab');
  if (fab && !fab.contains(e.target)) MobFAB.close();
});



// ======= CHAT MODE SWITCH =======
const ChatModeSwitch = {
  _mode: 'chat',
  set(mode, btn) {
    this._mode = mode;
    document.querySelectorAll('.cmode-btn').forEach(b => b.classList.remove('active'));
    if (btn && btn.classList) btn.classList.add('active');
    else {
      const id = mode === 'code' ? 'cmode-code' : mode === 'patch' ? 'cmode-patch' : 'cmode-chat';
      document.getElementById(id)?.classList.add('active');
    }
    if (window.ModeSwitch) {
      ModeSwitch.set(mode === 'code' ? 'generate' : mode === 'patch' ? 'patch' : 'chat');
    }
  },
  toggleTerminal() {
    if (typeof BottomPanel !== 'undefined') {
      BottomPanel.toggle();
      const btn = document.getElementById('btn-toggle-terminal-chat');
      const bp = document.getElementById('bottom-panel');
      const isVisible = bp && bp.style.display !== 'none' && !bp.classList.contains('hidden');
      if (btn) btn.classList.toggle('active', isVisible);
      if (MobNav.isPortrait()) {
        MobNav.show(isVisible ? 'terminal' : 'editor');
      }
    } else {
      // Legacy fallback
      const btn = document.getElementById('btn-toggle-terminal-chat');
      const termWrap = document.getElementById('terminal-wrap');
      if (!termWrap) return;
      const isHidden = termWrap.classList.contains('hidden') || termWrap.style.display === 'none';
      if (isHidden) {
        termWrap.classList.remove('hidden');
        btn && btn.classList.add('active');
        if (MobNav.isPortrait()) {
          MobNav.show('terminal');
        } else {
          termWrap.style.display = '';
        }
      } else {
        if (MobNav.isPortrait()) {
          MobNav.show('editor');
        } else {
          termWrap.classList.add('hidden');
        }
        btn && btn.classList.remove('active');
      }
    }
  }
};
window.ChatModeSwitch = ChatModeSwitch;

/* AgentTask is defined once, in orin_patches.js, and wires the agents-send
   button there too. The earlier duplicate `const AgentTask = {...}` block
   that used to live here was removed: it redeclared the same identifier,
   which crashed script parsing, and its click handler double-fired the
   agent run on every send since both copies listened on the same button. */
