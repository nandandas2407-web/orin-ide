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
    ['sidebar', 'center', 'chat-panel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active'); el.style.display = ''; el.style.position = ''; el.style.inset = ''; }
    });
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

    ['sidebar', 'center', 'chat-panel'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    const map = { sidebar: 'sidebar', editor: 'center', chat: 'chat-panel', terminal: 'center' };
    document.getElementById(map[panel])?.classList.add('active');

    const ew = document.getElementById('editor-wrap');
    const tw = document.getElementById('terminal-wrap');
    if (panel === 'terminal') {
      if (ew) ew.style.display = 'none';
      if (tw) { tw.style.display = 'flex'; tw.style.height = '100%'; tw.style.maxHeight = 'unset'; tw.style.minHeight = 'unset'; tw.style.borderTop = 'none'; tw.classList.remove('collapsed'); }
    } else if (panel === 'editor') {
      if (ew) ew.style.display = '';
      if (tw) { tw.style.display = 'none'; tw.style.height = ''; tw.style.maxHeight = ''; tw.style.minHeight = ''; tw.style.borderTop = ''; }
    } else {
      if (ew) ew.style.display = '';
      if (tw) tw.style.display = '';
    }
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
  _PRESETS: {
    'z-ai/glm-4.5-air:free': 'Glm-4.5-air',
    'tencent/hy3-preview:free': 'Tencent HY3',
    'openai/gpt-oss-120b:free': 'GPT-OSS 120B',
    'nvidia/nemotron-3-super-120b-a12b:free': 'Nemotron 120B',
    'google/gemma-3-27b-it:free': 'Gemma 3 27B',
    'poolside/laguna-xs.2:free': 'laguna xs.2',
    'openrouter/free': 'openrouter/free',
    'anthropic/claude-opus-4.6': 'Claude opus 4.6',
    'openai/gpt-5.5': 'GPT-5.5',
    'deepseek/deepseek-v4-pro': 'Deepseek-v4-pro',
  },

  init() {
    // Load saved model (accept any string — no whitelist restriction)
    const saved = Cfg.get('model', 'openrouter/free');
    this._applyToUI(saved);

    // Topbar button toggle
    const btn = document.getElementById('model-picker-btn');
    const dd  = document.getElementById('model-picker-dropdown');
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); this._toggle(); });

    // Preset option clicks
    document.querySelectorAll('.mpd-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const val   = opt.dataset.value;
        const label = opt.dataset.label || val;
        this.setModel(val, label);
        this._close();
      });
    });

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

    // Close on outside click
    document.addEventListener('click', e => {
      const dd = document.getElementById('model-picker-dropdown');
      const wrap = document.getElementById('model-picker-wrap');
      if (dd && !dd.classList.contains('hidden') && wrap && !wrap.contains(e.target)) this._close();
    });

    // Prevent dropdown scroll from closing
    const ddEl = document.getElementById('model-picker-dropdown');
    if (ddEl) ddEl.addEventListener('click', e => e.stopPropagation());
  },

  setModel(value, label) {
    Cfg.set('model', value);
    this._applyToUI(value, label);
    ChatMgr._updateBadge(value);
  },

  getModel() {
    return Cfg.get('model', 'openrouter/free');
  },

  _applyToUI(value, label) {
    // Derive label from presets or use value itself
    const lbl = label || this._PRESETS[value] || this._shortLabel(value);

    // Topbar button label
    const labelEl = document.getElementById('model-picker-label');
    if (labelEl) labelEl.textContent = lbl;

    // Mark active preset
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

  _toggle() {
    const dd  = document.getElementById('model-picker-dropdown');
    const btn = document.getElementById('model-picker-btn');
    if (!dd) return;
    const isOpen = !dd.classList.contains('hidden');
    if (isOpen) { this._close(); } else { this._open(); }
  },

  _open() {
    const dd  = document.getElementById('model-picker-dropdown');
    const btn = document.getElementById('model-picker-btn');
    if (!dd) return;
    dd.classList.remove('hidden');
    if (btn) btn.classList.add('open');
    // Flip above if not enough space below
    requestAnimationFrame(() => {
      const rect = dd.getBoundingClientRect();
      if (rect.bottom > window.innerHeight - 8) {
        dd.style.top = 'auto';
        dd.style.bottom = 'calc(100% + 5px)';
      } else {
        dd.style.top = '';
        dd.style.bottom = '';
      }
      // Keep within left viewport edge
      if (rect.left < 8) {
        dd.style.right = 'auto';
        dd.style.left = '0';
      }
    });
  },

  _close() {
    const dd  = document.getElementById('model-picker-dropdown');
    const btn = document.getElementById('model-picker-btn');
    if (dd)  dd.classList.add('hidden');
    if (btn) btn.classList.remove('open');
  }
};

const SettingsMgr = {
  init() {
    document.getElementById('btn-settings').addEventListener('click', () => { this.load(); openModal('settings-modal'); });
    document.getElementById('btn-save-settings').addEventListener('click', () => this.save());

    // Settings quick-preset buttons
    document.querySelectorAll('.s-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        document.getElementById('s-model').value = val;
      });
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
    document.getElementById('s-exportpath').value = s.exportPath || '/storage/emulated/0/';
  },

  save() {
    const s = {
      apiKey: document.getElementById('s-apikey').value.trim(),
      model: (document.getElementById('s-model').value || '').trim() || 'openrouter/free',
      fontSize: parseInt(document.getElementById('s-fontsize').value) || 14,
      tabSize: parseInt(document.getElementById('s-tabsize').value) || 2,
      wordWrap: document.getElementById('s-wordwrap').checked,
      minimap: document.getElementById('s-minimap').checked,
      autosave: document.getElementById('s-autosave').checked,
      exportPath: document.getElementById('s-exportpath').value.trim()
    };
    Cfg.save(s);
    EditorMgr.applySettings(s);
    ModelPicker.setModel(s.model, s.model);
    closeModal('settings-modal');
    toast('Settings saved', 'ok', 1200);
  }
};

/* ============================================================
   EXPORT MANAGER
   ============================================================ */
const ExportMgr = {
  init() {
    document.getElementById('btn-export').addEventListener('click', () => {
      if (!FileTree.project) return toast('No project open', 'wrn');
      document.getElementById('export-proj-name').textContent = FileTree.project;
      openModal('export-modal');
    });
    document.getElementById('btn-dl-zip').addEventListener('click', () => {
      if (!FileTree.project) return;
      const a = document.createElement('a');
      a.href = API.exportZipUrl(FileTree.project);
      a.download = FileTree.project + '.zip';
      a.click();
      toast('Downloading ZIP...', 'ok');
    });
    document.getElementById('btn-export-termux').addEventListener('click', async () => {
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
    document.getElementById('btn-import').addEventListener('click', () => {
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
    document.getElementById('dropzone').addEventListener('click', () => {
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
    const name = document.getElementById('inp-import-name').value.trim();
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
  document.getElementById('btn-run').addEventListener('click', async () => {
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
    } catch (e) { toast('Run error: ' + e.message, 'err'); }
  });
}

/* ============================================================
   GLOBAL KEYBOARD SHORTCUTS
   ============================================================ */
function initKeys() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); SettingsMgr.load(); openModal('settings-modal'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); FileTree.promptNew('file', ''); }
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
  document.getElementById('btn-close-all').addEventListener('click', () => EditorMgr.closeAll());
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
  // Init all modules
  FileTree.init();
  EditorMgr.init();
  TermMgr.init();
  ChatMgr.init();
  if (typeof SkillsMgr !== 'undefined') SkillsMgr.init();
  PreviewMgr.init();
  CmdPalette.init();
  MobNav.init();
  FullscreenMgr.init();
  MobFAB.init();
  SettingsMgr.init();
  ExportMgr.init();
  ImportMgr.init();
  MediaMgr.init();
  initVibeFeatures();
  Resizer.init();
  initRunBtn();
  initKeys();
  initModals();
  initEditorBtns();

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
  ModelPicker.init();

  // Show API key reminder if not set
  if (!Cfg.get('apiKey', '')) {
    setTimeout(() => toast('Set your OpenRouter API key in Settings to use AI features', 'wrn', 6000), 1500);
  }

  // Hide splash after minimum delay
  setTimeout(hideSplash, 1300);

  console.log('OrinIDE ready');
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
      case 'features': if(typeof FeaturesPanel !== 'undefined') FeaturesPanel.open(); break;
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
    btn.classList.add('active');
    // Switch chat placeholder and visible features
    const input = document.getElementById('chat-input');
    const modesRow = document.querySelector('.chat-modes');
    if (mode === 'code') {
      if (input) input.placeholder = 'Describe code to generate or edit...';
      // auto-select "generate" mode
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === 'generate');
      });
    } else {
      if (input) input.placeholder = 'Ask AI to generate code, explain, or modify files...';
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === 'chat');
      });
    }
  },
  toggleTerminal() {
    const btn = document.getElementById('btn-toggle-terminal-chat');
    const termWrap = document.getElementById('terminal-wrap');
    if (!termWrap) return;
    const isHidden = termWrap.classList.contains('hidden') || termWrap.style.display === 'none';
    if (isHidden) {
      termWrap.classList.remove('hidden');
      btn && btn.classList.add('active');
      // On mobile, switch to the dedicated terminal tab
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
};
