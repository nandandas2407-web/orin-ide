'use strict';
/* ================================================================
   IMAGE API — Free, unlimited, no API key required.
   Uses:
     1. Picsum Photos  (picsum.photos)   — beautiful random photos
     2. Lorem Flickr   (loremflickr.com) — keyword-based real photos
   Both are completely free public APIs. No registration, no rate limits
   for reasonable usage.

   Categories map to both services so the AI always gets relevant imagery.
================================================================ */

const ImageAPI = {
  /* ---------- CATEGORY DEFINITIONS ---------- */
  CATS: {
    person:      { picsum: null,           flickr: 'person,face,portrait',    w: 400, h: 400 },
    profile:     { picsum: null,           flickr: 'face,professional,person', w: 400, h: 400 },
    hero:        { picsum: '1920/1080',    flickr: 'landscape,nature',         w: 1920, h: 1080 },
    nature:      { picsum: '800/600',      flickr: 'nature,landscape',         w: 800, h: 600 },
    city:        { picsum: '800/500',      flickr: 'city,urban,architecture',  w: 800, h: 500 },
    technology:  { picsum: null,           flickr: 'technology,computer',      w: 800, h: 500 },
    food:        { picsum: null,           flickr: 'food,meal,restaurant',     w: 800, h: 600 },
    travel:      { picsum: '800/500',      flickr: 'travel,landmark,tourism',  w: 800, h: 500 },
    business:    { picsum: null,           flickr: 'business,office,team',     w: 800, h: 500 },
    abstract:    { picsum: '800/600',      flickr: 'abstract,art,texture',     w: 800, h: 600 },
    background:  { picsum: '1920/1080',    flickr: 'background,texture',       w: 1920, h: 1080 },
    avatar:      { picsum: null,           flickr: 'person,portrait,face',     w: 200, h: 200 },
    banner:      { picsum: '1200/400',     flickr: 'landscape,nature,sky',     w: 1200, h: 400 },
    thumbnail:   { picsum: '400/300',      flickr: 'photo,image',              w: 400, h: 300 },
    team:        { picsum: null,           flickr: 'person,professional',      w: 300, h: 300 },
    product:     { picsum: null,           flickr: 'product,object,minimal',   w: 600, h: 600 },
    interior:    { picsum: null,           flickr: 'interior,room,design',     w: 800, h: 600 },
    fashion:     { picsum: null,           flickr: 'fashion,style,clothing',   w: 600, h: 800 },
    animals:     { picsum: null,           flickr: 'animal,wildlife,nature',   w: 800, h: 600 },
    education:   { picsum: null,           flickr: 'education,books,learning', w: 800, h: 500 }
  },

  /* ---------- URL BUILDERS ---------- */

  // Picsum: deterministic seed by index so same project always gets same images
  picsumUrl(w, h, seed) {
    return `https://picsum.photos/seed/${seed}/${w}/${h}`;
  },

  // LoremFlickr: keyword-based, returns a real relevant photo
  flickrUrl(keywords, w, h, index) {
    return `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keywords)}?random=${index}`;
  },

  // Get a URL for a given category and numeric index (for variety)
  url(category, index = 1) {
    const key = (category || 'nature').toLowerCase().replace(/\s+/g, '');
    const cat = this.CATS[key] || this.CATS['nature'];
    const seed = `orin-${key}-${index}`;
    if (cat.flickr) {
      return this.flickrUrl(cat.flickr, cat.w, cat.h, index);
    }
    const parts = (cat.picsum || '800/600').split('/');
    return this.picsumUrl(parseInt(parts[0]), parseInt(parts[1]), seed);
  },

  // Returns an array of {url, category, width, height} for a given category
  batch(category, count = 6) {
    const key = (category || 'nature').toLowerCase().replace(/\s+/g, '');
    const cat = this.CATS[key] || this.CATS['nature'];
    return Array.from({ length: count }, (_, i) => ({
      url: this.url(key, i + 1),
      category: key,
      width: cat.w,
      height: cat.h,
      alt: `${key} image ${i + 1}`
    }));
  },

  /* ---------- PORTFOLIO-AWARE URL INJECTION ---------- */

  // Detect what kind of section a block of HTML/CSS/JS text is about
  // and return appropriate image URLs to inject
  urlsForPortfolio() {
    return {
      hero:       this.url('hero', 1),
      about:      this.url('person', 1),
      profile:    this.url('profile', 1),
      team1:      this.url('team', 1),
      team2:      this.url('team', 2),
      team3:      this.url('team', 3),
      project1:   this.url('technology', 1),
      project2:   this.url('technology', 2),
      project3:   this.url('technology', 3),
      project4:   this.url('abstract', 4),
      background: this.url('background', 1),
      banner:     this.url('banner', 1),
      avatar:     this.url('avatar', 1),
    };
  },

  /* ---------- IMAGE PICKER MODAL ---------- */
  _pickerResolve: null,

  // Open the image picker and return a Promise<url|null>
  pick(category) {
    return new Promise(resolve => {
      this._pickerResolve = resolve;
      this._openPicker(category || 'nature');
    });
  },

  _openPicker(category) {
    let modal = document.getElementById('img-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'img-picker-modal';
      modal.className = 'modal-bg';
      modal.style.cssText = 'z-index:2100';
      modal.innerHTML = `
        <div class="modal-box" style="max-width:680px;width:96%">
          <div class="modal-head">
            <span>Image Picker</span>
            <button class="ib sm" id="img-picker-close" style="margin-left:auto">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" style="padding:12px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px" id="img-cat-tabs"></div>
            <div id="img-picker-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:400px;overflow-y:auto"></div>
            <p style="margin-top:8px;font-size:11px;color:var(--txt-dim)">Photos via picsum.photos and loremflickr.com — free, no API key required. Click any image to insert its URL.</p>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('img-picker-close').addEventListener('click', () => {
        modal.classList.add('hidden');
        if (this._pickerResolve) { this._pickerResolve(null); this._pickerResolve = null; }
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.classList.add('hidden');
          if (this._pickerResolve) { this._pickerResolve(null); this._pickerResolve = null; }
        }
      });
    }

    // Build category tabs
    const tabsEl = document.getElementById('img-cat-tabs');
    const catKeys = Object.keys(this.CATS);
    tabsEl.innerHTML = catKeys.map(k =>
      `<button class="ib sm img-cat-tab${k === category ? ' active' : ''}" data-cat="${k}" style="font-size:11px;padding:3px 8px;${k === category ? 'background:var(--acc);color:#fff' : ''}">${k}</button>`
    ).join('');
    tabsEl.querySelectorAll('.img-cat-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.img-cat-tab').forEach(b => { b.classList.remove('active'); b.style.background=''; b.style.color=''; });
        btn.classList.add('active');
        btn.style.background = 'var(--acc)';
        btn.style.color = '#fff';
        this._loadPickerGrid(btn.dataset.cat);
      });
    });

    this._loadPickerGrid(category);
    modal.classList.remove('hidden');
  },

  _loadPickerGrid(category) {
    const grid = document.getElementById('img-picker-grid');
    const images = this.batch(category, 9);
    grid.innerHTML = images.map((img, i) => `
      <div style="cursor:pointer;border-radius:6px;overflow:hidden;position:relative;aspect-ratio:4/3;background:var(--bg2)" class="img-pick-item" data-url="${img.url}" data-i="${i}">
        <img src="${img.url}" alt="${img.alt}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;transition:opacity .2s" onerror="this.style.display='none'" onload="this.style.opacity=1" style="opacity:0">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,.35);opacity:0;transition:opacity .15s;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600" class="img-pick-overlay">Insert</div>
      </div>`
    ).join('');

    grid.querySelectorAll('.img-pick-item').forEach(item => {
      item.addEventListener('mouseenter', () => { item.querySelector('.img-pick-overlay').style.opacity = '1'; });
      item.addEventListener('mouseleave', () => { item.querySelector('.img-pick-overlay').style.opacity = '0'; });
      item.addEventListener('click', () => {
        const url = item.dataset.url;
        document.getElementById('img-picker-modal').classList.add('hidden');
        if (this._pickerResolve) { this._pickerResolve(url); this._pickerResolve = null; }
        copyText(url);
        toast('Image URL copied', 'ok', 2000);
      });
    });
  }
};
