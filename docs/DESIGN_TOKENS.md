# Design Tokens Usage Guide

**Froggo Dashboard Design System**  
**Version:** 1.0.0  
**Last Updated:** 2026-01-29

## Overview

This guide explains how to use the Froggo Dashboard design tokens system. Design tokens are the single source of truth for all design values (spacing, colors, typography, etc.) across the application.

**Benefits:**
- ✅ Consistency across all components
- ✅ Easier maintenance (change once, update everywhere)
- ✅ Better developer experience with semantic naming
- ✅ Automatic theme support
- ✅ Type-safe with CSS variables

---

## Quick Start

### Import Tokens

Tokens are automatically imported in `src/index.css`:

```css
/* src/index.css */
@import './design-system/tokens.css';  /* Import FIRST */
@import './accessibility.css';
@import './forms.css';
@import './text-utilities.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Using Tokens in CSS

```css
.my-component {
  /* ✅ Use design tokens */
  padding: var(--spacing-card);
  gap: var(--space-2);
  border-radius: var(--radius-card);
  background: var(--color-success-bg);
  color: var(--color-success-text);
  transition: var(--transition-hover);
}

/* ❌ Don't hard-code values */
.bad-component {
  padding: 16px;  /* Hard-coded - bad! */
  gap: 8px;       /* Hard-coded - bad! */
}
```

### Using Tokens in Tailwind Classes

Some tokens map directly to Tailwind utilities:

```tsx
// ✅ Spacing with Tailwind
<div className="p-4 gap-2 rounded-lg">  {/* Uses Tailwind defaults */}

// ✅ Or use custom properties
<div style={{ 
  padding: 'var(--spacing-card)',
  gap: 'var(--space-2)',
  borderRadius: 'var(--radius-card)'
}}>

// ❌ Don't use arbitrary values
<div className="p-[16px] gap-[8px]">  {/* Bad - not in design system */}
```

---

## 1. Spacing Tokens

### Scale

```css
--space-0:    0       /* No spacing */
--space-1:    4px     /* Minimal */
--space-1-5:  6px     /* Tight */
--space-2:    8px     /* Compact */
--space-3:    12px    /* Normal */
--space-4:    16px    /* Comfortable (default) */
--space-6:    24px    /* Loose */
--space-8:    32px    /* Spacious */
--space-12:   48px    /* Extra spacious */
```

### Semantic Spacing

```css
--spacing-card-sm:      12px   /* Small cards */
--spacing-card:         16px   /* Default cards */
--spacing-card-lg:      24px   /* Large panels */
--spacing-section:      24px   /* Between sections */
--spacing-button:       8px    /* Button padding */
--spacing-inline:       8px    /* Icon + text gap */
```

### Usage Examples

```tsx
// Card padding
<div style={{ padding: 'var(--spacing-card)' }}>
  {/* Card content */}
</div>

// Section spacing
<div style={{ marginBottom: 'var(--spacing-section)' }}>
  {/* Section content */}
</div>

// Inline elements
<div style={{ 
  display: 'flex', 
  gap: 'var(--spacing-inline)' 
}}>
  <Icon />
  <span>Text</span>
</div>
```

### When to Use Which

- **`--space-*`** - Generic spacing (use in most cases)
- **`--spacing-*`** - Semantic spacing (use when meaning matters)

```css
/* ✅ Generic spacing - flexible usage */
.container {
  padding: var(--space-4);
  gap: var(--space-2);
}

/* ✅ Semantic spacing - intent is clear */
.card {
  padding: var(--spacing-card);
}

.button {
  padding: var(--spacing-button);
}
```

---

## 2. Typography Tokens

### Font Families

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...;
--font-mono: "JetBrains Mono", "SF Mono", Menlo, Monaco, ...;
```

### Font Sizes

```css
--text-xs:    12px    /* Captions, labels */
--text-sm:    14px    /* Body small, secondary */
--text-base:  16px    /* Body text (default) */
--text-lg:    18px    /* Emphasized text */
--text-xl:    20px    /* Section headings */
--text-2xl:   24px    /* Page headings */
--text-3xl:   30px    /* Major headings */
```

### Line Heights

```css
--leading-tight:    1.25    /* Headings */
--leading-normal:   1.5     /* Body text */
--leading-relaxed:  1.625   /* Long-form content */
```

### Font Weights

```css
--font-normal:      400
--font-medium:      500
--font-semibold:    600
--font-bold:        700
```

### Usage Examples

```css
/* Heading styles */
.heading-1 {
  font-family: var(--font-sans);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
}

/* Body text */
.body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
}

/* Caption text */
.caption {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: var(--leading-normal);
}
```

---

## 3. Color Tokens

### Theme Colors (Base)

```css
--clawd-bg:         Background color (theme-aware)
--clawd-surface:    Surface/card background
--clawd-border:     Border color
--clawd-text:       Primary text
--clawd-text-dim:   Secondary text
--clawd-accent:     Accent/brand color
```

### Status Colors

Each status color has variants:

```css
/* Success */
--color-success:        #22c55e  /* Green */
--color-success-bg:     rgba(34, 197, 94, 0.1)
--color-success-border: rgba(34, 197, 94, 0.3)
--color-success-hover:  #16a34a
--color-success-text:   #22c55e

/* Error */
--color-error:          #ef4444  /* Red */
--color-error-bg:       rgba(239, 68, 68, 0.1)
--color-error-border:   rgba(239, 68, 68, 0.3)
--color-error-hover:    #dc2626
--color-error-text:     #ef4444

/* Warning */
--color-warning:        #f59e0b  /* Orange */
--color-warning-bg:     rgba(245, 158, 11, 0.1)
--color-warning-border: rgba(245, 158, 11, 0.3)
--color-warning-hover:  #d97706
--color-warning-text:   #f59e0b

/* Info */
--color-info:           #3b82f6  /* Blue */
--color-info-bg:        rgba(59, 130, 246, 0.1)
--color-info-border:    rgba(59, 130, 246, 0.3)
--color-info-hover:     #2563eb
--color-info-text:      #3b82f6
```

### Priority Colors (Tasks)

```css
--priority-p0:       #ef4444  /* Critical - Red */
--priority-p0-bg:    rgba(239, 68, 68, 0.1)
--priority-p1:       #f59e0b  /* High - Orange */
--priority-p1-bg:    rgba(245, 158, 11, 0.1)
--priority-p2:       #3b82f6  /* Medium - Blue */
--priority-p2-bg:    rgba(59, 130, 246, 0.1)
--priority-p3:       #6b7280  /* Low - Gray */
--priority-p3-bg:    rgba(107, 114, 128, 0.1)
```

### Agent Colors

```css
--agent-coder:          #3b82f6  /* Blue */
--agent-coder-bg:       rgba(59, 130, 246, 0.1)
--agent-researcher:     #8b5cf6  /* Purple */
--agent-researcher-bg:  rgba(139, 92, 246, 0.1)
--agent-writer:         #10b981  /* Green */
--agent-writer-bg:      rgba(16, 185, 129, 0.1)
--agent-chief:          #f59e0b  /* Orange */
--agent-chief-bg:       rgba(245, 158, 11, 0.1)
```

### Usage Examples

```tsx
// Status badges
<div style={{
  background: 'var(--color-success-bg)',
  color: 'var(--color-success-text)',
  border: '1px solid var(--color-success-border)'
}}>
  Success
</div>

// Error state
<div style={{
  background: 'var(--color-error-bg)',
  color: 'var(--color-error-text)'
}}>
  Error message
</div>

// Priority badge
<div style={{
  background: 'var(--priority-p0-bg)',
  color: 'var(--priority-p0)'
}}>
  P0 - Critical
</div>

// Agent badge
<div style={{
  background: 'var(--agent-coder-bg)',
  color: 'var(--agent-coder)'
}}>
  Coder Agent
</div>
```

### Migration from Tailwind Colors

```tsx
// ❌ Before (using Tailwind colors directly)
<div className="bg-green-500/20 text-green-400">Success</div>
<div className="bg-red-500/20 text-red-400">Error</div>
<div className="bg-blue-500/20 text-blue-400">Info</div>

// ✅ After (using design tokens)
<div className="bg-color-success-bg text-color-success">Success</div>
<div className="bg-color-error-bg text-color-error">Error</div>
<div className="bg-color-info-bg text-color-info">Info</div>
```

---

## 4. Border Radius Tokens

### Scale

```css
--radius-none:  0
--radius-sm:    6px     /* Tight corners (badges, chips) */
--radius-md:    8px     /* Default (buttons, inputs) */
--radius-lg:    12px    /* Cards, panels */
--radius-xl:    16px    /* Large cards */
--radius-2xl:   24px    /* Hero sections */
--radius-full:  9999px  /* Pills, avatars, circles */
```

### Semantic Radius

```css
--radius-button:  var(--radius-md)    /* Buttons */
--radius-input:   var(--radius-md)    /* Text inputs */
--radius-card:    var(--radius-lg)    /* Cards */
--radius-modal:   var(--radius-xl)    /* Modals */
--radius-badge:   var(--radius-sm)    /* Badges */
--radius-avatar:  var(--radius-full)  /* Avatars */
```

### Usage

```css
/* ✅ Use semantic tokens for clarity */
.button {
  border-radius: var(--radius-button);
}

.card {
  border-radius: var(--radius-card);
}

.avatar {
  border-radius: var(--radius-avatar);
}

/* ✅ Or use scale tokens directly */
.custom-element {
  border-radius: var(--radius-lg);
}
```

---

## 5. Component Sizing Tokens

### Buttons

```css
--button-height-sm:      32px
--button-height-md:      40px
--button-height-lg:      48px

--button-padding-x-sm:   12px
--button-padding-x-md:   16px
--button-padding-x-lg:   24px

--button-gap:            8px   /* Icon + text gap */
```

### Usage

```css
.button {
  height: var(--button-height-md);
  padding: 0 var(--button-padding-x-md);
  gap: var(--button-gap);
  border-radius: var(--radius-button);
}

.button-sm {
  height: var(--button-height-sm);
  padding: 0 var(--button-padding-x-sm);
}

.button-lg {
  height: var(--button-height-lg);
  padding: 0 var(--button-padding-x-lg);
}
```

### Cards & Modals

```css
/* Card widths */
--card-width-sm:    320px
--card-width-md:    400px
--card-width-lg:    600px
--card-width-xl:    800px

/* Modal widths */
--modal-width-sm:   400px
--modal-width-md:   600px
--modal-width-lg:   800px
--modal-width-xl:   1200px
```

### Avatars

```css
--avatar-xs:  24px
--avatar-sm:  32px
--avatar-md:  40px
--avatar-lg:  48px
--avatar-xl:  64px
```

---

## 6. Icon Sizing Tokens

### Scale

```css
--icon-xs:    12px    /* Small badges, indicators */
--icon-sm:    16px    /* Inline with text (default) */
--icon-md:    20px    /* Buttons, emphasized inline */
--icon-lg:    24px    /* Section headers, standalone */
--icon-xl:    32px    /* Large buttons, hero elements */
--icon-2xl:   48px    /* Feature sections, empty states */
--icon-3xl:   64px    /* Marketing, splash screens */
```

### Usage

```tsx
import { Icon } from 'lucide-react';

// ✅ Use design token sizes
<Icon size={16} />  {/* --icon-sm - default inline */}
<Icon size={20} />  {/* --icon-md - buttons */}
<Icon size={24} />  {/* --icon-lg - headers */}

// ❌ Don't use arbitrary sizes
<Icon size={18} />  {/* Not in design system */}
<Icon size={28} />  {/* Not in design system */}

// ✅ Or use CSS variables
<Icon style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
```

### Icon Size Guidelines

| Context | Size | Token |
|---------|------|-------|
| Inline with text | 16px | `--icon-sm` |
| Buttons (standard) | 20px | `--icon-md` |
| Section headers | 24px | `--icon-lg` |
| Large buttons | 32px | `--icon-xl` |
| Empty states | 48px | `--icon-2xl` |
| Hero sections | 64px | `--icon-3xl` |

---

## 7. Animation & Motion Tokens

### Duration

```css
--duration-instant:  50ms    /* Micro-interactions */
--duration-fast:     150ms   /* Hover, focus states */
--duration-normal:   200ms   /* Modals, dropdowns */
--duration-slow:     300ms   /* Page transitions */
--duration-slower:   500ms   /* Complex animations */
```

### Easing

```css
--ease-linear:    linear
--ease-in:        cubic-bezier(0.4, 0, 1, 1)
--ease-out:       cubic-bezier(0, 0, 0.2, 1)
--ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1)
--ease-smooth:    cubic-bezier(0.16, 1, 0.3, 1)
```

### Semantic Transitions

```css
--transition-hover:  all var(--duration-fast) var(--ease-out)
--transition-modal:  all var(--duration-normal) var(--ease-out)
--transition-slide:  transform var(--duration-normal) var(--ease-smooth)
--transition-fade:   opacity var(--duration-normal) var(--ease-out)
```

### Usage

```css
/* ✅ Use semantic transitions */
.button:hover {
  transition: var(--transition-hover);
  transform: scale(1.02);
}

.modal {
  transition: var(--transition-modal);
}

/* ✅ Or compose custom transitions */
.custom-element {
  transition-property: transform, opacity;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-out);
}

/* ✅ Or use shorthand */
.another-element {
  transition: opacity var(--duration-fast) var(--ease-out);
}
```

---

## 8. Shadow & Effects Tokens

### Shadows

```css
--shadow-xs:    0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-sm:    0 1px 3px 0 rgba(0, 0, 0, 0.1)
--shadow-md:    0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg:    0 10px 15px -3px rgba(0, 0, 0, 0.1)
--shadow-xl:    0 20px 25px -5px rgba(0, 0, 0, 0.1)
--shadow-2xl:   0 25px 50px -12px rgba(0, 0, 0, 0.25)
```

### Glows

```css
--shadow-glow-sm:  0 0 10px rgba(34, 197, 94, 0.2)
--shadow-glow:     0 0 20px rgba(34, 197, 94, 0.3)
--shadow-glow-lg:  0 0 40px rgba(34, 197, 94, 0.4)
```

### Blur

```css
--blur-sm:   4px
--blur-md:   8px
--blur-lg:   16px
--blur-xl:   24px
--blur-2xl:  40px
```

### Usage

```css
.card {
  box-shadow: var(--shadow-md);
}

.card:hover {
  box-shadow: var(--shadow-lg);
}

.glass {
  backdrop-filter: blur(var(--blur-xl));
}

.glow-button {
  box-shadow: var(--shadow-glow);
}
```

---

## 9. Z-Index Tokens

### Scale

```css
--z-base:            0
--z-dropdown:        100
--z-sticky:          200
--z-fixed:           300
--z-modal-backdrop:  400
--z-modal:           500
--z-popover:         600
--z-tooltip:         700
--z-toast:           800
--z-max:             9999
```

### Usage

```css
.dropdown {
  z-index: var(--z-dropdown);
}

.modal-backdrop {
  z-index: var(--z-modal-backdrop);
}

.modal {
  z-index: var(--z-modal);
}

.toast {
  z-index: var(--z-toast);
}
```

---

## Best Practices

### ✅ Do

- **Use semantic tokens first** (`--spacing-card` over `--space-4`)
- **Use design tokens for all values** (no hard-coded px values)
- **Stay within the defined scale** (don't use arbitrary values)
- **Document custom tokens** (if you add project-specific tokens)

### ❌ Don't

- **Don't hard-code values** (`padding: 16px` ❌)
- **Don't use arbitrary Tailwind values** (`p-[17px]` ❌)
- **Don't use Tailwind color utilities** (`text-green-400` ❌)
- **Don't create custom values outside the scale** (`gap: 13px` ❌)

---

## Migration Guide

### Step 1: Replace Hard-Coded Values

```css
/* ❌ Before */
.component {
  padding: 16px;
  gap: 8px;
  border-radius: 12px;
}

/* ✅ After */
.component {
  padding: var(--spacing-card);
  gap: var(--space-2);
  border-radius: var(--radius-card);
}
```

### Step 2: Replace Tailwind Color Utilities

```tsx
// ❌ Before
<div className="bg-green-500/20 text-green-400">

// ✅ After  
<div style={{
  background: 'var(--color-success-bg)',
  color: 'var(--color-success-text)'
}}>
```

### Step 3: Replace Icon Sizes

```tsx
// ❌ Before
<Icon size={18} />
<Icon size={28} />

// ✅ After
<Icon size={16} />  {/* --icon-sm */}
<Icon size={20} />  {/* --icon-md */}
<Icon size={24} />  {/* --icon-lg */}
```

---

## Examples

### Complete Button Component

```tsx
const Button = ({ size = 'md', variant = 'primary', children }) => {
  const style = {
    height: size === 'sm' ? 'var(--button-height-sm)' : 
            size === 'lg' ? 'var(--button-height-lg)' : 
            'var(--button-height-md)',
    padding: `0 ${size === 'sm' ? 'var(--button-padding-x-sm)' : 
                   size === 'lg' ? 'var(--button-padding-x-lg)' : 
                   'var(--button-padding-x-md)'}`,
    gap: 'var(--button-gap)',
    borderRadius: 'var(--radius-button)',
    background: variant === 'primary' ? 'var(--clawd-accent)' : 'var(--clawd-border)',
    color: variant === 'primary' ? '#fff' : 'var(--clawd-text)',
    transition: 'var(--transition-hover)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  
  return <button style={style}>{children}</button>;
};
```

### Complete Card Component

```tsx
const Card = ({ children, padding = 'md' }) => {
  const style = {
    padding: padding === 'sm' ? 'var(--spacing-card-sm)' : 
             padding === 'lg' ? 'var(--spacing-card-lg)' : 
             'var(--spacing-card)',
    borderRadius: 'var(--radius-card)',
    background: 'var(--clawd-surface)',
    border: '1px solid var(--clawd-border)',
    boxShadow: 'var(--shadow-md)',
    transition: 'var(--transition-hover)',
  };
  
  return <div style={style}>{children}</div>;
};
```

---

## FAQ

**Q: Can I use Tailwind utilities or CSS variables?**  
A: Prefer CSS variables for consistency, but Tailwind is fine for spacing/layout. Avoid Tailwind for colors.

**Q: What if I need a value not in the design system?**  
A: Use the closest value in the scale. If truly needed, propose adding it to the design system.

**Q: How do I add a custom token?**  
A: Add it to `tokens.css`, document it in this guide, and get approval from the team.

**Q: Do I need to memorize all tokens?**  
A: No! Reference this guide. Common tokens will become second nature.

**Q: What about responsive design?**  
A: Use Tailwind's responsive utilities (`sm:`, `md:`, `lg:`) for breakpoints. Tokens are breakpoint-agnostic.

---

## Resources

- **Audit Report:** `docs/DESIGN_SYSTEM_AUDIT.md`
- **Tokens File:** `src/design-system/tokens.css`
- **Tailwind Config:** `tailwind.config.js`
- **Storybook:** (Coming soon - visual token showcase)

---

**Questions?** Open an issue or ask in #frontend-dev channel.
