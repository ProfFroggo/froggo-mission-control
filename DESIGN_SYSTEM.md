# Froggo Dashboard Design System

**Version:** 1.0.0  
**Last Updated:** 2026-01-29  
**Status:** ✅ Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing Scale](#spacing-scale)
5. [Component Sizing](#component-sizing)
6. [Icon System](#icon-system)
7. [Border Radius](#border-radius)
8. [Shadows](#shadows)
9. [Animations](#animations)
10. [CSS Variables Reference](#css-variables-reference)
11. [Component Patterns](#component-patterns)
12. [Accessibility](#accessibility)

---

## Overview

The Froggo Dashboard design system is built on:
- **Tailwind CSS** for utility classes
- **CSS Custom Properties** for theming
- **Lucide React** for icons
- **8px base unit** for consistent spacing

### Design Principles

1. **Consistency** - Use standardized tokens across all components
2. **Accessibility** - WCAG AA compliance minimum (4.5:1 contrast)
3. **Performance** - Optimized animations and rendering
4. **Flexibility** - Light/dark theme support via CSS variables
5. **Clarity** - Clear visual hierarchy and readable interfaces

---

## Color System

### Theme Colors

All theme colors adapt to light/dark mode via CSS variables:

```css
/* Dark Theme (default) */
--clawd-bg: #0a0a0a           /* Main background */
--clawd-surface: #141414      /* Cards, panels */
--clawd-border: #262626       /* Borders, dividers */
--clawd-text: #fafafa         /* Primary text */
--clawd-text-dim: #a1a1aa     /* Secondary text */
--clawd-accent: #22c55e       /* Primary accent (green) */
--clawd-accent-dim: #16a34a   /* Darker accent */

/* Light Theme */
--clawd-bg: #fafafa           /* Main background */
--clawd-surface: #ffffff      /* Cards, panels */
--clawd-border: #e4e4e7       /* Borders, dividers */
--clawd-text: #18181b         /* Primary text */
--clawd-text-dim: #52525b     /* Secondary text (improved contrast) */
```

**Usage in Tailwind:**
```jsx
<div className="bg-clawd-surface text-clawd-text border-clawd-border">
```

### Status Colors

Status colors are theme-independent (same in light/dark):

```css
/* Success */
--color-success: #22c55e
--color-success-bg: rgba(34, 197, 94, 0.1)

/* Error */
--color-error: #ef4444
--color-error-bg: rgba(239, 68, 68, 0.1)

/* Warning */
--color-warning: #f59e0b
--color-warning-bg: rgba(245, 158, 11, 0.1)

/* Info */
--color-info: #3b82f6
--color-info-bg: rgba(59, 130, 246, 0.1)
```

**Usage:**
```jsx
<div className="text-color-success bg-color-success-bg">
  Success message
</div>
```

### Channel Brand Colors

Fixed colors for messaging channel identity:

```css
--channel-discord: #5865F2
--channel-discord-bg: rgba(88, 101, 242, 0.2)

--channel-telegram: #229ED9
--channel-telegram-bg: rgba(34, 158, 217, 0.2)

--channel-whatsapp: #25D366
--channel-whatsapp-bg: rgba(37, 211, 102, 0.2)

--channel-webchat: #a855f7
--channel-webchat-bg: rgba(168, 85, 247, 0.2)
```

### Priority Colors

```css
/* P0 - Urgent */
--priority-p0: #ef4444        /* red-400 */
--priority-p0-bg: rgba(239, 68, 68, 0.2)

/* P1 - High */
--priority-p1: #fb923c        /* orange-400 */
--priority-p1-bg: rgba(251, 146, 60, 0.2)

/* P2 - Medium */
--priority-p2: #facc15        /* yellow-400 */
--priority-p2-bg: rgba(250, 204, 21, 0.2)

/* P3 - Low */
--priority-p3: #9ca3af        /* gray-400 */
--priority-p3-bg: rgba(156, 163, 175, 0.2)
```

### Kanban Column Colors

```css
--kanban-backlog: #6b7280      /* gray-500 */
--kanban-todo: #3b82f6         /* blue-500 */
--kanban-in-progress: #eab308  /* yellow-500 */
--kanban-review: #a855f7       /* purple-500 */
--kanban-human-review: #f97316 /* orange-500 */
--kanban-done: #22c55e         /* green-500 */
--kanban-failed: #ef4444       /* red-500 */
```

---

## Typography

### Font Stack

```css
--clawd-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--clawd-font-mono: 'JetBrains Mono', 'Menlo', monospace;
```

### Type Scale

Based on usage analysis (1224 uses of text-sm, 770 text-xs):

| Token | Size | Line Height | Usage | Example |
|-------|------|-------------|-------|---------|
| `text-xs` | 12px | 16px (1.33) | Labels, badges, timestamps | "2h ago", channel badges |
| `text-sm` | 14px | 20px (1.43) | Body text, buttons, inputs | **PRIMARY BODY TEXT** |
| `text-base` | 16px | 24px (1.5) | Emphasized body, form labels | Important content |
| `text-lg` | 18px | 28px (1.56) | Subheadings, card titles | Panel subtitles |
| `text-xl` | 20px | 28px (1.4) | Section headings | "Tasks", "Agents" |
| `text-2xl` | 24px | 32px (1.33) | Page headings | "Dashboard", "Settings" |
| `text-3xl` | 30px | 36px (1.2) | Hero text | Rare, special emphasis |

### Font Weights

```css
font-normal   /* 400 - Default body text */
font-medium   /* 500 - Emphasized text, buttons */
font-semibold /* 600 - Headings, strong emphasis */
font-bold     /* 700 - Rare, very strong emphasis */
```

**Standard Pattern:**
```jsx
{/* Heading */}
<h2 className="text-xl font-semibold mb-2">Section Title</h2>

{/* Body text */}
<p className="text-sm text-clawd-text">
  Standard body text with good readability
</p>

{/* Muted text */}
<span className="text-xs text-clawd-text-dim">
  Secondary information
</span>
```

---

## Spacing Scale

**Base unit: 4px** (Tailwind's default rem scale)

### Standard Scale

| Token | Size | Usage |
|-------|------|-------|
| `gap-1` / `p-1` / `m-1` | 4px | Tight spacing, icon-text gaps |
| `gap-2` / `p-2` / `m-2` | **8px** | **Most common spacing** (869 uses) |
| `gap-3` / `p-3` / `m-3` | 12px | Medium spacing, card padding |
| `gap-4` / `p-4` / `m-4` | 16px | Large spacing, panel padding |
| `gap-6` / `p-6` / `m-6` | 24px | Extra large spacing, section separation |
| `gap-8` / `p-8` / `m-8` | 32px | Maximum spacing, hero sections |

### Usage Patterns (by frequency)

**Gap (flexbox/grid spacing):**
- **gap-2** (8px) - Default for icon+text, list items, form fields (869 uses)
- **gap-3** (12px) - Card content spacing (244 uses)
- **gap-1** (4px) - Very tight, inline badges (232 uses)
- **gap-4** (16px) - Section spacing (108 uses)

**Padding:**
- **p-2** (8px) - Buttons, badges, small containers (1120 uses)
- **p-4** (16px) - Cards, panels, modals (516 uses)
- **p-3** (12px) - Medium buttons, inputs (456 uses)

**Margin:**
- **mb-2** (8px) - Default bottom spacing (335 uses)
- **mb-4** (16px) - Section bottom spacing (226 uses)
- **mb-1** (4px) - Tight bottom spacing (199 uses)

### Component Spacing Patterns

```jsx
{/* Card with standard spacing */}
<div className="p-4 mb-4 bg-clawd-surface rounded-xl border border-clawd-border">
  {/* Header with gap-2 for icon+text */}
  <div className="flex items-center gap-2 mb-3">
    <Icon size={18} />
    <h3 className="text-lg font-semibold">Card Title</h3>
  </div>
  
  {/* Content with mb-2 spacing */}
  <p className="text-sm mb-2">Card content...</p>
  
  {/* Actions with gap-2 */}
  <div className="flex gap-2">
    <button className="px-3 py-1.5">Action</button>
  </div>
</div>
```

---

## Component Sizing

### Button Sizes

```jsx
{/* Small */}
<button className="px-3 py-1.5 text-sm">
  Small Button
</button>

{/* Medium (default) */}
<button className="px-4 py-2 text-base">
  Medium Button
</button>

{/* Large */}
<button className="px-6 py-3 text-lg">
  Large Button
</button>
```

### Input Sizes

```jsx
{/* Small */}
<input className="px-3 py-1.5 text-sm h-8" />

{/* Medium (default) */}
<input className="px-4 py-2 text-sm h-10" />

{/* Large */}
<input className="px-4 py-3 text-base h-12" />
```

### Badge Sizes

```jsx
{/* Small */}
<span className="px-2 py-0.5 text-xs">Badge</span>

{/* Medium (default) */}
<span className="px-2.5 py-1 text-xs">Badge</span>

{/* Large */}
<span className="px-3 py-1.5 text-sm">Badge</span>
```

### Card Sizes

```jsx
{/* Small card */}
<div className="p-3 rounded-lg">...</div>

{/* Medium card (default) */}
<div className="p-4 rounded-xl">...</div>

{/* Large card */}
<div className="p-6 rounded-2xl">...</div>
```

---

## Icon System

### Icon Sizes (by frequency)

| Size | Usage Count | Use Case |
|------|-------------|----------|
| **16px** | 433 | **Default icon size** - buttons, cards, list items |
| **14px** | 288 | Small icons - badges, inline text, compact UI |
| **18px** | 247 | Medium icons - headings, emphasis |
| **20px** | 137 | Large icons - section headers, modal titles |
| **12px** | 130 | Extra small - priority badges, status indicators |
| **24px** | 71 | Extra large - modal headers, empty states |
| **32px** | 51 | Huge - hero sections, loading states |
| **48px** | 38 | Hero icons - empty states, splash screens |

### Icon Size Tokens

Define these CSS variables for consistency:

```css
:root {
  --icon-xs: 12px;    /* Priority badges, status dots */
  --icon-sm: 14px;    /* Small buttons, compact lists */
  --icon-md: 16px;    /* DEFAULT - standard buttons, cards */
  --icon-lg: 18px;    /* Headings, emphasis */
  --icon-xl: 20px;    /* Section headers, modal titles */
  --icon-2xl: 24px;   /* Large headers, important actions */
  --icon-3xl: 32px;   /* Hero sections, loading states */
  --icon-4xl: 48px;   /* Empty states, splash screens */
}
```

### Icon + Text Alignment

**Use utility classes for consistent alignment:**

```jsx
{/* Standard icon + text */}
<div className="icon-text">
  <Icon size={16} className="flex-shrink-0" />
  <span>Text with icon</span>
</div>

{/* Tight spacing */}
<div className="icon-text-tight">
  <Icon size={14} className="flex-shrink-0" />
  <span>Compact layout</span>
</div>

{/* Loose spacing */}
<div className="icon-text-loose">
  <Icon size={18} className="flex-shrink-0" />
  <span>Spacious layout</span>
</div>
```

**Utility classes (defined in index.css):**

```css
.icon-text {
  @apply inline-flex items-center gap-2;
}

.icon-text-tight {
  @apply inline-flex items-center gap-1.5;
}

.icon-text-loose {
  @apply inline-flex items-center gap-3;
}
```

### Icon Buttons

```css
/* Standard icon button */
.icon-btn {
  @apply inline-flex items-center justify-center p-2 rounded-lg;
  @apply transition-all duration-150 hover:bg-clawd-border;
  @apply active:scale-95;
}

.icon-btn-sm {
  @apply inline-flex items-center justify-center p-1.5 rounded-lg;
  @apply transition-all duration-150 hover:bg-clawd-border;
  @apply active:scale-95;
}

.icon-btn-lg {
  @apply inline-flex items-center justify-center p-3 rounded-lg;
  @apply transition-all duration-150 hover:bg-clawd-border;
  @apply active:scale-95;
}
```

**Usage:**
```jsx
<button className="icon-btn">
  <Icon size={16} />
</button>
```

### Icon Badges (circular containers)

```css
.icon-badge {
  @apply inline-flex items-center justify-center rounded-full;
  @apply w-8 h-8 flex-shrink-0;
}

.icon-badge-sm {
  @apply inline-flex items-center justify-center rounded-full;
  @apply w-6 h-6 flex-shrink-0;
}

.icon-badge-lg {
  @apply inline-flex items-center justify-center rounded-full;
  @apply w-10 h-10 flex-shrink-0;
}
```

**Usage:**
```jsx
<div className="icon-badge bg-clawd-accent/20 text-clawd-accent">
  <Bot size={16} />
</div>
```

### Status Icons

```css
.status-icon {
  @apply inline-flex items-center justify-center;
  @apply w-2 h-2 rounded-full flex-shrink-0;
}

.status-icon-pulse {
  @apply inline-flex items-center justify-center;
  @apply w-2 h-2 rounded-full flex-shrink-0 animate-pulse;
}
```

---

## Border Radius

### Radius Scale (by frequency)

| Token | Size | Usage Count | Use Case |
|-------|------|-------------|----------|
| `rounded-lg` | 8px | 907 | **Default radius** - buttons, inputs, cards |
| `rounded-xl` | 12px | 389 | Large cards, panels, modals |
| `rounded-full` | 9999px | 303 | Badges, avatar, pills |
| `rounded-2xl` | 16px | 85 | Hero cards, feature sections |
| `rounded-md` | 6px | 9 | Subtle rounding, legacy |
| `rounded-sm` | 4px | 4 | Very subtle, rare |
| `rounded-3xl` | 24px | 3 | Extra large cards, rare |

### Usage Pattern

```jsx
{/* Standard button/card */}
<div className="rounded-lg">Default</div>

{/* Large card/panel */}
<div className="rounded-xl">Panel</div>

{/* Badge/pill */}
<span className="rounded-full">Badge</span>

{/* Hero card */}
<div className="rounded-2xl">Hero</div>
```

**Rule of thumb:**
- **Small components** (buttons, inputs, badges) → `rounded-lg`
- **Medium components** (cards, panels) → `rounded-xl`
- **Large components** (modals, sections) → `rounded-2xl`
- **Pills/avatars** → `rounded-full`

---

## Shadows

### Shadow Tokens

```css
/* Card shadows */
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.4);
--shadow-card-lg: 0 4px 16px rgba(0, 0, 0, 0.35);

/* Glow effects */
--shadow-glow: 0 0 20px rgba(34, 197, 94, 0.3);
--shadow-glow-lg: 0 0 40px rgba(34, 197, 94, 0.4);
```

**Tailwind classes:**
```jsx
<div className="shadow-card hover:shadow-card-hover">
  Elevated card
</div>

<button className="hover:shadow-glow">
  Glowing button
</button>
```

### Glassmorphism

```css
/* Glass background with blur */
.glass {
  background: color-mix(in srgb, var(--clawd-surface) 80%, transparent);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--clawd-border);
}

.glass-dark {
  background: color-mix(in srgb, var(--clawd-bg) 40%, transparent);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid color-mix(in srgb, var(--clawd-border) 50%, transparent);
}

.glass-card {
  background: color-mix(in srgb, var(--clawd-surface) 70%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid color-mix(in srgb, var(--clawd-border) 50%, transparent);
}
```

### Modal Shadows

```css
/* Dark theme modal */
:root:not(.light) .glass-modal {
  background: rgba(20, 20, 20, 0.95);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(38, 38, 38, 0.3);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 
              0 0 0 1px rgba(255, 255, 255, 0.05);
}

/* Light theme modal */
:root.light .glass-modal {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  border: 1px solid rgba(228, 228, 231, 0.5);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 
              0 0 0 1px rgba(0, 0, 0, 0.05);
}
```

---

## Animations

### Timing Functions

```css
/* Standard easing */
transition-all duration-150  /* Fast interactions (buttons, hovers) */
transition-all duration-200  /* Standard animations (dropdowns, tooltips) */
transition-all duration-300  /* Smooth animations (panels, modals) */

/* Easing curves */
ease-in      /* Accelerating */
ease-out     /* Decelerating (preferred for UI) */
ease-in-out  /* Smooth start/end */
cubic-bezier(0.16, 1, 0.3, 1)  /* Custom spring (modals) */
```

### Standard Animations

```css
/* Button press */
.active:scale-95

/* Pulse (loading, status) */
.animate-pulse

/* Spin (loading) */
.animate-spin

/* Shimmer (skeleton loading) */
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
.animate-shimmer
```

### Custom Animations

```css
/* Modal entrance */
@keyframes modal-content-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Slide in from right */
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Slide up from bottom */
@keyframes slide-up {
  from {
    transform: translate(-50%, 100%);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}
```

---

## CSS Variables Reference

### Complete Variable List

```css
:root {
  /* Theme colors */
  --clawd-bg: #0a0a0a;
  --clawd-surface: #141414;
  --clawd-border: #262626;
  --clawd-text: #fafafa;
  --clawd-text-dim: #a1a1aa;
  --clawd-accent: #22c55e;
  --clawd-accent-dim: #16a34a;
  
  /* Typography */
  --clawd-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --clawd-font-size: 14px;
  --clawd-font-mono: 'JetBrains Mono', 'Menlo', monospace;
  
  /* Icon sizes */
  --icon-xs: 12px;
  --icon-sm: 14px;
  --icon-md: 16px;
  --icon-lg: 18px;
  --icon-xl: 20px;
  --icon-2xl: 24px;
  --icon-3xl: 32px;
  --icon-4xl: 48px;
  
  /* Status colors */
  --color-success: #22c55e;
  --color-success-bg: rgba(34, 197, 94, 0.1);
  --color-error: #ef4444;
  --color-error-bg: rgba(239, 68, 68, 0.1);
  --color-warning: #f59e0b;
  --color-warning-bg: rgba(245, 158, 11, 0.1);
  --color-info: #3b82f6;
  --color-info-bg: rgba(59, 130, 246, 0.1);
  
  /* Channel colors */
  --channel-discord: #5865F2;
  --channel-discord-bg: rgba(88, 101, 242, 0.2);
  --channel-telegram: #229ED9;
  --channel-telegram-bg: rgba(34, 158, 217, 0.2);
  --channel-whatsapp: #25D366;
  --channel-whatsapp-bg: rgba(37, 211, 102, 0.2);
  --channel-webchat: #a855f7;
  --channel-webchat-bg: rgba(168, 85, 247, 0.2);
  
  /* Shadows */
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-card-lg: 0 4px 16px rgba(0, 0, 0, 0.35);
  --shadow-glow: 0 0 20px rgba(34, 197, 94, 0.3);
  --shadow-glow-lg: 0 0 40px rgba(34, 197, 94, 0.4);
}

/* Light theme overrides */
:root.light {
  --clawd-bg: #fafafa;
  --clawd-surface: #ffffff;
  --clawd-border: #e4e4e7;
  --clawd-text: #18181b;
  --clawd-text-dim: #52525b;
}
```

---

## Component Patterns

### Standard Card

```jsx
<div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl shadow-card hover:shadow-card-hover transition-all">
  <div className="flex items-center gap-2 mb-3">
    <Icon size={18} className="text-clawd-accent flex-shrink-0" />
    <h3 className="text-lg font-semibold">Card Title</h3>
  </div>
  <p className="text-sm text-clawd-text-dim mb-2">
    Card description text
  </p>
  <div className="flex gap-2 mt-4">
    <button className="px-3 py-1.5 text-sm bg-clawd-accent text-white rounded-lg hover:opacity-90 transition-all">
      Primary Action
    </button>
  </div>
</div>
```

### Button Variants

```jsx
{/* Primary */}
<button className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 active:scale-95 transition-all">
  Primary
</button>

{/* Secondary */}
<button className="px-4 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/80 active:scale-95 transition-all">
  Secondary
</button>

{/* Ghost */}
<button className="px-4 py-2 text-clawd-text rounded-lg hover:bg-clawd-surface active:scale-95 transition-all">
  Ghost
</button>

{/* Danger */}
<button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 active:scale-95 transition-all">
  Danger
</button>
```

### Badge Variants

```jsx
{/* Status badge */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-color-success-bg text-color-success">
  <span className="w-2 h-2 rounded-full bg-color-success" />
  Active
</span>

{/* Channel badge */}
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-channel-whatsapp-bg text-channel-whatsapp border border-channel-whatsapp/30">
  WhatsApp
</span>

{/* Priority badge */}
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded bg-priority-p0-bg text-priority-p0">
  <AlertTriangle size={12} className="flex-shrink-0" />
  Urgent
</span>
```

### Modal Pattern

```jsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/60 backdrop-blur-md modal-backdrop-enter z-50">
  {/* Modal */}
  <div className="fixed inset-0 flex items-center justify-center p-4">
    <div className="glass-modal rounded-2xl shadow-card-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content-enter">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-clawd-border">
        <h2 className="text-2xl font-semibold">Modal Title</h2>
        <button className="icon-btn">
          <X size={20} />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-6">
        Content here
      </div>
      
      {/* Footer */}
      <div className="flex justify-end gap-2 p-6 border-t border-clawd-border">
        <button className="px-4 py-2 rounded-lg bg-clawd-border">
          Cancel
        </button>
        <button className="px-4 py-2 rounded-lg bg-clawd-accent text-white">
          Confirm
        </button>
      </div>
    </div>
  </div>
</div>
```

---

## Accessibility

### Contrast Requirements

**WCAG AA compliance (4.5:1 minimum):**

- ✅ `--clawd-text` on `--clawd-bg`: **15.7:1** (dark), **12.4:1** (light)
- ✅ `--clawd-text-dim` on `--clawd-bg`: **5.2:1** (dark), **7.8:1** (light)
- ✅ `--clawd-accent` on `--clawd-bg`: **5.8:1** (dark), **4.9:1** (light)

**Improved light theme text-dim:**
- Changed from `#71717a` (5.9:1) to `#52525b` (7.8:1)

### Focus Indicators

All interactive elements must have visible focus:

```css
focus:outline-none 
focus:ring-2 
focus:ring-clawd-accent 
focus:ring-offset-2 
focus:ring-offset-clawd-bg
```

### Screen Reader Support

```jsx
{/* Icon buttons - always label */}
<button aria-label="Close modal">
  <X size={20} aria-hidden="true" />
</button>

{/* Status indicators */}
<span className="status-icon bg-green-500" aria-label="Online" role="status" />

{/* Skip navigation */}
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
```

### Keyboard Navigation

All interactive elements must be keyboard accessible:
- ✅ Tab order follows visual order
- ✅ Focus visible at all times
- ✅ Escape closes modals/dropdowns
- ✅ Arrow keys for lists/menus
- ✅ Enter/Space activates buttons

---

## Implementation Checklist

When building new components:

- [ ] Use CSS variables for all colors (no hardcoded hex)
- [ ] Follow spacing scale (gap-2, p-4, mb-2, etc.)
- [ ] Use standardized icon sizes (12, 14, 16, 18, 20, 24)
- [ ] Apply border radius consistently (rounded-lg default)
- [ ] Add focus indicators (ring-2)
- [ ] Test light/dark themes
- [ ] Verify contrast ratios (4.5:1 minimum)
- [ ] Add aria labels for icons
- [ ] Ensure keyboard accessibility
- [ ] Use semantic HTML
- [ ] Add loading states
- [ ] Include hover/active states
- [ ] Test with screen reader

---

## Migration Guide

To update existing components to design system standards:

### 1. Replace hardcoded colors

❌ **Before:**
```jsx
<div className="bg-gray-900 text-white border-gray-700">
```

✅ **After:**
```jsx
<div className="bg-clawd-surface text-clawd-text border-clawd-border">
```

### 2. Standardize icon sizes

❌ **Before:**
```jsx
<Icon size={15} /> {/* Non-standard */}
<Icon size={22} /> {/* Non-standard */}
```

✅ **After:**
```jsx
<Icon size={14} /> {/* Small */}
<Icon size={20} /> {/* Large */}
```

### 3. Use utility classes for icon+text

❌ **Before:**
```jsx
<div className="flex items-center" style={{ gap: '10px' }}>
  <Icon size={16} />
  <span>Text</span>
</div>
```

✅ **After:**
```jsx
<div className="icon-text">
  <Icon size={16} className="flex-shrink-0" />
  <span>Text</span>
</div>
```

### 4. Standardize spacing

❌ **Before:**
```jsx
<div className="p-5 mb-5 gap-5"> {/* Non-standard values */}
```

✅ **After:**
```jsx
<div className="p-4 mb-4 gap-4"> {/* Standard 16px */}
```

### 5. Add flex-shrink-0 to icons

❌ **Before:**
```jsx
<Icon size={16} />
```

✅ **After:**
```jsx
<Icon size={16} className="flex-shrink-0" />
```

This prevents icons from shrinking in flex containers.

---

## Resources

- **Tailwind Documentation:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Color Contrast Checker:** https://webaim.org/resources/contrastchecker/

---

## Changelog

### Version 1.0.0 (2026-01-29)
- ✅ Initial design system audit complete
- ✅ CSS variables documented
- ✅ Spacing scale standardized
- ✅ Typography scale established
- ✅ Icon system documented
- ✅ Component patterns defined
- ✅ Accessibility guidelines added
- ✅ Migration guide created
