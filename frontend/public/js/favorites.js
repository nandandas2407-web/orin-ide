'use strict';
/* ============================================================
   FILE FAVORITES — pin files to top of tree
   ============================================================ */
const FileFavorites = {
  _KEY: 'ci_favorites',

  get all() {
    try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
    catch { return []; }
  },

  save(favs) {
    localStorage.setItem(this._KEY, JSON.stringify(favs));
  },

  toggle(project, filePath) {
    const key = `${project}/${filePath}`;
    const favs = this.all;
    const idx = favs.indexOf(key);
    if (idx >= 0) { favs.splice(idx, 1); toast('Removed from favorites', 'inf', 1000); }
    else { favs.push(key); toast('Added to favorites', 'ok', 1000); }
    this.save(favs);
  },

  isFavorite(project, filePath) {
    return this.all.includes(`${project}/${filePath}`);
  },

  list(project) {
    return this.all.filter(f => f.startsWith(project + '/')).map(f => f.slice(project.length + 1));
  },

  renderInTree(project, container) {
    const favs = this.list(project);
    if (!favs.length) return;

    const section = document.createElement('div');
    section.className = 'ft-section ft-favorites';
    section.innerHTML = `<div class="ft-section-header"><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--yw)" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg> Favorites</div>`;

    favs.forEach(fav => {
      const name = fav.split('/').pop();
      const item = document.createElement('div');
      item.className = 'ti fav-item';
      item.dataset.name = name;
      item.dataset.path = fav;
      item.innerHTML = `<span class="ti-name">${esc(name)}</span>`;
      item.addEventListener('click', () => {
        if (typeof EditorMgr !== 'undefined') EditorMgr.openFile(fav);
      });
      section.appendChild(item);
    });

    container.insertBefore(section, container.firstChild);
  }
};
window.FileFavorites = FileFavorites;
