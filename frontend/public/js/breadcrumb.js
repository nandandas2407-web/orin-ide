'use strict';
/* ============================================================
   BREADCRUMB — file path navigation
   ============================================================ */
const Breadcrumb = {
  init() {
    // Will be updated when files open
  },

  update(filePath) {
    const el = document.getElementById('breadcrumb');
    if (!el || !filePath) { if (el) el.innerHTML = ''; return; }

    const parts = filePath.split('/');
    el.innerHTML = parts.map((part, i) => {
      const fullPath = parts.slice(0, i + 1).join('/');
      return `<span class="bc-part" data-path="${esc(fullPath)}" title="${esc(fullPath)}">${esc(part)}</span>`;
    }).join('<span class="bc-sep">/</span>');

    el.querySelectorAll('.bc-part').forEach(span => {
      span.addEventListener('click', () => {
        const p = span.dataset.path;
        if (p && typeof EditorMgr !== 'undefined') EditorMgr.openFile(p);
      });
    });
  }
};
window.Breadcrumb = Breadcrumb;
