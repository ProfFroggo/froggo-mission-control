# Design Token Migration Guide

**Created:** 2025-07-12  
**Status:** In Progress — Phase 1 (TaskDetailPanel) Complete

---

## Overview

The Froggo Dashboard has a comprehensive design token system (`src/design-tokens.css`, 335+ lines) but **0% component adoption**. This migration bridges CSS custom property tokens into Tailwind utilities so components can use tokens without changing authoring style.

## Architecture

```
design-tokens.css (CSS custom properties)
        ↓
tailwind.config.js (token bridge — maps vars to Tailwind colors)
        ↓
Components (use semantic classes: text-success, bg-error-subtle, etc.)
```

## Tailwind Token Bridge

Added to `tailwind.config.js` under `theme.extend.colors`:

| Token Group | Tailwind Classes | CSS Variable |
|------------|------------------|-------------|
| `success` | `text-success`, `bg-success`, `bg-success-subtle`, `border-success-border`, `hover:bg-success-hover` | `--color-success-*` |
| `error` | `text-error`, `bg-error`, `bg-error-subtle`, `border-error-border`, `hover:bg-error-hover` | `--color-error-*` |
| `warning` | `text-warning`, `bg-warning`, `bg-warning-subtle`, `border-warning-border`, `hover:bg-warning-hover` | `--color-warning-*` |
| `info` | `text-info`, `bg-info`, `bg-info-subtle`, `border-info-border`, `hover:bg-info-hover` | `--color-info-*` |
| `review` | `text-review`, `bg-review-subtle`, `border-review-border` | `--color-review-*` |
| `muted` | `text-muted`, `bg-muted-subtle`, `border-muted-border` | `--color-muted-*` |
| `danger` | `bg-danger`, `hover:bg-danger-hover` | `--color-danger-*` |

## Migration Cheat Sheet

### Before → After

```tsx
// ❌ Raw Tailwind
className="text-green-400"
className="bg-green-500/20 text-green-400"
className="bg-red-500 text-white hover:bg-red-600"
className="bg-yellow-500/10 border border-yellow-500/30"
className="text-purple-400"
className="bg-gray-500/50 text-gray-400"
className="bg-orange-500 hover:bg-orange-600"

// ✅ Token-based
className="text-success"
className="bg-success-subtle text-success"
className="bg-error text-white hover:bg-error-hover"
className="bg-warning-subtle border border-warning-border"
className="text-review"
className="bg-muted/50 text-muted"
className="bg-danger hover:bg-danger-hover"
```

### Status Badge Pattern

```tsx
// ❌ Before
task.status === 'done' ? 'bg-green-500/20 text-green-400' :
task.status === 'in-progress' ? 'bg-yellow-500/20 text-yellow-400' :
task.status === 'review' ? 'bg-purple-500/20 text-purple-400' :
task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
'bg-blue-500/20 text-blue-400'

// ✅ After
task.status === 'done' ? 'bg-success-subtle text-success' :
task.status === 'in-progress' ? 'bg-warning-subtle text-warning' :
task.status === 'review' ? 'bg-review-subtle text-review' :
task.status === 'failed' ? 'bg-error-subtle text-error' :
'bg-info-subtle text-info'
```

## Migration Priority

See `docs/COMPONENT_STYLE_GUIDE.md` for full priority matrix. Next up:

1. ~~TaskDetailPanel (38 violations)~~ ✅ **DONE**
2. ConnectedAccountsPanel (21 violations)
3. BadgeTest (21 violations)
4. SessionsFilter (18 violations)
5. Dashboard (18 violations)
6. TopBar (18 violations)
7. VoicePanel (16 violations)
8. InboxPanel (16 violations)

## Files Changed

- `tailwind.config.js` — Added semantic color token bridge
- `src/design-tokens.css` — Added review, muted, danger token groups
- `src/components/TaskDetailPanel.tsx` — Migrated all 38 color violations to tokens

## Validation

To check for remaining raw color violations in any component:

```bash
grep -n 'text-green-\|text-red-\|text-blue-\|text-yellow-\|text-purple-\|text-gray-\|text-orange-\|bg-green-\|bg-red-\|bg-blue-\|bg-yellow-\|bg-purple-\|bg-gray-\|bg-orange-' src/components/YourComponent.tsx
```

To check the whole project:

```bash
grep -rn 'text-green-\|text-red-\|text-blue-\|text-yellow-\|text-purple-\|text-gray-\|text-orange-\|bg-green-\|bg-red-\|bg-blue-\|bg-yellow-\|bg-purple-\|bg-gray-\|bg-orange-' src/components/ | wc -l
```
