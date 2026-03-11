# Design System Reference — Mission Control Platform

Last updated: 2025-03
Platform: Froggo Mission Control (Next.js 16 + React 18 + Tailwind 3.4.17 + TypeScript)

---

## Tailwind Version

**Tailwind 3.4.17** — NOT v4. Different PostCSS plugin configuration.
- Config file: `tailwind.config.js` (not `tailwind.config.ts`)
- PostCSS plugin: `tailwindcss` (not `@tailwindcss/vite`)
- Arbitrary values (`bg-[#hexcode]`) are available but **forbidden** — use tokens

---

## Color Tokens

All colors are CSS custom properties. Always use the semantic token, never the raw value.

### Background Tokens
| Token (CSS var) | Tailwind class | Purpose |
|----------------|----------------|---------|
| `var(--mc-bg)` | `bg-mission-control-bg` | Page background |
| `var(--mc-surface)` | `bg-mission-control-surface` | Card / panel background |
| `var(--mc-panel)` | `bg-mission-control-panel` | Nested panel inside surface |
| `var(--mc-overlay)` | `bg-mission-control-overlay` | Modal overlays |
| `var(--mc-input-bg)` | `bg-mission-control-input-bg` | Form input backgrounds |

### Text Tokens
| Token (CSS var) | Tailwind class | Purpose |
|----------------|----------------|---------|
| `var(--mc-text-primary)` | `text-mission-control-text-primary` | Body text, headings |
| `var(--mc-text-secondary)` | `text-mission-control-text-secondary` | Subtext, captions |
| `var(--mc-text-muted)` | `text-mission-control-text-muted` | Placeholder, disabled labels |
| `var(--mc-text-inverse)` | `text-mission-control-text-inverse` | Text on dark/accent backgrounds |

### Border Tokens
| Token (CSS var) | Tailwind class | Purpose |
|----------------|----------------|---------|
| `var(--mc-border)` | `border-mission-control-border` | Default borders |
| `var(--mc-border-strong)` | `border-mission-control-border-strong` | Emphasis borders |
| `var(--mc-border-focus)` | `border-mission-control-border-focus` | Focus ring color |

### Status / Semantic Colors
| Token | Tailwind class | Usage |
|-------|----------------|-------|
| `var(--mc-success)` | `text-mission-control-success` | Positive values, confirmed states |
| `var(--mc-warning)` | `text-mission-control-warning` | Caution states, pending |
| `var(--mc-error)` | `text-mission-control-error` | Error states, failed |
| `var(--mc-info)` | `text-mission-control-info` | Informational, neutral highlight |

### Interactive / Brand Tokens
| Token | Tailwind class | Usage |
|-------|----------------|-------|
| `var(--mc-accent)` | `bg-mission-control-accent` | Primary action color |
| `var(--mc-accent-hover)` | `bg-mission-control-accent-hover` | Hover state of accent |
| `var(--mc-accent-muted)` | `bg-mission-control-accent-muted` | Soft accent, pill backgrounds |

**Safe tokens** (verified in `tailwind.config.js`):
- `bg-mission-control-surface`
- `bg-mission-control-panel`
- `text-mission-control-text-primary`
- `text-mission-control-text-secondary`
- `border-mission-control-border`

**Unsafe / undefined tokens** (do not use — they will silently produce no class):
- `bg-mission-control-bg1` — not registered (use `bg-mission-control-surface`)
- `text-mission-control-white` — use `text-white` or `text-mission-control-text-inverse`

---

## Typography

### Type Scale
| Class | Size | Weight | Use case |
|-------|------|--------|---------|
| `text-xs` | 12px | 400 | Labels, metadata, timestamps |
| `text-sm` | 14px | 400 | Secondary body, captions |
| `text-base` | 16px | 400 | Primary body text |
| `text-lg` | 18px | 500 | Section headings |
| `text-xl` | 20px | 600 | Card titles |
| `text-2xl` | 24px | 700 | Page headings |
| `text-3xl+` | 30px+ | 700 | Hero / display |

### Font Families
- Primary: System UI stack (Inter or system-ui as fallback)
- Monospace: JetBrains Mono or `font-mono` — used for wallet addresses, transaction hashes, code

### Numeric formatting in financial contexts
- Always use `tabular-nums` (`font-variant-numeric: tabular-nums`) for price/amount columns so digits align
- Apply `font-mono` for wallet addresses and hashes
- Use `slashed-zero` variant for contexts where 0/O confusion matters

---

## Spacing Scale

Tailwind's default 4px base spacing. Key values:

| Class | Value | Common use |
|-------|-------|-----------|
| `p-1` | 4px | Tight padding, icon buttons |
| `p-2` | 8px | Small control padding |
| `p-3` | 12px | Default control padding |
| `p-4` | 16px | Standard section padding |
| `p-6` | 24px | Card padding |
| `p-8` | 32px | Section/page padding |
| `gap-2` | 8px | Form field gaps |
| `gap-4` | 16px | Card/panel gaps |
| `gap-6` | 24px | Section gaps |

**Do not use arbitrary spacing values** like `p-[13px]` — find the nearest token.

---

## Component Patterns

### Buttons

Three hierarchy levels — always use the correct one:
- **Primary**: `bg-mission-control-accent text-white` — ONE per screen region. The main action.
- **Secondary**: `border border-mission-control-border bg-transparent` — Secondary and tertiary actions.
- **Ghost**: `bg-transparent hover:bg-mission-control-surface` — Low-emphasis, toolbar actions.
- **Destructive**: `bg-mission-control-error text-white` — Irreversible actions only.

All buttons require:
- Minimum height 36px (40px recommended for primary)
- `:focus-visible` ring: `focus-visible:ring-2 focus-visible:ring-mission-control-border-focus focus-visible:outline-none`
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
- Icon-only buttons: `aria-label` is required, no exceptions
- Loading state: spinner icon replaces label, `aria-busy="true"`, button remains disabled

### Form Inputs

All form elements use `forms.css` global styles. Do not apply per-component input styling.
- Input, textarea, select → `forms.css` handles sizing, border, focus ring, dark mode
- Label always present — never use placeholder text as the only label
- Error state: red border + error message below the field, `aria-describedby` pointing to error text
- Helper text: `text-sm text-mission-control-text-muted` below the input
- Required fields: label includes `<span aria-hidden="true">*</span>` + `required` attribute on input

### Cards

```
bg-mission-control-surface rounded-lg border border-mission-control-border p-6
```

- Card header: `text-lg font-semibold text-mission-control-text-primary mb-4`
- Card subtext: `text-sm text-mission-control-text-secondary`
- Card footer: `mt-4 pt-4 border-t border-mission-control-border`
- Interactive card (clickable): add `cursor-pointer hover:border-mission-control-border-strong transition-colors`

### Status Badges / Pills

Pattern: `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium`

| Status | Background | Text token |
|--------|-----------|-----------|
| Success / Confirmed | `bg-mission-control-success/10` | `text-mission-control-success` |
| Warning / Pending | `bg-mission-control-warning/10` | `text-mission-control-warning` |
| Error / Failed | `bg-mission-control-error/10` | `text-mission-control-error` |
| Neutral / Info | `bg-mission-control-info/10` | `text-mission-control-info` |

Never use emoji in status indicators — use Lucide icons with `size={12}`.

### Data Tables

- Table container: `overflow-x-auto` wrapper (prevents horizontal break on small screens)
- `<th>`: `text-xs font-medium text-mission-control-text-muted uppercase tracking-wide`
- `<td>`: `text-sm text-mission-control-text-primary`
- Row hover: `hover:bg-mission-control-surface/50`
- Sortable column header: includes sort icon (Lucide `ArrowUpDown`, `ArrowUp`, `ArrowDown`)
- Empty state: centered message with icon, not an empty table body
- Loading state: skeleton rows, not a spinner over the table

### Metric Cards (DeFi / Analytics)

```
bg-mission-control-surface rounded-lg border border-mission-control-border p-4
```

- Metric value: `text-2xl font-bold tabular-nums text-mission-control-text-primary`
- Metric label: `text-sm text-mission-control-text-secondary`
- Delta (change): use `text-mission-control-success` for positive, `text-mission-control-error` for negative
- Never rely on color alone for delta direction — include Lucide `TrendingUp` / `TrendingDown` icon

### Wallet Address Display

Pattern for address truncation:
```tsx
// Display: 0x1234...5678
// Full address in tooltip or on expand
<span className="font-mono text-sm">{truncateAddress(address)}</span>
<button aria-label="Copy address" onClick={() => copy(address)}>
  <Copy size={14} />
</button>
```

- Always provide copy-to-clipboard — this is the expected crypto UX pattern
- Never display full 42-char EVM addresses inline in a table cell — truncate to 6+4
- On expand/detail views, show the full address with copy

---

## Dark / Light Theme System

Themes are implemented via CSS custom properties toggled at the `:root` level. Both themes share the same token names — the values change, the names don't.

**Rules:**
- All background, text, and border values must use CSS variables — never hardcode light or dark values
- Test every component by toggling the theme in the browser
- Shadows must also be defined in both themes — dark mode shadows should use dark-adjusted colors, not the same `box-shadow` as light
- Images with transparency: ensure they have a background or use `mix-blend-mode` correctly in dark mode

**Common dark mode failure modes to check:**
- Input backgrounds that remain white in dark mode (use `bg-mission-control-input-bg`)
- Icon colors that become invisible (use text token colors on icons, not fixed grays)
- Border colors that disappear (use `border-mission-control-border`, never `border-gray-200`)
- Scrollbar colors (define `::-webkit-scrollbar-track` and `thumb` with theme vars)

---

## Accessibility Standards (WCAG 2.1 AA)

### Color Contrast Minimums
| Text type | Minimum ratio |
|-----------|--------------|
| Normal text (<18px / non-bold) | 4.5:1 |
| Large text (≥18px or ≥14px bold) | 3:1 |
| UI components / icons | 3:1 |
| Disabled elements | No requirement (but signal clearly) |

### Safe Token Pairings (verified ≥ 4.5:1)
- `text-mission-control-text-primary` on `bg-mission-control-surface` ✓
- `text-mission-control-text-secondary` on `bg-mission-control-surface` ✓
- `text-white` on `bg-mission-control-accent` ✓
- `text-mission-control-error` on `bg-mission-control-surface` — **verify in dark mode**

**Always verify** before shipping: `text-mission-control-text-muted` on panel backgrounds may fall below 4.5:1 — it's safe at 3:1 for large UI labels only.

### Keyboard Navigation Checklist
- [ ] Tab order follows visual reading order (top-left to bottom-right)
- [ ] All interactive elements reachable by Tab/Shift+Tab
- [ ] No focus traps outside of modals (modals must trap + restore focus on close)
- [ ] Enter activates buttons and links
- [ ] Escape closes modals, dropdowns, tooltips
- [ ] Arrow keys navigate within grouped components (radio groups, tabs, menus)

### ARIA Usage
- `aria-label`: icon-only buttons, icon-only links
- `aria-labelledby`: form field groups, modal headings
- `aria-describedby`: form field error messages, input helper text
- `aria-busy="true"`: loading state on containers
- `aria-expanded`: dropdowns, accordions
- `aria-live="polite"`: toast/notification regions
- `role="alert"`: error messages that appear dynamically

### Semantic HTML First
- `<button>` not `<div onClick>`
- `<label>` not `placeholder` as label substitute
- `<table>` with `<th scope="col">` for data tables
- `<nav>` for navigation, `<main>` for primary content
- `<h1>-<h6>` for heading hierarchy — never skip levels

---

## Icon System

**Library**: Lucide React only. No emojis as UI elements.

Import pattern:
```tsx
import { ArrowUpDown, Copy, TrendingUp, AlertCircle } from 'lucide-react'

// Usage with accessible label when icon-only
<button aria-label="Copy address">
  <Copy size={16} />
</button>
```

Standard sizes:
- `size={12}` — inline with small text (badge icons, metadata)
- `size={16}` — default inline icon
- `size={20}` — icon beside primary text
- `size={24}` — standalone icon, nav icons
- `size={32}+` — empty state icons, hero illustrations

Icon color: inherit from text token — `className="text-mission-control-text-secondary"` — never hardcode icon colors.

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| (default) | 0+ | Mobile base |
| `sm:` | 640px | Expanded mobile |
| `md:` | 768px | Tablet — must not be broken |
| `lg:` | 1024px | Desktop narrow |
| `xl:` | 1280px | Desktop standard |
| `2xl:` | 1536px | Wide desktop |

The platform is primarily desktop (lg+). Tablet (md) must be functional. Mobile (sm) is a bonus, not the focus — but layouts must not be actively broken.

**Touch target minimum**: 44x44px on all interactive elements — even on desktop, this is the correct minimum for accessibility.

---

## Common DeFi Interface Patterns

### Transaction States
| State | Visual treatment |
|-------|----------------|
| Pending | Warning badge + spinner icon |
| Confirmed | Success badge + checkmark icon |
| Failed | Error badge + X icon |
| Expired | Muted badge + clock icon |

### Amount / Value Display
- Token amounts: right-aligned in tables, `tabular-nums font-mono`
- Fiat values: prefix with currency symbol, same alignment
- Distinguish clearly: token amount (`1.234 ETH`) vs fiat value (`$2,341.00`)
- Large numbers: use comma separators (`1,234,567`) — not scientific notation
- Small numbers: preserve precision appropriately (`0.00000123` not `~0`)

### Loading States
- Skeleton loader: `animate-pulse bg-mission-control-panel rounded` with appropriate dimensions
- Prefer skeleton over spinner for content areas that have known shape
- Spinner (`Loader2` Lucide icon with `animate-spin`) for actions, button loading states
- Loading text: "Loading..." with `aria-busy="true"` on the container

---

## Known Platform Quirks

- **Tailwind `bg-mission-control-bg1` is undefined** — the correct token is `bg-mission-control-surface`. Using undefined tokens silently produces no class — this is a common silent failure mode.
- **Dark mode uses CSS vars, not Tailwind's `dark:` prefix** — the `dark:` variant classes do not work on this platform. All dark mode styling must use CSS custom property values that change at `:root`.
- **`forms.css` is global** — do not add custom input styling per-component. If a global input style needs adjustment, update `forms.css` with a comment.
- **Lucide import treeshaking** — import named icons individually, not `import * as Icons from 'lucide-react'`
