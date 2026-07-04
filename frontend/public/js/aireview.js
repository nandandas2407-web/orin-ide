'use strict';
/* ============================================================
   AI CODE REVIEW — real-time suggestions as you type
   ============================================================ */
const AIReview = {
  _timer: null,
  _decorations: [],
  _suggestions: [],
  _visible: false,

  init() {
    // Toggle with Ctrl+Shift+R
    if (typeof monaco !== 'undefined' && EditorMgr.instance) {
      EditorMgr.instance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyR,
        () => this.toggle()
      );
    }
  },

  toggle() {
    this._visible = !this._visible;
    if (this._visible) {
      this._activate();
      toast('AI Code Review: ON', 'ok', 1500);
    } else {
      this._deactivate();
      toast('AI Code Review: OFF', 'ok', 1500);
    }
  },

  _activate() {
    const editor = EditorMgr.instance;
    if (!editor) return;
    this._model = editor.getModel();
    this._listener = this._model.onDidChangeContent(() => {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._review(), 2000);
    });
    this._review();
  },

  _deactivate() {
    if (this._listener) { this._listener.dispose(); this._listener = null; }
    if (this._model) { this._model.deltaDecorations(this._decorations, []); }
    this._decorations = [];
  },

  async _review() {
    if (!this._visible || !this._model) return;
    let code = this._model.getValue();
    if (!code.trim()) return;

    // Token-aware truncation: limit code to ~2K tokens (~8K chars)
    const MAX_CODE_CHARS = 8000;
    if (code.length > MAX_CODE_CHARS) {
      code = code.slice(0, MAX_CODE_CHARS) + '\n// ... (truncated — file too large for full review)';
    }

    const apiKey = Cfg.get('apiKey', '');
    const model = Cfg.get('model', 'openrouter/free');
    if (!apiKey) return;

    try {
      const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
      let provider = null;
      if (model.startsWith('ollama/')) provider = providers.find(p => p.id === 'ollama');
      if (!provider) provider = providers.find(p => p.apiKey || p.id === 'openrouter');
      if (!provider) return;

      const actualModel = provider.id === 'ollama' ? model.replace('ollama/', '') : model;
      const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
      const key = provider.apiKey || apiKey;

      const lang = this._model.getLanguageId();
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { role: 'system', content: 'You are a code reviewer. Analyze the code and return JSON array of issues. Each issue: { "line": number, "severity": "error"|"warning"|"info", "message": "description" }. Focus on: bugs, security, performance, bad practices. Output ONLY the JSON array, no markdown.' },
            { role: 'user', content: `Language: ${lang}\n\n${code}` }
          ],
          max_tokens: 600,
          temperature: 0.1,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      let raw = data.choices?.[0]?.message?.content || '[]';
      raw = raw.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
      const issues = JSON.parse(raw);

      this._showIssues(issues);
    } catch {
      // Silent fail for review
    }
  },

  _showIssues(issues) {
    if (!this._model) return;
    const newDecorations = [];

    for (const issue of issues) {
      const lineNum = Math.max(1, Math.min(issue.line, this._model.getLineCount()));
      const lineContent = this._model.getLineContent(lineNum);

      // Highlight color by severity
      const colors = {
        error: 'rgba(248,113,113,0.15)',
        warning: 'rgba(251,191,36,0.12)',
        info: 'rgba(34,211,238,0.1)',
      };
      const glyphColors = {
        error: '#f87171',
        warning: '#fbbf24',
        info: '#22d3ee',
      };

      newDecorations.push({
        range: new monaco.Range(lineNum, 1, lineNum, lineContent.length + 1),
        options: {
          isWholeLine: true,
          className: 'ai-review-' + issue.severity,
          glyphMarginClassName: 'ai-review-glyph-' + issue.severity,
          glyphMarginHoverMessage: { value: `**AI Review (${issue.severity})**: ${issue.message}` },
          overviewRuler: { color: glyphColors[issue.severity] || '#888', position: monaco.editor.OverviewRulerLane.Right },
        }
      });
    }

    this._decorations = this._model.deltaDecorations(this._decorations, newDecorations);
    if (issues.length) toast(`${issues.length} issue(s) found`, 'inf', 2000);
  }
};
window.AIReview = AIReview;
