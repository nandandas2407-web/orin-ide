'use strict';
/* ================================================================
   ORINIDE EXTENDED FEATURES+
   - Model Health Checker
   - AI Explain Selection
   - AI Refactor Selection
   - Chat Sessions (multi-session history)
   - AI Generate Tests
   - AI Add Comments / Documentation
   - Context Menu AI Actions (right-click editor)
   - Token Usage Estimator
   ================================================================ */

/* ---- MODELS LIST ---- */
const ALL_FREE_MODELS = [
  { id: 'z-ai/glm-4.5-air:free',                                       label: 'Glm-4.5-air' },
  { id: 'tencent/hy3-preview:free',                                        label: 'Tencent HY3' },
  { id: 'openai/gpt-oss-120b:free',                                        label: 'GPT-OSS 120B' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',   label: 'Nemotron 120B' },
  { id: 'google/gemma-3-27b-it:free',                                      label: 'Gemma 3 27B' },
  { id: 'poolside/laguna-xs.2:free',                                           label: 'laguna-xs.2' },
  { id: 'openrouter/free',                                      label: 'openrouter/free' },

];

/* ================================================================
   MODEL HEALTH CHECKER
   ================================================================ */
const ModelHealth = {
  init() {
    const sel = document.getElementById('health-model-select');
    if (!sel) return;
    if (sel.children.length === 0) {
      ALL_FREE_MODELS.forEach(m => {
        const o = document.createElement('option');
        o.value = m.id; o.textContent = m.label + ' — ' + m.id;
        sel.appendChild(o);
      });
      // Pre-select currently chosen model
      const cur = Cfg.get('model', 'openrouter/free');
      sel.value = cur;
    }
    const btn = document.getElementById('btn-health-run');
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener('click', () => ModelHealth.run());
    }
  },

  async run() {
    const sel = document.getElementById('health-model-select');
    const out = document.getElementById('health-result');
    const apiKey = Cfg.get('apiKey', '');
    if (!apiKey) { out.textContent = '❌ No API key set. Go to Settings first.'; return; }
    const model = sel.value;
    out.textContent = `⏳ Testing: ${model}\n...`;
    const t0 = Date.now();
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': location.origin, 'X-Title': 'OrinIDE' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 10, stream: false })
      });
      const elapsed = Date.now() - t0;
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        out.textContent = `❌ Error ${res.status}: ${e.error?.message || 'Model unavailable'}\n⏱ ${elapsed}ms`;
        return;
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '(empty response)';
      out.textContent = `Model is WORKING!\nResponse: "${reply.trim()}"\n⏱ Latency: ${elapsed}ms`;
    } catch (err) {
      out.textContent = `❌ Network error: ${err.message}`;
    }
  }
};

/* ================================================================
   HELPER: Get selected text from Monaco editor (uses EditorMgr API)
   ================================================================ */
function getSelectedCode() {
  if (!window.EditorMgr) return null;
  // Prefer selection
  if (typeof EditorMgr.getSelected === 'function') {
    const sel = EditorMgr.getSelected();
    if (sel && sel.trim()) return sel;
  }
  // Fallback: full file
  if (typeof EditorMgr.getValue === 'function') return EditorMgr.getValue();
  return null;
}

function replaceSelectedCode(newCode) {
  if (!window.EditorMgr) return false;
  // Try to replace selection via Monaco instance
  if (EditorMgr.instance) {
    const mon = EditorMgr.instance;
    const sel = mon.getSelection();
    if (sel && !mon.getSelection().isEmpty()) {
      mon.executeEdits('ai-feature', [{ range: sel, text: newCode }]);
      return true;
    }
  }
  // Fallback: replace all
  if (typeof EditorMgr.setValue === 'function') { EditorMgr.setValue(newCode); return true; }
  return false;
}

/* ================================================================
   AI EXPLAIN
   ================================================================ */
const AIExplain = {
  async run() {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select some code first, then use AI → Explain', 'wrn'); return; }
    openModal('ai-explain-modal');
    const out = document.getElementById('ai-explain-out');
    out.innerHTML = '<em>⏳ Analyzing code...</em>';
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: 'You are a senior developer. Explain the following code clearly and concisely. Use plain language, mention what it does, edge cases, and any potential improvements.' },
        { role: 'user', content: '```\n' + code + '\n```\nExplain this code.' }
      ], (delta, acc) => {
        full = acc;
        out.innerHTML = renderMD(acc);
      });
      if (!full) out.innerHTML = '<em style="color:var(--acc)">No response. Check your API key and model.</em>';
    } catch (e) {
      out.innerHTML = `<span style="color:#f55">Error: ${esc(e.message)}</span>`;
    }
  }
};

/* ================================================================
   AI REFACTOR
   ================================================================ */
const AIRefactor = {
  _lastCode: null,

  open() {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select some code first', 'wrn'); return; }
    openModal('ai-refactor-modal');
    const out = document.getElementById('ai-refactor-out');
    out.textContent = 'Awaiting refactor instruction...';
    document.getElementById('btn-refactor-apply').style.display = 'none';
    this._lastCode = null;
    document.getElementById('refactor-prompt').focus();
  },

  async run() {
    const code = getSelectedCode();
    const instruction = document.getElementById('refactor-prompt').value.trim();
    if (!code || !code.trim()) { toast('No code selected', 'wrn'); return; }
    if (!instruction) { toast('Enter a refactor instruction', 'wrn'); return; }
    const out = document.getElementById('ai-refactor-out');
    const applyBtn = document.getElementById('btn-refactor-apply');
    out.textContent = '⏳ Refactoring...';
    applyBtn.style.display = 'none';
    this._lastCode = null;
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: 'You are an expert code refactoring assistant. Return ONLY the refactored code, no explanations, no markdown fences. Just the raw code.' },
        { role: 'user', content: `Instruction: ${instruction}\n\nCode to refactor:\n${code}` }
      ], (delta, acc) => {
        full = acc;
        // Strip possible markdown fences in real time
        out.textContent = acc.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
      });
      // Clean fences from final result
      this._lastCode = full.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      out.textContent = this._lastCode;
      applyBtn.style.display = 'inline-block';
    } catch (e) {
      out.textContent = `Error: ${e.message}`;
    }
  },

  apply() {
    if (!this._lastCode) { toast('Nothing to apply', 'wrn'); return; }
    const ok = replaceSelectedCode(this._lastCode);
    if (ok) { toast('Refactored code applied ✓', 'ok'); closeModal('ai-refactor-modal'); }
    else toast('Could not apply — click inside the editor first', 'wrn');
  }
};

/* ================================================================
   AI GENERATE TESTS
   ================================================================ */
const AIGenerateTests = {
  async run() {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select code to generate tests for', 'wrn'); return; }
    showLoading('Generating tests...');
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: 'You are an expert test engineer. Generate comprehensive unit tests for the given code. Use the appropriate test framework (Jest for JS/TS, pytest for Python, etc.). Return only the test code with no explanation.' },
        { role: 'user', content: 'Generate tests for:\n```\n' + code + '\n```' }
      ], (delta, acc) => { full = acc; });
      hideLoading();
      if (full.trim()) {
        // Inject generated tests into chat input for review
        const inp = document.getElementById('chat-input');
        if (inp) {
          inp.value = 'Here are the generated tests. Please review and apply:\n\n' + full;
          inp.dispatchEvent(new Event('input'));
        }
        toast('Tests generated — review in chat ✓', 'ok');
      }
    } catch (e) {
      hideLoading();
      toast('Error: ' + e.message, 'err');
    }
  }
};

/* ================================================================
   AI ADD COMMENTS / DOCS
   ================================================================ */
const AIAddComments = {
  async run() {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select code to document', 'wrn'); return; }
    showLoading('Adding documentation...');
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: 'You are a documentation expert. Add clear, concise JSDoc/docstring comments to the given code. Preserve all existing code exactly — only add comments. Return only the commented code, no markdown fences.' },
        { role: 'user', content: 'Add documentation comments to:\n' + code }
      ], (delta, acc) => { full = acc; });
      hideLoading();
      const cleaned = full.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      const ok = replaceSelectedCode(cleaned);
      if (ok) toast('Documentation comments added ✓', 'ok');
      else { toast('Could not auto-apply. Check chat.', 'wrn'); }
    } catch (e) {
      hideLoading();
      toast('Error: ' + e.message, 'err');
    }
  }
};

/* ================================================================
   AI FIX BUGS
   ================================================================ */
const AIFixBugs = {
  async run() {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select code to fix', 'wrn'); return; }
    showLoading('Finding and fixing bugs...');
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: 'You are an expert debugger. Find and fix all bugs, logic errors, and potential runtime errors in the given code. Return ONLY the fixed code with no explanations or markdown fences.' },
        { role: 'user', content: 'Fix bugs in:\n' + code }
      ], (delta, acc) => { full = acc; });
      hideLoading();
      const cleaned = full.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      const ok = replaceSelectedCode(cleaned);
      if (ok) toast('Bugs fixed and applied ✓', 'ok');
    } catch (e) {
      hideLoading();
      toast('Error: ' + e.message, 'err');
    }
  }
};

/* ================================================================
   AI OPTIMIZE PERFORMANCE
   ================================================================ */
const AIOptimize = {
  async run() {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select code to optimize', 'wrn'); return; }
    showLoading('Optimizing...');
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: 'You are a performance optimization expert. Optimize the given code for speed, memory efficiency, and best practices. Return ONLY the optimized code with no explanations or markdown fences.' },
        { role: 'user', content: 'Optimize:\n' + code }
      ], (delta, acc) => { full = acc; });
      hideLoading();
      const cleaned = full.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      const ok = replaceSelectedCode(cleaned);
      if (ok) toast('Optimized and applied ✓', 'ok');
    } catch (e) {
      hideLoading();
      toast('Error: ' + e.message, 'err');
    }
  }
};

/* ================================================================
   AI TRANSLATE CODE (to another language)
   ================================================================ */
const AITranslate = {
  async run(targetLang) {
    const code = getSelectedCode();
    if (!code || !code.trim()) { toast('Select code to translate', 'wrn'); return; }
    if (!targetLang) {
      targetLang = prompt('Translate to which language? (e.g. Python, TypeScript, Go, Rust)');
      if (!targetLang) return;
    }
    showLoading(`Translating to ${targetLang}...`);
    try {
      let full = '';
      await API.callAI([
        { role: 'system', content: `You are a polyglot code translator. Translate the given code to ${targetLang} accurately, preserving all logic. Return ONLY the translated code, no markdown fences.` },
        { role: 'user', content: `Translate to ${targetLang}:\n` + code }
      ], (delta, acc) => { full = acc; });
      hideLoading();
      const cleaned = full.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      const ok = replaceSelectedCode(cleaned);
      if (ok) toast(`Translated to ${targetLang} ✓`, 'ok');
    } catch (e) {
      hideLoading();
      toast('Error: ' + e.message, 'err');
    }
  }
};

/* ================================================================
   TOKEN ESTIMATOR
   ================================================================ */
const TokenEstimator = {
  estimate(text) {
    // Rough approximation: ~4 chars per token
    return Math.ceil((text || '').length / 4);
  },

  showForCurrentFile() {
    if (!window.EditorMgr || typeof EditorMgr.getValue !== 'function') {
      toast('No file open', 'wrn'); return;
    }
    const code = EditorMgr.getValue();
    const tokens = this.estimate(code);
    const chars = code.length;
    const lines = code.split('\n').length;
    toast(`~${tokens.toLocaleString()} tokens | ${chars.toLocaleString()} chars | ${lines.toLocaleString()} lines`, 'inf', 5000);
  }
};

/* ================================================================
   CHAT SESSIONS (multi-session storage)
   ================================================================ */
const ChatSessions = {
  _KEY: 'ci_chat_sessions',
  _ACTIVE: 'ci_active_session',

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

  createSession(name) {
    const sessions = this.getSessions();
    const id = 'session_' + Date.now();
    sessions[id] = { id, name: name || 'Session ' + Object.keys(sessions).length, history: [], created: Date.now() };
    this.saveSessions(sessions);
    return id;
  },

  saveCurrentHistory(history) {
    const sessions = this.getSessions();
    const id = this.getActiveId();
    if (!sessions[id]) sessions[id] = { id, name: 'Default', history: [], created: Date.now() };
    sessions[id].history = history;
    sessions[id].updated = Date.now();
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

  open() {
    openModal('chat-sessions-modal');
    this.renderList();
  },

  renderList() {
    const container = document.getElementById('sessions-list');
    if (!container) return;
    const sessions = this.getSessions();
    const activeId = this.getActiveId();
    const keys = Object.keys(sessions).sort((a, b) => (sessions[b].updated || 0) - (sessions[a].updated || 0));

    if (!keys.length) {
      container.innerHTML = '<p style="color:var(--txt-dim);font-size:12px;padding:8px">No saved sessions. Create one above.</p>';
      return;
    }

    container.innerHTML = keys.map(id => {
      const s = sessions[id];
      const msgs = s.history?.length || 0;
      const isActive = id === activeId;
      const date = s.updated ? new Date(s.updated).toLocaleDateString() : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:4px;background:${isActive ? 'var(--acc-dim,rgba(100,200,100,0.1))' : 'var(--bg2)'};border-radius:6px;border:1px solid ${isActive ? 'var(--acc)' : 'transparent'}">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--tx0);font-weight:${isActive ? '600' : '400'}">${esc(s.name)}${isActive ? ' <span style="color:var(--acc);font-size:10px">● ACTIVE</span>' : ''}</div>
          <div style="font-size:11px;color:var(--txt-dim)">${msgs} messages${date ? ' · ' + date : ''}</div>
        </div>
        <button class="ib sm" onclick="ChatSessions.switchTo('${id}')" title="Switch to this session" style="${isActive ? 'opacity:0.4;pointer-events:none' : ''}">Load</button>
        <button class="ib sm" onclick="ChatSessions.deleteSession('${id}');ChatSessions.renderList()" title="Delete session" style="color:#f55">Del</button>
      </div>`;
    }).join('');
  },

  switchTo(id) {
    this.setActive(id);
    // Reload chat history into ChatMgr if it supports it
    if (window.ChatMgr && typeof ChatMgr.loadHistory === 'function') {
      ChatMgr.loadHistory(this.loadSession(id));
    } else {
      // Clear chat UI and reload messages from session
      const hist = this.loadSession(id);
      const body = document.getElementById('chat-body');
      if (body) {
        body.innerHTML = '';
        if (hist.length) {
          hist.forEach(m => {
            const div = document.createElement('div');
            div.className = 'msg ' + m.role;
            div.innerHTML = m.role === 'assistant' ? renderMD(m.content) : `<p>${esc(m.content)}</p>`;
            body.appendChild(div);
          });
          body.scrollTop = body.scrollHeight;
        }
      }
      toast(`Loaded session: ${this.getSessions()[id]?.name || id}`, 'ok');
    }
    closeModal('chat-sessions-modal');
  }
};

/* ================================================================
   CONTEXT MENU AI ACTIONS (injected into Monaco right-click)
   ================================================================ */
const ContextMenuAI = {
  _registered: false,

  register(monacoEditor) {
    if (this._registered) return;
    this._registered = true;

    // We inject after Monaco is ready by listening for the global event
    const actions = [
      { id: 'ai.explain',    label: 'AI: Explain Selection',        fn: () => AIExplain.run() },
      { id: 'ai.refactor',   label: 'AI: Refactor Selection',       fn: () => AIRefactor.open() },
      { id: 'ai.fix',        label: 'AI: Fix Bugs',                 fn: () => AIFixBugs.run() },
      { id: 'ai.optimize',   label: 'AI: Optimize Performance',      fn: () => AIOptimize.run() },
      { id: 'ai.comments',   label: 'AI: Add Comments/Docs',        fn: () => AIAddComments.run() },
      { id: 'ai.tests',      label: 'AI: Generate Tests',           fn: () => AIGenerateTests.run() },
      { id: 'ai.translate',  label: 'AI: Translate to Language',    fn: () => AITranslate.run() },
      { id: 'ai.tokens',     label: 'Token Count',      fn: () => TokenEstimator.showForCurrentFile() },
    ];

    if (monacoEditor && monacoEditor.addAction) {
      actions.forEach(a => {
        try {
          monacoEditor.addAction({
            id: a.id,
            label: a.label,
            contextMenuGroupId: 'ai_actions',
            contextMenuOrder: 1,
            run: a.fn
          });
        } catch (e) { /* editor may not support it */ }
      });
    }
  }
};

/* ================================================================
   EXTEND COMMAND PALETTE with new commands
   ================================================================ */
const ExtraCommands = [
  { label: 'AI: Explain Selection',        action: () => AIExplain.run() },
  { label: 'AI: Refactor Selection',       action: () => AIRefactor.open() },
  { label: 'AI: Fix Bugs in Selection',    action: () => AIFixBugs.run() },
  { label: 'AI: Optimize Selection',        action: () => AIOptimize.run() },
  { label: 'AI: Add Comments/Docs',        action: () => AIAddComments.run() },
  { label: 'AI: Generate Tests',           action: () => AIGenerateTests.run() },
  { label: 'AI: Translate Code',           action: () => AITranslate.run() },
  { label: 'Token Count',                  action: () => TokenEstimator.showForCurrentFile() },
  { label: 'Model Health Check',           action: () => { openModal('model-health-modal'); ModelHealth.init(); } },
  { label: 'Chat Sessions',               action: () => ChatSessions.open() },
];

/* ================================================================
   INITIALIZATION
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Wire up refactor modal buttons
  document.getElementById('btn-refactor-run')?.addEventListener('click', () => AIRefactor.run());
  document.getElementById('btn-refactor-apply')?.addEventListener('click', () => AIRefactor.apply());

  // Wire up new chat session button
  document.getElementById('btn-new-session')?.addEventListener('click', () => {
    const nameInp = document.getElementById('new-session-name');
    const name = (nameInp?.value || '').trim();
    if (!name) { toast('Enter a session name', 'wrn'); return; }
    const id = ChatSessions.createSession(name);
    ChatSessions.switchTo(id);
    if (nameInp) nameInp.value = '';
    ChatSessions.renderList();
    toast('New session created: ' + name, 'ok');
  });

  // Extend Command Palette with extra commands after it loads
  setTimeout(() => {
    if (window.CmdPalette && Array.isArray(CmdPalette.cmds)) {
      ExtraCommands.forEach(cmd => {
        const label = cmd.label;
        const fn = cmd.action;
        if (!CmdPalette.cmds.find(c => c.label === label)) {
          CmdPalette.cmds.push({ label, key: '', fn });
        }
      });
    }
  }, 2000);

  // Hook into EditorMgr to register context menu actions when monaco loads
  const tryRegisterCtxMenu = setInterval(() => {
    if (window.EditorMgr && EditorMgr.instance) {
      ContextMenuAI.register(EditorMgr.instance);
      clearInterval(tryRegisterCtxMenu);
    }
  }, 1500);

  // Status bar token count — update on editor content change
  setInterval(() => {
    const stStats = document.getElementById('st-stats');
    if (!stStats || !window.EditorMgr || typeof EditorMgr.getValue !== 'function') return;
    try {
      const code = EditorMgr.getValue() || '';
      const tokens = TokenEstimator.estimate(code);
      stStats.textContent = `~${tokens.toLocaleString()} tokens`;
      stStats.title = 'Approximate token count for current file';
    } catch {}
  }, 3000);

  console.log('OrinIDE Extended Features loaded ✓');
});

/* ================================================================
   FEATURES PANEL — toggle individual features on/off
   ================================================================ */
const FeaturesPanel = {
  _KEY: 'ci_features',

  _defaults: {
    'ai-tools': true, 'explain': true, 'refactor': true, 'fixbugs': true,
    'optimize': true, 'adddocs': true, 'gentests': true, 'translate': true,
    'tokens': true, 'health': true, 'sessions': true, 'preview': true,
    'asset': true, 'run': true, 'terminal': true, 'diff': true,
    'snapshot': true, 'findreplace': true, 'bigicons': true
  },

  _map: {
    'ai-tools':    () => document.querySelector('.chat-panel [style*="AI Tools"]')?.closest('div[style*="border-top"]'),
    'health':      () => document.getElementById('btn-model-health'),
    'sessions':    () => document.getElementById('btn-chat-sessions'),
    'preview':     () => document.getElementById('btn-preview'),
    'asset':       () => document.getElementById('btn-upload-asset'),
    'run':         () => document.getElementById('btn-run'),
    'terminal':    () => document.getElementById('terminal-wrap'),
    'findreplace': () => document.querySelector('[data-target="findreplace-modal"]')?.closest('button'),
  },

  load() {
    try { return JSON.parse(localStorage.getItem(this._KEY) || '{}'); } catch { return {}; }
  },

  save(state) {
    try { localStorage.setItem(this._KEY, JSON.stringify(state)); } catch {}
  },

  isEnabled(key) {
    const s = this.load();
    return s[key] !== undefined ? s[key] : (this._defaults[key] !== false);
  },

  toggle(key, val) {
    const s = this.load();
    s[key] = val;
    this.save(s);
    this._apply(key, val);
  },

  _apply(key, val) {
    const el = this._map[key] ? this._map[key]() : null;
    if (el) el.style.display = val ? '' : 'none';

    if (key === 'bigicons') {
      document.body.classList.toggle('mob-bigicons', val);
    }
    if (key === 'terminal' && !val) {
      const tw = document.getElementById('terminal-wrap');
      if (tw) tw.style.display = 'none';
    }
    if (key === 'terminal' && val) {
      const tw = document.getElementById('terminal-wrap');
      if (tw) tw.style.display = '';
    }
  },

  applyAll() {
    const s = this.load();
    Object.keys(this._defaults).forEach(k => {
      const val = s[k] !== undefined ? s[k] : this._defaults[k];
      this._apply(k, val);
    });
  },

  open() {
    openModal('features-panel-modal');
    const s = this.load();
    Object.keys(this._defaults).forEach(k => {
      const cb = document.getElementById('fp-' + k);
      if (cb) cb.checked = s[k] !== undefined ? s[k] : this._defaults[k];
    });
    // Sync auto-rotate state
    const arCb = document.getElementById('fp-autorotate');
    if (arCb) arCb.checked = RotateMgr.isAuto();
  },

  enableAll() {
    const s = {};
    Object.keys(this._defaults).forEach(k => { s[k] = true; });
    this.save(s);
    Object.keys(s).forEach(k => {
      const cb = document.getElementById('fp-' + k);
      if (cb) cb.checked = true;
      this._apply(k, true);
    });
    toast('All features enabled', 'ok');
  },

  disableAll() {
    const keep = ['bigicons']; // never fully hide these
    const s = {};
    Object.keys(this._defaults).forEach(k => { s[k] = keep.includes(k); });
    this.save(s);
    Object.keys(s).forEach(k => {
      const cb = document.getElementById('fp-' + k);
      if (cb) cb.checked = s[k];
      this._apply(k, s[k]);
    });
    toast('All features disabled', 'ok');
  }
};

/* ================================================================
   ROTATE MANAGER — screen orientation for mobile
   ================================================================ */
const RotateMgr = {
  _AUTO_KEY: 'ci_autorotate',
  _lock: null,

  isAuto() {
    return localStorage.getItem(this._AUTO_KEY) === '1';
  },

  setAuto(val) {
    localStorage.setItem(this._AUTO_KEY, val ? '1' : '0');
    if (val) this._requestLandscape();
    else this._unlock();
    toast(val ? 'Auto-rotate: landscape locked' : 'Auto-rotate: off', 'inf', 2000);
  },

  toggle() {
    if (this.isAuto()) {
      this.setAuto(false);
    } else {
      this.setAuto(true);
    }
    // Update features panel checkbox
    const cb = document.getElementById('fp-autorotate');
    if (cb) cb.checked = this.isAuto();
    // Update rotate button visual
    const btn = document.getElementById('btn-rotate');
    if (btn) btn.style.color = this.isAuto() ? 'var(--ac)' : '';
  },

  async _requestLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        this._lock = true;
      }
    } catch (e) {
      // Orientation lock not supported (desktop) — silently ignore
    }
  },

  async _unlock() {
    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
        this._lock = false;
      }
    } catch (e) {}
  },

  init() {
    if (this.isAuto()) {
      this._requestLandscape();
      const btn = document.getElementById('btn-rotate');
      if (btn) btn.style.color = 'var(--ac)';
    }
  }
};

/* ================================================================
   EXTEND DOMContentLoaded with FeaturesPanel + RotateMgr init
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved feature states after a short delay so DOM is ready
  setTimeout(() => {
    FeaturesPanel.applyAll();
    RotateMgr.init();
  }, 600);
}, { once: false });
