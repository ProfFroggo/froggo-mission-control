---
name: design-review
description: Process for reviewing UI designs or implemented UI against design standards — covering visual hierarchy, accessibility, responsiveness, states, and handoff readiness.
---

# Design Review

## Purpose

Review UI designs and implemented interfaces systematically against a consistent set of quality dimensions. Every design review produces clear, actionable feedback with severity levels — not subjective opinions. The goal is to ship interfaces that are accessible, consistent, and complete.

## Trigger Conditions

Load this skill when:
- Reviewing Figma designs before engineering implementation begins
- Reviewing implemented UI (in browser or staging) against design specs
- Auditing existing UI for accessibility or design standard compliance
- Completing a design-to-dev handoff
- Signing off on a feature before it ships to production

## Procedure

### Step 1 — Understand Scope Before Reviewing

Before starting a review:

```
What is being reviewed: [Figma file / staging URL / production URL / screenshots]
Review type: [Design review (pre-build) / Implementation review (post-build) / Accessibility audit]
Feature or scope: [specific screen, flow, or component]
Platform: [Desktop web / Mobile web / Both]
Design standard reference: [which design system or guidelines apply]
```

Read any existing PRD or design brief before reviewing. Do not review in a vacuum — understand what the design is supposed to do before evaluating how well it does it.

### Step 2 — Review Dimensions

Evaluate every design across all of these dimensions. Do not skip dimensions because a design "looks good."

---

#### Dimension 1: Visual Hierarchy

Is it immediately clear what the most important element on the page is? Can a user understand what to look at first, second, third?

Check:
- Is there a clear primary action (one dominant CTA per screen)?
- Does text size and weight create a logical reading order?
- Is whitespace used to group related elements and separate unrelated ones?
- Does the eye flow naturally through the design, or does it feel chaotic?

Questions to ask:
- "What is the first thing a user sees when they land on this screen?"
- "Is there visual competition between elements that should not compete?"

---

#### Dimension 2: Spacing Consistency

Is spacing consistent and based on a defined spacing system (4px grid, 8px grid, etc.)?

Check:
- Are margins, padding, and gaps consistent within components and across the page?
- Do similar components have the same internal padding?
- Are there unexplained 7px, 13px, or arbitrary spacing values?
- Does the layout breathe, or is it cramped?

---

#### Dimension 3: Color and Typography

Are colors and typography applied from the design system, or are there one-off values?

Check:
- All colors are from the defined palette (no one-off hex values not in the system)
- Text colors meet contrast requirements (see Dimension 4)
- Font families, weights, and sizes match the type scale
- No custom font sizes outside the scale (e.g., no "17px" if the scale is 14/16/20/24)
- Dark mode: all colors have dark mode variants defined

---

#### Dimension 4: Color Contrast (WCAG AA)

All text must meet WCAG 2.1 Level AA contrast requirements. This is not optional.

| Text type | Minimum contrast ratio |
|-----------|----------------------|
| Normal text (< 18pt / < 14pt bold) | 4.5:1 |
| Large text (≥ 18pt / ≥ 14pt bold) | 3:1 |
| UI components and graphics | 3:1 |

Check tools: WebAIM Contrast Checker, Figma plugin "Stark," browser DevTools accessibility panel.

Document: For every contrast failure found, note the specific element, the actual contrast ratio, and the minimum required ratio.

---

#### Dimension 5: Responsive Behavior

Designs must work at all breakpoints defined for the platform.

Standard breakpoints:
```
Mobile:   375px (iPhone SE minimum)
Mobile L: 430px (iPhone Pro Max)
Tablet:   768px
Desktop:  1280px
Wide:     1440px
```

Check at every breakpoint:
- Does text wrap appropriately (no overflow, no orphaned words)?
- Do interactive elements remain tappable at mobile sizes (minimum 44×44px tap target)?
- Is the layout hierarchy maintained at smaller sizes, or does it break down?
- Are images cropped/sized appropriately at each size?
- Are there any horizontal scroll issues?

---

#### Dimension 6: Dark Mode

If the platform supports dark mode, every screen must be reviewed in both light and dark.

Check:
- All text remains readable on dark backgrounds
- Images and icons are appropriate for dark backgrounds (no invisible dark icons on dark backgrounds)
- Colors are not simply inverted — dark mode should use a considered dark palette
- Shadows and depth cues work in dark mode (shadows invisible on dark backgrounds — use borders or elevation instead)
- No hardcoded `#ffffff` white or `#000000` black — these break in dark mode

---

#### Dimension 7: Empty States

Every screen that can display data must have a designed empty state.

Check:
- What does the screen look like when there is no data?
- Is the empty state helpful (explains what goes here and/or provides a next action)?
- Is it designed, not just default browser behavior?
- Common empty states to check: empty task list, no search results, no notifications, no transaction history

---

#### Dimension 8: Loading States

Every screen that fetches data asynchronously must have a loading state.

Check:
- Is there a skeleton screen or spinner for initial load?
- Are skeleton screens the correct shape/size for the content they represent?
- Is there a loading indicator for actions (e.g., button spinner on form submit)?
- Are loading states accessible (screen reader announcement, not just visual)?
- Is there a timeout state or error state for when loading fails?

---

#### Dimension 9: Error States

Every form, action, and data-fetching component must have error states designed.

Check:
- Form validation errors: inline, clear, specific ("Password must be at least 8 characters," not "Invalid input")
- API/network error: "Something went wrong. Try again." with a retry action — not a blank screen
- Empty search results: not the same as the general empty state
- 404 / not found: designed page, not raw browser error
- Error messages are in plain language — no error codes exposed to users

---

#### Dimension 10: Interaction Feedback

Every interactive element needs a clear affordance and response.

Check:
- Buttons have hover, focus, active, and disabled states
- Focus states are visible (critical for keyboard navigation)
- Form inputs have focus and error states
- Links are visually distinguishable from non-link text (not just by color alone — underline or icon)
- Destructive actions (delete, remove) have a confirmation step
- Async actions (form submit) give feedback that something is happening

### Step 3 — Severity Levels

Classify every issue found with a severity level:

| Level | Definition | Blocks ship? |
|-------|------------|-------------|
| `blocker` | Accessibility failure, broken functionality, or major usability problem. Cannot ship. | YES |
| `major` | Significant visual inconsistency, missing required state, or user-facing confusion. Should fix before ship. | Strongly recommended |
| `minor` | Small visual polish issue, spacing inconsistency, or slight deviation from design system. Fix in next iteration. | NO |
| `suggestion` | Nice-to-have improvement or alternative approach worth considering. Optional. | NO |

Do not use "blocker" for personal preference. Reserve it for objective failures (contrast, missing states, broken interactions).

### Step 4 — Write Clear Design Feedback

Feedback format for every issue:

```
Severity: [blocker / major / minor / suggestion]
Location: [specific screen, component, or element — be precise]
Issue: [what is wrong, stated as an objective observation]
Why it matters: [accessibility / consistency / usability / design system compliance]
Recommendation: [specific fix — not just "fix it" but what to do]
Reference: [design system spec, WCAG criterion, or prior approved design to reference]
```

Example good feedback:
```
Severity: blocker
Location: Login screen — "Forgot password?" link text
Issue: Link text on dark gray background (#6B7280 on #1F2937) has a contrast ratio of 2.8:1, failing WCAG AA (minimum 4.5:1 for normal text)
Why it matters: Fails WCAG 2.1 SC 1.4.3 — users with low vision cannot read this link
Recommendation: Change link text color to #D1D5DB or lighter to achieve minimum 4.5:1 ratio
Reference: WCAG 2.1 SC 1.4.3
```

Example bad feedback:
```
"The button doesn't look right"
"I think the spacing is off"
"Make it more consistent"
```

### Step 5 — Design-to-Dev Handoff Checklist

Before handing off to engineering, verify:

**Design completeness:**
- [ ] All screens in the flow designed (not just happy path)
- [ ] Empty states designed for all list/data views
- [ ] Loading states designed
- [ ] Error states designed for all forms and async actions
- [ ] Hover/focus/active/disabled states for all interactive elements
- [ ] Dark mode variants for all screens (if applicable)
- [ ] Mobile and desktop breakpoints both designed
- [ ] Annotations added for any non-obvious interactions or behaviors

**Asset readiness:**
- [ ] All icons are from the approved icon library (Lucide) or exported as SVG
- [ ] Images are properly sized and cropped for all breakpoints
- [ ] All design tokens (colors, spacing, typography) are using variables, not hardcoded values
- [ ] Component names in Figma match component names in the codebase (aids developer lookup)

**Spec completeness:**
- [ ] Spacing values specified (not just visually present — labeled in Figma)
- [ ] Font sizes, weights, and line heights specified
- [ ] Color tokens named (not just hex values)
- [ ] Animation or transition notes added where applicable
- [ ] Any conditional logic or state transitions documented in annotations

**Accessibility:**
- [ ] All contrast ratios pass WCAG AA
- [ ] Focus order is logical and documented
- [ ] ARIA roles and labels noted for any custom interactive components

### Step 6 — Sign-Off Criteria

A design is approved for build when:
- Zero blockers remain
- All major issues are either resolved or have an explicit decision to accept the risk (documented)
- Design-to-dev handoff checklist is complete
- Sign-off from designer and product owner recorded

A design is NOT approved if:
- Any blocker exists (regardless of how close to ship the feature is)
- Key states (loading, error, empty) are missing
- The handoff checklist has unchecked items without documented rationale

## Design Review Summary Template

```markdown
## Design Review: [Feature Name]

**Reviewer**: [agent name]
**Date**: YYYY-MM-DD
**What was reviewed**: [Figma link / staging URL / screenshots]
**Review type**: [Design review / Implementation review / Accessibility audit]
**Platform**: [Desktop / Mobile / Both]

### Overall Assessment
APPROVED / APPROVED WITH MINOR REVISIONS / CHANGES REQUIRED / BLOCKED

### Issues Found

#### Blockers (must fix before ship)
1. **[Location]**: [Issue] — [Recommendation]
2.

#### Major Issues (strongly recommended to fix)
1. **[Location]**: [Issue] — [Recommendation]
2.

#### Minor Issues (fix in next iteration)
1. **[Location]**: [Issue] — [Recommendation]
2.

#### Suggestions (optional improvements)
1. **[Location]**: [Suggestion]
2.

### Dimension Checklist
| Dimension | Status | Notes |
|-----------|--------|-------|
| Visual hierarchy | PASS / NEEDS WORK | |
| Spacing consistency | PASS / NEEDS WORK | |
| Color + typography | PASS / NEEDS WORK | |
| Color contrast (WCAG AA) | PASS / NEEDS WORK | |
| Responsive behavior | PASS / NEEDS WORK | |
| Dark mode | PASS / NEEDS WORK / N/A | |
| Empty states | PASS / NEEDS WORK / N/A | |
| Loading states | PASS / NEEDS WORK | |
| Error states | PASS / NEEDS WORK | |
| Interaction feedback | PASS / NEEDS WORK | |

### Handoff Checklist (for design → dev)
[Copy and complete the handoff checklist from Step 5]

### Sign-Off
- Designer: [name] — [APPROVED / PENDING]
- Product owner: [name] — [APPROVED / PENDING]
```

## Output

Save design review reports to: `~/mission-control/library/docs/research/YYYY-MM-DD_design-review_[feature].md`

## Examples

**Good task for this skill:** "Review the new transaction history screen designs in Figma against our design standards. Check all states and flag blockers."

**Good task for this skill:** "The funding flow is live on staging. Run an implementation review against the Figma spec and check for deviations."

**Anti-pattern to avoid:** Reviewing only the happy-path, default state of a design. Missing states discovered during engineering or QA cause expensive rework.

**Escalation trigger:** If a design cannot achieve WCAG AA contrast without a significant redesign — escalate to human design owner. Do not approve a design that fails basic accessibility to meet a deadline.
