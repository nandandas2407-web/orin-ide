<div align="center">

<!-- Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0B0614,50:6C2BD9,100:B45CFF&height=220&section=header&text=OrinIDE&fontSize=76&fontColor=ffffff&fontAlignY=40&fontAlign=50&desc=AI-Powered%20Browser%20IDE%20%E2%80%94%20runs%20anywhere%2C%20no%20cloud%20required&descAlignY=60&descSize=16&descColor=D6A6FF&descAlign=50" width="100%" />

<br/>

[![npm version](https://img.shields.io/npm/v/orin-ide?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/orin-ide)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows%20%7C%20Android-lightgrey?style=for-the-badge)](https://github.com/nandandas2407-web/orin-ide)
[![OpenRouter](https://img.shields.io/badge/powered%20by-OpenRouter-8b5cf6?style=for-the-badge)](https://openrouter.ai)

<br/>

**[Live Demo](https://orinide.netlify.app)** · **[npm Package](https://www.npmjs.com/package/orin-ide)** · **[Report a Bug](https://github.com/nandandas2407-web/orin-ide/issues)** · **[Request a Feature](https://github.com/nandandas2407-web/orin-ide/issues)**

</div>

---

## What is OrinIDE?

**OrinIDE** is a fully-featured, AI-augmented code editor that runs entirely in your browser — backed by a lightweight local Node.js server. There's no cloud account, no IDE subscription, and no upload of your code anywhere. Just run a single `npx` command, open `localhost:3000`, and you have a full coding environment with a real terminal, file system, multi-model AI chat, diff viewer, and much more.

> Built by [Nandan Das](https://orinide.netlify.app) — runs on desktop, laptop, and even Android via Termux.

---

## Preview


<div align="center">

[PREVIEW](https://raw.githubusercontent.com/nandandas2407-web/orin-ide/main/assets/preview.png) 

</div>


---

## Quick Start

```bash
# Zero install — run instantly
npx orin-ide

# Or install globally
npm install -g orin-ide
orin-ide
```

Then open **[http://127.0.0.1:3000](http://127.0.0.1:3000)** in your browser.

```bash
# Custom port
orin-ide --port 8080
```

---

## Android / Termux Setup

Run OrinIDE directly on your Android phone using [Termux](https://termux.dev).

```bash
# 0. Enable storage access (IMPORTANT)
termux-setup-storage

# 1. Update packages + install Node.js
pkg update -y && pkg install nodejs-lts -y

# 2. Install OrinIDE
npm install -g orin-ide

# 3. (Optional) Install Python & C/C++ compiler support
bash $(npm root -g)/orin-ide/setup.sh

# 4. Start OrinIDE
orin-ide
```

Then open **http://127.0.0.1:3000** in your mobile browser.

---

## Features

| Feature | Description |
|---|---|
| **Skills System** | Inject expert AI behavior presets into every request. Built-in skills: Frontend, Cinematic, Backend, Game Dev. Create unlimited custom skills, activate via button or `@skill_name` mention in chat |
| **@Skill Mention** | Type `@` in the chat input to see a smart autocomplete dropdown of all skills — click or press Enter/Tab to complete. Mentioning a skill auto-activates it |
| **AI Chat** | Multi-model AI assistant powered by OpenRouter — supports DeepSeek, Gemini, GPT, and more |
| **Project-Wide AI Context** | AI reads every file in your project before each message — not just the open file. It can reference, cross-link, and reason about your entire codebase at once |
| **Surgical AI Edits** | When you ask AI to edit something, it returns only the changed parts using a patch format — the rest of the file is left untouched. No more full rewrites for a one-line change |
| **Real Terminal** | Fully interactive shell inside the browser — not a fake console |
| **File System** | Complete project file tree — create, rename, move, delete |
| **Diff Viewer** | Review AI whole-file edits line-by-line; accept or reject with one click |
| **HTML Preview in Chat** | Every HTML code block in the AI chat gets a Preview button — renders the output live in a sandboxed iframe without leaving the IDE |
| **Free Image API** | Built-in `ImageAPI` module pulls unlimited free stock photos from picsum.photos and loremflickr.com — 20 categories, no API key required |
| **Image Picker** | Visual grid browser for stock images sorted by category; click any image to copy its URL directly into chat |
| **Smart Portfolio Generation** | AI system prompt is pre-loaded with real image URLs (hero, profile, team, projects, banners) so generated portfolio sites use actual photos instead of placeholder boxes |
| **Snippet Palette** | 20+ built-in snippets for JS, Python, HTML, CSS, and React |
| **Find & Replace** | Project-wide search and replace across all files |
| **ZIP Export** | Export any project as a `.zip` instantly |
| **Media Upload** | Drag-and-drop images, videos, and audio into your project |
| **Code Stats** | Live line / word / character count in the status bar |
| **Command Palette** | Keyboard-driven command search — like VS Code's `Ctrl+P` |
| **Mobile Ready** | Fully responsive — works on Android with Termux |

---

## AI Models (via OpenRouter)

All models below are available on the [OpenRouter](https://openrouter.ai) free tier unless noted:

| Model | Notes |
|---|---|
| `openrouter/auto` | Auto-selects best free model (default) |
| Poolside Laguna xs.2 | Fast coding-focused model |
| GLM-4.5 Air | Z-AI free model |
| Tencent HY3 | Preview model |
| GPT-OSS 120B | OpenAI open-weights model |
| Nvidia Nemotron 120B | Powerful free model |
| Google Gemma 3 27B | Google's open model |
| DeepSeek V4 Pro | Paid — best overall for code |

You can also enter **any custom OpenRouter model ID** directly in the settings panel.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save file |
| `Ctrl + P` | Command Palette |
| `Ctrl + N` | New file |
| `Ctrl + B` | Toggle sidebar |
| `Ctrl + Shift + S` | Snippet Palette |
| `Ctrl + Shift + H` | Find & Replace |

---

## Project Structure

```
orin-ide/
├── backend/
│   ├── server.js               # Express server + WebSocket
│   ├── routes/
│   │   ├── files.js            # File system API
│   │   ├── terminal.js         # PTY terminal over WebSocket
│   │   ├── export.js           # ZIP export, Termux export
│   │   └── preview.js          # Live preview route
│   └── services/
│       ├── terminalManager.js  # PTY session management
│       └── watcherManager.js   # File change watcher (chokidar)
├── frontend/
│   └── public/
│       ├── index.html          # Main app shell
│       ├── css/                # Modular stylesheets
│       └── js/                 # Feature modules (app, vibe, chat, snippets, skills…)
├── bin/
│   ├── orin-ide.js             # CLI entry point
│   └── postinstall.js          # Post-install message
├── setup.sh                    # Termux dependency installer
└── package.json
```

---

## Security

Version `1.0.5` includes a full security hardening pass:

- Path traversal protection on all export routes via `safeProjectName()` validation
- `Content-Disposition` header injection fixed
- `targetDir` restricted to an allowlist of safe roots on Termux export
- `localOnly` middleware added to all routes
- WebSocket connection limit (max 10 simultaneous clients)
- Broadened `rm` ban pattern to catch all dangerous variants
- `multer` upgraded to `^2.0.0` — resolves 7 high-severity CVEs from `1.x`
- `archiver` upgraded to `^7.0.1` — removes deprecated transitive dependencies

---

## Requirements

- **Node.js** `>= 18.0.0`
- An **[OpenRouter API key](https://openrouter.ai)** (free tier available) for AI features
- Any modern browser (Chrome, Firefox, Edge, Brave)

---

## Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repo
2. Create a feature branch — `git checkout -b feat/your-feature`
3. Commit your changes — `git commit -m "feat: add your feature"`
4. Push to the branch — `git push origin feat/your-feature`
5. Open a Pull Request

Please check the [issues page](https://github.com/nandandas2407-web/orin-ide/issues) before opening a new one.

---

## License

**MIT** © 2026 [Nandan Das](https://orinide.netlify.app) — [nandandas2407@gmail.com](mailto:nandandas2407@gmail.com)

See [LICENSE](./LICENSE) for full terms.

---

## Changelog

### v1.0.7 — Project-Wide AI Context, Surgical Edits, Skills System & More

**New Features (this update)**

- **Project-Wide AI Context** — The AI now reads every file in your project before each message. A new `POST /files/batch-read` backend endpoint walks the entire project folder (skipping `node_modules`, `.git`, and binary files), reads all text files up to 800 KB total, and sends them to the AI as context. This means you can ask things like "update the button style in `style.css` to match the color scheme in `index.html`" and the AI actually sees both files — you no longer have to manually open the right file first.

- **Surgical AI Edits — no more full rewrites** — When you ask the AI to change something (rename a variable, update a title, fix a bug), it now returns only the specific lines that need to change using a `@@patch:` format, instead of rewriting the whole file. A new `POST /files/patch` backend endpoint applies these hunks as exact string replacements — character-perfect, leaving everything else in the file untouched. If a search string can't be found in the file (e.g. the file was changed since the AI saw it), the failed hunk is reported with a specific warning instead of silently corrupting the file. The diff viewer still works — it captures the state before patching and shows you exactly what changed.

**New Features (Skills System, HTML Preview, Free Image API — same v1.0.7 base)**

- **Skills System** — Expert AI behavior presets. Built-in: Frontend, Cinematic, Backend, Game Dev. Create unlimited custom skills stored in `localStorage`.
- **Custom Skills** — Name a skill, write the instructions, save. Persists across sessions.
- **@Skill Mention Autocomplete** — Type `@` in chat to open an autocomplete dropdown of all skills. Arrow keys, Enter/Tab, or click to activate.
- **Active Skill Badge** — The Skills button shows the active skill name inline.
- **HTML Preview in chat** — Every HTML code block gets a Preview button that renders it in a sandboxed iframe. New Tab opens it as a full page via Blob URL.
- **Free Image API (`imageapi.js`)** — 20 built-in image categories from picsum.photos and loremflickr.com — no API key, no registration.
- **Image Picker** — Visual grid modal to browse and insert stock image URLs into chat.
- **Smart portfolio image injection** — AI system prompt includes a reference sheet of real image API URLs so generated sites use real photos instead of placeholder boxes.

**Bug Fixes**

- Diff viewer blank screen fixed — JS default (`_viewMode: 'unified'`) now matches the HTML initial state.
- Code block header layout fixed — replaced `justify-content: space-between` with `flex + gap` so multiple action buttons align correctly.
- Streaming render fix — `requestAnimationFrame` buffer batches DOM updates, eliminating lag during long code generation.
- Scroll fix — Auto-scroll pauses when the user manually scrolls up during streaming.

### v1.0.6 — Security Hardening

> Full security audit and hardening release. See the [Security](#security) section for details.

<div align="center">

Built with care by **[Nandan Das](https://orinide.netlify.app)**

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:B45CFF,50:6C2BD9,100:0B0614&height=120&section=footer" width="100%" />

</div>