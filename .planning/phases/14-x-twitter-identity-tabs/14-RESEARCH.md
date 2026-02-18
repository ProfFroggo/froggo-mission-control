# Phase 14: X/Twitter Identity, Dark Mode & Tab Structure - Research

**Researched:** 2026-02-18
**Domain:** React component styling, icon replacement, tab navigation restructuring
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

This phase is pure brownfield work across a small cluster of React components. All six requirements (XTW-01 through XTW-08) are straightforward edits to existing files — no new infrastructure, no new dependencies, no IPC changes needed.

The X/Twitter page lives in `src/components/XTwitterPage.tsx` and composes three child panes: `XAgentChatPane`, `XContentEditorPane`, and `XApprovalQueuePane`, arranged in a three-column resizable layout via `XThreePaneLayout`. The tab bar is `XTabBar.tsx`. The approval queue logic already knows which tabs it serves — it returns empty items for calendar/mentions/reply-guy/automations tabs, but the pane itself still renders (with an empty "Approval Queue" header). Removing it for those tabs requires a conditional in `XTwitterPage` or a layout change.

The biggest structural change is XTW-04: the tab order requires removing `research`, adding two new tabs (`content-mix` and `analytics`), and renaming `plan` to "Content Plan". The `XTab` union type, `XTabBar` tabs array, `XAgentChatPane` routing/context maps, and `XContentEditorPane` routing switch all need updating. `XAutomationsTab.tsx` already exists and implements the automations UI but is currently never used (the `automations` tab incorrectly routes to `XContentMixTracker` in `XContentEditorPane`).

**Primary recommendation:** Make all changes in the five core files. No new components needed except a placeholder for the `analytics` tab. Struct changes are low-risk, high-confidence.

## Standard Stack

This phase uses only what is already installed — no new packages needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-react | already installed | Icon library | Already used throughout codebase |
| React | already installed | Component rendering | Project baseline |
| Tailwind CSS | already installed | Styling via utility classes | Project baseline |

### Key Tokens Already Available (from Phase 13)
| Token | Value | Use |
|-------|-------|-----|
| `bg-clawd-bg-alt` | `var(--clawd-bg-alt, #1a1a1a)` | Dark input backgrounds |
| `bg-clawd-bg0` | `var(--clawd-bg0, #0a0a0a)` | Deepest background |
| `bg-clawd-card` | `var(--clawd-card, #141414)` | Card surfaces |
| `bg-clawd-bg` | `var(--clawd-bg, #0a0a0a)` | Page background |
| `bg-clawd-surface` | `var(--clawd-surface, #141414)` | Surface elements |

**Installation:** None required.

## Architecture Patterns

### Component Hierarchy

```
XTwitterPage.tsx              ← Header (XTW-01, XTW-02, XTW-03), layout orchestrator (XTW-05–08)
  XTabBar.tsx                 ← Tab order and type (XTW-04)
  XThreePaneLayout.tsx        ← Three-column resizable layout (no changes needed)
    XAgentChatPane.tsx        ← Left pane, needs routing map updated for new tabs (XTW-04)
    XContentEditorPane.tsx    ← Center pane, needs routing switch updated (XTW-04)
    XApprovalQueuePane.tsx    ← Right pane, conditionally rendered (XTW-05–08)
```

### Pattern 1: Conditional Right Pane Rendering (XTW-05–08)

The approval queue pane already has logic to show/hide its content based on `tab` — it calls `setItems([])` for calendar/mentions/reply-guy/automations. But the pane header ("Approval Queue") still renders. The fix must happen at the `XTwitterPage` level, not inside `XApprovalQueuePane`, because the pane removal also affects the `XThreePaneLayout` column allocation.

**Recommended approach:** In `XTwitterPage.tsx`, pass a boolean to `ThreePaneLayout` to hide the right pane, OR conditionally render a two-pane layout for those tabs.

Simplest implementation — make `ThreePaneLayout` accept optional `hideRightPane` prop:

```tsx
// XThreePaneLayout.tsx — add optional prop
interface ThreePaneLayoutProps {
  children: [ReactElement, ReactElement, ReactElement];
  hideRightPane?: boolean;
}

// In render: if hideRightPane, skip right divider and right pane,
// let center pane take remaining width
```

Alternatively, in `XTwitterPage.tsx` conditionally render:
```tsx
const TABS_WITH_APPROVAL = ['research', 'plan', 'drafts'] as const;
const showApprovalPane = TABS_WITH_APPROVAL.includes(activeTab as any);
```

### Pattern 2: Twitter Icon Replacement (XTW-01)

**Current:** `import { Twitter, PieChart, X } from 'lucide-react';` in `XTwitterPage.tsx` line 2. Usage: `<Twitter size={24} className="text-info" />` on line 21.

**Fix:** Replace `Twitter` import with the `XIcon` SVG already defined in `CoreViews.tsx` (lines 59-63). Extract the SVG into a shared location or inline it in `XTwitterPage.tsx`.

The `XIcon` SVG already exists in the codebase at `src/core/CoreViews.tsx` lines 59-63:
```tsx
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
```

Do NOT move `XIcon` out of `CoreViews.tsx` — it's a side-effect-only file used for view registration. Define the same SVG locally in `XTwitterPage.tsx` and `XTabBar.tsx` if needed, or extract to `src/components/icons/XLogo.tsx`.

### Pattern 3: Tab Restructure (XTW-04)

**Current `XTab` type** (line 10, `XTwitterPage.tsx`):
```typescript
export type XTab = 'research' | 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'automations';
```

**New `XTab` type** (per XTW-04 order):
```typescript
export type XTab = 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'content-mix' | 'automations' | 'analytics';
```

Note: `research` tab is REMOVED. `content-mix` is NEW. `analytics` is NEW.

**Current `XTabBar` tabs array** (lines 9-17, `XTabBar.tsx`):
```typescript
const tabs = [
  { id: 'research', label: 'Research', icon: <Lightbulb size={16} /> },
  { id: 'plan', label: 'Plan', icon: <FileText size={16} /> },
  { id: 'drafts', label: 'Drafts', icon: <Edit3 size={16} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={16} /> },
  { id: 'mentions', label: 'Mentions', icon: <AtSign size={16} /> },
  { id: 'reply-guy', label: 'Reply Guy', icon: <Zap size={16} /> },
  { id: 'automations', label: 'Automations', icon: <Settings size={16} /> },
];
```

**New tabs array** (per XTW-04):
```typescript
const tabs = [
  { id: 'plan', label: 'Content Plan', icon: <FileText size={16} /> },
  { id: 'drafts', label: 'Drafts', icon: <Edit3 size={16} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={16} /> },
  { id: 'mentions', label: 'Mentions', icon: <AtSign size={16} /> },
  { id: 'reply-guy', label: 'Reply Guy', icon: <Zap size={16} /> },
  { id: 'content-mix', label: 'Content Mix Tracker', icon: <PieChart size={16} /> },
  { id: 'automations', label: 'Automations', icon: <Settings size={16} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
];
```

### Pattern 4: XContentEditorPane Routing Fix (XTW-04 + existing bug)

**Current routing bug** (`XContentEditorPane.tsx` line 46): the `automations` tab renders `XContentMixTracker` — it should render `XAutomationsTab`. The new `content-mix` tab should render `XContentMixTracker`.

Updated routing switch:
```tsx
if (tab === 'plan') return <XPlanThreadComposer />;
if (tab === 'drafts') return <XDraftComposer />;
if (tab === 'calendar') return <XCalendarView />;
if (tab === 'mentions') return <XMentionsView />;
if (tab === 'reply-guy') return <XReplyGuyView />;
if (tab === 'content-mix') return <XContentMixTracker />;
if (tab === 'automations') return <XAutomationsTab />;   // was XContentMixTracker — fix bug
if (tab === 'analytics') return <XAnalyticsPlaceholder />; // new component
// 'research' removed
```

Note: `XAutomationsTab` is already implemented at `src/components/XAutomationsTab.tsx` — it just needs to be imported and used.

### Pattern 5: XAgentChatPane Routing (XTW-04)

`XAgentChatPane.tsx` has two `Record<XTab, ...>` maps:
- `AGENT_ROUTING` (line 23) — maps tab → agent ID
- `TAB_CONTEXT` (line 34) — maps tab → system prompt string

Both need entries added for `content-mix` and `analytics`, and `research` removed.

### Anti-Patterns to Avoid

- **Do not** add a dark mode CSS class toggle mechanism — the page already uses `bg-clawd-bg` tokens which ARE dark mode. The issue is components that use plain `bg-white`, `bg-gray-100`, etc. instead of tokens.
- **Do not** modify `XThreePaneLayout.tsx` in a complex way — a simple `hideRightPane` boolean prop is sufficient.
- **Do not** try to route analytics to the global `AnalyticsDashboard` — this should be an X-specific analytics placeholder (or `XAnalyticsView` component).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| X logo SVG | Custom SVG design | Reuse `XIcon` from `CoreViews.tsx` | Already defined, correct path data |
| Dark mode system | CSS variable toggler | Use existing `bg-clawd-bg-alt` tokens | Tokens already defined, just apply them |
| Analytics component | Full analytics dashboard | Simple placeholder matching existing X tab patterns | Scope is XTW-04 tab presence, not analytics content |

## Common Pitfalls

### Pitfall 1: Forgetting XAgentChatPane type safety
**What goes wrong:** `XAgentChatPane.tsx` uses `Record<XTab, ...>` typed maps — TypeScript will error if any `XTab` value is missing from the record, or if old values (`research`) remain in the record after being removed from the type.
**Why it happens:** TypeScript strict record typing requires exhaustive coverage.
**How to avoid:** Update `AGENT_ROUTING` and `TAB_CONTEXT` simultaneously with the `XTab` type change. Add `content-mix` and `analytics` entries, remove `research`.
**Warning signs:** TypeScript error "Type 'XTab' is not assignable to parameter of type..." after type change.

### Pitfall 2: `research` tab default state
**What goes wrong:** `XTwitterPage.tsx` line 13: `const [activeTab, setActiveTab] = useState<XTab>('research')`. After removing `research` from `XTab`, this becomes a type error.
**Why it happens:** Default state references a removed tab ID.
**How to avoid:** Change initial state to `'plan'` (first tab in new order).

### Pitfall 3: Three-pane layout width calculation with hidden pane
**What goes wrong:** `XThreePaneLayout.tsx` calculates `rightWidth = 100 - leftWidth - centerWidth`. If right pane is hidden but layout still runs, the "ghost" 30% width remains unused and center pane doesn't expand.
**Why it happens:** The layout computes fixed percentages.
**How to avoid:** When hiding the right pane, redistribute width — set center to `100 - leftWidth` effectively. Simplest: when `hideRightPane=true`, render only two panes with dividers.

### Pitfall 4: Content Mix Tracker as both overlay AND tab
**What goes wrong:** `XTwitterPage.tsx` currently renders `XContentMixTracker` in a modal overlay triggered by a header button. If `content-mix` becomes a tab, there are now two ways to access it. The header button becomes redundant and confusing.
**Why it happens:** The button was the original UX before tabs.
**How to avoid:** Remove the `showContentMix` state and the header "Content Mix" button when adding the `content-mix` tab. The overlay approach can be removed entirely.

### Pitfall 5: `XAutomationsPanel.tsx` vs `XAutomationsTab.tsx`
**What goes wrong:** There are TWO automations components:
- `src/components/XAutomationsPanel.tsx` — older, more complex version (has `XAutomationTrigger`, `XAutomationCondition` type exports)
- `src/components/XAutomationsTab.tsx` — the correct one to use (has the full IFTTT-style builder UI)
**Why it happens:** Both were created during development, neither is correctly wired.
**How to avoid:** Use `XAutomationsTab` (default export `XAutomationsTab()`) in `XContentEditorPane`. `XAutomationsPanel` appears unused and can be left alone.

### Pitfall 6: Dark mode inputs — where is the problem?
**What goes wrong:** XTW-02 says inputs/dropdowns/cards/backgrounds should be dark-mode styled. Most X components already use `bg-clawd-bg` tokens on inputs. But inspect each component:
- `XAutomationsTab.tsx`: inputs use `bg-clawd-bg` — ALREADY CORRECT
- `XMentionsView.tsx` line 212: `className="flex-1 px-2 py-1 text-sm border border-clawd-border rounded bg-clawd-bg text-clawd-text"` — ALREADY CORRECT
- `XReplyGuyView.tsx` lines 188, 286, 292: uses `bg-clawd-bg` — ALREADY CORRECT
- `XCalendarView.tsx`: buttons use `border border-clawd-border rounded hover:bg-clawd-surface text-clawd-text` — ALREADY CORRECT
**What may still be wrong:** Check if any component uses bare `bg-white`, `bg-gray-*`, or default browser styles that would show light backgrounds on inputs.
**How to avoid:** XTW-02 may require minimal changes if most inputs already use tokens. Run a targeted search for non-token backgrounds.

## Code Examples

### XTW-01: Replace Twitter icon in XTwitterPage.tsx

```tsx
// Replace line 2:
// import { Twitter, PieChart, X } from 'lucide-react';
// With:
import { PieChart, X } from 'lucide-react';

// Add local XLogo component:
const XLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Replace line 21:
// <Twitter size={24} className="text-info" />
// With:
<XLogo size={24} />
```

### XTW-03: Page label already correct

Line 22 of `XTwitterPage.tsx`:
```tsx
<h1 className="text-xl font-semibold">X / Twitter</h1>
```
This is already "X / Twitter" — XTW-03 may already be satisfied. Verify in running app.

### XTW-05 through XTW-08: Conditional pane hiding

In `XTwitterPage.tsx`, define which tabs show the approval pane:
```tsx
const TABS_WITH_APPROVAL_QUEUE: XTab[] = ['plan', 'drafts'];
// Note: 'research' removed from tab list, was the other tab with approval data

const showApprovalPane = TABS_WITH_APPROVAL_QUEUE.includes(activeTab);
```

In the layout section, pass the flag to `ThreePaneLayout`:
```tsx
<ThreePaneLayout hideRightPane={!showApprovalPane}>
  <XAgentChatPane tab={activeTab} />
  <XContentEditorPane tab={activeTab} />
  <XApprovalQueuePane tab={activeTab} />
</ThreePaneLayout>
```

In `XThreePaneLayout.tsx`, add `hideRightPane` prop handling:
```tsx
interface ThreePaneLayoutProps {
  children: [ReactElement, ReactElement, ReactElement];
  hideRightPane?: boolean;
}

// In the render, when hideRightPane:
// - Skip the right divider button
// - Skip the right pane div
// - Center pane takes remaining width: 100 - leftWidth
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Twitter bird icon | X logo SVG | Already done in `CoreViews.tsx`, needs applying to `XTwitterPage.tsx` |
| `XAutomationsPanel.tsx` | `XAutomationsTab.tsx` | Newer version exists, just needs wiring |
| Content Mix as overlay button | Content Mix as a tab | Per XTW-04 |
| `research` tab first | `plan` tab first | Per XTW-04 order |

## Open Questions

1. **Does `XTW-03` actually need a code change?**
   - What we know: Line 22 of `XTwitterPage.tsx` already says `"X / Twitter"`
   - What's unclear: Whether the sidebar label (from `CoreViews.tsx` line 73: `label: 'X/Twitter'`) also needs changing to "X / Twitter" (with spaces)
   - Recommendation: Update both to "X / Twitter" for consistency

2. **Analytics tab content?**
   - What we know: There is no X-specific analytics component. The global `AnalyticsDashboard` exists at `src/components/AnalyticsPanel.tsx`.
   - What's unclear: Whether analytics tab should show a stub/placeholder or the global analytics filtered to X data
   - Recommendation: Ship a simple placeholder (`<XAnalyticsView />` with "X Analytics coming soon" message) since XTW-04 only requires the tab exists in the correct position

3. **Should `research` tab content be deleted or just hidden?**
   - What we know: `XResearchIdeaEditor.tsx` exists and is fully implemented
   - What's unclear: Whether "research" is intentionally removed from the tab flow or just reordered
   - Recommendation: Remove it from `XTab` type and `XTabBar` per spec. Keep `XResearchIdeaEditor.tsx` file in place (don't delete).

4. **`XAutomationsPanel.tsx` — dead code?**
   - What we know: It is never imported anywhere outside its own file
   - What's unclear: Whether it was intentionally kept for future use
   - Recommendation: Leave it in place, don't delete it as part of this phase

## Sources

### Primary (HIGH confidence)
- Direct inspection of `/Users/worker/froggo-dashboard/src/components/XTwitterPage.tsx` — icon, label, tab type, layout
- Direct inspection of `/Users/worker/froggo-dashboard/src/components/XTabBar.tsx` — current tab array (lines 9-17)
- Direct inspection of `/Users/worker/froggo-dashboard/src/components/XApprovalQueuePane.tsx` — tab-conditional logic (lines 44-55)
- Direct inspection of `/Users/worker/froggo-dashboard/src/components/XThreePaneLayout.tsx` — layout mechanics
- Direct inspection of `/Users/worker/froggo-dashboard/src/components/XContentEditorPane.tsx` — routing switch, automations bug
- Direct inspection of `/Users/worker/froggo-dashboard/src/components/XAgentChatPane.tsx` — AGENT_ROUTING and TAB_CONTEXT maps
- Direct inspection of `/Users/worker/froggo-dashboard/src/core/CoreViews.tsx` — XIcon SVG (lines 59-63)
- Direct inspection of `/Users/worker/froggo-dashboard/tailwind.config.js` — CSS token values

### Files Affected (with line numbers)

| File | Lines | What Changes |
|------|-------|--------------|
| `src/components/XTwitterPage.tsx` | 2, 13, 21, 45-49 | Icon import, default tab, icon JSX, layout conditionals |
| `src/components/XTabBar.tsx` | 1, 9-17 | Import cleanup, tabs array reorder/add/remove |
| `src/components/XThreePaneLayout.tsx` | 4-5, 62-95 | Add `hideRightPane` prop, conditional right pane |
| `src/components/XContentEditorPane.tsx` | 1-8, 14-66 | Import XAutomationsTab, fix automations route, add content-mix/analytics routes, remove research |
| `src/components/XAgentChatPane.tsx` | 23-31, 34-68 | Update AGENT_ROUTING and TAB_CONTEXT for new tabs |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified from package.json and tailwind.config.js
- Architecture: HIGH — all verified from direct file inspection with line numbers
- Pitfalls: HIGH — all derived from concrete code patterns found in the files

**Research date:** 2026-02-18
**Valid until:** Until files listed above are modified (stable brownfield work)
