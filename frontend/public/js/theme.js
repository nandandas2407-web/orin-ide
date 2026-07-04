'use strict';
/* ============================================================
   THEME SYSTEM — multiple themes for editor and UI
   Full syntax token coloring for professional look
   ============================================================ */
const ThemeMgr = {
  _KEY: 'ci_theme',
  _current: 'orin-dark',

  THEMES: {
    'orin-dark': {
      label: 'Orin Dark',
      editor: 'vs-dark',
      ui: { bg0: '#0C0A14', bg1: '#110E1C', bg2: '#1A1528', bg3: '#231D36', bd: '#2E2448', tx0: '#F0EBFF', tx1: '#C5B8E8', tx2: '#8A78B5', tx3: '#5E4E8A', ac: '#9D5CFF', ac2: '#7C3AED', ac3: '#C9A6FF', rd: '#F87171', yw: '#FBBF24', gr: '#22C55E', cy: '#67E8F9' },
      tokens: [
        // Comments
        { token: 'comment', foreground: '5E4E8A', fontStyle: 'italic' },
        { token: 'comment.block', foreground: '5E4E8A', fontStyle: 'italic' },
        { token: 'comment.line', foreground: '5E4E8A', fontStyle: 'italic' },
        { token: 'comment.doc', foreground: '7B6BA5', fontStyle: 'italic' },
        // Strings
        { token: 'string', foreground: '22C55E' },
        { token: 'string.escape', foreground: '67E8F9' },
        { token: 'string.regex', foreground: 'FBBF24' },
        { token: 'string.other', foreground: '22C55E' },
        // Numbers
        { token: 'number', foreground: 'FBBF24' },
        { token: 'number.float', foreground: 'FBBF24' },
        { token: 'number.hex', foreground: 'FBBF24' },
        // Keywords
        { token: 'keyword', foreground: 'C9A6FF' },
        { token: 'keyword.control', foreground: 'C9A6FF' },
        { token: 'keyword.operator', foreground: 'C9A6FF' },
        { token: 'keyword.other', foreground: '9D5CFF' },
        // Types / Classes
        { token: 'type', foreground: '67E8F9' },
        { token: 'type.identifier', foreground: '67E8F9' },
        { token: 'class', foreground: '67E8F9' },
        { token: 'class.identifier', foreground: '67E8F9' },
        // Functions
        { token: 'entity.name.function', foreground: '9D5CFF' },
        { token: 'support.function', foreground: '9D5CFF' },
        { token: 'meta.function-call', foreground: '9D5CFF' },
        // Variables
        { token: 'variable', foreground: 'F0EBFF' },
        { token: 'variable.predefined', foreground: '67E8F9' },
        { token: 'parameter', foreground: 'F0EBFF' },
        // Constants
        { token: 'constant', foreground: 'FBBF24' },
        { token: 'constant.language', foreground: 'FBBF24' },
        // Operators
        { token: 'delimiter', foreground: 'C5B8E8' },
        { token: 'delimiter.bracket', foreground: 'C5B8E8' },
        { token: 'operator', foreground: 'C9A6FF' },
        // Tags (HTML/JSX)
        { token: 'tag', foreground: 'F87171' },
        { token: 'tag.attribute.name', foreground: 'FBBF24' },
        { token: 'metatag', foreground: 'F87171' },
        { token: 'metatag.content.html', foreground: '22C55E' },
        // Attributes
        { token: 'attribute.name', foreground: 'FBBF24' },
        { token: 'attribute.value', foreground: '22C55E' },
        // CSS
        { token: 'attribute.value.css', foreground: '22C55E' },
        { token: 'tag.css', foreground: 'F87171' },
        // Decorators / Annotations
        { token: 'annotation', foreground: 'FBBF24' },
        // JSON
        { token: 'string.key.json', foreground: 'C9A6FF' },
        { token: 'string.value.json', foreground: '22C55E' },
        // Markdown
        { token: 'markup.heading', foreground: 'C9A6FF', fontStyle: 'bold' },
        { token: 'markup.italic', fontStyle: 'italic' },
        { token: 'markup.bold', fontStyle: 'bold' },
        { token: 'markup.inline.raw', foreground: '22C55E' },
        // Python specific
        { token: 'keyword.control.flow.python', foreground: 'C9A6FF' },
        { token: 'variable.parameter.function.python', foreground: 'F0EBFF' },
      ]
    },
    'orin-light': {
      label: 'Orin Light',
      editor: 'vs',
      ui: { bg0: '#ffffff', bg1: '#f6f8fa', bg2: '#eaeef2', bg3: '#d0d7de', bd: '#d0d7de', tx0: '#1f2328', tx1: '#656d76', tx2: '#6e7781', tx3: '#8c959f', ac: '#7c3aed', ac2: '#6d28d9', ac3: '#7c3aed', rd: '#cf222e', yw: '#bf8700', gr: '#1a7f37', cy: '#0969da' },
      tokens: []
    },
    'monokai': {
      label: 'Monokai',
      editor: 'vs-dark',
      ui: { bg0: '#272822', bg1: '#2d2e28', bg2: '#3e3d32', bg3: '#49483e', bd: '#49483e', tx0: '#f8f8f2', tx1: '#cfcfc2', tx2: '#a6a68a', tx3: '#75715e', ac: '#a6e22e', ac2: '#66d9ef', ac3: '#fd971f', rd: '#f92672', yw: '#e6db74', gr: '#a6e22e', cy: '#66d9ef' },
      tokens: []
    },
    'solarized-dark': {
      label: 'Solarized Dark',
      editor: 'vs-dark',
      ui: { bg0: '#002b36', bg1: '#073642', bg2: '#073642', bg3: '#586e75', bd: '#586e75', tx0: '#fdf6e3', tx1: '#eee8d5', tx2: '#93a1a1', tx3: '#657b83', ac: '#268bd2', ac2: '#2aa198', ac3: '#cb4b16', rd: '#dc322f', yw: '#b58900', gr: '#859900', cy: '#2aa198' },
      tokens: []
    },
    'dracula': {
      label: 'Dracula',
      editor: 'vs-dark',
      ui: { bg0: '#282a36', bg1: '#2d303e', bg2: '#343746', bg3: '#44475a', bd: '#44475a', tx0: '#f8f8f2', tx1: '#ccc', tx2: '#6272a4', tx3: '#6272a4', ac: '#bd93f9', ac2: '#ff79c6', ac3: '#8be9fd', rd: '#ff5555', yw: '#f1fa8c', gr: '#50fa7b', cy: '#8be9fd' },
      tokens: []
    },
    'high-contrast': {
      label: 'High Contrast',
      editor: 'hc-black',
      ui: { bg0: '#000000', bg1: '#0a0a0a', bg2: '#1a1a1a', bg3: '#333333', bd: '#6fc3df', tx0: '#ffffff', tx1: '#e0e0e0', tx2: '#a0a0a0', tx3: '#808080', ac: '#6fc3df', ac2: '#f68cb6', ac3: '#c586c0', rd: '#f44747', yw: '#ffcc02', gr: '#6a9955', cy: '#4ec9b0' },
      tokens: []
    },
  },

  init() {
    this._current = localStorage.getItem(this._KEY) || 'orin-dark';
    this.apply(this._current, false);
  },

  apply(id, save = true) {
    const theme = this.THEMES[id];
    if (!theme) return;
    this._current = id;
    if (save) localStorage.setItem(this._KEY, id);

    if (typeof monaco !== 'undefined' && typeof EditorMgr !== 'undefined' && EditorMgr.instance) {
      monaco.editor.defineTheme(id, {
        base: theme.editor === 'hc-black' ? 'hc-black' : theme.editor === 'vs' ? 'vs' : 'vs-dark',
        inherit: true,
        rules: theme.tokens || [],
        colors: {
          // Editor chrome
          'editor.background': theme.ui.bg1,
          'editor.foreground': theme.ui.tx0,
          'editor.lineHighlightBackground': theme.ui.bg2 + '50',
          'editor.lineHighlightBorder': theme.ui.bg3 + '30',
          'editor.selectionBackground': theme.ui.ac + '35',
          'editor.selectionHighlightBackground': theme.ui.ac + '18',
          'editor.inactiveSelectionBackground': theme.ui.ac + '18',
          'editorCursor.foreground': theme.ui.ac,
          'editorCursor.background': theme.ui.bg1,
          // Line numbers
          'editorLineNumber.foreground': theme.ui.tx3,
          'editorLineNumber.activeForeground': theme.ui.ac3,
          // Indent guides
          'editorIndentGuide.background': theme.ui.bg3 + '60',
          'editorIndentGuide.activeBackground': theme.ui.bd,
          // Bracket match
          'editorBracketMatch.background': theme.ui.ac + '20',
          'editorBracketMatch.border': theme.ui.ac + '60',
          // Bracket pair colorization
          'editorBracketHighlight.foreground1': '#C9A6FF',
          'editorBracketHighlight.foreground2': '#67E8F9',
          'editorBracketHighlight.foreground3': '#FBBF24',
          'editorBracketHighlight.foreground4': '#22C55E',
          'editorBracketHighlight.foreground5': '#F87171',
          'editorBracketHighlight.foreground6': '#9D5CFF',
          // Whitespace
          'editorWhitespace.foreground': theme.ui.bg3 + '80',
          // Fold icons
          'editorFoldBackground': theme.ui.bg2 + '40',
          // Minimap
          'minimap.background': theme.ui.bg0,
          'minimap.selectionHighlight': theme.ui.ac + '40',
          'minimapSlider.background': theme.ui.ac + '12',
          'minimapSlider.hoverBackground': theme.ui.ac + '20',
          'minimapSlider.activeBackground': theme.ui.ac + '28',
          // Scrollbar
          'scrollbar.shadow': '#00000040',
          'scrollbarSlider.background': theme.ui.ac + '18',
          'scrollbarSlider.hoverBackground': theme.ui.ac + '30',
          'scrollbarSlider.activeBackground': theme.ui.ac + '40',
          // Widget (autocomplete, find)
          'editorWidget.background': theme.ui.bg1,
          'editorWidget.border': theme.ui.bd,
          'editorSuggestWidget.background': theme.ui.bg1,
          'editorSuggestWidget.border': theme.ui.bd,
          'editorSuggestWidget.selectedBackground': theme.ui.ac + '20',
          'editorSuggestWidget.highlightForeground': theme.ui.ac3,
          // Find widget
          'editor.findMatchBackground': theme.ui.yw + '40',
          'editor.findMatchHighlightBackground': theme.ui.yw + '20',
          'editor.findMatchHighlightBorder': theme.ui.yw + '60',
          // Hover widget
          'editorHoverWidget.background': theme.ui.bg2,
          'editorHoverWidget.border': theme.ui.bd,
          // Diff editor
          'diffEditor.insertedTextBackground': '#22C55E18',
          'diffEditor.removedTextBackground': '#F8717118',
        }
      });
      monaco.editor.setTheme(id);
    }

    // Apply to UI via CSS variables
    const root = document.documentElement;
    for (const [key, val] of Object.entries(theme.ui)) {
      root.style.setProperty(`--${key}`, val);
    }
  },

  get current() { return this._current; },
  get list() {
    return Object.entries(this.THEMES).map(([id, t]) => ({ id, label: t.label }));
  },

  next() {
    const ids = Object.keys(this.THEMES);
    const idx = (ids.indexOf(this._current) + 1) % ids.length;
    this.apply(ids[idx]);
    toast(`Theme: ${this.THEMES[ids[idx]].label}`, 'ok', 1500);
  }
};
window.ThemeMgr = ThemeMgr;
