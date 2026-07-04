# Design System — Purple Theme (Inspired by Lovable + Claude Rounded Corners)

## 1. Visual Theme & Atmosphere

A deep, immersive purple aesthetic — the entire page sits on a rich dark violet background (`#0f0a1a`) that feels premium, creative, and modern. This isn't a generic dark mode — it's a moody, intentional purple foundation. The near-white text (`#e8e0f0`) against this deep purple backdrop creates strong, readable contrast with a warm, luxurious feel.

The typography uses a humanist sans-serif with variable weight capabilities. At display sizes (48px–60px), weight 600 with aggressive negative letter-spacing (-0.9px to -1.5px) compresses headlines into confident, editorial statements. The font uses `ui-sans-serif, system-ui` as fallbacks.

What makes this purple system distinctive is its opacity-driven depth model. Rather than using traditional gray scales, the system modulates `#e8e0f0` at varying opacities (0.03, 0.04, 0.4, 0.82–0.83) to create a unified tonal range. Every shade of gray on the page is technically the same hue — just more or less transparent. This creates a visual coherence that's nearly impossible to achieve with arbitrary hex values. The border system follows suit: `1px solid #2d2048` for light divisions and `1px solid rgba(168, 85, 247, 0.4)` for stronger interactive boundaries.

**Key Characteristics:**
- Deep violet background (`#0f0a1a`) — not black, a deliberate dark purple that feels premium
- Humanist sans-serif typeface with editorial letter-spacing at display sizes
- Purple accent palette: `#a855f7` (primary purple), `#7c3aed` (deep purple), `#c084fc` (light purple)
- Opacity-driven color system: all grays derived from `#e8e0f0` at varying transparency levels
- Inset shadow technique on buttons: `rgba(168,85,247,0.2) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset`
- Violet border palette: `#2d2048` for subtle, `rgba(168,85,247,0.4)` for interactive elements
- Full-pill radius (`9999px`) used extensively for action buttons and icon containers
- Focus state uses `rgba(168,85,247,0.25) 0px 0px 0px 3px` for soft purple glow emphasis
- shadcn/ui + Radix UI component primitives with Tailwind CSS utility styling

## 2. Color Palette & Roles

### Primary
- **Deep Violet** (`#0f0a1a`): Page background, dark card surfaces. The foundation — deep, moody, premium.
- **Light Lavender** (`#e8e0f0`): Primary text, headings, light button text. Warm white with purple tint.
- **Vivid Purple** (`#a855f7`): Primary accent, CTAs, links, focus indicators. The signature color.
- **Deep Purple** (`#7c3aed`): Secondary accent, hover states, active elements.
- **Soft Purple** (`#c084fc`): Subtle highlights, decorative elements, secondary badges.

### Surface Scale
- **Deep Violet** (`#0f0a1a`): Page background, primary surface.
- **Surface Purple** (`#1a1025`): Card backgrounds, section fills, elevated surfaces.
- **Surface Light** (`#231533`): Hover states, dropdown menus, modals.
- **Elevated Purple** (`#2d2048`): Borders, dividers, subtle outlines.

### Neutral Scale (Opacity-Based)
- **Lavender 100%** (`#e8e0f0`): Primary text, headings, light surfaces.
- **Lavender 82%** (`rgba(232,224,240,0.82)`): Body copy.
- **Lavender 40%** (`rgba(232,224,240,0.4)`): Interactive borders, button outlines.
- **Lavender 4%** (`rgba(232,224,240,0.04)`): Subtle hover backgrounds, micro-tints.
- **Lavender 3%** (`rgba(232,224,240,0.03)`): Barely-visible overlays, background depth.

### Surface & Border
- **Violet Border** (`#2d2048`): Card borders, dividers, image outlines.
- **Purple Border** (`rgba(168,85,247,0.4)`): Interactive borders, focus outlines.
- **Card Surface** (`#1a1025`): Card backgrounds, section fills.

### Interactive
- **Ring Purple** (`rgba(168,85,247,0.5)`): `--tw-ring-color`, Tailwind focus ring.
- **Focus Glow** (`rgba(168,85,247,0.25) 0px 0px 0px 3px`): Focus and active state glow — soft purple halo.
- **Vivid Purple** (`#a855f7`): Primary interactive color, links, active states.

### Inset Shadows
- **Purple Button Inset** (`rgba(168,85,247,0.2) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset, rgba(168,85,247,0.1) 0px 1px 2px 0px`): The signature multi-layer inset shadow on dark buttons.

### Gradient
- **Purple Gradient**: `linear-gradient(135deg, #7c3aed, #a855f7, #c084fc)` — primary gradient for hero sections
- **Subtle Glow**: `radial-gradient(ellipse at top, rgba(168,85,247,0.15), transparent 70%)` — atmospheric background glow

## 3. Typography Rules

### Font Family
- **Primary**: Variable humanist sans-serif with fallbacks: `ui-sans-serif, system-ui`
- **Weight range**: 400 (body/reading), 480 (special display), 600 (headings/emphasis)
- **Feature**: Variable font with continuous weight axis — allows fine-tuned intermediary weights like 480.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Primary Sans | 60px (3.75rem) | 600 | 1.00–1.10 (tight) | -1.5px | Maximum impact, editorial |
| Display Alt | Primary Sans | 60px (3.75rem) | 480 | 1.00 (tight) | normal | Lighter hero variant |
| Section Heading | Primary Sans | 48px (3.00rem) | 600 | 1.00 (tight) | -1.2px | Feature section titles |
| Sub-heading | Primary Sans | 36px (2.25rem) | 600 | 1.10 (tight) | -0.9px | Sub-sections |
| Card Title | Primary Sans | 20px (1.25rem) | 400 | 1.25 (tight) | normal | Card headings |
| Body Large | Primary Sans | 18px (1.13rem) | 400 | 1.38 | normal | Introductions |
| Body | Primary Sans | 16px (1.00rem) | 400 | 1.50 | normal | Standard reading text |
| Button | Primary Sans | 16px (1.00rem) | 400 | 1.50 | normal | Button labels |
| Button Small | Primary Sans | 14px (0.88rem) | 400 | 1.50 | normal | Compact buttons |
| Link | Primary Sans | 16px (1.00rem) | 400 | 1.50 | normal | Purple (#a855f7) underline decoration |
| Link Small | Primary Sans | 14px (0.88rem) | 400 | 1.50 | normal | Footer links |
| Caption | Primary Sans | 14px (0.88rem) | 400 | 1.50 | normal | Metadata, small text |

### Principles
- **Purple personality**: The typographic voice is confident and creative, with purple undercurrents in link styling and decorative elements.
- **Variable weight as design tool**: Continuous weight values (e.g., 480) enable nuanced hierarchy beyond standard weight stops.
- **Compression at scale**: Headlines use negative letter-spacing (-0.9px to -1.5px) for editorial impact. Body text stays at normal tracking.
- **Two weights, clear roles**: 400 (body/UI/links/buttons) and 600 (headings/emphasis).

## 4. Component Stylings

### Buttons

**Primary Purple (Inset Shadow)**
- Background: `#a855f7`
- Text: `#0f0a1a`
- Padding: 8px 16px
- Radius: `--r` (8px)
- Shadow: `rgba(168,85,247,0.2) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset, rgba(168,85,247,0.1) 0px 1px 2px 0px`
- Hover: `#9333ea` (deep purple)
- Active: opacity 0.8
- Focus: `rgba(168,85,247,0.25) 0px 0px 0px 3px` glow
- Use: Primary CTA ("Get Started", "Sign Up")

**Secondary Dark**
- Background: `#1a1025`
- Text: `#e8e0f0`
- Border: `1px solid #2d2048`
- Padding: 8px 16px
- Radius: `--r` (8px)
- Hover: `#231533`
- Focus: `rgba(168,85,247,0.25) 0px 0px 0px 3px` glow
- Use: Secondary actions ("Learn More", "Documentation")

**Ghost / Outline**
- Background: transparent
- Text: `#c084fc`
- Padding: 8px 16px
- Radius: `--r` (8px)
- Border: `1px solid rgba(168,85,247,0.4)`
- Hover: `rgba(168,85,247,0.1)` background
- Active: opacity 0.8
- Focus: `rgba(168,85,247,0.25) 0px 0px 0px 3px` glow
- Use: Tertiary actions ("Log In", "Cancel")

**Pill / Icon Button**
- Background: `#1a1025`
- Text: `#c084fc`
- Radius: 9999px (full pill)
- Border: `1px solid #2d2048`
- Hover: `#231533`, border `rgba(168,85,247,0.4)`
- Opacity: 0.5 (default), 0.8 (active)
- Use: Additional actions, mode toggle, voice recording

### Cards & Containers
- Background: `#1a1025`
- Border: `1px solid #2d2048`
- Radius: 12px (standard), 16px (featured), 8px (compact)
- Featured cards: purple top border `2px solid #a855f7` or subtle purple glow
- Image cards: `1px solid #2d2048` with 12px radius

### Inputs & Forms
- Background: `#1a1025`
- Text: `#e8e0f0`
- Border: `1px solid #2d2048`
- Radius: `--r2` (6px)
- Focus: `rgba(168,85,247,0.25) 0px 0px 0px 3px` glow
- Placeholder: `rgba(232,224,240,0.4)`

### Navigation
- Clean horizontal nav on deep violet background, fixed
- Logo/wordmark left-aligned
- Links: 14–16px weight 400, `#e8e0f0` text, `#c084fc` hover
- CTA: primary purple button with inset shadow, `--r` (8px) radius
- Mobile: hamburger menu with purple `--r2` (6px) radius button
- Subtle bottom border: `1px solid #2d2048`

### Links
- Color: `#a855f7` (vivid purple)
- Decoration: underline (default)
- Hover: `#c084fc` (light purple)
- Active: `#7c3aed` (deep purple)

### Image Treatment
- Showcase/portfolio images with `1px solid #2d2048` border
- Consistent 12px border radius on all image containers
- Soft purple gradient overlays (linear-gradient with purple tones) behind hero content
- Gallery-style presentation for template/project showcases

### Distinctive Components

**AI Chat Input**
- Large prompt input area with soft purple borders
- Suggestion pills with `#2d2048` borders and `#c084fc` text
- Voice recording / mode toggle buttons as pill shapes (9999px)
- Glowing purple accent on active state

**Feature Cards**
- Card grid with `#1a1025` background, `#2d2048` border, 12px radius
- Optional purple left accent bar (`3px solid #a855f7`)
- Icon containers with subtle purple glow
- Hover: elevated to `#231533` background

**Stats Bar**
- Large metrics in 48px+ weight 600, `#e8e0f0`
- Purple accent on numbers
- Descriptive text below in `rgba(232,224,240,0.6)`
- Horizontal layout with generous spacing

**Divider**
- `1px solid #2d2048` for standard dividers
- Decorative purple gradient divider: `linear-gradient(90deg, transparent, #a855f7, transparent)`

**Badge / Tag**
- Background: `rgba(168,85,247,0.15)`
- Text: `#c084fc`
- Border: `1px solid rgba(168,85,247,0.3)`
- Radius: `--r2` (6px)

### Border Radius Scale (Claude-inspired)

| Token | Value | Use |
|-------|-------|-----|
| `--r2` | 6px | Small buttons, icon buttons, inputs, dropdown items, tags |
| `--r` | 8px | Standard CTA buttons, text inputs, chat input, send button |
| `--r3` | 12px | Content cards, modals, dropdowns, command palette |
| `--r-pill` | 9999px | Pill buttons, action pills, icon containers, badges |

The radius philosophy follows Claude's hierarchical approach: smaller elements get tighter radii, larger containers get more generous rounding. Standard action buttons at 8px create a friendly, approachable feel without the playfulness of full pills.

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 8px, 10px, 12px, 16px, 24px, 32px, 40px, 56px, 80px, 96px, 128px, 176px, 192px, 208px
- The scale expands generously at the top end — sections use 80px–208px vertical spacing for editorial breathing room

### Grid & Container
- Max content width: approximately 1200px (centered)
- Hero: centered single-column with massive vertical padding (96px+), purple gradient background
- Feature sections: 2–3 column grids
- Full-width footer with multi-column link layout
- Showcase sections with centered card grids

### Whitespace Philosophy
- **Editorial generosity**: Lavish spacing at section boundaries (80px–208px). The deep violet background makes these expanses feel immersive rather than empty.
- **Content-driven rhythm**: Tight internal spacing within cards (12–24px) contrasts with wide section gaps.
- **Section separation**: Sections defined by generous spacing and subtle `#2d2048` border lines.

### Border Radius Scale (Claude-inspired)

| Token | Value | Use |
|-------|-------|-----|
| `--r2` | 6px | Small buttons, icon buttons, inputs, dropdown items, tags |
| `--r` | 8px | Standard CTA buttons, text inputs, chat input, send button |
| `--r3` | 12px | Content cards, modals, dropdowns, command palette |
| Container | 16px | Large containers, footer sections |
| `--r-pill` | 9999px | Action pills, icon buttons, toggles, badges |

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | Deep violet background `#0f0a1a` | Page surface, most content |
| Surface (Level 1) | `#1a1025` background | Cards, sections, containers |
| Elevated (Level 2) | `#231533` background | Hover states, dropdowns, modals |
| Bordered (Level 3) | `#1a1025` + `1px solid #2d2048` | Cards, images, dividers |
| Interactive (Level 4) | `#a855f7` border or glow | Active elements, focus states |
| Focus (Level 5) | `rgba(168,85,247,0.25) 0px 0px 0px 3px` | Active/focus states |

**Shadow Philosophy**: This purple system relies on layered surfaces and colored borders rather than dramatic drop-shadows. Depth is communicated through background color shifts (`#0f0a1a` → `#1a1025` → `#231533`), creating a subtle stacking effect. The inset shadow on purple buttons adds tactile depth. The focus glow (`rgba(168,85,247,0.25)`) creates a soft purple halo rather than a sharp outline.

### Decorative Depth
- Hero: subtle radial gradient glow from top — `radial-gradient(ellipse at top, rgba(168,85,247,0.15), transparent 70%)`
- Purple gradient accent bands and section dividers
- Atmospheric glow behind key content sections
- No harsh section dividers — background shifts and spacing handle transitions

## 7. Do's and Don'ts

### Do
- Use deep violet (`#0f0a1a`) as the page foundation — it's the signature purple atmosphere
- Use purple accents (`#a855f7`, `#c084fc`) for interactive elements and highlights
- Derive all grays from `#e8e0f0` at varying opacity levels for tonal unity
- Use the surface color stack (`#0f0a1a` → `#1a1025` → `#231533`) for depth
- Use `#2d2048` borders instead of shadows for card containment
- Keep the weight system narrow: 400 for body/UI, 600 for headings
- Use full-pill radius (9999px) for action pills and icon buttons
- Apply opacity 0.8 on active states for responsive tactile feedback
- Use the purple glow (`rgba(168,85,247,0.25) 0px 0px 0px 3px`) for focus states

### Don't
- Don't use pure white (`#ffffff`) as a page background — the deep violet is intentional
- Don't use heavy box-shadows for cards — surface color shifts are the depth mechanism
- Don't introduce non-purple saturated accent colors — stay in the violet/purple family
- Don't use weight 700 (bold) — 600 is the maximum weight in the system
- Don't apply 9999px radius on rectangular buttons — pills are for icon/action toggles
- Don't use sharp focus outlines — the system uses soft purple glow-based focus indicators
- Don't mix border styles — `#2d2048` for passive, `rgba(168,85,247,0.4)` for interactive
- Don't increase letter-spacing on headings — designed to run tight at scale

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile Small | <600px | Tight single column, reduced padding |
| Mobile | 600–640px | Standard mobile layout |
| Tablet Small | 640–700px | 2-column grids begin |
| Tablet | 700–768px | Card grids expand |
| Desktop Small | 768–1024px | Multi-column layouts |
| Desktop | 1024–1280px | Full feature layout |
| Large Desktop | 1280–1536px | Maximum content width, generous margins |

### Touch Targets
- Buttons: 8px 16px padding (comfortable touch)
- Navigation: adequate spacing between items
- Pill buttons: 9999px radius creates large tap-friendly targets
- Menu toggle: `--r2` (6px) radius button with adequate sizing

### Collapsing Strategy
- Hero: 60px → 48px → 36px headline scaling with proportional letter-spacing
- Navigation: horizontal links → hamburger menu at 768px
- Feature cards: 3-column → 2-column → single column stacked
- Template gallery: grid → stacked vertical cards
- Stats bar: horizontal → stacked vertical
- Footer: multi-column → stacked single column
- Section spacing: 128px+ → 64px on mobile

### Image Behavior
- Screenshots maintain `1px solid #2d2048` border at all sizes
- 12px border radius preserved across breakpoints
- Gallery images responsive with consistent aspect ratios
- Hero gradient softens/simplifies on mobile

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: Vivid Purple (`#a855f7`)
- Background: Deep Violet (`#0f0a1a`)
- Card Surface: Surface Purple (`#1a1025`)
- Heading text: Light Lavender (`#e8e0f0`)
- Body text: Lavender 82% (`rgba(232,224,240,0.82)`)
- Border: `#2d2048` (passive), `rgba(168,85,247,0.4)` (interactive)
- Focus: `rgba(168,85,247,0.25) 0px 0px 0px 3px`
- Purple accent: `#a855f7`, hover: `#9333ea`, light: `#c084fc`
- Gradient: `linear-gradient(135deg, #7c3aed, #a855f7, #c084fc)`

### Example Component Prompts
- "Create a hero section on deep violet background (#0f0a1a). Add a subtle radial purple glow at the top. Headline at 60px weight 600, line-height 1.10, letter-spacing -1.5px, color #e8e0f0. Subtitle at 18px weight 400, color rgba(232,224,240,0.82). Primary purple CTA button (#a855f7 bg, #0f0a1a text, `--r` 8px radius, inset shadow) and ghost button (transparent bg, 1px solid rgba(168,85,247,0.4) border, #c084fc text, `--r` 8px radius)."
- "Design a card on surface purple (#1a1025) background. Border: 1px solid #2d2048. Radius 12px. No box-shadow. Title at 20px weight 400, line-height 1.25, color #e8e0f0. Body at 14px weight 400, color rgba(232,224,240,0.82). Optional purple left accent bar."
- "Build a template gallery: grid of cards with 12px radius, 1px solid #2d2048 border, #1a1025 backgrounds. Each card: image with 12px top radius, title below. Hover: #231533 background."
- "Create navigation: sticky on deep violet (#0f0a1a). 16px weight 400 for links, #e8e0f0 text, #c084fc hover. Purple CTA button (#a855f7) right-aligned with inset shadow. Bottom border: 1px solid #2d2048. Mobile: hamburger menu with `--r2` (6px) radius."
- "Design a stats section: large numbers at 48px weight 600, letter-spacing -1.2px, #a855f7. Labels below at 16px weight 400, rgba(232,224,240,0.6). Horizontal layout with 32px gap."
- "Create a badge/tag component: background rgba(168,85,247,0.15), text #c084fc, border 1px solid rgba(168,85,247,0.3), 4px radius."

### Iteration Guide
1. Always use deep violet (`#0f0a1a`) as the base — it's the signature purple foundation
2. Use `#1a1025` for card/surface backgrounds to create depth layers
3. Derive grays from `#e8e0f0` at opacity levels rather than using distinct hex values
4. Use `#2d2048` borders for containment, not shadows
5. Purple accent with `#a855f7` for CTAs, links, and interactive elements
6. Letter-spacing scales with size: -1.5px at 60px, -1.2px at 48px, -0.9px at 36px, normal at 16px
7. Two weights: 400 (everything except headings) and 600 (headings)
8. The purple glow (`rgba(168,85,247,0.25) 0px 0px 0px 3px`) is the signature focus indicator
9. Surface color stack: `#0f0a1a` (page) → `#1a1025` (card) → `#231533` (hover/elevated)
