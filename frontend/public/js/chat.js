'use strict';
const ChatMgr = {
  history: [],
  mode: 'chat',
  lastResponse: '',
  lastFiles: [],
  lastPatches: [],
  aborter: null,
  busy: false,
  pendingAssets: [],

  SYSTEM: `You are an expert AI coding assistant inside OrinIDE, made by Nandan Das whose github is https://github.com/nandandas2407-web.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — READ CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user asks you to EDIT or FIX an existing file, use the PATCH format — do NOT rewrite the whole file:

@@patch:path/to/file.ext
<<<search
[exact text to find in the file — copy it exactly as-is]
===
[replacement text]
>>>

You can have multiple hunks for the same file by repeating <<<search...>>> blocks under one @@patch: header.
You can patch multiple files by using multiple @@patch: headers.

When the user asks you to CREATE a new file or generate a full project, use the full file format:
\`\`\`language:path/to/filename.ext
// complete file content here
\`\`\`

Rules:
1. For EDITS: ALWAYS use @@patch format. NEVER output the whole file when only changing part of it.
2. For NEW FILES or full project generation: use the \`\`\`lang:path format with COMPLETE content.
3. The search string in @@patch must be copied EXACTLY from the file — character-perfect including whitespace.
4. Keep each search block as short as possible (just enough to be unique) — do not include huge chunks.
5. When the project context is provided, you can read and reference ANY file in the project — not just the open one.
6. Generate clean, working, well-commented code.
7. When the user uploads an asset, use its exact relative path in code (e.g. src="assets/photo.jpg").
8. For websites and portfolios that need images, use free image APIs (no API key needed):
   - Profile photos: https://loremflickr.com/400/400/face,professional,person?random=N
   - Hero/background: https://picsum.photos/seed/hero-N/1920/1080
   - Project thumbnails: https://loremflickr.com/800/500/technology,computer?random=N
   - Nature: https://picsum.photos/seed/nature-N/800/600
   - Team members: https://loremflickr.com/300/300/person,portrait,face?random=N
   NEVER use placeholder services like via.placeholder.com or placehold.it.`,

  init() {
    this.history = [{ role: 'system', content: this.SYSTEM }];
    this._bindUI();
    this._syncModel();
  },

  // Returns base system prompt + any active skill instructions
  _buildSystemPrompt() {
    const skillInstructions = (typeof SkillsMgr !== 'undefined') ? SkillsMgr.getActiveInstructions() : '';
    return this.SYSTEM + skillInstructions;
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
    document.getElementById('btn-apply').addEventListener('click', () => this.applyAll());
    document.getElementById('btn-copy-resp').addEventListener('click', () => copyText(this.lastResponse));
    document.getElementById('btn-chat-clear').addEventListener('click', () => this.clear());
    document.getElementById('btn-chat-stop').addEventListener('click', () => this.stop());
  },

  _buildContent(text) { return text; },

  _syncModel() {
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

  // Reads all project files and returns a formatted context string for the AI
  async _buildProjectContext() {
    if (!FileTree.project) return '';
    try {
      const result = await API.readAllFiles(FileTree.project);
      const files = result.files || [];
      if (!files.length) return '';
      const lines = ['[PROJECT FILES — you may reference any of these in your response]'];
      for (const f of files) {
        const ext = f.path.split('.').pop() || 'txt';
        lines.push(`\n\`\`\`${ext}:${f.path}\n${f.content}\n\`\`\``);
      }
      return lines.join('\n');
    } catch { return ''; }
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

    // Rebuild system prompt each send (includes active skill)
    this.history[0] = { role: 'system', content: this._buildSystemPrompt() };

    // Build project-wide context (non-blocking — fetched fresh each send)
    let projectCtx = '';
    if (FileTree.project && this.mode !== 'explain') {
      projectCtx = await this._buildProjectContext();
    }

    let userMsg = text;

    if (this.mode === 'generate') {
      userMsg = `Generate a COMPLETE project: ${text}\n\nOutput ALL necessary files using the \`\`\`lang:filepath format. Every file must be complete and functional.`;
    } else if (this.mode === 'edit' && EditorMgr.active) {
      // For edit mode: include current file + full project context, ask for patches
      const code = EditorMgr.getValue();
      userMsg = `File to edit: ${EditorMgr.active}\n\`\`\`\n${code}\n\`\`\`\n\nEdit request: ${text}\n\nUse @@patch format to make ONLY the requested changes — do not rewrite the whole file.`;
      if (projectCtx) userMsg += `\n\n${projectCtx}`;
    } else if (this.mode === 'explain' && EditorMgr.active) {
      const sel = EditorMgr.getSelected();
      const code = sel || EditorMgr.getValue().slice(0, 4000);
      userMsg = `File: ${EditorMgr.active}\n\`\`\`\n${code}\n\`\`\`\n\nExplain this code.`;
    } else if (this.mode === 'chat') {
      // Chat mode: inject full project context
      if (projectCtx) {
        userMsg = `${projectCtx}\n\nUser: ${text}`;
      } else if (EditorMgr.active) {
        const code = EditorMgr.getValue().slice(0, 3000);
        if (code) userMsg = `[Context - ${EditorMgr.active}]:\n\`\`\`\n${code}\n\`\`\`\n\nUser: ${text}`;
      }
    }

    if (this.pendingAssets.length > 0) {
      const assetList = this.pendingAssets.map(a => `  - ${a.path} (${a.mimeType}, ${(a.size/1024).toFixed(1)}KB)`).join('\n');
      userMsg = `[Uploaded Assets in project]\n${assetList}\n\n${userMsg}`;
    }

    this._addMsg('user', text);
    const content = this._buildContent(userMsg);
    this.history.push({ role: 'user', content });

    const thinkId = this._addThinking();

    // Streaming state
    let streamEl = null;
    let firstChunk = true;
    let fullText = '';
    let rafId = null;
    let userScrolled = false;
    const msgs = document.getElementById('chat-messages');

    const onUserScroll = () => {
      const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
      userScrolled = !atBottom;
    };
    msgs.addEventListener('scroll', onUserScroll, { passive: true });

    const scrollToBottom = () => {
      if (!userScrolled) msgs.scrollTop = msgs.scrollHeight;
    };

    const scheduleRender = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const body = streamEl?.querySelector('.msg-body');
        if (body) {
          body.innerHTML = renderMD(fullText);
          scrollToBottom();
        }
      });
    };

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
            userScrolled = false;
          }
          scheduleRender();
        },
        this.aborter.signal
      );

      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (streamEl) {
        const body = streamEl.querySelector('.msg-body');
        if (body) body.innerHTML = renderMD(fullText);
        scrollToBottom();
      }

      if (firstChunk) document.getElementById(thinkId)?.remove();

      if (!fullText) {
        this._addMsg('assistant', 'No response received. Check your API key and model.');
      }

      this.history.push({ role: 'assistant', content: fullText });
      this.lastResponse = fullText;
      this.lastFiles = parseFiles(fullText);
      this.lastPatches = parsePatches(fullText);

      const applyBar = document.getElementById('apply-bar');
      const hasChanges = this.lastFiles.length > 0 || this.lastPatches.length > 0;
      if (hasChanges) {
        applyBar.classList.remove('hidden');
        const patchCount = this.lastPatches.reduce((n, p) => n + p.hunks.length, 0);
        if (this.lastPatches.length > 0) {
          toast(`AI has ${patchCount} surgical edit(s) across ${this.lastPatches.length} file(s). Click "Apply All Changes".`, 'inf', 5000);
        } else {
          toast(`AI generated ${this.lastFiles.length} file(s). Click "Apply All Changes" to write them.`, 'inf', 5000);
        }
      } else {
        applyBar.classList.add('hidden');
      }

    } catch (e) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      document.getElementById(thinkId)?.remove();
      if (e.name !== 'AbortError') {
        this._addMsg('assistant', 'Error: ' + e.message);
        toast('AI error: ' + e.message, 'err');
      }
    }

    msgs.removeEventListener('scroll', onUserScroll);
    this.busy = false;
    this._setControls(false);
    document.getElementById('chat-input').focus();
  },

  // Applies patches (surgical edits) OR full file writes, depending on what AI returned
  async applyAll() {
    const hasFiles   = this.lastFiles.length > 0;
    const hasPatches = this.lastPatches.length > 0;
    if (!hasFiles && !hasPatches) return toast('No changes to apply', 'wrn');

    if (!FileTree.project) {
      toast('No project open. Create a project first.', 'wrn');
      openModal('project-modal');
      return;
    }

    // Capture diff origin before any writes
    const firstPath = (this.lastPatches[0]?.path) || (this.lastFiles[0]?.path);
    if (firstPath && EditorMgr.active) {
      DiffViewer.captureOrig();
    }

    if (hasPatches) {
      // ── Surgical patch mode ──────────────────────────────────────────
      showLoading(`Applying surgical edits...`);
      let totalApplied = 0, totalFailed = 0;
      let finalContent = null;
      let patchedPath  = null;

      for (const patch of this.lastPatches) {
        try {
          const result = await API.applyPatch(FileTree.project, patch.path, patch.hunks);
          totalApplied += result.applied || 0;
          totalFailed  += result.failed  || 0;
          if (result.failed > 0) {
            const failures = (result.detail || []).filter(d => !d.ok).map(d => `"${d.search}" — ${d.reason}`).join('; ');
            toast(`${result.failed} hunk(s) failed in ${patch.path}: ${failures}`, 'wrn', 6000);
          }
          // Remember the final content for diff viewer (last patched file)
          if (result.content !== undefined) {
            finalContent = result.content;
            patchedPath  = patch.path;
          }
        } catch (e) {
          totalFailed++;
          toast(`Patch error for ${patch.path}: ${e.message}`, 'err', 5000);
        }
      }

      hideLoading();
      await FileTree.refresh();

      // Reload affected tabs and open first patched file
      for (const patch of this.lastPatches) {
        const tab = EditorMgr.tabs.find(t => t.path === patch.path);
        if (tab) {
          try {
            const fileData = await API.readFile(FileTree.project, patch.path);
            tab.model.setValue(fileData.content || '');
            tab.modified = false;
          } catch {}
        }
      }
      EditorMgr._renderTabs();

      if (patchedPath) {
        await FileTree.openFile(patchedPath);
        // Show diff if single file patched and we captured the original
        if (this.lastPatches.length === 1 && finalContent !== null && DiffViewer._orig) {
          DiffViewer.show(finalContent);
        }
      }

      TermMgr.startWatcher();
      if (totalFailed === 0) {
        toast(`Applied ${totalApplied} surgical edit(s) — file(s) updated in-place`, 'ok');
      } else {
        toast(`${totalApplied} applied, ${totalFailed} failed — check warnings above`, 'wrn');
      }

    } else {
      // ── Full file write mode (for new files / full project generation) ─
      showLoading(`Writing ${this.lastFiles.length} file(s)...`);
      try {
        const result = await API.writeBatch(FileTree.project, this.lastFiles);
        hideLoading();
        const ok   = (result.results || []).filter(r => r.success).length;
        const fail = (result.results || []).filter(r => !r.success).length;

        await FileTree.refresh();

        if (this.lastFiles.length > 0) {
          await FileTree.openFile(this.lastFiles[0].path);
          if (this.lastFiles.length === 1 && DiffViewer._orig) {
            DiffViewer.show(this.lastFiles[0].content);
          }
        }

        for (const f of this.lastFiles) {
          const tab = EditorMgr.tabs.find(t => t.path === f.path);
          if (tab) { tab.model.setValue(f.content); tab.modified = false; }
        }
        EditorMgr._renderTabs();

        TermMgr.startWatcher();
        toast(`Applied ${ok} file(s)${fail ? ', ' + fail + ' failed' : ''}`, 'ok');
      } catch (e) {
        hideLoading();
        toast('Apply failed: ' + e.message, 'err');
      }
    }

    this.lastFiles   = [];
    this.lastPatches = [];
    document.getElementById('apply-bar').classList.add('hidden');
  },

  // Keep old applyFiles as alias for compatibility
  async applyFiles() { return this.applyAll(); },

  stop() {
    if (this.aborter) { this.aborter.abort(); this.busy = false; this._setControls(false); }
  },

  clear() {
    document.getElementById('chat-messages').innerHTML = `
      <div class="msg assistant">
        <div class="msg-avatar">AI</div>
        <div class="msg-body"><p>Chat cleared. How can I help you?</p></div>
      </div>`;
    this.history = [{ role: 'system', content: this._buildSystemPrompt() }];
    this.lastResponse = ''; this.lastFiles = []; this.lastPatches = [];
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

