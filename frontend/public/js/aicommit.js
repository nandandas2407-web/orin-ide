'use strict';
/* ============================================================
   AI COMMIT MESSAGE — generate from git diff
   ============================================================ */
const AICommit = {
  init() {
    // Will be called from git-mgr or terminal toolbar
  },

  async generate(project) {
    try {
      const result = await API.execCmd('git diff --staged', project);
      const diff = (result.stdout || '').trim();
      if (!diff) {
        toast('No staged changes. Run: git add .', 'wrn');
        return null;
      }
      return await this._generateFromDiff(diff);
    } catch (e) {
      toast('Git error: ' + e.message, 'err');
      return null;
    }
  },

  async _generateFromDiff(diff) {
    const apiKey = Cfg.get('apiKey', '');
    const model = Cfg.get('model', 'openrouter/free');
    if (!apiKey) { toast('Set API key in Settings', 'wrn'); return null; }

    const providers = typeof Providers !== 'undefined' ? Providers.list() : [];
    let provider = null;
    if (model.startsWith('ollama/')) provider = providers.find(p => p.id === 'ollama');
    if (!provider) provider = providers.find(p => p.apiKey || p.id === 'openrouter');
    if (!provider) return null;

    const actualModel = provider.id === 'ollama' ? model.replace('ollama/', '') : model;
    const base = (provider.baseURL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const key = provider.apiKey || apiKey;

    // Truncate diff if too long
    const truncated = diff.length > 4000 ? diff.slice(0, 4000) + '\n... (truncated)' : diff;

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: actualModel,
        messages: [
          { role: 'system', content: 'Generate a git commit message from the diff. Use conventional commit format (fix:, feat:, refactor:, etc). First line is summary (max 72 chars), blank line, then body. Output ONLY the commit message, no quotes, no markdown.' },
          { role: 'user', content: truncated }
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  },

  async commit(project) {
    const msg = await this.generate(project);
    if (!msg) return;

    // Show confirm dialog
    const confirmed = confirm(`Commit message:\n\n${msg}\n\nProceed?`);
    if (!confirmed) return;

    try {
      await API.execCmd(`git commit -m "${msg.replace(/"/g, '\\"')}"`, project);
      toast('Committed successfully', 'ok');
      return msg;
    } catch (e) {
      toast('Commit failed: ' + e.message, 'err');
      return null;
    }
  }
};
window.AICommit = AICommit;
