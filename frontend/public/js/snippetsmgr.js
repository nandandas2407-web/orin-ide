'use strict';
/* ============================================================
   CUSTOM SNIPPETS MANAGER — user-created snippets (localStorage)
   Renamed from `SnippetsMgr` to `CustomSnippetsMgr`: this file and
   vibe.js both declared a top-level `const SnippetsMgr`, and since
   classic <script> tags share one global scope, the second
   declaration threw a SyntaxError that silently killed all of
   vibe.js on every page load. This manager's API (add/remove/
   search/insertSnippet backed by localStorage) isn't called from
   anywhere else in the app yet, so renaming it is safe and keeps
   the feature available under a non-colliding name for future wiring.
   ============================================================ */
const CustomSnippetsMgr = {
  _KEY: 'ci_snippets',

  get all() {
    try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
    catch { return []; }
  },

  save(snippets) {
    localStorage.setItem(this._KEY, JSON.stringify(snippets));
  },

  add(name, prefix, body, lang) {
    const snippets = this.all;
    snippets.push({ name, prefix, body, lang, created: Date.now() });
    this.save(snippets);
    toast(`Snippet "${name}" saved`, 'ok');
  },

  remove(idx) {
    const snippets = this.all;
    snippets.splice(idx, 1);
    this.save(snippets);
  },

  search(query) {
    const q = query.toLowerCase();
    return this.all.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.prefix.toLowerCase().includes(q)
    );
  },

  insertSnippet(prefix) {
    const snippet = this.all.find(s => s.prefix === prefix);
    if (!snippet) return false;
    const editor = EditorMgr.instance;
    if (!editor) return false;

    const sel = editor.getSelection();
    editor.executeEdits('snippet', [{
      range: sel,
      text: snippet.body,
      forceMoveMarkers: true,
    }]);
    return true;
  }
};
window.CustomSnippetsMgr = CustomSnippetsMgr;
