# Design System Migration Plan

**Project:** Froggo Dashboard Design System Standardization  
**Task ID:** task-1769688719100  
**Start Date:** 2026-01-29  
**Estimated Completion:** 5 weeks

---

## Overview

This document outlines the step-by-step plan to migrate the Froggo Dashboard from its current inconsistent design implementation to a standardized, token-based design system.

**Goal:** Achieve visual consistency, improve developer experience, and create a maintainable design foundation.

---

## Migration Phases

### Phase 1: Foundation Setup ✅ COMPLETE
**Duration:** 1 week (Week of 2026-01-29)  
**Status:** ✅ Complete

#### Deliverables
- [x] **Design System Audit** (`docs/DESIGN_SYSTEM_AUDIT.md`)
- [x] **Design Tokens File** (`src/design-system/tokens.css`)
- [x] **Usage Documentation** (`docs/DESIGN_TOKENS.md`)
- [x] **Migration Plan** (this document)

#### Tasks Completed
1. Analyzed 50,000+ lines of component code
2. Documented current spacing, typography, colors, icons
3. Identified inconsistencies (30+ padding values, 13 icon sizes, etc.)
4. Created comprehensive token system (100+ tokens)
5. Wrote usage guide with examples

#### Next Steps
- Get stakeholder approval
- Set up visual regression testing
- Begin Phase 2

---

### Phase 2: Core Infrastructure
**Duration:** 1 week  
**Priority:** High  
**Status:** 🔜 Next

#### Goals
- Integrate design tokens into build system
- Set up tooling and linting
- Create component showcase

#### Tasks

**2.1 Integration** (2 days)
- [ ] Update `src/index.css` to import tokens first
- [ ] Verify tokens load correctly in all components
- [ ] Test theme switching with new tokens
- [ ] Ensure no CSS conflicts

**2.2 Tooling** (2 days)
- [ ] Set up ESLint rule to prevent hard-coded values
- [ ] Configure Stylelint to enforce token usage
- [ ] Create pre-commit hook for linting
- [ ] Add token validation tests

**2.3 Showcase** (1 day)
- [ ] Create design system showcase page
- [ ] Display all tokens visually
- [ ] Add interactive examples
- [ ] Document in Storybook (optional)

**2.4 Visual Regression Setup** (2 days)
- [ ] Set up Playwright screenshot testing
- [ ] Capture baseline screenshots of all panels
- [ ] Configure CI/CD integration
- [ ] Document testing process

#### Success Criteria
- ✅ All tokens load correctly
- ✅ Linting catches hard-coded values
- ✅ Visual regression suite operational
- ✅ Showcase page live

---

### Phase 3: Color Migration
**Duration:** 1 week  
**Priority:** Critical  
**Status:** 🕒 Upcoming

#### Goals
- Replace all direct Tailwind color usage with semantic tokens
- Ensure consistent color application across components

#### Tasks

**3.1 Status Colors** (2 days)
- [ ] Find & replace `text-green-400` → `var(--color-success-text)`
- [ ] Replace `bg-green-500/20` → `var(--color-success-bg)`
- [ ] Update `border-green-500/30` → `var(--color-success-border)`
- [ ] Repeat for error, warning, info colors

**3.2 Priority Colors** (1 day)
- [ ] Update task priority badges (p0/p1/p2/p3)
- [ ] Apply priority color tokens
- [ ] Verify urgency indicators

**3.3 Agent Colors** (1 day)
- [ ] Update coder/researcher/writer/chief badges
- [ ] Apply agent color tokens
- [ ] Verify agent status displays

**3.4 Interactive States** (1 day)
- [ ] Update hover states to use `--color-hover`
- [ ] Update active states to use `--color-active`
- [ ] Update disabled states to use `--color-disabled`

**3.5 Validation** (2 days)
- [ ] Run visual regression tests
- [ ] Fix any color contrast issues
- [ ] Verify accessibility (WCAG AA compliance)
- [ ] Test light/dark theme switching

#### Files to Update
- Most components use colors (priority order):
  1. `VoicePanel.tsx` (2117 lines)
  2. `InboxPanel.tsx` (1861 lines)
  3. `EnhancedSettingsPanel.tsx` (1655 lines)
  4. `EpicCalendar.tsx` (1587 lines)
  5. `TaskDetailPanel.tsx` (1473 lines)
  6. All badge components
  7. All status indicators

#### Success Criteria
- ✅ Zero direct Tailwind color usage
- ✅ All colors use semantic tokens
- ✅ WCAG AA contrast ratios met
- ✅ Visual regression tests pass

---

### Phase 4: Spacing & Layout Migration
**Duration:** 1 week  
**Priority:** High  
**Status:** 🕒 Upcoming

#### Goals
- Standardize padding, margin, and gap values
- Apply semantic spacing tokens

#### Tasks

**4.1 Card Components** (2 days)
- [ ] Update `.card` to use `--spacing-card`
- [ ] Update `.card-sm` to use `--spacing-card-sm`
- [ ] Update `.card-lg` to use `--spacing-card-lg`
- [ ] Verify consistent card padding across app

**4.2 Button Components** (1 day)
- [ ] Apply `--spacing-button` to all buttons
- [ ] Update button sizes (sm/md/lg)
- [ ] Fix icon + text gap (`--button-gap`)

**4.3 Section Spacing** (1 day)
- [ ] Replace arbitrary margins with `--spacing-section`
- [ ] Standardize vertical spacing between sections
- [ ] Fix inconsistent gap values

**4.4 Inline Spacing** (1 day)
- [ ] Update icon + text combinations
- [ ] Apply `--spacing-inline` consistently
- [ ] Fix tight inline spacing (`--spacing-inline-tight`)

**4.5 Validation** (2 days)
- [ ] Visual regression testing
- [ ] Verify touch target sizes (44x44 minimum)
- [ ] Test responsive layouts
- [ ] Fix any layout breaks

#### Success Criteria
- ✅ Padding uses 7 standard tokens (not 30+)
- ✅ Gap uses 5 standard values (gap-1 through gap-6)
- ✅ Consistent spacing across all components
- ✅ No hard-coded px values

---

### Phase 5: Typography Migration
**Duration:** 1 week  
**Priority:** Medium  
**Status:** 🕒 Upcoming

#### Goals
- Standardize font sizes and weights
- Apply consistent line heights
- Create reusable typography classes

#### Tasks

**5.1 Typography Classes** (2 days)
- [ ] Create `.heading-1`, `.heading-2`, `.heading-3` classes
- [ ] Create `.body`, `.body-small`, `.caption` classes
- [ ] Document usage patterns

**5.2 Component Migration** (2 days)
- [ ] Replace arbitrary text sizes with type scale
- [ ] Apply consistent line heights
- [ ] Update font weights to use tokens

**5.3 Responsive Typography** (1 day)
- [ ] Add responsive type scaling for mobile
- [ ] Test readability on all screen sizes
- [ ] Adjust as needed

**5.4 Validation** (2 days)
- [ ] Visual regression testing
- [ ] Accessibility check (readable text sizes)
- [ ] Test on different devices

#### Success Criteria
- ✅ All text uses type scale tokens
- ✅ Consistent line heights
- ✅ Typography classes reusable
- ✅ Readable on all devices

---

### Phase 6: Icon System Migration
**Duration:** 1 week  
**Priority:** Medium  
**Status:** 🕒 Upcoming

#### Goals
- Reduce icon sizes from 13 to 5 core sizes
- Apply consistent icon sizing across app

#### Tasks

**6.1 Icon Audit** (1 day)
- [ ] Find all icon usage (Lucide React)
- [ ] Categorize by size (xs/sm/md/lg/xl)
- [ ] Identify outliers (8px, 18px, 28px, etc.)

**6.2 Size Standardization** (2 days)
- [ ] Replace `size={14}` → `size={16}` (--icon-sm)
- [ ] Replace `size={10}` → `size={12}` (--icon-xs)
- [ ] Replace `size={18}` → `size={20}` (--icon-md)
- [ ] Remove arbitrary sizes (28px, 36px, 40px)

**6.3 Icon + Text Alignment** (1 day)
- [ ] Apply `.icon-text` class for inline icons
- [ ] Fix vertical alignment issues
- [ ] Ensure consistent gap

**6.4 Validation** (3 days)
- [ ] Visual regression testing
- [ ] Verify icon sizes across all panels
- [ ] Test hover/active states
- [ ] Fix any alignment issues

#### Success Criteria
- ✅ Only 5 core icon sizes used (xs/sm/md/lg/xl)
- ✅ Consistent icon + text alignment
- ✅ No visual regressions

---

### Phase 7: Component Sizing Migration
**Duration:** 1 week  
**Priority:** Medium  
**Status:** 🕒 Upcoming

#### Goals
- Standardize button, input, card, and modal sizes
- Apply component sizing tokens

#### Tasks

**7.1 Buttons** (2 days)
- [ ] Update button heights (sm/md/lg)
- [ ] Apply consistent padding
- [ ] Fix hover states

**7.2 Inputs** (1 day)
- [ ] Standardize input heights
- [ ] Apply consistent padding
- [ ] Verify focus states

**7.3 Cards & Modals** (2 days)
- [ ] Apply card width tokens
- [ ] Apply modal width tokens
- [ ] Fix responsive behavior

**7.4 Border Radius** (1 day)
- [ ] Consolidate from 9 variations to 6
- [ ] Apply semantic radius tokens
- [ ] Verify visual consistency

**7.5 Validation** (1 day)
- [ ] Visual regression testing
- [ ] Test all component sizes
- [ ] Fix any layout issues

#### Success Criteria
- ✅ Buttons use 3 standard sizes
- ✅ Cards/modals use defined widths
- ✅ Border radius consolidated to 6 tokens
- ✅ No custom arbitrary values

---

### Phase 8: Animation & Effects Migration
**Duration:** 3 days  
**Priority:** Low  
**Status:** 🕒 Upcoming

#### Goals
- Standardize animation durations
- Apply consistent easing functions
- Use semantic transition tokens

#### Tasks

**8.1 Transitions** (1 day)
- [ ] Replace hard-coded durations with tokens
- [ ] Apply semantic transitions (hover/modal/slide)
- [ ] Verify smooth animations

**8.2 Shadows** (1 day)
- [ ] Apply shadow tokens consistently
- [ ] Update glow effects
- [ ] Verify visual hierarchy

**8.3 Validation** (1 day)
- [ ] Test animations on all components
- [ ] Verify reduced motion support
- [ ] Performance check

#### Success Criteria
- ✅ All animations use duration tokens
- ✅ Consistent easing functions
- ✅ Smooth, performant transitions

---

### Phase 9: Final Validation & Cleanup
**Duration:** 1 week  
**Priority:** Critical  
**Status:** 🕒 Final

#### Goals
- Ensure complete migration
- Fix any remaining issues
- Document final state

#### Tasks

**9.1 Comprehensive Testing** (3 days)
- [ ] Run full visual regression suite
- [ ] Test all panels and modals
- [ ] Verify light/dark themes
- [ ] Test on multiple devices/browsers

**9.2 Accessibility Audit** (2 days)
- [ ] WCAG AA compliance check
- [ ] Contrast ratio verification
- [ ] Touch target sizes
- [ ] Keyboard navigation

**9.3 Performance Check** (1 day)
- [ ] CSS bundle size before/after
- [ ] Runtime performance
- [ ] Identify any regressions

**9.4 Documentation Update** (1 day)
- [ ] Update DESIGN_SYSTEM_AUDIT.md with final metrics
- [ ] Document lessons learned
- [ ] Create maintenance guide

**9.5 Cleanup** (1 day)
- [ ] Remove unused CSS
- [ ] Delete deprecated classes
- [ ] Archive old patterns

#### Success Criteria
- ✅ All visual regression tests pass
- ✅ WCAG AA compliance
- ✅ No performance regressions
- ✅ Complete documentation

---

## Metrics Tracking

### Before Migration (Baseline)
- **Padding values:** 30+ unique combinations
- **Gap values:** 6 unique values
- **Icon sizes:** 13 unique sizes
- **Color tokens:** ~40 Tailwind colors used directly
- **Border radius:** 9 variations
- **Hard-coded values:** Thousands

### After Migration (Target)
- **Padding values:** 7 defined tokens
- **Gap values:** 5 standard values
- **Icon sizes:** 5 core sizes (xs/sm/md/lg/xl)
- **Color tokens:** All semantic (zero direct Tailwind)
- **Border radius:** 6 defined tokens
- **Hard-coded values:** Zero (enforced by linting)

---

## Risk Management

### Potential Risks

**Visual Regressions**
- **Risk:** Design changes break existing layouts
- **Mitigation:** Visual regression testing before each phase
- **Fallback:** Revert commits if critical breaks occur

**Performance Impact**
- **Risk:** CSS bundle size increases
- **Mitigation:** Monitor bundle size, optimize token usage
- **Fallback:** Remove unused tokens, tree-shake

**Developer Friction**
- **Risk:** Team resistance to new system
- **Mitigation:** Clear documentation, training sessions
- **Fallback:** Gradual adoption, pair programming

**Accessibility Issues**
- **Risk:** Color changes affect contrast ratios
- **Mitigation:** Automated contrast checking
- **Fallback:** Revert problematic changes

---

## Team Coordination

### Roles & Responsibilities

**Coder Agent (Primary)**
- Implement token migrations
- Run visual regression tests
- Fix issues and bugs

**Designer Review**
- Approve color/spacing changes
- Validate visual consistency
- Sign off on each phase

**Accessibility Audit**
- WCAG compliance verification
- Contrast ratio checks
- Keyboard navigation testing

**Stakeholder (Kevin)**
- Final approval on each phase
- Review progress weekly
- Provide feedback

---

## Communication Plan

### Weekly Progress Updates
- **What:** Summary of completed tasks
- **When:** Every Friday
- **Where:** #get-shit-done Discord channel
- **Format:** Screenshot + metrics

### Phase Completion Reviews
- **What:** Demo of completed phase
- **When:** End of each phase
- **Who:** Kevin + team
- **Format:** Live demo + documentation

### Blockers & Issues
- **What:** Report any blockers immediately
- **Where:** Discord or task comments
- **Escalate:** If blocked >24 hours

---

## Tools & Resources

### Development
- **Design Tokens:** `src/design-system/tokens.css`
- **Documentation:** `docs/DESIGN_TOKENS.md`
- **Audit Report:** `docs/DESIGN_SYSTEM_AUDIT.md`

### Testing
- **Visual Regression:** Playwright (to be set up)
- **Accessibility:** axe-core, Lighthouse
- **Linting:** ESLint, Stylelint

### Reference
- **Tailwind Docs:** https://tailwindcss.com
- **WCAG Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Design Tokens Spec:** https://design-tokens.github.io/community-group/

---

## Success Criteria (Overall)

At the end of the migration:

✅ **Consistency:** 90%+ components use design tokens  
✅ **Maintainability:** Single source of truth for all values  
✅ **Performance:** No CSS bundle size increase  
✅ **Accessibility:** All contrast ratios meet WCAG AA  
✅ **Developer Experience:** Clear documentation + linting enforcement  
✅ **Visual Quality:** No regressions, improved consistency  

---

## Timeline Summary

| Phase | Duration | Status | Start Date |
|-------|----------|--------|------------|
| Phase 1: Foundation | 1 week | ✅ Complete | 2026-01-29 |
| Phase 2: Infrastructure | 1 week | 🔜 Next | TBD |
| Phase 3: Colors | 1 week | 🕒 Upcoming | TBD |
| Phase 4: Spacing | 1 week | 🕒 Upcoming | TBD |
| Phase 5: Typography | 1 week | 🕒 Upcoming | TBD |
| Phase 6: Icons | 1 week | 🕒 Upcoming | TBD |
| Phase 7: Component Sizing | 1 week | 🕒 Upcoming | TBD |
| Phase 8: Animation | 3 days | 🕒 Upcoming | TBD |
| Phase 9: Validation | 1 week | 🕒 Final | TBD |
| **Total** | **~8-9 weeks** | | |

**Estimated Completion:** Mid-March 2026 (if started immediately)

---

## Next Actions

1. **Review this plan** with Kevin and stakeholders
2. **Get approval** to proceed with Phase 2
3. **Schedule kickoff** for infrastructure setup
4. **Begin Phase 2** implementation

---

**Migration Plan Complete** - Ready for approval and execution.
