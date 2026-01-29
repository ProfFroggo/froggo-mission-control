# Frontend UI/UX Audit & Fix Plan

**Task:** task-1769687213378  
**Date:** 2026-01-29  
**Chief:** Orchestrating specialized coder agents

---

## ✅ Already Completed (Recent Work)

1. **Badge Components** - COMPLETE ✅
   - IconBadge, BadgeWrapper, ReadStateBadge
   - Text overlap fixed
   - Layout breaks resolved
   - Status: Ready for production

2. **Modal System** - COMPLETE ✅
   - BaseModal standardized
   - ContactModal refactored
   - Consistent spacing (p-6)
   - BaseModalButton component added
   - Status: 9 modals remain for refactoring (separate task)

3. **Color Scheme** - MOSTLY COMPLETE ✅
   - Hardcoded colors removed from critical components
   - WCAG AAA compliance achieved
   - CSS variable system documented
   - Status: 124 Tailwind utilities remain (P2 priority)

---

## 🎯 Audit Areas (8 Subtasks)

### Subtask 1: Audit All Dashboard Components ✅
**Status:** IN PROGRESS (this document)

**Components to Review:** 143 total components

**Critical Components (High Visibility):**
- App.tsx - Main layout
- Sidebar.tsx - Navigation
- TopBar.tsx - Status indicators (already touched for badges)
- Dashboard.tsx - Main panel
- Kanban.tsx - Task board
- AgentPanel.tsx - Agent management
- InboxPanel.tsx / ThreePaneInbox - Communications
- ChatPanel.tsx - Chat interface
- NotificationsPanel.tsx - Notifications

**Audit Checklist per Component:**
- [ ] Layout structure (flexbox/grid usage)
- [ ] Spacing consistency (padding, margins, gaps)
- [ ] Text overflow handling (truncate, ellipsis, wrap)
- [ ] Icon sizing and alignment
- [ ] Responsive breakpoints (sm, md, lg, xl)
- [ ] Color usage (CSS variables vs hardcoded)
- [ ] Typography consistency (text sizes, weights)
- [ ] Accessibility (ARIA, focus states, keyboard nav)

---

### Subtask 2: Fix Layout & Spacing Issues
**Priority:** P0  
**Agent:** Layout Specialist

**Known Issues:**
- Inconsistent padding across panels
- Gap variations (gap-1, gap-2, gap-3, gap-4)
- Mixed margin/padding patterns
- Container width inconsistencies

**Standards to Enforce:**
- Panel padding: `p-6` (24px)
- Card padding: `p-4` (16px)
- Section gaps: `gap-4` (16px)
- Item gaps: `gap-2` (8px)
- Tight gaps: `gap-1` (4px)

**Target Components:**
- All *Panel.tsx components (20+)
- Card components
- List/grid layouts

---

### Subtask 3: Fix Text Overflow & Truncation
**Priority:** P0  
**Agent:** Typography Specialist

**Known Issues:**
- Long text breaking layouts
- Missing ellipsis on truncated text
- No line-clamp where needed
- Inconsistent word-break rules

**Standards to Enforce:**
- Single line: `truncate` (overflow-hidden text-ellipsis whitespace-nowrap)
- Multi-line: `line-clamp-2` or `line-clamp-3`
- Word break: `break-words` for long URLs/emails
- Ensure proper width constraints

**Common Patterns:**
```tsx
// Single line truncate
<div className="truncate max-w-full">Long text...</div>

// Multi-line clamp
<div className="line-clamp-2">Very long text that needs...</div>

// Long URLs
<a className="truncate max-w-xs break-all">https://...</a>
```

**Target Areas:**
- Session lists (WhatsApp, Telegram)
- Task titles and descriptions
- Agent names and status
- Contact names and emails
- File names

---

### Subtask 4: Fix Icon Alignment & Sizing
**Priority:** P1  
**Agent:** Icon Specialist

**Known Issues:**
- Inconsistent icon sizes (14px, 16px, 18px, 20px, 24px)
- Vertical alignment issues (not centered with text)
- Missing flex-shrink-0 causing icon collapse
- Icon color inconsistencies

**Standards to Enforce:**
- Default: 16px (`size={16}`)
- Small: 14px (`size={14}`)
- Medium: 20px (`size={20}`)
- Large: 24px (`size={24}`)
- Always: `flex-shrink-0` class
- Always: Vertical align with text

**Common Patterns:**
```tsx
// Icon with text
<div className="flex items-center gap-2">
  <IconName size={16} className="flex-shrink-0" />
  <span>Text</span>
</div>

// Icon button
<button className="p-2 rounded hover:bg-clawd-hover">
  <IconName size={20} />
</button>
```

**Target Components:**
- All buttons with icons
- List items with status icons
- Navigation items
- Action buttons

---

### Subtask 5: Fix Badge Components ✅
**Status:** COMPLETE (see BADGE_FIXES_COMPLETE.md)
- IconBadge fixed
- BadgeWrapper fixed
- ReadStateBadge fixed
- TopBar fixed

---

### Subtask 6: Fix Responsive Design Issues
**Priority:** P1  
**Agent:** Responsive Specialist

**Known Issues:**
- Components breaking on mobile (<640px)
- Overflow on tablets (640px-1024px)
- Poor use of responsive utilities (sm:, md:, lg:)
- Fixed widths preventing adaptation

**Standards to Enforce:**
- Mobile-first approach
- Breakpoints: sm:640px, md:768px, lg:1024px, xl:1280px
- No fixed widths without max-width
- Flex-wrap where appropriate
- Hide/show patterns for mobile

**Common Patterns:**
```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Responsive padding
<div className="p-4 md:p-6">

// Mobile-hide
<div className="hidden md:block">Desktop only</div>

// Mobile-show
<div className="md:hidden">Mobile only</div>
```

**Target Components:**
- Dashboard grid layouts
- Inbox 3-pane layout
- Task board columns
- Settings panels

---

### Subtask 7: Color Contrast & Accessibility
**Status:** MOSTLY COMPLETE ✅

**Remaining Work:**
- Migrate 124 Tailwind color utilities to CSS variables
- Add ARIA labels to interactive elements
- Ensure focus indicators on all focusable elements
- Test with screen reader

**Standards:**
- Use CSS variables from `--clawd-*` set
- WCAG AAA for all text (7:1 contrast minimum)
- Focus rings: `focus:ring-2 focus:ring-clawd-accent`

**Reference:** See COLORS.md for full guidelines

---

### Subtask 8: Ensure Consistent Styling Across Panels
**Priority:** P1  
**Agent:** Consistency Specialist

**Known Issues:**
- Different button styles across panels
- Inconsistent card designs
- Mixed input field styles
- Various header patterns

**Standards to Enforce:**
- Use BaseModal for all modals
- Use design tokens from design-tokens.css
- Consistent button classes
- Standardized form inputs
- Unified card styles

**Components to Standardize:**
- All modal components (9 remaining)
- Button variants (primary, secondary, danger, ghost)
- Input fields
- Cards and panels
- Headers and footers

---

## 🚀 Execution Strategy

### Phase 1: Parallel Audits (30-45 mins)
Spawn 4 specialized agents simultaneously:

1. **Layout & Spacing Agent** (Subtask 2)
   - Audit all panels for spacing issues
   - Create fix list
   - Apply standardized padding/margins

2. **Typography Agent** (Subtask 3)
   - Find all text overflow issues
   - Apply truncate/line-clamp
   - Test with long content

3. **Icon Agent** (Subtask 4)
   - Audit icon sizes across components
   - Standardize to 14/16/20/24px
   - Fix alignment issues

4. **Responsive Agent** (Subtask 6)
   - Test all panels at multiple breakpoints
   - Fix mobile layout breaks
   - Add proper responsive utilities

### Phase 2: Consistency Pass (20-30 mins)
After parallel fixes complete:

5. **Consistency Agent** (Subtask 8)
   - Review all fixed components
   - Ensure unified design language
   - Standardize remaining variations

### Phase 3: Final Validation (15-20 mins)
- Build test
- Visual inspection
- Accessibility test
- Create comprehensive report

---

## 📊 Success Metrics

**Code Quality:**
- [ ] Zero layout breaks on mobile
- [ ] All text properly truncated
- [ ] Consistent icon sizing (4 sizes only)
- [ ] All spacing uses standard values
- [ ] Build passes with no warnings

**Accessibility:**
- [ ] WCAG AAA maintained
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on complex components
- [ ] Focus indicators visible

**User Experience:**
- [ ] Professional, polished appearance
- [ ] No visual bugs or glitches
- [ ] Smooth responsive behavior
- [ ] Consistent design language

---

## 🔧 Tools & Resources

**Documentation:**
- `DESIGN_SYSTEM.md` - Design tokens and standards
- `COLORS.md` - Color system guide
- `MODAL_STANDARDIZATION_STATUS.md` - Modal guidelines
- `BADGE_FIXES_COMPLETE.md` - Badge component reference

**Utilities:**
- `design-tokens.css` - CSS variables
- `text-utilities.css` - Text truncation classes
- `forms.css` - Form styling
- `accessibility.css` - A11y utilities

**Testing:**
```bash
npm run build          # Build test
npm run test           # Unit tests
npm run test:a11y      # Accessibility tests (if available)
```

---

## 📝 Deliverables

1. **Code Changes:**
   - All components fixed and committed
   - Git history with clear commit messages
   - Backup files for critical changes

2. **Documentation:**
   - UI_FIXES_COMPLETE.md (final report)
   - Component-specific fix notes
   - Before/after comparisons

3. **Testing:**
   - Build verification
   - Visual inspection screenshots
   - Accessibility test results

4. **Handoff:**
   - Summary for Kevin
   - Any remaining issues flagged
   - Recommendations for future work

---

**Status:** Ready to spawn specialized agents  
**Next:** Create tasks for each agent and spawn in parallel
