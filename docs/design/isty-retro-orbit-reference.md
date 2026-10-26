---
type: reference
project: Isty
title: Isty Design System
date: 2026-07-01
status: canonical
optional_visual_example: Isty Canonical Design Reference/concepts/index.html
---

# Isty Design System

This document records Isty's new visual language after the rebrand. Its purpose is to provide enough detail to build a landing page, presentation, business proposal, interface cover, social media post, or internal screen without losing the brand's character.

An additional visual example sits alongside the document:

`Isty Canonical Design Reference/concepts/index.html`

The archive of earlier exploratory variations is stored separately:

`landing-hero-rebrand/_archive_old_designs/`

---

## 1. Core idea

Isty's style is called **Retro Orbit Editorial**.

It is an editorial, poster, and interface system for a company that works with complex processes, AI systems, and handing solutions over to a team. Visually, the style combines:

- large italic typography;
- a violet-and-sage palette;
- a dark graphite base;
- a light paper alternative;
- a grainy print texture;
- a central human scene;
- restrained UI panels;
- orbital lines and contours;
- a sense of calm movement.

The main emotion: **a complex workflow becomes visible, organized, and alive**.

Isty speaks in the language of people, working circumstances, and an understandable system rather than abstract AI science fiction. Space and orbits serve as metaphors for exploration, scale, and navigation. People, work, the process framework, and handing over the result remain central.

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

Isty helps businesses assemble a working system around people: roles become clear, routine work moves into the system, and the team sees its next step.

### 2.3. Meaning pillars

| Pillar | Meaning | Visual expression |
|---|---|---|
| Ease | The process becomes calmer and clearer | a large slogan, clean structure, soft transitions |
| Framework | The process gains boundaries and a route | orbital lines, grid, steps, panels |
| People | The system is built around the team | real human scenes, working situations |
| Handover | The result can evolve without constant dependency | UI blocks, steps, statuses, documentation |
| Exploration | Isty can enter complex and unknown territory | space lighting, orbits, unusual circumstances |

---

## 3. First-screen pattern

The first screen in **Retro Orbit Editorial / Violet Sage Orbit** is built around a poster aesthetic, large typography, a human scene, interface panels, and a sense of process.

Copy, heading length, specific composition, CTA, and step labels are chosen for the format's task: landing page, presentation, business proposal, product page, or internal screen.

The first screen should retain:

1. A meaning-focused column with a large heading and calm explanation.
2. A central poster scene with a person and working context.
3. A UI panel that adds a sense of system, statuses, or process.
4. An action area: CTA, next step, short explanation, or status.
5. A header with branding and navigation elements.

You may change:

- number of columns;
- order of information blocks;
- heading and subheading length;
- presence or shape of the UI panel;
- CTA text;
- number of steps;
- captions, labels, statuses, and microcopy.

Preserve:

- a large editorial heading;
- a human scene at the center of visual attention;
- the combination of poster and interface;
- the violet-and-sage accent;
- orbital or contour graphics;
- the sense that a working process exists behind the screen.

---

## 4. Color system

The palette is built around two main accents: violet and sage. The other colors support the print texture, graphite depth, and light paper theme.

### 4.1. Primary tokens

| Token | HEX | Role |
|---|---:|---|
| `violet` | `#b9a6f2` | primary active color, CTA, selected states, orbital accents |
| `violet-2` | `#8d71cb` | deeper violet for headings, active lines, and denser states |
| `sage` | `#9eb58f` | lively action, stages, confirmations, gentle commands |
| `sage-2` | `#6f8a65` | dense sage tone for text, hover, and selected rows |
| `ink` | `#121018` | dark graphite background |
| `ink-2` | `#17131d` | primary dark text and panels |
| `cream` | `#f5f0e6` | primary light text on a dark background |
| `paper` | `#f3ead8` | light paper surface |
| `paper-2` | `#efe8d8` | light right-hand area, secondary surfaces |
| `paper-shadow` | `#d9cfbd` | overall light-theme background |
| `orange-soft` | `#f0b27a` | highly optional pastel orange for occasional atmospheric accents |

### 4.2. Dark theme

The dark theme provides impact, contrast, and poster strength. It suits tasks needing immediate visual impact, a sense of depth, an evening tone, a space layer, or dense presentation.

```css
:root {
  --violet: #b9a6f2;
  --violet-2: #8d71cb;
  --sage: #9eb58f;
  --sage-2: #6f8a65;
  --orange-soft: #f0b27a;
  --ink: #121018;
  --cream: #f5f0e6;
}
```

Hero background:

```css
linear-gradient(
  90deg,
  rgba(18,16,24,.98) 0 31%,
  rgba(82,68,124,.66) 31% 72%,
  rgba(18,16,24,.96) 72% 100%
);
```

Dark-theme principle:

- left and right edges retain graphite depth;
- the central area glows violet;
- sage represents lively action and the active step;
- cream text works at a large scale with a calm tone;
- the primary CTA has no outer glow.

### 4.3. Light theme

The light theme provides a daytime paper version of the style. It suits tasks needing space, calm reading, a documentary feel, an open working environment, or a gentler sense of trust.

Hero background:

```css
linear-gradient(
  90deg,
  #f3ead8 0 31%,
  #c3b1ee 31% 72%,
  #efe8d8 72% 100%
);
```

Light-theme principle:

- the left block stays clean and paper-like;
- the center retains the violet scene;
- the right area is light, with density inside UI blocks;
- the CTA receives a soft shadow;
- button text uses a calmer weight.

### 4.4. Color balance

For the first screen:

- 45-55% graphite or paper;
- 25-35% violet central area;
- 10-15% UI panels and lines;
- 5-10% sage accents.

### 4.5. Optional orange

`orange-soft` is a special accent from Isty's early visual explorations. Use it exceptionally when a screen needs a little warm retro atmosphere: a small label, subtle glow, tiny illustration detail, or occasional gradient shimmer.

Application rule:

- 1-3% of screen area;
- only as an atmospheric accent;
- alongside violet, sage, graphite, or paper;
- never as the primary CTA, success status, or system color.

For internal materials:

- more paper and open space;
- less poster density;
- violet indicates the selected state;
- sage indicates action, confirmation, and live status.

---

## 5. Typography

Primary typeface: **Onest**.

Technical typeface: **JetBrains Mono**.

### 5.1. Hero H1

Hero H1 is Isty's primary visual signal.

```css
font-family: Onest, system-ui, sans-serif;
font-size: clamp(58px, 6.5vw, 106px);
font-style: italic;
font-weight: 800;
letter-spacing: -0.045em;
line-height: 1.04;
text-transform: uppercase;
text-wrap: balance;
```

Rules:

- keep lines short;
- an accent word may be violet;
- design line breaks manually;
- H1 maintains poster scale, editorial character, and immediate visual impact.

### 5.2. Line spacing for Cyrillic headings

Large Cyrillic in Onest requires extra room between lines. This is especially visible in combinations containing the Cyrillic letters `Й`, `Д`, `Ц`, `Щ`, `У`, `д`, `р`, and `у`.

Base values:

- multiline H1: `line-height: 1.04`;
- multiline H2: `line-height: 1.03`;
- H1 and H2 on mobile: `line-height: 1.06`;
- working range after visual checking: `1.02–1.08`;
- italic uppercase starts at `1.04`.

A value below `1.0` is used only in a single-line poster composition. If a second line appears, restore the heading's base line spacing.

Check the heading with actual Russian text at all target widths. Keep a visible gap between lines; diacritics and ascenders or descenders must not touch the adjacent line.

### 5.3. Subheading

```css
font-size: clamp(18px, 1.5vw, 24px);
line-height: 1.18;
text-transform: uppercase;
```

The subheading keeps the meaning concentrated. It should be shorter than an ordinary paragraph and work as an editorial lead.

### 5.4. Lead

```css
font-size: 15px;
line-height: 1.55;
```

The lead speaks in human terms without excessive terminology. It explains what Isty does for the team.

### 5.5. UI text

Panels, steps, and captions:

- numbers: `JetBrains Mono`, `11px`;
- step rows: `13px`;
- large metric or status: `24px` for the number/key, `13px` for the explanation;
- navigation: `14px`, weight `600`.

---

## 6. Grid and composition

One workable hero grid:

```css
grid-template-columns:
  minmax(300px, 31%)
  minmax(420px, 1fr)
  minmax(250px, 23%);
```

Logic:

- the left column carries meaning;
- the central column is the poster;
- the system area shows status, route, metric, or evidence;
- the action area contains a CTA, next step, or short explanation.

### 6.1. Spacing

```css
.page {
  padding: clamp(8px, 1.8vw, 24px);
}

.content {
  padding: 24px clamp(24px, 4.4vw, 64px) 24px;
  gap: clamp(16px, 2.2vw, 30px);
}
```

Rules:

- the hero should look like one complete poster sheet;
- elements must not accidentally fall on color-zone boundaries;
- the central card must have a stable size;
- the UI panel must read as part of a system: status, process, evidence, or next step.

### 6.2. Mobile

On mobile:

- the heading comes first;
- the CTA moves above the poster;
- the poster stays large;
- the UI panel moves below;
- the color accent shifts into the poster area;
- the text area remains calm and readable.

---

## 7. Logo

The logo is used as a standalone name. Do not write `Isty` beside it.

In the hero, the logo is usually placed at the upper left using a mask:

```css
.brand::before {
  background: currentColor;
  mask: url("../logo.svg") center / contain no-repeat;
}
```

Logo color:

- dark theme: `violet`;
- light theme: `violet-2`.

Size in the hero:

- desktop: `76px x 44px`;
- mobile: `58px x 34px`.

---

## 8. Images

### 8.1. Main principle

Isty imagery centers on people in real working circumstances, enhanced by an unusual environment.

A successful formula:

```text
a real person + a real work object + circumstances with a slight retro-futuristic shift
```

Examples:

- people with a laptop on a boat beneath a cosmic sky;
- a person in a library;
- a person in a laundromat;
- a space scene as a metaphor for exploration, provided it does not take over the entire brand.

### 8.2. Mood

Images should feel quietly cheerful: they contain space, interest, movement, and a sense that people are succeeding. Show success without shouting: a confident pose, clear light, an organized working scene, a small discovery, or calm joy after a result.

Avoid advertising excitement, excessive smiles, victory gestures, and the stock-photo feel of a "happy team around a laptop."

### 8.3. What to use

- laptop, notebook, table, window, book, board, workspace;
- water, sunset, sky, city, library, laundromat, train, studio;
- orbits, planets, and light trajectories as an atmospheric layer;
- grain, print texture, sepia, soft contrast.

### 8.4. What takes the style off course

Avoid:

- robots and androids;
- cyber-faces;
- cold AI avatars;
- decorative 3D heads as the main motif;
- invented objects in people's hands;
- interface cards used solely as decoration;
- pure sci-fi with no connection to process and team.

### 8.5. Poster filter

In the dark theme:

```css
filter: saturate(.62) contrast(1.08) hue-rotate(28deg);
```

In the light theme:

```css
filter: saturate(.84) contrast(1.13) hue-rotate(18deg) brightness(1.04);
```

---

## 9. UI panels

UI panels add a sense of system to the poster style. They show that behind the attractive screen there are a route, statuses, data, rules, and a next step.

A panel may sit at the side or bottom, be embedded in a card, overlay an image, or form a separate module within the page.

### 9.1. Possible content

- process status;
- a short metric;
- 3-5 route steps;
- the active stage;
- a checklist;
- a list of inputs;
- the final artifact;
- an action link;
- an image or demo caption.

### 9.2. How to use them

- thin border;
- minimal decoration;
- a clear role on the screen;
- one main idea per panel;
- the active element is immediately visible;
- numbers, statuses, and system captions may use monospace;
- short text;
- in the light theme, borders, background, and the selected row create density;
- in the dark theme, contrast, lines, and soft lighting support the panel.

### 9.3. Where to use them

**Hero**

The panel helps show a promise, route, status, or next step.

**Product block**

The panel shows how the process works: input, action, check, result.

**Presentation**

The panel helps compress a complex idea into one slide: stage, fact, conclusion, action.

**Business proposal**

The panel records a deadline, scope of work, handover format, or readiness criterion.

---

## 10. Buttons

### 10.1. Primary CTA

CTA copy is chosen for the particular format. It should name a clear action: discuss a launch, view the format, submit a request, open an example, or proceed to the next step.

Style:

- rectangular;
- no rounded corners;
- violet/sage gradient;
- dark text;
- height `52px`;
- no lift on hover;
- no outer glow in the dark theme;
- a soft shadow is allowed in the light theme.

Base gradient:

```css
linear-gradient(
  115deg,
  var(--violet) 0%,
  var(--sage) 30%,
  #c7b9f6 58%,
  #b8caa8 82%,
  var(--violet) 100%
);
```

Hover:

```css
background-image: linear-gradient(
  115deg,
  #cfc2ff 0%,
  #bdd0b0 28%,
  #d9cffd 55%,
  #c5d8bb 78%,
  #cfc2ff 100%
);
transform: none;
box-shadow: none;
```

Hover animation:

- movement happens within the gradient;
- the button's geometry stays in place;
- no white flash;
- no radial glow from the center;
- a thin diagonal violet/sage layer may be added on top.

### 10.2. Header button

Text:

```text
Discuss
```

Style:

- thin border;
- rectangular shape;
- weight `600` in the light theme;
- no additional adjacent caption.

---

## 11. Themes

Choose the theme for the task, format, and current mood of the material. Isty has no primary mode: dark and light themes are equal and serve different communication tasks.

### 11.1. When to choose the dark theme

The dark theme is used for:

- covers;
- presentation opening screens;
- strong visual statements;
- blocks needing a poster effect.

### 11.2. When to choose the light theme

The light theme is used for:

- long pages;
- documentation;
- case studies;
- internal sections;
- materials requiring sustained readability.

---

## 12. Texture

Texture makes the style feel printed and editorial.

Use:

- a thin grid;
- fine grain;
- transparent dots;
- soft color areas;
- orbital lines.

Rules:

- the grid supports structure;
- grain must not impair reading;
- the background behind small bold text must remain calm;
- lines must not accidentally cross important words;
- color zones must overlap elements deliberately.

---

## 13. Animation

Overall motion character: **a calm system, a living framework**.

Base curve:

```css
--ease: cubic-bezier(.16, 1, .3, 1);
```

Allowed movements:

- gentle gradient shift;
- appearance of an active row;
- smooth color-mode changes if the format supports multiple themes;
- poster-card changes on click;
- a slight saturation change.

Constraints:

- the CTA does not lift on hover;
- no bright flashes;
- no radial beacons;
- infinite motion should be very rare;
- respect `prefers-reduced-motion`.

---

## 14. Copy and tone

Isty's tone:

- calm;
- engineering-minded;
- human;
- clear;
- without showy technological posturing;
- respectful of the client's operational reality.

Keep these themes in the copy:

- launching the first working system;
- handing over to the team;
- process map;
- roles, events, and response rules;
- moving from a diagram to action;
- the team's next step;
- the ability to show the process and develop it further.

Meaningful verbs:

- assemble;
- show;
- hand over;
- develop;
- connect;
- record;
- see;
- launch;
- describe;
- check.

### 14.1. What to avoid in public copy

- artificially sharp contrasts;
- formulas such as `not X, but Y`;
- moralizing;
- excessive promises;
- AI hype vocabulary;
- bureaucratic language;
- decorative complexity.

---

## 15. Components and patterns

### 15.1. Hero

The hero may use elements of the poster pattern:

- `nav`;
- a left meaning-focused column;
- a central poster-stage;
- a system UI panel;
- an action area.

The number, order, and size of these elements depend on the format, task, and copy.

### 15.2. Poster-stage

```css
border: 1px solid rgba(185,166,242,.30);
background: #121018;
overflow: hidden;
```

Elements:

- image;
- color overlay;
- orbital line;
- monospace caption.

### 15.3. Steps

Steps show process movement. Labels depend on the particular format and task.

Format:

```text
01 / short stage
02 / short stage
03 / active stage
04 / short stage
```

The active step usually highlights the transition from a diagram to working execution.

### 15.4. Cards

Cards in this system are:

- rectangular;
- thinly bordered;
- limited to a small number of lines;
- free of unnecessary decorative icons;
- clear in their role.

---

## 16. Application by format

### 16.1. Landing page

The first screen may use the poster pattern. Further sections can cover:

- work process;
- examples of systems;
- case studies;
- stack;
- handover format;
- FAQ.

Internal sections may be lighter but must retain:

- large typography;
- UI panels;
- monospace captions;
- violet-and-sage accents;
- editorial density.

### 16.2. Presentations

Use:

- dark covers;
- large headings;
- one main visual per slide;
- a grid and monospace captions;
- light slides for details.

### 16.3. Documents

Use the light theme:

- paper background;
- graphite text;
- violet highlights;
- sage statuses;
- minimal borders.

### 16.4. Social media

Approach:

- poster composition;
- large italic heading;
- a human scene;
- grain;
- short caption;
- one strong idea.

---

## 17. Quality checklist

Before publishing, check:

- the logo is used as a standalone mark;
- the first screen is recognizable as Isty;
- a person or working situation is present;
- the UI provides evidence of a process;
- violet and sage work together;
- small text is readable;
- color zones do not cut through key words;
- the CTA does not jump on hover;
- the light theme looks like an independent daytime version;
- the dark theme retains poster strength;
- there are no robots or cold AI characters;
- there are no random decorative cards;
- public wording contains no artificial contrasts.

---

## 18. Short formula

**Isty is editorial retro-futurism about people, processes, and calm control.**

Visual language: **graphite / paper / violet / sage / grain / orbit / human / UI framework / large italic typography.**
