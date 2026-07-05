'use strict';
/* ============================================================
   AI CODE ACTIONS — right-click AI in editor
   ============================================================ */
const AICodeActions = {
  init() {
    if (typeof monaco === 'undefined') return;

    // Register code action provider
    monaco.languages.registerCodeActionProvider('*', {
      provideCodeActions: (model, range, context, token) => {
        const actions = [];

        // Get selected text
        const selection = EditorMgr.instance?.getSelection();
        const selectedText = selection
          ? model.getValueInRange(selection)
          : '';

        // AI Fix - always available
        actions.push({
          title: 'AI: Fix this code',
          kind: 'quickfix',
          command: {
            id: 'ai-action-fix',
            title: 'AI Fix',
            arguments: [model, range, selectedText]
          }
        });

        // AI Explain - always available
        actions.push({
          title: 'AI: Explain this code',
          kind: 'quickfix',
          command: {
            id: 'ai-action-explain',
            title: 'AI Explain',
            arguments: [model, range, selectedText]
          }
        });

        // AI Refactor - only when text is selected
        if (selectedText) {
          actions.push({
            title: 'AI: Refactor this code',
            kind: 'refactor.rewrite',
            command: {
              id: 'ai-action-refactor',
              title: 'AI Refactor',
              arguments: [model, range, selectedText]
            }
          });

          actions.push({
            title: 'AI: Add tests for this code',
            kind: 'refactor.extract',
            command: {
              id: 'ai-action-tests',
              title: 'AI Tests',
              arguments: [model, range, selectedText]
            }
          });

          actions.push({
            title: 'AI: Document this code',
            kind: 'refactor.rewrite',
            command: {
              id: 'ai-action-document',
              title: 'AI Document',
              arguments: [model, range, selectedText]
            }
          });
        }

        return { actions, dispose: () => {} };
      }
    });

    // Register action handlers
    if (typeof monaco !== 'undefined') {
      monaco.editor.registerCommand('ai-action-fix', async (accessor, model, range, text) => {
        await this._execute('fix', model, range, text);
      });
      monaco.editor.registerCommand('ai-action-explain', async (accessor, model, range, text) => {
        await this._execute('explain', model, range, text);
      });
      monaco.editor.registerCommand('ai-action-refactor', async (accessor, model, range, text) => {
        await this._execute('refactor', model, range, text);
      });
      monaco.editor.registerCommand('ai-action-tests', async (accessor, model, range, text) => {
        await this._execute('tests', model, range, text);
      });
      monaco.editor.registerCommand('ai-action-document', async (accessor, model, range, text) => {
        await this._execute('document', model, range, text);
      });
    }
  },

  async _execute(action, model, range, text) {
    const lang = model.getLanguageId();
    const fileExt = model.uri.path.split('.').pop();
    let code = text || model.getValue();

    // Token-aware truncation: limit code to ~2K tokens (~8K chars) to prevent context overflow
    const MAX_CODE_CHARS = 8000;
    if (code.length > MAX_CODE_CHARS) {
      code = code.slice(0, MAX_CODE_CHARS) + '\n// ... (truncated — code too large for context)';
    }

    const prompts = {
      fix: `Fix the bugs in this ${lang} code. Output ONLY the corrected code, no explanations:\n\n${code}`,
      explain: `Explain this ${lang} code in simple terms:\n\n${code}`,
      refactor: `Refactor this ${lang} code to be cleaner and more efficient. Output ONLY the refactored code:\n\n${code}`,
      tests: `Write unit tests for this ${lang} code. Output ONLY the test code:\n\n${code}`,
      document: `Add JSDoc/docstring documentation to this ${lang} code. Output ONLY the documented code:\n\n${code}`,
    };

    const prompt = prompts[action];
    if (!prompt) return;

    // Show in chat if available
    if (typeof ChatMgr !== 'undefined' && action !== 'explain') {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = prompt;
        input.focus();
        toast('Prompt sent to AI Chat', 'ok', 1500);
      }
    }

    // For explain, show inline
    if (action === 'explain') {
      try {
        const model_cfg = Cfg.get('model', 'openrouter/free');
        const apiKey = Cfg.get('apiKey', '');
        if (!apiKey) {
          toast('Set your API key in Settings', 'wrn');
          return;
        }

        const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
        const provider = providers.find(p => p.apiKey || p.id === 'openrouter');
        if (!provider) return;

        const res = await fetch(`${provider.baseURL.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey || apiKey}`,
          },
          body: JSON.stringify({
            model: provider.id === 'ollama' ? model_cfg.replace('ollama/', '') : model_cfg,
            messages: [
              { role: 'system', content: 'Excode code concisely in plain text.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const explanation = data.choices?.[0]?.message?.content || 'No explanation generated';
          // Show as hover-like notification
          toast(explanation.slice(0, 200) + (explanation.length > 200 ? '...' : ''), 'inf', 8000);
        }
      } catch (e) {
        toast('AI error: ' + e.message, 'err');
      }
    }
  }
};
window.AICodeActions = AICodeActions;
