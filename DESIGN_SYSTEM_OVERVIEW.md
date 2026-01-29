# Design System Overview

Quick visual guide to the Froggo Dashboard design system structure.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DESIGN SYSTEM                            │
│                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   FOUNDATION  │  │  COMPONENTS  │  │  DOCUMENTATION  │ │
│  └───────────────┘  └──────────────┘  └─────────────────┘ │
│         │                   │                    │         │
│         ▼                   ▼                    ▼         │
│  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ • Color       │  │ • Buttons    │  │ • Main Guide    │ │
│  │ • Typography  │  │ • Cards      │  │ • Quick Ref     │ │
│  │ • Spacing     │  │ • Badges     │  │ • Component Lib │ │
│  │ • Icons       │  │ • Inputs     │  │ • Migration     │ │
│  │ • Shadows     │  │ • Modals     │  │ • Checklist     │ │
│  └───────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Foundation Layer

### 🎨 Colors (26 tokens)

```
THEME COLORS (7)          STATUS COLORS (4)       CHANNEL COLORS (4)
├─ bg                     ├─ success              ├─ discord
├─ surface                ├─ error                ├─ telegram  
├─ border                 ├─ warning              ├─ whatsapp
├─ text                   └─ info                 └─ webchat
├─ text-dim
├─ accent                 PRIORITY COLORS (4)     KANBAN COLORS (7)
└─ accent-dim             ├─ p0 (urgent)          ├─ backlog
                          ├─ p1 (high)            ├─ todo
                          ├─ p2 (medium)          ├─ in-progress
                          └─ p3 (low)             ├─ review
                                                  ├─ human-review
                                                  ├─ done
                                                  └─ failed
```

### 📐 Spacing Scale

```
4px  ─┬─ gap-1, p-1, m-1    (tight)
8px  ─┼─ gap-2, p-2, m-2    (DEFAULT ★)
12px ─┼─ gap-3, p-3, m-3    (medium)
16px ─┼─ gap-4, p-4, m-4    (large)
24px ─┼─ gap-6, p-6, m-6    (extra large)
32px ─┴─ gap-8, p-8, m-8    (maximum)
```

### 📝 Typography Scale

```
12px ─┬─ text-xs     (labels, badges)
14px ─┼─ text-sm     (body text DEFAULT ★)
16px ─┼─ text-base   (emphasized)
18px ─┼─ text-lg     (subheadings)
20px ─┼─ text-xl     (section headings)
24px ─┼─ text-2xl    (page headings)
30px ─┴─ text-3xl    (hero text)
```

### 🎯 Icon Sizes

```
12px ─┬─ xs    (status dots, priority badges)
14px ─┼─ sm    (small buttons, compact UI)
16px ─┼─ md    (DEFAULT ★ buttons, cards)
18px ─┼─ lg    (headings, emphasis)
20px ─┼─ xl    (section headers, modals)
24px ─┼─ 2xl   (large headers)
32px ─┼─ 3xl   (hero sections)
48px ─┴─ 4xl   (empty states)
```

---

## Component Layer

### Buttons

```
PRIMARY          SECONDARY         ICON             GHOST
┌─────────┐      ┌─────────┐      ┌───┐            ┌─────────┐
│  Save   │      │ Cancel  │      │ ⚙ │            │  Link   │
└─────────┘      └─────────┘      └───┘            └─────────┘
accent bg        border bg        p-2 only         transparent
```

### Cards

```
BASIC                INTERACTIVE           WITH HEADER
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│              │     │  (hover)     │     │ 🎯 Title     │
│  Content     │     │  Content     │     ├──────────────┤
│              │     │              │     │ Content      │
└──────────────┘     └──────────────┘     └──────────────┘
p-4              shadow-hover         icon-text header
```

### Badges

```
STATUS           CHANNEL            PRIORITY
┌──────────┐     ┌──────────┐      ┌──────────┐
│ ● Active │     │ WhatsApp │      │ ⚠ Urgent │
└──────────┘     └──────────┘      └──────────┘
with dot         brand colors      with icon
```

---

## Usage Patterns

### Icon + Text (Most Common)

```jsx
// ✅ Correct - using utility class
<div className="icon-text">
  <Icon size={16} className="flex-shrink-0" />
  <span>Text</span>
</div>

// Spacing variants:
icon-text        → gap-2 (8px) DEFAULT
icon-text-tight  → gap-1.5 (6px)
icon-text-loose  → gap-3 (12px)
```

### Standard Card

```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <div className="icon-text mb-3">
    <Icon size={18} className="flex-shrink-0" />
    <h3 className="text-lg font-semibold">Title</h3>
  </div>
  <p className="text-sm text-clawd-text-dim">Content</p>
</div>
```

### Button Sizes

```jsx
// Small
<button className="px-3 py-1.5 text-sm">Small</button>

// Medium (DEFAULT)
<button className="px-4 py-2 text-base">Medium</button>

// Large
<button className="px-6 py-3 text-lg">Large</button>
```

---

## File Organization

```
clawd-dashboard/
│
├── 📚 DOCUMENTATION (7 files)
│   ├── DESIGN_SYSTEM.md              ← Main reference (24KB)
│   ├── DESIGN_SYSTEM_QUICKSTART.md   ← Fast lookup (7KB)
│   ├── COMPONENT_LIBRARY.md          ← Examples (16KB)
│   ├── DESIGN_SYSTEM_SUMMARY.md      ← Audit report (9KB)
│   ├── DESIGN_SYSTEM_MIGRATION.md    ← Migration guide (11KB)
│   ├── IMPLEMENTATION_CHECKLIST.md   ← Action plan (7KB)
│   └── DESIGN_SYSTEM_OVERVIEW.md     ← This file
│
└── src/
    ├── design-tokens.css             ← CSS variables (11KB)
    └── index.css                     ← Current styles
```

---

## Quick Decision Tree

### "What spacing should I use?"

```
Is it icon + text?              → gap-2
Is it button padding?           → px-4 py-2
Is it card padding?             → p-4
Is it section spacing?          → mb-4
Is it tight inline content?     → gap-1
Is it very spacious?            → p-6
```

### "What icon size should I use?"

```
Is it in a button?              → 16px
Is it a heading?                → 18px or 20px
Is it a badge?                  → 12px or 14px
Is it a modal header?           → 20px or 24px
Is it an empty state?           → 32px or 48px
Is it inline with text-sm?     → 14px or 16px
Default/unsure?                 → 16px
```

### "What text size should I use?"

```
Is it body text?                → text-sm (14px)
Is it a label/badge?            → text-xs (12px)
Is it a card title?             → text-lg (18px)
Is it a section heading?        → text-xl (20px)
Is it a page heading?           → text-2xl (24px)
Is it secondary info?           → text-xs or text-sm with text-dim
```

### "What border radius should I use?"

```
Is it a button/input?           → rounded-lg (8px)
Is it a card?                   → rounded-xl (12px)
Is it a modal?                  → rounded-2xl (16px)
Is it a badge/avatar?           → rounded-full
```

---

## Common Patterns Cheat Sheet

```jsx
// Standard button
<button className="px-4 py-2 bg-clawd-accent text-white rounded-lg 
                   hover:opacity-90 active:scale-95 transition-all">
  Button
</button>

// Icon button
<button className="icon-btn" aria-label="Action">
  <Icon size={16} aria-hidden="true" />
</button>

// Button with icon
<button className="icon-text px-4 py-2 bg-clawd-accent text-white rounded-lg">
  <Icon size={16} className="flex-shrink-0" />
  <span>Action</span>
</button>

// Status badge
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs 
                 rounded-full bg-color-success-bg text-color-success">
  <span className="w-2 h-2 rounded-full bg-color-success" />
  Online
</span>

// Card
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
  <h3 className="text-lg font-semibold mb-2">Title</h3>
  <p className="text-sm text-clawd-text-dim">Content</p>
</div>

// Input
<input className="w-full px-4 py-2 bg-clawd-surface border border-clawd-border 
                  rounded-lg text-sm focus:ring-2 focus:ring-clawd-accent" />

// Icon + text
<div className="icon-text">
  <Icon size={16} className="flex-shrink-0" />
  <span>Text</span>
</div>
```

---

## Consistency Scores

```
SPACING:  ████████████████████░░  92%  ✅ Excellent
ICONS:    ████████████████████░░  88%  ✅ Good
TYPO:     █████████████████████░  95%  ✅ Excellent
COLORS:   ███████████████░░░░░░  75%  ⚠️  Needs work
RADIUS:   █████████████████████░  94%  ✅ Excellent

Overall:  ████████████████████░░  89%  ✅ Strong foundation
```

---

## Migration Priority

```
HIGH PRIORITY (Week 1-2)
├── Import design-tokens.css
├── Replace hardcoded colors
├── Standardize icon sizes
└── Add aria labels

MEDIUM PRIORITY (Week 3-4)  
├── Apply utility classes
├── Update button patterns
├── Migrate card components
└── Fix spacing outliers

LOW PRIORITY (Week 5-6)
├── Create Storybook
├── Export to Figma
├── Document edge cases
└── Add more examples
```

---

## Getting Started

### For New Components
1. Check `DESIGN_SYSTEM_QUICKSTART.md` first
2. Copy patterns from `COMPONENT_LIBRARY.md`
3. Use CSS variables from `design-tokens.css`
4. Test in both themes

### For Existing Components
1. Read `DESIGN_SYSTEM_MIGRATION.md`
2. Use component checklist
3. Follow pattern examples
4. Test thoroughly

### For Reference
1. **Quick lookup:** `DESIGN_SYSTEM_QUICKSTART.md`
2. **Deep dive:** `DESIGN_SYSTEM.md`
3. **Examples:** `COMPONENT_LIBRARY.md`
4. **Help:** `DESIGN_SYSTEM_MIGRATION.md`

---

## Key Takeaways

✅ **Use CSS variables** for all colors (bg-clawd-surface, not bg-gray-900)  
✅ **Standard icon sizes** (12, 14, 16, 18, 20, 24, 32, 48)  
✅ **Always `flex-shrink-0`** on icons in flex containers  
✅ **Spacing scale** (gap-2, p-4, mb-2 - no gap-5 or p-7)  
✅ **Aria labels** on all icon buttons  
✅ **Test both themes** before committing  

---

**Quick Links:**
- Main Guide: `DESIGN_SYSTEM.md`
- Quick Ref: `DESIGN_SYSTEM_QUICKSTART.md`
- Examples: `COMPONENT_LIBRARY.md`
- Migration: `DESIGN_SYSTEM_MIGRATION.md`

---

*Part of Froggo Dashboard Design System v1.0.0*
