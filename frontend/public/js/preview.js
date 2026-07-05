'use strict';
const PreviewMgr = {
  refreshTimer: null,
  _clickEditEnabled: false,

  init() {
    document.getElementById('btn-preview')?.addEventListener('click', () => this.open());
    document.getElementById('btn-refresh-preview')?.addEventListener('click', () => this.refresh());
    document.getElementById('btn-preview-new-tab')?.addEventListener('click', () => this.openTab());
    // Listen for click-to-edit messages from preview iframe
    window.addEventListener('message', e => {
      if (e.data?.type === 'preview:click-edit') this._handleClickEdit(e.data);
    });
  },

  open() {
    if (!FileTree.project) return toast('No project open', 'wrn');
    const iframe = document.getElementById('preview-frame');
    iframe.src = `/api/preview/${encodeURIComponent(FileTree.project)}/index.html`;
    openModal('preview-modal');
    // Inject click-to-edit after iframe loads
    setTimeout(() => this._injectClickEdit(), 500);
  },

  refresh() {
    const iframe = document.getElementById('preview-frame');
    if (iframe.src && FileTree.project) {
      iframe.src = iframe.src;
      setTimeout(() => this._injectClickEdit(), 500);
    }
  },

  openTab() {
    if (!FileTree.project) return;
    window.open(`/api/preview/${encodeURIComponent(FileTree.project)}/index.html`, '_blank');
  },

  // Inject click-to-edit script into preview iframe
  _injectClickEdit() {
    const iframe = document.getElementById('preview-frame');
    if (!iframe?.contentDocument) return;
    try {
      const doc = iframe.contentDocument;
      // Avoid double-injecting
      if (doc.getElementById('__orin-click-edit')) return;
      const script = doc.createElement('script');
      script.id = '__orin-click-edit';
      script.textContent = `
        (function() {
          let hover = null;
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px solid #3b82f6;background:rgba(59,130,246,.1);transition:all .1s';
          document.body.appendChild(overlay);

          document.addEventListener('mouseover', e => {
            const el = e.target;
            if (el === overlay || el === document.body || el === document.documentElement) return;
            const rect = el.getBoundingClientRect();
            overlay.style.left = rect.left + 'px';
            overlay.style.top = rect.top + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
            overlay.style.display = 'block';
            hover = el;
          });

          document.addEventListener('mouseout', e => {
            if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
              overlay.style.display = 'none';
              hover = null;
            }
          });

          document.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const el = hover || e.target;
            const tag = el.tagName?.toLowerCase();
            const id = el.id;
            const cls = el.className;
            const text = el.textContent?.slice(0, 80);
            parent.postMessage({ type: 'preview:click-edit', tag, id, cls, text }, '*');
          }, true);
        })();
      `;
      doc.head.appendChild(script);
      this._clickEditEnabled = true;
    } catch (e) { /* cross-origin or other error */ }
  },

  _handleClickEdit(data) {
    if (!data?.tag) return;
    // Try to find the file and line in the editor
    const active = EditorMgr?.active;
    if (!active) return toast('Open a file to edit', 'wrn');
    const model = EditorMgr?.editor?.getModel();
    if (!model) return;
    const content = model.getValue();
    const lines = content.split('\n');
    // Search for the tag in the current file
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('<' + data.tag)) {
        if (data.id && !line.includes('id="' + data.id + "'") && !line.includes("id='" + data.id + "'")) continue;
        EditorMgr.editor.setPosition({ lineNumber: i + 1, column: 1 });
        EditorMgr.editor.revealLineInCenter(i + 1);
        EditorMgr.editor.focus();
        toast(`Line ${i + 1}: <${data.tag}>`, 'inf', 1500);
        return;
      }
    }
    toast(`"<${data.tag}>" not found in ${active}`, 'wrn', 2000);
  },

  onFileChange(path) {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      FileTree.refresh();
      const modal = document.getElementById('preview-modal');
      if (!modal.classList.contains('hidden')) this.refresh();
      if (EditorMgr.active === path && FileTree.project) {
        const tab = EditorMgr.tabs.find(t => t.path === path);
        if (tab && !tab.modified) {
          API.readFile(FileTree.project, path).then(d => {
            if (!d.error) tab.model.setValue(d.content);
          }).catch(() => {});
        }
      }
    }, 600);
  }
};
window.PreviewMgr = PreviewMgr;
