# Design System Inspired by Tembo Session

> Auto-extracted from `https://app.tembo.io/sahil-s-workspace-1762597802/sessions/21b638bd-330d-4d3a-a146-c72d0d168477` on 2026-08-29

## 1. Visual Theme & Atmosphere

High-contrast dark mode with vivid accents - feels modern, technical, and focused.

The hero section leads with "Convert portfolio to premium light mode with unique elements and interactions".

**Key Characteristics:**
- Inter as the heading font (custom web font loaded via @font-face)
- Inter as the body font for all running text
- Heading weight 600, letter-spacing -0.1px
- Dark background (#141414) as the primary canvas
- Primary accent `#118af3` used for CTAs and brand highlights
- 3 shadow level(s) detected - tinted shadows
- Rounded corners (6px+) creating a friendly, approachable feel
- Tags: dark, rounded, colorful, compact, monospace, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#118af3`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#29c239`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#141414`) · `--color-bg`: Page background, primary canvas.

### Text
- **Text Primary** (`#ffffff`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#999999`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#212121`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#ffffff` | `--palette-1` | button | large | text-dark |
| 2 | `#141414` | `--palette-2` | section | large | text-light |
| 3 | `#212121` | `--palette-3` | block | medium | text-light |
| 4 | `#383838` | `--palette-4` | badge | medium | text-light |
| 5 | `#29c239` | `--palette-5` | text-accent | small | text-dark |
| 6 | `#118af3` | `--palette-6` | badge | small | text-light |
| 7 | `#25b134` | `--palette-7` | text-accent | small | text-light |
| 8 | `#f15555` | `--palette-8` | text-accent | small | text-dark |
| 9 | `#4a6fdc` | `--palette-9` | badge | small | text-light |
| 10 | `#f36868` | `--palette-10` | text-accent | small | text-dark |
| 11 | `#0f8a1b` | `--palette-11` | text-accent | small | text-light |
| 12 | `#64b3f7` | `--palette-12` | text-accent | small | text-dark |

## 3. Typography Rules

- **Heading Font:** `Inter` (web font)
- **Body Font:** `Inter` (web font)

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | Inter | 14px | 600 | 20px | -0.1px |
| H2 | Inter | 14px | 700 | 20px | -0.1px |
| Body | Inter | 14px | 500 | 22.75px | -0.1px |
| Small | Inter | 13px | 520 | 16px | -0.2px |
| Code | Inter | 14px | 500 | 21px | -0.1px |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `16px` | headings |
| H1 | `14px` | headings |
| H2 | `13px` | headings |
| H3 | `12px` | headings |
| H4 | `11px` | headings |
| Body L | `9px` | body / supporting text |

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: transparent;
  color: #ffffff;
  border-radius: 8px;
  padding: 0px 4px;
  font-size: 13px;
  font-weight: 520;
  border: none;
  cursor: pointer;
}
```

### Filled Button

```css
.btn-filled {
  background: #ffffff;
  color: #ffffff;
  border-radius: 8px;
  padding: 0px 4px;
  font-size: 13px;
  font-weight: 520;
  border: none;
  cursor: pointer;
}
```

### Ghost Button

```css
.btn-ghost {
  background: transparent;
  color: #ffffff;
  border-radius: 6px;
  padding: 0px 8px;
  font-size: 13px;
  font-weight: 520;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 2

```css
.btn-ghost-2 {
  background: transparent;
  color: #ffffff;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 13px;
  font-weight: 520;
  border: none;
  cursor: pointer;
}
```

### Filled Button 2

```css
.btn-filled-2 {
  background: #ffffff;
  color: #ffffff;
  border-radius: 16px;
  padding: 0px 0px;
  font-size: 13px;
  font-weight: 440;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 3

```css
.btn-ghost-3 {
  background: transparent;
  color: #ffffff;
  border-radius: 2px;
  padding: 4px 0px;
  font-size: 14px;
  font-weight: 440;
  border: none;
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #ffffff;
  border-radius: 8px;
  padding: 0px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `2px` - use multiples (4px, 6px, 8px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `2px` | element |
| spacing-2 | `4px` | element |
| spacing-3 | `8px` | element |
| spacing-4 | `6px` | element |
| spacing-5 | `12px` | element |
| spacing-6 | `1px` | element |
| spacing-7 | `24px` | card |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-button | `6px` | button |
| radius-button | `8px` | button |
| radius-subtle | `2px` | subtle |
| radius-button | `12px` | button |
| radius-card | `16px` | card |
| radius-subtle | `4px` | subtle |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| Low | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0...` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0...` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0...` | Cards, subtle elevation |


## 7. Do's and Don'ts

### Do
- Use `#141414` as the primary background color
- Use `Inter` for all headings and `Inter` for body text
- Use `#118af3` as the single dominant accent/CTA color
- Maintain `2px` as the base spacing unit - all gaps should be multiples
- Keep the overall feel dark - use dark surfaces throughout
- Use rounded corners (`6px`+) consistently for all interactive elements
- Embrace bold color combinations - playful energy is the point
- Apply the shadow system for elevation - use the extracted shadow values
- Use weight 600 for headings to match the brand's typographic voice

### Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute Inter/Inter with generic alternatives
- Don't use irregular spacing - stick to 2px grid
- Don't introduce bright white surfaces - they break the dark palette
- Don't use sharp corners - they feel hostile in this rounded design language
- Don't use oversized hero text - this brand uses restrained type
- Don't use pure black (#000000) for text - use `#ffffff` instead
- Don't add decorative elements not present in the original design - no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have - if the original has no NEW badge, don't add one just because a red is in the palette

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 2px base unit across breakpoints - only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #141414
Text:        #ffffff
Accent:      #118af3
Secondary:   #29c239
Border:      #212121
```

### Example Prompts

1. "Build a hero section with a `#141414` background, `Inter` heading in `#ffffff`, and a `#118af3` CTA button with 8px radius."
2. "Create a pricing card using background `#141414`, border `#212121`, `Inter` for text, and 6px padding."
3. "Design a navigation bar - `#141414` background, `#ffffff` links, `#118af3` for active state."
4. "Build a feature grid with 3 columns, 6px gap, each card using the card component style."
5. "Create a footer with `#141414` background, `#ffffff` text, and 4px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette - background first, then text, then accents
3. Set typography - font families, sizes from the type scale, weights
4. Add components - buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth - use the extracted shadow values, not defaults
7. Check responsive behavior - test mobile and tablet layouts
8. Final pass - verify all colors match, spacing is consistent, fonts are correct

## 10. CSS Custom Properties

> 10 custom properties extracted from `:root` / `html` stylesheets.

### Color Variables

| Variable | Value |
|---|---|
| `--hljs-bg` | `light-dark(#fafafa,#282c34)` |
| `--hljs-text` | `light-dark(#383a42,#abb2bf)` |
| `--hljs-comment` | `light-dark(#a0a1a7,#5c6370)` |
| `--hljs-keyword` | `light-dark(#a626a4,#c678dd)` |
| `--hljs-section` | `light-dark(#e45649,#e06c75)` |
| `--hljs-literal` | `light-dark(#0184bb,#56b6c2)` |
| `--hljs-string` | `light-dark(#50a14f,#98c379)` |
| `--hljs-attr` | `light-dark(#986801,#d19a66)` |
| `--hljs-symbol` | `light-dark(#4078f2,#61aeee)` |
| `--hljs-class` | `light-dark(#c18401,#e6c07b)` |
