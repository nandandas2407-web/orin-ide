'use strict';
/* ============================================================
   AI REFACTOR INLINE — floating inline widget version
   Original AIRefactor (modal-based .open()/.run()/.apply()) stays in features.js
   This adds a keyboard shortcut version without overwriting anything
   ============================================================ */
const AIRefactorInline = {
  init() {
    if (typeof monaco !== 'undefined' && typeof EditorMgr !== 'undefined' && EditorMgr.instance) {
      EditorMgr.instance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
        () => this.open()
      );
    }
  },

  open() {
    const editor = EditorMgr.instance;
    if (!editor) return;
    const sel = editor.getModel().getValueInRange(editor.getSelection());
    if (!sel || !sel.trim()) {
      toast('Select some code first', 'wrn');
      return;
    }

    const existing = document.getElementById('ai-refactor-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ai-refactor-overlay';
    overlay.className = 'ai-refactor-overlay';
    overlay.innerHTML = `
      <div class="ai-refactor-widget">
        <input id="ai-refactor-input" class="ai-refactor-inp" placeholder="e.g. 'add error handling', 'make async', 'convert to TypeScript'" spellcheck="false" autofocus>
        <button id="ai-refactor-apply" class="ai-refactor-btn">Apply</button>
        <button id="ai-refactor-cancel" class="ai-refactor-cancel">x</button>
      </div>
    `;
    document.getElementById('editor-wrap').appendChild(overlay);

    const input = document.getElementById('ai-refactor-input');
    input.focus();

    const cleanup = () => overlay.remove();
    document.getElementById('ai-refactor-apply').addEventListener('click', async () => {
      const instruction = input.value.trim();
      if (!instruction) return;
      cleanup();
      await this._refactor(sel, instruction, editor);
    });
    document.getElementById('ai-refactor-cancel').addEventListener('click', cleanup);
    input.addEventListener('keydown', async e => {
      if (e.key === 'Enter') { e.preventDefault(); const i = input.value.trim(); if (i) { cleanup(); await this._refactor(sel, i, editor); } }
      if (e.key === 'Escape') cleanup();
    });
  },

  async _refactor(code, instruction, editor) {
    const apiKey = Cfg.get('apiKey', '');
    const model = Cfg.get('model', 'openrouter/free');
    if (!apiKey) { toast('Set API key in Settings', 'wrn'); return; }

    // Token-aware truncation: limit code to ~2K tokens (~8K chars)
    const MAX_CODE_CHARS = 8000;
    if (code.length > MAX_CODE_CHARS) {
      code = code.slice(0, MAX_CODE_CHARS) + '\n// ... (truncated — code too large for context)';
    }

    toast('AI refactoring...', 'inf', 2000);

    try {
      const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
      let provider = null;
      if (model.startsWith('ollama/')) provider = providers.find(p => p.id === 'ollama');
      if (!provider) provider = providers.find(p => p.apiKey || p.id === 'openrouter');
      if (!provider) return;

      const actualModel = provider.id === 'ollama' ? model.replace('ollama/', '') : model;
      const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
      const key = provider.apiKey || apiKey;
      const lang = editor.getModel().getLanguageId();

      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { role: 'system', content: `You are a code refactoring tool for ${lang}. Apply the user's instruction to the code. Output ONLY the refactored code, no explanations, no markdown, no backticks.` },
            { role: 'user', content: `Instruction: ${instruction}\n\nCode:\n${code}` }
          ],
          max_tokens: 500,
          temperature: 0.1,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      let result = data.choices?.[0]?.message?.content || '';
      result = result.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

      if (result && result !== code) {
        const sel = editor.getSelection();
        editor.executeEdits('ai-refactor-inline', [{
          range: sel,
          text: result,
          forceMoveMarkers: true,
        }]);
        toast('Code refactored', 'ok');
      } else {
        toast('No changes needed', 'inf');
      }
    } catch (e) {
      toast('Refactor failed: ' + e.message, 'err');
    }
  }
};
window.AIRefactorInline = AIRefactorInline;
