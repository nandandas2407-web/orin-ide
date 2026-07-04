'use strict';
const Providers = {
  _BUILTIN: [
    {
      id: 'openrouter', name: 'OpenRouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: '',
      models: [
        { id: 'openrouter/free', name: 'Free (auto-route)' },
        { id: 'z-ai/glm-4.5-air:free', name: 'Glm-4.5-air' },
        { id: 'tencent/hy3-preview:free', name: 'Tencent HY3' },
        { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B' },
        { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 120B' },
        { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B' },
        { id: 'poolside/laguna-xs.2:free', name: 'laguna-xs.2' },
        { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6' },
        { id: 'openai/gpt-5.5', name: 'GPT-5.5' },
        { id: 'deepseek/deepseek-v4-pro', name: 'Deepseek-v4-pro' },
      ]
    }
  ],

  init() {
    this._ensureStorage();
  },

  _ensureStorage() {
    if (!Cfg.get('providers')) {
      this._saveBuiltin();
    }
  },

  _saveBuiltin() {
    const existing = this.list();
    if (!existing.find(p => p.id === 'openrouter')) {
      Cfg.set('providers', this._BUILTIN);
    }
  },

  list() {
    return Cfg.get('providers', this._BUILTIN);
  },

  get(id) {
    return this.list().find(p => p.id === id);
  },

  _save(providers) {
    Cfg.set('providers', providers);
  },

  add(provider) {
    const list = this.list();
    list.push(provider);
    this._save(list);
  },

  update(id, data) {
    const list = this.list();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...data };
    this._save(list);
  },

  remove(id) {
    if (id === 'openrouter') return;
    const list = this.list().filter(p => p.id !== id);
    this._save(list);
  },

  allModels() {
    const models = [];
    for (const p of this.list()) {
      for (const m of p.models) {
        models.push({ ...m, providerId: p.id, providerName: p.name });
      }
    }
    return models;
  },

  findModel(modelId) {
    for (const p of this.list()) {
      for (const m of p.models) {
        if (m.id === modelId) return { model: m, provider: p };
      }
    }
    const p = this.list().find(p => p.id === 'openrouter');
    return { model: { id: modelId, name: modelId }, provider: p };
  },

  resolveProvider(modelId) {
    const found = this.findModel(modelId);
    return found.provider || this.get('openrouter');
  },

  defaultProvider() {
    return this.get('openrouter');
  },

  // Auto-discover which models are available for a provider, using its
  // key. Returns { ok, models, error }. Used right after a key is saved
  // in Settings so the picker fills in automatically instead of the user
  // having to know exact model IDs.
  async fetchModels(id) {
    const p = this.get(id);
    if (!p) return { ok: false, models: [], error: 'Unknown provider' };
    if (!p.apiKey) return { ok: false, models: [], error: 'No API key set' };

    try {
      if (p.isAnthropicNative) {
        const res = await fetch(`${p.baseURL.replace(/\/+$/,'')}/models`, {
          headers: {
            'x-api-key': p.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          }
        });
        if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
        const data = await res.json();
        const models = (data.data || []).map(m => ({ id: m.id, name: m.display_name || m.id }));
        return { ok: true, models };
      }

      // OpenAI-compatible providers (OpenAI, OpenRouter, Groq, Together,
      // DeepSeek, Ollama, and any custom provider added by the user) all
      // expose GET {baseURL}/models the same way.
      const res = await fetch(`${p.baseURL.replace(/\/+$/,'')}/models`, {
        headers: { 'Authorization': `Bearer ${p.apiKey}` }
      });
      if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` };
      const data = await res.json();
      const raw = data.data || data.models || [];
      const models = raw.map(m => ({
        id: m.id || m.name,
        name: m.id || m.name
      })).filter(m => m.id);
      return { ok: true, models };
    } catch (e) {
      return { ok: false, models: [], error: e.message };
    }
  }
};
window.Providers = Providers;

/* ============================================================
   OLLAMA MANAGER — detect local Ollama, fetch models, Android-aware
   ============================================================ */
const OllamaMgr = {
  _detected: false,
  _models: [],
  _isAndroid: false,

  async init() {
    this._isAndroid = /Android|Termux/i.test(navigator.userAgent) || location.hostname === 'localhost';
    await this.detect();
  },

  async detect() {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        this._models = (data.models || []).map(m => ({
          id: m.name,
          name: m.name.replace(':latest', ''),
          size: m.size ? `${(m.size / 1e9).toFixed(1)}GB` : '',
          parameter_size: m.details?.parameter_size || '',
        }));
        this._detected = true;
        this._syncProvider();
        return true;
      }
    } catch {}
    this._detected = false;
    return false;
  },

  _syncProvider() {
    if (!this._detected) return;
    const ollama = Providers.get('ollama');
    if (ollama) {
      ollama.models = this._models.length > 0 ? this._models : ollama.models;
      Providers.update('ollama', ollama);
    }
  },

  getRecommendedModels() {
    if (this._isAndroid) {
      // Smaller models for Android/Termux — less RAM
      return [
        { id: 'phi3:mini', name: 'Phi-3 Mini (1.8GB)', size: 'small' },
        { id: 'gemma2:2b', name: 'Gemma2 2B (1.6GB)', size: 'small' },
        { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 1.5B (0.9GB)', size: 'tiny' },
        { id: 'tinyllama', name: 'TinyLlama (637MB)', size: 'tiny' },
        { id: 'phi3:mini-4k', name: 'Phi-3 Mini 4K (1.8GB)', size: 'small' },
        { id: 'mistral:7b-instruct-q4_0', name: 'Mistral 7B Q4 (4.1GB)', size: 'medium' },
        { id: 'codellama:7b-code', name: 'CodeLlama 7B (3.8GB)', size: 'medium' },
      ];
    }
    // Desktop — can handle larger models
    return [
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B (4.7GB)', size: 'medium' },
      { id: 'codellama:13b', name: 'CodeLlama 13B (7.4GB)', size: 'large' },
      { id: 'mistral:7b', name: 'Mistral 7B (4.1GB)', size: 'medium' },
      { id: 'phi3:14b', name: 'Phi-3 14B (7.9GB)', size: 'large' },
      { id: 'gemma2:9b', name: 'Gemma2 9B (5.4GB)', size: 'medium' },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B (4.4GB)', size: 'medium' },
      { id: 'deepseek-coder-v2:16b', name: 'DeepSeek Coder V2 (8.9GB)', size: 'large' },
    ];
  },

  getPopularModels() {
    // Popular models for quick download
    return [
      // General Purpose
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', desc: 'Best all-around', size: '4.7GB', category: 'general' },
      { id: 'llama3.1:70b', name: 'Llama 3.1 70B', desc: 'Most capable', size: '40GB', category: 'general' },
      { id: 'mistral:7b', name: 'Mistral 7B', desc: 'Fast & efficient', size: '4.1GB', category: 'general' },
      { id: 'gemma2:9b', name: 'Gemma2 9B', desc: 'Google quality', size: '5.4GB', category: 'general' },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', desc: 'Multilingual', size: '4.4GB', category: 'general' },
      
      // Coding
      { id: 'codellama:7b', name: 'CodeLlama 7B', desc: 'Code generation', size: '3.8GB', category: 'coding' },
      { id: 'codellama:13b', name: 'CodeLlama 13B', desc: 'Better code', size: '7.4GB', category: 'coding' },
      { id: 'deepseek-coder-v2:16b', name: 'DeepSeek Coder', desc: 'Pro coding', size: '8.9GB', category: 'coding' },
      { id: 'qwen2.5-coder:7b', name: 'Qwen Coder', desc: 'Code specialist', size: '4.4GB', category: 'coding' },
      
      // Small/Fast
      { id: 'phi3:mini', name: 'Phi-3 Mini', desc: 'Tiny but smart', size: '1.8GB', category: 'small' },
      { id: 'gemma2:2b', name: 'Gemma2 2B', desc: 'Ultra lightweight', size: '1.6GB', category: 'small' },
      { id: 'qwen2.5:1.5b', name: 'Qwen 1.5B', desc: 'Minimal footprint', size: '0.9GB', category: 'small' },
      { id: 'tinyllama', name: 'TinyLlama', desc: 'Smallest option', size: '637MB', category: 'small' },
    ];
  },

  async installModel(modelId) {
    toast(`Pulling ${modelId}... this may take a while`, 'inf', 5000);
    try {
      const res = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId, stream: false }),
      });
      if (res.ok) {
        toast(`Installed ${modelId}`, 'ok');
        await this.detect();
        return true;
      }
    } catch {}
    toast(`Failed to pull ${modelId}`, 'err');
    return false;
  },

  // Track active downloads
  _activeDownloads: new Map(),
  _downloadControllers: new Map(),

  startDownload(modelId, onComplete) {
    if (this._activeDownloads.has(modelId)) return;
    
    const controller = new AbortController();
    this._downloadControllers.set(modelId, controller);
    this._activeDownloads.set(modelId, { modelId, progress: 0, startTime: Date.now() });
    
    const pullPromise = this._pullModel(modelId, controller.signal);
    this._activeDownloads.get(modelId).promise = pullPromise;
    
    pullPromise.then(ok => {
      this._activeDownloads.delete(modelId);
      this._downloadControllers.delete(modelId);
      if (ok && onComplete) onComplete();
    }).catch(() => {
      this._activeDownloads.delete(modelId);
      this._downloadControllers.delete(modelId);
    });
  },

  stopDownload(modelId) {
    const controller = this._downloadControllers.get(modelId);
    if (controller) {
      controller.abort();
      this._downloadControllers.delete(modelId);
      this._activeDownloads.delete(modelId);
      toast(`Download cancelled: ${modelId}`, 'inf');
    }
  },

  async _pullModel(modelId, signal) {
    try {
      const res = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId, stream: false }),
        signal,
      });
      if (res.ok) {
        toast(`Installed ${modelId}`, 'ok');
        await this.detect();
        return true;
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        toast(`Failed to pull ${modelId}`, 'err');
      }
    }
    return false;
  },

  // Install Ollama on the system
  async installOllama() {
    const cmd = this._isAndroid
      ? 'pkg install -y ollama && ollama serve &'
      : 'curl -fsSL https://ollama.com/install.sh | sh';
    toast('Installing Ollama... check terminal for progress', 'inf', 5000);
    try {
      if (typeof API !== 'undefined' && API.execCmd) {
        await API.execCmd(cmd);
      } else {
        // Fallback: open terminal with command
        window.dispatchEvent(new CustomEvent('terminal:exec', { detail: { command: cmd } }));
      }
      // Wait a bit then check
      setTimeout(() => this.detect(), 5000);
      return true;
    } catch {}
    toast('Failed to install Ollama', 'err');
    return false;
  },

  _getInstallCommand() {
    return this._isAndroid ? 'pkg install -y ollama' : 'curl -fsSL https://ollama.com/install.sh | sh';
  },

  get isDetected() { return this._detected; },
  get isAndroid() { return this._isAndroid; },
  get models() { return this._models; },
};
window.OllamaMgr = OllamaMgr;

// Patch: make providers.js expose all built-in providers including non-OpenRouter options
;(function() {
  const _origBuiltin = Providers._BUILTIN;
  Providers._BUILTIN = [
    ..._origBuiltin,
    {
      id: 'anthropic-direct', name: 'Anthropic (Direct)',
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: '',
      isAnthropicNative: true,
      models: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
      ]
    },
    {
      id: 'openai-direct', name: 'OpenAI (Direct)',
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'o3', name: 'o3' },
      ]
    },
    {
      id: 'groq', name: 'Groq (Fast Inference)',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: '',
      models: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'gemma2-9b-it', name: 'Gemma2 9B' },
      ]
    },
    {
      id: 'together', name: 'Together AI',
      baseURL: 'https://api.together.xyz/v1',
      apiKey: '',
      models: [
        { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B' },
        { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
      ]
    },
    {
      id: 'ollama', name: 'Ollama (Local)',
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      models: [
        { id: 'llama3', name: 'Llama 3' },
        { id: 'codellama', name: 'CodeLlama' },
        { id: 'mistral', name: 'Mistral' },
        { id: 'phi3', name: 'Phi-3' },
      ]
    }
  ];
})();

/* ============================================================
   OLLAMA PANEL — dedicated sidebar for Ollama management
   ============================================================ */
const OllamaPanel = {
  _activeModel: null,

  async init() {
    // Update top bar on startup
    await OllamaMgr.detect();
    this._updateStatus();
    // Update install command based on platform
    const cmdEl = document.getElementById('ollama-install-cmd');
    if (cmdEl) cmdEl.textContent = OllamaMgr._getInstallCommand();
  },

  toggle() {
    const sb = document.getElementById('sidebar-ollama');
    if (!sb) return;
    const isActive = sb.classList.contains('hidden');
    // Hide all other sidebar views
    document.querySelectorAll('.sidebar-view').forEach(s => s.classList.add('hidden'));
    document.getElementById('sidebar')?.classList.add('hidden');
    document.querySelectorAll('.ab-btn[data-view]').forEach(b => b.classList.remove('active'));
    if (isActive) {
      sb.classList.remove('hidden');
      document.getElementById('ab-ollama')?.classList.add('active');
      this.refresh();
    }
  },

  async refresh() {
    await OllamaMgr.detect();
    this._updateStatus();
    this._renderInstalled();
    this._renderRecommended();
    this._renderPopular();
    this._updateSelect();
    // Update activity bar button
    const btn = document.getElementById('ab-ollama');
    if (btn) btn.classList.toggle('detected', OllamaMgr.isDetected);
  },

  _updateStatus() {
    const el = document.getElementById('ollama-status');
    const txt = document.getElementById('ollama-status-text');
    const startBtn = document.getElementById('ollama-start-btn');
    if (!el || !txt) return;
    el.classList.toggle('connected', OllamaMgr.isDetected);
    el.classList.toggle('disconnected', !OllamaMgr.isDetected);
    
    if (OllamaMgr.isDetected) {
      txt.textContent = `Connected — ${OllamaMgr.models.length} model(s) installed`;
      // Hide install section when connected
      const installSection = document.getElementById('ollama-install-section');
      if (installSection) installSection.style.display = 'none';
      // Hide start button when connected
      if (startBtn) startBtn.style.display = 'none';
    } else {
      txt.textContent = 'Ollama not running';
      // Show install section when not connected
      const installSection = document.getElementById('ollama-install-section');
      if (installSection) installSection.style.display = '';
      // Show start button
      if (startBtn) startBtn.style.display = '';
    }
    
    // Update top bar status
    const tb = document.getElementById('st-ollama');
    const tbTxt = document.getElementById('st-ollama-status');
    if (tb) {
      tb.classList.toggle('connected', OllamaMgr.isDetected);
      tb.classList.toggle('disconnected', !OllamaMgr.isDetected);
    }
    if (tbTxt) {
      tbTxt.textContent = OllamaMgr.isDetected
        ? `${OllamaMgr.models.length} model(s)`
        : 'Offline';
    }
  },

  _updateSelect() {
    const sel = document.getElementById('ollama-model-select');
    if (!sel) return;
    const current = this._activeModel || (typeof Cfg !== 'undefined' ? Cfg.get('model') : '');
    sel.innerHTML = '<option value="">— Select Model —</option>';
    for (const m of OllamaMgr.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name + (m.size ? ` (${m.size})` : '');
      if (m.id === current || `ollama/${m.id}` === current) opt.selected = true;
      sel.appendChild(opt);
    }
    // Add recommended if not installed
    const recs = OllamaMgr.getRecommendedModels();
    for (const r of recs) {
      if (OllamaMgr.models.some(m => m.id === r.id || m.id.startsWith(r.id.split(':')[0]))) continue;
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (not installed)`;
      sel.appendChild(opt);
    }
  },

  _renderInstalled() {
    const list = document.getElementById('ollama-installed-list');
    if (!list) return;
    list.innerHTML = '';
    if (!OllamaMgr.models.length) {
      list.innerHTML = '<div class="ollama-empty">No models installed. Pull one below.</div>';
      return;
    }
    const current = this._activeModel || (typeof Cfg !== 'undefined' ? Cfg.get('model') : '');
    for (const m of OllamaMgr.models) {
      const isActive = m.id === current || `ollama/${m.id}` === current;
      const item = document.createElement('div');
      item.className = 'ollama-model-item' + (isActive ? ' active' : '');
      item.innerHTML = `
        <span class="ollama-model-name">${esc(m.name)}</span>
        <span class="ollama-model-size">${m.size || ''}</span>
        <button class="ollama-model-use">Use</button>
      `;
      item.querySelector('.ollama-model-use').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectModel(m.id);
        this.applyModel();
      });
      list.appendChild(item);
    }
  },

  _renderRecommended() {
    const list = document.getElementById('ollama-recommended-list');
    const section = document.getElementById('ollama-recommended-section');
    if (!list || !section) return;
    if (!OllamaMgr.isAndroid) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    list.innerHTML = '';
    const recs = OllamaMgr.getRecommendedModels();
    for (const r of recs) {
      const installed = OllamaMgr.models.some(m => m.id === r.id || m.id.startsWith(r.id.split(':')[0]));
      const isDownloading = OllamaMgr._activeDownloads?.has(r.id);
      const item = document.createElement('div');
      item.className = 'ollama-model-item';
      item.dataset.modelId = r.id;
      item.innerHTML = `
        <span class="ollama-model-name">${esc(r.name)}</span>
        <span class="ollama-model-size">${r.size}</span>
        <div class="ollama-model-actions">
          ${installed ? 
            `<button class="ollama-model-use">Use</button>` : 
            isDownloading ? 
              `<button class="ollama-model-stop">Stop</button>` :
              `<button class="ollama-model-use">Install</button>`
          }
        </div>
      `;
      const actionBtn = item.querySelector('.ollama-model-use, .ollama-model-stop');
      if (actionBtn) {
        actionBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (installed) {
            this.selectModel(r.id);
            this.applyModel();
          } else if (isDownloading) {
            OllamaMgr.stopDownload(r.id);
            this.refresh();
          } else {
            OllamaMgr.startDownload(r.id, () => this.refresh());
            this.refresh();
          }
        });
      }
      list.appendChild(item);
    }
  },

  _renderPopular() {
    const list = document.getElementById('ollama-download-list');
    const section = document.getElementById('ollama-download-section');
    if (!list || !section) return;
    list.innerHTML = '';
    
    const popular = OllamaMgr.getPopularModels();
    const categories = { general: 'General Purpose', coding: 'Coding', small: 'Small & Fast' };
    
    for (const [cat, label] of Object.entries(categories)) {
      const models = popular.filter(m => m.category === cat);
      if (!models.length) continue;
      
      const catHeader = document.createElement('div');
      catHeader.className = 'ollama-category-header';
      catHeader.textContent = label;
      list.appendChild(catHeader);
      
      for (const m of models) {
        const installed = OllamaMgr.models.some(im => im.id === m.id || im.id.startsWith(m.id.split(':')[0]));
        const isDownloading = OllamaMgr._activeDownloads?.has(m.id);
        const item = document.createElement('div');
        item.className = 'ollama-model-item';
        item.dataset.modelId = m.id;
        item.innerHTML = `
          <div class="ollama-model-info">
            <span class="ollama-model-name">${esc(m.name)}</span>
            <span class="ollama-model-desc">${esc(m.desc)}</span>
          </div>
          <span class="ollama-model-size">${m.size}</span>
          <div class="ollama-model-actions">
            ${installed ? 
              `<button class="ollama-model-use">Use</button>` : 
              isDownloading ? 
                `<button class="ollama-model-stop">Stop</button>` :
                `<button class="ollama-model-use">Download</button>`
            }
          </div>
        `;
        
        const actionBtn = item.querySelector('.ollama-model-use, .ollama-model-stop');
        if (actionBtn) {
          actionBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (installed) {
              this.selectModel(m.id);
              this.applyModel();
            } else if (isDownloading) {
              OllamaMgr.stopDownload(m.id);
              this.refresh();
            } else {
              OllamaMgr.startDownload(m.id, () => this.refresh());
              this.refresh();
            }
          });
        }
        list.appendChild(item);
      }
    }
  },

  selectModel(modelId) {
    this._activeModel = modelId;
  },

  applyModel() {
    const model = this._activeModel;
    if (!model) return;
    const fullId = model.includes('/') ? model : `ollama/${model}`;
    if (typeof ModelPicker !== 'undefined') ModelPicker.setModel(fullId, model);
    toast(`Model set: ${model}`, 'ok');
  },

  async pullModel() {
    const input = document.getElementById('ollama-pull-input');
    const status = document.getElementById('ollama-pull-status');
    if (!input || !status) return;
    const modelId = input.value.trim();
    if (!modelId) return;
    status.textContent = `Pulling ${modelId}...`;
    status.style.color = 'var(--tx2)';
    const btn = document.querySelector('.ollama-pull-btn');
    if (btn) { btn.textContent = 'Pulling...'; btn.disabled = true; }
    const ok = await OllamaMgr.installModel(modelId);
    if (ok) {
      status.textContent = `Installed ${modelId}`;
      status.style.color = 'var(--gr)';
      input.value = '';
    } else {
      status.textContent = `Failed to pull ${modelId}`;
      status.style.color = 'var(--rd)';
    }
    if (btn) { btn.textContent = 'Pull'; btn.disabled = false; }
    this.refresh();
  },

  async installOllama() {
    const btn = document.getElementById('ollama-install-btn');
    const status = document.getElementById('ollama-install-status');
    const cmdEl = document.getElementById('ollama-install-cmd');
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Installing...
      `;
    }
    if (status) {
      status.textContent = 'Downloading and installing Ollama...';
      status.style.color = 'var(--tx2)';
    }
    
    const installCmd = OllamaMgr._getInstallCommand();
    if (cmdEl) cmdEl.textContent = installCmd;
    
    try {
      // Try to use terminal API
      if (typeof API !== 'undefined' && API.execCmd) {
        if (status) status.textContent = 'Running install command in terminal...';
        const result = await API.execCmd(installCmd);
        if (status) {
          status.textContent = 'Installation complete! Click Refresh to check.';
          status.style.color = 'var(--gr)';
        }
      } else {
        // Fallback: show command for user to run
        if (status) {
          status.textContent = 'Copy and run this command in your terminal:';
          status.style.color = 'var(--tx2)';
        }
      }
    } catch (e) {
      if (status) {
        status.textContent = `Error: ${e.message}. Try running manually.`;
        status.style.color = 'var(--rd)';
      }
    }
    
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Install Ollama
      `;
    }
    
    // Check again after a delay
    setTimeout(() => this.refresh(), 8000);
  },

  async startOllama() {
    const startBtn = document.getElementById('ollama-start-btn');
    const status = document.getElementById('ollama-status-text');
    
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Starting...
      `;
    }
    if (status) status.textContent = 'Starting Ollama server...';
    
    try {
      if (typeof API !== 'undefined' && API.execCmd) {
        // Start ollama serve in background
        await API.execCmd('ollama serve &');
        // Wait a bit then check
        setTimeout(() => this.refresh(), 3000);
      } else {
        if (status) status.textContent = 'Run "ollama serve" in terminal';
      }
    } catch (e) {
      if (status) status.textContent = `Error: ${e.message}`;
    }
    
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Start
      `;
    }
  }
};
window.OllamaPanel = OllamaPanel;
