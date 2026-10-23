# Design system — "Rose Mahal"

Status: **Phase 0 draft.** Tokens are implemented in `src/app/globals.css` in Phase 1. That file is the only place a hex colour may appear.
Last updated: 2026-10-23.

One system for the website, CRM, CMS, emails and PDFs. Royal and soft rather than red and heavy: berry-rose maroon, blush, lavender, pearl ivory, a little champagne gold.

## 1. Colour tokens

| Token | Hex | Use |
|---|---|---|
| `--color-primary` | `#8E3B5A` | Primary buttons, links, key headings |
| `--color-primary-hover` | `#7A3150` | Hover/active of primary |
| `--color-primary-deep` | `#4A1F33` | Footer, hero overlays, dark sections |
| `--color-blush` | `#F3D9E1` | Soft section backgrounds, chips |
| `--color-lavender` | `#DCD0EA` | Secondary accents, badges, highlights |
| `--color-gold` | `#C9A96E` | Thin dividers, icons, ornaments only |
| `--color-bg` | `#FBF7F5` | Page background (pearl ivory) |
| `--color-surface` | `#FFFFFF` | Cards, forms, tables |
| `--color-text` | `#2E2230` | Body text |
| `--color-text-muted` | `#6B5A66` | Secondary text |
| `--color-border` | `#E8DCE1` | Hairlines, dividers, table rules |
| `--color-success` | `#2E7D4F` | CRM status |
| `--color-warning` | `#B7791F` | CRM status (see §2 proposal) |
| `--color-danger` | `#B42318` | CRM status, destructive actions |
| `--color-info` | `#2B6CB0` | CRM status |

Proportions: about 60% ivory/white, 25% blush + lavender, 10% primary, 5% gold.

## 2. Contrast check (WCAG 2.x)

Computed on 2026-10-23 with the WCAG relative-luminance formula. AA needs 4.5:1 for normal text, 3:1 for large text (≥ 24 px, or ≥ 18.7 px bold) and for UI component boundaries.

| Foreground on background | Ratio | Normal text | Large text / UI |
|---|---|---|---|
| text on bg / surface | 14.21 / 15.13 | Pass | Pass |
| text on blush / lavender | 11.40 / 10.27 | Pass | Pass |
| text-muted on bg / surface | 6.01 / 6.40 | Pass | Pass |
| text-muted on blush | 4.82 | Pass | Pass |
| **text-muted on lavender** | **4.35** | **Fail** | Pass |
| primary on bg / surface | 6.75 / 7.18 | Pass | Pass |
| primary on blush / lavender | 5.41 / 4.88 | Pass | Pass |
| white on primary / primary-hover / primary-deep | 7.18 / 8.81 / 13.68 | Pass | Pass |
| gold on primary-deep | 6.11 | Pass | Pass |
| **gold on bg** | **2.10** | **Fail** | **Fail** |
| **border on surface** (input outline) | **1.33** | — | **Fail** for input boundaries |
| success / danger / info on white | 5.05 / 6.57 / 5.42 | Pass | Pass |
| **warning on white** | **3.64** | **Fail** | Pass |

What this means, and proposed fixes (need approval before Phase 1):

1. **Muted text on lavender** — rule: on lavender backgrounds use `--color-text`, never muted. No new token.
2. **Gold on light backgrounds** — already banned by the rules; confirmed by the numbers. Gold text is allowed only on `primary-deep`.
3. **Input borders** — the `#E8DCE1` hairline is fine for dividers, but form fields need a 3:1 boundary so people can find them. *Proposed* new token `--color-border-strong: #9E8994` (3.25:1 on white, 3.05:1 on ivory) used only for input, select, checkbox and textarea outlines.
4. **Warning text** — *Proposed*: change `--color-warning` to `#946118` (5.27:1 on white, 4.95:1 on ivory). It still reads as amber, works as text and as a badge fill with white text.

## 3. Other tokens

```css
--radius-sm: 6px;   --radius-md: 10px;   --radius-lg: 16px;
--shadow-card: 0 1px 2px rgb(46 34 48 / 0.06), 0 4px 16px rgb(46 34 48 / 0.06);
--container-max: 1240px;
```

Spacing uses Tailwind's 4 px scale. Section rhythm on the website: 96–128 px desktop, 64 px mobile.

Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536). Every screen is checked at 360, 768, 1280 and 1536 px.

## 4. Tailwind v4 and shadcn/ui mapping

Tokens are declared once on `:root`, exposed to Tailwind through `@theme inline`, and shadcn/ui's own variables point at them, so changing one token changes the whole app.

```css
/* src/app/globals.css (sketch) */
@import "tailwindcss";

:root {
  --color-primary: #8E3B5A;
  /* …all tokens from §1 and §3… */
}

@theme inline {
  --color-primary: var(--color-primary);
  --color-blush: var(--color-blush);
  /* …so classes like bg-primary, text-text-muted, border-border exist */
  --font-display: var(--font-cormorant);
  --font-sans: var(--font-inter);
  --font-hindi: var(--font-tiro-devanagari);
}

/* shadcn/ui variables → Rose Mahal tokens */
:root {
  --background: var(--color-bg);
  --foreground: var(--color-text);
  --card: var(--color-surface);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-surface);
  --secondary: var(--color-lavender);
  --muted: var(--color-blush);
  --muted-foreground: var(--color-text-muted);
  --border: var(--color-border);
  --input: var(--color-border-strong);
  --ring: var(--color-primary);
  --destructive: var(--color-danger);
  --radius: var(--radius-md);
}
```

No dark theme is planned: the brand is light ivory and the CRM is used in office conditions. If one is ever added, it is a second set of token values, not new colours in components.

## 5. Typography

| Role | Font | Loaded via | Weights |
|---|---|---|---|
| Display / headings (website, PDFs) | Cormorant Garamond (fallback Playfair Display) | `next/font/google` | 500, 600 |
| Body / UI (website and all of CRM) | Inter (or Manrope) | `next/font/google` | 400, 500, 600 |
| Hindi | Tiro Devanagari Hindi (or Noto Serif Devanagari) | `next/font/google`, applied with `:lang(hi)` | 400 |

Website scale: h1 `clamp(2.5rem, 5vw, 4.25rem)`, h2 `clamp(1.9rem, 3.5vw, 2.75rem)`, h3 `1.5rem`, body `1.0625rem` with line-height 1.7. One `h1` per page.

The CRM uses the sans font everywhere except the logo.

For PDFs the same font files are installed inside the PDF service image, so rendering never fetches fonts from the network.

## 6. Components (built in Phase 1)

All from shadcn/ui in `src/components/ui`, themed by tokens and extended with `cva` variants. Never fork a second button, input or card.

| Group | Components |
|---|---|
| Actions | Button (primary, secondary, outline, ghost, destructive, link; sizes sm/md/lg; loading state), IconButton |
| Forms | Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, DatePicker (Asia/Kolkata aware), PhoneInput (+91 default), MoneyInput (string-based, no floats), FormField wrapper with label, hint and `aria-describedby` error |
| Feedback | Toast, Alert, Badge (status variants map to success/warning/danger/info), Skeleton, EmptyState, ErrorState, ConfirmDialog |
| Layout | Container, Section (website rhythm), PageHeader + Breadcrumbs (CRM), Sidebar (CRM desktop), MobileNav, Card |
| Data | DataTable (server-side search, filters, sort, pagination), DetailList, Timeline |
| Website | Hero (video with poster + reduced-motion fallback), SectionEyebrow with gold divider, HallCard, CTA band, FloatingWhatsApp, LanguageToggle |

## 7. Patterns

### Public website
- Full-bleed hero with a subtle `primary-deep` overlay for legibility, centred serif headline, one primary CTA ("Plan your event") and a WhatsApp secondary.
- Thin gold divider (1 px, 48–64 px wide) under section eyebrows.
- Image-led cards with `--radius-lg`, no heavy borders.
- Placeholders for missing facts look intentional ("Capacity details coming soon") and are visible only where the CMS has no value.
- Floating WhatsApp button bottom-right on mobile; it hides when a form's submit button is in view.

### CRM
- Mostly ivory and white with primary for actions. Brand pinks are not used for status.
- Persistent sidebar on desktop, sheet navigation on mobile, breadcrumbs on every page.
- Tables have ≤ 7 columns; details live on detail pages.
- Destructive or irreversible actions (cancel booking, issue invoice, record refund) use ConfirmDialog with a summary of what will happen.

### PDFs
- Elegant Royal: ivory page, `primary-deep` header band, thin gold rule, Cormorant headings.
- Kitchen Sheet: black on white, large text, no colour reliance, no prices.

## 8. Motion and accessibility

- Transitions ≤ 300 ms (fade/translate). Under `prefers-reduced-motion: reduce`, motion is removed and the hero shows the poster image instead of video. `Save-Data` also gets the poster.
- Focus ring: 2 px `--color-primary` with 2 px offset, never removed.
- Every input has a visible label; errors are text, not colour alone.
- No horizontal overflow at 360 px.
- Images use alt text from the CMS (English required).

## 9. Guardrails

- A lint step (Phase 1) fails the build if a hex colour, `rgb(` or `hsl(` literal appears outside `src/app/globals.css`. PDF templates inline the same token file rather than defining their own colours.
- No inline `style` for normal styling.
- Adding a colour means adding a token here first, with the reason and its contrast numbers.
