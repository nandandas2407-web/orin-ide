'use strict';

/* =====================================================================
   SkillsMgr — Skill system for OrinIDE
   - Pre-built skills: Frontend, Cinematic, Backend, etc.
   - Custom user-defined skills
   - @mention autocomplete in chat input
   - Active skill injected into AI system prompt context
   ===================================================================== */

const SkillsMgr = {

  // ── Pre-built skills ──────────────────────────────────────────────
  PREBUILT: [
    {
      id: 'frontend',
      name: 'Frontend',
      slug: 'frontend',
      icon: '◈',
      description: 'Expert frontend UI/UX developer',
      instructions: `You are an expert frontend developer with deep mastery of HTML5, CSS3, and vanilla JavaScript.

FRONTEND SKILL ACTIVE — follow these rules strictly:
1. Write pixel-perfect, responsive UI with mobile-first approach
2. Use CSS custom properties (variables) for theming
3. Prefer CSS Grid and Flexbox for layouts — no floats
4. Animations must use CSS transitions/keyframes or Web Animations API
5. All interactive elements must have :hover, :focus, :active states
6. Use semantic HTML5 elements (header, nav, main, section, article, footer)
7. Every UI must work on mobile (320px) through 4K (2560px+)
8. Glassmorphism: backdrop-filter: blur(12px), semi-transparent backgrounds
9. Color palettes: use CSS variables with --primary, --secondary, --accent, --bg, --text
10. Typography: prefer system fonts or Google Fonts (Inter, JetBrains Mono, Outfit)
11. SVG icons only — no emoji icons in professional UI
12. Accessibility: ARIA labels, keyboard navigation, sufficient color contrast
13. Performance: lazy-load images, avoid layout thrash, use will-change sparingly
14. Every component must be self-contained with scoped CSS classes
15. Deliver COMPLETE, production-ready code — no placeholders or TODOs`
    },
    {
      id: 'cinematic',
      name: 'Cinematic',
      slug: 'cinematic',
      icon: '◉',
      description: 'Cinematic 3D & WebGL visual experiences',
      instructions: `You are a cinematic WebGL/Three.js visual experience expert specializing in stunning, immersive web experiences.

CINEMATIC SKILL ACTIVE — follow these rules strictly:
1. Use Three.js (r128+ preferred) for all 3D rendering
2. Always add OrbitControls or custom camera animation for interactivity
3. GLSL shaders: write custom vertex and fragment shaders for unique effects
4. Post-processing: use EffectComposer with Bloom, FXAA, and ChromaticAberration
5. Particle systems: use BufferGeometry with Float32Array for performance (100k+ particles)
6. Lighting: combine AmbientLight, DirectionalLight, PointLight, and SpotLight dramatically
7. Materials: prefer MeshPhysicalMaterial for realism, ShaderMaterial for custom effects
8. Animation loop: use requestAnimationFrame with delta-time for smooth 60fps
9. Color palettes: deep space blacks (#050510), electric purples (#7c3aed), neon cyans (#06b6d4)
10. Camera cinematic moves: dolly, pan, rack focus — use GSAP or lerp for smooth transitions
11. Scene composition: rule of thirds, depth of field (DOF), motion blur where applicable
12. Audio reactive: if audio is involved, use Web Audio API AnalyserNode for frequency data
13. Mobile: detect device and reduce particle count / shader complexity on mobile
14. Loading screen: always include a cinematic preloader with progress bar and fade-in
15. Deliver COMPLETE self-contained HTML files with all Three.js loaded from CDN`
    },
    {
      id: 'backend',
      name: 'Backend',
      slug: 'backend',
      icon: '⬡',
      description: 'Node.js/Express backend & API architect',
      instructions: `You are a senior backend engineer specializing in Node.js, Express, and REST/GraphQL API design.

BACKEND SKILL ACTIVE — follow these rules strictly:
1. Use Express.js with proper middleware chain (cors, helmet, morgan, express.json)
2. Structure: routes/, controllers/, services/, middleware/, models/ — never put logic in routes
3. Error handling: always use centralized error middleware with proper HTTP status codes
4. Validation: validate all request bodies with Joi or express-validator
5. Authentication: JWT with refresh tokens, bcrypt for password hashing (rounds: 12+)
6. Database: prefer async/await with try-catch — never mix callbacks and promises
7. Environment: all secrets in .env, never hardcode credentials
8. Logging: use winston or pino — structured JSON logs with request IDs
9. Rate limiting: apply express-rate-limit to all public endpoints
10. REST conventions: GET list, GET/:id, POST, PUT/:id, PATCH/:id, DELETE/:id
11. Response shape: { success: true, data: {...}, message: "..." } consistently
12. File uploads: use multer with file type validation and size limits
13. WebSockets: use socket.io for real-time features — always handle disconnect events
14. Testing: write Jest unit tests for all service functions
15. Deliver COMPLETE working server code with package.json and setup instructions`
    },
    {
      id: 'gamedev',
      name: 'Game Dev',
      slug: 'gamedev',
      icon: '◬',
      description: 'Browser game developer with Three.js & Canvas',
      instructions: `You are an expert browser game developer specializing in Three.js and HTML5 Canvas games.

GAME DEV SKILL ACTIVE — follow these rules strictly:
1. Game loop: fixed timestep (16.67ms) with interpolation for smooth rendering
2. Physics: implement AABB collision detection, velocity + acceleration model
3. Input: handle keyboard (keydown/keyup map), mouse, touch, and gamepad API
4. Three.js games: use instanced meshes for enemies/bullets to maintain 60fps
5. Canvas 2D games: use offscreen canvas + dirty rect rendering for performance
6. Camera: implement smooth follow camera with lerp, look-ahead, and screen shake
7. Audio: Web Audio API — positional audio, sfx pooling, background music with fade
8. Game state machine: menu → loading → playing → paused → gameover — clear transitions
9. Entity component system (ECS) pattern for scalable game logic
10. Particle effects: object pooling — never create/destroy objects in the game loop
11. Procedural generation: use seeded random (mulberry32) for reproducible worlds
12. Save system: localStorage with JSON serialization for progress persistence
13. HUD/UI: canvas overlay or DOM overlay — health bars, score, minimap, inventory
14. Difficulty scaling: rubber-band AI, dynamic spawn rates based on player performance
15. Deliver COMPLETE playable game in a single HTML file with all assets inline or CDN`
    }
  ],

  // ── State ─────────────────────────────────────────────────────────
  customSkills: [],
  activeSkillId: null,

  // ── Init ──────────────────────────────────────────────────────────
  init() {
    this._load();
    this._bindUI();
    this._bindAtMention();
    this._renderSkillsList();
    this._updateActiveIndicator();
  },

  // ── Persistence ───────────────────────────────────────────────────
  _load() {
    try {
      this.customSkills = JSON.parse(localStorage.getItem('orin_custom_skills') || '[]');
      this.activeSkillId = localStorage.getItem('orin_active_skill') || null;
    } catch { this.customSkills = []; this.activeSkillId = null; }
  },

  _save() {
    localStorage.setItem('orin_custom_skills', JSON.stringify(this.customSkills));
    localStorage.setItem('orin_active_skill', this.activeSkillId || '');
  },

  // ── Helpers ───────────────────────────────────────────────────────
  allSkills() {
    return [...this.PREBUILT, ...this.customSkills];
  },

  getSkill(id) {
    return this.allSkills().find(s => s.id === id) || null;
  },

  getActiveSkill() {
    if (!this.activeSkillId) return null;
    return this.getSkill(this.activeSkillId);
  },

  // Returns the system-prompt injection text for active skill
  getActiveInstructions() {
    const s = this.getActiveSkill();
    if (!s) return '';
    return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n[ACTIVE SKILL: ${s.name.toUpperCase()}]\n${s.instructions}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  },

  // ── Activate / Deactivate ─────────────────────────────────────────
  activate(id) {
    if (this.activeSkillId === id) {
      // Toggle off
      this.activeSkillId = null;
    } else {
      this.activeSkillId = id;
    }
    this._save();
    this._renderSkillsList();
    this._updateActiveIndicator();
    const skill = this.getActiveSkill();
    if (skill) {
      toast(`Skill activated: ${skill.name}`, 'ok', 2500);
    } else {
      toast('Skill deactivated', 'inf', 2000);
    }
  },

  // ── Custom skill CRUD ─────────────────────────────────────────────
  createCustom(name, instructions) {
    if (!name || !instructions) return false;
    const id = 'custom_' + Date.now();
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    this.customSkills.push({
      id,
      name,
      slug,
      icon: '◆',
      description: 'Custom skill',
      instructions,
      custom: true
    });
    this._save();
    this._renderSkillsList();
    toast(`Skill "${name}" created`, 'ok', 2500);
    return id;
  },

  deleteCustom(id) {
    this.customSkills = this.customSkills.filter(s => s.id !== id);
    if (this.activeSkillId === id) { this.activeSkillId = null; }
    this._save();
    this._renderSkillsList();
    this._updateActiveIndicator();
    toast('Skill deleted', 'inf', 2000);
  },

  editCustom(id, name, instructions) {
    const idx = this.customSkills.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.customSkills[idx].name = name;
    this.customSkills[idx].instructions = instructions;
    this._save();
    this._renderSkillsList();
    toast('Skill updated', 'ok', 2000);
  },

  // ── UI: Render skills list ─────────────────────────────────────────
  _renderSkillsList() {
    const container = document.getElementById('skills-list');
    if (!container) return;
    container.innerHTML = '';

    const renderGroup = (title, skills) => {
      if (!skills.length) return;
      const grpTitle = document.createElement('div');
      grpTitle.className = 'sk-group-title';
      grpTitle.textContent = title;
      container.appendChild(grpTitle);

      skills.forEach(skill => {
        const isActive = this.activeSkillId === skill.id;
        const card = document.createElement('div');
        card.className = 'sk-card' + (isActive ? ' active' : '');
        card.innerHTML = `
          <div class="sk-card-top">
            <span class="sk-icon">${skill.icon || '◆'}</span>
            <div class="sk-meta">
              <div class="sk-name">${skill.name}</div>
              <div class="sk-desc">${skill.description || ''}</div>
            </div>
            <div class="sk-card-actions">
              ${skill.custom ? `<button class="sk-btn sk-btn-edit" data-id="${skill.id}" title="Edit skill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button class="sk-btn sk-btn-del" data-id="${skill.id}" title="Delete skill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>` : ''}
              <button class="sk-btn sk-btn-activate ${isActive ? 'active' : ''}" data-id="${skill.id}" title="${isActive ? 'Deactivate' : 'Activate'} skill">
                ${isActive ? 'Active' : 'Use'}
              </button>
            </div>
          </div>
          <div class="sk-mention">@${skill.slug || skill.id}</div>
        `;
        container.appendChild(card);
      });
    };

    renderGroup('Built-in Skills', this.PREBUILT);
    renderGroup('My Skills', this.customSkills);

    // Event delegation
    container.addEventListener('click', (e) => {
      const activateBtn = e.target.closest('.sk-btn-activate');
      const editBtn = e.target.closest('.sk-btn-edit');
      const delBtn = e.target.closest('.sk-btn-del');

      if (activateBtn) {
        this.activate(activateBtn.dataset.id);
      } else if (editBtn) {
        this._openEditForm(editBtn.dataset.id);
      } else if (delBtn) {
        if (confirm('Delete this skill?')) this.deleteCustom(delBtn.dataset.id);
      }
    }, { once: false });
  },

  // ── UI: Show edit form for custom skill ──────────────────────────
  _openEditForm(id) {
    const skill = this.getSkill(id);
    if (!skill) return;
    const nameInp = document.getElementById('sk-custom-name');
    const instrInp = document.getElementById('sk-custom-instructions');
    const saveBtn = document.getElementById('sk-custom-save');
    if (nameInp) nameInp.value = skill.name;
    if (instrInp) instrInp.value = skill.instructions;
    // Change save button to update mode
    if (saveBtn) {
      saveBtn.textContent = 'Update Skill';
      saveBtn.dataset.editId = id;
    }
    // Scroll to form
    document.getElementById('sk-custom-form')?.scrollIntoView({ behavior: 'smooth' });
  },

  // ── UI: Update active skill badge indicator ───────────────────────
  _updateActiveIndicator() {
    const badge = document.getElementById('skills-active-badge');
    const skill = this.getActiveSkill();
    if (badge) {
      if (skill) {
        badge.textContent = skill.name;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Update the Skills button in toolbar
    const skillsBtn = document.getElementById('btn-skills');
    if (skillsBtn) {
      if (skill) {
        skillsBtn.classList.add('skill-active');
        skillsBtn.title = `Skills: ${skill.name} active`;
      } else {
        skillsBtn.classList.remove('skill-active');
        skillsBtn.title = 'Skills';
      }
    }
  },

  // ── UI: Bind modal buttons ────────────────────────────────────────
  _bindUI() {
    // Open modal
    document.getElementById('btn-skills')?.addEventListener('click', () => {
      openModal('skills-modal');
    });

    // Mobile FAB
    document.getElementById('fab-skills')?.addEventListener('click', () => {
      openModal('skills-modal');
      MobFAB?.toggle?.();
    });

    // Save custom skill
    document.getElementById('sk-custom-save')?.addEventListener('click', () => {
      const nameInp = document.getElementById('sk-custom-name');
      const instrInp = document.getElementById('sk-custom-instructions');
      const saveBtn = document.getElementById('sk-custom-save');
      const name = nameInp?.value.trim();
      const instructions = instrInp?.value.trim();
      if (!name || !instructions) {
        toast('Name and instructions are required', 'wrn'); return;
      }
      const editId = saveBtn?.dataset.editId;
      if (editId) {
        this.editCustom(editId, name, instructions);
        if (saveBtn) { saveBtn.textContent = 'Save Skill'; delete saveBtn.dataset.editId; }
      } else {
        this.createCustom(name, instructions);
      }
      if (nameInp) nameInp.value = '';
      if (instrInp) instrInp.value = '';
    });

    // Cancel edit
    document.getElementById('sk-custom-cancel')?.addEventListener('click', () => {
      const nameInp = document.getElementById('sk-custom-name');
      const instrInp = document.getElementById('sk-custom-instructions');
      const saveBtn = document.getElementById('sk-custom-save');
      if (nameInp) nameInp.value = '';
      if (instrInp) instrInp.value = '';
      if (saveBtn) { saveBtn.textContent = 'Save Skill'; delete saveBtn.dataset.editId; }
    });
  },

  // ── @mention autocomplete ─────────────────────────────────────────
  _mentionDropdown: null,
  _mentionStart: -1,

  _bindAtMention() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    input.addEventListener('input', (e) => this._onInput(e));
    input.addEventListener('keydown', (e) => this._onKeydown(e));
    input.addEventListener('blur', () => {
      setTimeout(() => this._hideDropdown(), 150);
    });
  },

  _onInput(e) {
    const input = e.target;
    const val = input.value;
    const cursor = input.selectionStart;

    // Find the @ before cursor
    let atPos = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (val[i] === '@') { atPos = i; break; }
      if (val[i] === ' ' || val[i] === '\n') break;
    }

    if (atPos === -1) { this._hideDropdown(); return; }

    const query = val.slice(atPos + 1, cursor).toLowerCase();
    const matches = this.allSkills().filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.slug || s.id).toLowerCase().includes(query)
    );

    if (!matches.length) { this._hideDropdown(); return; }

    this._mentionStart = atPos;
    this._showDropdown(matches, input, cursor);
  },

  _onKeydown(e) {
    const dropdown = this._mentionDropdown;
    if (!dropdown || dropdown.style.display === 'none') return;

    const items = dropdown.querySelectorAll('.sk-mention-item');
    let current = [...items].findIndex(i => i.classList.contains('focused'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (current + 1) % items.length;
      items.forEach(i => i.classList.remove('focused'));
      items[next]?.classList.add('focused');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = current <= 0 ? items.length - 1 : current - 1;
      items.forEach(i => i.classList.remove('focused'));
      items[prev]?.classList.add('focused');
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const focused = dropdown.querySelector('.sk-mention-item.focused');
      if (focused) {
        e.preventDefault();
        focused.click();
      }
    } else if (e.key === 'Escape') {
      this._hideDropdown();
    }
  },

  _showDropdown(skills, input, cursor) {
    if (!this._mentionDropdown) {
      const d = document.createElement('div');
      d.id = 'sk-mention-dropdown';
      d.className = 'sk-mention-dropdown';
      document.body.appendChild(d);
      this._mentionDropdown = d;
    }

    const d = this._mentionDropdown;
    d.innerHTML = '';

    skills.forEach((skill, i) => {
      const item = document.createElement('div');
      item.className = 'sk-mention-item' + (i === 0 ? ' focused' : '');
      item.innerHTML = `<span class="sk-mention-icon">${skill.icon || '◆'}</span>
        <span class="sk-mention-name">${skill.name}</span>
        <span class="sk-mention-slug">@${skill.slug || skill.id}</span>`;
      item.addEventListener('click', () => this._completeMention(skill, input));
      d.appendChild(item);
    });

    // Position dropdown above the textarea
    const rect = input.getBoundingClientRect();
    d.style.display = 'block';
    d.style.left = rect.left + 'px';
    d.style.width = Math.min(rect.width, 280) + 'px';
    // Place above the input
    const dh = d.offsetHeight || 120;
    d.style.top = (rect.top - dh - 4) + 'px';
  },

  _hideDropdown() {
    if (this._mentionDropdown) {
      this._mentionDropdown.style.display = 'none';
    }
    this._mentionStart = -1;
  },

  _completeMention(skill, input) {
    const val = input.value;
    const cursor = input.selectionStart;
    const atPos = this._mentionStart;
    if (atPos === -1) return;

    const slug = '@' + (skill.slug || skill.id);
    const before = val.slice(0, atPos);
    const after = val.slice(cursor);
    input.value = before + slug + ' ' + after;
    const newCursor = atPos + slug.length + 1;
    input.setSelectionRange(newCursor, newCursor);
    input.focus();

    this._hideDropdown();

    // Auto-activate this skill when @mentioned
    if (this.activeSkillId !== skill.id) {
      this.activeSkillId = skill.id;
      this._save();
      this._renderSkillsList();
      this._updateActiveIndicator();
    }
  }
};
