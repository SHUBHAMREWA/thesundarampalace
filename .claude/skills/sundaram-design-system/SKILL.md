---
name: sundaram-design-system
description: Use before building or changing any UI in The Sundaram Palace project — website pages, CRM screens, forms, tables, dialogs, emails or PDF styling. Enforces the Rose Mahal tokens, fonts, components and accessibility rules.
---

# Sundaram Palace design system — "Rose Mahal"

One design system for the website, CRM, CMS, emails and PDFs. Royal and soft: berry-rose maroon, blush, lavender, pearl ivory, a little champagne gold.

## Tokens (single source: `src/app/globals.css`)

```css
:root {
  --color-primary: #8E3B5A;
  --color-primary-hover: #7A3150;
  --color-primary-deep: #4A1F33;
  --color-blush: #F3D9E1;
  --color-lavender: #DCD0EA;
  --color-gold: #C9A96E;
  --color-bg: #FBF7F5;
  --color-surface: #FFFFFF;
  --color-text: #2E2230;
  --color-text-muted: #6B5A66;
  --color-border: #E8DCE1;

  --color-success: #2E7D4F;
  --color-warning: #B7791F;
  --color-danger: #B42318;
  --color-info: #2B6CB0;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-card: 0 1px 2px rgb(46 34 48 / 0.06), 0 4px 16px rgb(46 34 48 / 0.06);
  --container-max: 1240px;
}
```

Map these into the Tailwind theme (for Tailwind v4 use `@theme` in `globals.css`; for v3 use `tailwind.config`). Map shadcn/ui variables (`--primary`, `--background`, `--ring`, etc.) to the same tokens.

## Rules
- Never write a hex color in a component. If a new color is needed, add a token first and explain why.
- Proportions: ~60% ivory/white, 25% blush + lavender, 10% primary, 5% gold.
- White text only on `primary` and `primary-deep`. Body text is `--color-text` on ivory/white.
- Gold is for thin dividers, icons and small ornaments. Never gold text on light backgrounds, never large gold fills.
- No heavy gradients. A subtle dark overlay on hero images/video for text legibility is allowed.
- CRM status badges use success/warning/danger/info tokens, not brand pinks.
- Use shadcn/ui components from `src/components/ui`; extend via variants (cva), don't fork new buttons/inputs/cards.
- No inline `style` for normal styling.

## Typography
- Headings/display: Cormorant Garamond (fallback Playfair Display) via `next/font`, weights 500–600.
- Body/UI: Inter (or Manrope) via `next/font`, 400/500/600.
- Hindi: Tiro Devanagari Hindi (or Noto Serif Devanagari) — set via `:lang(hi)`.
- Scale (website): h1 clamp(2.5rem, 5vw, 4.25rem); h2 clamp(1.9rem, 3.5vw, 2.75rem); h3 1.5rem; body 1.0625rem, line-height 1.7.
- CRM uses the sans font for everything except the logo/page brand.

## Luxury website patterns
- Full-bleed hero (video or image), centered serif headline, one primary CTA ("Plan your event") + WhatsApp secondary.
- Generous vertical rhythm: sections 96–128px on desktop, 64px on mobile.
- Thin gold divider (1px, 48–64px wide) under section eyebrows.
- Image-led cards with soft radius (`--radius-lg`), no heavy borders.
- Motion: subtle fade/translate ≤ 300ms; disable under `prefers-reduced-motion`.
- Floating WhatsApp button bottom-right on mobile, never covering form submit buttons.

## Accessibility checklist (every screen)
- WCAG AA contrast; visible focus ring using `--color-primary` with 2px offset.
- Keyboard reachable controls, labelled inputs, error text linked with `aria-describedby`.
- No horizontal overflow at 360px width.
- Images have meaningful alt text from the CMS.

## Before finishing UI work
- Check at 360px, 768px, 1280px and 1536px.
- Grep the diff for `#` hex values outside `globals.css` and remove them.
- Update `docs/design-system.md` if tokens or components changed.
