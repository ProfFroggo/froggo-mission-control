# Design System Implementation - Tasks to Create

**Parent Task:** task-1769809773003  
**Project:** Froggo Dashboard  
**Created:** January 30, 2026  
**Status:** Ready for Import

---

## Instructions

These tasks should be created in froggo-db and assigned to coder agents. Each task includes all necessary information for execution.

**To import:**
```bash
# Run these commands on the machine with froggo-db access
# Replace with actual froggo-db command syntax

# Phase 1: Foundation
froggo-db task-add "Design System: Consolidate Design Tokens" --description "..." --assigned-to coder --priority p0 --parent task-1769809773003
# ... etc
```

---

## Phase 1: Foundation (Week 1) - Priority P0/P1

### Task 1.1: Consolidate Design Tokens
- **Title:** Design System: Consolidate Design Tokens
- **Description:** Merge design-tokens.css and design-system/tokens.css into single source. Remove duplicates. Ensure all tokens documented. Verify light theme overrides work correctly.
- **Priority:** P0 (Critical)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Deliverables:**
  - Single consolidated design-tokens.css
  - No duplicate definitions
  - All tokens commented with usage examples
- **Files:** 
  - `src/design-tokens.css`
  - `src/design-system/tokens.css`
- **Acceptance Criteria:**
  - ✅ Only one tokens file exists
  - ✅ All tokens have documentation comments
  - ✅ Light theme overrides verified

---

### Task 1.2: Create Semantic Color Utility Classes
- **Title:** Design System: Create Semantic Color Utility Classes
- **Description:** Add utility classes for semantic colors (.text-success, .bg-error, etc.). Create status badge classes (.badge-success, .badge-error, etc.). Create priority classes (.priority-p0, .priority-p1, etc.). Must work in both dark and light themes.
- **Priority:** P0 (Critical)
- **Assigned To:** coder
- **Estimated Time:** 1 hour
- **Parent:** task-1769809773003
- **Deliverables:**
  - Semantic color utility classes
  - Badge variant classes
  - Priority level classes
- **Example Code:**
  ```css
  /* Add to design-tokens.css */
  .text-success { color: var(--color-success); }
  .text-error { color: var(--color-error); }
  .text-warning { color: var(--color-warning); }
  .text-info { color: var(--color-info); }
  
  .bg-success { background: var(--color-success-bg); }
  .bg-error { background: var(--color-error-bg); }
  
  .badge-success {
    background: var(--color-success-bg);
    color: var(--color-success);
    border: 1px solid var(--color-success-border);
  }
  
  .priority-p0 {
    background: var(--priority-p0-bg);
    color: var(--priority-p0);
  }
  ```
- **Acceptance Criteria:**
  - ✅ All semantic colors have utility classes
  - ✅ Classes work in both themes
  - ✅ Documentation updated

---

### Task 1.3: Add Focus-Visible Styles
- **Title:** Design System: Add Focus-Visible Styles
- **Description:** Add global :focus-visible styles for keyboard navigation. Create .focus-ring utility class. Update all interactive components to show focus indicators. Ensure focus ring only shows on keyboard navigation, not mouse clicks.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 1 hour
- **Parent:** task-1769809773003
- **Deliverables:**
  - Global focus-visible styles
  - Focus ring utility class
  - Updated components with focus states
- **Example Code:**
  ```css
  /* Global focus-visible */
  *:focus-visible {
    outline: 2px solid var(--clawd-accent);
    outline-offset: 2px;
  }
  
  /* Remove default outline */
  *:focus {
    outline: none;
  }
  
  /* Utility class */
  .focus-ring:focus-visible {
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  }
  ```
- **Acceptance Criteria:**
  - ✅ All buttons show focus ring on Tab
  - ✅ All inputs show focus ring on Tab
  - ✅ No focus ring on mouse click
  - ✅ Visible in both themes

---

### Task 1.4: Add Reduced Motion Support
- **Title:** Design System: Add Reduced Motion Support
- **Description:** Add @media (prefers-reduced-motion: reduce) styles to respect user accessibility preferences. Disable or minimize animations for users with motion sensitivity. Ensure WCAG compliance.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 30 minutes
- **Parent:** task-1769809773003
- **Deliverables:**
  - Reduced motion media query
  - Minimal animation durations for accessibility
- **Example Code:**
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
- **Acceptance Criteria:**
  - ✅ Animations respect reduced motion preference
  - ✅ No spinning/rotating for reduced motion users
  - ✅ Essential transitions still work (minimal duration)

---

## Phase 2: Component Standardization (Week 1-2) - Priority P1

### Task 2.1: Standardize Button Components
- **Title:** Design System: Standardize Button Components
- **Description:** Audit all button usage across all panels and modals. Replace hard-coded styles with design token classes (.btn-base, .btn-primary, etc.). Ensure consistent sizing (sm/md/lg = 32px/40px/48px). Add proper focus states. Remove all inline button styles.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Files to Update:**
  - All `*Panel.tsx` files (20+)
  - All `*Modal.tsx` files (40+)
- **Example Refactor:**
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
- **Acceptance Criteria:**
  - ✅ All buttons use .btn-base + variant
  - ✅ No inline button styles
  - ✅ Heights: 32px/40px/48px (sm/md/lg)
  - ✅ Focus-visible states work
  - ✅ Disabled states styled correctly

---

### Task 2.2: Standardize Card Components
- **Title:** Design System: Standardize Card Components
- **Description:** Audit all card usage (dashboard stats, agent cards, task cards, metric cards). Replace custom card styles with .card-base pattern. Ensure consistent internal padding (12px/16px/24px). Add proper border-radius (12px). Use .card-interactive for clickable cards.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 4 hours
- **Parent:** task-1769809773003
- **Files to Update:**
  - Dashboard stats cards
  - AgentPanel.tsx (agent cards)
  - TasksPanel.tsx (task cards)
  - AnalyticsPanel.tsx (metric cards)
- **Acceptance Criteria:**
  - ✅ All cards use .card-base or .card-glass
  - ✅ Consistent border-radius (12px)
  - ✅ Consistent internal padding
  - ✅ Interactive cards use .card-interactive

---

### Task 2.3: Standardize Form Components
- **Title:** Design System: Standardize Form Components
- **Description:** Audit all input, textarea, select elements. Replace with .input-base, .textarea-base, .select-base classes. Add proper error states (.input-error, .form-error). Ensure consistent heights (40px default). Fix placeholder colors.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Files to Update:**
  - TaskModal.tsx (form)
  - SettingsPanel.tsx (all settings forms)
  - All filter/search inputs
- **Acceptance Criteria:**
  - ✅ All inputs use design token classes
  - ✅ Consistent height (40px)
  - ✅ Error states styled consistently
  - ✅ Focus states work properly
  - ✅ Placeholder text uses --clawd-text-dim

---

### Task 2.4: Standardize Badge Components
- **Title:** Design System: Standardize Badge Components
- **Description:** Audit all badge/status indicator usage. Replace with semantic badge classes (.badge-success, .badge-error, etc.). Ensure accessibility: color + icon + text (never color alone). Make all badges pill-shaped (border-radius: full).
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Files to Update:**
  - Task status badges
  - Agent status indicators
  - Priority badges
  - Channel badges
- **Example Refactor:**
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
- **Acceptance Criteria:**
  - ✅ All badges use .badge-base + semantic variant
  - ✅ Never color alone (icon + text included)
  - ✅ Consistent pill shape

---

## Phase 3: Modal System Overhaul (Week 2) - Priority P1

### Task 3.1: Audit All Modals
- **Title:** Design System: Audit All Modals
- **Description:** Create comprehensive list of all modal components. Check which extend BaseModal vs custom structures. Document inconsistencies. Prioritize fixes.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Deliverable:** MODAL_AUDIT.md document with:
  - List of all 40+ modals
  - Status: BaseModal ✅ or Custom ❌
  - Priority for fixes
- **Acceptance Criteria:**
  - ✅ All modals documented
  - ✅ Issues identified
  - ✅ Fix priority assigned

---

### Task 3.2: Refactor Non-BaseModal Modals
- **Title:** Design System: Refactor Custom Modals to BaseModal
- **Description:** Convert all custom modal structures to use BaseModal component. Ensure consistent structure (header, content, footer). Add proper Esc key handling. Add focus trap. Ensure accessibility.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 6 hours (depends on number of custom modals)
- **Parent:** task-1769809773003
- **Prerequisite:** Task 3.1 (audit)
- **Acceptance Criteria:**
  - ✅ All modals extend BaseModal
  - ✅ Consistent padding (24px)
  - ✅ Consistent border-radius (12px)
  - ✅ Backdrop blur effect
  - ✅ Close on Esc key
  - ✅ Focus trapped inside modal
  - ✅ Return focus on close

---

### Task 3.3: Add Modal Size Variants
- **Title:** Design System: Add Modal Size Variants
- **Description:** Add size prop to BaseModal (sm/md/lg/xl). Create corresponding CSS classes (400px/600px/800px/1200px). Update modal catalog with recommended sizes for each modal type.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 1 hour
- **Parent:** task-1769809773003
- **Example:**
  ```jsx
  <BaseModal size="md" {...props}>
    {children}
  </BaseModal>
  ```
- **Acceptance Criteria:**
  - ✅ Size prop implemented
  - ✅ CSS classes for sm/md/lg/xl
  - ✅ Documentation updated

---

## Phase 4: Page-Specific Refinements (Week 2-3) - Priority P2

### Task 4.1: Dashboard Panel Polish
- **Title:** Design System: Polish Dashboard Panel
- **Description:** Refactor dashboard stats cards to use design tokens. Ensure responsive grid (4 cols → 2 cols → 1 col). Add loading skeletons. Improve empty states. Ensure keyboard navigable.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Files:** DashboardPanel.tsx (or equivalent)
- **Acceptance Criteria:**
  - ✅ Grid uses CSS Grid auto-fit
  - ✅ Cards use .card-stats pattern
  - ✅ Loading states shown
  - ✅ Empty states handled
  - ✅ Keyboard navigable

---

### Task 4.2: Inbox Three-Pane Layout
- **Title:** Design System: Refine Inbox Three-Pane Layout
- **Description:** Ensure proper three-pane structure (280px | 400px | 1fr). Add proper overflow handling for each pane. Ensure keyboard navigation (Tab, Arrow keys). Add focus management between panes.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 4 hours
- **Parent:** task-1769809773003
- **Files:** InboxPanel.tsx
- **Acceptance Criteria:**
  - ✅ Fixed left pane (280px)
  - ✅ Fixed center pane (400px)
  - ✅ Flexible right pane (1fr)
  - ✅ Each pane scrolls independently
  - ✅ Keyboard navigation works
  - ✅ Focus states visible

---

### Task 4.3: Tasks Kanban Consistency
- **Title:** Design System: Improve Tasks Kanban Consistency
- **Description:** Standardize task card design. Ensure drag-and-drop smooth. Add loading states. Improve empty states for columns. Ensure keyboard accessible.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Files:** TasksPanel.tsx or Kanban component
- **Acceptance Criteria:**
  - ✅ Task cards use consistent design
  - ✅ Drag-and-drop works smoothly
  - ✅ Loading skeletons shown
  - ✅ Empty columns have helpful empty state
  - ✅ Keyboard accessible

---

### Task 4.4: Agent Panel Card Redesign
- **Title:** Design System: Redesign Agent Panel Cards
- **Description:** Refactor agent cards to use .card-interactive. Apply agent theme colors properly. Ensure metrics display consistently. Add loading/error states.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Files:** AgentPanel.tsx
- **Acceptance Criteria:**
  - ✅ Cards use design token classes
  - ✅ Agent themes apply correctly
  - ✅ Hover states smooth
  - ✅ Loading states shown
  - ✅ Error states handled

---

### Task 4.5: Analytics Charts Theming
- **Title:** Design System: Theme Analytics Charts
- **Description:** Theme all charts for dark/light modes. Use design token colors. Ensure grid lines visible but subtle. Ensure tooltips styled consistently.
- **Priority:** P3 (Low)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Files:** AnalyticsPanel.tsx
- **Acceptance Criteria:**
  - ✅ Charts use design token colors
  - ✅ Grid lines visible but subtle
  - ✅ Tooltips styled consistently
  - ✅ Works in both themes

---

## Phase 5: Color System Migration (Week 3) - Priority P1

### Task 5.1: Replace Hard-Coded Status Colors
- **Title:** Design System: Replace Hard-Coded Status Colors
- **Description:** Find all instances of hard-coded status colors (text-red-400, bg-green-500/20, etc.). Replace with semantic classes (.text-error, .bg-success, etc.). Ensure accessibility (color + icon + text).
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Search Pattern:**
  ```bash
  grep -r "text-red-" src/components/
  grep -r "text-green-" src/components/
  grep -r "text-yellow-" src/components/
  grep -r "text-blue-" src/components/
  ```
- **Acceptance Criteria:**
  - ✅ No hard-coded text-red-* for errors
  - ✅ No hard-coded text-green-* for success
  - ✅ All use semantic classes

---

### Task 5.2: Replace Hard-Coded Priority Colors
- **Title:** Design System: Replace Hard-Coded Priority Colors
- **Description:** Replace priority colors with design tokens. Use --priority-p0/p1/p2/p3 CSS variables. Ensure consistent across all components.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Example:**
  ```jsx
  // ❌ Before
  <span className="text-red-400 bg-red-500/20">P0</span>
  
  // ✅ After
  <span className="priority-p0">P0</span>
  ```
- **Acceptance Criteria:**
  - ✅ All priority indicators use design tokens
  - ✅ Consistent across all components

---

### Task 5.3: Replace Hard-Coded Channel Colors
- **Title:** Design System: Use Channel Brand Color Tokens
- **Description:** Replace hard-coded channel colors with --channel-discord/telegram/whatsapp CSS variables. Ensure brand colors consistent across app.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 1 hour
- **Parent:** task-1769809773003
- **Acceptance Criteria:**
  - ✅ Channel badges use design token colors
  - ✅ Brand colors consistent

---

## Phase 6: Spacing Standardization (Week 3) - Priority P2

### Task 6.1: Audit Spacing Usage
- **Title:** Design System: Audit Spacing Usage
- **Description:** Find all Tailwind spacing classes (gap-2, p-4, etc.). Document which should use semantic tokens. Create SPACING_AUDIT.md.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Deliverable:** SPACING_AUDIT.md listing all spacing usage
- **Acceptance Criteria:**
  - ✅ All spacing documented
  - ✅ Recommendations made for token usage

---

### Task 6.2: Replace Tailwind Spacing with Tokens
- **Title:** Design System: Replace Common Spacing with Tokens
- **Description:** Replace common spacing patterns with semantic tokens. gap-2 → gap-[var(--spacing-inline)], p-4 → p-[var(--spacing-card)]. Keep Tailwind for one-offs.
- **Priority:** P2 (Medium)
- **Assigned To:** coder
- **Estimated Time:** 4 hours
- **Parent:** task-1769809773003
- **Prerequisite:** Task 6.1 (audit)
- **Acceptance Criteria:**
  - ✅ Card padding uses --spacing-card
  - ✅ Inline gaps use --spacing-inline
  - ✅ Section spacing uses --spacing-section

---

## Phase 7: Accessibility Verification (Week 3-4) - Priority P1

### Task 7.1: Keyboard Navigation Test
- **Title:** Design System: Test Keyboard Navigation
- **Description:** Test all interactive elements with keyboard only (Tab, Enter, Space, Esc, Arrows). Ensure logical tab order. Verify focus indicators visible. Test modal focus trapping. Document issues in KEYBOARD_NAV_REPORT.md.
- **Priority:** P1 (High)
- **Assigned To:** coder + manual testing
- **Estimated Time:** 3 hours
- **Parent:** task-1769809773003
- **Deliverable:** KEYBOARD_NAV_REPORT.md
- **Acceptance Criteria:**
  - ✅ All elements keyboard accessible
  - ✅ Tab order logical
  - ✅ Focus indicators visible
  - ✅ Modals trap focus

---

### Task 7.2: Screen Reader Test
- **Title:** Design System: Test with Screen Readers
- **Description:** Test with VoiceOver (Mac) or NVDA (Windows). Verify all ARIA labels present. Check announcements for dynamic content. Document findings in SCREEN_READER_REPORT.md.
- **Priority:** P1 (High)
- **Assigned To:** coder + manual testing
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Deliverable:** SCREEN_READER_REPORT.md
- **Acceptance Criteria:**
  - ✅ All interactive elements have labels
  - ✅ Dynamic content announced
  - ✅ Navigation makes sense

---

### Task 7.3: Color Contrast Verification
- **Title:** Design System: Verify Color Contrast Ratios
- **Description:** Use browser DevTools or online tools to check all color contrast ratios. Verify WCAG AA compliance (4.5:1 body text, 3:1 large text). Fix any failures. Document in CONTRAST_REPORT.md.
- **Priority:** P1 (High)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Deliverable:** CONTRAST_REPORT.md
- **Tools:** 
  - Chrome DevTools (Lighthouse)
  - https://webaim.org/resources/contrastchecker/
- **Acceptance Criteria:**
  - ✅ All text meets WCAG AA (4.5:1 minimum)
  - ✅ Large text meets 3:1 minimum
  - ✅ UI components meet 3:1 minimum

---

## Phase 8: Theme Testing (Week 4) - Priority P0

### Task 8.1: Light Mode Audit
- **Title:** Design System: Audit Light Mode
- **Description:** Toggle to light mode. Test every panel and modal. Screenshot every surface. Document issues in LIGHT_MODE_ISSUES.md. Save screenshots to screenshots/light-mode/ folder.
- **Priority:** P0 (Critical)
- **Assigned To:** coder
- **Estimated Time:** 4 hours
- **Parent:** task-1769809773003
- **Deliverables:**
  - screenshots/light-mode/ folder with all screenshots
  - LIGHT_MODE_ISSUES.md listing all problems
- **Acceptance Criteria:**
  - ✅ All pages screenshotted
  - ✅ All modals screenshotted
  - ✅ Issues documented

---

### Task 8.2: Dark Mode Verification
- **Title:** Design System: Verify Dark Mode After Changes
- **Description:** Verify dark mode (default) still works correctly after all changes. Screenshot every panel and modal. Compare with light mode. Save to screenshots/dark-mode/ folder.
- **Priority:** P0 (Critical)
- **Assigned To:** coder
- **Estimated Time:** 2 hours
- **Parent:** task-1769809773003
- **Deliverable:** screenshots/dark-mode/ folder
- **Acceptance Criteria:**
  - ✅ All pages screenshotted
  - ✅ All modals screenshotted
  - ✅ No regressions from changes

---

### Task 8.3: Fix Theme Issues
- **Title:** Design System: Fix All Theme Issues
- **Description:** Fix all issues found in Task 8.1 and 8.2. Re-test both themes. Update screenshots. Ensure contrast ratios pass in both themes. Ensure no visual regressions.
- **Priority:** P0 (Critical)
- **Assigned To:** coder
- **Estimated Time:** Variable (depends on issues)
- **Parent:** task-1769809773003
- **Prerequisite:** Task 8.1, 8.2
- **Acceptance Criteria:**
  - ✅ All components work in both themes
  - ✅ Contrast ratios pass WCAG AA
  - ✅ No visual regressions
  - ✅ Screenshots updated

---

## Summary Stats

- **Total Tasks:** 28
- **Priority Breakdown:**
  - P0 (Critical): 6 tasks
  - P1 (High): 14 tasks
  - P2 (Medium): 7 tasks
  - P3 (Low): 1 task
- **Estimated Total Time:** ~60 hours
- **Recommended Agents:** 3-4 coder agents working in parallel
- **Estimated Calendar Time:** 2-3 weeks with parallel work

---

## Import Instructions

To create these tasks in froggo-db on the main machine:

1. Copy this file to main machine
2. Run task creation commands (adapt to actual froggo-db syntax)
3. Set reviewerId="froggo" for all tasks (agent reviewer)
4. Verify all tasks created successfully
5. Begin spawning coder agents for Phase 1

---

**Created:** January 30, 2026  
**Status:** Ready for Import  
**Parent Task:** task-1769809773003
