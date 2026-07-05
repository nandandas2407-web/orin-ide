'use strict';
/* ============================================================
   AI INLINE — long-press, lightbulb, context menu, cmd palette
   ============================================================ */
const AIInline = {
  _decorations: [],
  _longPressTimer: null,
  _longPressPos: null,
  _cmdOpen: false,
  _cmdFiltered: [],
  _cmdIdx: 0,

  // Inline commands: > prefix = IDE, @ prefix = AI, no prefix = AI chat
  _commands: [
    // AI actions
    { id: 'ai-fix',      label: 'Fix Bugs',           icon: '?', prefix: '@', fn: null },
    { id: 'ai-explain',  label: 'Explain Code',       icon: '?', prefix: '@', fn: null },
    { id: 'ai-refactor', label: 'Refactor Code',      icon: '?', prefix: '@', fn: null },
    { id: 'ai-optimize', label: 'Optimize Code',      icon: '?', prefix: '@', fn: null },
    { id: 'ai-tests',    label: 'Generate Tests',     icon: '?', prefix: '@', fn: null },
    { id: 'ai-docs',     label: 'Add Documentation',  icon: '?', prefix: '@', fn: null },
    { id: 'ai-review',   label: 'Review Code',        icon: '?', prefix: '@', fn: null },
    // IDE commands
    { id: 'save',        label: 'Save File',           icon: '',  prefix: '>', key: 'Ctrl+S', fn: () => EditorMgr.save() },
    { id: 'close-tab',   label: 'Close Tab',           icon: '',  prefix: '>', key: 'Ctrl+W', fn: () => { if (EditorMgr.active) EditorMgr.closeTab(EditorMgr.active); } },
    { id: 'toggle-term', label: 'Toggle Terminal',     icon: '',  prefix: '>', key: 'Ctrl+`', fn: () => TermMgr.toggle() },
    { id: 'toggle-side', label: 'Toggle Sidebar',      icon: '',  prefix: '>', key: 'Ctrl+B', fn: () => { document.getElementById('sidebar').classList.toggle('collapsed'); setTimeout(() => EditorMgr.layout(), 180); } },
    { id: 'settings',    label: 'Settings',            icon: '',  prefix: '>', key: 'Ctrl+,', fn: () => { SettingsMgr.load(); openModal('settings-modal'); } },
    { id: 'preview',     label: 'Live Preview',        icon: '',  prefix: '>', fn: () => PreviewMgr.open() },
    { id: 'new-file',    label: 'New File',            icon: '',  prefix: '>', key: 'Ctrl+N', fn: () => FileTree.promptNew('file', '') },
    { id: 'refresh',     label: 'Refresh Tree',        icon: '',  prefix: '>', fn: () => FileTree.refresh() },
    { id: 'format',      label: 'Format Document',     icon: '',  prefix: '>', fn: () => { try { EditorMgr.instance.getAction('editor.action.formatDocument')?.run(); } catch {} } },
    { id: 'fold',        label: 'Fold All',            icon: '',  prefix: '>', fn: () => { try { EditorMgr.instance.getAction('editor.foldAll')?.run(); } catch {} } },
    { id: 'unfold',      label: 'Unfold All',          icon: '',  prefix: '>', fn: () => { try { EditorMgr.instance.getAction('editor.unfoldAll')?.run(); } catch {} } },
  ],

  init() {
    if (typeof monaco === 'undefined' || !EditorMgr.instance) return;
    this._lightbulb();
    this._longPress();
    this._contextMenu();
    this._cmdPalette();
  },

  /* ── Lightbulb glyph margin decoration ─────────────────────── */
  _lightbulb() {
    const editor = EditorMgr.instance;
    if (!editor) return;

    const update = () => {
      const model = editor.getModel();
      if (!model) return;
      const lineCount = model.getLineCount();
      const newDecorations = [];
      // Show lightbulb on lines that have non-empty, non-comment content
      for (let i = 1; i <= lineCount && i <= 500; i++) {
        const line = model.getLineContent(i).trim();
        if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('/*') || line.startsWith('*')) continue;
        newDecorations.push({
          range: new monaco.Range(i, 1, i, 1),
          options: { isWholeLine: true, glyphMarginClassName: 'ai-lightbulb', glyphMarginHoverMessage: { value: '**AI Quick Fix** — Click or long-press for AI actions' } }
        });
      }
      this._decorations = editor.deltaDecorations(this._decorations, newDecorations);
    };

    // Debounced update on content change
    let timer = null;
    editor.onDidChangeModelContent(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, 1500);
    });
    // Initial update
    setTimeout(update, 500);

    // Click on lightbulb glyph
    editor.onMouseDown(e => {
      if (e.target.type === 6) { // MouseTargetType.GUTTER_GLYPH_MARGIN
        const line = e.target.position?.lineNumber;
        if (line) this._showActions(line);
      }
    });
  },

  /* ── Show AI actions popup at a line ───────────────────────── */
  _showActions(line) {
    const editor = EditorMgr.instance;
    if (!editor) return;
    this._removePopup();

    const model = editor.getModel();
    const sel = editor.getSelection();
    const hasSelection = sel && !sel.isEmpty();
    const text = hasSelection ? model.getValueInRange(sel) : model.getLineContent(line);

    const pos = editor.getPositionAt(model.getOffsetAt({ lineNumber: line, column: 1 }));
    const coords = editor.getScrolledVisiblePosition(pos);
    if (!coords) return;

    const popup = document.createElement('div');
    popup.id = 'ai-inline-popup';
    popup.className = 'ai-inline-popup';
    popup.innerHTML = `
      <button data-action="fix">Fix Bugs</button>
      <button data-action="explain">Explain</button>
      ${hasSelection ? '<button data-action="refactor">Refactor</button>' : ''}
      ${hasSelection ? '<button data-action="tests">Add Tests</button>' : ''}
      ${hasSelection ? '<button data-action="document">Document</button>' : ''}
      <button data-action="optimize">Optimize</button>
    `;

    const editorEl = editor.getDomNode();
    if (!editorEl) return;
    const editorRect = editorEl.getBoundingClientRect();
    popup.style.position = 'absolute';
    popup.style.top = (coords.top + coords.height + 4) + 'px';
    popup.style.left = Math.min(coords.left, editorRect.width - 180) + 'px';
    popup.style.zIndex = '9000';
    editorEl.parentElement.style.position = 'relative';
    editorEl.parentElement.appendChild(popup);

    popup.addEventListener('click', async e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      this._removePopup();
      await this._execute(action, text, line);
    });

    // Close on outside click
    setTimeout(() => {
      const closer = e => { if (!popup.contains(e.target)) { this._removePopup(); document.removeEventListener('mousedown', closer); } };
      document.addEventListener('mousedown', closer);
    }, 10);
  },

  _removePopup() {
    document.getElementById('ai-inline-popup')?.remove();
  },

  /* ── Long-press handler (mobile) ──────────────────────────── */
  _longPress() {
    const editor = EditorMgr.instance;
    if (!editor) return;
    const el = editor.getDomNode();
    if (!el) return;

    const start = e => {
      const touch = e.touches?.[0];
      if (!touch) return;
      const pos = editor.getPositionForOffset(new DOMPoint(touch.clientX, touch.clientY).toJSON ? undefined : undefined);
      // Get position from coordinates
      const rect = el.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const editorPos = editor.screenPositionToEditorPosition({ x, y });
      if (!editorPos) return;

      this._longPressPos = editorPos;
      this._longPressTimer = setTimeout(() => {
        // Select the word at position
        const model = editor.getModel();
        if (!model) return;
        const word = model.getWordAtPosition(editorPos);
        if (word) {
          editor.setSelection({
            startLineNumber: editorPos.lineNumber, startColumn: word.startColumn,
            endLineNumber: editorPos.lineNumber, endColumn: word.endColumn
          });
        }
        this._showActions(editorPos.lineNumber);
        navigator.vibrate?.(30);
      }, 500);
    };

    const move = () => {
      if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
    };

    const end = () => {
      if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  },

  /* ── Editor right-click context menu ──────────────────────── */
  _contextMenu() {
    const editor = EditorMgr.instance;
    if (!editor) return;

    // Override Monaco's built-in context menu to add AI actions
    editor.updateOptions({
      contextmenu: true,
    });

    // Add extra actions to Monaco's context menu
    editor.addAction({
      id: 'ai-inline-fix',
      label: 'AI: Fix This Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const sel = ed.getSelection();
        const text = sel && !sel.isEmpty() ? ed.getModel().getValueInRange(sel) : ed.getModel().getValue();
        this._execute('fix', text, sel?.startLineNumber || 1);
      }
    });

    editor.addAction({
      id: 'ai-inline-explain',
      label: 'AI: Explain This Code',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.6,
      run: (ed) => {
        const sel = ed.getSelection();
        const text = sel && !sel.isEmpty() ? ed.getModel().getValueInRange(sel) : ed.getModel().getValue();
        this._execute('explain', text, sel?.startLineNumber || 1);
      }
    });

    editor.addAction({
      id: 'ai-inline-refactor',
      label: 'AI: Refactor Selection',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.7,
      run: (ed) => {
        const sel = ed.getSelection();
        if (!sel || sel.isEmpty()) { toast('Select code first', 'wrn'); return; }
        const text = ed.getModel().getValueInRange(sel);
        this._execute('refactor', text, sel.startLineNumber);
      }
    });

    editor.addAction({
      id: 'ai-inline-optimize',
      label: 'AI: Optimize This Code',
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.8,
      run: (ed) => {
        const sel = ed.getSelection();
        const text = sel && !sel.isEmpty() ? ed.getModel().getValueInRange(sel) : ed.getModel().getValue();
        this._execute('optimize', text, sel?.startLineNumber || 1);
      }
    });
  },

  /* ── Execute AI action ────────────────────────────────────── */
  async _execute(action, code, line) {
    const editor = EditorMgr.instance;
    if (!editor) return;
    const model = editor.getModel();
    const lang = model?.getLanguageId() || 'code';
    const apiKey = Cfg.get('apiKey', '');
    const modelId = Cfg.get('model', 'openrouter/free');

    if (!apiKey) { toast('Set API key in Settings', 'wrn'); return; }

    // Token-aware truncation
    const MAX = 8000;
    if (code.length > MAX) code = code.slice(0, MAX) + '\n// ... (truncated)';

    const prompts = {
      fix: `Fix bugs in this ${lang} code. Output ONLY corrected code, no explanations:\n\n${code}`,
      explain: `Explain this ${lang} code concisely:\n\n${code}`,
      refactor: `Refactor this ${lang} code to be cleaner. Output ONLY refactored code:\n\n${code}`,
      optimize: `Optimize this ${lang} code for performance. Output ONLY optimized code:\n\n${code}`,
      tests: `Write unit tests for this ${lang} code. Output ONLY test code:\n\n${code}`,
      document: `Add documentation comments to this ${lang} code. Output ONLY documented code:\n\n${code}`,
    };

    const prompt = prompts[action];
    if (!prompt) return;

    // For explain — show as toast
    if (action === 'explain') {
      try {
        const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
        let provider = providers.find(p => p.apiKey || p.id === 'openrouter');
        if (!provider) return;
        const actualModel = provider.id === 'ollama' ? modelId.replace('ollama/', '') : modelId;
        const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
        const key = provider.apiKey || apiKey;

        toast('AI thinking...', 'inf', 1500);
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: actualModel,
            messages: [
              { role: 'system', content: 'Explain code concisely in plain text.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 500, temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const explanation = data.choices?.[0]?.message?.content || 'No explanation';
          toast(explanation.slice(0, 300) + (explanation.length > 300 ? '...' : ''), 'inf', 10000);
        }
      } catch (e) {
        toast('AI error: ' + e.message, 'err');
      }
      return;
    }

    // For code actions — show inline refactor widget or send to chat
    if (action === 'refactor' || action === 'fix' || action === 'optimize') {
      // Apply inline
      try {
        const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
        let provider = providers.find(p => p.apiKey || p.id === 'openrouter');
        if (!provider) return;
        const actualModel = provider.id === 'ollama' ? modelId.replace('ollama/', '') : modelId;
        const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
        const key = provider.apiKey || apiKey;

        toast(`AI ${action}...`, 'inf', 2000);
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: actualModel,
            messages: [
              { role: 'system', content: `You are a code ${action} tool for ${lang}. Output ONLY the ${action === 'fix' ? 'corrected' : action === 'optimize' ? 'optimized' : 'refactored'} code, no explanations, no markdown, no backticks.` },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1000, temperature: 0.1,
          }),
        });
        if (!res.ok) throw new Error('API error ' + res.status);
        const data = await res.json();
        let result = data.choices?.[0]?.message?.content || '';
        result = result.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

        if (result && result !== code) {
          // Find the range to replace
          const sel = editor.getSelection();
          const range = (sel && !sel.isEmpty()) ? sel : new monaco.Range(line, 1, line, model.getLineMaxColumn(line));
          editor.executeEdits('ai-inline-' + action, [{ range, text: result, forceMoveMarkers: true }]);
          toast(`Code ${action === 'fix' ? 'fixed' : action === 'optimize' ? 'optimized' : 'refactored'}`, 'ok');
        } else {
          toast('No changes needed', 'inf');
        }
      } catch (e) {
        toast(`AI ${action} failed: ` + e.message, 'err');
      }
      return;
    }

    // For tests, document — send to chat
    if (typeof ChatMgr !== 'undefined') {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = prompt;
        input.focus();
        toast('Prompt sent to AI Chat', 'ok', 1500);
      }
    }
  },

  /* ── Inline Command Palette ────────────────────────────────── */
  _cmdPalette() {
    const editor = EditorMgr.instance;
    if (!editor) return;

    // Ctrl+Shift+P opens inline palette
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => this.openCmd());

    // Also bind / when editor is focused and cursor is at start of empty line
    editor.addCommand(monaco.KeyCode.Slash, () => {
      const pos = editor.getPosition();
      const model = editor.getModel();
      if (pos && model) {
        const line = model.getLineContent(pos.lineNumber).trim();
        if (line === '') this.openCmd('>');
      }
    });
  },

  openCmd(prefix = '') {
    if (this._cmdOpen) return;
    this._cmdOpen = true;

    const editor = EditorMgr.instance;
    if (!editor) return;
    const el = editor.getDomNode();
    if (!el) return;

    // Create the inline command bar
    const bar = document.createElement('div');
    bar.id = 'ai-cmd-bar';
    bar.className = 'ai-cmd-bar';
    bar.innerHTML = `
      <div class="ai-cmd-input-wrap">
        <span class="ai-cmd-icon">&gt;</span>
        <input id="ai-cmd-input" class="ai-cmd-input" type="text" placeholder="Type command or AI instruction..." spellcheck="false" autocomplete="off" autofocus>
      </div>
      <div id="ai-cmd-list" class="ai-cmd-list"></div>
    `;

    el.parentElement.style.position = 'relative';
    el.parentElement.appendChild(bar);

    const input = document.getElementById('ai-cmd-input');
    if (prefix) input.value = prefix;
    setTimeout(() => input.focus(), 10);

    // Filter and render
    this._cmdFiltered = [...this._commands];
    this._cmdIdx = 0;
    this._cmdRender();

    input.addEventListener('input', () => this._cmdFilter());
    input.addEventListener('keydown', e => this._cmdKeydown(e));
    input.addEventListener('blur', e => {
      // Delay to allow click on list item
      setTimeout(() => {
        if (!document.getElementById('ai-cmd-bar')) return;
        if (!document.getElementById('ai-cmd-bar')?.contains(document.activeElement)) {
          this.closeCmd();
        }
      }, 150);
    });
  },

  closeCmd() {
    this._cmdOpen = false;
    document.getElementById('ai-cmd-bar')?.remove();
  },

  _cmdFilter() {
    const input = document.getElementById('ai-cmd-input');
    if (!input) return;
    const q = input.value.toLowerCase().trim();

    if (!q) {
      this._cmdFiltered = [...this._commands];
    } else if (q.startsWith('>')) {
      // IDE commands only
      const sq = q.slice(1).trim();
      this._cmdFiltered = this._commands.filter(c => c.prefix === '>' && c.label.toLowerCase().includes(sq));
    } else if (q.startsWith('@')) {
      // AI commands only
      const sq = q.slice(1).trim();
      this._cmdFiltered = this._commands.filter(c => c.prefix === '@' && c.label.toLowerCase().includes(sq));
    } else {
      // Show all matching + allow free text AI prompt
      this._cmdFiltered = this._commands.filter(c => c.label.toLowerCase().includes(q));
    }
    this._cmdIdx = 0;
    this._cmdRender();
  },

  _cmdRender() {
    const list = document.getElementById('ai-cmd-list');
    if (!list) return;
    const input = document.getElementById('ai-cmd-input');
    const q = input?.value?.trim() || '';

    let html = this._cmdFiltered.slice(0, 12).map((c, i) => `
      <div class="ai-cmd-row${i === this._cmdIdx ? ' focused' : ''}" data-i="${i}">
        <span class="ai-cmd-row-icon">${c.prefix === '@' ? '?' : '>'}</span>
        <span class="ai-cmd-row-label">${esc(c.label)}</span>
        ${c.key ? `<span class="ai-cmd-row-key">${esc(c.key)}</span>` : ''}
      </div>`).join('');

    // If there's free text that doesn't match a command, show "Ask AI" option
    if (q && !q.startsWith('>') && !q.startsWith('@') && this._cmdFiltered.length === 0) {
      html = `<div class="ai-cmd-row focused" data-ai="1">
        <span class="ai-cmd-row-icon">?</span>
        <span class="ai-cmd-row-label">Ask AI: ${esc(q.slice(0, 40))}</span>
      </div>`;
    } else if (q && !q.startsWith('>') && !q.startsWith('@') && this._cmdFiltered.length > 0) {
      html += `<div class="ai-cmd-row" data-ai="1">
        <span class="ai-cmd-row-icon">?</span>
        <span class="ai-cmd-row-label">Ask AI: ${esc(q.slice(0, 40))}</span>
      </div>`;
    }

    list.innerHTML = html;
    list.style.display = html ? 'block' : 'none';

    list.querySelectorAll('.ai-cmd-row').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        if (el.dataset.ai) {
          this._cmdRunAI(q);
        } else {
          const idx = +el.dataset.i;
          const cmd = this._cmdFiltered[idx];
          if (cmd) this._cmdRun(cmd);
        }
      });
    });
  },

  _cmdKeydown(e) {
    const list = document.getElementById('ai-cmd-list');
    const rows = list?.querySelectorAll('.ai-cmd-row') || [];
    const total = rows.length;

    if (e.key === 'ArrowDown') { e.preventDefault(); this._cmdIdx = Math.min(this._cmdIdx + 1, total - 1); this._cmdRender(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); this._cmdIdx = Math.max(this._cmdIdx - 1, 0); this._cmdRender(); }
    if (e.key === 'Escape') { e.preventDefault(); this.closeCmd(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const focused = list.querySelector('.ai-cmd-row.focused');
      if (focused?.dataset.ai) {
        const input = document.getElementById('ai-cmd-input');
        this._cmdRunAI(input?.value?.trim() || '');
      } else {
        const cmd = this._cmdFiltered[this._cmdIdx];
        if (cmd) this._cmdRun(cmd);
      }
    }
  },

  _cmdRun(cmd) {
    this.closeCmd();
    if (cmd.fn) {
      setTimeout(() => cmd.fn(), 10);
    } else if (cmd.prefix === '@') {
      // AI command — get selection and execute
      setTimeout(() => {
        const editor = EditorMgr.instance;
        if (!editor) return;
        const sel = editor.getSelection();
        const text = sel && !sel.isEmpty() ? editor.getModel().getValueInRange(sel) : '';
        this._execute(cmd.id.replace('ai-', ''), text || editor.getModel().getValue(), sel?.startLineNumber || 1);
      }, 10);
    }
  },

  _cmdRunAI(text) {
    this.closeCmd();
    if (!text) return;
    // Send to AI chat
    setTimeout(() => {
      const input = document.getElementById('chat-input');
      if (input) {
        // Include selection context if any
        const editor = EditorMgr.instance;
        let msg = text;
        if (editor) {
          const sel = editor.getSelection();
          if (sel && !sel.isEmpty()) {
            const code = editor.getModel().getValueInRange(sel);
            msg = `${text}\n\n\`\`\`\n${code}\n\`\`\``;
          }
        }
        input.value = msg;
        input.focus();
        document.getElementById('btn-send')?.click();
      }
    }, 10);
  }
};
window.AIInline = AIInline;
