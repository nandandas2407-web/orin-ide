'use strict';
const ChatMgr = {
  history: [],   // full message history for AI context
  mode: 'chat',
  lastResponse: '',
  lastFiles: [],
  aborter: null,
  busy: false,
  pendingAssets: [],  // assets uploaded this session for context injection

  SYSTEM: `You are an expert AI coding assistant inside OrinIDE, made by Nandan Das whose github is https://github.com/nandandas2407-web. 

When generating or modifying files, ALWAYS use this exact format for every file:
\`\`\`language:path/to/filename.ext
// full file content here
\`\`\`

Rules:
1. ALWAYS output COMPLETE file contents — never truncate or use placeholder comments like "// rest of code"
2. For multi-file projects, output ALL files using the format above
3. Generate clean, working, well-commented code
4. When asked to generate a project, include every file needed to run it (HTML, CSS, JS, config, etc.)
5. Keep explanations concise; prioritize complete, correct code
6. When the user uploads an asset (image, video, audio), it is stored at the path provided. Use that exact relative path when referencing it in code (e.g. src="assets/photo.jpg")
7. When integrating uploaded media, write the complete modified file — never partial snippets`,

  init() {
    this.history = [{ role: 'system', content: this.SYSTEM }];
    this._bindUI();
    this._syncModel();
  },

  _bindUI() {
    document.getElementById('btn-send').addEventListener('click', () => this.send());
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.mode = btn.dataset.mode;
        this._updatePlaceholder();
      });
    });
    document.getElementById('btn-apply').addEventListener('click', () => this.applyFiles());
    document.getElementById('btn-copy-resp').addEventListener('click', () => copyText(this.lastResponse));
    document.getElementById('btn-chat-clear').addEventListener('click', () => this.clear());
    document.getElementById('btn-chat-stop').addEventListener('click', () => this.stop());
  },

  // Build content string (no attachments, only injected asset context)
  _buildContent(text) {
    return text;
  },

  _syncModel() {
    // Sync badge with saved model — ModelPicker handles all topbar interactions
    const saved = Cfg.get('model', 'openrouter/free');
    this._updateBadge(saved);
  },

  _updateBadge(model) {
    const badge = document.getElementById('model-badge');
    if (!badge) return;
    const short = model.split('/').pop().replace(':free','').replace(/-instruct$/,'');
    badge.textContent = short.toUpperCase().slice(0, 14);
    badge.title = model;
  },

  _updatePlaceholder() {
    const ph = {
      chat: 'Ask AI anything about your code...',
      generate: 'Describe a full project to generate (e.g. "Create a portfolio site")',
      edit: 'Describe how to edit the current file...',
      explain: 'Ask AI to explain the current file or selection...'
    };
    document.getElementById('chat-input').placeholder = ph[this.mode] || ph.chat;
  },

  async send() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || this.busy) return;

    const s = Cfg.all();
    if (!s.apiKey) {
      toast('Set your OpenRouter API key in Settings', 'wrn', 4000);
      openModal('settings-modal');
      return;
    }

    input.value = '';
    this.busy = true;
    this._setControls(true);

    // Build user message with context
    let userMsg = text;
    if (this.mode === 'generate') {
      userMsg = `Generate a COMPLETE project: ${text}\n\nOutput ALL necessary files using the \`\`\`lang:filepath format. Every file must be complete and functional.`;
    } else if (this.mode === 'edit' && EditorMgr.active) {
      const code = EditorMgr.getValue();
      userMsg = `File: ${EditorMgr.active}\n\`\`\`\n${code.slice(0, 6000)}\n\`\`\`\n\nEdit request: ${text}`;
    } else if (this.mode === 'explain' && EditorMgr.active) {
      const sel = EditorMgr.getSelected();
      const code = sel || EditorMgr.getValue().slice(0, 4000);
      userMsg = `File: ${EditorMgr.active}\n\`\`\`\n${code}\n\`\`\`\n\nExplain this code.`;
    } else if (this.mode === 'chat' && EditorMgr.active) {
      const code = EditorMgr.getValue().slice(0, 3000);
      if (code) userMsg = `[Context - ${EditorMgr.active}]:\n\`\`\`\n${code}\n\`\`\`\n\nUser: ${text}`;
    }

    // Inject uploaded asset context if any
    if (this.pendingAssets.length > 0) {
      const assetList = this.pendingAssets.map(a => `  - ${a.path} (${a.mimeType}, ${(a.size/1024).toFixed(1)}KB)`).join('\n');
      userMsg = `[Uploaded Assets in project]\n${assetList}\n\n${userMsg}`;
    }

    this._addMsg('user', text);
    const content = this._buildContent(userMsg);
    this.history.push({ role: 'user', content });

    // Thinking indicator
    const thinkId = this._addThinking();

    // Streaming message element
    let streamEl = null;
    let firstChunk = true;
    let fullText = '';

    this.aborter = new AbortController();

    try {
      await API.callAI(
        this.history,
        (delta, total) => {
          fullText = total;
          if (firstChunk) {
            firstChunk = false;
            document.getElementById(thinkId)?.remove();
            streamEl = this._addMsg('assistant', '');
          }
          const body = streamEl?.querySelector('.msg-body');
          if (body) body.innerHTML = renderMD(total);
          // Auto-scroll
          const msgs = document.getElementById('chat-messages');
          msgs.scrollTop = msgs.scrollHeight;
        },
        this.aborter.signal
      );

      if (firstChunk) document.getElementById(thinkId)?.remove();

      if (!fullText) {
        this._addMsg('assistant', 'No response received. Check your API key and model.');
      }

      this.history.push({ role: 'assistant', content: fullText });
      this.lastResponse = fullText;
      this.lastFiles = parseFiles(fullText);

      // Show apply bar if files were generated
      const applyBar = document.getElementById('apply-bar');
      if (this.lastFiles.length > 0) {
        applyBar.classList.remove('hidden');
        toast(`AI generated ${this.lastFiles.length} file(s). Click "Apply All Changes" to write them.`, 'inf', 5000);
      } else {
        applyBar.classList.add('hidden');
      }

    } catch (e) {
      document.getElementById(thinkId)?.remove();
      if (e.name !== 'AbortError') {
        this._addMsg('assistant', 'Error: ' + e.message);
        toast('AI error: ' + e.message, 'err');
      }
    }

    this.busy = false;
    this._setControls(false);
    document.getElementById('chat-input').focus();
  },

  async applyFiles() {
    if (!this.lastFiles.length) return toast('No files to apply', 'wrn');
    if (!FileTree.project) {
      toast('No project open. Create a project first.', 'wrn');
      openModal('project-modal');
      return;
    }

    showLoading(`Writing ${this.lastFiles.length} file(s)...`);
    try {
      const result = await API.writeBatch(FileTree.project, this.lastFiles);
      hideLoading();
      const ok = (result.results || []).filter(r => r.success).length;
      const fail = (result.results || []).filter(r => !r.success).length;

      await FileTree.refresh();

      // Open first file
      if (this.lastFiles.length > 0) {
        await FileTree.openFile(this.lastFiles[0].path);
      }

      // Update any open tabs
      for (const f of this.lastFiles) {
        const tab = EditorMgr.tabs.find(t => t.path === f.path);
        if (tab) { tab.model.setValue(f.content); tab.modified = false; }
      }
      EditorMgr._renderTabs();

      TermMgr.startWatcher();
      toast(`Applied ${ok} file(s)${fail ? ', ' + fail + ' failed' : ''}`, 'ok');

      this.lastFiles = [];
      document.getElementById('apply-bar').classList.add('hidden');
    } catch (e) {
      hideLoading();
      toast('Apply failed: ' + e.message, 'err');
    }
  },

  stop() {
    if (this.aborter) { this.aborter.abort(); this.busy = false; this._setControls(false); }
  },

  clear() {
    document.getElementById('chat-messages').innerHTML = `
      <div class="msg assistant">
        <div class="msg-avatar">AI</div>
        <div class="msg-body"><p>Chat cleared. How can I help you?</p></div>
      </div>`;
    this.history = [{ role: 'system', content: this.SYSTEM }];
    this.lastResponse = ''; this.lastFiles = [];
    document.getElementById('apply-bar').classList.add('hidden');
  },

  _addMsg(role, content) {
    const msgs = document.getElementById('chat-messages');
    const d = document.createElement('div');
    d.className = 'msg ' + role;
    d.innerHTML = `<div class="msg-avatar">${role === 'user' ? 'You' : 'AI'}</div>
      <div class="msg-body">${renderMD(content)}</div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  },

  _addThinking() {
    const id = 'think-' + Date.now();
    const msgs = document.getElementById('chat-messages');
    const d = document.createElement('div');
    d.id = id; d.className = 'msg assistant';
    d.innerHTML = `<div class="msg-avatar">AI</div>
      <div class="msg-body"><div class="thinking"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div></div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return id;
  },

  _setControls(busy) {
    document.getElementById('btn-send').disabled = busy;
    document.getElementById('btn-chat-stop').style.display = busy ? 'flex' : 'none';
  }
};
