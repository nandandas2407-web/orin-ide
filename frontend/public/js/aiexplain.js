'use strict';
/* ============================================================
   AI EXPLAIN TOOLTIP — Ctrl+Hover inline explanation
   Rich formatted tooltip with word badge, type, and markdown
   ============================================================ */
const AIExplainTooltip = {
  _tooltip: null,
  _pending: null,

  init() {
    this._tooltip = document.createElement('div');
    this._tooltip.className = 'ai-explain-tooltip hidden';
    document.body.appendChild(this._tooltip);

    document.addEventListener('mousemove', e => {
      if (!e.ctrlKey && !e.metaKey) this._hide();
    });

    if (typeof monaco !== 'undefined' && typeof EditorMgr !== 'undefined' && EditorMgr.instance) {
      EditorMgr.instance.onMouseMove(e => {
        if (e.event?.ctrlKey || e.event?.metaKey) {
          const pos = e.target.position;
          if (pos) this._show(pos);
        }
      });
    }
  },

  async _show(position) {
    const editor = EditorMgr.instance;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const word = model.getWordAtPosition(position);
    if (!word || word.word.length < 2) return;

    const lineContent = model.getLineContent(position.lineNumber).trim();
    const apiKey = Cfg.get('apiKey', '');
    if (!apiKey) return;

    clearTimeout(this._pending);
    this._pending = setTimeout(async () => {
      this._tooltip.innerHTML = this._loadingHTML(word.word);
      this._positionTooltip(editor, position);

      try {
        const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
        let provider = null;
        const modelId = Cfg.get('model', 'openrouter/free');
        if (modelId.startsWith('ollama/')) provider = providers.find(p => p.id === 'ollama');
        if (!provider) provider = providers.find(p => p.apiKey || p.id === 'openrouter');
        if (!provider) return;

        const actualModel = provider.id === 'ollama' ? modelId.replace('ollama/', '') : modelId;
        const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
        const key = provider.apiKey || apiKey;

        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: actualModel,
            messages: [
              { role: 'system', content: 'Explain code concisely. Return a short summary (1-2 sentences) and optionally a code example if useful. Use simple markdown: **bold** for emphasis, `code` for inline code, and ``` for code blocks. Keep it under 150 words.' },
              { role: 'user', content: `Explain "${word.word}" in this context:\n${lineContent}\n\nFile: ${model.uri?.path || 'unknown'}` }
            ],
            max_tokens: 200,
            temperature: 0.2,
          }),
        });

        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const explanation = data.choices?.[0]?.message?.content || 'No explanation available';
        this._tooltip.innerHTML = this._resultHTML(word.word, explanation);
        this._positionTooltip(editor, position);
      } catch {
        this._tooltip.innerHTML = this._errorHTML(word.word);
      }
    }, 500);
  },

  _positionTooltip(editor, position) {
    const rect = editor.getDomNode().getBoundingClientRect();
    const lineH = 20;
    const scroll = editor.getScrollTop();
    const topInEditor = (position.lineNumber - editor.getVisibleRange().startLineNumber) * lineH - scroll;
    let top = rect.top + topInEditor + lineH + 4;
    let left = rect.left + 40;

    if (top + 200 > window.innerHeight) top = rect.top + topInEditor - 10;
    if (left + 420 > window.innerWidth) left = window.innerWidth - 430;

    this._tooltip.style.left = Math.max(10, left) + 'px';
    this._tooltip.style.top = Math.max(10, top) + 'px';
  },

  _loadingHTML(word) {
    return `
      <div class="aet-header">
        <span class="aet-badge">${this._esc(word)}</span>
        <span class="aet-label">Explaining</span>
      </div>
      <div class="aet-loading">
        <span class="aet-dot"></span><span class="aet-dot"></span><span class="aet-dot"></span>
      </div>`;
  },

  _resultHTML(word, text) {
    const rendered = this._renderMarkdown(text);
    return `
      <div class="aet-header">
        <span class="aet-badge">${this._esc(word)}</span>
        <span class="aet-label">AI Explanation</span>
        <button class="aet-copy" onclick="navigator.clipboard.writeText(this.closest('.ai-explain-tooltip').querySelector('.aet-body').textContent).then(()=>this.textContent='Copied')" title="Copy">Copy</button>
      </div>
      <div class="aet-body">${rendered}</div>`;
  },

  _errorHTML(word) {
    return `
      <div class="aet-header">
        <span class="aet-badge">${this._esc(word)}</span>
        <span class="aet-label">AI Explanation</span>
      </div>
      <div class="aet-body aet-error">Could not explain. Check your API key.</div>`;
  },

  _renderMarkdown(text) {
    let html = this._esc(text);
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="aet-pre"><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code class="aet-code">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  _hide() {
    clearTimeout(this._pending);
    if (this._tooltip) this._tooltip.classList.add('hidden');
  }
};
window.AIExplainTooltip = AIExplainTooltip;
