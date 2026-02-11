# Designer Learning Log

**Task:** task-1769809773003  
**Started:** January 30, 2026  
**Designer:** Subagent (Designer)

---

## Purpose

Document all learnings, decisions, mistakes, and insights from the global design system implementation.

**Why this matters:**
- Future designers learn from our decisions
- Avoid repeating mistakes
- Track evolution of design thinking
- Provide context for "why" behind patterns

---

## Learning Entries

### Entry 1: Research Phase - Modern Design Systems (Jan 30, 2026)

**Context:** Researching Linear, Notion, Vercel, Stripe, Arc to inform Froggo design system.

**Key Insights:**

1. **Linear's Philosophy: "Speed Through Simplicity"**
   - Every UI element has a purpose (no decoration)
   - Keyboard-first design (modals dismissible via Esc, quick search via ⌘+K)
   - Instant feedback (hover states, optimistic UI)
   - **Lesson:** Remove any element that doesn't serve the user's workflow

2. **Notion's Information Density**
   - Calm gray-scale foundation lets content shine
   - Progressive disclosure (detail on demand, not upfront)
   - Flexible layouts adapt to content
   - **Lesson:** Don't overwhelm—show what's needed now, reveal rest on interaction

3. **Vercel's Geist System: Typography-First**
   - Clear type hierarchy (display → heading → body → caption)
   - Precise spacing scale (4px base unit, mathematical consistency)
   - Subtle gradients for depth (not decoration)
   - **Lesson:** Typography hierarchy = cognitive hierarchy. Make scanning effortless.

4. **Stripe's Trust Through Consistency**
   - Accessibility is not optional (WCAG AA minimum)
   - Same action = same appearance = same result (everywhere)
   - Clear status indicators (never color alone)
   - **Lesson:** Users trust systems that are predictable. Consistency = trust.

5. **Arc's Spatial Awareness**
   - Bold use of color for meaning (not just decoration)
   - Playful micro-interactions (delight without distraction)
   - Clear visual hierarchy through space, not just size
   - **Lesson:** Color can communicate meaning AND delight. Balance is key.

**Decisions Made:**
- Dark-first design (matches Froggo brand, reduces eye strain)
- 4px spacing scale (mathematical consistency over artistic interpretation)
- Green accent (#22c55e) for primary actions (Froggo brand color)
- System font stack (instant load, native feel, already optimized)
- Semantic color system (success/error/warning/info/review)

**What I'd Do Differently:**
- N/A (initial research phase)

---

### Entry 2: Existing Codebase Audit (Jan 30, 2026)

**Context:** Analyzing current design tokens and component patterns to identify gaps.

**Findings:**

**✅ Good Foundation:**
- Design tokens already defined (`design-tokens.css`, `design-system/tokens.css`)
- Component patterns exist (`component-patterns.css`)
- Accessibility considered (`accessibility.css`)
- Forms have base styling (`forms.css`)

**⚠️ Inconsistencies Found:**
1. **Two token files** - `design-tokens.css` vs `design-system/tokens.css`
   - Need to consolidate (one source of truth)
   - Some duplicate definitions with slight variations

2. **Component patterns incomplete**
   - Cards: good base, but interactive variants need work
   - Buttons: solid, but missing focus-visible states
   - Forms: good, but error states inconsistent
   - Modals: structure exists, but 40+ modals likely deviate

3. **Theme support exists but not fully tested**
   - Light theme overrides defined
   - Unknown how many components actually work in light mode
   - No screenshots documenting both themes

4. **Accessibility gaps:**
   - Focus indicators defined but not universally applied
   - No reduced-motion support visible
   - ARIA labels likely missing in many components

**Decisions Made:**
- Use `design-tokens.css` as single source of truth (more comprehensive)
- Create tasks for component-by-component audit
- Mandate screenshot testing in BOTH themes
- Create accessibility verification checklist

**What I'd Do Differently:**
- Should have requested screenshot examples before creating guide
- Could have sampled more components to understand patterns

---

### Entry 3: Style Guide Creation (Jan 30, 2026)

**Context:** Creating comprehensive STYLE_GUIDE.md as creative direction document.

**Approach:**
1. **Philosophy first** - Establish "why" before "how"
2. **Principles over rules** - Guidelines that guide, not dictate
3. **Examples everywhere** - Show, don't just tell
4. **Usage notes** - Different audiences (designers, coders, reviewers)

**Sections Created:**
- Design Philosophy (workflow-first, research-backed)
- Design Principles (5 core: workflow, consistency, disclosure, feedback, accessibility)
- Color System (semantic colors, channel brands, theme support)
- Typography (scale, hierarchy, usage examples)
- Spacing & Layout (4px scale, semantic tokens, patterns)
- Component Library (buttons, cards, forms, badges, modals, lists, tables, avatars, empty states)
- Motion & Animation (durations, easing, when to animate)
- Accessibility (WCAG AA, keyboard, screen readers, reduced motion)
- Page-Specific Patterns (Dashboard, Inbox, Tasks, Agents, Analytics, X, Settings)
- Modal System (structure, catalog, consistency rules)
- Theme Support (dark/light, testing requirements)
- Implementation Checklist (8 phases)

**Key Decisions:**
1. **Dark-first, light-supported** - Default dark, but light mode is first-class citizen
2. **4px base unit** - Mathematical consistency (no arbitrary values)
3. **System fonts** - Performance and native feel over custom typefaces
4. **Accessibility mandatory** - WCAG AA minimum, not "nice to have"
5. **Screenshot verification** - Every component tested in both themes
6. **Animation serves function** - No decoration-only motion

**What Worked Well:**
- Philosophy section grounds all decisions in "why"
- Real code examples make implementation clear
- Accessibility built into every component pattern
- Implementation checklist provides clear roadmap

**What I'd Do Differently:**
- Could have included more visual examples (diagrams, mockups)
- Modal catalog could be more comprehensive (only listed 7 of 40+)
- Page-specific patterns could show full layouts, not just descriptions

**Lessons Learned:**
1. **Design systems are communication tools** - The guide is as important as the implementation
2. **Examples > Explanations** - Show code, show usage, show results
3. **Consistency is a feature** - Users learn patterns once, apply everywhere
4. **Accessibility is design** - Not a separate concern, integrated from start

---

## Design Patterns Discovered

### Pattern: Glassmorphism Cards

**Usage:** High-emphasis cards (modals, hero sections, featured content)

**Implementation:**
```css
.card-glass {
  background: rgba(20, 20, 20, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: var(--shadow-lg);
}
```

**Why it works:**
- Creates depth without heavy shadows
- Blur suggests elevation
- Works in both dark and light themes (adjust alpha)

**When to use:**
- Modals (overlay content)
- Hero sections (stand out from background)
- Featured cards (promotional content)

**When NOT to use:**
- List items (too heavy for repetition)
- Small components (effect lost at small scale)
- Dense UIs (visual noise)

---

### Pattern: Three-Pane Layout (Inbox)

**Usage:** Communications, file browsers, any master-detail view

**Structure:**
```
┌──────────┬──────────┬─────────────────┐
│  Master  │   List   │     Detail      │
│  (nav)   │ (items)  │   (content)     │
│  280px   │  400px   │      1fr        │
└──────────┴──────────┴─────────────────┘
```

**Why it works:**
- Familiar pattern (Mail.app, Slack, Discord)
- Clear hierarchy (navigation → list → detail)
- Efficient use of space (no page transitions)

**Implementation notes:**
- Left pane: Fixed 280px (navigation)
- Center pane: Fixed 400px (list, scrollable)
- Right pane: Flex 1fr (detail, scrollable)
- Dividers: 1px borders, no drag-to-resize (simplicity)

**Accessibility:**
- Each pane is landmark (`<nav>`, `<main>`, `<aside>`)
- Focus management (Tab moves between panes)
- Keyboard shortcuts (⌘+1/2/3 to jump to panes)

---

### Pattern: Semantic Color + Icon Combinations

**Usage:** Status indicators, badges, alerts

**Why this works:**
- Color conveys meaning
- Icon reinforces meaning
- Text provides explicit meaning
- **Never color alone** (accessibility)

**Examples:**
```jsx
// Success
<div className="badge-base badge-success">
  <Icon name="check-circle" />
  Done
</div>

// Error
<div className="badge-base badge-error">
  <Icon name="alert-circle" />
  Failed
</div>

// Warning
<div className="badge-base badge-warning">
  <Icon name="alert-triangle" />
  Pending
</div>
```

**Lesson:** Triple redundancy (color + icon + text) ensures everyone understands.

---

## Mistakes & How We Fixed Them

### Mistake 1: [Placeholder - Will document as we find issues]

**What happened:**  
**Why it was wrong:**  
**How we fixed it:**  
**Lesson learned:**  

---

## Open Questions

1. **Modal size consistency** - Currently have sm/md/lg/xl. Are all sizes actually needed? Can we reduce to just 2-3?

2. **Animation preferences** - Should we default to reduced motion? Or let users opt-in?

3. **Icon library** - Currently using Lucide React. Should we standardize sizes/strokes?

4. **Chart theming** - Analytics charts need consistent theming. Recharts? Chart.js? Custom?

5. **Form validation** - Inline errors vs summary at top? Both?

---

## Resources

**Design Systems Studied:**
- [Linear](https://linear.app) - Speed through simplicity
- [Notion](https://notion.so) - Flexible information density
- [Vercel](https://vercel.com/design) - Typography-first precision
- [Stripe](https://stripe.com/design) - Trust through consistency
- [Arc](https://arc.net) - Spatial awareness and delight

**Accessibility Standards:**
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

**Tools:**
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension
- [NVDA](https://www.nvaccess.org/) - Screen reader testing (Windows)
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) - Screen reader testing (Mac)

---

## Next Steps

1. ✅ Create comprehensive STYLE_GUIDE.md
2. ✅ Create DESIGNER_LEARNING_LOG.md
3. ⏳ Audit current components against style guide
4. ⏳ Create implementation tasks for coder agents
5. ⏳ Set up screenshot verification workflow
6. ⏳ Spawn coder agents to execute fixes
7. ⏳ Test in both light and dark modes
8. ⏳ Document final learnings

---

## Team Communication

**When to update this log:**
- After each major design decision
- When you discover a pattern/anti-pattern
- When you make a mistake (document it!)
- When you finish a major implementation phase
- When you learn something from testing

**Format:**
- Date every entry
- Be specific (code examples, screenshots)
- Explain "why" not just "what"
- Include lessons learned

---

**Last Updated:** January 30, 2026  
**Total Entries:** 3  
**Status:** 🚧 Active Learning
