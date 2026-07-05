'use strict';
/* ============================================================
   AI INLINE COMPLETIONS — Copilot-style ghost text (v2)
   Fast, strong, multi-variant completions
   ============================================================ */
const AICompletions = {
  _enabled: true,
  _timer: null,
  _cache: new Map(),
  _inflight: null,
  _debounceMs: 300,
  _maxTokens: 200,
  _maxCache: 200,
  _maxContextLines: 40,

  // ═══ INIT ═══════════════════════════════════════════════════════
  init() {
    if (typeof monaco === 'undefined' || !EditorMgr.instance) return;

    monaco.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (model, position, context, token) => {
        if (!this._enabled) return { items: [] };

        // Abort previous in-flight request
        if (this._inflight) { try { this._inflight.abort(); } catch {} }
        this._inflight = new AbortController();

        const prompt = this._buildPrompt(model, position);
        if (!prompt) return { items: [] };

        const cacheKey = this._cacheKey(model, position);
        if (this._cache.has(cacheKey)) {
          return this._toItems(this._cache.get(cacheKey), position);
        }

        try {
          const results = await this._fetch(prompt, this._inflight.signal);
          // If Monaco already cancelled this request (user kept typing),
          // discard the stale result instead of inserting it.
          if (token.isCancellationRequested) return { items: [] };
          if (!results.length) return { items: [] };
          this._cache.set(cacheKey, results);
          this._trimCache();
          return this._toItems(results, position);
        } catch {
          return { items: [] };
        } finally {
          this._inflight = null;
        }
      },
      freeInlineCompletions: () => {}
    });

    // Toggle: Ctrl+Shift+I
    EditorMgr.instance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI,
      () => this.toggle()
    );
  },

  // ═══ PROMPT BUILDING ════════════════════════════════════════════
  _buildPrompt(model, pos) {
    const full = model.getValue();
    const lines = full.split('\n');
    const ln = pos.lineNumber - 1;
    const lang = this._lang(model.uri.path);

    // Current line up to cursor
    const cursorLine = (lines[ln] || '').substring(0, pos.column - 1);

    // Skip if line is empty or only whitespace
    if (!cursorLine.trim()) return null;

    // Skip comments (but only actual comment lines, not code with comments)
    const trimmed = cursorLine.trim();
    if (/^\/\/\s*$/.test(trimmed) || /^#\s*$/.test(trimmed) || /^\*\s*$/.test(trimmed)) return null;

    // Gather context: top-level declarations + surrounding code
    const context = this._gatherContext(lines, ln);

    return `Complete this ${lang} code. Output ONLY the completion, no explanation, no markdown.\n\n${context}\nCursor at line ${ln + 1}:\n${cursorLine}`;
  },

  _gatherContext(lines, cursorLn) {
    const max = this._maxContextLines;
    const parts = [];

    // 1. Top-level imports/declarations (first 15 lines or up to first function)
    const topLines = [];
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const l = lines[i].trim();
      if (/^(import|from|require|use |#include|package |def |function |class |export )/.test(l) || l === '') {
        topLines.push(lines[i]);
      } else if (topLines.length > 0) break;
    }
    if (topLines.length) parts.push(topLines.join('\n'));

    // 2. Surrounding context: 15 lines before, 5 after cursor
    const start = Math.max(0, cursorLn - 15);
    const end = Math.min(lines.length, cursorLn + 5);
    const surrounding = [];
    for (let i = start; i < end; i++) {
      const marker = i === cursorLn ? ' >>> ' : '     ';
      surrounding.push(`${marker}${i + 1}: ${lines[i]}`);
    }
    parts.push(surrounding.join('\n'));

    return parts.join('\n\n');
  },

  // ═══ FETCH ══════════════════════════════════════════════════════
  async _fetch(prompt, signal) {
    const model = Cfg.get('model', 'openrouter/free');
    const apiKey = Cfg.get('apiKey', '');

    // Find provider
    const allProviders = typeof Providers !== 'undefined' ? Providers.list() : [];
    let provider = null;
    if (model.startsWith('ollama/')) {
      provider = allProviders.find(p => p.id === 'ollama');
    }
    if (!provider) provider = allProviders.find(p => p.apiKey || p.id === 'openrouter');
    if (!provider) return [];

    const actualModel = provider.id === 'ollama' ? model.replace('ollama/', '') : model;
    const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const key = provider.apiKey || apiKey;
    if (!key) return [];

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: 'system', content: 'You are an ultra-fast code completion engine. Output ONLY the code to insert. No explanations. No markdown. No backticks. No comments about what you did.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: this._maxTokens,
        temperature: 0.05,
        top_p: 0.95,
        stream: false,
      }),
      signal,
    });

    if (!res.ok) return [];
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    return this._parseVariants(raw);
  },

  // ═══ RESPONSE PARSING ═══════════════════════════════════════════
  _parseVariants(text) {
    // Clean markdown blocks
    let cleaned = text
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim();

    // Split on blank lines or obvious delimiters to get multiple variants
    const parts = cleaned.split(/\n{2,}/).filter(Boolean);
    const results = [];

    for (let part of parts) {
      const lines = part.split('\n');
      const codeLines = [];
      for (const line of lines) {
        const t = line.trim();
        // Stop at explanation sentences
        if (/^(Here|This|The|It|Note|Explanation|Example|You can|We need|This will|The above|In this)/.test(t)) break;
        if (/^\/\/\s*(Explanation|Note|TODO|This)/.test(t)) break;
        if (/^#\s*(Explanation|Note|TODO|This)/.test(t)) break;
        codeLines.push(line);
      }
      const code = codeLines.join('\n').trim();
      if (code && code.length > 0 && code.length < 500) {
        results.push(code);
      }
    }

    // Deduplicate
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r)) return false;
      seen.add(r);
      return true;
    }).slice(0, 3); // Max 3 variants
  },

  // ═══ CLEANING ═══════════════════════════════════════════════════
  _cleanCompletion(text) {
    let c = text
      .replace(/^```[\w]*\n?/gm, '')
      .replace(/```$/gm, '')
      .trim();

    const lines = c.split('\n');
    const out = [];
    for (const line of lines) {
      const t = line.trim();
      if (/^(Here|This is|The following|This code|You should)/.test(t)) break;
      out.push(line);
    }
    return out.join('\n').trim();
  },

  // ═══ HELPERS ════════════════════════════════════════════════════
  _toItems(texts, pos) {
    return {
      items: texts.map((text, i) => ({
        insertText: text,
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        sortText: String(i).padStart(4, '0'),
        filterText: text.replace(/\s+/g, ''),
      }))
    };
  },

  _cacheKey(model, pos) {
    // Include file + line + column + line content for precise cache
    const line = model.getLineContent(pos.lineNumber);
    return `${model.uri.path}:${pos.lineNumber}:${pos.column}:${line.substring(0, pos.column - 1)}`;
  },

  _lang(path) {
    const ext = path.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rb: 'ruby', html: 'html', css: 'css', scss: 'scss',
      json: 'json', md: 'markdown', sh: 'bash', php: 'php',
      java: 'java', go: 'go', rs: 'rust', c: 'c', cpp: 'cpp',
      h: 'c', java: 'java', kt: 'kotlin', swift: 'swift',
      vue: 'vue', svelte: 'svelte', sql: 'sql', yaml: 'yaml', yml: 'yaml',
    };
    return map[ext] || ext;
  },

  _trimCache() {
    if (this._cache.size > this._maxCache) {
      const keys = [...this._cache.keys()];
      for (let i = 0; i < keys.length - this._maxCache / 2; i++) {
        this._cache.delete(keys[i]);
      }
    }
  },

  toggle() {
    this._enabled = !this._enabled;
    toast(`AI Completions: ${this._enabled ? 'ON' : 'OFF'}`, 'ok', 1500);
  },

  get isEnabled() { return this._enabled; },
};
window.AICompletions = AICompletions;
