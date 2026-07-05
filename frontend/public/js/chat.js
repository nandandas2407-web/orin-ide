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
  // Continuation state
  _continuing: false,
  _continueCount: 0,
  _maxContinues: 10,
  _partialCode: '',

  SYSTEM: `You are a code generation engine. Output ONLY code in the exact format below. No explanations unless asked.

FORMAT FOR NEW FILES (one per file, no wrapping in outer fences):
\`\`\`lang:filename.ext
full complete code here
\`\`\`

FORMAT FOR EDITS:
@@patch:filename.ext
<<<search
exact lines to find
===
new lines
>>>

RULES:
- Output code ONLY — no "Here is the code", no "I'll create", no commentary before code blocks
- Every file MUST be complete — no TODOs, no placeholders, no "... rest of code"
- Each file gets its own \`\`\`lang:filename.ext fence
- NEVER stop mid-file. Write the ENTIRE file content then close with \`\`\`
- If a project is open, modify it using @@patch — do NOT regenerate entire files
- The "Apply to Codebase" button depends on this exact format

EXAMPLE:
\`\`\`html:index.html
<!DOCTYPE html>
<html><head><title>App</title></head>
<body><h1>Hello</h1></body>
</html>
\`\`\`
\`\`\`css:style.css
body { margin: 0; color: #333; }
\`\`\``,

  init() {
    this.history = [{ role: 'system', content: this.SYSTEM }];
    this._bindUI();
    this._syncModel();
  },

  _buildSystemPrompt(fileTree = '') {
    const skillInstructions = (typeof SkillsMgr !== 'undefined') ? SkillsMgr.getActiveInstructions() : '';
    let projectContext = '';
    if (FileTree.project) {
      projectContext = `\n\nPROJECT "${FileTree.project}" is open. Modify it — do NOT ask what to build. Use @@patch for edits, \`\`\`lang:file for new files.`;
      if (fileTree) {
        projectContext += `\nFiles:\n${fileTree}`;
      }
    }
    // Patch mode gets a completely different system prompt
    if (this.mode === 'patch') {
      return `You are a code patching engine. Output ONLY @@patch blocks. NEVER create new files or rewrite files.

@@patch:filepath
<<<search
exact line(s) from the file
===
new replacement line(s)
>>>

RULES: Output ONLY @@patch. No code fences. No explanations. No full files. Each search must match the file exactly.` + projectContext + skillInstructions;
    }
    return this.SYSTEM + projectContext + skillInstructions;
  },

  _bindUI() {
    document.getElementById('btn-send')?.addEventListener('click', () => this.send());
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
      // Ctrl+Shift+F to switch to edit mode
      if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); this.setMode('edit'); }
    });
    document.getElementById('btn-apply')?.addEventListener('click', () => this.applyAll());
    document.getElementById('btn-preview-patch')?.addEventListener('click', () => this.togglePatchPreview());
    document.getElementById('btn-copy-resp')?.addEventListener('click', () => copyText(this.lastResponse));
    document.getElementById('btn-chat-clear')?.addEventListener('click', () => this.clear());
    document.getElementById('btn-chat-stop')?.addEventListener('click', () => this.stop());
    document.getElementById('btn-chat-sessions')?.addEventListener('click', () => ChatSessions.open());

    // Auto-resize textarea
    const inp = document.getElementById('chat-input');
    if (inp) {
      inp.addEventListener('input', () => {
        inp.style.height = 'auto';
        inp.style.height = Math.min(inp.scrollHeight, 150) + 'px';
      });
    }
  },

  _buildContent(text) { return text; },

  _syncModel() {
    const saved = Cfg.get('model', 'openrouter/free');
    this._updateBadge(saved);
  },

  _updateBadge(model) {
    const badge = document.getElementById('model-badge');
    const label = document.getElementById('model-badge-label');
    if (!badge || !label) return;
    const short = model.split('/').pop().replace(':free','').replace(/-instruct$/,'');
    label.textContent = short.toUpperCase().slice(0, 14);
    badge.title = 'Switch AI model — currently: ' + model;
  },

  setMode(mode) {
    this.mode = mode;
    this._updatePlaceholder();
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
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

  async _buildProjectContext(userMsg) {
    if (!FileTree.project) return { contextStr: '', files: [], fileTree: '' };
    try {
      const result = await API.readAllFiles(FileTree.project);
      const files = result.files || [];
      if (!files.length) return { contextStr: '', files: [], fileTree: '' };

      // Build flat file tree listing (cap at 2000 chars to keep system prompt reasonable)
      const allPaths = files.map(f => f.path);
      let fileTree = allPaths.join('\n');
      if (fileTree.length > 2000) {
        fileTree = allPaths.slice(0, 80).join('\n') + `\n... and ${allPaths.length - 80} more files`;
      }

      // Token-aware: rank files by relevance to user message, then fit within budget
      const model = Cfg.get('model', 'openrouter/free');
      const budget = (typeof TokenEst !== 'undefined') ? TokenEst.getProjectBudget(model) : 16000;

      // Rank files by relevance to user query
      const keywords = (userMsg || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const scored = files.map(f => {
        const name = f.path.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (name.includes(kw)) score += 10;
        }
        // Boost common entry files
        if (/index\.(js|html|ts|jsx|tsx)$/.test(f.path)) score += 5;
        if (/main\.(js|ts|py|go)$/.test(f.path)) score += 5;
        if (/app\.(js|ts|jsx|tsx)$/.test(f.path)) score += 4;
        if (/style|css|theme/.test(name)) score += 2;
        if (/config|package|tsconfig/.test(name)) score += 3;
        return { ...f, score, ext: (f.path.split('.').pop() || 'txt').toLowerCase() };
      });
      scored.sort((a, b) => b.score - a.score);

      // Fit within token budget
      const fitted = (typeof TokenEst !== 'undefined')
        ? TokenEst.fitContext(scored, budget, userMsg)
        : { files: scored.slice(0, 10), totalTokens: 0, truncated: false };

      const lines = [`[PROJECT: ${FileTree.project} — ${files.length} files]`];
      lines.push(`[FILE TREE]\n${fileTree}\n`);
      lines.push('[FILE CONTENTS — reference these in your response]');
      for (const f of fitted.files) {
        lines.push(`\n\`\`\`${f.ext}:${f.path}\n${f.content}\n\`\`\``);
      }
      return { contextStr: lines.join('\n'), files: fitted.files, truncated: fitted.truncated, fileTree };
    } catch (e) {
      console.error('[Chat] _buildProjectContext failed:', e);
      return { contextStr: '', files: [], fileTree: '' };
    }
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
    input.style.height = 'auto';
    this.busy = true;
    this._setControls(true);

    // Reset continuation state for new message
    this._continueCount = 0;
    this._partialCode = '';
    this._continuing = false;

    // Token-aware context budget
    const model = Cfg.get('model', 'openrouter/free');
    const modelLimit = (typeof TokenEst !== 'undefined') ? TokenEst.getModelLimit(model) : 32000;
    const isFree = (typeof TokenEst !== 'undefined') ? TokenEst.isSmallContext(model) : false;
    const maxOutput = isFree ? 4096 : 8192;
    const safetyMargin = isFree ? 500 : 1000;
    const historyBudget = Math.max(500, modelLimit - maxOutput - safetyMargin);

    // Build project context first so system prompt can include file tree
    let projectCtx = '';
    let fileTree = '';
    if (FileTree.project && this.mode !== 'explain') {
      const ctx = await this._buildProjectContext(text);
      projectCtx = ctx.contextStr;
      fileTree = ctx.fileTree || '';
    }

    this.history[0] = { role: 'system', content: this._buildSystemPrompt(fileTree) };

    let userMsg = text;

    if (this.mode === 'generate') {
      if (FileTree.project) {
        userMsg = `You are working on project "${FileTree.project}". The user wants: ${text}\n\nOutput ALL necessary files using the \`\`\`lang:filepath format. Every file must be complete and functional. Consider the existing project structure.`;
        if (projectCtx) userMsg += `\n\n${projectCtx}`;
      } else {
        userMsg = `Generate a COMPLETE project: ${text}\n\nOutput ALL necessary files using the \`\`\`lang:filepath format. Every file must be complete and functional.`;
      }
    } else if (this.mode === 'edit' && EditorMgr.active) {
      const code = EditorMgr.getValue().slice(0, 4000);
      userMsg = `File to edit: ${EditorMgr.active}\n\`\`\`\n${code}\n\`\`\`\n\nEdit request: ${text}\n\nUse @@patch format to make ONLY the requested changes — do not rewrite the whole file.`;
      if (projectCtx) userMsg += `\n\n${projectCtx}`;
    } else if (this.mode === 'patch' && EditorMgr.active) {
      const code = EditorMgr.getValue();
      userMsg = `EDIT THIS FILE — output ONLY @@patch blocks. Do NOT rewrite the file. Do NOT explain.

FILE: ${EditorMgr.active}
\`\`\`
${code}
\`\`\`

REQUEST: ${text}

OUTPUT FORMAT:
@@patch:${EditorMgr.active}
<<<search
exact line(s) to find — copy from the file above
===
replacement line(s)
>>>

RULES: ONLY output @@patch blocks. Each search must match the file exactly. Multiple changes = multiple blocks. Do NOT output full files, code fences, or explanations.`;
    } else if (this.mode === 'patch' && !EditorMgr.active) {
      userMsg = `No file is open. Open a file in the editor first, then describe what to change. The AI will output only @@patch diffs.`;
    } else if (this.mode === 'explain' && EditorMgr.active) {
      const sel = EditorMgr.getSelected();
      const code = sel || EditorMgr.getValue().slice(0, 4000);
      userMsg = `File: ${EditorMgr.active}\n\`\`\`\n${code}\n\`\`\`\n\nExplain this code.`;
    } else if (this.mode === 'chat') {
      if (projectCtx) {
        userMsg = `${projectCtx}\n\nUser: ${text}\n\nRemember: output ALL code using \`\`\`lang:filename.ext format. Use @@patch:filename.ext for edits.`;
      } else if (EditorMgr.active) {
        const code = EditorMgr.getValue().slice(0, 3000);
        if (code) userMsg = `[Context - ${EditorMgr.active}]:\n\`\`\`\n${code}\n\`\`\`\n\nUser: ${text}\n\nRemember: output ALL code using \`\`\`lang:filename.ext format. Use @@patch:filename.ext for edits.`;
      }
    }

    if (this.pendingAssets.length > 0) {
      const assetList = this.pendingAssets.map(a => `  - ${a.path} (${a.mimeType}, ${(a.size/1024).toFixed(1)}KB)`).join('\n');
      userMsg = `[Uploaded Assets in project]\n${assetList}\n\n${userMsg}`;
    }

    this._addMsg('user', text);
    const content = this._buildContent(userMsg);
    this.history.push({ role: 'user', content });

    // Token-aware history pruning: trim old messages to fit budget
    if (typeof TokenEst !== 'undefined') {
      this.history = TokenEst.fitHistory(this.history, historyBudget);
      // Ensure system prompt stays current
      this.history[0] = { role: 'system', content: this._buildSystemPrompt(fileTree) };
    }

    const thinkId = this._addThinking();

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

    const doRender = () => {
      rafId = null;
      const body = streamEl?.querySelector('.msg-body');
      if (body && fullText) {
        body.innerHTML = this._renderWithCopy(fullText);
        scrollToBottom();
      }
    };

    const scheduleRender = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(doRender);
    };

    this.aborter = new AbortController();

    try {
      await API.callAI(
        this.history,
        (delta, total) => {
          fullText = total || (fullText + (delta || ''));
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
        if (body) body.innerHTML = this._renderWithCopy(fullText);
        scrollToBottom();
      }

      if (firstChunk) document.getElementById(thinkId)?.remove();

      if (!fullText) {
        this._addMsg('assistant', 'No response received. Check your API key and model.');
      }

      // In patch mode: convert full file rewrites to @@patch format automatically
      if (this.mode === 'patch' && fullText) {
        const currentFiles = {};
        // Gather ALL open tabs so we can match any file the AI outputs
        if (EditorMgr.tabs) {
          for (const tab of EditorMgr.tabs) {
            try {
              currentFiles[tab.path] = tab.model.getValue();
            } catch (e) {}
          }
        }
        const converted = convertFullFileToPatch(fullText, currentFiles);
        if (converted !== fullText) {
          fullText = converted;
          // Re-render with converted text
          if (streamEl) {
            const body = streamEl.querySelector('.msg-body');
            if (body) body.innerHTML = this._renderWithCopy(fullText);
          }
        }
      }

      this.history.push({ role: 'assistant', content: fullText });
      this.lastResponse = fullText;
      this.lastFiles = parseFiles(fullText);
      this.lastPatches = parsePatches(fullText);

      const usage = API._lastUsage;
      const tokenEl = document.getElementById('token-usage');
      const tokenText = document.getElementById('token-usage-text');
      if (usage && (usage.prompt_tokens || usage.completion_tokens) && tokenEl && tokenText) {
        const modelLimit = (typeof TokenEst !== 'undefined') ? TokenEst.getModelLimit(model) : 0;
        const limitStr = modelLimit ? ` / ${modelLimit} limit` : '';
        tokenText.textContent = `Tokens: ${usage.prompt_tokens || '?'} in ${usage.completion_tokens || '?'} out${limitStr}`;
        tokenEl.classList.remove('hidden');
      } else if (tokenEl) {
        tokenEl.classList.add('hidden');
      }

      const applyBar = document.getElementById('apply-bar');
      const hasChanges = this.lastFiles.length > 0 || this.lastPatches.length > 0;
      if (hasChanges) {
        if (applyBar) applyBar.classList.remove('hidden');
        const patchCount = this.lastPatches.reduce((n, p) => n + p.hunks.length, 0);
        if (this.lastPatches.length > 0) {
          toast(`AI has ${patchCount} surgical edit(s) across ${this.lastPatches.length} file(s). Click "Apply All Changes".`, 'inf', 5000);
        } else {
          toast(`AI generated ${this.lastFiles.length} file(s). Click "Apply All Changes" to write them.`, 'inf', 5000);
        }
        this._renderPatchPreview();
      } else {
        if (applyBar) applyBar.classList.add('hidden');
      }

      // Show Continue button if generation was incomplete
      if (fullText && this._isIncomplete(fullText) && streamEl) {
        this._partialCode = fullText;
        if (this._continueCount < this._maxContinues) {
          // Auto-continue silently
          this._addContinueButton(streamEl);
          // Trigger auto-continue after short delay
          this.busy = false;
          this._continuing = false;
          this._setControls(false);
          setTimeout(() => this.continueGeneration(), 500);
          return;
        } else {
          this._addFallbackPanel(streamEl);
        }
      }

    } catch (e) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      document.getElementById(thinkId)?.remove();
      if (e.name !== 'AbortError') {
        let msg = e.message;
        if (msg === 'Failed to fetch') msg = 'Network error — could not reach AI server. Check your internet connection and API key in Settings.';
        this._addMsg('assistant', 'Error: ' + msg);
        toast('AI error: ' + msg, 'err');
      }
    }

    msgs.removeEventListener('scroll', onUserScroll);
    this.busy = false;
    this._setControls(false);

    if (typeof ChatSessions !== 'undefined') {
      ChatSessions.saveCurrentHistory(this.history);
    }
    document.getElementById('chat-input').focus();
  },

  async applyAll() {
    const hasFiles   = this.lastFiles.length > 0;
    const hasPatches = this.lastPatches.length > 0;
    if (!hasFiles && !hasPatches) return toast('No changes to apply', 'wrn');

    if (!FileTree.project) {
      toast('No project open. Create a project first.', 'wrn');
      openModal('project-modal');
      return;
    }

    const firstPath = (this.lastPatches[0]?.path) || (this.lastFiles[0]?.path);
    if (firstPath && EditorMgr.active) {
      try { DiffViewer.captureOrig(); } catch (e) { console.warn('[apply] DiffViewer.captureOrig:', e.message); }
    }

    if (hasPatches) {
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
    document.getElementById('apply-bar')?.classList.add('hidden');
    document.getElementById('patch-preview')?.classList.add('hidden');
  },

  async applyFiles() { return this.applyAll(); },

  togglePatchPreview() {
    const el = document.getElementById('patch-preview');
    if (!el) return;
    el.classList.toggle('hidden');
  },

  _renderPatchPreview() {
    const el = document.getElementById('patch-preview');
    const body = document.getElementById('pp-body');
    const count = document.getElementById('pp-count');
    if (!el || !body) return;
    const patches = this.lastPatches;
    const files = this.lastFiles;
    const total = patches.length + files.length;
    if (total === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    if (count) count.textContent = total + ' file' + (total > 1 ? 's' : '');
    let html = '';
    for (const p of patches) {
      const h = p.hunks ? p.hunks.length + ' edit(s)' : '';
      html += '<div class="pp-file"><span class="pp-status mod">M</span>' + esc(p.path) + ' <span style="color:var(--tx3)">' + h + '</span></div>';
    }
    for (const f of files) {
      html += '<div class="pp-file"><span class="pp-status add">A</span>' + esc(f.path) + '</div>';
    }
    body.innerHTML = html;
  },

  stop() {
    this._continueCount = this._maxContinues; // Prevent auto-continue
    this._continuing = false;
    if (this.aborter) { this.aborter.abort(); this.busy = false; this._setControls(false); }
  },

  clear() {
    document.getElementById('chat-messages').innerHTML = `
      <div class="chat-empty" id="chat-empty">
        <div class="ce-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="ce-title">AI Assistant</div>
        <div class="ce-sub">Select a mode above and type your request...</div>
      </div>`;
    this.history = [{ role: 'system', content: this._buildSystemPrompt() }];
    this.lastResponse = ''; this.lastFiles = []; this.lastPatches = [];
    document.getElementById('apply-bar')?.classList.add('hidden');
    document.getElementById('token-usage')?.classList.add('hidden');
    const pp = document.getElementById('patch-preview');
    if (pp) pp.classList.add('hidden');
  },

  loadHistory(history) {
    if (!Array.isArray(history) || !history.length) return;
    this.history = history;
    this.history[0] = { role: 'system', content: this._buildSystemPrompt() };
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    msgs.innerHTML = '';
    for (const m of this.history) {
      if (m.role === 'system') continue;
      this._addMsg(m.role, m.content);
    }
    toast('Session loaded', 'ok');
  },

  _renderWithCopy(text) {
    return renderMD(text);
  },

  // ── CONTINUATION SYSTEM ──────────────────────────────────────────

  _isIncomplete(text) {
    // Prefer the API's own finish_reason/stop_reason (ground truth) over
    // guessing from text shape — see ResponseCompleteness in utils.js.
    const finishReason = (typeof API !== 'undefined') ? API._lastFinishReason : null;
    if (typeof ResponseCompleteness !== 'undefined') {
      return ResponseCompleteness.isIncomplete(text, finishReason);
    }
    // Extremely defensive fallback if utils.js somehow didn't load.
    return !!(text && text.length > 20 && (text.match(/^```/gm) || []).length % 2 !== 0);
  },

  _addContinueButton(streamEl) {
    if (!streamEl) return;
    const body = streamEl.querySelector('.msg-body');
    if (!body) return;
    body.querySelector('.continue-bar')?.remove();
    const remaining = this._maxContinues - this._continueCount;
    const bar = document.createElement('div');
    bar.className = 'continue-bar';
    bar.innerHTML = `
      <button class="continue-btn" onclick="ChatMgr.continueGeneration()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Continue${remaining < this._maxContinues ? ` (${remaining} left)` : ''}
      </button>
      <span class="continue-hint">Generation stopped — click to resume</span>
    `;
    body.appendChild(bar);
  },

  _addFallbackPanel(streamEl) {
    if (!streamEl) return;
    const body = streamEl.querySelector('.msg-body');
    if (!body) return;
    body.querySelector('.continue-bar')?.remove();
    const bar = document.createElement('div');
    bar.className = 'continue-bar';
    bar.innerHTML = `
      <span class="continue-hint" style="flex:1">Generation incomplete. Save partial code to a project?</span>
      <button class="continue-btn" onclick="ChatMgr._savePartialToProject()" style="background:var(--bg3);font-size:11px">
        Save to Project
      </button>
    `;
    body.appendChild(bar);
  },

  async _savePartialToProject() {
    if (!this._partialCode || !FileTree.project) {
      toast('Open a project first, then try again', 'wrn');
      return;
    }
    const files = parseFiles(this._partialCode);
    if (!files.length) {
      toast('No parseable files in partial code', 'wrn');
      return;
    }
    try {
      await API.writeBatch(FileTree.project, files.map(f => ({ path: f.path, content: f.content })));
      await FileTree.refresh();
      toast(`Saved ${files.length} file(s) to ${FileTree.project}`, 'ok');
    } catch (e) {
      toast('Save failed: ' + e.message, 'err');
    }
  },

  _extractLastFilename(text) {
    // Find the last open code fence and extract the filename
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/^```(\w+):([^\s`]+)/);
      if (m) return { lang: m[1], filename: m[2] };
    }
    return null;
  },

  async continueGeneration() {
    if (this.busy) return;
    if (this._continueCount >= this._maxContinues) {
      toast('Maximum continuations reached. Apply what you have or start a new request.', 'wrn', 5000);
      return;
    }

    const msgs = document.querySelectorAll('#chat-messages .msg.assistant');
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg) return;
    const body = lastMsg.querySelector('.msg-body');
    if (!body) return;
    body.querySelector('.continue-bar')?.remove();

    const prevText = this.lastResponse;
    if (!prevText) return;

    const s = Cfg.all();
    if (!s.apiKey) {
      toast('Set your API key in Settings', 'wrn', 4000);
      return;
    }

    this.busy = true;
    this._continuing = true;
    this._continueCount++;
    this._partialCode = prevText;
    this._setControls(true);

    // Extract the last incomplete code block to show the AI exactly what to finish
    const lastFile = this._extractLastFilename(prevText);
    // Get the last code fence that's still open
    const lines = prevText.split('\n');
    let lastOpenFenceIdx = -1;
    let fenceCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^```/)) {
        fenceCount++;
        if (fenceCount % 2 === 1) lastOpenFenceIdx = i;
      }
    }
    // Get the partial code from the last open fence onwards
    const partialFromFence = lastOpenFenceIdx >= 0 ? lines.slice(lastOpenFenceIdx).join('\n') : '';
    // Also get some completed files for context
    const completedFiles = [];
    let fCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^```[\w]+:[\S]+/)) {
        fCount++;
        if (fCount % 2 === 1) {
          // Opening fence - find matching close
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() === '```') {
              completedFiles.push(lines.slice(i, j + 1).join('\n'));
              break;
            }
          }
        }
      }
    }
    // Take last 2 completed files for context
    const contextFiles = completedFiles.slice(-2).join('\n\n');

    // Build the continuation prompt that the AI actually understands
    const fname = lastFile ? lastFile.filename : 'the file';
    const userRequest = this.history.find(m => m.role === 'user' && !m.content.startsWith('[CONTINUATION'));
    const originalRequest = userRequest ? userRequest.content.slice(0, 500) : '';

    const continueMsg = `Complete this code. The file "${fname}" was cut off mid-write. Continue writing from where it stops — do NOT restart from the beginning.

${originalRequest ? `Original request: ${originalRequest}\n\n` : ''}${contextFiles ? `Previously completed files:\n${contextFiles}\n\n` : ''}Incomplete file (continue from the last line):
${partialFromFence}

Write the rest of "${fname}" now. Close the code fence when done.`;

    // Build a minimal message history — system + original request + continuation instruction
    // The partial code is already in the continueMsg, no need to duplicate it
    const originalUserMsg = this.history.find(m => m.role === 'user' && !m.content.startsWith('[CONTINUATION'));
    const minimalHistory = [
      this.history[0], // system prompt
      ...(originalUserMsg ? [originalUserMsg] : []),
      { role: 'user', content: continueMsg }
    ];

    this.history.push({ role: 'user', content: continueMsg });

    const thinkId = this._addThinking();

    let firstChunk = true;
    let continuationText = '';
    let rafId = null;
    let userScrolled = false;
    const msgsContainer = document.getElementById('chat-messages');

    const onUserScroll = () => {
      const atBottom = msgsContainer.scrollHeight - msgsContainer.scrollTop - msgsContainer.clientHeight < 60;
      userScrolled = !atBottom;
    };
    msgsContainer.addEventListener('scroll', onUserScroll, { passive: true });

    const scrollToBottom = () => {
      if (!userScrolled) msgsContainer.scrollTop = msgsContainer.scrollHeight;
    };

    const doRender = () => {
      rafId = null;
      const b = lastMsg.querySelector('.msg-body');
      if (b) {
        b.innerHTML = this._renderWithCopy(prevText + continuationText);
        scrollToBottom();
      }
    };

    const scheduleRender = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(doRender);
    };

    this.aborter = new AbortController();

    try {
      await API.callAI(
        minimalHistory,
        (delta, total) => {
          continuationText = total || (continuationText + (delta || ''));
          if (firstChunk) {
            firstChunk = false;
            document.getElementById(thinkId)?.remove();
            userScrolled = false;
          }
          scheduleRender();
        },
        this.aborter.signal
      );

      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

      const mergedText = prevText + continuationText;
      const b = lastMsg.querySelector('.msg-body');
      if (b) b.innerHTML = this._renderWithCopy(mergedText);
      scrollToBottom();

      if (firstChunk) document.getElementById(thinkId)?.remove();

      this.history.push({ role: 'assistant', content: continuationText });
      this.lastResponse = mergedText;
      this.lastFiles = parseFiles(mergedText);
      this.lastPatches = parsePatches(mergedText);
      this._partialCode = mergedText;

      // Auto-continue if still incomplete and haven't hit limit
      if (this._isIncomplete(mergedText) && this._continueCount < this._maxContinues) {
        this.busy = false;
        this._continuing = false;
        this._setControls(false);
        // Auto-continue after short delay
        setTimeout(() => this.continueGeneration(), 300);
        return;
      }

      // Show continue button or fallback
      if (this._isIncomplete(mergedText) && streamEl) {
        if (this._continueCount >= this._maxContinues) {
          this._addFallbackPanel(lastMsg);
        } else {
          this._addContinueButton(lastMsg);
        }
      }

      // Update apply bar
      const applyBar = document.getElementById('apply-bar');
      const hasChanges = this.lastFiles.length > 0 || this.lastPatches.length > 0;
      if (hasChanges) {
        if (applyBar) applyBar.classList.remove('hidden');
        this._renderPatchPreview();
      }

      const usage = API._lastUsage;
      const tokenEl = document.getElementById('token-usage');
      const tokenText = document.getElementById('token-usage-text');
      if (usage && (usage.prompt_tokens || usage.completion_tokens) && tokenEl && tokenText) {
        const ml = (typeof TokenEst !== 'undefined') ? TokenEst.getModelLimit(Cfg.get('model', 'openrouter/free')) : 0;
        const limitStr = ml ? ` / ${ml} limit` : '';
        tokenText.textContent = `Tokens: ${usage.prompt_tokens || '?'} in ${usage.completion_tokens || '?'} out${limitStr}`;
        tokenEl.classList.remove('hidden');
      }

    } catch (e) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      document.getElementById(thinkId)?.remove();
      if (e.name !== 'AbortError') {
        let msg = e.message;
        if (msg === 'Failed to fetch') msg = 'Network error — check your connection.';
        // If continuation failed, show fallback panel
        if (this._partialCode) {
          this._addFallbackPanel(lastMsg);
        }
        toast('Continue error: ' + msg, 'err');
      }
    }

    msgsContainer.removeEventListener('scroll', onUserScroll);
    this.busy = false;
    this._continuing = false;
    this._setControls(false);
    document.getElementById('chat-input').focus();
  },

  _addMsg(role, content) {
    const msgs = document.getElementById('chat-messages');
    // Remove empty state on first message
    const empty = msgs.querySelector('.chat-empty');
    if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = 'msg ' + role;
    const actionsHtml = role === 'assistant' ? `
      <div class="msg-actions">
        <button class="msg-action-btn" onclick="navigator.clipboard.writeText(this.closest('.msg').querySelector('.msg-body').textContent)" title="Copy">Copy</button>
      </div>` : '';
    d.innerHTML = `<div class="msg-body">${this._renderWithCopy(content)}${actionsHtml}</div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  },

  _addThinking() {
    const id = 'think-' + Date.now();
    const msgs = document.getElementById('chat-messages');
    // Remove empty state on first message
    const empty = msgs.querySelector('.chat-empty');
    if (empty) empty.remove();
    const d = document.createElement('div');
    d.id = id; d.className = 'msg assistant';
    d.innerHTML = `<div class="msg-body"><div class="thinking"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div></div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return id;
  },

  _setControls(busy) {
    document.getElementById('btn-send').disabled = busy;
    document.getElementById('btn-chat-stop')?.classList.toggle('visible', busy);
  }
};
window.ChatMgr = ChatMgr;
