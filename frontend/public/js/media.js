'use strict';
/* ================================================================
   MEDIA / ASSET UPLOAD MANAGER
   - Topbar button (image icon)
   - Chat toolbar Upload button
   - Sidebar Import Asset button (with folder + rename options)
   - Drag-drop onto chat panel
   ================================================================ */
const MediaMgr = {
  _pendingModalFiles: [],

  init() {
    this._bindTopbarBtn();
    this._bindSidebarBtn();
    this._bindChatDrop();
    this._bindAssetModal();
  },

  /* ---- Topbar image icon ---- */
  _bindTopbarBtn() {
    document.getElementById('btn-upload-asset')?.addEventListener('click', () => {
      if (!FileTree.project) return toast('Open a project first', 'wrn');
      document.getElementById('asset-file-input').click();
    });
    document.getElementById('asset-file-input').addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (files.length) this._uploadFiles(files);
      e.target.value = '';
    });
  },

  /* ---- Sidebar Import Asset button — opens modal with folder/rename options ---- */
  _bindSidebarBtn() {
    document.getElementById('btn-import-asset-sidebar')?.addEventListener('click', () => {
      if (!FileTree.project) return toast('Open a project first', 'wrn');
      // Pre-fill sensible default folder
      document.getElementById('asset-dest-folder').value = 'assets';
      document.getElementById('asset-rename-inp').value = '';
      document.getElementById('asset-import-msg').textContent = '';
      openModal('asset-import-modal');
    });

    // Dropzone inside modal
    const dz = document.getElementById('asset-dropzone');
    if (dz) {
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('over');
        const files = Array.from(e.dataTransfer.files);
        if (files.length) this._handleModalDrop(files);
      });
      dz.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') return;
        document.getElementById('asset-file-input').click();
      });
    }
  },

  _handleModalDrop(files) {
    this._pendingModalFiles = files;
    const msg = document.getElementById('asset-import-msg');
    msg.className = 'msg-ok';
    msg.textContent = files.length + ' file(s) ready. Set destination and click Import.';
    // Show import button if not already there
    let btn = document.getElementById('btn-do-asset-import');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-do-asset-import';
      btn.className = 'btn-p';
      btn.style.marginTop = '10px';
      btn.textContent = 'Import into Project';
      btn.addEventListener('click', () => this._doModalImport());
      msg.parentNode.appendChild(btn);
    }
  },

  _bindAssetModal() {
    // When file input fires while modal is open, treat as modal drop
    document.getElementById('asset-file-input').addEventListener('change', e => {
      const modal = document.getElementById('asset-import-modal');
      if (!modal.classList.contains('hidden')) {
        const files = Array.from(e.target.files);
        if (files.length) this._handleModalDrop(files);
        e.target.value = '';
      }
    }, true); // capture phase so this runs before the topbar handler
  },

  async _doModalImport() {
    const files = this._pendingModalFiles;
    if (!files.length) return;
    let folder = (document.getElementById('asset-dest-folder').value.trim() || 'assets').replace(/\/$/, '');
    const rename = document.getElementById('asset-rename-inp').value.trim();
    const msg = document.getElementById('asset-import-msg');
    msg.className = 'msg-ok'; msg.textContent = 'Uploading...';

    for (const file of files) {
      const finalName = (rename && files.length === 1) ? rename : file.name;
      const destPath = folder + '/' + finalName;
      await this._uploadFile(file, destPath);
    }

    msg.textContent = files.length + ' file(s) imported successfully.';
    this._pendingModalFiles = [];
    setTimeout(() => closeModal('asset-import-modal'), 1200);
  },

  /* ---- Chat panel drag-drop ---- */
  _bindChatDrop() {
    const chatPanel = document.getElementById('chat-panel');
    chatPanel.addEventListener('dragover', e => {
      e.preventDefault();
      chatPanel.classList.add('drag-over');
    });
    chatPanel.addEventListener('dragleave', () => chatPanel.classList.remove('drag-over'));
    chatPanel.addEventListener('drop', e => {
      e.preventDefault();
      chatPanel.classList.remove('drag-over');
      if (!FileTree.project) return toast('Open a project first', 'wrn');
      const files = Array.from(e.dataTransfer.files);
      if (files.length) this._uploadFiles(files);
    });
  },

  /* ---- Upload multiple files with auto folder detection ---- */
  async _uploadFiles(files) {
    if (!FileTree.project) return toast('Open a project first', 'wrn');
    for (const file of files) {
      await this._uploadFile(file, null);
    }
  },

  /* ---- Core upload — destPath optional, auto-detected if null ---- */
  async _uploadFile(file, destPath) {
    if (!destPath) {
      const mime = file.type || '';
      let folder = 'assets';
      if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(file.name)) folder = 'assets/images';
      else if (mime.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(file.name)) folder = 'assets/videos';
      else if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac)$/i.test(file.name)) folder = 'assets/audio';
      destPath = folder + '/' + file.name;
    }

    showLoading('Uploading ' + file.name + '...');
    try {
      const r = await API.uploadAsset(FileTree.project, file, destPath);
      hideLoading();
      if (r.error) return toast('Upload failed: ' + r.error, 'err');

      // Register in AI chat context
      ChatMgr.pendingAssets.push({ path: r.path, mimeType: r.mimeType, size: r.size, name: file.name });

      // Refresh file tree
      await FileTree.refresh();

      // Show asset preview bubble in chat
      this._addAssetBubble(file, r.path, r.mimeType || file.type || '');

      toast('Imported: ' + r.path, 'ok');
    } catch (e) {
      hideLoading();
      toast('Upload error: ' + e.message, 'err');
    }
  },

  /* ---- Preview bubble in chat ---- */
  _addAssetBubble(file, assetPath, mimeType) {
    const msgs = document.getElementById('chat-messages');
    const d = document.createElement('div');
    d.className = 'msg user asset-msg';

    let preview = '';
    if (mimeType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(assetPath)) {
      const url = URL.createObjectURL(file);
      preview = `<img src="${url}" class="asset-thumb" alt="${file.name}" onload="URL.revokeObjectURL(this.src)">`;
    } else if (mimeType.startsWith('video/')) {
      preview = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
    } else if (mimeType.startsWith('audio/')) {
      preview = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    } else {
      preview = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    }

    d.innerHTML = `
      <div class="msg-avatar">You</div>
      <div class="msg-body asset-body">
        <div class="asset-preview">${preview}</div>
        <div class="asset-info">
          <div class="asset-name">${file.name}</div>
          <div class="asset-path">Saved to: ${assetPath}</div>
          <div class="asset-hint">Tell the AI how to use this file</div>
        </div>
      </div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
};
