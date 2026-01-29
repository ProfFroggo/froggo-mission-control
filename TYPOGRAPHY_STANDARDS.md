# Typography Standards & Line-Height Rules
**Date:** 2026-01-29  
**Task:** task-1769688719100

This document defines the typography scale, line-height rules, and usage guidelines for the Froggo Dashboard.

---

## Typography Scale

### Font Size Tokens

| Token | Size | Usage | Examples |
|-------|------|-------|----------|
| `--text-xs` | **12px** | Labels, badges, timestamps, secondary info | "2 mins ago", "P0", "3 unread" |
| `--text-sm` | **14px** | Compact UI, dense lists, secondary text | Sidebar items, metadata, captions |
| `--text-base` | **16px** | **DEFAULT BODY TEXT** - primary content | Messages, descriptions, main text |
| `--text-lg` | **18px** | Subheadings, emphasized text | Section labels, emphasized info |
| `--text-xl` | **20px** | Section headings | Panel headers, card titles |
| `--text-2xl` | **24px** | Page headings, modal titles | Page names, modal headers |
| `--text-3xl` | **30px** | Hero text, splash screens | Welcome screens, empty states |

### Current State vs. Target State

| Size Class | Current Usage | Target Usage | Migration Needed |
|------------|---------------|--------------|------------------|
| `text-xs` | 748 instances | ~300 instances | ✅ Reduce by 60% |
| `text-sm` | **1209 instances** | ~500 instances | ❌ Reduce by 60% |
| `text-base` | **10 instances** | ~900 instances | ❌ Increase by 90x! |
| `text-lg` | 137 instances | ~150 instances | ✅ Good |
| `text-xl` | 71 instances | ~75 instances | ✅ Good |
| `text-2xl` | 78 instances | ~80 instances | ✅ Good |
| `text-3xl` | 32 instances | ~30 instances | ✅ Good |

**Critical Issue:** `text-sm` is currently the default body text - it should be `text-base`!

---

## Line-Height Scale

### Line-Height Tokens

| Token | Value | Usage | Typography Pair |
|-------|-------|-------|-----------------|
| `--leading-none` | **1.0** | Tight headings, logos | Large display text |
| `--leading-tight` | **1.25** | Headings, titles | text-2xl, text-3xl |
| `--leading-snug` | **1.375** | Dense text, compact UI | text-sm (compact lists) |
| `--leading-normal` | **1.5** | **DEFAULT** - body text | text-base (main content) |
| `--leading-relaxed` | **1.625** | Comfortable reading | Long-form text, articles |
| `--leading-loose` | **2.0** | Spacious layouts | Special cases, hero text |

### Recommended Pairings

```css
/* Headings - Tight */
.heading-3xl { @apply text-3xl leading-tight; }  /* 30px / 37.5px */
.heading-2xl { @apply text-2xl leading-tight; }  /* 24px / 30px */
.heading-xl  { @apply text-xl leading-tight; }   /* 20px / 25px */
.heading-lg  { @apply text-lg leading-tight; }   /* 18px / 22.5px */

/* Body Text - Normal */
.body-base { @apply text-base leading-normal; } /* 16px / 24px ✅ DEFAULT */
.body-sm   { @apply text-sm leading-snug; }     /* 14px / 19.25px */

/* Labels/Metadata - Snug */
.label-xs  { @apply text-xs leading-snug; }     /* 12px / 16.5px */
.label-sm  { @apply text-sm leading-snug; }     /* 14px / 19.25px */

/* Long-Form Reading - Relaxed */
.prose { @apply text-base leading-relaxed; }    /* 16px / 26px */
```

---

## Typography Hierarchy

### Visual Scale (Largest to Smallest)

```
Hero / Splash           text-3xl (30px)  leading-tight (1.25)  font-bold
Page Heading            text-2xl (24px)  leading-tight (1.25)  font-semibold
Section Heading         text-xl (20px)   leading-tight (1.25)  font-semibold
Subsection Heading      text-lg (18px)   leading-tight (1.25)  font-medium
───────────────────────────────────────────────────────────────────────────
Body Text (DEFAULT)     text-base (16px) leading-normal (1.5)  font-normal
Secondary Text          text-sm (14px)   leading-snug (1.375)  font-normal
───────────────────────────────────────────────────────────────────────────
Label / Badge           text-xs (12px)   leading-snug (1.375)  font-medium
Timestamp / Metadata    text-xs (12px)   leading-snug (1.375)  font-normal
```

**Rule:** Body text and above should use **`text-base`** or larger. Reserve `text-sm` for compact UI only.

---

## Usage Guidelines

### When to Use Each Size

#### `text-xs` (12px) - Labels & Metadata
**Use for:**
- Timestamps ("2 mins ago")
- Badges ("P0", "Done", "3 unread")
- Status labels ("Online", "Away")
- Secondary metadata
- Keyboard shortcuts

**Examples:**
```tsx
<span className="text-xs text-clawd-text-dim">2 mins ago</span>
<span className="badge-sm text-xs">P0</span>
<span className="text-xs text-clawd-text-dim">⌘K to open</span>
```

#### `text-sm` (14px) - Compact UI & Secondary Text
**Use for:**
- Sidebar navigation items
- Dense lists (when space is limited)
- Captions and helper text
- Compact cards
- Secondary information

**Examples:**
```tsx
<nav className="text-sm">Dashboard</nav>
<p className="text-sm text-clawd-text-dim">Helper text goes here</p>
<li className="text-sm">Compact list item</li>
```

**DON'T use for:** Main message content, primary text, descriptions

#### `text-base` (16px) - DEFAULT BODY TEXT ✅
**Use for:**
- Main message content
- Descriptions
- Paragraph text
- Primary UI text
- Default text size

**This should be your default! If you're not sure, use `text-base`.**

**Examples:**
```tsx
<p className="text-base">This is a message with normal body text.</p>
<div className="text-base">Primary content goes here.</div>
<p>Default text (no class needed, should be text-base by default)</p>
```

#### `text-lg` (18px) - Subheadings & Emphasis
**Use for:**
- Card section headings
- Emphasized text
- Important labels
- Subheadings within content

**Examples:**
```tsx
<h3 className="text-lg font-medium">Section Heading</h3>
<p className="text-lg font-semibold text-clawd-accent">Important Info</p>
```

#### `text-xl` (20px) - Section Headings
**Use for:**
- Panel headers
- Card titles
- Section headings
- Modal subheadings

**Examples:**
```tsx
<h2 className="text-xl font-semibold">Tasks</h2>
<div className="text-xl font-medium">Agent Status</div>
```

#### `text-2xl` (24px) - Page Headings & Titles
**Use for:**
- Page titles
- Modal titles
- Major section headers
- Primary headings

**Examples:**
```tsx
<h1 className="text-2xl font-bold">Dashboard</h1>
<h2 className="text-2xl font-semibold">Settings</h2>
```

#### `text-3xl` (30px) - Hero Text
**Use for:**
- Hero sections
- Welcome screens
- Empty states
- Splash screens
- Major call-to-action headings

**Examples:**
```tsx
<h1 className="text-3xl font-bold">Welcome to Froggo Dashboard</h1>
<div className="text-3xl text-clawd-text-dim">No messages yet</div>
```

---

## Migration Guide

### Phase 1: Identify Body Text (text-sm → text-base)

**Files with Heavy `text-sm` Usage:**

| File | Current `text-sm` | Should be `text-base` | Keep as `text-sm` |
|------|-------------------|----------------------|-------------------|
| `CommsInbox.tsx` | 87 | ~60 (70%) | ~27 (30%) |
| `TaskModal.tsx` | 72 | ~50 (70%) | ~22 (30%) |
| `AgentPanel.tsx` | 68 | ~45 (66%) | ~23 (34%) |
| `Kanban.tsx` | 61 | ~40 (66%) | ~21 (34%) |
| `Dashboard.tsx` | 58 | ~40 (69%) | ~18 (31%) |

**How to Identify:**
1. Look for main content, messages, descriptions → migrate to `text-base`
2. Look for labels, captions, metadata → keep as `text-sm`

### Phase 2: Reserve `text-xs` for Labels Only

**Current Overuse:**
- 748 instances of `text-xs`
- Should be ~300 instances (badges, timestamps, labels)

**Migration Strategy:**
- Badges/status labels → keep `text-xs`
- Timestamps → keep `text-xs`
- Keyboard shortcuts → keep `text-xs`
- Everything else → migrate to `text-sm` or `text-base`

### Phase 3: Establish `text-base` as Default

**Goal:** Make `text-base` the implicit default for unstyled text.

**Add to `index.css`:**
```css
body {
  font-size: var(--text-base); /* 16px */
  line-height: var(--leading-normal); /* 1.5 */
}
```

---

## Line-Height Best Practices

### Accessible Line-Height Ratios

**WCAG 2.1 Recommendation:** Line-height should be at least **1.5 for body text**

| Font Size | Min Line-Height | Our Standard | Status |
|-----------|-----------------|--------------|--------|
| 12px | 18px (1.5) | 16.5px (1.375) | ⚠️ Below WCAG |
| 14px | 21px (1.5) | 19.25px (1.375) | ⚠️ Below WCAG |
| 16px | 24px (1.5) | 24px (1.5) | ✅ Meets WCAG |
| 18px | 27px (1.5) | 22.5px (1.25) | ⚠️ Below WCAG |
| 20px+ | 30px+ (1.5) | 25px+ (1.25) | ⚠️ Below WCAG |

**Issue:** Our `leading-snug` (1.375) is below WCAG for small text.

**Recommendation:**
- **Body text (text-base):** Use `leading-normal` (1.5) ✅
- **Compact UI (text-sm):** Use `leading-normal` (1.5) instead of `leading-snug`
- **Labels (text-xs):** Can use `leading-snug` (1.375) - acceptable for short labels

**Updated Pairing:**
```css
/* WCAG-Compliant */
.body-base { @apply text-base leading-normal; }  /* 16px / 24px ✅ */
.body-sm   { @apply text-sm leading-normal; }    /* 14px / 21px ✅ */
.label-xs  { @apply text-xs leading-snug; }      /* 12px / 16.5px (acceptable) */
```

---

## Font Weight Guidelines

### Weight Scale

| Class | Weight | Usage |
|-------|--------|-------|
| `font-normal` | 400 | Default body text, paragraphs |
| `font-medium` | 500 | Labels, badges, emphasized text |
| `font-semibold` | 600 | Headings, section titles |
| `font-bold` | 700 | Page titles, important headings |

### Recommended Combinations

```tsx
// Headings
<h1 className="text-3xl font-bold leading-tight">Page Title</h1>
<h2 className="text-2xl font-semibold leading-tight">Section</h2>
<h3 className="text-xl font-semibold leading-tight">Subsection</h3>
<h4 className="text-lg font-medium leading-tight">Label</h4>

// Body Text
<p className="text-base font-normal leading-normal">Body text</p>
<p className="text-sm font-normal leading-normal">Secondary text</p>

// Labels & Badges
<span className="text-xs font-medium leading-snug">Badge</span>
<span className="text-xs font-normal leading-snug">Timestamp</span>
```

---

## Complete Typography System

### CSS Custom Properties (Add to `design-tokens.css`)

```css
/* ============================================
   TYPOGRAPHY SYSTEM
   ============================================ */

/* Font Family */
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace;

/* Font Sizes */
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;

/* Line Heights */
--leading-none: 1;
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Letter Spacing (optional, for future use) */
--tracking-tight: -0.025em;
--tracking-normal: 0;
--tracking-wide: 0.025em;
```

### Utility Classes (Add to `index.css`)

```css
@layer components {
  /* Typography Presets */
  .heading-3xl {
    font-size: var(--text-3xl);
    line-height: var(--leading-tight);
    font-weight: var(--font-bold);
  }
  
  .heading-2xl {
    font-size: var(--text-2xl);
    line-height: var(--leading-tight);
    font-weight: var(--font-semibold);
  }
  
  .heading-xl {
    font-size: var(--text-xl);
    line-height: var(--leading-tight);
    font-weight: var(--font-semibold);
  }
  
  .heading-lg {
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
    font-weight: var(--font-medium);
  }
  
  .body-base {
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    font-weight: var(--font-normal);
  }
  
  .body-sm {
    font-size: var(--text-sm);
    line-height: var(--leading-normal);  /* Changed from snug to normal for WCAG */
    font-weight: var(--font-normal);
  }
  
  .label-xs {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    font-weight: var(--font-medium);
  }
  
  .caption-xs {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    font-weight: var(--font-normal);
  }
}
```

---

## Accessibility Checklist

### WCAG 2.1 Compliance

- [ ] Body text (text-base) uses line-height ≥ 1.5 ✅
- [ ] Small text (text-sm) uses line-height ≥ 1.5 ✅ (updated from 1.375)
- [ ] Labels (text-xs) can use line-height ≥ 1.375 ✅
- [ ] Minimum font size for body text is 16px ✅
- [ ] Text can be resized up to 200% without loss of functionality
- [ ] Color contrast ratios meet AA standards (4.5:1 for body text)

---

## Summary

### Current State
- ❌ `text-sm` (14px) is de facto default body text
- ❌ `text-base` (16px) severely underused (10 instances)
- ⚠️ `text-xs` overused (748 instances, should be ~300)
- ⚠️ Line-heights below WCAG for small text

### Target State
- ✅ `text-base` (16px) as default body text (~900 instances)
- ✅ `text-sm` reserved for compact UI (~500 instances)
- ✅ `text-xs` reserved for labels/timestamps (~300 instances)
- ✅ All text meets WCAG 2.1 line-height requirements

### Migration Effort
- **High:** Migrate ~480 instances of `text-sm` → `text-base` (40% of total)
- **Medium:** Reduce `text-xs` usage by 60% (~450 instances)
- **Low:** Update line-height standards (CSS only, no component changes)

**Estimated Time:** 2-3 days for full migration
