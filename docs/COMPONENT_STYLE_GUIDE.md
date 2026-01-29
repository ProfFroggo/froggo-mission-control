# Component Style Guide

**Froggo Dashboard Design System**  
**Version:** 1.0.0  
**Last Updated:** 2025-07-12  
**Status:** Audit Complete — Adoption Phase

---

## Current State: Token Adoption = 0%

Despite having comprehensive design token documentation and a `tokens.css` file (380 lines) + `design-tokens.css` (335 lines), **zero components currently reference design tokens via `var(--)`**. All 145 component files use raw Tailwind classes and hard-coded values exclusively.

---

## Component Inventory (145 files, ~56K lines)

### Tier 1 — Largest Components (Refactor First)

| Component | Lines | Tailwind Color Violations | Non-Standard Icon Sizes |
|-----------|-------|--------------------------|------------------------|
| VoicePanel | 2,117 | 16 | `size={28}` ×3 |
| InboxPanel | 1,861 | 16 | `size={18}` ×1 |
| EnhancedSettingsPanel | 1,655 | 14 | — |
| EpicCalendar | 1,587 | 15 | — |
| TaskDetailPanel | 1,473 | **38** ⚠️ | — |
| CalendarPanel | 1,363 | 15 | — |
| CommsInbox3Pane | 1,271 | — | `size={8}` ×1, `size={10}` ×6 |
| XPanel | 1,179 | — | `size={10}` ×1, `size={36}` ×1 |
| ChatPanel | 1,148 | — | `size={10}` ×2 |
| SessionsFilter | — | 18 | `size={10}` ×2 |
| Dashboard | — | 18 | `size={28}` ×1 |
| TopBar | — | 18 | — |

### Tier 2 — Medium Components

ConnectedAccountsPanel (21 violations), BadgeTest (21), AgentPanel (17), AccountDetailModal (16), ErrorBoundary (15), VIPSettingsPanel (14), MorningBrief (14), Kanban (14), AgentMetricsCard (14), ContentScheduler (13), ReportsPanel (12), XAutomationsPanel (11).

### Tier 3 — Small/Clean Components

Remaining ~120 components with ≤10 Tailwind color violations each.

---

## Inconsistencies Found

### 1. Spacing

**Issue:** 30+ unique padding combinations, no semantic intent.

| Pattern | Should Be | Occurrences |
|---------|-----------|-------------|
| `p-2` (8px) | `var(--spacing-button)` or `var(--space-2)` | ~1,050 |
| `p-4` (16px) | `var(--spacing-card)` | ~506 |
| `p-3` (12px) | `var(--spacing-card-sm)` | ~443 |
| `p-6` (24px) | `var(--spacing-card-lg)` | ~236 |

**Cards specifically** use `p-3`, `p-4`, and `p-6` interchangeably with no clear rationale.

### 2. Colors

**Issue:** ~650+ direct Tailwind color class usages that should be semantic tokens.

Top offenders:
- `text-green-400` (200×) → should be `var(--color-success-text)`
- `text-red-400` (174×) → should be `var(--color-error-text)`
- `text-blue-400` (153×) → should be `var(--color-info-text)`
- `text-yellow-400` (125×) → should be `var(--color-warning-text)`
- `bg-red-500` (143×) → should be `var(--color-error)` or `var(--color-error-bg)`
- `bg-green-500` (132×) → should be `var(--color-success)` or `var(--color-success-bg)`

### 3. Icon Sizes

**Issue:** 13 unique sizes (8–64px); should be 7 standard sizes.

Non-standard sizes requiring migration:
- `size={8}` (1×) → `size={12}` (--icon-xs)
- `size={10}` (25×) → `size={12}` (--icon-xs)
- `size={14}` (396×) → `size={16}` (--icon-sm) *evaluate case-by-case*
- `size={18}` (2×) → `size={16}` or `size={20}`
- `size={28}` (5×) → `size={24}` or `size={32}`
- `size={36}` (1×) → `size={32}` (--icon-xl)
- `size={40}` (7×) → `size={48}` (--icon-2xl)

### 4. Border Radius

**Issue:** Inconsistent radius for same component types.

- `rounded-lg` (874×) — cards, panels, buttons all use this
- `rounded-xl` (375×) — some cards, modals
- `rounded-md` (7×) — occasional badges

Cards should consistently use `rounded-xl` (--radius-card = 12px), buttons `rounded-lg` (--radius-button = 8px).

### 5. Shadows

**Issue:** Minimal; shadows are mostly consistent via Tailwind defaults. No custom shadow tokens are used in components yet, but the token definitions exist in `tokens.css`.

### 6. Typography

**Issue:** No semantic heading/body classes used. All typography via raw Tailwind (`text-sm`, `text-lg`, `font-semibold`). Functional but not token-driven.

---

## Refactoring Priority Matrix

### 🔴 P0 — High Impact, Do First

1. **TaskDetailPanel** — 38 color violations, most-viewed component
2. **Import tokens.css correctly** — Currently `design-tokens.css` is imported but `design-system/tokens.css` is not linked from index.css. Consolidate to one file.
3. **Create Tailwind plugin** mapping design tokens to utility classes (e.g., `text-success`, `bg-success-bg`) so migration doesn't require inline styles

### 🟡 P1 — High Impact, Moderate Effort

4. **VoicePanel** — 16 color violations + non-standard icons
5. **InboxPanel** — 16 color violations
6. **TopBar + Dashboard** — High visibility surfaces
7. **SessionsFilter** — 18 violations
8. **ConnectedAccountsPanel** — 21 violations

### 🟢 P2 — Medium Impact

9. **Icon size normalization** — batch find-replace `size={10}` → `size={12}`, etc.
10. **EnhancedSettingsPanel, CalendarPanel, EpicCalendar** — 14-15 violations each
11. **Card padding standardization** — audit all `p-3`/`p-4`/`p-6` on card elements

### 🔵 P3 — Low Priority / Polish

12. **Typography semantic classes** — create `.heading-1`, `.body-text` etc.
13. **Animation token adoption** — replace `duration-150` with `var(--duration-fast)`
14. **Shadow token adoption**
15. **Remaining Tier 3 components**

---

## Standard Component Patterns

### Button
```tsx
// Standard button
<button className="h-10 px-4 rounded-lg bg-clawd-accent text-white font-medium
  transition-all duration-150 hover:opacity-90 inline-flex items-center gap-2">
  <Icon size={16} /> Label
</button>

// Token-based (target state)
<button style={{
  height: 'var(--button-height-md)',
  padding: '0 var(--button-padding-x-md)',
  borderRadius: 'var(--radius-button)',
  gap: 'var(--button-gap)',
  transition: 'var(--transition-hover)'
}}>
```

### Card
```tsx
// Current (Tailwind)
<div className="p-4 rounded-xl bg-clawd-surface border border-clawd-border">

// Target (tokens)
<div style={{
  padding: 'var(--spacing-card)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--clawd-surface)',
  border: '1px solid var(--clawd-border)'
}}>
```

### Status Badge
```tsx
// Current
<span className="px-2 py-0.5 rounded-md text-xs bg-green-500/20 text-green-400">
  Success
</span>

// Target
<span style={{
  padding: 'var(--space-1) var(--space-2)',
  borderRadius: 'var(--radius-badge)',
  fontSize: 'var(--text-xs)',
  background: 'var(--color-success-bg)',
  color: 'var(--color-success-text)'
}}>
  Success
</span>
```

### Icon + Text
```tsx
// Standard inline: always size={16}, gap-2
<span className="inline-flex items-center gap-2">
  <Icon size={16} className="flex-shrink-0" />
  <span>Label</span>
</span>

// Small/dense: size={12}, gap-1
<span className="inline-flex items-center gap-1">
  <Icon size={12} className="flex-shrink-0" />
  <span className="text-xs">Small label</span>
</span>
```

---

## Migration Strategy

### Recommended Approach: Tailwind Plugin Bridge

Rather than converting everything to inline `style={{}}`, create a Tailwind plugin that exposes tokens as utilities:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'success': 'var(--color-success)',
        'success-bg': 'var(--color-success-bg)',
        'error': 'var(--color-error)',
        'error-bg': 'var(--color-error-bg)',
        // ... etc
      }
    }
  }
}
```

This allows `className="text-success bg-success-bg"` which maps to tokens without changing authoring style.

### File Consolidation

Currently two token files exist:
- `src/design-tokens.css` (335 lines) — imported by index.css
- `src/design-system/tokens.css` (380 lines) — NOT imported

**Action:** Merge into `src/design-system/tokens.css`, update index.css import.

---

## Summary

| Category | Issues Found | Severity | Effort to Fix |
|----------|-------------|----------|---------------|
| Color tokens | 650+ violations | High | Medium (batch replace) |
| Icon sizes | 13 sizes → 7 | Medium | Low (find-replace) |
| Spacing semantics | 30+ combos | Medium | High (case-by-case) |
| Border radius | Minor inconsistency | Low | Low |
| Typography | No semantic classes | Low | Medium |
| Shadows | Consistent already | None | — |
| Animation | Hard-coded durations | Low | Low |
| **Token adoption** | **0% of components** | **Critical** | **High** |

**Bottom line:** The design system is well-documented but completely unadopted. The #1 priority is creating a Tailwind bridge plugin so tokens can be used via familiar class syntax, then batch-migrating the top 12 components by violation count.
