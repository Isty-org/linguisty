---
type: product-design
project: Linguisty
style: Retro Orbit Editorial
date: 2026-10-08
status: active
---

# Linguisty — Retro Orbit Editorial

At the user's explicit request, the interface was changed from Cloudline to the supplied design system. Full source reference: [Isty Retro Orbit](isty-retro-orbit-reference.md); the previous source is preserved as [superseded Cloudline](isty-cloudline-superseded.md). These documents are visual sources; the user and `specs/` define product requirements and boundaries.

## Application to the extension

The product remains **Linguisty**, Chrome/Firefox desktop, BYOK. The user supplied a separate Linguisty logo in color and monochrome versions; the product name appears beside it. Isty is the author signature at the bottom of the interface. The landing page, human-centered poster, marketing slogan, and business positioning in the reference are not requests for new extension features.

The popup is compact, around 390 px: a small branded header, followed immediately by languages, model, actual status, and the main action. Following the user's clarification, the large introductory banner and its explanation were removed from the popup. Settings retain an editorial heading, a calm paper/graphite background, navigation through actual sections, and rectangular panels. Sections: service/key, model, translation, interface, local data. On narrow screens, navigation becomes a horizontal row and fields use a single column.

## Colors

| Token | Value | Role |
|---|---|---|
| violet | #b9a6f2 | CTA, mark in the dark theme, active lines |
| violet-2 | #8d71cb | mark in the light theme; darker text variants for contrast |
| sage | #9eb58f | CTA, active status |
| sage-2 | #6f8a65 | confirmation accent; darker text variants for contrast |
| ink | #121018 | graphite background |
| ink-2 | #17131d | dark text and panels |
| cream | #f5f0e6 | primary text in the dark theme |
| paper | #f3ead8 | paper panels |
| paper-2 | #efe8d8 | secondary paper surface |
| paper-shadow | #d9cfbd | light-theme background |

Body text has a contrast ratio of at least 4.5:1. Light accent colors are not used for small text on paper. Error and focus states remain clear and accessible.

## Typography and graphics

Onest variable and JetBrains Mono are bundled locally in `public/fonts` with the SIL OFL. Onest headings use italic/800, short lines, and a line-height of at least 1.04 for Cyrillic. Interface text is 13–15 px with a comfortable line-height; mono is used only for numbers, metrics, and IDs. System fallbacks support other writing systems.

The popup/options header displays the Linguisty logo beside the name and product caption: `public/brand/linguisty-monochrome.svg` in the light theme, `public/brand/linguisty-color.svg` in the dark theme. The source SVGs preserve the user's geometry and colors. Size: 64×64 px in settings, 44×44 px in the popup; the adjacent name is already available to screen readers, so the decorative mark is hidden from them. PNG toolbar icons at 16/32/48/128 px are built reproducibly from the color Linguisty logo on a graphite background, without an additional orbit.

The Isty SVG in `public/brand/isty-logo.svg` appears at the bottom of popup/options as a small author credit with localized “Powered by” (Russian: “Разработано”). It is displayed as a mask: violet in the dark theme and violet-2 in the light theme, with the accessible name Isty. The translation template determines the order of text and mark for each language; the brand name is not translated. Orbits and a light print texture use CSS without network images, large raster assets, or continuous animation.

## Components and states

Buttons are rectangular; the primary CTA uses a violet/sage gradient with dark text, without movement on hover or an outer glow. Panels and fields have a thin border. Panel content consists of actual settings, data, or process state. Click targets are at least 44 px; native labels, focus-visible, keyboard support, progress/error aria-live, and reduced motion are preserved.

Two equal themes: **Paper** (Russian: “Бумага”) and **Graphite** (Russian: “Графит”). `system` follows the system color theme. The UI language is determined independently from the translation language; long names and RTL must not break the layout.
