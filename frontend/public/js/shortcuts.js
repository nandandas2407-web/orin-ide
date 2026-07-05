'use strict';
/* ============================================================
   SHORTCUTS PANEL — Ctrl+K shows all keyboard shortcuts
   ============================================================ */
const ShortcutsPanel = {
  _modal: null,

  SHORTCUTS: [
    { cat: 'General', items: [
      { keys: 'Ctrl+P', desc: 'Quick Open file' },
      { keys: 'Ctrl+Shift+P', desc: 'Command Palette' },
      { keys: 'Ctrl+S', desc: 'Save file' },
      { keys: 'Ctrl+W', desc: 'Close tab' },
      { keys: 'Ctrl+B', desc: 'Toggle sidebar' },
    ]},
    { cat: 'Editor', items: [
      { keys: 'Ctrl+D', desc: 'Select next occurrence' },
      { keys: 'Ctrl+/', desc: 'Toggle comment' },
      { keys: 'Shift+Alt+F', desc: 'Format document' },
      { keys: 'Ctrl+\\', desc: 'Split editor' },
      { keys: 'Ctrl+]', desc: 'Indent line' },
      { keys: 'Ctrl+[', desc: 'Outdent line' },
      { keys: 'Alt+Up/Down', desc: 'Move line up/down' },
      { keys: 'Shift+Alt+Up', desc: 'Copy line up' },
      { keys: 'Ctrl+Enter', desc: 'Insert line below' },
    ]},
    { cat: 'AI Features', items: [
      { keys: 'Ctrl+Shift+I', desc: 'Toggle AI completions' },
      { keys: 'Ctrl+Shift+R', desc: 'Toggle AI code review' },
      { keys: 'Ctrl+Shift+E', desc: 'AI refactor selection' },
      { keys: 'Ctrl+Hover', desc: 'AI explain on hover' },
    ]},
    { cat: 'Navigation', items: [
      { keys: 'Ctrl+G', desc: 'Go to line' },
      { keys: 'F12', desc: 'Go to definition' },
      { keys: 'Ctrl+K Ctrl+C', desc: 'Add cursor above/below' },
    ]},
    { cat: 'Terminal', items: [
      { keys: 'Ctrl+`', desc: 'Toggle terminal' },
      { keys: 'Ctrl+Shift+C', desc: 'Copy selection' },
      { keys: 'Ctrl+Shift+V', desc: 'Paste' },
    ]},
  ],

  init() {
    if (typeof monaco !== 'undefined' && EditorMgr.instance) {
      EditorMgr.instance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
        () => this.show()
      );
    }
  },

  show() {
    let modal = document.getElementById('shortcuts-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'shortcuts-modal';
      modal.className = 'modal-bg hidden';
      modal.innerHTML = `
        <div class="modal-box" style="max-width:520px">
          <div class="modal-head">
            <span>Keyboard Shortcuts</span>
            <button class="ib sm modal-x" onclick="closeModal('shortcuts-modal')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body" id="shortcuts-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const body = document.getElementById('shortcuts-body');
    body.innerHTML = this.SHORTCUTS.map(cat => `
      <div class="sc-cat">
        <div class="sc-cat-title">${esc(cat.cat)}</div>
        ${cat.items.map(s => `
          <div class="sc-row">
            <span class="sc-keys">${esc(s.keys)}</span>
            <span class="sc-desc">${esc(s.desc)}</span>
          </div>
        `).join('')}
      </div>
    `).join('');

    openModal('shortcuts-modal');
  }
};
window.ShortcutsPanel = ShortcutsPanel;
