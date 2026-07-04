'use strict';
/* ============================================================
   AUTO-SAVE INDICATOR — dot on unsaved tabs
   ============================================================ */
const AutoSaveIndicator = {
  _dirty: new Set(),

  markDirty(path) {
    this._dirty.add(path);
    this._update(path, true);
  },

  markClean(path) {
    this._dirty.delete(path);
    this._update(path, false);
  },

  isDirty(path) {
    return this._dirty.has(path);
  },

  _update(path, dirty) {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.dataset.path === path || tab.dataset.file === path) {
        const dot = tab.querySelector('.tab-dot');
        if (dirty) {
          if (!dot) {
            const d = document.createElement('span');
            d.className = 'tab-dot';
            tab.querySelector('.tab-name')?.appendChild(d);
          }
        } else {
          dot?.remove();
        }
      }
    });
  }
};
window.AutoSaveIndicator = AutoSaveIndicator;
