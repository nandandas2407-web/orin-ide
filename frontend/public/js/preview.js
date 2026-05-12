'use strict';
const PreviewMgr = {
  refreshTimer: null,

  init() {
    document.getElementById('btn-preview').addEventListener('click', () => this.open());
    document.getElementById('btn-refresh-preview').addEventListener('click', () => this.refresh());
    document.getElementById('btn-preview-new-tab').addEventListener('click', () => this.openTab());
  },

  open() {
    if (!FileTree.project) return toast('No project open', 'wrn');
    const iframe = document.getElementById('preview-frame');
    iframe.src = `/api/preview/${encodeURIComponent(FileTree.project)}/index.html`;
    openModal('preview-modal');
  },

  refresh() {
    const iframe = document.getElementById('preview-frame');
    if (iframe.src && FileTree.project) iframe.src = iframe.src;
  },

  openTab() {
    if (!FileTree.project) return;
    window.open(`/api/preview/${encodeURIComponent(FileTree.project)}/index.html`, '_blank');
  },

  onFileChange(path) {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      FileTree.refresh();
      // Refresh preview if open
      const modal = document.getElementById('preview-modal');
      if (!modal.classList.contains('hidden')) this.refresh();
      // Reload open tab if it changed
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
