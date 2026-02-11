# Design System Audit Report

**Date:** 2025-07-12  
**Auditor:** Clawd (automated)  
**Scope:** `/src/components/` (145 files, ~56K lines)

---

## Executive Summary

The dashboard has **two comprehensive token files** (`design-tokens.css` + `design-system/tokens.css`) totaling 715 lines of well-structured CSS variables. However, **token adoption is effectively 0%** — only 4 component files reference `var(--)` at all, and those are minor/demo components. All 145 production components use raw Tailwind classes with hard-coded color, spacing, and sizing values.

**The design system exists on paper but not in practice.**

---

## 1. Spacing Audit

### Current Usage (Tailwind classes, sorted by frequency)

| Class | Px | Count | Semantic Intent |
|-------|-----|-------|----------------|
| `gap-2` | 8 | 882 | Inline/tight spacing |
| `py-2` | 8 | 443 | Vertical padding |
| `p-4` | 16 | 421 | Card padding |
| `mb-2` | 8 | 358 | Stack spacing |
| `px-3` | 12 | 330 | Horizontal padding |
| `px-4` | 16 | 311 | Horizontal padding |
| `gap-3` | 12 | 263 | Medium gap |
| `p-2` | 8 | 259 | Compact padding |
| `mb-4` | 16 | 245 | Section spacing |
| `p-6` | 24 | 244 | Spacious padding |
| `p-3` | 12 | 226 | Medium padding |
| `gap-1` | 4 | 203 | Tight gap |

**Findings:**
- 30+ unique spacing combinations across components
- Cards inconsistently use `p-3`, `p-4`, and `p-6` with no rationale
- Token equivalents exist (`--spacing-card`, `--spacing-card-sm`, etc.) but are unused
- The 4px base scale is followed naturally via Tailwind — good foundation

### Recommendation
No values need to change. The Tailwind defaults already align with the token scale. The gap is adoption, not definition.

---

## 2. Typography Audit

### Font Size Distribution

| Class | Px | Count | Notes |
|-------|-----|-------|-------|
| `text-sm` | 14 | 1,287 | **Dominant** — most UI text |
| `text-xs` | 12 | 811 | Captions, badges, metadata |
| `text-lg` | 18 | 148 | Subheadings |
| `text-2xl` | 24 | 92 | Page headings |
| `text-xl` | 20 | 73 | Section headings |
| `text-3xl` | 30 | 33 | Major headings |
| `text-base` | 16 | 11 | Rarely used! |
| `text-4xl` | 36 | 5 | Display text |
| `text-5xl` | 48 | 4 | Hero only |

**Findings:**
- `text-sm` (14px) is the de facto body text, not `text-base` (16px) — this is intentional for a dense dashboard UI
- Typography scale maps 1:1 to token definitions in `tokens.css`
- No semantic heading classes used (`.text-heading-1`, etc. exist in `design-tokens.css` but zero adoption)
- Font weights are applied via Tailwind (`font-medium`, `font-semibold`) — consistent and correct

### Recommendation
Define `--text-body-default: 0.875rem` (14px) since that's the actual default, not 16px. Otherwise the scale is solid.

---

## 3. Color Token Audit

### Hard-coded Color Usage (Top Offenders)

| Tailwind Class | Count | Should Map To |
|----------------|-------|---------------|
| `text-green-400` | 214 | `--color-success` / `text-success` |
| `text-red-400` | 177 | `--color-error` / `text-error` |
| `text-blue-400` | 162 | `--color-info` / `text-info` |
| `text-yellow-400` | 130 | `--color-warning` / `text-warning` |
| `text-purple-400` | 71 | `--color-review` |
| `text-orange-400` | 64 | `--color-danger` |
| `text-gray-400` | 54 | `--clawd-text-dim` |
| `bg-green-500/20` | 68 | `--color-success-bg` |
| `bg-red-500/20` | 63 | `--color-error-bg` |
| `bg-blue-500/20` | 58 | `--color-info-bg` |

**Total hard-coded color references: ~1,200+**

### What's Defined vs Used

| Token Category | Defined in CSS | Used in Components |
|----------------|---------------|-------------------|
| Surface colors (`--clawd-*`) | 7 tokens | ✅ Used via Tailwind theme (`bg-clawd-surface`, etc.) |
| Semantic status | 24 tokens | ❌ 0 components |
| Priority colors | 8 tokens | ❌ 0 components |
| Agent colors | 8 tokens | ❌ 0 components |
| Channel brands | 8 tokens | ❌ 0 components |
| Interactive states | 6 tokens | ❌ 0 components |

### Recommendation
The `--clawd-*` base tokens ARE used (via Tailwind config). The semantic tokens are not. Priority: expose semantic tokens as Tailwind utilities in `tailwind.config.js`.

---

## 4. Component Sizing Audit

### Button/Control Heights
- Buttons use `h-8` (32px), `h-9` (36px), `h-10` (40px) — loosely maps to `--button-height-sm/md`
- `h-9` (36px) has no token equivalent — needs `--button-height-default: 2.25rem` or normalization to h-8/h-10

### Card Padding
- Small cards: `p-3` (12px) — maps to `--spacing-card-sm` ✅
- Standard cards: `p-4` (16px) — maps to `--spacing-card` ✅
- Large panels: `p-6` (24px) — maps to `--spacing-card-lg` ✅
- Problem: same component types mix these inconsistently

### Border Radius
- `rounded-lg` (8px): 874 uses — buttons, cards, everything
- `rounded-xl` (12px): 375 uses — some cards, modals
- Cards should be `rounded-xl`, buttons `rounded-lg` — currently mixed

---

## 5. Icon Size Audit

### Current Distribution

| Size (px) | Count | Token | Standard? |
|-----------|-------|-------|-----------|
| 16 | 721 | `--icon-sm` | ✅ Standard |
| 14 | 405 | — | ❌ Non-standard |
| 20 | 146 | `--icon-md` | ✅ Standard |
| 24 | 76 | `--icon-lg` | ✅ Standard |
| 32 | 54 | `--icon-xl` | ✅ Standard |
| 48 | 41 | `--icon-2xl` | ✅ Standard |
| 12 | 21 | `--icon-xs` | ✅ Standard |
| 10 | 25 | — | ❌ → 12 |
| 40 | 7 | — | ❌ → 48 |
| 28 | 5 | — | ❌ → 24 or 32 |
| 18 | 4 | — | ❌ → 16 or 20 |
| 15 | 4 | — | ❌ → 16 |
| 11 | 2 | — | ❌ → 12 |
| 8 | 1 | — | ❌ → 12 |
| 36 | 1 | — | ❌ → 32 |
| 64 | 3 | `--icon-3xl` | ✅ Standard |

**77% of icons use standard sizes. The main outlier is `size={14}` (405 occurrences) — needs case-by-case evaluation.** Most `14px` icons are inline with `text-sm` (14px) text, so `size={14}` may be intentionally matched. Consider adding `--icon-inline: 0.875rem` (14px) as a standard token.

---

## 6. Duplicate Token Files

Two token files exist with overlapping but divergent definitions:

| Aspect | `design-tokens.css` | `design-system/tokens.css` |
|--------|---------------------|---------------------------|
| Lines | 335 | 380 |
| Imported by index.css | ✅ Yes | ❌ No |
| Spacing | Semantic only (inline/stack/component) | Full numeric scale + semantic |
| Radius `--radius-sm` | `0.5rem` (8px) | `0.375rem` (6px) |
| Z-index `--z-dropdown` | 1000 | 100 |
| Shadow format | Simple (single layer) | Compound (multi-layer) |
| Avatar `--avatar-sm` | `1.5rem` (24px) | `2rem` (32px) |

**These conflicts MUST be resolved.** `design-system/tokens.css` is more comprehensive and should be the canonical source.

---

## Action Plan

### Phase 1: Foundation (This Sprint)
1. **Consolidate token files** — merge into `src/design-system/tokens.css`, delete `design-tokens.css`, update index.css import
2. **Add `--icon-inline: 0.875rem`** token for the 14px pattern
3. **Extend Tailwind config** with semantic color utilities (`text-success`, `bg-success-bg`, etc.)

### Phase 2: Top Component Migration (Next Sprint)
4. Migrate top 5 components by violation count (TaskDetailPanel, ConnectedAccountsPanel, BadgeTest, SessionsFilter, Dashboard+TopBar)
5. Normalize icon sizes in batch (`size={10}` → 12, `size={28}` → 24, etc.)

### Phase 3: Full Adoption (Ongoing)
6. Remaining 140 components, working down the violation list
7. Add lint rules to prevent new hard-coded colors
8. Remove utility classes from `design-tokens.css` (they duplicate Tailwind)

---

## Token File Consolidation: Recommended Canonical Values

Where the two files conflict, recommended resolution:

| Token | `design-tokens.css` | `tokens.css` | **Use** |
|-------|---------------------|-------------|---------|
| `--radius-sm` | 0.5rem | 0.375rem | **0.5rem** (matches Tailwind `rounded-lg`) |
| `--z-dropdown` | 1000 | 100 | **100** (lower scale, room to grow) |
| `--shadow-sm` | single-layer | multi-layer | **multi-layer** (richer) |
| `--avatar-sm` | 1.5rem (24px) | 2rem (32px) | **2rem** (tokens.css is more granular with xs=24px) |

---

*Generated by design system audit task-1769688719100*
