'use strict';
/* ================================================================
   VIBE CODING FEATURES
   - Smart Diff Viewer (before/after AI changes)
   - Code Snapshot (local undo history)
   - Quick Insert Snippets palette
   - AI Inline Fix (select code → right-click → Fix with AI)
   - Word Count / Code Stats bar toggle
   ================================================================ */

/* ---- SNAPSHOT MANAGER (local history before AI apply) ---- */
const SnapshotMgr = {
  _snaps: {},   // path -> [{ content, ts }]
  MAX: 20,

  save(path, content) {
    if (!this._snaps[path]) this._snaps[path] = [];
    const list = this._snaps[path];
    if (list.length && list[list.length-1].content === content) return;
    list.push({ content, ts: Date.now() });
    if (list.length > this.MAX) list.shift();
  },

  pop(path) {
    const list = this._snaps[path];
    if (!list || list.length < 2) return null;
    list.pop(); // discard current
    return list[list.length-1]?.content ?? null;
  },

  has(path) {
    return (this._snaps[path]?.length || 0) > 1;
  }
};

/* ---- GIT-STYLE DIFF VIEWER ---- */
const DiffViewer = {
  _orig: null,
  _new: null,
  _viewMode: 'unified', // 'split' | 'unified' — must match HTML initial visibility

  captureOrig() {
    if (EditorMgr.active) this._orig = EditorMgr.getValue();
  },

  setView(mode) {
    this._viewMode = mode;
    document.getElementById('dvt-split').classList.toggle('active', mode === 'split');
    document.getElementById('dvt-unified').classList.toggle('active', mode === 'unified');
    document.getElementById('diff-unified-view').classList.toggle('hidden', mode !== 'unified');
    document.getElementById('diff-split-view').classList.toggle('hidden', mode !== 'split');
    if (this._orig && this._new) this._render(this._orig, this._new);
  },

  show(newContent) {
    if (!this._orig) return;
    this._new = newContent;
    openModal('diff-modal');
    this._render(this._orig, newContent);
  },

  _computeHunks(origLines, newLines) {
    // Myers diff — O((N+M)*D) — handles large files correctly
    const a = origLines, b = newLines;
    const N = a.length, M = b.length;
    const MAX = N + M;
    if (MAX === 0) return [];

    // Build edit script using Myers algorithm
    const V = new Array(2 * MAX + 2).fill(0);
    const trace = [];

    outer:
    for (let d = 0; d <= MAX; d++) {
      trace.push(V.slice());
      for (let k = -d; k <= d; k += 2) {
        const ki = k + MAX;
        let x;
        if (k === -d || (k !== d && V[ki - 1] < V[ki + 1])) {
          x = V[ki + 1];
        } else {
          x = V[ki - 1] + 1;
        }
        let y = x - k;
        while (x < N && y < M && a[x] === b[y]) { x++; y++; }
        V[ki] = x;
        if (x >= N && y >= M) break outer;
      }
    }

    // Backtrack to find the edit path
    const moves = [];
    let x = N, y = M;
    for (let d = trace.length - 1; d >= 0; d--) {
      const Vd = trace[d];
      const k = x - y;
      const ki = k + MAX;
      let prevK;
      if (k === -d || (k !== d && Vd[ki - 1] < Vd[ki + 1])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }
      const prevX = Vd[prevK + MAX];
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) { moves.push({ type: 'same', x: x - 1, y: y - 1 }); x--; y--; }
      if (d > 0) {
        if (x === prevX) { moves.push({ type: 'add', x: prevX, y: y - 1 }); y--; }
        else             { moves.push({ type: 'rem', x: x - 1, y: prevY }); x--; }
      }
    }

    moves.reverse();

    // Convert moves to hunks
    const hunks = [];
    for (const m of moves) {
      if (m.type === 'same') {
        hunks.push({ type: 'same', orig: a[m.x], lineO: m.x + 1, lineN: m.y + 1 });
      } else if (m.type === 'rem') {
        hunks.push({ type: 'rem',  orig: a[m.x], lineO: m.x + 1, lineN: null });
      } else {
        hunks.push({ type: 'add',  orig: b[m.y], lineO: null,     lineN: m.y + 1 });
      }
    }
    return hunks;
  },

  _charDiff(a, b) {
    // Highlight char-level differences within a changed line
    if (!a || !b) return [escHtml(a || ''), escHtml(b || '')];
    let pi = 0, si = 0;
    while (pi < a.length && pi < b.length && a[pi] === b[pi]) pi++;
    while (si < a.length - pi && si < b.length - pi && a[a.length-1-si] === b[b.length-1-si]) si++;
    const aS = si ? a.length - si : a.length;
    const bS = si ? b.length - si : b.length;
    const aHL = escHtml(a.slice(0, pi)) + `<mark class="diff-char-rem">${escHtml(a.slice(pi, aS))}</mark>` + escHtml(a.slice(aS));
    const bHL = escHtml(b.slice(0, pi)) + `<mark class="diff-char-add">${escHtml(b.slice(pi, bS))}</mark>` + escHtml(b.slice(bS));
    return [aHL, bHL];
  },

  _render(orig, next) {
    const origLines = orig.split('\n');
    const newLines = next.split('\n');
    const hunks = this._computeHunks(origLines, newLines);

    const adds = hunks.filter(h => h.type === 'add').length;
    const rems = hunks.filter(h => h.type === 'rem').length;

    // Stats bar
    const fname = EditorMgr.active ? EditorMgr.active.split('/').pop() : 'file';
    document.getElementById('diff-stat-file').textContent = fname;
    document.getElementById('diff-stat-adds').textContent = `+${adds}`;
    document.getElementById('diff-stat-rems').textContent = `-${rems}`;
    const badge = document.getElementById('diff-summary-badge');
    badge.textContent = `${adds + rems} changes`;
    badge.className = 'diff-summary-badge' + (adds + rems > 0 ? ' has-changes' : '');

    // Pair up rem/add for char-level diff
    const enhanced = [...hunks];
    for (let i = 0; i < enhanced.length - 1; i++) {
      if (enhanced[i].type === 'rem' && enhanced[i+1].type === 'add') {
        const [rHL, aHL] = this._charDiff(enhanced[i].orig, enhanced[i+1].orig);
        enhanced[i]._charHL = rHL;
        enhanced[i+1]._charHL = aHL;
      }
    }

    if (this._viewMode === 'unified') this._renderUnified(enhanced);
    else this._renderSplit(enhanced);
  },

  _renderUnified(hunks) {
    const tbody = document.getElementById('diff-tbody');
    if (!hunks.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--tx3);font-size:12px">No differences found</td></tr>';
      return;
    }
    tbody.innerHTML = hunks.map(h => {
      const cls = h.type === 'add' ? 'diff-row-add' : h.type === 'rem' ? 'diff-row-rem' : 'diff-row-same';
      const sign = h.type === 'add' ? '+' : h.type === 'rem' ? '−' : ' ';
      const lineO = h.lineO !== null ? h.lineO : '';
      const lineN = h.lineN !== null ? h.lineN : '';
      const content = h._charHL || escHtml(h.orig || '');
      return `<tr class="diff-row ${cls}">
        <td class="diff-ln diff-ln-o">${lineO}</td>
        <td class="diff-ln diff-ln-n">${lineN}</td>
        <td class="diff-sign">${sign}</td>
        <td class="diff-code">${content}</td>
      </tr>`;
    }).join('');
  },

  _renderSplit(hunks) {
    const leftTbody  = document.getElementById('diff-left-tbody');
    const rightTbody = document.getElementById('diff-right-tbody');
    const left = [], right = [];
    let ri = 0, li = 0;
    
    // Pair rems and adds
    let i = 0;
    while (i < hunks.length) {
      const h = hunks[i];
      if (h.type === 'same') {
        left.push({ type: 'same', line: h.lineO, text: h.orig });
        right.push({ type: 'same', line: h.lineN, text: h.orig });
        i++;
      } else if (h.type === 'rem') {
        // Check if followed by add
        if (i + 1 < hunks.length && hunks[i+1].type === 'add') {
          left.push({ type: 'rem', line: h.lineO, text: h._charHL || escHtml(h.orig || '') });
          right.push({ type: 'add', line: hunks[i+1].lineN, text: hunks[i+1]._charHL || escHtml(hunks[i+1].orig || '') });
          i += 2;
        } else {
          left.push({ type: 'rem', line: h.lineO, text: h._charHL || escHtml(h.orig || '') });
          right.push({ type: 'empty' });
          i++;
        }
      } else if (h.type === 'add') {
        left.push({ type: 'empty' });
        right.push({ type: 'add', line: h.lineN, text: h._charHL || escHtml(h.orig || '') });
        i++;
      } else i++;
    }

    const toRow = item => {
      if (item.type === 'empty') return `<tr class="diff-row diff-row-empty"><td class="diff-ln"></td><td class="diff-sign"></td><td class="diff-code"></td></tr>`;
      const cls = item.type === 'add' ? 'diff-row-add' : item.type === 'rem' ? 'diff-row-rem' : 'diff-row-same';
      const sign = item.type === 'add' ? '+' : item.type === 'rem' ? '−' : ' ';
      return `<tr class="diff-row ${cls}">
        <td class="diff-ln">${item.line || ''}</td>
        <td class="diff-sign">${sign}</td>
        <td class="diff-code">${item.text !== undefined ? item.text : escHtml(item.orig || '')}</td>
      </tr>`;
    };
    leftTbody.innerHTML = left.map(toRow).join('');
    rightTbody.innerHTML = right.map(toRow).join('');
  },

  accept() {
    if (this._new && EditorMgr.active) {
      EditorMgr.setValue(this._new);
      toast('Changes accepted', 'ok');
    }
    closeModal('diff-modal');
  },

  reject() {
    if (this._orig && EditorMgr.active) {
      EditorMgr.setValue(this._orig);
      toast('Changes reverted', 'ok');
    }
    closeModal('diff-modal');
  },

  init() {
    document.getElementById('diff-accept')?.addEventListener('click', () => this.accept());
    document.getElementById('diff-reject')?.addEventListener('click', () => this.reject());
  }
};

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---- CODE STATS ---- */
const CodeStats = {
  update(code) {
    const lines = code.split('\n').length;
    const words = code.trim().split(/\s+/).filter(Boolean).length;
    const chars = code.length;
    const el = document.getElementById('st-stats');
    if (el) el.textContent = `${lines}L  ${words}W  ${chars}C`;
  }
};

/* ---- SNIPPETS PALETTE ---- */
const SnippetsMgr = {
  snippets: [
    { label: 'console.log', desc: 'Log to console', code: 'console.log($1);' },
    { label: 'Arrow function', desc: 'ES6 arrow fn', code: 'const $1 = ($2) => {\n  $3\n};' },
    { label: 'Async function', desc: 'Async/await fn', code: 'async function $1($2) {\n  try {\n    $3\n  } catch(e) { console.error(e); }\n}' },
    { label: 'useEffect', desc: 'React useEffect', code: 'useEffect(() => {\n  $1\n  return () => {};\n}, [$2]);' },
    { label: 'useState', desc: 'React useState', code: 'const [$1, set${1/(.*)/${1:/capitalize}/}] = useState($2);' },
    { label: 'fetch GET', desc: 'Fetch GET request', code: 'const res = await fetch(\'$1\');\nconst data = await res.json();\n' },
    { label: 'fetch POST', desc: 'Fetch POST request', code: 'const res = await fetch(\'$1\', {\n  method: \'POST\',\n  headers: { \'Content-Type\': \'application/json\' },\n  body: JSON.stringify($2)\n});\nconst data = await res.json();' },
    { label: 'for...of', desc: 'for-of loop', code: 'for (const $1 of $2) {\n  $3\n}' },
    { label: 'try/catch', desc: 'Try/catch block', code: 'try {\n  $1\n} catch(e) {\n  console.error(e);\n}' },
    { label: 'class', desc: 'ES6 class', code: 'class $1 {\n  constructor($2) {\n    $3\n  }\n}' },
    { label: 'HTML template', desc: 'HTML5 boilerplate', code: '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>$1</title>\n</head>\n<body>\n$2\n</body>\n</html>' },
    { label: 'CSS flexbox', desc: 'Flex centering', code: 'display: flex;\njustify-content: center;\nalign-items: center;\ngap: $1rem;' },
    { label: 'CSS grid', desc: 'Grid layout', code: 'display: grid;\ngrid-template-columns: repeat($1, 1fr);\ngap: $2rem;' },
    { label: 'Express route', desc: 'Express GET handler', code: 'router.get(\'/$1\', async (req, res) => {\n  try {\n    $2\n    res.json({ success: true });\n  } catch(e) { res.status(500).json({ error: e.message }); }\n});' },
    { label: 'Python function', desc: 'Python def', code: 'def $1($2):\n    """$3"""\n    $4' },
    { label: 'Python class', desc: 'Python OOP class', code: 'class $1:\n    def __init__(self, $2):\n        $3\n' },
    { label: 'Flask route', desc: 'Flask endpoint', code: '@app.route(\'/$1\', methods=[\'GET\'])\ndef $2():\n    $3\n    return jsonify({"status": "ok"})' },
    { label: 'Promise.all', desc: 'Parallel awaits', code: 'const [$1] = await Promise.all([\n  $2\n]);' },
    { label: 'localStorage get', desc: 'Get from storage', code: 'const $1 = JSON.parse(localStorage.getItem(\'$2\') || \'null\');' },
    { label: 'localStorage set', desc: 'Save to storage', code: 'localStorage.setItem(\'$1\', JSON.stringify($2));' },
  ],

  open() {
    openModal('snippets-modal');
    this._render('');
    setTimeout(() => document.getElementById('snippet-search')?.focus(), 50);
  },

  _render(q) {
    const list = document.getElementById('snippet-list');
    if (!list) return;
    const filtered = q ? this.snippets.filter(s =>
      s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)
    ) : this.snippets;
    list.innerHTML = filtered.map((s, i) => `
      <div class="snippet-item" data-idx="${i}" data-code="${escHtml(s.code)}">
        <div class="snippet-label">${s.label}</div>
        <div class="snippet-desc">${s.desc}</div>
      </div>`).join('') || '<div class="snippet-empty">No snippets found</div>';
    list.querySelectorAll('.snippet-item').forEach(el => {
      el.addEventListener('click', () => {
        const code = el.dataset.code.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
        if (EditorMgr.editor) {
          const sel = EditorMgr.editor.getSelection();
          EditorMgr.editor.executeEdits('snippet', [{ range: sel, text: code }]);
          EditorMgr.editor.focus();
        }
        closeModal('snippets-modal');
        toast('Snippet inserted', 'ok', 1200);
      });
    });
  },

  init() {
    document.getElementById('snippet-search')?.addEventListener('input', e => {
      this._render(e.target.value.trim().toLowerCase());
    });
    // Keyboard shortcut: Ctrl+Shift+S
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.open();
      }
    });
  }
};

/* ---- AI INLINE FIX ---- */
const InlineFix = {
  async fix(instruction) {
    if (!EditorMgr.active || !EditorMgr.editor) return toast('No file open', 'wrn');
    const s = Cfg.all();
    if (!s.apiKey) return toast('Set API key in Settings', 'wrn');

    const sel = EditorMgr.getSelected();
    const ctx = sel || EditorMgr.getValue().slice(0, 6000);
    const label = sel ? 'selection' : 'file';

    showLoading('AI fixing ' + label + '...');
    DiffViewer.captureOrig();

    try {
      let fixed = '';
      await API.callAI([
        { role: 'system', content: 'You are a code editor. The user gives you code and an instruction. Return ONLY the fixed code, no explanation, no markdown fences.' },
        { role: 'user', content: `${instruction}\n\n\`\`\`\n${ctx}\n\`\`\`` }
      ], (_, t) => { fixed = t; });

      hideLoading();
      // Strip accidental code fences
      fixed = fixed.replace(/^```[a-z]*\n?/i,'').replace(/```$/,'').trim();

      if (sel) {
        const selection = EditorMgr.editor.getSelection();
        EditorMgr.editor.executeEdits('ai-fix', [{ range: selection, text: fixed }]);
      } else {
        DiffViewer.show(fixed);
        return;
      }
      toast('AI fix applied', 'ok');
    } catch(e) {
      hideLoading();
      toast('Fix error: ' + e.message, 'err');
    }
  },

  init() {
    // Expose quick access via status bar button
    document.getElementById('btn-ai-fix')?.addEventListener('click', () => {
      const instr = prompt('What should AI do with the selected code (or whole file)?');
      if (instr && instr.trim()) this.fix(instr.trim());
    });
  }
};

/* ---- FIND & REPLACE (cross-file) ---- */
const FindReplace = {
  open() { openModal('findreplace-modal'); },

  async run() {
    if (!FileTree.project) return toast('No project open', 'wrn');
    const find = document.getElementById('fr-find').value;
    const replace = document.getElementById('fr-replace').value;
    if (!find) return toast('Enter search text', 'wrn');

    const { tree } = await API.getTree(FileTree.project);
    const files = flatTree(tree).filter(f => f.type === 'file' && /\.(js|ts|jsx|tsx|html|css|py|json|md|txt)$/.test(f.path));
    let total = 0;
    showLoading('Searching ' + files.length + ' files...');
    for (const f of files) {
      const { content } = await API.readFile(FileTree.project, f.path);
      if (!content.includes(find)) continue;
      const newContent = content.split(find).join(replace);
      await API.writeFile(FileTree.project, f.path, newContent);
      total++;
    }
    hideLoading();
    toast(`Replaced in ${total} file(s)`, 'ok');
    closeModal('findreplace-modal');
    await FileTree.refresh();
    if (EditorMgr.active) await FileTree.openFile(EditorMgr.active);
  },

  init() {
    document.getElementById('btn-fr-run')?.addEventListener('click', () => this.run());
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault(); this.open();
      }
    });
  }
};

/* ---- BOOT ALL VIBE FEATURES ---- */
function initVibeFeatures() {
  DiffViewer.init();
  SnippetsMgr.init();
  InlineFix.init();
  FindReplace.init();
  StartupPanel.init();
  GitPanel.init();
  GitTermPanel.init();
}

/* ---- STARTUP PANEL (one-time welcome) ---- */
const StartupPanel = {
  STORAGE_KEY: 'orin_startup_v1_dismissed',

  init() {
    if (localStorage.getItem(this.STORAGE_KEY) === '1') return;
    // Show after splash hides
    setTimeout(() => {
      const panel = document.getElementById('startup-panel');
      if (panel) panel.classList.remove('hidden');
    }, 1800);
  },

  close() {
    const panel = document.getElementById('startup-panel');
    if (panel) panel.classList.add('hidden');
    const cb = document.getElementById('startup-dont-show');
    if (cb && cb.checked) localStorage.setItem(this.STORAGE_KEY, '1');
  },

  openRequest() {
    window.open('https://orinide.netlify.app', '_blank', 'noopener');
    this.close();
  },

  openCLIDocs() {
    window.open('https://orinide.netlify.app', '_blank', 'noopener');
    this.close();
  }
};

/* ---- GIT PANEL (in chat section) ---- */
const GitPanel = {
  _visible: false,

  init() {
    const inp = document.getElementById('git-cmd-input');
    if (inp) {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.runCustom(); }
      });
    }
  },

  toggle() {
    this._visible = !this._visible;
    const panel = document.getElementById('git-panel');
    const btn   = document.getElementById('btn-git-toggle');
    if (panel) panel.classList.toggle('hidden', !this._visible);
    if (btn)   btn.classList.toggle('active', this._visible);
  },

  async run(cmd) {
    const out = document.getElementById('git-output');
    if (!out) return;
    out.innerHTML = `<div class="git-out-line cmd">$ ${escHtml(cmd)}</div><div class="git-out-line">Running...</div>`;
    try {
      const r = await API.execCmd(cmd, FileTree.project);
      let html = `<div class="git-out-line cmd">$ ${escHtml(cmd)}</div>`;
      if (r.stdout) html += r.stdout.split('\n').map(l => `<div class="git-out-line">${this._colorize(l)}</div>`).join('');
      if (r.stderr) html += r.stderr.split('\n').map(l => `<div class="git-out-line err">${escHtml(l)}</div>`).join('');
      if (!r.stdout && !r.stderr) html += `<div class="git-out-line ok">Done (exit ${r.exitCode})</div>`;
      out.innerHTML = html;
      out.scrollTop = out.scrollHeight;
    } catch(e) {
      out.innerHTML = `<div class="git-out-line err">Error: ${escHtml(e.message)}</div>`;
    }
  },

  runCustom() {
    const inp = document.getElementById('git-cmd-input');
    const val = inp ? inp.value.trim() : '';
    if (!val) return;
    inp.value = '';
    this.run('git ' + val);
  },

  _colorize(line) {
    const l = escHtml(line);
    if (line.startsWith('+') || line.startsWith('> ')) return `<span class="gc-add">${l}</span>`;
    if (line.startsWith('-') || line.startsWith('< ')) return `<span class="gc-rem">${l}</span>`;
    if (/^\s*modified:|^\s*new file:|^\s*deleted:/.test(line)) return `<span class="gc-mod">${l}</span>`;
    if (/^commit\s+[0-9a-f]+/.test(line)) return `<span class="gc-hash">${l}</span>`;
    if (/^(Author|Date):/.test(line)) return `<span class="gc-meta">${l}</span>`;
    if (/^\s*\(HEAD|^\s*origin\//.test(line)) return `<span class="gc-ref">${l}</span>`;
    return l;
  }
};

/* ---- GIT TERMINAL PANEL (inside terminal area) ---- */
const GitTermPanel = {
  _visible: false,
  _commitMsg: '',

  init() {
    const inp = document.getElementById('git-term-input');
    if (inp) {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.runCustom(); }
      });
    }
  },

  toggle() {
    this._visible = !this._visible;
    const panel = document.getElementById('git-term-panel');
    const btn   = document.getElementById('btn-git-term');
    if (panel) panel.classList.toggle('hidden', !this._visible);
    if (btn)   btn.classList.toggle('git-active', this._visible);
  },

  async run(cmd) {
    const out = document.getElementById('git-term-output');
    if (!out) return;
    const loading = document.createElement('div');
    loading.className = 'gto-line cmd'; loading.textContent = '$ ' + cmd;
    out.appendChild(loading);
    out.scrollTop = out.scrollHeight;

    // Try WebSocket first (xterm), fallback to API
    if (!TermMgr.fallback && TermMgr.ws && TermMgr.ws.readyState === WebSocket.OPEN) {
      TermMgr.ws.send(JSON.stringify({ type: 'terminal:input', data: cmd + '\n' }));
      const li = document.createElement('div');
      li.className = 'gto-line ok'; li.textContent = '↑ Sent to terminal';
      out.appendChild(li);
      out.scrollTop = out.scrollHeight;
      return;
    }

    try {
      const r = await API.execCmd(cmd, FileTree.project);
      if (r.stdout) {
        r.stdout.split('\n').forEach(l => {
          if (!l) return;
          const d = document.createElement('div');
          d.className = 'gto-line';
          d.innerHTML = GitPanel._colorize(l);
          out.appendChild(d);
        });
      }
      if (r.stderr) {
        r.stderr.split('\n').forEach(l => {
          if (!l) return;
          const d = document.createElement('div');
          d.className = 'gto-line err'; d.textContent = l;
          out.appendChild(d);
        });
      }
      if (!r.stdout && !r.stderr) {
        const d = document.createElement('div');
        d.className = 'gto-line ok'; d.textContent = 'Done';
        out.appendChild(d);
      }
      out.scrollTop = out.scrollHeight;
    } catch(e) {
      const d = document.createElement('div');
      d.className = 'gto-line err'; d.textContent = 'Error: ' + e.message;
      out.appendChild(d);
      out.scrollTop = out.scrollHeight;
    }
  },

  runCustom() {
    const inp = document.getElementById('git-term-input');
    const val = inp ? inp.value.trim() : '';
    if (!val) return;
    inp.value = '';
    this.run('git ' + val);
  },

  runCommit() {
    const msg = prompt('Commit message:', 'Update');
    if (!msg) return;
    this.run(`git add . && git commit -m "${msg.replace(/"/g, '\\"')}"`);
  }
};
