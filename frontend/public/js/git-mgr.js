'use strict';
/* ============================================================
   GIT MGR — Source Control panel
   Uses API.execCmd() to run real git commands in the project
   directory, then renders the output as an interactive panel:
   • Shows branch name + ahead/behind counts
   • Lists changed files grouped by Staged / Unstaged / Untracked
   • Stage/unstage individual files or all at once
   • Commit with a message (Ctrl+Enter shortcut)
   • Push and Pull with live feedback in the status line
   ============================================================ */
const GitMgr = {
  _project: null,
  _refreshing: false,

  /* Called when the git sidebar becomes visible */
  async open() {
    const proj = window.FileTree?.project;
    if (!proj) { this._setMsg('Open a project to see git status'); return; }
    if (proj !== this._project) { this._project = proj; }
    await this.refresh();
  },

  async refresh() {
    const proj = this._project || window.FileTree?.project;
    if (!proj) { this._setMsg('Open a project first'); return; }
    this._project = proj;
    if (this._refreshing) return;
    this._refreshing = true;
    this._setMsg('Refreshing...');

    try {
      // Check if this is a git repo at all
      const check = await API.execCmd('git rev-parse --is-inside-work-tree 2>&1', proj);
      if (check.exitCode !== 0) {
        this._setMsg('Not a git repository. Use the + button to initialize one.');
        this._setBranch('—');
        document.getElementById('git-file-list').innerHTML = '';
        return;
      }

      // Get branch and ahead/behind in one call
      const [branchR, statusR, logR] = await Promise.all([
        API.execCmd('git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null', proj),
        API.execCmd('git status --porcelain -u 2>&1', proj),
        API.execCmd('git log --oneline -1 2>/dev/null', proj),
      ]);

      // Branch
      const branch = (branchR.stdout || '').trim() || 'HEAD';
      // Ahead/behind counts (needs remote)
      let aheadBehind = '';
      const abRes = await API.execCmd(
        `git rev-list --left-right --count HEAD...@{u} 2>/dev/null || echo ""`, proj);
      if (abRes.stdout.trim()) {
        const parts = abRes.stdout.trim().split(/\s+/);
        const ahead = parseInt(parts[0]) || 0;
        const behind = parseInt(parts[1]) || 0;
        if (ahead) aheadBehind += ` ↑${ahead}`;
        if (behind) aheadBehind += ` ↓${behind}`;
      }
      this._setBranch(branch + aheadBehind);

      // Parse porcelain status
      const lines = (statusR.stdout || '').split('\n').filter(l => l.length >= 3);
      const staged = [], unstaged = [], untracked = [];

      for (const line of lines) {
        const x = line[0]; // index (staged)
        const y = line[1]; // worktree (unstaged)
        const file = line.slice(3).trim().replace(/^"(.+)"$/, '$1'); // handle quoted paths

        if (x === '?' && y === '?') {
          untracked.push({ file, status: '?', label: 'Untracked' });
        } else {
          if (x !== ' ' && x !== '?') {
            staged.push({ file, status: x, label: this._statusLabel(x, true) });
          }
          if (y !== ' ' && y !== '?') {
            unstaged.push({ file, status: y, label: this._statusLabel(y, false) });
          }
        }
      }

      const total = staged.length + unstaged.length + untracked.length;
      if (total === 0) {
        this._setMsg('Nothing to commit, working tree clean');
      } else {
        const parts = [];
        if (staged.length) parts.push(`${staged.length} staged`);
        if (unstaged.length) parts.push(`${unstaged.length} modified`);
        if (untracked.length) parts.push(`${untracked.length} untracked`);
        this._setMsg(parts.join(' · '));
      }

      // Last commit summary
      const lastCommit = (logR.stdout || '').trim();
      this._renderFileList(staged, unstaged, untracked, lastCommit);

    } catch (e) {
      this._setMsg('Error: ' + e.message);
    } finally {
      this._refreshing = false;
    }
  },

  _statusLabel(code, isIndex) {
    const labels = { A:'Added', M:'Modified', D:'Deleted', R:'Renamed', C:'Copied', U:'Conflict' };
    return labels[code] || code;
  },

  _setBranch(text) {
    const el = document.getElementById('git-branch-name');
    if (el) el.textContent = text;
  },

  _setMsg(msg) {
    const el = document.getElementById('git-status-msg');
    if (el) el.textContent = msg;
  },

  _renderFileList(staged, unstaged, untracked, lastCommit) {
    const list = document.getElementById('git-file-list');
    if (!list) return;
    list.innerHTML = '';

    const makeSection = (title, files, isStagedSection, isUntrackedSection) => {
      if (!files.length) return;
      const sec = document.createElement('div');
      sec.className = 'git-section';

      const hdr = document.createElement('div');
      hdr.className = 'git-section-header';
      const stagedBadge = isStagedSection ? '' :
        `<button class="git-quick-btn" title="${isUntrackedSection ? 'Track all' : 'Stage all'}" onclick="GitMgr.stageGroup(${JSON.stringify(files.map(f=>f.file))})">+</button>`;
      const unstageBtn = isStagedSection ?
        `<button class="git-quick-btn" title="Unstage all" onclick="GitMgr.unstageGroup(${JSON.stringify(files.map(f=>f.file))})">−</button>` : '';
      hdr.innerHTML = `<span>${title}</span><span class="git-section-count">${files.length}</span><div style="flex:1"></div>${stagedBadge}${unstageBtn}`;
      sec.appendChild(hdr);

      for (const f of files) {
        const row = document.createElement('div');
        row.className = 'git-file-row';
        const name = f.file.split('/').pop();
        const dir = f.file.includes('/') ? f.file.split('/').slice(0,-1).join('/') : '';
        const actionBtn = isStagedSection
          ? `<button class="git-file-action" title="Unstage" onclick="GitMgr.unstageFile('${esc(f.file)}')">−</button>`
          : `<button class="git-file-action" title="Stage" onclick="GitMgr.stageFile('${esc(f.file)}')">+</button>`;
        row.innerHTML = `
          <span class="git-status-badge gs-${f.status.toLowerCase()}">${f.status}</span>
          <span class="git-file-name">${esc(name)}</span>
          ${dir ? `<span class="git-file-dir">${esc(dir)}</span>` : ''}
          <div style="flex:1"></div>
          ${actionBtn}
          <button class="git-file-action discard" title="Discard changes" onclick="GitMgr.discard('${esc(f.file)}',${isStagedSection})">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>`;
        row.querySelector('.git-file-name').addEventListener('click', () => this._openFile(f.file));
        sec.appendChild(row);
      }
      list.appendChild(sec);
    };

    makeSection('STAGED', staged, true, false);
    makeSection('UNSTAGED', unstaged, false, false);
    makeSection('UNTRACKED', untracked, false, true);

    // Last commit line
    if (lastCommit) {
      const lc = document.createElement('div');
      lc.className = 'git-last-commit';
      lc.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg><span>${esc(lastCommit)}</span>`;
      list.appendChild(lc);
    }
  },

  /* ── Git operations ─────────────────────────────────────── */
  async stageFile(file) {
    await this._run(`git add -- "${file}"`, `Staged ${file}`);
  },

  async stageAll() {
    await this._run('git add -A', 'All changes staged');
  },

  async stageGroup(files) {
    const paths = files.map(f => `"${f}"`).join(' ');
    await this._run(`git add -- ${paths}`, `Staged ${files.length} file${files.length!==1?'s':''}`);
  },

  async unstageFile(file) {
    await this._run(`git restore --staged -- "${file}" 2>&1 || git reset HEAD -- "${file}" 2>&1`, `Unstaged ${file}`);
  },

  async unstageGroup(files) {
    const paths = files.map(f => `"${f}"`).join(' ');
    await this._run(`git restore --staged -- ${paths} 2>&1 || git reset HEAD -- ${paths} 2>&1`, `Unstaged ${files.length} file${files.length!==1?'s':''}`);
  },

  async discard(file, isStagedSection) {
    if (!confirm(`Discard all changes to "${file}"? This cannot be undone.`)) return;
    const cmd = isStagedSection
      ? `git restore --staged -- "${file}" 2>&1 && git restore -- "${file}" 2>&1`
      : `git restore -- "${file}" 2>&1 || git clean -f -- "${file}" 2>&1`;
    await this._run(cmd, `Discarded changes in ${file}`);
  },

  async commit() {
    const msgEl = document.getElementById('git-commit-msg');
    const msg = (msgEl?.value || '').trim();
    if (!msg) { toast('Enter a commit message first', 'wrn'); msgEl?.focus(); return; }
    const escaped = msg.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    await this._run(`git commit -m "${escaped}" 2>&1`, 'Committed');
    if (msgEl) msgEl.value = '';
  },

  async push() {
    this._setMsg('Pushing...');
    const branch = document.getElementById('git-branch-name')?.textContent.split(' ')[0] || '';
    const res = await API.execCmd(
      `git push origin "${branch}" 2>&1 || git push 2>&1`,
      this._project
    );
    if (res.exitCode === 0) {
      toast('Pushed successfully', 'ok');
    } else {
      const err = (res.stdout + res.stderr).trim().slice(0, 200);
      toast('Push failed: ' + err, 'err', 6000);
    }
    await this.refresh();
  },

  async pull() {
    this._setMsg('Pulling...');
    const res = await API.execCmd('git pull 2>&1', this._project);
    if (res.exitCode === 0) {
      const summary = (res.stdout || '').trim().split('\n').pop() || 'Up to date';
      toast(summary, 'ok');
    } else {
      const err = (res.stdout + res.stderr).trim().slice(0, 200);
      toast('Pull failed: ' + err, 'err', 6000);
    }
    await this.refresh();
  },

  async init_repo() {
    if (!this._project) { toast('Open a project first', 'wrn'); return; }
    const res = await API.execCmd('git init 2>&1', this._project);
    if (res.exitCode === 0) {
      toast('Git repository initialized', 'ok');
      await this.refresh();
    } else {
      toast('git init failed: ' + (res.stdout + res.stderr).trim().slice(0,120), 'err', 5000);
    }
  },

  /* ── GitHub Integration ─────────────────────────────────────── */
  async clone(url) {
    if (!url) return toast('Enter a repository URL', 'wrn');
    const match = url.match(/github\.com\/[^/]+\/([^/.]+)/);
    const name = match ? match[1] : 'cloned-repo';
    const res = await API.execCmd(`git clone "${url}" "${name}" 2>&1`, null);
    if (res.exitCode === 0) {
      toast(`Cloned ${name}`, 'ok');
      FileTree.loadProjects();
    } else {
      toast('Clone failed: ' + (res.stdout + res.stderr).trim().slice(0, 200), 'err', 6000);
    }
  },

  async branches() {
    const proj = this._project || window.FileTree?.project;
    if (!proj) return [];
    const res = await API.execCmd('git branch --list 2>&1', proj);
    return (res.stdout || '').split('\n').map(l => l.replace(/^\*?\s+/, '').trim()).filter(Boolean);
  },

  async switchBranch(name) {
    if (!name) return;
    await this._run(`git checkout "${name}" 2>&1 || git switch "${name}" 2>&1`, `Switched to ${name}`);
  },

  async createBranch(name) {
    if (!name) return;
    await this._run(`git checkout -b "${name}" 2>&1`, `Created branch ${name}`);
  },

  async addRemote(name, url) {
    if (!name || !url) return;
    await this._run(`git remote add "${name}" "${url}" 2>&1`, `Added remote ${name}`);
  },

  async getRemotes() {
    const proj = this._project || window.FileTree?.project;
    if (!proj) return [];
    const res = await API.execCmd('git remote -v 2>&1', proj);
    return (res.stdout || '').split('\n').filter(l => l.includes('fetch')).map(l => {
      const [name, url] = l.split(/\s+/);
      return { name, url };
    });
  },

  async createGitHubRepo(name, token) {
    if (!token) return toast('Set your GitHub token in Settings', 'wrn');
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, auto_init: false }),
    });
    const data = await res.json();
    if (res.ok) {
      toast(`Created repo: ${data.full_name}`, 'ok');
      return data.clone_url;
    } else {
      toast('GitHub error: ' + (data.message || 'Unknown'), 'err', 5000);
      return null;
    }
  },

  async pushToGitHub(repoUrl, token) {
    const proj = this._project || FileTree?.project;
    if (!proj) return toast('Open a project first', 'wrn');
    const branchRes = await API.execCmd('git branch --show-current 2>/dev/null', proj);
    const branch = (branchRes.stdout || '').trim() || 'main';
    // Set remote with token in URL for auth
    const authUrl = repoUrl.replace('https://', `https://${token}@`);
    await API.execCmd(`git remote set-url origin "${authUrl}" 2>&1 || git remote add origin "${authUrl}" 2>&1`, proj);
    const res = await API.execCmd(`git push -u origin "${branch}" 2>&1`, proj);
    if (res.exitCode === 0) {
      toast('Pushed to GitHub!', 'ok');
    } else {
      toast('Push failed: ' + (res.stdout + res.stderr).trim().slice(0, 200), 'err', 6000);
    }
    // Remove token from remote URL after push
    await API.execCmd(`git remote set-url origin "${repoUrl}" 2>/dev/null`, proj);
  },

  async createAndPush() {
    const name = document.getElementById('gh-repo-name')?.value?.trim();
    const token = document.getElementById('gh-token-input')?.value?.trim() || Cfg.get('github-token', '');
    if (!name) return toast('Enter a repo name', 'wrn');
    if (!token) return toast('Enter your GitHub token', 'wrn');
    Cfg.set('github-token', token);
    const url = await this.createGitHubRepo(name, token);
    if (url) {
      this._project = FileTree?.project;
      // Init repo if not already
      await API.execCmd('git init 2>&1', this._project);
      await API.execCmd('git add -A 2>&1', this._project);
      await API.execCmd('git commit -m "Initial commit" 2>&1', this._project);
      await this.pushToGitHub(url, token);
      closeModal('github-modal');
      FileTree.loadProjects();
    }
  },

  /* ── Internal helpers ─────────────────────────────────────── */
  async _run(cmd, successMsg) {
    const proj = this._project || window.FileTree?.project;
    if (!proj) { toast('No project open', 'wrn'); return; }
    this._setMsg('Running...');
    try {
      const res = await API.execCmd(cmd, proj);
      if (res.exitCode === 0) {
        toast(successMsg, 'ok', 1400);
      } else {
        const err = (res.stdout + res.stderr).trim().slice(0, 200);
        toast(err || 'Command failed', 'err', 5000);
      }
    } catch (e) {
      toast(e.message, 'err');
    }
    await this.refresh();
  },

  async _openFile(file) {
    const proj = this._project || window.FileTree?.project;
    if (!proj || !window.EditorMgr) return;
    try {
      const data = await API.readFile(proj, file);
      if (!data.error) EditorMgr.openTab(file, data.content);
    } catch {}
  }
};
window.GitMgr = GitMgr;

/* Wire commit-message Ctrl+Enter shortcut after DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('git-commit-msg')?.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); GitMgr.commit(); }
  });
});
