'use strict';
/* ============================================================
   TERMINAL THEMES — match terminal colors to editor theme
   ============================================================ */
const TerminalThemes = {
  THEMES: {
    'orin-dark': {
      background: '#0C0A14',
      foreground: '#F0EBFF',
      cursor: '#9D5CFF',
      cursorAccent: '#0C0A14',
      selectionBackground: '#9D5CFF40',
      black: '#0C0A14', red: '#F87171', green: '#22C55E', yellow: '#FBBF24',
      blue: '#9D5CFF', magenta: '#C084FC', cyan: '#67E8F9', white: '#F0EBFF',
      brightBlack: '#5E4E8A', brightRed: '#F87171', brightGreen: '#4ade80',
      brightYellow: '#fbbf24', brightBlue: '#C9A6FF', brightMagenta: '#C084FC',
      brightCyan: '#67E8F9', brightWhite: '#F0EBFF',
    },
    'orin-light': {
      background: '#ffffff', foreground: '#1f2328', cursor: '#7c3aed',
      cursorAccent: '#ffffff', selectionBackground: '#7c3aed30',
      black: '#ffffff', red: '#cf222e', green: '#1a7f37', yellow: '#bf8700',
      blue: '#7c3aed', magenta: '#8250df', cyan: '#0969da', white: '#1f2328',
      brightBlack: '#6e7781', brightRed: '#cf222e', brightGreen: '#1a7f37',
      brightYellow: '#bf8700', brightBlue: '#8250df', brightMagenta: '#8250df',
      brightCyan: '#0969da', brightWhite: '#1f2328',
    },
    'monokai': {
      background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0',
      cursorAccent: '#272822', selectionBackground: '#49483e',
      black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
      blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
      brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e',
      brightYellow: '#f4bf75', brightBlue: '#66d9ef', brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
    },
  },

  apply(themeId) {
    const theme = this.THEMES[themeId] || this.THEMES['orin-dark'];
    const termEl = document.querySelector('.xterm-screen, .xterm');
    if (!termEl) return;

    // Apply via CSS custom properties
    const style = termEl.style;
    style.setProperty('--term-bg', theme.background);
    style.setProperty('--term-fg', theme.foreground);
    style.setProperty('--term-cursor', theme.cursor);
    style.setProperty('--term-selection', theme.selectionBackground);
  },

  syncWithEditor() {
    const currentTheme = typeof ThemeMgr !== 'undefined' ? ThemeMgr.current : 'orin-dark';
    this.apply(currentTheme);
  }
};
window.TerminalThemes = TerminalThemes;
