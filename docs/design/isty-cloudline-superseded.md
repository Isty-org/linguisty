---
type: reference
project: Isty
title: Isty Design System
style: Isty Cloudline
themes:
  light: Cloud Day
  dark: Cloud Night
date: 2026-08-18
status: canonical
replaces: Retro Orbit Editorial
optional_visual_examples:
  light: ISTY_CLOUDLINE_PREVIEW.html
  dark: ISTY_CLOUDLINE_DARK_PREVIEW.html
---

# Isty Design System

This document records the shared **Isty Cloudline** visual language for landing pages, presentations, business proposals, documents, case studies, internal interfaces, and social media materials.

The system has two equal themes:

- **Cloud Day** — light, airy, and daytime;
- **Cloud Night** — dark, deep, and calm.

Both themes use the same typography, grid, component logic, states, and visual metaphors. The interface structure stays the same; the atmosphere changes: background, surfaces, contrast, depth, and accent intensity.

The system should create three impressions at once:

- **easy to read** — high contrast, calm typography, short lines, and plenty of space;
- **pleasant to look at** — soft light, sky tones, careful depth, and small warm details;
- **trustworthy** — a strict grid, clear hierarchy, real processes, and no decorative noise.

Visual examples:

- light theme: `ISTY_CLOUDLINE_PREVIEW.html`;
- dark theme: `ISTY_CLOUDLINE_DARK_PREVIEW.html`.

---

## 1. Core idea

The style is called **Isty Cloudline**.

It is an interface and editorial system for a company that turns complex processes into an understandable working environment. It may be light or dark, but both modes retain a sense of space, clarity, and calm forward movement.

Visually, the style combines:

- a light daytime or deep nighttime base;
- a blue-and-graphite neutral scale;
- a sky-blue primary accent;
- a soft lavender secondary accent;
- mint statuses and confirmations;
- warm sunny micro-accents;
- large but calm typography;
- rounded functional surfaces;
- thin routes, connections, and nodes;
- real human scenes;
- a sense of clarity, space, and forward movement.

Main emotion:

> **Complex work has become clear, calm, and manageable.**

The cloud here is neither a literal illustration nor a set of weather icons. It is an environmental principle: plenty of space, soft boundaries, diffused light, and a sense that the system does not pressure people.

### 1.1. Two themes

| Theme | Character | Best suited to |
|---|---|---|
| **Cloud Day** | light, openness, daytime clarity | long pages, documents, case studies, business proposals, working interfaces |
| **Cloud Night** | depth, focus, soft nighttime glow | covers, presentations, product screens, demonstrations, entire landing pages with more emotional presentation |

The themes are equal. Choose according to task, viewing environment, and material mood rather than a “primary / auxiliary” hierarchy.

### 1.2. Intended feel

- clear;
- light;
- calm;
- contemporary;
- friendly;
- professional;
- technological without coldness;
- lively without childishness.

### 1.3. Principles of theme equality

- the same component has the same role in both themes;
- a state does not change meaning when the theme changes;
- the dark theme is not a mechanical inversion of the light theme;
- the light theme does not become a sterile, entirely white sheet;
- the dark theme is built on nighttime blue rather than absolute black;
- in both themes, the background is quieter than the content;
- contrast is checked separately for each theme;
- density, radii, sizes, and typographic hierarchy remain the same.

### 1.4. What the system no longer uses

- poster aggression;
- italic uppercase in every large heading;
- heavy black masses;
- grainy print texture;
- space and orbits as the primary metaphor;
- rigid screen division into color zones;
- sharp rectangular cards;
- neon and cyberpunk in the dark theme;
- decorative interface panels with no function.

---

## 2. Brand core

### 2.1. Who we are

**Isty is an AI automation studio that designs working systems for processes, integrations, interfaces, and handing solutions over to a team.**

We assemble:

- process maps;
- roles and areas of responsibility;
- scenarios and exceptions;
- integrations between services;
- interfaces for the team;
- event logs and statuses;
- handover instructions;
- AI assistants and automation where they strengthen the process.

### 2.2. Promise

Isty helps businesses assemble a working system around people: roles become clear, routine work moves into the process, and the team sees the next step.

### 2.3. Meaning pillars

| Pillar | Meaning | Visual expression |
|---|---|---|
| Clarity | What is happening is clear at first glance | strong hierarchy, short copy, clean diagrams |
| Ease | The system does not overwhelm people | a light base, space, soft surfaces |
| Framework | A process has boundaries and a route | connection lines, steps, statuses, structured cards |
| People | Automation supports the team | real working scenes, human copy |
| Handover | The result can be developed further | documentation, checklists, understandable interfaces |
| Movement | The next step is always visible | accented actions, progress, active route |

---

## 3. Visual grammar

Cloudline is built as a **calm working environment** that can be daytime or nighttime.

### 3.1. Basic elements

| Element | Role | Cloud Day | Cloud Night |
|---|---|---|---|
| Space | creates calm | light margins and generous spacing | open dark areas without excessive glow |
| Cloud | creates soft depth | blue and lavender blurred areas | subdued light areas within blue depth |
| Surface | holds information | white or slightly tinted card | blue-and-graphite card with a thin border |
| Route | shows a process | thin gray-blue line | subdued blue line with localized active glow |
| Warm point | adds mood | sunny label or human detail | golden label or warm light in a photograph |
| Contrast | maintains hierarchy | dark text in a light environment | light text on deep surfaces |

### 3.2. Basic composition formula

```text
calm environment
+ one strong meaning-focused block
+ one working visualization
+ one obvious next step
+ a small warm detail
```

The formula does not change when switching themes.

### 3.3. Density limit

One screen may contain at the same time:

- one main heading;
- one meaningful lead;
- one primary visual scene;
- one main CTA;
- up to three secondary information blocks;
- no more than two levels of nested cards.

If a screen requires eight floating cards, rebuild the composition.

### 3.4. Switching themes within material

- choose one main theme for a given format;
- the opposite theme may be used for a cover, divider, or one meaningful section;
- do not alternate light and dark backgrounds with every successive section;
- a product interface may offer a user theme switch;
- component structure, order, and dimensions stay unchanged when the theme changes;
- theme transitions should take `160–240ms` and affect only color, borders, shadows, and background.

---

## 4. Color and theme system

### 4.1. Token architecture

Colors are divided into three levels:

1. **Brand scales** — sky, lavender, mint, sun, and danger.
2. **Semantic tokens** — background, surface, text, border, action, success, attention, and error.
3. **Component tokens** — button background, hero surface, focus-ring, shadow, and other local decisions.

Components use only semantic and component tokens. Values such as `#ffffff`, `#17243a`, or `rgba(...)` must not be scattered throughout component styles.

### 4.2. Brand accents

| Family | Meaning | Light theme | Dark theme |
|---|---|---:|---:|
| `sky` | action, route, link, active stage | `#4776b7` | `#89b7ef` |
| `lavender` | analysis, AI, exploration | `#765eb5` | `#b8a8ee` |
| `mint` | readiness, success, confirmation | `#39755d` | `#91d3b5` |
| `sun` | attention, warm human detail | `#d9a842` | `#efc56d` |
| `danger` | error, risk, blocking state | `#a34550` | `#f0a0ac` |

In the dark theme, accents become lighter but occupy less area: color is used sparingly and locally.

### 4.3. Cloud Day — semantic palette

| Token | Value | Role |
|---|---:|---|
| `bg-page` | `#f4f8fd` | primary page background |
| `bg-page-alt` | `#fbfdff` | light depth variation |
| `surface-1` | `#ffffff` | primary surface |
| `surface-2` | `#f7faff` | secondary surface |
| `surface-3` | `#eef4fb` | selected or nested surface |
| `text-primary` | `#1f2a3d` | headings and body text |
| `text-secondary` | `#3d4b61` | leads and secondary text |
| `text-muted` | `#61718a` | captions and metadata |
| `border` | `#dce6f1` | ordinary border |
| `border-strong` | `#bdd5fa` | active border |
| `accent-primary` | `#4776b7` | primary interactive color |
| `accent-primary-strong` | `#365f98` | hover and dense accent |
| `accent-primary-soft` | `#e3eeff` | soft blue background |
| `accent-secondary` | `#765eb5` | secondary active color |
| `accent-secondary-soft` | `#f0ebff` | lavender surface |
| `success` | `#39755d` | success status |
| `success-soft` | `#e6f6ee` | success-status background |
| `warning` | `#7b5a13` | warning text |
| `warning-soft` | `#fff4d8` | warning background |
| `danger` | `#a34550` | error |
| `danger-soft` | `#fdebed` | error background |

### 4.4. Cloud Night — semantic palette

| Token | Value | Role |
|---|---:|---|
| `bg-page` | `#0d1727` | primary nighttime background |
| `bg-page-alt` | `#111d30` | soft depth variation |
| `surface-1` | `#142137` | primary surface |
| `surface-2` | `#17243a` | raised surface |
| `surface-3` | `#1b2b44` | selected or nested surface |
| `text-primary` | `#f1f6ff` | headings and body text |
| `text-secondary` | `#c6d1e1` | leads and secondary text |
| `text-muted` | `#91a2ba` | captions and metadata |
| `border` | `rgba(159,185,220,.18)` | ordinary border |
| `border-strong` | `#638fc8` | active border |
| `accent-primary` | `#89b7ef` | primary interactive color |
| `accent-primary-strong` | `#a4ccfb` | hover and dense accent |
| `accent-primary-soft` | `#1d3555` | blue nighttime surface |
| `accent-secondary` | `#b8a8ee` | secondary active color |
| `accent-secondary-soft` | `#292443` | lavender nighttime surface |
| `success` | `#91d3b5` | success status |
| `success-soft` | `#17372f` | success-status background |
| `warning` | `#efc56d` | warning |
| `warning-soft` | `#3b3120` | warning background |
| `danger` | `#f0a0ac` | error |
| `danger-soft` | `#3b2028` | error background |

### 4.5. CSS tokens for both themes

```css
:root,
html[data-theme="light"] {
  color-scheme: light;

  --bg-page: #f4f8fd;
  --bg-page-alt: #fbfdff;
  --surface-1: #ffffff;
  --surface-2: #f7faff;
  --surface-3: #eef4fb;

  --text-primary: #1f2a3d;
  --text-secondary: #3d4b61;
  --text-muted: #61718a;

  --border: #dce6f1;
  --border-strong: #bdd5fa;

  --accent-primary: #4776b7;
  --accent-primary-strong: #365f98;
  --accent-primary-soft: #e3eeff;
  --accent-secondary: #765eb5;
  --accent-secondary-soft: #f0ebff;

  --success: #39755d;
  --success-soft: #e6f6ee;
  --warning: #7b5a13;
  --warning-soft: #fff4d8;
  --danger: #a34550;
  --danger-soft: #fdebed;

  --button-primary-text: #ffffff;
  --button-primary-bg:
    linear-gradient(135deg, #4776b7 0%, #6f63b2 100%);
  --button-primary-bg-hover:
    linear-gradient(135deg, #365f98 0%, #5f4f9d 100%);

  --focus-ring: rgba(71, 118, 183, .18);
  --shadow-sm:
    0 1px 2px rgba(31, 42, 61, .04),
    0 6px 18px rgba(54, 95, 152, .06);
  --shadow-md:
    0 2px 4px rgba(31, 42, 61, .04),
    0 16px 40px rgba(54, 95, 152, .09);

  --page-atmosphere:
    radial-gradient(62% 42% at 8% 0%, rgba(189,213,250,.58), transparent 72%),
    radial-gradient(48% 34% at 92% 10%, rgba(213,201,248,.46), transparent 74%),
    linear-gradient(180deg, #fbfdff 0%, #f4f8fd 48%, #ffffff 100%);

  --hero-atmosphere:
    radial-gradient(72% 68% at 20% 8%, rgba(227,238,255,.95), transparent 72%),
    radial-gradient(58% 62% at 90% 88%, rgba(240,235,255,.90), transparent 74%),
    rgba(255,255,255,.86);
}

html[data-theme="dark"] {
  color-scheme: dark;

  --bg-page: #0d1727;
  --bg-page-alt: #111d30;
  --surface-1: #142137;
  --surface-2: #17243a;
  --surface-3: #1b2b44;

  --text-primary: #f1f6ff;
  --text-secondary: #c6d1e1;
  --text-muted: #91a2ba;

  --border: rgba(159, 185, 220, .18);
  --border-strong: #638fc8;

  --accent-primary: #89b7ef;
  --accent-primary-strong: #a4ccfb;
  --accent-primary-soft: #1d3555;
  --accent-secondary: #b8a8ee;
  --accent-secondary-soft: #292443;

  --success: #91d3b5;
  --success-soft: #17372f;
  --warning: #efc56d;
  --warning-soft: #3b3120;
  --danger: #f0a0ac;
  --danger-soft: #3b2028;

  --button-primary-text: #0c1726;
  --button-primary-bg:
    linear-gradient(135deg, #93c2f7 0%, #bba9ef 100%);
  --button-primary-bg-hover:
    linear-gradient(135deg, #acd2fb 0%, #cabaf3 100%);

  --focus-ring: rgba(137, 183, 239, .22);
  --shadow-sm:
    0 1px 2px rgba(0, 0, 0, .16),
    0 10px 28px rgba(2, 8, 20, .24);
  --shadow-md:
    0 2px 4px rgba(0, 0, 0, .18),
    0 22px 58px rgba(2, 8, 20, .32);

  --page-atmosphere:
    radial-gradient(58% 42% at 8% 0%, rgba(79,124,182,.30), transparent 74%),
    radial-gradient(48% 36% at 92% 8%, rgba(122,100,182,.26), transparent 75%),
    radial-gradient(40% 28% at 48% 44%, rgba(56,105,145,.13), transparent 78%),
    linear-gradient(180deg, #0d1727 0%, #111d30 48%, #0c1626 100%);

  --hero-atmosphere:
    radial-gradient(72% 68% at 16% 8%, rgba(47,82,126,.52), transparent 72%),
    radial-gradient(58% 62% at 90% 88%, rgba(82,65,126,.48), transparent 74%),
    rgba(17,28,46,.80);
}
```

### 4.6. Theme selection

| Situation | Recommended theme | Allowed alternative |
|---|---|---|
| Long reading, documentation | Cloud Day | Cloud Night by user choice |
| Business proposal | Cloud Day | dark cover + light content |
| Landing page | either, depending on the message | individual sections using the opposite theme |
| Presentation cover | Cloud Night | Cloud Day for a more formal presentation |
| Product interface | user choice | device system theme |
| Process demonstration | either | theme of the environment showing the demo |
| Social media | either | a series may alternate themes between posts |

### 4.7. Color balance

**Cloud Day:**

- 68–78% — light neutrals and surfaces;
- 10–15% — sky blue;
- 5–8% — lavender;
- 2–4% — mint;
- up to 2% — sunny accent.

**Cloud Night:**

- 72–82% — deep blue neutrals;
- 8–12% — lighter surfaces;
- 4–7% — sky accent;
- 3–5% — lavender or mint;
- up to 2% — sunny accent.

One screen does not need every accent color at once. The basic combination is `sky + one additional accent`.

### 4.8. Contrast

- ordinary text: at least `4.5:1`;
- large text: at least `3:1`;
- `text-muted` is used only for secondary information but retains contrast of at least `4.5:1` on the primary background;
- pastel and dark soft surfaces are backgrounds, not colors for small text;
- status must not be conveyed by color alone: add text, an icon, or a shape;
- check the dark theme separately; automatic token replacement does not establish correctness;
- do not use pure white `#ffffff` for all dark-theme text: the base color is `#f1f6ff`;
- do not use absolute black `#000000` as the primary background.

### 4.9. Implementing the switch

- set the theme through `html[data-theme="light"]` or `html[data-theme="dark"]`;
- without a user choice, `prefers-color-scheme` may be considered;
- persist the user's choice;
- set the theme in `<head>` before interface initialization to prevent a light flash;
- `filter: invert(...)` and automatic image transformation are prohibited;
- when switching, animate only `color`, `background-color`, `border-color`, `box-shadow`, and background-area opacity.

---

## 5. Background and cloud atmosphere

### 5.1. Primary page background

```css
body {
  color: var(--text-primary);
  background: var(--page-atmosphere);
}
```

The background creates an environment without becoming an illustration in its own right.

### 5.2. Cloud Day

The light theme is built on a milky white and cool cloud background.

Rules:

- central text areas remain nearly neutral;
- blue and lavender blur sits near the edges or behind large visual scenes;
- white surfaces are separated by a border and a small shadow;
- gray must not take over the whole page;
- the background must not resemble a medical or banking template.

### 5.3. Cloud Night

The dark theme is built on deep nighttime blue rather than black.

Rules:

- primary depth: `#0d1727 → #111d30`;
- light areas are subdued and broad;
- blue or lavender glow is not used around every component;
- surfaces are separated by borders, brightness differences, and very soft shadows;
- backgrounds become flatter beneath long text;
- no more than two noticeable light areas per viewport;
- the dark theme should feel calm rather than like a game or cyberpunk.

### 5.4. Cloud areas

A cloud area is a large blurred patch of color that creates depth without competing with text.

Rules:

- area size: `320px` to `900px`;
- blur: `48–96px`;
- opacity in Cloud Day: `0.18–0.55`;
- opacity in Cloud Night: `0.10–0.32`;
- no more than three areas per viewport;
- backgrounds behind small text remain nearly neutral;
- a cloud must not look like a literal cloud icon;
- area edges must not form a noticeable band.

### 5.5. Structural grid

A very thin grid is allowed in process and technical blocks:

```css
.process-surface {
  background-image:
    linear-gradient(color-mix(in srgb, var(--accent-primary) 6%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 6%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

Text pages do not need a grid. Its contrast in the dark theme must be lower than in the light theme.

### 5.6. Prohibited

- muddy gray backgrounds across the entire page;
- absolute black backgrounds;
- blur directly behind small text;
- excessive glassmorphism;
- cards that do not separate from the background;
- rainbow gradients;
- many small patches of color;
- literal cloud clip art;
- neumorphism with poorly readable boundaries;
- neon glow around every active element;
- stars, cosmic dust, and sci-fi as Cloud Night's permanent background.

---

## 6. Typography

The typographic system is the same for Cloud Day and Cloud Night. The theme changes text color, but not size, weight, rhythm, or line length.

### 6.1. Typefaces

Primary typeface: **Onest**.

Fallback:

```css
font-family: Onest, Inter, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

Technical typeface: **JetBrains Mono**.

Use it only for:

- ID;
- times;
- integration statuses;
- short technical labels;
- code;
- step numbers.

### 6.2. Hero H1

```css
font-size: clamp(48px, 6vw, 84px);
font-weight: 700;
font-style: normal;
letter-spacing: -0.04em;
line-height: 1.04;
color: var(--text-primary);
text-wrap: balance;
```

Rules:

- normal case, not uppercase;
- no italics;
- no more than three lines;
- guideline: 6–14 words;
- a key word may use `accent-primary-strong` or `accent-secondary`;
- check line breaks manually;
- the heading should read as a clear promise rather than an advertising slogan;
- Cloud Night headings have no glow or text shadow.

### 6.3. H2

```css
font-size: clamp(36px, 4.2vw, 56px);
font-weight: 680;
letter-spacing: -0.032em;
line-height: 1.08;
color: var(--text-primary);
text-wrap: balance;
```

### 6.4. H3

```css
font-size: clamp(24px, 2.2vw, 32px);
font-weight: 650;
letter-spacing: -0.02em;
line-height: 1.16;
color: var(--text-primary);
```

### 6.5. Lead

```css
font-size: clamp(19px, 1.8vw, 23px);
line-height: 1.5;
color: var(--text-secondary);
max-width: 56ch;
```

### 6.6. Body text

```css
font-size: 17px;
line-height: 1.65;
color: var(--text-secondary);
max-width: 68ch;
```

Documents may use `16px / 1.65`.

### 6.7. UI text

| Element | Size | Weight | Line height |
|---|---:|---:|---:|
| Navigation | `14px` | `600` | `1.4` |
| Button | `15px` | `650` | `1` |
| Field label | `13px` | `600` | `1.35` |
| Field text | `16px` | `500` | `1.4` |
| Status | `13px` | `600` | `1.2` |
| Metadata | `12px` | `550` | `1.35` |
| Monospace label | `11–12px` | `500` | `1.35` |

### 6.8. Line length

- body text: `55–68ch`;
- lead: `42–56ch`;
- text inside a card: `28–44ch`;
- table row: according to meaning, without artificial stretching;
- on mobile, text must not press against screen edges.

### 6.9. Color hierarchy

| Role | Token |
|---|---|
| Heading and key number | `text-primary` |
| Body paragraph and lead | `text-secondary` |
| Metadata and caption | `text-muted` |
| Link and active text | `accent-primary-strong` |
| Analytical highlight | `accent-secondary` |
| Success status | `success` |

### 6.10. What not to use

- long paragraphs spanning the full screen width;
- uppercase section headings;
- italics as the brand's permanent character;
- weight `800–900` without a specific reason;
- low-contrast text;
- pure white for all Cloud Night text;
- centered long text;
- monospace used solely for atmosphere;
- glow, outline, or shadow around dark-theme headings.

---

## 7. Grid, widths, and spacing

Geometry does not change between themes.

### 7.1. Container

```css
.container {
  width: min(100% - 48px, 1240px);
  margin-inline: auto;
}
```

On mobile:

```css
.container {
  width: min(100% - 32px, 1240px);
}
```

### 7.2. Main grid

Desktop:

```css
display: grid;
grid-template-columns: repeat(12, minmax(0, 1fr));
gap: 24px;
```

Tablet:

```css
grid-template-columns: repeat(8, minmax(0, 1fr));
gap: 20px;
```

Mobile:

```css
grid-template-columns: repeat(4, minmax(0, 1fr));
gap: 16px;
```

### 7.3. Vertical rhythm

| Level | Desktop | Tablet | Mobile |
|---|---:|---:|---:|
| Between major sections | `112px` | `80px` | `56px` |
| Within a section | `48px` | `40px` | `32px` |
| Between meaningful blocks | `32px` | `28px` | `24px` |
| Between related elements | `16px` | `16px` | `12px` |
| Micro-spacing | `8px` | `8px` | `8px` |

### 7.4. Radii

```css
--radius-sm: 10px;
--radius-md: 16px;
--radius-lg: 24px;
--radius-xl: 32px;
--radius-pill: 999px;
```

Rules:

- buttons and fields: `12–16px`;
- cards: `20–24px`;
- large hero surface: `28–32px`;
- pill shapes are used only for tags and statuses;
- do not mix five different radii within one block.

### 7.5. Depth

```css
.surface {
  border: 1px solid var(--border);
  background: var(--surface-1);
  box-shadow: var(--shadow-sm);
}
```

Cloud Day separates surfaces using a border and an airy shadow. Cloud Night uses brightness differences, a thin border, and very soft inner lighting.

```css
html[data-theme="dark"] .surface {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .025),
    var(--shadow-sm);
}
```

A shadow creates depth, not a floating-tile effect. The darker the theme, the more important borders and surface differences become relative to shadow size.

---

## 8. First screen

### 8.1. Basic structure

The first screen consists of two meaningful areas:

1. **Meaning** — heading, lead, CTA, short evidence.
2. **Working scene** — process diagram, interface, result, or a person in a working context.

Recommended grid:

```css
.hero-copy {
  grid-column: span 5;
}

.hero-scene {
  grid-column: span 7;
}
```

A `6 / 6` split is allowed on narrow desktop layouts.

### 8.2. Meaning-focused column

Order:

1. short category label;
2. H1;
3. lead;
4. primary and secondary CTA;
5. one trust-building line: timeframe, format, result, or fact.

Do not add a separate text block for each benefit.

### 8.3. Working scene

```css
.hero-scene {
  position: relative;
  min-height: 560px;
  padding: clamp(24px, 3vw, 40px);
  border: 1px solid var(--border);
  border-radius: 32px;
  color: var(--text-primary);
  background: var(--hero-atmosphere);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}
```

Cloud Night adds barely noticeable inner light:

```css
html[data-theme="dark"] .hero-scene {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .035),
    var(--shadow-md);
}
```

The scene should contain one of three things:

- a clear process route;
- an interface with actual statuses;
- a photograph of a person with one information layer.

### 8.4. Theme behavior

| Element | Cloud Day | Cloud Night |
|---|---|---|
| Scene background | white with blue and lavender depth | translucent nighttime blue with subdued light |
| Main text | `text-primary` | `text-primary`, without pure white or glow |
| CTA | dark gradient, white text | light gradient, dark text |
| Secondary button | white surface | blue-and-graphite surface |
| Route | thin gray-blue line | subdued blue line with a lighter active segment |
| Warm accent | small golden detail | localized warm light or label |

### 8.5. Hero variants

**Variant A — product or service**

On the right: 3–5 process nodes connected by a route. One node is active; one shows a result.

**Variant B — case study**

On the right: a calm human photograph with one result card and one short metric overlaid.

**Variant C — document or business proposal**

On the right: a structured card for work scope, timeframe, and result without a decorative scene.

**Variant D — theme as part of the product**

A compact Cloud Day / Cloud Night switch is allowed in the header. It must not compete with the main CTA.

### 8.6. Hero constraints

- no more than two CTAs;
- no more than one primary metric;
- no more than five diagram nodes;
- no more than three colored surfaces;
- no carousel;
- no background video;
- no endlessly floating cards;
- no text over a complex image;
- no neon lighting on every card;
- no exact half-light, half-dark screen split unless the screen demonstrates a theme comparison.

---

## 9. Surfaces and cards

### 9.1. Base card

```css
.card {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  background: var(--surface-1);
  box-shadow: var(--shadow-sm);
}
```

The same CSS works in both themes.

### 9.2. Card types

| Type | Purpose | Semantic background |
|---|---|---|
| `plain` | primary content | `surface-1` |
| `soft` | secondary information | `surface-2` |
| `selected` | selected area | `surface-3` |
| `sky` | active process or action | `accent-primary-soft` |
| `lavender` | analysis, AI, exploration | `accent-secondary-soft` |
| `mint` | result, readiness, success | `success-soft` |
| `sun` | attention or human detail | `warning-soft` |
| `danger` | error or blocking state | `danger-soft` |

Colored cards remain dark in Cloud Night. Do not substitute light pastel backgrounds from Cloud Day.

### 9.3. Card structure

Recommended order:

1. icon or label;
2. heading;
3. up to four lines of text;
4. status, metric, or action.

A card should answer one question.

### 9.4. Nesting

At most two levels are allowed:

```text
section
└── main surface
    └── local element or row
```

A card inside a card inside a card is prohibited.

### 9.5. Hover

```css
.card[data-clickable="true"] {
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease;
}

.card[data-clickable="true"]:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
  box-shadow: var(--shadow-md);
}
```

Cards do not jump, scale, or gain an outer glow.

### 9.6. Surface separation in Cloud Night

In the dark theme, adjacent levels must differ in at least two ways:

- background brightness;
- border;
- shadow or inner line;
- density of the color tint.

Transparency alone is insufficient.

---

## 10. Buttons, links, and fields

### 10.1. Primary button

```css
.button-primary {
  min-height: 50px;
  padding: 0 20px;
  border: 0;
  border-radius: 14px;
  color: var(--button-primary-text);
  background: var(--button-primary-bg);
  box-shadow: var(--shadow-sm);
  font-size: 15px;
  font-weight: 650;
  transition:
    background 180ms ease,
    box-shadow 180ms ease;
}

.button-primary:hover {
  background: var(--button-primary-bg-hover);
  box-shadow: var(--shadow-md);
}

.button-primary:active {
  box-shadow: var(--shadow-sm);
}
```

- Cloud Day: a denser blue-violet gradient and white text;
- Cloud Night: a light sky-lavender gradient and dark text;
- the button does not lift or enlarge;
- no outer glow.

### 10.2. Secondary button

```css
.button-secondary {
  min-height: 50px;
  padding: 0 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text-primary);
  background: var(--surface-1);
  box-shadow: var(--shadow-sm);
}

.button-secondary:hover {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
```

### 10.3. Text link

```css
.text-link {
  color: var(--accent-primary-strong);
}
```

- an underline appears on hover or remains permanently in long text;
- an adjacent arrow is allowed;
- the link must not look like a third button type;
- check link color separately in each theme.

### 10.4. CTA copy

Preferred wording:

- `Discuss the task`;
- `View the approach`;
- `Open the case study`;
- `Show the process`;
- `Get a launch plan`;
- `Go to the next step`.

Avoid:

- `Learn more` without context;
- `Try the magic`;
- `Launch the future`;
- promises of instant results;
- uppercase and exclamation marks.

### 10.5. Fields

```css
.input {
  min-height: 50px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text-primary);
  background: var(--surface-1);
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus-visible {
  border-color: var(--accent-primary);
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
}
```

A placeholder must not be a field's only label.

### 10.6. Disabled and loading

- disabled states reduce contrast but remain readable;
- overall component opacity must not fall below `0.55`;
- loading does not change button width;
- a spinner inherits the button text color;
- a state is not indicated solely by reduced brightness.

---

## 11. Processes, routes, and UI panels

Process graphics are a key Cloudline brand element. Their logic is the same in both themes.

### 11.1. Nodes

A node contains:

- a short name;
- a state;
- a responsible role if needed;
- one next transition.

```css
.flow-node {
  min-width: 180px;
  max-width: 280px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 18px;
  color: var(--text-primary);
  background: var(--surface-1);
  box-shadow: var(--shadow-sm);
}
```

### 11.2. Lines

```css
.route-default  { stroke: var(--border-strong); }
.route-active   { stroke: var(--accent-primary); }
.route-complete { stroke: var(--success); }
.route-error    { stroke: var(--danger); }
```

Rules:

- ordinary connection: `1.5px`;
- active and completed connections: `2px`;
- dashed lines are used only for conditional or future transitions;
- arrows are small and functional;
- lines must not cross text;
- in Cloud Night, only a short active segment glows, not the entire route.

### 11.3. Node states

| State | Background | Border | Text |
|---|---|---|---|
| Normal | `surface-1` | `border` | `text-primary` |
| Selected | `surface-3` | `border-strong` | `text-primary` |
| Active | `accent-primary-soft` | `border-strong` | `accent-primary-strong` |
| Analysis | `accent-secondary-soft` | `accent-secondary` | `accent-secondary` |
| Done | `success-soft` | `success` | `success` |
| Attention | `warning-soft` | `warning` | `warning` |
| Error | `danger-soft` | `danger` | `danger` |

State text remains mandatory.

### 11.4. Panels

A UI panel must convey actual meaning:

- project status;
- next step;
- inputs;
- response rule;
- automation result;
- readiness criterion;
- short metric;
- recent event log.

Do not use a panel as an empty decorative rectangle.

### 11.5. Tables

```css
.table-wrap {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface-1);
}

th {
  color: var(--text-secondary);
  background: var(--surface-2);
  font-size: 13px;
  font-weight: 650;
}

td,
th {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
```

Rules:

- no heavy zebra striping;
- an important column may use `surface-3`;
- numbers are right-aligned;
- statuses use text and color;
- Cloud Night rows are not separated by black stripes;
- on mobile, tables scroll or become a card list.

### 11.6. Charts

- chart background: `surface-1`;
- grid: `border` with reduced opacity;
- primary series: `accent-primary`;
- comparison series: `accent-secondary`;
- positive result: `success`;
- warning: `warning`;
- axis labels: `text-muted`;
- the same color denotes the same series in both themes.

---

## 12. Images

### 12.1. Main principle

Images show **people whose work has become easier**.

Formula:

```text
a real person
+ clear working context
+ natural or soft directional light
+ a sense of calm organization
```

### 12.2. Suitable scenes

- a person by a window with a laptop;
- a small team at a board;
- a specialist checking a result on screen;
- a calm conversation with a client;
- work in a studio, office, library, or cafe;
- a moment of handover, discussion, or recording a result;
- a workspace with open space and natural details.

### 12.3. Mood

- natural facial expressions;
- confidence without staged victory;
- a calm smile is allowed;
- the person is engaged in a real action;
- the image does not resemble a bank advertisement or a stock photo about synergy;
- there is space around the person.

### 12.4. Cloud Day processing

```css
html[data-theme="light"] img[data-brand-image] {
  filter:
    saturate(.90)
    contrast(.96)
    brightness(1.04);
}
```

A soft blue or lavender overlay with opacity `0.06–0.14` is allowed.

### 12.5. Cloud Night processing

```css
html[data-theme="dark"] img[data-brand-image] {
  filter:
    saturate(.82)
    contrast(1.03)
    brightness(.88);
}
```

A blue-and-graphite gradient with opacity `0.16–0.34` may overlay the photograph. Faces, hands, and important working details must not disappear into shadow.

For a key hero, prepare separate cropping or processing for each theme rather than relying solely on a CSS filter.

### 12.6. Cropping

- faces and hands are not cropped accidentally;
- the main subject is not pressed against an edge;
- the image retains a safe area for one short caption;
- frame radius: `24–32px`;
- the horizon is not tilted without an artistic reason;
- check the dark version on an ordinary monitor, not only an HDR monitor.

### 12.7. Do not use

- robots and androids;
- holographic faces;
- blue cyberspaces;
- a person pointing into empty air;
- an excessively happy team around a laptop;
- a sterile white office with no details;
- dark sci-fi and neon server rooms;
- literal clouds as a permanent photographic background;
- artificial objects in a person's hands;
- automatic photo inversion on theme changes.

---

## 13. Illustrations, icons, and logo

### 13.1. Illustrations

Basic forms:

- translucent soft areas;
- thin route lines;
- nodes and dots;
- layers converging into one system;
- simple diagrams;
- an abstract horizon or stream of light.

Style:

- 2D;
- soft depth;
- limited palette;
- minimal detail;
- no glossy 3D;
- no cartoon characters;
- no literal AI-brain imagery.

In Cloud Night, illustrations must not become neon outlines. The main mass stays dark; light highlights only meaningful points.

### 13.2. Icons

- line icons;
- stroke width: `1.75–2px`;
- rounded ends;
- interface size: `18–22px`;
- card size: `22–28px`;
- icon container: `40–48px`;
- one set and consistent optical treatment throughout the format;
- base color: `text-secondary`;
- active color: `accent-primary`;
- container background: `surface-2` or a theme-specific soft token.

An icon helps identify a function but does not replace its label.

### 13.3. Logo

The logo is used as a standalone mark. Do not repeat `Isty` beside it if the name is already part of the logo.

Recommended colors:

| Context | Color |
|---|---|
| Cloud Day, neutral | `text-primary` |
| Cloud Day, accent | `accent-primary-strong` |
| Cloud Night, neutral | `text-primary` |
| Cloud Night, accent | `accent-primary` or a soft sky/lavender gradient |
| On the primary CTA | `button-primary-text` |

The header logo must not compete with the CTA. Cloud Night uses no outer glow around the logo; only a small shadow beneath the mark's colored container is allowed.

### 13.4. Theme toggle

The theme switch:

- uses recognizable sun and moon icons together with `aria-label`;
- has an interactive area of at least `44 × 44px`;
- shows the current state;
- does not look like the main CTA;
- persists the user's choice;
- does not reposition navigation when switching.

---

## 14. Animation

Overall character: **calm confirmation of an action**.

### 14.1. Tokens

```css
:root {
  --duration-fast: 160ms;
  --duration-base: 240ms;
  --duration-slow: 420ms;
  --ease-standard: cubic-bezier(.22, 1, .36, 1);
}
```

### 14.2. Allowed movements

- fade + movement of up to `8px` on appearance;
- smooth filling of a route;
- changing an active node's border and background;
- appearance of a status;
- a gentle number change;
- accordion expansion;
- short arrow movement of up to `3px`;
- one slow cloud-gradient shift on load.

### 14.3. Constraints

- no constantly floating cards;
- no parallax on long pages;
- no CTA scaling;
- no spring transitions;
- no abrupt blur;
- do not animate every decorative element;
- no more than two meaningful objects moving at once;
- `prefers-reduced-motion` is mandatory.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
```

---

## 15. Copy and tone

Isty's tone:

- calm;
- engineering-minded;
- human;
- clear;
- confident;
- without showy technological posturing;
- without pressure;
- respectful of the client's reality.

### 15.1. Basic copy formula

```text
what is happening
→ what Isty assembles
→ what the team will see
→ what the next step is
```

### 15.2. Preferred wording

- `We assemble a process that the team understands and can develop.`
- `We show roles, events, and response rules in one working system.`
- `The next step is visible to the team and recorded in the process.`
- `We hand over the solution with documentation and a clear support framework.`
- `Automation handles routine work while decisions stay with the team.`

### 15.3. Meaningful verbs

- assemble;
- show;
- connect;
- hand over;
- develop;
- integrate;
- record;
- see;
- launch;
- describe;
- check;
- simplify;
- guide.

### 15.4. What to avoid

- AI hype vocabulary;
- claims of revolution;
- artificially sharp contrasts;
- excessive promises;
- bureaucratic language;
- long introductory constructions;
- abstractions without a result;
- words such as `magic`, `the future is already here`, and `explosive growth`;
- strings of exclamation marks;
- decorative English terminology where a clear Russian word exists.

---

## 16. Application by format

### 16.1. Landing page

A landing page may be entirely light or entirely dark.

Section order:

1. clear promise and working scene;
2. problem or context;
3. process diagram;
4. what the working system includes;
5. case study or evidence;
6. launch format;
7. handover and support;
8. next step.

Theme rules:

- choose one main theme before designing;
- use the opposite theme in no more than one or two meaningful sections;
- do not change themes after every screen;
- a user switch is allowed if both versions have been fully checked;
- Cloud Night may cover the entire landing page if readability and calm depth are preserved.

### 16.2. Presentations

Both themes are equal.

**Cloud Day:**

- detailed diagrams;
- tables;
- financial blocks;
- long explanations;
- print materials.

**Cloud Night:**

- covers;
- key conclusions;
- demonstration slides;
- talks in dark rooms;
- an entire presentation with little text.

General rules:

- one conclusion per slide;
- headings of up to two lines;
- one main visual object;
- do not use a decorative gradient on every slide;
- in a mixed presentation, Cloud Day handles details and Cloud Night handles accent transitions;
- the theme does not change without a meaningful reason.

### 16.3. Documents and business proposals

Cloud Day is preferred for primary content because of printing and sustained reading.

Allowed:

- a dark cover;
- a dark divider;
- a dark single-page digital version;
- full Cloud Night for an unprinted document with short blocks.

General rules:

- line width up to `68ch`;
- tables use semantic tokens;
- decorative clouds appear only on covers or dividers;
- mint means an accepted decision or readiness;
- sun means a question or attention area;
- status meaning is preserved between themes.

### 16.4. Internal interfaces

Priority:

1. state;
2. next step;
3. responsibility;
4. deadline;
5. event history.

Support for both themes through the same semantic tokens is recommended.

- persist the user's theme;
- use the system theme only as the initial value;
- check charts and statuses in both themes;
- use color for navigation and state rather than decoration;
- do not release a “dark theme” that changes only the page background.

### 16.5. Social media

Both themes suit a series.

- one point;
- one process or human visual;
- up to two accent colors;
- a large heading without uppercase;
- a short caption;
- the logo in a quiet area;
- no dozen tiny cards;
- light and dark posts may alternate while retaining one grid and typography.

### 16.6. Mixed format

When one piece of material uses both themes:

- Cloud Day and Cloud Night are separated by an entire section or slide;
- the transition supports meaning: introduction, climax, conclusion, or a move to details;
- components do not change geometry;
- accent colors retain their meanings;
- after switching, retain the theme long enough to avoid visual flicker.

---

## 17. Responsiveness

### 17.1. Desktop

- hero: `5 / 7` or `6 / 6`;
- working scene at least `520px` high;
- sections use 12 columns;
- body text does not stretch across the full width;
- large cards may use `2 × 2` or `3 × 1`.

### 17.2. Tablet

- the hero usually becomes `4 / 4`;
- H1 size decreases to `48–64px`;
- decorative clouds are reduced;
- complex diagrams simplify to a linear route;
- cards rearrange into two columns.

### 17.3. Mobile

Hero order:

1. label;
2. H1;
3. lead;
4. primary CTA;
5. secondary CTA or link;
6. working scene;
7. trust-building line.

Rules:

- H1: `40–50px`, `line-height: 1.05`;
- horizontal padding: `16px`;
- buttons may span the full width;
- cards use one column;
- diagrams become vertical routes;
- decorative lines do not cross text;
- tables scroll horizontally or become lists;
- hover is not the only way to reveal an action;
- interactive area size is at least `44 × 44px`;
- in Cloud Night, surface opacity is increased to keep cards separate from the background;
- background-area blur is reduced by `20–35%` for performance;
- the theme switch stays accessible without occupying the primary action's space.

---

## 18. Accessibility

Mandatory requirements for both themes:

- ordinary-text contrast of at least `4.5:1`;
- large-text contrast of at least `3:1`;
- body-text size of at least `16px`;
- visible `focus-visible`;
- status is not conveyed by color alone;
- controls have understandable labels;
- images have meaningful `alt` text;
- decorative images have empty `alt` text;
- logical focus order matches visual order;
- touch targets are at least `44 × 44px`;
- form errors explain what to fix;
- animation respects `prefers-reduced-motion`;
- blur and transparency do not reduce readability;
- headings follow the correct hierarchy.

### 18.1. Checking theme parity

Check each component in at least these states:

- default;
- hover;
- focus-visible;
- active;
- selected;
- disabled;
- loading;
- success;
- warning;
- error.

Check matrix:

```text
component × state × Cloud Day × Cloud Night × desktop/mobile
```

### 18.2. Dark theme

- explicitly set `color-scheme: dark`;
- system fields and scrollbars must not remain dazzlingly light;
- the primary background is not pure black;
- white text is replaced with the soft cool `text-primary`;
- glow is not the only focus indicator;
- images are not darkened until meaningful details disappear;
- check the interface on an SDR monitor and at reduced brightness.

### 18.3. Light theme

- white surfaces are separated from the background by a border or shadow;
- secondary text does not become too light;
- pastel-on-pastel is not used for small text;
- field boundaries are visible without hover;
- highly saturated background clouds do not pass behind long paragraphs.

---

## 19. Anti-patterns

### 19.1. Overly “cute cloud”

Signs:

- literal little clouds everywhere;
- pastels without contrast;
- cartoon icons;
- every element rounded into a pill;
- childish character expressions.

Solution: restore a strict grid, functional diagrams, and contrasting text; confine decorative clouds to the background.

### 19.2. Generic SaaS

Signs:

- a violet-blue gradient on every element;
- dozens of floating glass cards;
- an abstract 3D sphere;
- a template heading about business growth;
- identical icon cards in every section.

Solution: show Isty's real processes, use one main accent, and build the composition around the result.

### 19.3. Fake dark theme

Signs:

- only the body background has changed;
- cards remain white or receive arbitrary opacity;
- links, focus, and statuses are not adapted;
- images are merely darkened;
- system elements remain light;
- contrast has not been checked.

Solution: use the complete set of semantic tokens and check every component in all states.

### 19.4. An overly heavy night

Signs:

- nearly black background;
- huge dense shadows;
- harsh white text;
- neon around every button;
- cyberpunk, stars, and cosmic dust;
- too much glass.

Solution: restore nighttime blue, soft text, localized light areas, and distinct surfaces.

### 19.5. An overly sterile day

Signs:

- an entirely white page;
- gray borders without depth;
- no human detail;
- an administrative-dashboard feel.

Solution: add one cloud area, a human image, or a warm accent while preserving clarity.

### 19.6. Overly decorative

Signs:

- the background is more active than the text;
- lines do not show a route;
- cards convey no meaning;
- sky, lavender, mint, sun, and danger are used simultaneously;
- the visual cannot be explained in one sentence.

Solution: remove everything that does not help explain the process, state, or next step.

### 19.7. Two different design systems

Signs:

- different radii or sizes in the dark theme;
- a component changes position;
- a status color changes meaning;
- the dark version looks like a separate brand;
- content must be rewritten for the theme.

Solution: retain one geometry and semantics; change only atmosphere and color tokens.

---

## 20. Migration from Retro Orbit Editorial

| Before | After |
|---|---|
| dark graphite base and paper alternative | two equal themes, Cloud Day and Cloud Night |
| large italic uppercase | calm heading in normal case |
| central poster scene | working process scene |
| orbits and space | routes, connections, and nodes |
| grain and print texture | clean surfaces and soft depth |
| sharp rectangles | radii of `16–32px` |
| violet + sage as the main pair | sky as primary, lavender/mint as support |
| strong visual impact | clarity, trust, and ease of reading |
| two visually separate modes | one component system using semantic tokens |
| decorative UI panels | functional panels only |

When updating existing materials, change these first:

1. token architecture;
2. background and surfaces;
3. heading typography;
4. radii and depth;
5. palette;
6. hero composition;
7. process graphics;
8. images;
9. animation.

Old orbital lines, grain, and poster blocks do not transfer automatically to the new system.

### 20.1. Migration from the light Cloudline prototype

To add Cloud Night to an already built light interface:

1. replace raw colors with semantic tokens;
2. move hero and page gradients into variables;
3. move text, borders, shadows, and surfaces into theme tokens;
4. replace white `rgba(...)` values inside components with `surface-*`;
5. add separate primary CTA values for Cloud Night;
6. check photographs and charts;
7. add `color-scheme`;
8. check all component states;
9. check for no incorrect-theme flash on load;
10. complete the accessibility matrix for both themes.

---

## 21. Quality checklist

### 21.1. Overall system

- [ ] H1 is easy to read and does not look aggressive.
- [ ] Body text has sufficient contrast.
- [ ] Text width does not exceed `68ch`.
- [ ] The screen has one main idea.
- [ ] The working scene shows a real process or result.
- [ ] The CTA names a specific action.
- [ ] Cards have a function.
- [ ] No more than two levels of nesting.
- [ ] No more than two accent colors are used at once.
- [ ] Cloud areas do not hinder reading.
- [ ] No literal cloud clip art.
- [ ] No italic uppercase or poster aggression.
- [ ] No excessive glassmorphism.
- [ ] No random floating cards.
- [ ] Status is understandable without color.
- [ ] Focus states are visible.
- [ ] The mobile version preserves the order of ideas.
- [ ] People understand what to do next.

### 21.2. Cloud Day

- [ ] Light surfaces are separated from the background.
- [ ] Secondary text is not too light.
- [ ] Pastels are not used for small text.
- [ ] White does not fill the entire page without depth.
- [ ] Blue and lavender backgrounds do not compete with content.

### 21.3. Cloud Night

- [ ] The background is blue-and-graphite rather than black.
- [ ] Body text is soft, without dazzling white.
- [ ] Cards differ by surface level.
- [ ] No neon or sci-fi.
- [ ] Glow does not replace borders and focus.
- [ ] Accent colors occupy a small area.
- [ ] Photographs preserve faces and working details.
- [ ] System fields and controls are actually dark.

### 21.4. Theme parity

- [ ] Components have the same geometry.
- [ ] Content order does not change.
- [ ] Statuses retain their meanings.
- [ ] All states are checked in both themes.
- [ ] Charts retain their color-to-series mappings.
- [ ] Switching does not cause a layout jump.
- [ ] There is no incorrect-theme flash on load.

---

## 22. Short formula

**Isty Cloudline is a professional system about clear processes, calm automation, and people whose work becomes easier.**

Two atmospheres of one brand:

```text
Cloud Day   = space / daylight / clean surfaces / calm clarity
Cloud Night = nighttime blue / soft glow / deep surfaces / organized focus
```

Shared visual language:

```text
sky / lavender / mint / warm point / soft surface /
route / human / next step / shared theme semantics
```
