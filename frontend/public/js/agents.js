'use strict';
/* ================================================================
   AGENTS MANAGER — Multi-Agent Collaboration Mode
   Spawns a team of 3-4 AI agents that collaborate on a task.
   ================================================================ */

const AgentsMgr = {
  // Agent role definitions
  AGENT_ROLES: [
    { id: 'architect',  label: 'Architect',  color: '#c9a6ff', desc: 'Plans architecture & design' },
    { id: 'coder',      label: 'Coder',      color: '#4ade80', desc: 'Implements the solution' },
    { id: 'reviewer',   label: 'Reviewer',   color: '#fbbf24', desc: 'Reviews code & finds issues' },
    { id: 'integrator', label: 'Integrator', color: '#60a5fa', desc: 'Merges final result' },
  ],

  // System prompts per agent role
  AGENT_SYSTEMS: {
    architect: `You are a world-class Software Architect and Technical Lead. You design systems that scale.

## YOUR MISSION
Analyze the user's request. Understand WHAT they want to build and WHY. Then produce a bulletproof architecture plan.

## OUTPUT FORMAT — STRICT

Start with: ## Architecture Plan

Then output:

### Components
- List every module/class/service needed with one-line descriptions

### File Structure
- List EVERY file to create or modify using: \`\`\`language:path/to/file.ext\`\`\`
- Group by directory

### Data Flow
- Describe how components communicate (events, APIs, database, etc.)

### Implementation Order
- Number the files in the order the Coder should implement them

### Commands to Run
- If any shell commands are needed (git init, npm install, etc.), list them with @@cmd: prefix
- Example: @@cmd:git init
- Example: @@cmd:npm install express cors ws

### Key Decisions
- Technology choices and WHY
- Patterns used (MVC, pub/sub, etc.)

## RULES
- Be specific enough that the Coder can generate working code from your plan alone
- Include EVERY file — do not assume the Coder will "figure it out"
- If the project needs a package.json, list it as a file to create
- If the project needs git, list git commands
- Think about error handling, edge cases, and production readiness
- You are the FIRST agent — your plan determines the success of the entire pipeline`,

    coder: `You are a Senior Full-Stack Engineer who writes PRODUCTION-READY code. No shortcuts. No stubs. No TODOs.

## YOUR MISSION
Implement the Architect's plan with COMPLETE, WORKING code for every single file.

## OUTPUT FORMAT — MANDATORY

For NEW files — output each file in this EXACT format:
\`\`\`language:path/to/file.ext
complete file content here — every line, fully implemented
\`\`\`

For EDITS to existing files — use PATCH format:
@@patch:path/to/file.ext
<<<search
exact text from the file (copy character-perfect)
===
replacement text
>>>

For SHELL COMMANDS (git, npm, etc.):
@@cmd:command to run
Example: @@cmd:npm install express ws

## RULES — VIOLATION = FAILURE
1. EVERY file MUST have \`\`\`language:path on its own line
2. EVERY file must be COMPLETE — no "// add more here", no "..." omissions
3. NEVER skip a file from the Architect's plan
4. Include ALL imports, ALL dependencies, ALL error handling
5. Every function must be fully implemented with real logic
6. If a file needs package.json, CREATE IT with all dependencies listed
7. Include @@cmd lines for any setup commands (npm install, git init, etc.)
8. Code must follow modern best practices (ES2022+, async/await, etc.)

## CODE QUALITY
- Handle all error paths
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Follow consistent code style
- Make it production-ready from line 1

## MEDIA APIs — USE REAL ASSETS

When your code needs images, videos, or icons, use these FREE APIs:

### Stock Photos (no API key needed)
- Lorem Picsum: https://picsum.photos/seed/{seed}/{width}/{height}
- LoremFlickr: https://loremflickr.com/{width}/{height}/{keyword}
- Unsplash: https://source.unsplash.com/{width}x{height}/?{keyword}
- JSONPlaceholder: https://jsonplaceholder.typicode.com/photos/{id}

### Stock Videos
- Pexels: https://www.pexels.com/videos/ — free stock videos
- Pixabay: https://pixabay.com/videos/ — free stock videos
- Coverr: https://coverr.co/ — free video backgrounds
- Mixkit: https://mixkit.co/free-stock-video/ — free stock videos
- Openverse: https://api.openverse.org/v1/videos/?q={keyword}

### Animals / Fun
- Cat API: https://cdn2.thecatapi.com/images/{id}.jpg
- Dog API: https://images.dog.ceo/breeds/{breed}/{id}.jpg
- RandomFox: https://randomfox.ca/images/{id}.jpg

### SVG Icons
- Iconify: https://api.iconify.design/{prefix}/{name}.svg
- Tabler Icons: https://tabler-icons.io/i/{name}
- Lucide: https://lucide.dev/icons/{name}
- Bootstrap Icons: https://icons.getbootstrap.com/icons/{name}/
- Heroicons: https://heroicons.com/
- Devicon: https://devicon.dev/

### Illustrations
- unDraw: https://undraw.co/illustrations
- Open Doodles: https://www.opendoodles.com/

You are the SECOND agent. Your code will be reviewed by the Reviewer and finalized by the Integrator.`,

    reviewer: `You are a Principal Engineer and Security Expert. You find what others miss.

## YOUR MISSION
Review the Coder's implementation and find EVERY issue — bugs, security holes, performance problems, missing error handling, incomplete logic.

## OUTPUT FORMAT

Start with: ## Code Review

For each issue found:
### [SEVERITY] File: path — Brief description
- **What**: Describe the issue
- **Why it matters**: Explain the impact
- **Fix**: Show the exact fix with @@patch format

Severity levels:
- [CRITICAL] — Security vulnerability, data loss risk, will crash
- [MAJOR] — Logic bug, missing error handling, will fail in production
- [MINOR] — Code style, naming, could be better
- [GOOD] — No issues found (only if truly perfect)

If code is solid, explicitly say: "## Code Review\nAll files pass review. No issues found."

## SHELL COMMANDS
If any commands are needed to verify or test:
@@cmd:command

## RULES
- Be specific — mention exact file paths and line numbers
- Show the FIX using @@patch format for every issue
- Do NOT nitpick — focus on things that actually matter
- Check for: null references, unhandled promises, missing validation, security flaws
- Check for: incomplete implementations, missing imports, broken references
- If the code is genuinely good, say so — do not invent problems

You are the THIRD agent. The Integrator will incorporate your feedback.`,

    integrator: `You are the Final Integration Engineer. You produce the DEFINITIVE version of the codebase.

## YOUR MISSION
Merge the Architect's plan, the Coder's implementation, and the Reviewer's feedback into a PERFECT final output.

## OUTPUT FORMAT — CRITICAL

Start with: ## Final Result

### Files
For EVERY file, output it in full:
\`\`\`language:path/to/file.ext
complete corrected file content
\`\`\`

### Patches (only for edits to existing files)
@@patch:path/to/file.ext
<<<search
exact text to find
===
corrected replacement
>>>

### Commands
List ALL commands that need to run, in order:
@@cmd:npm install
@@cmd:git init
@@cmd:git add .
@@cmd:git commit -m "Initial commit"
@@cmd:npm start

## RULES
1. Output EVERY file in full — do not skip any
2. Address ALL Reviewer feedback — every single issue
3. Incorporate ALL reviewer fixes into the final code
4. List ALL commands with @@cmd: prefix in execution order
5. Make sure all imports reference correct paths
6. Make sure package.json lists all dependencies
7. Ensure the project will run without errors on first try
8. Do NOT use placeholders, abbreviations, or "// same as before"

## QUALITY CHECKLIST
- [ ] Every file from Architect's plan is included
- [ ] Every Reviewer issue is addressed
- [ ] All dependencies are in package.json
- [ ] All commands are listed with @@cmd:
- [ ] Code is complete and production-ready
- [ ] No TODOs, no stubs, no placeholders

## MEDIA APIs — USE REAL ASSETS

When your code needs images, videos, or icons, use these FREE APIs:

### Stock Photos (no API key needed)
- Lorem Picsum: https://picsum.photos/seed/{seed}/{width}/{height}
- LoremFlickr: https://loremflickr.com/{width}/{height}/{keyword}
- Unsplash: https://source.unsplash.com/{width}x{height}/?{keyword}
- JSONPlaceholder: https://jsonplaceholder.typicode.com/photos/{id}

### Stock Videos
- Pexels: https://www.pexels.com/videos/ — free stock videos
- Pixabay: https://pixabay.com/videos/ — free stock videos
- Coverr: https://coverr.co/ — free video backgrounds
- Mixkit: https://mixkit.co/free-stock-video/ — free stock videos
- Openverse: https://api.openverse.org/v1/videos/?q={keyword}

### Animals / Fun
- Cat API: https://cdn2.thecatapi.com/images/{id}.jpg
- Dog API: https://images.dog.ceo/breeds/{breed}/{id}.jpg
- RandomFox: https://randomfox.ca/images/{id}.jpg

### SVG Icons
- Iconify: https://api.iconify.design/{prefix}/{name}.svg
- Tabler Icons: https://tabler-icons.io/i/{name}
- Lucide: https://lucide.dev/icons/{name}
- Bootstrap Icons: https://icons.getbootstrap.com/icons/{name}/
- Heroicons: https://heroicons.com/
- Devicon: https://devicon.dev/

### Illustrations
- unDraw: https://undraw.co/illustrations
- Open Doodles: https://www.opendoodles.com/

You are the LAST agent. Your output is what gets applied to the user's project. Make it flawless.`,
  },

  // State
  _running: false,
  _aborter: null,
  _conversation: [],
  _currentAgentIndex: -1,
  _agentModels: [],
  _warnShown: false,
  _pendingPrompt: null,
  lastFiles: [],
  lastPatches: [],
  lastCommands: [],
  lastResponse: '',

  // Default models for each agent slot (free models only)
  DEFAULT_MODELS: [
    'z-ai/glm-4.5-air:free',
    'google/gemma-3-27b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openai/gpt-oss-120b:free',
  ],

  init() {
    this._warnShown = !!Cfg.get('agents-warn-shown', false);
    this._loadAgentModels();
    this._bindUI();
    this._showWelcome();
    this._setControls(false);
  },

  _loadAgentModels() {
    const saved = Cfg.get('agent-models', null);
    if (saved && Array.isArray(saved) && saved.length === 4) {
      this._agentModels = saved;
    } else {
      this._agentModels = [...this.DEFAULT_MODELS];
    }
    this._renderConfigRow();
  },

  _saveAgentModels() {
    Cfg.set('agent-models', this._agentModels);
  },

  _bindUI() {
    // Send button
    document.getElementById('btn-agents-send')?.addEventListener('click', () => this.send());
    document.getElementById('agents-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    });
    // Stop button
    document.getElementById('btn-agents-stop')?.addEventListener('click', () => this.stop());
    // Clear button
    document.getElementById('btn-agents-clear')?.addEventListener('click', () => this.clear());
    // Warning modal dismiss
    this._setupWarningModal();
    // Config button
    document.getElementById('btn-agents-config')?.addEventListener('click', () => this._openConfig());
    // Apply / Copy
    document.getElementById('btn-agents-apply')?.addEventListener('click', () => this.applyAll());
    document.getElementById('btn-agents-copy')?.addEventListener('click', () => {
      copyText(this.lastResponse);
      toast('Response copied to clipboard', 'ok', 1500);
    });
  },

  _setupWarningModal() {
    const okBtn = document.getElementById('agents-warning-ok');
    if (okBtn) {
      okBtn.addEventListener('click', () => this.dismissWarning());
    }
  },

  dismissWarning() {
    const cb = document.getElementById('agents-warning-dismiss');
    if (cb?.checked) {
      this._warnShown = true;
      Cfg.set('agents-warn-shown', true);
    }
    closeModal('agents-warning-modal');
    if (this._pendingPrompt) {
      const text = this._pendingPrompt;
      this._pendingPrompt = null;
      this._addUserMsg(text);
      this._beginCollaboration(text);
    }
  },

  show() {
    const panel = document.getElementById('agents-panel');
    if (panel && !panel.classList.contains('active')) {
      ActivityBar.toggleAgents();
      setTimeout(() => document.getElementById('agents-input')?.focus(), 100);
    }
  },

  hide() {
    const panel = document.getElementById('agents-panel');
    if (panel && panel.classList.contains('active')) {
      ActivityBar.toggleAgents();
    }
  },

  isVisible() {
    const panel = document.getElementById('agents-panel');
    return panel ? panel.classList.contains('active') : false;
  },

  // ── Send user prompt to start collaboration ──────────────────
  async send() {
    const input = document.getElementById('agents-input');
    const text = input.value.trim();
    if (!text || this._running) return;

    const s = Cfg.all();
    if (!s.apiKey) {
      toast('Set your OpenRouter API key in Settings to use Agents', 'wrn', 4000);
      openModal('settings-modal');
      return;
    }

    input.value = '';

    // Show warning on first use before adding message
    if (!this._warnShown) {
      this._pendingPrompt = text;
      openModal('agents-warning-modal');
      return;
    }

    this._addUserMsg(text);
    await this._beginCollaboration(text);
  },

  async _beginCollaboration(prompt) {
    const text = prompt || this._pendingPrompt;
    this._pendingPrompt = null;
    if (!text) return;

    // Remove welcome
    const welcome = document.getElementById('agents-welcome');
    if (welcome) welcome.style.display = 'none';

    this._running = true;
    this._setControls(true);
    this._setStatus('active', 'Agents collaborating...');
    this._currentAgentIndex = -1;
    this._aborter = new AbortController();

    // Build project context
    let projectCtx = '';
    if (FileTree.project) {
      try {
        const result = await API.readAllFiles(FileTree.project);
        const files = result.files || [];
        if (files.length) {
          const lines = ['[PROJECT FILES]'];
          for (const f of files) {
            const ext = f.path.split('.').pop() || 'txt';
            lines.push(`\n\`\`\`${ext}:${f.path}\n${f.content}\n\`\`\``);
          }
          projectCtx = lines.join('\n');
        }
      } catch {}
    }

    const userContent = projectCtx
      ? `${projectCtx}\n\nUser request: ${text}`
      : `User request: ${text}`;

    // Accumulate conversation for context
    this._conversation = [
      { role: 'system', content: '' }, // per-agent, filled each round
      { role: 'user', content: userContent },
    ];

    let allOutputs = [];
    let aborted = false;

    try {
      // Run each agent sequentially
      for (let i = 0; i < this.AGENT_ROLES.length; i++) {
        if (this._aborter.signal.aborted) { aborted = true; break; }

        const role = this.AGENT_ROLES[i];
        this._currentAgentIndex = i;
        this._setStatus('active', `${role.label} is working...`);

        // Build system prompt with context from previous agents
        let ctx = '';
        if (i > 0) {
          const model = this._agentModels[i] || Cfg.get('model', 'openrouter/free');
          const modelLimit = (typeof TokenEst !== 'undefined') ? TokenEst.getModelLimit(model) : 8192;
          const systemBaseLen = (this.AGENT_SYSTEMS[role.id] || '').length;
          const maxCtxChars = Math.max(2000, (modelLimit * 2) - systemBaseLen - 4000); // reserve 4K tokens for output + safety
          ctx = '\n\n[CONTEXT FROM PREVIOUS AGENTS]\n';
          let ctxLen = 0;
          for (let j = 0; j < i; j++) {
            const label = `\n--- ${this.AGENT_ROLES[j].label} ---\n`;
            let output = allOutputs[j] || '(no output)';
            // Truncate old agent outputs to fit budget
            if (ctxLen + output.length > maxCtxChars) {
              const remaining = maxCtxChars - ctxLen;
              if (remaining > 200) {
                output = output.slice(0, remaining) + '\n... [truncated for context limit]';
              } else {
                output = '(output omitted — context limit)';
              }
            }
            ctx += label + output + '\n';
            ctxLen += label.length + output.length + 1;
          }
          ctx += '\n---END CONTEXT---\n';
        }

        const systemContent = this.AGENT_SYSTEMS[role.id] + ctx;
        this._conversation[0] = { role: 'system', content: systemContent };

        // Run this agent
        const output = await this._runAgent(i, role);
        if (this._aborter.signal.aborted) { aborted = true; break; }
        allOutputs.push(output);
        this._conversation.push({ role: 'assistant', content: output });
      }

      if (aborted) {
        this._addAgentMsg('system', 'Collaboration was stopped.', '#f87171');
        this._setStatus('inactive', 'Stopped');
      } else {
        this._setStatus('inactive', 'Collaboration complete');
        toast('Multi-agent collaboration complete! Review the final result.', 'ok', 4000);
        // Parse integrator output for files/patches/commands
        const integratorOutput = allOutputs[allOutputs.length - 1] || '';
        this.lastResponse = integratorOutput;
        this.lastFiles = parseFiles(integratorOutput);
        this.lastPatches = parsePatches(integratorOutput);
        this.lastCommands = parseCommands(integratorOutput);
        const applyBar = document.getElementById('agents-apply-bar');
        if (applyBar) {
          const hasChanges = this.lastFiles.length > 0 || this.lastPatches.length > 0;
          applyBar.classList.toggle('hidden', !hasChanges);
        }
        // Show command runner if there are commands
        const cmdBar = document.getElementById('agents-cmd-bar');
        const cmdList = document.getElementById('agents-cmd-list');
        if (cmdBar && cmdList && this.lastCommands.length > 0) {
          cmdList.innerHTML = this.lastCommands.map((c, i) =>
            `<div class="agent-cmd-row" data-idx="${i}">
              <span class="agent-cmd-prefix">$</span>
              <code>${this._escapeHtml(c)}</code>
              <button class="agent-cmd-run" onclick="AgentsMgr.runSingleCmd(${i})" title="Run this command">Run</button>
            </div>`
          ).join('');
          cmdBar.classList.remove('hidden');
        } else if (cmdBar) {
          cmdBar.classList.add('hidden');
        }
        // Focus on the last agent's output
        const msgs = document.getElementById('agents-messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      }

    } catch (e) {
      if (e.name !== 'AbortError') {
        this._addAgentMsg('system', 'Error: ' + e.message, '#f87171');
        toast('Agents error: ' + e.message, 'err');
        this._setStatus('inactive', 'Error');
      }
    }

    this._running = false;
    this._setControls(false);
    document.getElementById('agents-input')?.focus();

    // Auto-save session after collaboration completes
    if (typeof AgentSessions !== 'undefined') {
      AgentSessions.saveCurrent();
    }
  },

  // ── Run a single agent with streaming ────────────────────────
  async _runAgent(index, role) {
    const msgEl = this._addAgentMsg(role.id, '', role.label);

    return new Promise((resolve, reject) => {
      let fullText = '';
      let streamEl = null;
      let firstChunk = true;
      let rafId = null;
      let userScrolled = false;

      const msgs = document.getElementById('agents-messages');
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
          const bodyEl = streamEl?.querySelector('.agent-body-content');
          if (bodyEl) {
            bodyEl.innerHTML = this._renderAgentMD(fullText);
            scrollToBottom();
          }
        });
      };

      const doStream = async () => {
        try {
          // Token-aware: trim conversation to fit model budget before sending
          const agentModel = this._agentModels[index] || Cfg.get('model', 'openrouter/free');
          if (typeof TokenEst !== 'undefined') {
            const limit = TokenEst.getModelLimit(agentModel);
            const budget = Math.max(500, limit - 3000); // reserve for output
            // Preserve this agent's system prompt (built in _beginCollaboration)
            // across fitHistory — it lives in _conversation[0], not in a
            // "systemContent" variable, which doesn't exist in this scope.
            const systemMsg = this._conversation[0];
            this._conversation = TokenEst.fitHistory(this._conversation, budget);
            this._conversation[0] = systemMsg;
          }

          await API.callAI(
            this._conversation,
            (delta, total) => {
              fullText = total;
              if (firstChunk) {
                firstChunk = false;
                // Replace thinking indicator with actual message
                const thinkingEl = msgEl.querySelector('.agent-thinking');
                if (thinkingEl) thinkingEl.remove();
                streamEl = msgEl;
              }
              scheduleRender();
            },
            this._aborter.signal,
            this._agentModels[index]
          );

          // If this agent's turn got cut off (max_tokens), don't just hand a
          // half-written file to the next agent or the Apply button. Ask the
          // same agent to pick up exactly where it stopped, bounded to a few
          // rounds so a stuck model can't loop forever.
          const MAX_AGENT_CONTINUES = 4;
          let continues = 0;
          while (
            typeof ResponseCompleteness !== 'undefined' &&
            ResponseCompleteness.isIncomplete(fullText, API._lastFinishReason) &&
            continues < MAX_AGENT_CONTINUES &&
            !this._aborter.signal.aborted
          ) {
            continues++;
            this._setStatus('active', `${role.label} was cut off — continuing (${continues}/${MAX_AGENT_CONTINUES})...`);
            const continueConvo = [
              this._conversation[0],
              ...this._conversation.slice(1),
              { role: 'assistant', content: fullText },
              { role: 'user', content: 'You were cut off. Continue exactly from where you stopped — do NOT repeat anything already written, do NOT restart the file. Output only the remaining content, then close any open code fence or @@patch block.' }
            ];
            let contText = '';
            await API.callAI(
              continueConvo,
              (delta, total) => {
                contText = total;
                const bodyEl = streamEl?.querySelector('.agent-body-content');
                if (bodyEl) { bodyEl.innerHTML = this._renderAgentMD(fullText + contText); scrollToBottom(); }
              },
              this._aborter.signal,
              this._agentModels[index]
            );
            fullText = fullText + contText;
          }

          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

          // Final render
          if (streamEl) {
            const bodyEl = streamEl.querySelector('.agent-body-content');
            if (bodyEl) {
              bodyEl.innerHTML = this._renderAgentMD(fullText);
              scrollToBottom();
            }
          }
          // If we still couldn't get a complete response after all continue
          // attempts, say so plainly rather than silently passing broken
          // code down the pipeline (or letting Apply write a truncated file).
          if (typeof ResponseCompleteness !== 'undefined' && ResponseCompleteness.isIncomplete(fullText, API._lastFinishReason)) {
            const bodyEl = streamEl?.querySelector('.agent-body-content');
            if (bodyEl) {
              bodyEl.innerHTML += '<div style="margin-top:6px;font-size:10px;color:#fbbf24">⚠ Still incomplete after auto-continue — the next agent will see a partial result. Consider switching this slot to a larger-context model in Agent config.</div>';
            }
          }

          // Update token usage for agents
          const usage = API._lastUsage;
          const tokenEl = document.getElementById('agents-token-usage');
          const tokenText = document.getElementById('agents-token-usage-text');
          if (usage && (usage.prompt_tokens || usage.completion_tokens) && tokenEl && tokenText) {
            tokenText.textContent = `Tokens: ${usage.prompt_tokens || '?'} in → ${usage.completion_tokens || '?'} out`;
            tokenEl.classList.remove('hidden');
          }

          if (firstChunk) {
            // No response - remove thinking dots
            const thinkingEl = msgEl.querySelector('.agent-thinking');
            if (thinkingEl) {
              thinkingEl.innerHTML = '<span style="color:var(--tx2);font-size:10px">No response</span>';
            }
          }

          msgs.removeEventListener('scroll', onUserScroll);
          resolve(fullText);

        } catch (e) {
          msgs.removeEventListener('scroll', onUserScroll);
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
          if (e.name === 'AbortError') {
            resolve(fullText || '');
          } else {
            // Show error in agent bubble
            const bodyEl = streamEl?.querySelector('.agent-body-content');
            if (bodyEl) {
              bodyEl.innerHTML = `<span style="color:#f87171">Error: ${e.message}</span>`;
            }
            const thinkingEl = msgEl.querySelector('.agent-thinking');
            if (thinkingEl) thinkingEl.remove();
            reject(e);
          }
        }
      };

      doStream();
    });
  },

  // ── Add a user message ──────────────────────────────────────
  _addUserMsg(text) {
    const msgs = document.getElementById('agents-messages');
    const d = document.createElement('div');
    d.className = 'agent-msg';
    d.innerHTML = `<div class="agent-avatar user">You</div>
      <div class="agent-body"><div class="agent-body-content">${this._escapeHtml(text)}</div></div>`;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  },

  // ── Add an agent message with role label ──────────────────
  _addAgentMsg(roleId, content, roleLabel) {
    const msgs = document.getElementById('agents-messages');
    const role = this.AGENT_ROLES.find(r => r.id === roleId);
    const label = roleLabel || (role ? role.label : roleId);
    const cssClass = role ? role.id : 'system';

    const d = document.createElement('div');
    d.className = 'agent-msg';

    const avatarLetter = roleId === 'system' ? '!' : (label ? label[0] : '?');
    d.innerHTML = `<div class="agent-avatar ${cssClass}">${avatarLetter}</div>
      <div class="agent-body">
        <div class="agent-role-label ${cssClass}">${this._escapeHtml(label)}</div>
        <div class="agent-body-content">${content || '<div class="agent-thinking"><div class="tdot"></div><div class="tdot"></div><div class="tdot"></div></div>'}</div>
      </div>`;

    // For system messages, use inline style for color
    if (roleId === 'system' && content) {
      d.querySelector('.agent-body-content').innerHTML = content;
    }

    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  },

  // ── Render agent markdown (simplified) ────────────────────
  _renderAgentMD(text) {
    if (!text) return '';
    let html = this._escapeHtml(text);
    // Code blocks with language:path
    html = html.replace(/```(\w+):([^\n]+)\n([\s\S]*?)```/g, (_, lang, path, code) => {
      const ext = path.split('.').pop() || lang;
      return `<div class="cb-header"><span class="cb-lang">${this._escapeHtml(lang)}</span><span class="cb-path">${this._escapeHtml(path)}</span></div><pre><code class="language-${this._escapeHtml(ext)}">${this._escapeHtml(code)}</code></pre>`;
    });
    // Code blocks without path
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${this._escapeHtml(lang || 'none')}">${this._escapeHtml(code)}</code></pre>`;
    });
    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4 style="font-size:11px;font-weight:700;color:var(--tx0);margin:6px 0 3px">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:12px;font-weight:700;color:var(--tx0);margin:8px 0 4px">$1</h3>');
    // Lists
    html = html.replace(/^- (.+)$/gm, '<li style="color:var(--tx1);margin:1px 0 1px 12px">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li style="color:var(--tx1);margin:1px 0 1px 12px">$1</li>');
    // Paragraphs (double newline) — avoid wrapping block-level elements
    const hasBlocks = /^\s*<(div|pre|table|h[1-6]|li|ul|ol)/.test(html);
    if (!hasBlocks) {
      html = html.replace(/\n\n/g, '</p><p>');
      html = '<p>' + html + '</p>';
    }
    return html;
  },

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ── Stop collaboration ──────────────────────────────────────
  stop() {
    if (this._aborter) {
      this._aborter.abort();
      this._running = false;
      this._setControls(false);
      this._setStatus('inactive', 'Stopped');
    }
  },

  // ── Clear conversation ─────────────────────────────────────
  clear() {
    const msgs = document.getElementById('agents-messages');
    msgs.innerHTML = '';
    this._conversation = [];
    this.lastFiles = [];
    this.lastPatches = [];
    this.lastCommands = [];
    this.lastResponse = '';
    const applyBar = document.getElementById('agents-apply-bar');
    if (applyBar) applyBar.classList.add('hidden');
    const cmdBar = document.getElementById('agents-cmd-bar');
    if (cmdBar) cmdBar.classList.add('hidden');
    document.getElementById('agents-token-usage')?.classList.add('hidden');
    this._showWelcome();
  },

  // ── Run a single command from the command list ─────────────
  async runSingleCmd(idx) {
    const cmd = this.lastCommands[idx];
    if (!cmd) return;
    this._addAgentMsg('system', `Running: ${cmd}`, '#4ade80');
    try {
      const result = await API.execCommand(cmd, FileTree.project || null);
      const output = result.stdout || result.stderr || '(no output)';
      const color = result.exitCode === 0 ? '#4ade80' : '#f87171';
      this._addAgentMsg('system', output, color);
    } catch (e) {
      this._addAgentMsg('system', `Error: ${e.message}`, '#f87171');
    }
    const msgs = document.getElementById('agents-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  },

  // ── Run all commands in sequence ──────────────────────────
  async runAllCmds() {
    if (!this.lastCommands.length) return;
    this._addAgentMsg('system', `Running ${this.lastCommands.length} command(s)...`, '#60a5fa');
    const msgs = document.getElementById('agents-messages');
    for (const cmd of this.lastCommands) {
      this._addAgentMsg('system', `$ ${cmd}`, '#909090');
      try {
        const result = await API.execCommand(cmd, FileTree.project || null);
        const output = result.stdout || result.stderr || '(no output)';
        const color = result.exitCode === 0 ? '#4ade80' : '#f87171';
        this._addAgentMsg('system', output, color);
      } catch (e) {
        this._addAgentMsg('system', `Error: ${e.message}`, '#f87171');
      }
    }
    this._addAgentMsg('system', 'All commands executed.', '#60a5fa');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    FileTree.refresh();
  },

  _showWelcome() {
    const msgs = document.getElementById('agents-messages');
    // Check if already shown
    if (msgs.querySelector('.agents-welcome')) return;
    msgs.innerHTML = `
      <div class="agents-welcome" id="agents-welcome">
        <div class="agents-welcome-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="agents-welcome-title">Multi-Agent Collaboration</div>
        <div class="agents-welcome-desc">Spawn a team of AI agents that work together on your task. Each agent has a specific role and they collaborate to produce better results.</div>
        <div class="agents-welcome-roles">
          <span class="agents-welcome-role architect">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Architect
          </span>
          <span class="agents-welcome-role coder">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Coder
          </span>
          <span class="agents-welcome-role reviewer">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Reviewer
          </span>
          <span class="agents-welcome-role integrator">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Integrator
          </span>
        </div>
        <div style="font-size:9px;color:var(--tx2);margin-top:8px">Type a prompt below to start a collaboration session</div>
      </div>`;
  },

  // ── Config row rendering ───────────────────────────────────
  _renderConfigRow() {
    const row = document.getElementById('agents-config-row');
    if (!row) return;
    row.innerHTML = '';
    this.AGENT_ROLES.forEach((role, i) => {
      const model = this._agentModels[i] || 'free';
      const short = model.split('/').pop().replace(':free', '').replace(/-instruct$/, '').slice(0, 10);
      const dotClass = role.id;
      const slot = document.createElement('div');
      slot.className = 'agent-slot';
      slot.title = `${role.label}: ${model}`;
      slot.innerHTML = `<span class="agent-slot-dot" style="background:${role.color}"></span>
        <span class="agent-slot-name">${role.label}</span>
        <span class="agent-slot-model">${short}</span>`;
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showModelPicker(slot, i);
      });
      row.appendChild(slot);
    });
  },

  _showModelPicker(anchor, index) {
    // Close any existing picker
    document.querySelectorAll('.agent-model-picker').forEach(p => p.remove());

    const picker = document.createElement('div');
    picker.className = 'agent-model-picker';

    const models = [
      { id: 'z-ai/glm-4.5-air:free', label: 'Glm-4.5-air' },
      { id: 'tencent/hy3-preview:free', label: 'Tencent HY3' },
      { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B' },
      { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B' },
      { id: 'poolside/laguna-xs.2:free', label: 'laguna-xs.2' },
      { id: 'openrouter/free', label: 'openrouter/free' },
    ];

    const current = this._agentModels[index];
    models.forEach(m => {
      const opt = document.createElement('button');
      opt.className = 'agent-model-opt' + (m.id === current ? ' active' : '');
      opt.textContent = m.label;
      opt.addEventListener('click', () => {
        this._agentModels[index] = m.id;
        this._saveAgentModels();
        this._renderConfigRow();
        picker.remove();
      });
      picker.appendChild(opt);
    });

    document.body.appendChild(picker);

    // Position the picker
    requestAnimationFrame(() => {
      const rect = anchor.getBoundingClientRect();
      picker.style.position = 'fixed';
      picker.style.top = Math.min(rect.bottom + 2, window.innerHeight - picker.offsetHeight - 4) + 'px';
      picker.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - picker.offsetWidth - 4)) + 'px';
      picker.style.zIndex = '10000';
    });

    // Close on outside click
    const closeHandler = (e) => {
      if (!picker.contains(e.target) && !anchor.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  // ── Config modal ───────────────────────────────────────────
  _openConfig() {
    const body = document.getElementById('agents-config-body');
    if (!body) return;
    body.innerHTML = '';
    this.AGENT_ROLES.forEach((role, i) => {
      const current = this._agentModels[i] || 'openrouter/free';
      const group = document.createElement('div');
      group.className = 'acfg-group';
      group.innerHTML = `
        <div class="acfg-row">
          <span class="acfg-dot" style="background:${role.color};display:inline-block;vertical-align:middle;margin-right:4px"></span>
          <label style="min-width:auto;flex:1">${role.label}</label>
          <select data-index="${i}" style="background:var(--bg2);border:1px solid var(--bd);color:var(--tx0);border-radius:var(--r2);padding:3px 6px;font-size:10px;font-family:var(--font);outline:none">
            <option value="z-ai/glm-4.5-air:free" ${current === 'z-ai/glm-4.5-air:free' ? 'selected' : ''}>Glm-4.5-air</option>
            <option value="tencent/hy3-preview:free" ${current === 'tencent/hy3-preview:free' ? 'selected' : ''}>Tencent HY3</option>
            <option value="openai/gpt-oss-120b:free" ${current === 'openai/gpt-oss-120b:free' ? 'selected' : ''}>GPT-OSS 120B</option>
            <option value="nvidia/nemotron-3-super-120b-a12b:free" ${current === 'nvidia/nemotron-3-super-120b-a12b:free' ? 'selected' : ''}>Nemotron 120B</option>
            <option value="google/gemma-3-27b-it:free" ${current === 'google/gemma-3-27b-it:free' ? 'selected' : ''}>Gemma 3 27B</option>
            <option value="poolside/laguna-xs.2:free" ${current === 'poolside/laguna-xs.2:free' ? 'selected' : ''}>laguna-xs.2</option>
            <option value="openrouter/free" ${current === 'openrouter/free' ? 'selected' : ''}>openrouter/free</option>
          </select>
        </div>`;
      body.appendChild(group);
    });
    openModal('agents-config-modal');
  },

  _saveConfig() {
    document.querySelectorAll('#agents-config-body select[data-index]').forEach(sel => {
      const i = parseInt(sel.dataset.index);
      if (i >= 0 && i < 4) {
        this._agentModels[i] = sel.value;
      }
    });
    this._saveAgentModels();
    this._renderConfigRow();
    closeModal('agents-config-modal');
    toast('Agent models updated', 'ok', 1500);
  },

  // ── Apply all changes ──────────────────────────────────────
  async applyAll() {
    if (!FileTree.project) {
      toast('Open or create a project first', 'wrn', 3000);
      return;
    }

    const hasPatches = this.lastPatches.length > 0;

    if (hasPatches) {
      showLoading('Applying surgical edits...');
      let totalApplied = 0, totalFailed = 0;

      for (const patch of this.lastPatches) {
        try {
          const result = await API.applyPatch(FileTree.project, patch.path, patch.hunks);
          totalApplied += result.applied || 0;
          totalFailed  += result.failed  || 0;
          if (result.failed > 0) {
            const failures = (result.detail || []).filter(d => !d.ok).map(d => `"${d.search}" — ${d.reason}`).join('; ');
            toast(`${result.failed} hunk(s) failed in ${patch.path}: ${failures}`, 'wrn', 6000);
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

      if (this.lastPatches.length > 0) {
        await FileTree.openFile(this.lastPatches[0].path);
      }

    } else if (this.lastFiles.length > 0) {
      showLoading(`Writing ${this.lastFiles.length} file(s)...`);
      try {
        const result = await API.writeBatch(FileTree.project, this.lastFiles);
        hideLoading();
        const ok   = (result.results || []).filter(r => r.success).length;
        const fail = (result.results || []).filter(r => !r.success).length;

        await FileTree.refresh();

        if (this.lastFiles.length > 0) {
          await FileTree.openFile(this.lastFiles[0].path);
        }

        for (const f of this.lastFiles) {
          const tab = EditorMgr.tabs.find(t => t.path === f.path);
          if (tab) { tab.model.setValue(f.content); tab.modified = false; }
        }
        EditorMgr._renderTabs();

        toast(`Applied ${ok} file(s)${fail ? ', ' + fail + ' failed' : ''}`, 'ok');
      } catch (e) {
        hideLoading();
        toast('Apply failed: ' + e.message, 'err');
      }
    }

    this.lastFiles = [];
    this.lastPatches = [];
    const applyBar = document.getElementById('agents-apply-bar');
    if (applyBar) applyBar.classList.add('hidden');
  },

  // ── UI helpers ─────────────────────────────────────────────
  _setControls(busy) {
    const sendBtn = document.getElementById('btn-agents-send');
    const input = document.getElementById('agents-input');
    const stopBtn = document.getElementById('btn-agents-stop');
    if (sendBtn) sendBtn.disabled = busy;
    if (input) input.disabled = busy;
    if (stopBtn) stopBtn.style.display = busy ? 'flex' : 'none';
  },

  _setStatus(state, text) {
    const bar = document.getElementById('agents-status-bar');
    if (!bar) return;
    bar.classList.toggle('active', state === 'active');
    const label = bar.querySelector('.agents-status-label');
    if (label) label.textContent = text || '';
  },

  openWithWarning() {
    if (localStorage.getItem('agentWarnSeen') === '1') {
      this.show();
    } else {
      openModal('agent-warn-modal');
    }
  },
};
window.AgentsMgr = AgentsMgr;

/* ============================================================
   AGENT SESSIONS — multi-session storage for agents
   ============================================================ */
const AgentSessions = {
  _KEY: 'ci_agent_sessions',
  _ACTIVE: 'ci_active_agent_session',

  getSessions() {
    try { return JSON.parse(localStorage.getItem(this._KEY) || '{}'); } catch { return {}; }
  },

  saveSessions(sessions) {
    try { localStorage.setItem(this._KEY, JSON.stringify(sessions)); } catch {}
  },

  getActiveId() {
    return localStorage.getItem(this._ACTIVE) || 'default';
  },

  setActive(id) {
    localStorage.setItem(this._ACTIVE, id);
  },

  createSession(name) {
    const sessions = this.getSessions();
    const id = 'agent_session_' + Date.now();
    sessions[id] = {
      id,
      name: name || 'Agent Session ' + Object.keys(sessions).length,
      conversation: [],
      lastFiles: [],
      lastPatches: [],
      lastCommands: [],
      created: Date.now()
    };
    this.saveSessions(sessions);
    return id;
  },

  saveCurrent() {
    if (typeof AgentsMgr === 'undefined') return;
    const sessions = this.getSessions();
    const id = this.getActiveId();
    if (!sessions[id]) {
      sessions[id] = {
        id,
        name: 'Agent Session ' + Object.keys(sessions).length,
        conversation: [],
        lastFiles: [],
        lastPatches: [],
        lastCommands: [],
        created: Date.now()
      };
    }
    sessions[id].conversation = [...AgentsMgr._conversation];
    sessions[id].lastFiles = [...AgentsMgr.lastFiles];
    sessions[id].lastPatches = [...AgentsMgr.lastPatches];
    sessions[id].lastCommands = [...AgentsMgr.lastCommands];
    sessions[id].updated = Date.now();
    this.saveSessions(sessions);
  },

  loadSession(id) {
    const sessions = this.getSessions();
    return sessions[id] || null;
  },

  deleteSession(id) {
    const sessions = this.getSessions();
    delete sessions[id];
    this.saveSessions(sessions);
    if (this.getActiveId() === id) this.setActive('default');
  },

  renameSession(id, newName) {
    const sessions = this.getSessions();
    if (sessions[id]) {
      sessions[id].name = newName;
      this.saveSessions(sessions);
    }
  },

  open() {
    openModal('agent-sessions-modal');
    this.renderList();
  },

  _groupTimeline(ts) {
    if (!ts) return 'Earlier';
    const now = new Date();
    const d = new Date(ts);
    const diff = now - d;
    const day = 86400000;
    if (diff < day && d.getDate() === now.getDate()) return 'Today';
    if (diff < 2 * day && d.getDate() === now.getDate() - 1) return 'Yesterday';
    if (diff < 7 * day) return 'This Week';
    if (diff < 30 * day) return 'This Month';
    return 'Earlier';
  },

  renderList() {
    const container = document.getElementById('agent-sessions-list');
    if (!container) return;
    const sessions = this.getSessions();
    const activeId = this.getActiveId();

    if (!Object.keys(sessions).length) {
      container.innerHTML = '<p style="color:var(--tx2);font-size:12px;padding:8px">No saved agent sessions. Start a collaboration to create one.</p>';
      return;
    }

    const groups = {};
    for (const [id, s] of Object.entries(sessions)) {
      const group = this._groupTimeline(s.updated || s.created);
      if (!groups[group]) groups[group] = [];
      groups[group].push({ id, ...s });
    }
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
    let html = '';
    for (const g of groupOrder) {
      const items = groups[g];
      if (!items || !items.length) continue;
      items.sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
      html += `<div class="sessions-group-title">${g}</div>`;
      for (const s of items) {
        const msgs = s.conversation?.length || 0;
        const isActive = s.id === activeId;
        html += `<div class="session-item ${isActive ? 'active' : ''}">
          <div class="session-item-info">
            <div class="session-item-name" title="${esc(s.name)}">${esc(s.name)}${isActive ? ' <span class="session-active-badge">ACTIVE</span>' : ''}</div>
            <div class="session-item-meta">${msgs} message${msgs !== 1 ? 's' : ''}</div>
          </div>
          <div class="session-item-actions">
            <button class="ib sm" onclick="AgentSessions._promptRename('${s.id}')" title="Rename">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ib sm" onclick="AgentSessions.switchTo('${s.id}')" title="Load this session" ${isActive ? 'disabled style="opacity:0.3"' : ''}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="ib sm" onclick="AgentSessions.deleteSession('${s.id}');AgentSessions.renderList()" title="Delete">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
      }
    }
    container.innerHTML = html;
  },

  _promptRename(id) {
    const sessions = this.getSessions();
    const s = sessions[id];
    if (!s) return;
    const newName = prompt('Rename agent session:', s.name);
    if (newName && newName.trim()) {
      this.renameSession(id, newName.trim());
      this.renderList();
    }
  },

  switchTo(id) {
    const session = this.loadSession(id);
    if (!session) return;
    this.setActive(id);
    if (typeof AgentsMgr !== 'undefined') {
      AgentsMgr._conversation = [...(session.conversation || [])];
      AgentsMgr.lastFiles = [...(session.lastFiles || [])];
      AgentsMgr.lastPatches = [...(session.lastPatches || [])];
      AgentsMgr.lastCommands = [...(session.lastCommands || [])];
      // Re-render messages
      const msgs = document.getElementById('agents-messages');
      if (msgs) {
        msgs.innerHTML = '';
        for (const m of AgentsMgr._conversation) {
          if (m.role === 'system') continue;
          if (m.role === 'user') {
            AgentsMgr._addUserMsg(m.content);
          } else {
            AgentsMgr._addAgentMsg('assistant', m.content, 'AI');
          }
        }
      }
    }
    toast(`Loaded agent session: ${session.name}`, 'ok');
    closeModal('agent-sessions-modal');
  }
};
window.AgentSessions = AgentSessions;
