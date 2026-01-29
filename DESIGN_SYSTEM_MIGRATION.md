# Design System Migration Guide

Step-by-step guide for implementing the new design system standards in the Froggo Dashboard.

---

## Overview

This guide helps you migrate components to use the new design system standards established in the audit.

**Goal:** Consistent, accessible, maintainable UI components using standardized tokens.

---

## Quick Start (5 minutes)

### Option A: Use design-tokens.css (Recommended)

Replace existing CSS variables in `index.css` with the comprehensive design-tokens.css:

```bash
# 1. Import design-tokens.css at the top of index.css
# Add after accessibility.css and before Tailwind directives

@import './design-tokens.css';
```

**Benefits:**
- ✅ More comprehensive token set (26 colors vs 16)
- ✅ Icon size tokens included
- ✅ Animation timing standards
- ✅ Z-index layers defined
- ✅ Accessibility utilities built-in
- ✅ Print styles included

### Option B: Keep existing index.css

Continue using current setup and selectively adopt patterns:

```bash
# No changes needed
# Reference DESIGN_SYSTEM.md for token usage
```

**Benefits:**
- ✅ No immediate changes required
- ✅ Gradual adoption possible
- ✅ Less risk of breaking changes

---

## Migration Steps

### Step 1: Understand Current State

**What's working well:**
- ✅ Spacing is 88-95% consistent
- ✅ Typography well established
- ✅ Icon sizes mostly standard
- ✅ Theme switching functional

**What needs improvement:**
- ⚠️ Some hardcoded colors remain
- ⚠️ Some non-standard icon sizes (15px, 22px)
- ⚠️ Inconsistent use of utility classes
- ⚠️ Some missing aria labels

### Step 2: Choose Migration Strategy

#### Strategy A: Component-by-Component (Recommended)
Migrate one component at a time, test thoroughly, commit.

**Pros:**
- Low risk
- Easy to rollback
- Incremental progress

**Cons:**
- Takes longer
- Temporary inconsistency

#### Strategy B: Bulk Migration
Migrate many components at once using find/replace.

**Pros:**
- Fast results
- Consistent from day one

**Cons:**
- High risk
- Hard to debug issues
- More testing required

### Step 3: Set Up Development Environment

```bash
# 1. Create a feature branch
git checkout -b design-system-migration

# 2. Install dependencies (if needed)
npm install

# 3. Start dev server
npm run dev

# 4. Keep design system docs open
open DESIGN_SYSTEM.md
open DESIGN_SYSTEM_QUICKSTART.md
```

---

## Migration Patterns

### Pattern 1: Colors

#### Find
```bash
# Find hardcoded Tailwind colors
grep -rn "bg-gray-\|text-gray-\|border-gray-" src/components/
```

#### Replace
```jsx
// ❌ Before
<div className="bg-gray-900 border-gray-800">
  <p className="text-gray-300">Text</p>
</div>

// ✅ After
<div className="bg-clawd-surface border-clawd-border">
  <p className="text-clawd-text-dim">Text</p>
</div>
```

#### Test
- [ ] Component looks correct in dark theme
- [ ] Component looks correct in light theme
- [ ] No contrast issues

---

### Pattern 2: Icon Sizes

#### Find
```bash
# Find non-standard icon sizes
grep -rn "size={[^1][^2468]}\|size={1[^02468]}\|size={2[^024]}" src/components/
```

#### Replace
```jsx
// ❌ Before (non-standard size)
<Icon size={15} />
<Icon size={22} />

// ✅ After (standard size)
<Icon size={16} className="flex-shrink-0" />
<Icon size={20} className="flex-shrink-0" />
```

#### Test
- [ ] Icon aligns properly with text
- [ ] Icon doesn't shrink in flex containers
- [ ] Visual size looks appropriate

---

### Pattern 3: Spacing

#### Find
```bash
# Find non-standard spacing
grep -rn "gap-[57]\|p-[57]\|m-[57]" src/components/
```

#### Replace
```jsx
// ❌ Before (non-standard)
<div className="gap-5 p-5 mb-5">

// ✅ After (standard)
<div className="gap-4 p-4 mb-4">
```

#### Test
- [ ] Layout looks correct
- [ ] Spacing feels consistent
- [ ] No layout breaks

---

### Pattern 4: Icon Buttons

#### Find
```bash
# Find buttons with icons but no aria-label
grep -rn "<button.*<.*Icon\|<button.*size=" src/components/ | grep -v "aria-label"
```

#### Replace
```jsx
// ❌ Before
<button className="p-2 rounded hover:bg-gray-800">
  <Settings size={20} />
</button>

// ✅ After
<button className="icon-btn" aria-label="Open settings">
  <Settings size={20} aria-hidden="true" />
</button>
```

#### Test
- [ ] Button works with keyboard
- [ ] Screen reader announces label
- [ ] Focus visible on tab

---

### Pattern 5: Icon + Text

#### Find
```bash
# Find flex containers with icons
grep -rn "flex.*Icon\|Icon.*flex" src/components/
```

#### Replace
```jsx
// ❌ Before
<div className="flex items-center" style={{ gap: '10px' }}>
  <Icon size={16} />
  <span>Text</span>
</div>

// ✅ After
<div className="icon-text">
  <Icon size={16} className="flex-shrink-0" />
  <span>Text</span>
</div>
```

#### Test
- [ ] Icon and text align properly
- [ ] Spacing looks correct
- [ ] Icon doesn't shrink

---

## Component Checklist

Use this checklist when migrating a component:

```markdown
Component: _________________

- [ ] **Colors**
  - [ ] No hardcoded grays (bg-gray-*, text-gray-*)
  - [ ] Uses CSS variables (bg-clawd-*)
  - [ ] Status colors use --color-* tokens
  - [ ] Channel colors use --channel-* tokens

- [ ] **Icons**
  - [ ] All icons use standard sizes (12,14,16,18,20,24,32,48)
  - [ ] All icons have flex-shrink-0 in flex containers
  - [ ] Icon buttons have aria-label
  - [ ] Decorative icons have aria-hidden="true"

- [ ] **Spacing**
  - [ ] Uses spacing scale (gap-2, p-4, mb-2, etc.)
  - [ ] No custom gap/padding values (gap-5, p-7, etc.)
  - [ ] Consistent spacing throughout

- [ ] **Typography**
  - [ ] Uses standard text sizes (text-sm default)
  - [ ] Font weights appropriate (medium for emphasis)
  - [ ] Line heights not overridden

- [ ] **Accessibility**
  - [ ] All interactive elements keyboard accessible
  - [ ] Focus states visible
  - [ ] Aria labels on icon buttons
  - [ ] Color contrast meets 4.5:1 minimum

- [ ] **Testing**
  - [ ] Tested in dark theme
  - [ ] Tested in light theme
  - [ ] Tested with keyboard
  - [ ] Visual regression check
  - [ ] Unit tests updated
```

---

## Component Examples

### Example 1: Button Migration

**Before:**
```jsx
function MyButton({ onClick, children }) {
  return (
    <button 
      onClick={onClick}
      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
    >
      {children}
    </button>
  );
}
```

**After:**
```jsx
function MyButton({ onClick, children }) {
  return (
    <button 
      onClick={onClick}
      className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 active:scale-95 transition-all"
    >
      {children}
    </button>
  );
}
```

**Changes:**
- ✅ `bg-green-500` → `bg-clawd-accent` (theme-aware)
- ✅ `hover:bg-green-600` → `hover:opacity-90` (consistent)
- ✅ Added `active:scale-95` (feedback)
- ✅ Added `transition-all` (smooth)

---

### Example 2: Card Migration

**Before:**
```jsx
function TaskCard({ task }) {
  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
      <div className="flex items-center mb-2" style={{ gap: '8px' }}>
        <CheckCircle size={18} />
        <h3 className="text-lg font-semibold">{task.title}</h3>
      </div>
      <p className="text-sm text-gray-400">{task.description}</p>
    </div>
  );
}
```

**After:**
```jsx
function TaskCard({ task }) {
  return (
    <div className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
      <div className="icon-text mb-2">
        <CheckCircle size={18} className="flex-shrink-0" />
        <h3 className="text-lg font-semibold">{task.title}</h3>
      </div>
      <p className="text-sm text-clawd-text-dim">{task.description}</p>
    </div>
  );
}
```

**Changes:**
- ✅ `bg-gray-800` → `bg-clawd-surface` (theme-aware)
- ✅ `border-gray-700` → `border-clawd-border` (theme-aware)
- ✅ `flex items-center` + inline style → `icon-text` (utility)
- ✅ Added `flex-shrink-0` to icon
- ✅ `text-gray-400` → `text-clawd-text-dim` (theme-aware)

---

### Example 3: Icon Button Migration

**Before:**
```jsx
function CloseButton({ onClose }) {
  return (
    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded">
      <X size={20} />
    </button>
  );
}
```

**After:**
```jsx
function CloseButton({ onClose }) {
  return (
    <button 
      onClick={onClose} 
      className="icon-btn"
      aria-label="Close"
    >
      <X size={20} aria-hidden="true" />
    </button>
  );
}
```

**Changes:**
- ✅ Custom classes → `icon-btn` utility
- ✅ Added `aria-label` (accessibility)
- ✅ Added `aria-hidden="true"` to icon

---

## Testing Strategy

### Visual Testing
```bash
# 1. Start dev server
npm run dev

# 2. Navigate to component
# 3. Test both themes
# 4. Check different screen sizes
# 5. Verify spacing and alignment
```

### Automated Testing
```bash
# Run unit tests
npm test

# Run visual regression tests (if available)
npm run test:visual

# Run accessibility tests
npm run test:a11y
```

### Manual Testing Checklist
- [ ] Works in dark theme
- [ ] Works in light theme
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Focus visible
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Mobile responsive

---

## Common Issues & Solutions

### Issue 1: Theme not applying
**Symptom:** Component doesn't change with theme switch

**Solution:**
```jsx
// ❌ Wrong - hardcoded color
<div className="bg-gray-900">

// ✅ Correct - theme variable
<div className="bg-clawd-surface">
```

---

### Issue 2: Icon misalignment
**Symptom:** Icon shrinks or misaligns with text

**Solution:**
```jsx
// ❌ Wrong - icon can shrink
<Icon size={16} />

// ✅ Correct - icon maintains size
<Icon size={16} className="flex-shrink-0" />
```

---

### Issue 3: Spacing looks off
**Symptom:** Spacing doesn't match design

**Solution:**
```jsx
// ❌ Wrong - non-standard value
<div className="gap-5">

// ✅ Correct - standard value
<div className="gap-4">
```

---

### Issue 4: Screen reader can't read button
**Symptom:** Icon button has no accessible label

**Solution:**
```jsx
// ❌ Wrong - no label
<button><Icon size={16} /></button>

// ✅ Correct - has label
<button aria-label="Action name">
  <Icon size={16} aria-hidden="true" />
</button>
```

---

## Getting Help

### Resources
- **Main docs:** `DESIGN_SYSTEM.md`
- **Quick reference:** `DESIGN_SYSTEM_QUICKSTART.md`
- **Examples:** `COMPONENT_LIBRARY.md`
- **Checklist:** `IMPLEMENTATION_CHECKLIST.md`

### Review Process
1. Self-review using component checklist
2. Test in both themes
3. Run automated tests
4. Create PR with screenshots
5. Request design system review

---

## Success Metrics

Track these to measure migration success:

- **Color tokens:** % components using CSS variables
- **Icon sizes:** % icons using standard sizes
- **Accessibility:** % interactive elements with labels
- **Spacing:** % using scale values
- **Tests:** % tests passing

**Target:** 95%+ compliance across all metrics

---

## Timeline

### Week 1: Foundation
- Import design-tokens.css
- Share docs with team
- Start with high-priority components

### Weeks 2-3: Core Components
- Migrate buttons, cards, badges
- Add utility classes
- Update tests

### Week 4: Color Migration
- Replace hardcoded colors
- Test theme switching
- Fix contrast issues

### Weeks 5-6: Polish
- Accessibility improvements
- Documentation updates
- Final testing

---

**Status:** Ready to begin  
**Last Updated:** 2026-01-29  
**Questions?** See design system documentation
