# Design System Audit Report
**Date:** 2026-01-29  
**Project:** Froggo Dashboard  
**Task:** task-1769688719100

## Executive Summary

The Froggo Dashboard has a **comprehensive design tokens file** (`design-tokens.css`) with well-defined standards. However, **component usage shows inconsistencies** in:
- Icon sizing (14 different sizes in use)
- Spacing patterns (mixed gap/padding values)
- Hardcoded color values (15+ hex codes scattered across components)
- Typography scale (overuse of text-sm/text-xs)

**Current State:** 🟡 Moderate consistency  
**Goal:** 🟢 High consistency through token enforcement

---

## 1. Spacing Analysis

### Current Usage (139 components analyzed)

#### **Gap Spacing**
| Gap Value | Usage Count | Status | Recommendation |
|-----------|-------------|--------|----------------|
| `gap-2` (8px) | 820 | ✅ **Primary** | Keep - most common |
| `gap-3` (12px) | 243 | ✅ Good | Standard spacing |
| `gap-1` (4px) | 173 | ⚠️ Overused | Reserve for tight layouts only |
| `gap-4` (16px) | 102 | ✅ Good | Card/section spacing |
| `gap-1.5` (6px) | 57 | ⚠️ Non-standard | Migrate to gap-1 or gap-2 |
| `gap-6` (24px) | 11 | ✅ Good | Large sections |
| `gap-0.5` (2px) | 4 | ❌ Too tight | Remove - migrate to gap-1 |

**Issues:**
- ❌ `gap-1.5` and `gap-0.5` are non-standard - not in design tokens
- ⚠️ `gap-1` is overused (173 instances) - should be reserved for compact layouts

#### **Padding Usage**
| Padding | Usage Count | Status | Notes |
|---------|-------------|--------|-------|
| `p-2` (8px) | 1057 | ✅ Most common | Icon buttons, small cards |
| `p-4` (16px) | 504 | ✅ Standard | Default card padding |
| `p-3` (12px) | 444 | ✅ Good | Compact cards |
| `p-6` (24px) | 239 | ✅ Good | Large panels |
| `py-2` | 425 | ✅ Common | Buttons, inputs |
| `px-3` | 316 | ✅ Common | Buttons |
| `px-4` | 280 | ✅ Common | Standard horizontal padding |
| `p-1` (4px) | 260 | ⚠️ Very tight | Often too small |
| `py-0.5` | 141 | ⚠️ Non-standard | Migrate to py-1 |
| `py-1.5` | 126 | ⚠️ Non-standard | Migrate to py-1 or py-2 |
| `p-8` (32px) | 42 | ✅ Good | Hero sections |

**Issues:**
- ❌ `py-0.5`, `py-1.5`, `px-1.5` are non-standard fractions
- ⚠️ Mixed padding strategies (some use `p-*`, others use `px-*/py-*`)

---

## 2. Typography Analysis

### Font Size Usage
| Size Class | Usage Count | % of Total | Recommendation |
|------------|-------------|------------|----------------|
| `text-sm` (14px) | 1209 | **53.7%** | ⚠️ **OVERUSED** - default body text |
| `text-xs` (12px) | 748 | 33.2% | ⚠️ Overused - labels only |
| `text-lg` (18px) | 137 | 6.1% | ✅ Good - subheadings |
| `text-2xl` (24px) | 78 | 3.5% | ✅ Good - page headings |
| `text-xl` (20px) | 71 | 3.2% | ✅ Good - section headings |
| `text-3xl` (30px) | 32 | 1.4% | ✅ Good - hero text |
| `text-base` (16px) | 10 | 0.4% | ❌ **UNDERUSED** - should be default! |

**Critical Issues:**
1. ❌ **`text-base` is severely underused** (10 instances vs 1209 text-sm)
2. ❌ **`text-sm` is the de facto default** - should be `text-base`
3. ⚠️ **`text-xs` is overused** - 748 instances (should be ~200-300 for labels/timestamps)

**Recommendations:**
- Establish `text-base` (16px) as default body text
- Reserve `text-sm` for secondary/compact UI
- Reserve `text-xs` for labels, badges, timestamps only

---

## 3. Icon Size Analysis

### Current Usage (14 different sizes detected!)

| Icon Size | Usage Count | Status | Token Exists? |
|-----------|-------------|--------|---------------|
| `size={16}` | 449 | ✅ Most common | Yes - `--icon-md` |
| `size={14}` | 268 | ⚠️ Non-standard | Partial - `--icon-sm` (should be 14px) |
| `size={18}` | 241 | ✅ Good | Yes - `--icon-lg` |
| `size={20}` | 139 | ✅ Good | Yes - `--icon-xl` |
| `size={12}` | 128 | ✅ Good | Yes - `--icon-xs` |
| `size={24}` | 71 | ✅ Good | Yes - `--icon-2xl` |
| `size={32}` | 50 | ✅ Good | Yes - `--icon-3xl` |
| `size={48}` | 38 | ✅ Good | Yes - `--icon-4xl` |
| `size={10}` | 25 | ❌ Too small | **NO** |
| `size={40}` | 7 | ❌ Non-standard | **NO** |
| `size={28}` | 5 | ❌ Non-standard | **NO** |
| `size={64}` | 3 | ❌ Non-standard | **NO** |
| `size={8}` | 1 | ❌ Too small | **NO** |
| `size={36}` | 1 | ❌ Non-standard | **NO** |

**Issues:**
- ❌ **6 non-standard icon sizes** (8, 10, 28, 36, 40, 64)
- ⚠️ Components are using hardcoded `size={XX}` instead of CSS classes
- ⚠️ Lucide icons don't use the defined icon size tokens

**Design Token Alignment:**
```css
/* Defined in design-tokens.css */
--icon-xs: 12px;   ✅ USED (128 times)
--icon-sm: 14px;   ✅ USED (268 times) - but defined as 14px, not 16px!
--icon-md: 16px;   ✅ USED (449 times) - DEFAULT
--icon-lg: 18px;   ✅ USED (241 times)
--icon-xl: 20px;   ✅ USED (139 times)
--icon-2xl: 24px;  ✅ USED (71 times)
--icon-3xl: 32px;  ✅ USED (50 times)
--icon-4xl: 48px;  ✅ USED (38 times)
```

**Issue:** `--icon-sm` is defined as `14px` but should be `16px` based on actual usage patterns.

---

## 4. Border Radius Analysis

### Current Usage
| Radius Class | Usage Count | Status | Token |
|--------------|-------------|--------|-------|
| `rounded-lg` | 891 | ✅ **Primary** | `--radius-lg` (8px) |
| `rounded-xl` | 376 | ✅ Common | `--radius-xl` (12px) |
| `rounded-full` | 291 | ✅ Common | `--radius-full` (9999px) |
| `rounded-2xl` | 92 | ✅ Good | `--radius-2xl` (16px) |
| `rounded-md` | 9 | ⚠️ Rare | `--radius-md` (6px) |
| `rounded-sm` | 4 | ⚠️ Rare | `--radius-sm` (4px) |
| `rounded-3xl` | 3 | ✅ Rare | `--radius-3xl` (24px) |

**Status:** ✅ **Well-aligned with design tokens!**

---

## 5. Color Token Analysis

### Hardcoded Hex Values (CRITICAL ISSUE)

**15+ hardcoded hex colors found across components:**

| Hex Code | Usage Count | Should Use |
|----------|-------------|------------|
| `#9CA3AF` | 26 | `var(--priority-p3)` or gray-400 |
| `#3B82F6` | 14 | `var(--color-info)` or blue-500 |
| `#10B981` | 13 | `var(--color-success)` (should be #22c55e) |
| `#8B5CF6` | 7 | purple-500 |
| `#374151` | 7 | gray-700 |
| `#F59E0B` | 6 | `var(--color-warning)` |
| `#6366f1` | 6 | indigo-500 |
| `#22c55e` | 5 | `var(--color-success)` ✅ CORRECT |
| `#ef4444` | 3 | `var(--color-error)` ✅ CORRECT |
| Others | 30+ | Various tokens |

**Issues:**
- ❌ **90+ hardcoded color values** across 139 components
- ❌ Colors won't adapt to theme changes (light/dark mode)
- ❌ `#10B981` is used instead of the correct `#22c55e` for success color
- ❌ Inconsistent color usage (same semantic color has multiple hex values)

---

## 6. Component-Specific Issues

### Badge Components
**Files:** `BadgeWrapper.tsx`, `BadgeShowcase.tsx`, `IconBadge.tsx`

**Issues:**
- ❌ Mixed sizing approaches (some use `size={}`, some use CSS classes)
- ⚠️ No standardized badge size system (sm/md/lg)
- ⚠️ Hardcoded padding values

**Current Approach:**
```tsx
<div className="px-2 py-1 text-xs rounded-full"> {/* Inconsistent */}
<div className="px-3 py-1.5 text-sm rounded-lg"> {/* Different approach */}
```

**Needed:**
```css
.badge-sm { padding: 2px 8px; font-size: 12px; }
.badge-md { padding: 4px 12px; font-size: 14px; }
.badge-lg { padding: 6px 16px; font-size: 14px; }
```

---

## 7. Inconsistencies Summary

### High Priority Issues (P0)
1. ❌ **90+ hardcoded hex colors** - breaks theming
2. ❌ **`text-base` severely underused** - wrong default typography
3. ❌ **Non-standard spacing values** (`gap-0.5`, `py-0.5`, `gap-1.5`, etc.)
4. ❌ **6 non-standard icon sizes** (8, 10, 28, 36, 40, 64)

### Medium Priority Issues (P1)
5. ⚠️ **`text-sm` overused as default** - should be text-base
6. ⚠️ **No standardized badge sizing system**
7. ⚠️ **`gap-1` overused** (173 instances - too tight for most layouts)

### Low Priority Issues (P2)
8. ⚠️ Mixed padding strategies (`p-*` vs `px-*/py-*`)
9. ⚠️ `--icon-sm` token mismatch (defined as 14px, but usage suggests 16px is more common)

---

## 8. Design Token Coverage

### Existing Tokens (✅ Comprehensive)
```css
✅ Spacing: --space-1 through --space-8 (4px base unit)
✅ Icons: --icon-xs through --icon-4xl (8 sizes)
✅ Typography: --text-xs through --text-3xl (7 sizes)
✅ Border Radius: --radius-sm through --radius-full (7 sizes)
✅ Colors: Theme, status, channel, priority, Kanban
✅ Shadows: card, modal, glow effects
✅ Animations: --duration-fast/normal/slow, easing functions
✅ Z-index: layering system
```

### Missing Tokens (Need to Add)
```css
❌ Badge sizing: --badge-sm, --badge-md, --badge-lg
❌ Component-specific spacing (e.g., --input-padding, --button-padding)
❌ Line heights: --leading-tight, --leading-normal, --leading-relaxed
```

---

## 9. Recommendations

### Phase 1: Critical Fixes (P0) - Immediate
1. **Replace all hardcoded hex colors with CSS variables**
   - Find: `#[0-9a-fA-F]{6}`
   - Replace with: `var(--color-*)` or Tailwind color classes
   - Estimated: 90+ replacements across 50+ files

2. **Standardize icon sizes**
   - Migrate 6 non-standard sizes (8, 10, 28, 36, 40, 64) to standard tokens
   - Update `--icon-sm` from 14px to match actual usage or create utility classes

3. **Fix typography defaults**
   - Establish `text-base` (16px) as default body text
   - Audit 1209 `text-sm` instances - migrate 60-70% to `text-base`
   - Reserve `text-xs` for labels/timestamps only

4. **Remove non-standard spacing values**
   - Migrate `gap-0.5` → `gap-1`
   - Migrate `gap-1.5` → `gap-1` or `gap-2`
   - Migrate `py-0.5`, `py-1.5` → `py-1` or `py-2`

### Phase 2: Standardization (P1) - Week 1
5. **Create badge sizing system**
   ```css
   .badge-sm { @apply px-2 py-0.5 text-xs rounded-full; }
   .badge-md { @apply px-3 py-1 text-sm rounded-full; }
   .badge-lg { @apply px-4 py-1.5 text-sm rounded-lg; }
   ```

6. **Document spacing patterns**
   - Card padding: `p-4` (default), `p-3` (compact), `p-6` (large)
   - Section gap: `gap-2` (tight), `gap-3` (normal), `gap-4` (relaxed)
   - Button padding: `px-4 py-2` (default), `px-3 py-1.5` (sm), `px-6 py-3` (lg)

7. **Create component usage map**
   - Document which components use which tokens
   - Identify outliers and inconsistencies

### Phase 3: Enhancement (P2) - Week 2
8. **Add missing tokens**
   - Badge sizes
   - Line heights
   - Component-specific spacing

9. **Create style guide documentation**
   - When to use each spacing value
   - Icon size guidelines
   - Typography hierarchy
   - Color usage rules

10. **Automated linting**
    - ESLint rule to detect hardcoded hex colors
    - Stylelint to enforce token usage
    - Pre-commit hooks

---

## 10. Design Token Recommendations

### Add to `design-tokens.css`:

```css
/* ============================================
   BADGE SIZING SYSTEM
   ============================================ */

--badge-sm-padding-x: 8px;      /* px-2 */
--badge-sm-padding-y: 2px;      /* py-0.5 */
--badge-sm-text: 12px;          /* text-xs */
--badge-sm-radius: 9999px;      /* rounded-full */

--badge-md-padding-x: 12px;     /* px-3 */
--badge-md-padding-y: 4px;      /* py-1 */
--badge-md-text: 14px;          /* text-sm */
--badge-md-radius: 9999px;      /* rounded-full */

--badge-lg-padding-x: 16px;     /* px-4 */
--badge-lg-padding-y: 6px;      /* py-1.5 */
--badge-lg-text: 14px;          /* text-sm */
--badge-lg-radius: 8px;         /* rounded-lg */

/* ============================================
   LINE HEIGHT SCALE
   ============================================ */

--leading-none: 1;              /* Tight headings */
--leading-tight: 1.25;          /* Headings */
--leading-snug: 1.375;          /* Dense text */
--leading-normal: 1.5;          /* Body text (default) */
--leading-relaxed: 1.625;       /* Comfortable reading */
--leading-loose: 2;             /* Spacious layouts */

/* ============================================
   COMPONENT SPACING
   ============================================ */

/* Buttons */
--button-padding-x: 16px;       /* px-4 (default) */
--button-padding-y: 8px;        /* py-2 (default) */
--button-gap: 8px;              /* gap-2 */

/* Inputs */
--input-padding-x: 12px;        /* px-3 */
--input-padding-y: 8px;         /* py-2 */

/* Cards */
--card-padding: 16px;           /* p-4 (default) */
--card-padding-sm: 12px;        /* p-3 (compact) */
--card-padding-lg: 24px;        /* p-6 (large) */
--card-gap: 12px;               /* gap-3 */
```

---

## 11. Component Usage Map

### Most Inconsistent Components (Top 10)
1. **Badges** - 15+ different sizing approaches
2. **Buttons** - Mixed padding (px-3/px-4, py-1.5/py-2)
3. **Cards** - 6 different padding values (p-1 through p-8)
4. **Icons** - 14 different sizes
5. **Modal headers** - Mixed text sizes (text-lg, text-xl, text-2xl)
6. **List items** - Inconsistent gap values (gap-1, gap-2, gap-3)
7. **Forms** - Mixed input padding
8. **Panels** - Inconsistent section spacing
9. **Headers** - Mixed typography scale
10. **Footers** - Inconsistent padding

---

## 12. Migration Strategy

### Week 1: Foundation
- [ ] Add missing design tokens (badges, line heights, component spacing)
- [ ] Create migration script for hardcoded colors → CSS variables
- [ ] Document spacing standards in style guide

### Week 2: Components
- [ ] Migrate all badge components to new sizing system
- [ ] Standardize button padding across all components
- [ ] Fix icon sizing (remove non-standard sizes)

### Week 3: Typography
- [ ] Migrate text-sm → text-base for body text (audit 1209 instances)
- [ ] Reserve text-xs for labels/timestamps only
- [ ] Standardize heading hierarchy

### Week 4: Polish
- [ ] Remove all non-standard spacing values
- [ ] Set up linting rules
- [ ] Create component usage documentation

---

## 13. Success Metrics

### Before (Current State)
- ❌ 90+ hardcoded hex colors
- ❌ 14 different icon sizes
- ❌ text-base used only 10 times (should be default)
- ❌ 6 non-standard spacing values

### After (Target State)
- ✅ 0 hardcoded hex colors (all use CSS variables)
- ✅ 8 standard icon sizes only
- ✅ text-base as default body text (500+ instances)
- ✅ Only standard spacing values (gap-1/2/3/4/6/8)
- ✅ Standardized badge sizing system
- ✅ Linting rules enforcing token usage

---

## Appendix: Files Analyzed
- **Total Components:** 139 .tsx files
- **CSS Files:** 4 (index.css, design-tokens.css, forms.css, text-utilities.css)
- **Analysis Method:** Regex pattern matching for class names and inline styles
- **Confidence Level:** High (comprehensive scan of all component files)
