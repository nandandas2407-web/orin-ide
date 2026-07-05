'use strict';
/* ============================================================
   AI TERMINAL — natural language → shell commands → execute
   ============================================================ */
const AITerminal = {
  _input: null,
  _output: null,
  _pending: false,

  init() {
    this._injectUI();
  },

  _injectUI() {
    const termToolbar = document.querySelector('.bp-tabs');
    if (!termToolbar || document.getElementById('ai-term-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'ai-term-wrap';
    wrap.innerHTML = `
      <div class="ai-term-bar">
        <span class="ai-term-icon">AI</span>
        <input id="ai-term-input" class="ai-term-inp" placeholder="Describe what you want to do..." spellcheck="false" autocomplete="off">
        <button id="ai-term-run" class="ai-term-btn" title="Generate & run">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
      <div id="ai-term-preview" class="ai-term-preview hidden"></div>
    `;
    termToolbar.parentNode.insertBefore(wrap, termToolbar.nextSibling);

    this._input = document.getElementById('ai-term-input');
    this._output = document.getElementById('ai-term-preview');

    document.getElementById('ai-term-run').addEventListener('click', () => this._execute());
    this._input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._execute(); }
      if (e.key === 'Escape') this._hidePreview();
    });
  },

  async _execute() {
    if (this._pending) return;
    const text = this._input.value.trim();
    if (!text) return;

    const apiKey = Cfg.get('apiKey', '');
    const model = Cfg.get('model', 'openrouter/free');
    if (!apiKey) { toast('Set API key in Settings', 'wrn'); return; }

    this._pending = true;
    this._showPreview('Thinking...', 'thinking');

    try {
      const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
      let provider = null;
      if (model.startsWith('ollama/')) provider = providers.find(p => p.id === 'ollama');
      if (!provider) provider = providers.find(p => p.apiKey || p.id === 'openrouter');
      if (!provider) throw new Error('No provider found');

      const actualModel = provider.id === 'ollama' ? model.replace('ollama/', '') : model;
      const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
      const key = provider.apiKey || apiKey;

      const project = FileTree.project || '';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: actualModel,
          messages: [
            { role: 'system', content: `You are a terminal command generator for a coding IDE. Respond with JSON: { "commands": ["cmd1", "cmd2"], "explanation": "brief explanation" }. Output ONLY the JSON, no markdown, no backticks. Project: ${project || '(none)'}.` },
            { role: 'user', content: text }
          ],
          max_tokens: 300,
          temperature: 0.1,
        }),
      });

      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      let raw = data.choices?.[0]?.message?.content || '';
      raw = raw.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
      const parsed = JSON.parse(raw);
      this._showPreview(parsed, 'ready');
    } catch (e) {
      this._showPreview({ commands: [], explanation: 'Error: ' + e.message }, 'error');
    } finally {
      this._pending = false;
    }
  },

  _showPreview(data, state) {
    if (!this._output) return;
    this._output.classList.remove('hidden');

    if (state === 'thinking') {
      this._output.innerHTML = '<div class="ai-term-thinking">AI is thinking...</div>';
      return;
    }

    const cmds = data.commands || [];
    const exp = data.explanation || '';
    this._output.innerHTML = `
      <div class="ai-term-header">
        <span class="ai-term-state ${state}">${state === 'error' ? 'Error' : 'Ready to run'}</span>
        <button class="ai-term-close" onclick="document.getElementById('ai-term-preview').classList.add('hidden')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      ${exp ? `<div class="ai-term-exp">${esc(exp)}</div>` : ''}
      <div class="ai-term-cmds">
        ${cmds.map((c, i) => `
          <div class="ai-term-cmd">
            <code>$ ${esc(c)}</code>
            <button class="ai-term-run-cmd" data-cmd="${esc(c)}" title="Run this command">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      <div class="ai-term-actions">
        <button class="ai-term-btn-run-all" onclick="AITerminal._runAll()">Run All</button>
      </div>
    `;

    this._output.querySelectorAll('.ai-term-run-cmd').forEach(btn => {
      btn.addEventListener('click', () => this._runCmd(btn.dataset.cmd));
    });
    this._cmds = cmds;
  },

  async _runCmd(cmd) {
    // Execute via the visible terminal so output shows up
    if (typeof TermMgr !== 'undefined') {
      TermMgr.runFallback(cmd);
      toast('Running: ' + cmd, 'inf', 1500);
    } else {
      toast('Terminal not available', 'wrn');
    }
  },

  async _runAll() {
    if (!this._cmds) return;
    for (const cmd of this._cmds) {
      await this._runCmd(cmd);
      // Small delay between commands
      await new Promise(r => setTimeout(r, 500));
    }
  },

  _hidePreview() {
    if (this._output) this._output.classList.add('hidden');
  }
};
window.AITerminal = AITerminal;
