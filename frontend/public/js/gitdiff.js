'use strict';
/* ============================================================
   GIT DIFF IN EDITOR — inline change markers
   ============================================================ */
const GitDiffDecorations = {
  _decorations: [],
  _currentFile: null,

  async update(filePath) {
    if (!filePath || !FileTree.project) {
      this.clear();
      return;
    }
    this._currentFile = filePath;
    try {
      const result = await API.execCmd(
        `git diff --no-color "${filePath}"`,
        FileTree.project
      );
      const diffOutput = result.stdout || '';
      if (!diffOutput) {
        // File might be newly added (staged but no diff)
        const staged = await API.execCmd(
          `git diff --cached --no-color "${filePath}"`,
          FileTree.project
        );
        if (staged.stdout) {
          this._applyDecorations(staged.stdout, true);
        } else {
          this.clear();
        }
        return;
      }
      this._applyDecorations(diffOutput, false);
    } catch {
      this.clear();
    }
  },

  _applyDecorations(diffOutput, isStaged) {
    if (typeof monaco === 'undefined' || !EditorMgr.instance) return;
    const model = EditorMgr.instance.getModel();
    if (!model) return;

    const lines = diffOutput.split('\n');
    const added = [];
    const modified = [];

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Parse hunk header: @@ -a,b +c,d @@
        const match = line.match(/\+(\d+)(?:,(\d+))?/);
        if (match) {
          const startLine = parseInt(match[1]);
          const count = match[2] ? parseInt(match[2]) : 1;
          for (let i = 0; i < count; i++) {
            modified.push(startLine + i);
          }
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        // Added line - find which line in the file it corresponds to
        // This is simplified; a full implementation would track line mappings
      }
    }

    // Also check for untracked files (entire file is new)
    this._checkUntracked(model);

    const newDecorations = [];
    for (const lineNum of modified) {
      if (lineNum <= model.getLineCount()) {
        newDecorations.push({
          range: new monaco.Range(lineNum, 1, lineNum, 1),
          options: {
            isWholeLine: true,
            className: 'git-diff-modified',
            overviewRuler: {
              color: '#fbbf2480',
              position: monaco.editor.OverviewRulerLane.Right
            },
            glyphMarginClassName: 'git-diff-glyph-modified',
          }
        });
      }
    }

    this._decorations = EditorMgr.instance.deltaDecorations(
      this._decorations,
      newDecorations
    );
  },

  async _checkUntracked(model) {
    if (!FileTree.project || !this._currentFile) return;
    try {
      const result = await API.execCmd(
        `git status --porcelain "${this._currentFile}"`,
        FileTree.project
      );
      const status = result.stdout.trim();
      if (status.startsWith('??') || status.startsWith('A')) {
        // New file - highlight all lines
        const lineCount = model.getLineCount();
        const newDecorations = [{
          range: new monaco.Range(1, 1, lineCount, model.getLineMaxColumn(lineCount)),
          options: {
            isWholeLine: true,
            className: 'git-diff-added',
            overviewRuler: {
              color: '#4ade8080',
              position: monaco.editor.OverviewRulerLane.Right
            },
            glyphMarginClassName: 'git-diff-glyph-added',
          }
        }];
        this._decorations = EditorMgr.instance.deltaDecorations(
          this._decorations,
          newDecorations
        );
      }
    } catch {}
  },

  clear() {
    if (EditorMgr.instance) {
      this._decorations = EditorMgr.instance.deltaDecorations(
        this._decorations,
        []
      );
    }
    this._currentFile = null;
  }
};
window.GitDiffDecorations = GitDiffDecorations;
