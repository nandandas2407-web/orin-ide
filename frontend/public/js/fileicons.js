'use strict';
/* ============================================================
   FILE ICONS — visual file-type icons in file tree
   ============================================================ */
const FileIcons = {
  ICONS: {
    // Languages
    js:   { color: '#f7df1e', icon: 'JS' },
    jsx:  { color: '#61dafb', icon: 'JS' },
    ts:   { color: '#3178c6', icon: 'TS' },
    tsx:  { color: '#3178c6', icon: 'TS' },
    py:   { color: '#3776ab', icon: 'PY' },
    rb:   { color: '#cc342d', icon: 'RB' },
    go:   { color: '#00add8', icon: 'GO' },
    rs:   { color: '#dea584', icon: 'RS' },
    java: { color: '#ed8b00', icon: 'JV' },
    c:    { color: '#555555', icon: 'C' },
    cpp:  { color: '#555555', icon: 'C+' },
    h:    { color: '#555555', icon: 'H' },
    php:  { color: '#777bb4', icon: 'PH' },
    swift:{ color: '#f05138', icon: 'SW' },
    kt:   { color: '#7f52ff', icon: 'KT' },
    // Web
    html: { color: '#e34c26', icon: '<>' },
    css:  { color: '#1572b6', icon: '{}' },
    scss: { color: '#c6538c', icon: '{}' },
    less: { color: '#1d365d', icon: '{}' },
    vue:  { color: '#42b883', icon: 'VU' },
    svelte:{ color: '#ff3e00', icon: 'SV' },
    // Data
    json: { color: '#f7df1e', icon: '{}' },
    yaml: { color: '#cb171e', icon: 'YM' },
    yml:  { color: '#cb171e', icon: 'YM' },
    xml:  { color: '#f16529', icon: 'XM' },
    sql:  { color: '#e38c00', icon: 'SQ' },
    // Config
    md:   { color: '#083fa1', icon: 'MD' },
    txt:  { color: '#666',    icon: 'TX' },
    sh:   { color: '#4eaa25', icon: '$' },
    bash: { color: '#4eaa25', icon: '$' },
    env:  { color: '#ecd53f', icon: 'EN' },
    git:  { color: '#f05032', icon: 'GI' },
    lock: { color: '#888',    icon: 'LK' },
    // Assets
    png:  { color: '#a855f7', icon: 'IM' },
    jpg:  { color: '#a855f7', icon: 'IM' },
    jpeg: { color: '#a855f7', icon: 'IM' },
    gif:  { color: '#a855f7', icon: 'IM' },
    svg:  { color: '#ffb13b', icon: 'IM' },
    webp: { color: '#a855f7', icon: 'IM' },
    mp4:  { color: '#ff6b6b', icon: 'VD' },
    mp3:  { color: '#1db954', icon: 'AU' },
    pdf:  { color: '#ff0000', icon: 'PD' },
    zip:  { color: '#fbbf24', icon: 'ZP' },
    // Default
    default: { color: '#888', icon: '??' },
  },

  get(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const name = filePath.split('/').pop();
    if (name === 'Dockerfile') return { color: '#2496ed', icon: 'DK' };
    if (name === 'Makefile') return { color: '#6d8086', icon: 'MK' };
    if (name === '.gitignore') return { color: '#f05032', icon: 'GI' };
    if (name === 'package.json') return { color: '#cb3837', icon: 'NP' };
    if (name === 'tsconfig.json') return { color: '#3178c6', icon: 'TS' };
    return this.ICONS[ext] || this.ICONS.default;
  },

  render(filePath) {
    const icon = this.get(filePath);
    return `<span class="file-icon" style="color:${icon.color}">${icon.icon}</span>`;
  }
};
window.FileIcons = FileIcons;
function fileIcon(name) {
  if (typeof FileIcons !== 'undefined') return FileIcons.render(name);
  return '<span class="file-icon" style="color:#888">?</span>';
}
window.fileIcon = fileIcon;
