# Design System Implementation Plan

**Task:** task-1769809773003  
**Created:** January 30, 2026  
**Status:** 🚧 Ready for Execution

---

## Overview

This document outlines the specific implementation tasks for applying the Froggo Dashboard Design System globally across all 20+ panels and 40+ modals.

**Approach:**
1. Audit → Identify specific issues
2. Create tasks → Break down into atomic units
3. Spawn coders → Assign to coder agents
4. Test → Verify in both themes
5. Document → Log learnings

---

## Critical Findings from Audit

### ❌ Anti-Patterns Found

1. **Mixed Token Usage**
   - Components use Tailwind (`text-red-400`) AND custom tokens (`text-clawd-text-dim`)
   - Should use ONLY design tokens for consistency

2. **Hard-Coded Colors**
   - Status colors: `text-red-400`, `bg-green-500/20` (should be `text-error`, `bg-success`)
   - Priority colors: inline hex values (should be CSS variables)

3. **Inconsistent Spacing**
   - Mix of Tailwind (`gap-2`, `p-4`) and token values
   - Should use semantic tokens (`var(--spacing-inline)`)

4. **Component Sizing Inconsistency**
   - Button heights vary (some use Tailwind h-classes, some inline styles)
   - Should use `--button-height-sm/md/lg` consistently

5. **Modal Structure Variations**
   - Some modals use `BaseModal`, some custom structures
   - All should extend `BaseModal` for consistency

6. **Accessibility Gaps**
   - Missing `focus-visible` states on many interactive elements
   - No `reduced-motion` support
   - Incomplete ARIA labels

---

## Implementation Tasks

### Phase 1: Foundation Consolidation

#### Task 1.1: Consolidate Design Tokens
**Priority:** P0 (Critical)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Merge `design-tokens.css` and `design-system/tokens.css` into single source
- Remove duplicate definitions
- Ensure all tokens are documented

**Acceptance Criteria:**
- ✅ Single `design-tokens.css` file
- ✅ No duplicate token definitions
- ✅ All tokens have comments explaining usage
- ✅ Light theme overrides verified

**Files:**
- `~/clawd/clawd-dashboard/src/design-tokens.css`
- `~/clawd/clawd-dashboard/src/design-system/tokens.css`

---

#### Task 1.2: Create Semantic Color Utility Classes
**Priority:** P0 (Critical)  
**Estimated Time:** 1 hour  
**Assigned To:** coder

**What:**
- Add utility classes for semantic colors (`.text-success`, `.bg-error`, etc.)
- Create status badge classes (`.badge-success`, `.badge-error`, etc.)
- Create priority classes (`.priority-p0`, `.priority-p1`, etc.)

**Acceptance Criteria:**
- ✅ All semantic colors have utility classes
- ✅ Classes work in both dark and light themes
- ✅ Documentation updated with examples

**Example:**
```css
/* Add to design-tokens.css */
.text-success { color: var(--color-success); }
.text-error { color: var(--color-error); }
.text-warning { color: var(--color-warning); }
.text-info { color: var(--color-info); }

.bg-success { background: var(--color-success-bg); }
.bg-error { background: var(--color-error-bg); }
/* ... etc */
```

---

#### Task 1.3: Create Focus-Visible Styles
**Priority:** P1 (High)  
**Estimated Time:** 1 hour  
**Assigned To:** coder

**What:**
- Add global `:focus-visible` styles
- Create `.focus-ring` utility class
- Update all interactive components to use focus styles

**Acceptance Criteria:**
- ✅ All buttons, inputs, links show focus ring on keyboard navigation
- ✅ Focus ring visible in both themes
- ✅ No focus ring on mouse click (only keyboard)

**Example:**
```css
/* Global focus-visible */
*:focus-visible {
  outline: 2px solid var(--clawd-accent);
  outline-offset: 2px;
}

/* Utility class */
.focus-ring:focus-visible {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
}
```

---

#### Task 1.4: Add Reduced Motion Support
**Priority:** P1 (High)  
**Estimated Time:** 30 minutes  
**Assigned To:** coder

**What:**
- Add `@media (prefers-reduced-motion)` styles
- Disable/minimize animations for users with motion sensitivity

**Acceptance Criteria:**
- ✅ All animations respect `prefers-reduced-motion`
- ✅ Transitions reduced to minimal duration
- ✅ No spinning/rotating animations for reduced motion users

**Example:**
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### Phase 2: Component Standardization

#### Task 2.1: Standardize Button Components
**Priority:** P1 (High)  
**Estimated Time:** 3 hours  
**Assigned To:** coder

**What:**
- Audit all button usage across components
- Replace hard-coded styles with design token classes
- Ensure consistent sizing (sm/md/lg)
- Add proper focus states

**Files to Update:**
- All `*Panel.tsx` files
- All `*Modal.tsx` files

**Acceptance Criteria:**
- ✅ All buttons use `.btn-base` + variant classes
- ✅ No inline styles for buttons
- ✅ Consistent heights: 32px/40px/48px
- ✅ Focus-visible states work
- ✅ Disabled states styled correctly

**Example Refactor:**
```jsx
// ❌ Before
<button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
  Save
</button>

// ✅ After
<button className="btn-base btn-primary">
  Save
</button>
```

---

#### Task 2.2: Standardize Card Components
**Priority:** P1 (High)  
**Estimated Time:** 4 hours  
**Assigned To:** coder

**What:**
- Audit all card usage
- Replace custom card styles with `.card-base` pattern
- Ensure consistent padding (12px/16px/24px)
- Add proper border-radius

**Files to Update:**
- Dashboard stats cards
- Agent cards in AgentPanel
- Task cards in Kanban
- Metric cards

**Acceptance Criteria:**
- ✅ All cards use `.card-base` or `.card-glass`
- ✅ Consistent border-radius (12px)
- ✅ Consistent internal padding
- ✅ Interactive cards use `.card-interactive`

---

#### Task 2.3: Standardize Form Components
**Priority:** P1 (High)  
**Estimated Time:** 3 hours  
**Assigned To:** coder

**What:**
- Audit all input, textarea, select elements
- Replace with `.input-base`, `.textarea-base`, `.select-base`
- Add proper error states
- Ensure consistent heights (40px default)

**Files to Update:**
- TaskModal form
- Settings forms
- All filter/search inputs

**Acceptance Criteria:**
- ✅ All inputs use design token classes
- ✅ Consistent height (40px)
- ✅ Error states styled consistently
- ✅ Focus states work properly
- ✅ Placeholder text uses `--clawd-text-dim`

---

#### Task 2.4: Standardize Badge Components
**Priority:** P2 (Medium)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Audit all badge/status indicator usage
- Replace with semantic badge classes
- Ensure color + icon + text (accessibility)

**Files to Update:**
- Task status badges
- Agent status indicators
- Priority badges
- Channel badges

**Acceptance Criteria:**
- ✅ All badges use `.badge-base` + semantic variant
- ✅ Never color alone (icon + text included)
- ✅ Consistent pill shape (border-radius: full)

**Example:**
```jsx
// ❌ Before
<span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
  Done
</span>

// ✅ After
<span className="badge-base badge-success">
  <Icon name="check-circle" />
  Done
</span>
```

---

### Phase 3: Modal System Overhaul

#### Task 3.1: Audit All Modals
**Priority:** P1 (High)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- List all modal components
- Check which extend `BaseModal`
- Identify custom modal structures
- Document inconsistencies

**Deliverable:**
- Markdown document: `MODAL_AUDIT.md`
- List of all 40+ modals
- Status of each (BaseModal ✅ or Custom ❌)
- Priority for fixes

---

#### Task 3.2: Refactor Non-BaseModal Modals
**Priority:** P1 (High)  
**Estimated Time:** 6 hours (1 hour per 10 modals)  
**Assigned To:** coder

**What:**
- Convert all custom modals to use `BaseModal`
- Ensure consistent structure (header, content, footer)
- Add proper Esc key handling
- Add focus trap

**Acceptance Criteria:**
- ✅ All modals extend `BaseModal`
- ✅ Consistent padding (24px)
- ✅ Consistent border-radius (12px)
- ✅ Backdrop blur effect
- ✅ Close on Esc key
- ✅ Focus trapped inside modal
- ✅ Return focus on close

---

#### Task 3.3: Add Modal Size Variants
**Priority:** P2 (Medium)  
**Estimated Time:** 1 hour  
**Assigned To:** coder

**What:**
- Add size prop to `BaseModal` (sm/md/lg/xl)
- Create corresponding CSS classes
- Update modal catalog with recommended sizes

**Example:**
```jsx
<BaseModal size="md" {...props}>
  {children}
</BaseModal>
```

---

### Phase 4: Page-Specific Refinements

#### Task 4.1: Dashboard Panel Polish
**Priority:** P2 (Medium)  
**Estimated Time:** 3 hours  
**Assigned To:** coder

**What:**
- Refactor stats cards to use design tokens
- Ensure responsive grid (4 cols → 2 cols → 1 col)
- Add loading skeletons
- Ensure accessibility

**Files:**
- `src/components/DashboardPanel.tsx` (or wherever dashboard lives)

**Acceptance Criteria:**
- ✅ Grid uses CSS Grid with auto-fit
- ✅ Cards use `.card-stats` pattern
- ✅ Loading states shown
- ✅ Empty states handled
- ✅ Keyboard navigable

---

#### Task 4.2: Inbox Three-Pane Layout
**Priority:** P2 (Medium)  
**Estimated Time:** 4 hours  
**Assigned To:** coder

**What:**
- Ensure three-pane structure (280px | 400px | 1fr)
- Add proper overflow handling
- Ensure keyboard navigation (Tab, Arrow keys)
- Add focus management

**Files:**
- `src/components/InboxPanel.tsx`

**Acceptance Criteria:**
- ✅ Fixed left pane (280px)
- ✅ Fixed center pane (400px)
- ✅ Flexible right pane (1fr)
- ✅ Each pane scrolls independently
- ✅ Keyboard navigation works
- ✅ Focus states visible

---

#### Task 4.3: Tasks Kanban Consistency
**Priority:** P2 (Medium)  
**Estimated Time:** 3 hours  
**Assigned To:** coder

**What:**
- Standardize task card design
- Ensure drag-and-drop works
- Add loading states
- Improve empty states

**Files:**
- `src/components/TasksPanel.tsx` or Kanban component

**Acceptance Criteria:**
- ✅ Task cards use consistent design
- ✅ Drag-and-drop smooth
- ✅ Loading skeletons shown
- ✅ Empty columns have helpful empty state
- ✅ Keyboard accessible (Tab to navigate, Enter to open)

---

#### Task 4.4: Agent Panel Card Redesign
**Priority:** P2 (Medium)  
**Estimated Time:** 3 hours  
**Assigned To:** coder

**What:**
- Refactor agent cards to use `.card-interactive`
- Add agent theme colors properly
- Ensure metrics display consistently
- Add loading/error states

**Files:**
- `src/components/AgentPanel.tsx`

**Acceptance Criteria:**
- ✅ Cards use design token classes
- ✅ Agent themes apply correctly
- ✅ Hover states smooth
- ✅ Loading states shown
- ✅ Error states handled

---

#### Task 4.5: Analytics Charts Theming
**Priority:** P3 (Low)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Theme all charts for dark/light modes
- Use design token colors
- Ensure readability

**Files:**
- `src/components/AnalyticsPanel.tsx`

**Acceptance Criteria:**
- ✅ Charts use design token colors
- ✅ Grid lines visible but subtle
- ✅ Tooltips styled consistently
- ✅ Works in both themes

---

### Phase 5: Color System Migration

#### Task 5.1: Replace Hard-Coded Colors - Status Indicators
**Priority:** P1 (High)  
**Estimated Time:** 3 hours  
**Assigned To:** coder

**What:**
- Find all instances of hard-coded status colors
- Replace with semantic classes

**Search & Replace:**
```bash
# Find all hard-coded reds (errors)
grep -r "text-red-" src/components/

# Replace with semantic class
text-red-400 → text-error
bg-red-500/20 → bg-error

# Repeat for green (success), yellow (warning), blue (info)
```

**Acceptance Criteria:**
- ✅ No hard-coded `text-red-*` for errors
- ✅ No hard-coded `text-green-*` for success
- ✅ All use semantic classes

---

#### Task 5.2: Replace Hard-Coded Colors - Priority Levels
**Priority:** P1 (High)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Replace priority colors with design tokens
- Use `--priority-p0/p1/p2/p3` variables

**Example:**
```jsx
// ❌ Before
<span className="text-red-400 bg-red-500/20">P0</span>

// ✅ After
<span className="priority-p0">P0</span>
```

**Acceptance Criteria:**
- ✅ All priority indicators use design tokens
- ✅ Consistent across all components

---

#### Task 5.3: Replace Hard-Coded Colors - Channel Brands
**Priority:** P2 (Medium)  
**Estimated Time:** 1 hour  
**Assigned To:** coder

**What:**
- Use `--channel-discord/telegram/whatsapp` variables
- Ensure brand colors respect design system

**Acceptance Criteria:**
- ✅ Channel badges use design token colors
- ✅ Brand colors consistent across app

---

### Phase 6: Spacing Standardization

#### Task 6.1: Audit Spacing Usage
**Priority:** P2 (Medium)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Find all Tailwind spacing classes (`gap-2`, `p-4`, etc.)
- Document which should use semantic tokens

**Deliverable:**
- `SPACING_AUDIT.md` listing all spacing usage

---

#### Task 6.2: Replace Tailwind Spacing with Tokens
**Priority:** P2 (Medium)  
**Estimated Time:** 4 hours  
**Assigned To:** coder

**What:**
- Replace common spacing with semantic tokens
- `gap-2` → `gap-[var(--spacing-inline)]`
- `p-4` → `p-[var(--spacing-card)]`

**Note:** May keep Tailwind for one-offs, but common patterns should use tokens

**Acceptance Criteria:**
- ✅ Card padding uses `--spacing-card`
- ✅ Inline gaps use `--spacing-inline`
- ✅ Section spacing uses `--spacing-section`

---

### Phase 7: Accessibility Verification

#### Task 7.1: Keyboard Navigation Test
**Priority:** P1 (High)  
**Estimated Time:** 3 hours  
**Assigned To:** coder + manual testing

**What:**
- Test all interactive elements with keyboard only
- Ensure logical tab order
- Verify focus indicators
- Test modal focus trapping

**Deliverable:**
- `KEYBOARD_NAV_REPORT.md` documenting issues found

---

#### Task 7.2: Screen Reader Test
**Priority:** P1 (High)  
**Estimated Time:** 2 hours  
**Assigned To:** coder + manual testing

**What:**
- Test with VoiceOver (Mac) or NVDA (Windows)
- Verify all ARIA labels
- Check announcements for dynamic content

**Deliverable:**
- `SCREEN_READER_REPORT.md` with findings

---

#### Task 7.3: Color Contrast Verification
**Priority:** P1 (High)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Use browser DevTools to check contrast ratios
- Verify WCAG AA compliance (4.5:1 body text, 3:1 large text)
- Fix any failures

**Deliverable:**
- `CONTRAST_REPORT.md` with all ratios documented

---

### Phase 8: Theme Testing

#### Task 8.1: Light Mode Audit
**Priority:** P0 (Critical)  
**Estimated Time:** 4 hours  
**Assigned To:** coder

**What:**
- Toggle to light mode
- Test every page
- Screenshot every panel and modal
- Document issues

**Deliverable:**
- Folder: `screenshots/light-mode/`
- `LIGHT_MODE_ISSUES.md` listing all problems

---

#### Task 8.2: Dark Mode Verification
**Priority:** P0 (Critical)  
**Estimated Time:** 2 hours  
**Assigned To:** coder

**What:**
- Verify dark mode (default) still works after changes
- Screenshot every panel and modal
- Compare with light mode screenshots

**Deliverable:**
- Folder: `screenshots/dark-mode/`

---

#### Task 8.3: Fix Theme Issues
**Priority:** P0 (Critical)  
**Estimated Time:** Variable (depends on issues found)  
**Assigned To:** coder

**What:**
- Fix all issues found in 8.1 and 8.2
- Re-test both themes
- Update screenshots

**Acceptance Criteria:**
- ✅ All components work in both themes
- ✅ Contrast ratios pass in both themes
- ✅ No visual regressions

---

## Task Assignment Strategy

### Parallel Track 1: Foundation (Week 1)
- Task 1.1, 1.2, 1.3, 1.4 (Phase 1)
- Spawn: **1 coder agent** (foundation work)

### Parallel Track 2: Components (Week 1-2)
- Task 2.1, 2.2, 2.3, 2.4 (Phase 2)
- Spawn: **2 coder agents** (can work in parallel on different component types)

### Parallel Track 3: Modals (Week 2)
- Task 3.1, 3.2, 3.3 (Phase 3)
- Spawn: **1 coder agent** (modal specialist)

### Parallel Track 4: Pages (Week 2-3)
- Task 4.1, 4.2, 4.3, 4.4, 4.5 (Phase 4)
- Spawn: **2 coder agents** (different pages in parallel)

### Parallel Track 5: Color/Spacing (Week 3)
- Task 5.1, 5.2, 5.3, 6.1, 6.2 (Phase 5-6)
- Spawn: **1 coder agent** (global find/replace work)

### Parallel Track 6: Accessibility (Week 3-4)
- Task 7.1, 7.2, 7.3 (Phase 7)
- Spawn: **1 coder agent** + manual testing

### Parallel Track 7: Theme Testing (Week 4)
- Task 8.1, 8.2, 8.3 (Phase 8)
- Spawn: **1 coder agent** (screenshot + fix)

---

## Testing & Verification Workflow

### For Each Completed Task:

1. **Code Review**
   - Designer (me) reviews code changes
   - Verify design token usage
   - Check for hard-coded values

2. **Visual Test**
   - Screenshot in dark mode
   - Screenshot in light mode
   - Compare with style guide examples

3. **Accessibility Test**
   - Keyboard navigation
   - Screen reader announcement
   - Color contrast check

4. **Sign-off**
   - Task marked complete in Kanban
   - Screenshots added to evidence folder
   - Learning logged in DESIGNER_LEARNING_LOG.md

---

## Screenshot Organization

```
screenshots/
├── dark-mode/
│   ├── dashboard.png
│   ├── inbox.png
│   ├── tasks.png
│   ├── agents.png
│   ├── analytics.png
│   ├── modals/
│   │   ├── task-modal.png
│   │   ├── agent-detail-modal.png
│   │   └── ...
├── light-mode/
│   ├── dashboard.png
│   ├── inbox.png
│   ├── tasks.png
│   ├── agents.png
│   ├── analytics.png
│   ├── modals/
│   │   ├── task-modal.png
│   │   ├── agent-detail-modal.png
│   │   └── ...
└── comparisons/
    ├── dashboard-comparison.png (side-by-side)
    ├── inbox-comparison.png
    └── ...
```

---

## Success Criteria

### Definition of Done (All Phases)

- ✅ All 20+ panels use design system consistently
- ✅ All 40+ modals extend BaseModal with consistent structure
- ✅ No hard-coded colors (all use design tokens)
- ✅ No hard-coded spacing (common patterns use semantic tokens)
- ✅ All components tested in light AND dark modes
- ✅ All components keyboard accessible
- ✅ WCAG 2.1 AA compliance verified
- ✅ Screenshots captured for all major surfaces
- ✅ DESIGNER_LEARNING_LOG.md updated with learnings

---

## Timeline Estimate

**Total Estimated Time:** ~60 hours  
**With 3-4 parallel coder agents:** 2-3 weeks  
**With full-time focus:** 1.5 weeks

**Breakdown:**
- Phase 1 (Foundation): 4.5 hours
- Phase 2 (Components): 12 hours
- Phase 3 (Modals): 9 hours
- Phase 4 (Pages): 15 hours
- Phase 5 (Color): 6 hours
- Phase 6 (Spacing): 6 hours
- Phase 7 (Accessibility): 7 hours
- Phase 8 (Theme Testing): 10+ hours

---

## Next Steps

1. ✅ Style guide created
2. ✅ Learning log initialized
3. ✅ Implementation plan documented
4. ⏳ **Create Kanban tasks for each implementation task**
5. ⏳ **Spawn coder agents** (3-4 in parallel)
6. ⏳ **Monitor progress** and provide design direction
7. ⏳ **Review deliverables** against style guide
8. ⏳ **Capture screenshots** for both themes
9. ⏳ **Document learnings** in learning log
10. ⏳ **Report completion** to main agent

---

**Created:** January 30, 2026  
**Last Updated:** January 30, 2026  
**Status:** 📋 Ready for Task Creation
