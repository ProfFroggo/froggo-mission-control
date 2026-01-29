# Design Token Recommendations
**Date:** 2026-01-29  
**Task:** task-1769688719100  
**Based on:** DESIGN_SYSTEM_AUDIT.md

This document contains **actionable design token additions** to address inconsistencies found in the audit.

---

## 1. Spacing Scale Tokens ✅ ALREADY DEFINED

**Status:** Already comprehensive in `design-tokens.css`

```css
--space-1: 4px;    /* gap-1, p-1, m-1 */
--space-2: 8px;    /* gap-2, p-2, m-2 (most common) */
--space-3: 12px;   /* gap-3, p-3, m-3 */
--space-4: 16px;   /* gap-4, p-4, m-4 */
--space-6: 24px;   /* gap-6, p-6, m-6 */
--space-8: 32px;   /* gap-8, p-8, m-8 */
```

**Recommendation:** ✅ **Keep as-is** - well-aligned with Tailwind and usage patterns

---

## 2. Icon Size Standards ✅ ALREADY DEFINED

**Status:** Comprehensive, but needs enforcement

```css
--icon-xs: 12px;    /* Priority badges, status dots */
--icon-sm: 14px;    /* Small buttons, compact lists */
--icon-md: 16px;    /* DEFAULT - standard buttons, cards */
--icon-lg: 18px;    /* Headings, emphasis */
--icon-xl: 20px;    /* Section headers, modal titles */
--icon-2xl: 24px;   /* Large headers, important actions */
--icon-3xl: 32px;   /* Hero sections, loading states */
--icon-4xl: 48px;   /* Empty states, splash screens */
```

**Issue Found:** Components use hardcoded `size={XX}` instead of these tokens

**Recommendation:** Create utility classes to enforce usage:

```css
/* Add to design-tokens.css */
.icon-xs { width: var(--icon-xs); height: var(--icon-xs); flex-shrink: 0; }
.icon-sm { width: var(--icon-sm); height: var(--icon-sm); flex-shrink: 0; }
.icon-md { width: var(--icon-md); height: var(--icon-md); flex-shrink: 0; }
.icon-lg { width: var(--icon-lg); height: var(--icon-lg); flex-shrink: 0; }
.icon-xl { width: var(--icon-xl); height: var(--icon-xl); flex-shrink: 0; }
.icon-2xl { width: var(--icon-2xl); height: var(--icon-2xl); flex-shrink: 0; }
.icon-3xl { width: var(--icon-3xl); height: var(--icon-3xl); flex-shrink: 0; }
.icon-4xl { width: var(--icon-4xl); height: var(--icon-4xl); flex-shrink: 0; }
```

**Usage:**
```tsx
// ❌ Before (hardcoded)
<CheckCircle size={16} />

// ✅ After (using token)
<CheckCircle className="icon-md" />
```

---

## 3. Badge Sizing System ❌ MISSING (HIGH PRIORITY)

**Status:** Not defined - causes 15+ different badge implementations

**Add to `design-tokens.css`:**

```css
/* ============================================
   BADGE SIZING SYSTEM
   ============================================ */

/* Size Tokens */
--badge-sm-padding-x: 8px;      /* px-2 */
--badge-sm-padding-y: 2px;      /* py-0.5 */
--badge-sm-font-size: 12px;     /* text-xs */
--badge-sm-radius: 9999px;      /* rounded-full */

--badge-md-padding-x: 12px;     /* px-3 */
--badge-md-padding-y: 4px;      /* py-1 */
--badge-md-font-size: 14px;     /* text-sm */
--badge-md-radius: 9999px;      /* rounded-full */

--badge-lg-padding-x: 16px;     /* px-4 */
--badge-lg-padding-y: 6px;      /* py-1.5 */
--badge-lg-font-size: 14px;     /* text-sm */
--badge-lg-radius: 8px;         /* rounded-lg */
```

**Add to `@layer components` in `index.css`:**

```css
/* Badge Components */
.badge {
  @apply inline-flex items-center justify-center;
  @apply font-medium;
  @apply transition-colors duration-150;
}

.badge-sm {
  @apply badge;
  padding: var(--badge-sm-padding-y) var(--badge-sm-padding-x);
  font-size: var(--badge-sm-font-size);
  border-radius: var(--badge-sm-radius);
}

.badge-md {
  @apply badge;
  padding: var(--badge-md-padding-y) var(--badge-md-padding-x);
  font-size: var(--badge-md-font-size);
  border-radius: var(--badge-md-radius);
}

.badge-lg {
  @apply badge;
  padding: var(--badge-lg-padding-y) var(--badge-lg-padding-x);
  font-size: var(--badge-lg-font-size);
  border-radius: var(--badge-lg-radius);
}

/* Badge variants */
.badge-primary {
  @apply bg-clawd-accent/20 text-clawd-accent border border-clawd-accent/30;
}

.badge-success {
  @apply bg-green-500/20 text-green-400 border border-green-500/30;
}

.badge-error {
  @apply bg-red-500/20 text-red-400 border border-red-500/30;
}

.badge-warning {
  @apply bg-yellow-500/20 text-yellow-400 border border-yellow-500/30;
}

.badge-info {
  @apply bg-blue-500/20 text-blue-400 border border-blue-500/30;
}
```

**Usage:**
```tsx
// ❌ Before (inconsistent)
<span className="px-2 py-1 text-xs rounded-full bg-clawd-accent/20 text-clawd-accent">
  Active
</span>

// ✅ After (standardized)
<span className="badge-sm badge-primary">Active</span>
```

---

## 4. Line Height Scale ❌ MISSING

**Status:** Not defined - inconsistent text readability

**Add to `design-tokens.css`:**

```css
/* ============================================
   LINE HEIGHT SCALE
   ============================================ */

--leading-none: 1;              /* Tight headings */
--leading-tight: 1.25;          /* Headings */
--leading-snug: 1.375;          /* Dense text */
--leading-normal: 1.5;          /* Body text (default) */
--leading-relaxed: 1.625;       /* Comfortable reading */
--leading-loose: 2;             /* Spacious layouts */
```

**Add to `@layer components` in `index.css`:**

```css
/* Line Height Utilities */
.leading-none { line-height: var(--leading-none); }
.leading-tight { line-height: var(--leading-tight); }
.leading-snug { line-height: var(--leading-snug); }
.leading-normal { line-height: var(--leading-normal); }
.leading-relaxed { line-height: var(--leading-relaxed); }
.leading-loose { line-height: var(--leading-loose); }
```

**Usage:**
```tsx
<p className="text-base leading-normal">Body text with comfortable spacing</p>
<h2 className="text-2xl leading-tight">Tight heading</h2>
```

---

## 5. Component-Specific Spacing ❌ MISSING

**Status:** Not defined - causes padding inconsistencies

**Add to `design-tokens.css`:**

```css
/* ============================================
   COMPONENT SPACING TOKENS
   ============================================ */

/* Buttons */
--button-padding-x: 16px;       /* px-4 (default) */
--button-padding-y: 8px;        /* py-2 (default) */
--button-gap: 8px;              /* gap-2 (icon + text) */

--button-sm-padding-x: 12px;    /* px-3 (small) */
--button-sm-padding-y: 6px;     /* py-1.5 (small) */

--button-lg-padding-x: 24px;    /* px-6 (large) */
--button-lg-padding-y: 12px;    /* py-3 (large) */

/* Inputs */
--input-padding-x: 12px;        /* px-3 */
--input-padding-y: 8px;         /* py-2 */
--input-border-radius: 8px;     /* rounded-lg */

/* Cards */
--card-padding: 16px;           /* p-4 (default) */
--card-padding-sm: 12px;        /* p-3 (compact) */
--card-padding-lg: 24px;        /* p-6 (large) */
--card-gap: 12px;               /* gap-3 (default) */

/* Panels */
--panel-padding: 24px;          /* p-6 (default) */
--panel-padding-sm: 16px;       /* p-4 (compact) */
--panel-gap: 16px;              /* gap-4 (default) */

/* Modals */
--modal-padding: 24px;          /* p-6 */
--modal-header-padding: 20px;   /* px-5 py-4 */
--modal-footer-padding: 20px;   /* px-5 py-4 */

/* List Items */
--list-item-padding: 12px;      /* p-3 */
--list-item-gap: 12px;          /* gap-3 */
```

---

## 6. Typography Scale Enhancement ⚠️ NEEDS UPDATE

**Current State:**
```css
--text-xs: 12px;       /* Labels, badges, timestamps */
--text-sm: 14px;       /* Body text (default) ❌ WRONG */
--text-base: 16px;     /* Emphasized body text ❌ SHOULD BE DEFAULT */
--text-lg: 18px;       /* Subheadings */
--text-xl: 20px;       /* Section headings */
--text-2xl: 24px;      /* Page headings */
--text-3xl: 30px;      /* Hero text */
```

**Recommendation:** Update documentation to clarify intended usage:

```css
/* ============================================
   TYPOGRAPHY SCALE (Updated Usage)
   ============================================ */

--text-xs: 12px;       /* Labels, badges, timestamps, secondary info */
--text-sm: 14px;       /* Compact UI, dense lists, secondary text */
--text-base: 16px;     /* DEFAULT BODY TEXT - primary content */
--text-lg: 18px;       /* Subheadings, emphasized text */
--text-xl: 20px;       /* Section headings */
--text-2xl: 24px;      /* Page headings, modal titles */
--text-3xl: 30px;      /* Hero text, splash screens */
```

**Action Required:** Migrate ~70% of `text-sm` instances to `text-base`

---

## 7. Color System Enhancement ✅ MOSTLY COMPLETE

**Status:** Well-defined, but needs enforcement

**Issue:** 90+ hardcoded hex colors in components instead of using tokens

**Recommendation:** Create linting rule to prevent hardcoded colors

**ESLint Rule (to add to `.eslintrc`):**

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "Literal[value=/#[0-9a-fA-F]{6}/]",
        "message": "Use CSS variables from design-tokens.css instead of hardcoded hex colors"
      }
    ]
  }
}
```

---

## 8. Recommended CSS File Structure

**Add new file:** `src/design-tokens-utilities.css`

```css
/**
 * design-tokens-utilities.css
 * 
 * Utility classes for enforcing design token usage
 * Import this after design-tokens.css
 */

/* ============================================
   ICON SIZE UTILITIES
   ============================================ */

.icon-xs { width: var(--icon-xs); height: var(--icon-xs); flex-shrink: 0; }
.icon-sm { width: var(--icon-sm); height: var(--icon-sm); flex-shrink: 0; }
.icon-md { width: var(--icon-md); height: var(--icon-md); flex-shrink: 0; }
.icon-lg { width: var(--icon-lg); height: var(--icon-lg); flex-shrink: 0; }
.icon-xl { width: var(--icon-xl); height: var(--icon-xl); flex-shrink: 0; }
.icon-2xl { width: var(--icon-2xl); height: var(--icon-2xl); flex-shrink: 0; }
.icon-3xl { width: var(--icon-3xl); height: var(--icon-3xl); flex-shrink: 0; }
.icon-4xl { width: var(--icon-4xl); height: var(--icon-4xl); flex-shrink: 0; }

/* ============================================
   BADGE UTILITIES
   ============================================ */

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  transition: all 150ms ease-out;
}

.badge-sm {
  padding: var(--badge-sm-padding-y) var(--badge-sm-padding-x);
  font-size: var(--badge-sm-font-size);
  border-radius: var(--badge-sm-radius);
}

.badge-md {
  padding: var(--badge-md-padding-y) var(--badge-md-padding-x);
  font-size: var(--badge-md-font-size);
  border-radius: var(--badge-md-radius);
}

.badge-lg {
  padding: var(--badge-lg-padding-y) var(--badge-lg-padding-x);
  font-size: var(--badge-lg-font-size);
  border-radius: var(--badge-lg-radius);
}

/* Badge Variants */
.badge-primary { background: var(--clawd-accent); color: white; }
.badge-success { background: var(--color-success-bg); color: var(--color-success); border: 1px solid var(--color-success-border); }
.badge-error { background: var(--color-error-bg); color: var(--color-error); border: 1px solid var(--color-error-border); }
.badge-warning { background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid var(--color-warning-border); }
.badge-info { background: var(--color-info-bg); color: var(--color-info); border: 1px solid var(--color-info-border); }

/* ============================================
   LINE HEIGHT UTILITIES
   ============================================ */

.leading-none { line-height: var(--leading-none); }
.leading-tight { line-height: var(--leading-tight); }
.leading-snug { line-height: var(--leading-snug); }
.leading-normal { line-height: var(--leading-normal); }
.leading-relaxed { line-height: var(--leading-relaxed); }
.leading-loose { line-height: var(--leading-loose); }

/* ============================================
   BUTTON UTILITIES (Component-specific spacing)
   ============================================ */

.btn-spacing {
  padding: var(--button-padding-y) var(--button-padding-x);
  gap: var(--button-gap);
}

.btn-spacing-sm {
  padding: var(--button-sm-padding-y) var(--button-sm-padding-x);
  gap: calc(var(--button-gap) * 0.75);
}

.btn-spacing-lg {
  padding: var(--button-lg-padding-y) var(--button-lg-padding-x);
  gap: calc(var(--button-gap) * 1.5);
}

/* ============================================
   CARD UTILITIES (Component-specific spacing)
   ============================================ */

.card-spacing {
  padding: var(--card-padding);
  gap: var(--card-gap);
}

.card-spacing-sm {
  padding: var(--card-padding-sm);
  gap: calc(var(--card-gap) * 0.75);
}

.card-spacing-lg {
  padding: var(--card-padding-lg);
  gap: calc(var(--card-gap) * 1.33);
}
```

**Update `index.css` to import:**

```css
/* Import design tokens FIRST */
@import './design-tokens.css';
@import './design-tokens-utilities.css';

/* Rest of imports... */
@import './accessibility.css';
@import './forms.css';
@import './text-utilities.css';
```

---

## 9. Migration Checklist

### Phase 1: Add Missing Tokens (P0)
- [ ] Add badge sizing tokens to `design-tokens.css`
- [ ] Add line height scale to `design-tokens.css`
- [ ] Add component spacing tokens to `design-tokens.css`
- [ ] Create `design-tokens-utilities.css` file
- [ ] Update `index.css` to import new utilities file

### Phase 2: Component Migration (P1)
- [ ] Migrate all badge components to use `.badge-sm/md/lg`
- [ ] Replace hardcoded icon sizes with `.icon-*` classes
- [ ] Update button padding to use `--button-padding-*` tokens
- [ ] Standardize card padding across components

### Phase 3: Color Cleanup (P0)
- [ ] Replace all hardcoded hex colors with CSS variables
- [ ] Add ESLint rule to prevent future hardcoded colors
- [ ] Test theme switching (light/dark) after color migration

### Phase 4: Typography Fix (P0)
- [ ] Audit 1209 `text-sm` instances
- [ ] Migrate 60-70% to `text-base` (default body text)
- [ ] Reserve `text-xs` for labels/timestamps only
- [ ] Update component documentation

---

## 10. Testing Strategy

### Visual Regression Testing
- [ ] Screenshot all components before changes
- [ ] Apply token updates
- [ ] Screenshot after changes
- [ ] Compare diffs (expect minimal visual changes, mostly spacing tweaks)

### Theme Switching
- [ ] Test light/dark theme switching after color migration
- [ ] Ensure all components adapt correctly
- [ ] No hardcoded colors should break theming

### Accessibility
- [ ] Run Lighthouse accessibility audit
- [ ] Ensure contrast ratios meet WCAG 2.1 AA standards
- [ ] Test with screen readers (VoiceOver, NVDA)

---

## 11. Expected Outcomes

### Before
- 90+ hardcoded hex colors
- 14 different icon sizes
- 15+ badge implementations
- No line height system
- `text-sm` as default (should be `text-base`)

### After
- 0 hardcoded hex colors (all use tokens)
- 8 standard icon sizes (enforced via classes)
- 3 badge sizes (sm/md/lg) with variants
- Complete line height scale
- `text-base` as default body text
- Linting to enforce token usage

---

## Appendix: Complete Token Reference

See updated `design-tokens.css` with all additions:
- Spacing: ✅ Already complete
- Icons: ✅ Already complete (needs utility classes)
- Typography: ⚠️ Needs usage update
- Badge sizing: ❌ ADD THIS
- Line heights: ❌ ADD THIS
- Component spacing: ❌ ADD THIS
- Colors: ✅ Complete (needs enforcement)
