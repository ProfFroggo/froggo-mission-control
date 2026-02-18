# Phase 16: X/Twitter Calendar - Research

**Researched:** 2026-02-18
**Domain:** React calendar UI reuse, drag-and-drop rescheduling, X/Twitter pipeline integration
**Confidence:** HIGH

## Summary

This phase replaces the current `XCalendarView` (a custom, self-contained calendar with draft sidebar, week/day views, and its own scheduling logic) with a reuse of the existing `EpicCalendar` component from `SchedulePanel`. The requirement is explicit: the X/Twitter calendar tab must use the **same component** as `schedule.tsx` (SchedulePanel), not a custom re-implementation.

The existing `EpicCalendar` component (1,617 lines in `src/components/EpicCalendar.tsx`) is a fully-featured calendar with month/week/day/agenda views, native HTML5 drag-and-drop for rescheduling, event creation/edit modals, and a Google Calendar integration backend. The X/Twitter calendar needs to adapt this component to display tweet pipeline items (research/plan/draft/scheduled) as colour-coded events, change the "New Event" button to "Create Tweet", and remove the approval pane.

The architecture challenge is that EpicCalendar currently fetches `CalendarEvent` objects from Google Calendar via `window.clawdbot.calendar.aggregate()`. The X/Twitter calendar needs to fetch from four different X pipeline tables (`x_research_ideas`, `x_content_plans`, `x_drafts`, `x_scheduled_posts`) and present them as calendar events. The cleanest approach is to make EpicCalendar accept events as props (or via a render adapter) rather than building a second calendar.

**Primary recommendation:** Refactor EpicCalendar to accept an `events` prop and optional config overrides (button label, drag handler), then create an `XTwitterCalendarAdapter` that fetches pipeline data, maps it to CalendarEvent format, and passes it to EpicCalendar.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already used throughout |
| TypeScript | 5.x | Type safety | Already used throughout |
| lucide-react | (installed) | Icons | Already used in EpicCalendar |
| Tailwind CSS | (installed) | Styling with clawd-* tokens | Already used throughout |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| HTML5 Drag and Drop API | native | Drag-to-reschedule | Already implemented in EpicCalendar |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| EpicCalendar reuse | New custom calendar | Violates XTW-14 requirement |
| HTML5 DnD (current) | react-beautiful-dnd / @dnd-kit | Unnecessary -- EpicCalendar DnD already works |
| Prop injection | Context provider | Over-engineering for a single adapter pattern |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/components/
  EpicCalendar.tsx          # Refactored: accepts events prop + config overrides
  SchedulePanel.tsx         # Unchanged: wraps EpicCalendar with Google Calendar data
  XCalendarView.tsx         # REWRITTEN: adapter that wraps EpicCalendar with X pipeline data
  XContentEditorPane.tsx    # Unchanged: already renders XCalendarView for calendar tab
  XTwitterPage.tsx          # Modified: calendar tab excluded from TABS_WITH_APPROVAL
  XThreePaneLayout.tsx      # Unchanged: hideRightPane already works
```

### Pattern 1: Adapter Component for EpicCalendar
**What:** XCalendarView becomes a thin adapter that fetches X pipeline data, maps it to CalendarEvent[], and passes it to EpicCalendar.
**When to use:** When the calendar tab is active.
**Example:**
```typescript
// src/components/XCalendarView.tsx
// Adapter pattern: map X pipeline items to CalendarEvent format
export function XCalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    loadPipelineAsEvents();
  }, []);

  const loadPipelineAsEvents = async () => {
    // Fetch from all 4 pipeline stages
    const [researchResult, planResult, draftResult, scheduleResult] = await Promise.all([
      window.clawdbot?.xResearch?.list({}),
      window.clawdbot?.xPlan?.list({}),
      window.clawdbot?.xDraft?.list({}),
      window.clawdbot?.xSchedule?.list({}),
    ]);

    const mapped: CalendarEvent[] = [
      ...mapResearchToEvents(researchResult?.ideas || []),
      ...mapPlansToEvents(planResult?.plans || []),
      ...mapDraftsToEvents(draftResult?.drafts || []),
      ...mapScheduledToEvents(scheduleResult?.scheduled || []),
    ];

    setEvents(mapped);
  };

  return (
    <EpicCalendar
      events={events}
      onEventDrop={handleTweetReschedule}
      createButtonLabel="Create Tweet"
      onCreateClick={handleCreateTweet}
    />
  );
}
```

### Pattern 2: Status-to-Colour Mapping
**What:** Each pipeline stage maps to a distinct colour for calendar event rendering.
**When to use:** When rendering tweet events on the calendar.
**Example:**
```typescript
// Status colour mapping for X pipeline stages
const X_STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  research: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
  plan:     { bg: 'bg-info-subtle',    border: 'border-info',      text: 'text-info' },
  draft:    { bg: 'bg-warning-subtle',  border: 'border-warning',   text: 'text-warning' },
  scheduled:{ bg: 'bg-success-subtle',  border: 'border-success',   text: 'text-success' },
};
```

### Pattern 3: EpicCalendar Props Extension
**What:** Extend EpicCalendar to accept external events and config.
**When to use:** When making EpicCalendar reusable across Schedule and X/Twitter.
**Example:**
```typescript
interface EpicCalendarProps {
  // NEW: External events override (when provided, skip internal fetch)
  events?: CalendarEvent[];
  // NEW: Custom action button in header
  createButtonLabel?: string;
  onCreateClick?: () => void;
  // NEW: Custom drag handler (different from Google Calendar reschedule)
  onEventDrop?: (event: CalendarEvent, newStart: Date, newEnd: Date) => Promise<boolean>;
  // NEW: Custom event card renderer (for colour-coded status badges)
  renderEventCard?: (event: CalendarEvent, compact: boolean) => React.ReactNode;
}
```

### Anti-Patterns to Avoid
- **Duplicating EpicCalendar code in XCalendarView:** This violates XTW-14. The requirement is explicit that calendar must use the same component.
- **Putting X pipeline fetch logic inside EpicCalendar:** EpicCalendar should remain agnostic to data source. The adapter pattern keeps concerns separated.
- **Building a new drag-and-drop system:** EpicCalendar already has working HTML5 DnD with confirmation dialogs. Reuse it.
- **Showing approval pane on calendar tab:** XTW-18 requires calendar + chat only. The `TABS_WITH_APPROVAL` allowlist already controls this, just verify `'calendar'` is NOT in the list.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar grid (month/week/day) | Custom grid layout | EpicCalendar's MonthView/WeekView/DayView | Already built, tested, handles edge cases (multi-day, all-day, timezone) |
| Drag-and-drop rescheduling | Custom DnD system | EpicCalendar's handleDragStart/handleDrop/RescheduleConfirmDialog | Already handles: drag states, visual feedback, confirmation dialog, optimistic update, rollback |
| Date navigation | Custom date math | EpicCalendar's navigateDate / getDateRangeText | Handles month/week/day nav, date range display, "Today" button |
| Event time parsing | Custom date helpers | EpicCalendar's getEventTime / formatTime / isSameDay | Already handles all-day vs timed events, cross-day events |

**Key insight:** EpicCalendar is 1,617 lines of battle-tested calendar code. Rebuilding any of it for X/Twitter would be a waste and violate the requirement.

## Common Pitfalls

### Pitfall 1: CalendarEvent shape mismatch
**What goes wrong:** X pipeline items have `created_at` (epoch ms), `scheduled_for` (epoch ms), `status` fields. CalendarEvent expects `start.dateTime` (ISO string), `end.dateTime`, `summary`, `account`, `source`.
**Why it happens:** Two different data models for fundamentally different entities.
**How to avoid:** Create explicit mapper functions for each pipeline stage. Research/plan/draft items use `created_at` as start time. Scheduled items use `scheduled_for`. All items need `end` calculated (e.g., +1 hour for timed events, all-day for undated items).
**Warning signs:** Events not appearing on calendar, wrong dates, crashes on getEventTime().

### Pitfall 2: EpicCalendar internal state fighting external events
**What goes wrong:** EpicCalendar currently calls `fetchEvents()` in useEffect and manages its own `events` state. If we also pass events as props, there's a conflict.
**Why it happens:** EpicCalendar was built for a single data source (Google Calendar).
**How to avoid:** When `events` prop is provided, skip the internal `fetchEvents()` call. Use a simple conditional: `if (externalEvents) { setEvents(externalEvents); } else { fetchEvents(); }`.
**Warning signs:** Events list gets replaced on every refresh cycle, flickering, duplicate events.

### Pitfall 3: Drag handler calling Google Calendar API instead of xSchedule:update
**What goes wrong:** EpicCalendar's confirmReschedule() runs `gog calendar events update` which is the Google Calendar CLI. X/Twitter calendar needs `xSchedule.update()`.
**Why it happens:** The reschedule handler is hardcoded in EpicCalendar.
**How to avoid:** Accept `onEventDrop` callback prop. When provided, use it instead of the default Google Calendar reschedule. The callback receives (event, newStart, newEnd) and returns Promise<boolean>.
**Warning signs:** Drag-to-reschedule silently fails, or tries to create Google Calendar events.

### Pitfall 4: Missing colour for EventCard
**What goes wrong:** EventCard uses `accountColor` based on email account (`event.account`). X pipeline items don't have email accounts.
**Why it happens:** EventCard was designed for Google Calendar events.
**How to avoid:** Use the `colorId` field on CalendarEvent or extend EventCard to accept a colour override. Map pipeline stage to a colour via `event.colorId` or a custom field on CalendarEvent metadata.
**Warning signs:** All tweet events show the same default colour.

### Pitfall 5: Calendar tab still showing approval pane
**What goes wrong:** The approval queue appears alongside the calendar.
**Why it happens:** Forgetting to verify `TABS_WITH_APPROVAL` excludes 'calendar'.
**How to avoid:** Check `XTwitterPage.tsx` line 19: `const TABS_WITH_APPROVAL: XTab[] = ['plan', 'drafts'];`. Calendar is already excluded. No change needed here.
**Warning signs:** Three-pane layout shows right pane on calendar tab.

### Pitfall 6: "Content Mix" button instead of "Create Tweet"
**What goes wrong:** The top-right button retains the wrong label.
**Why it happens:** EpicCalendar's header has a hardcoded "New Event" button. The requirement is "Create Tweet".
**How to avoid:** Pass `createButtonLabel="Create Tweet"` and `onCreateClick` props to EpicCalendar. The button text and action need to be customizable.
**Warning signs:** Calendar shows "New Event" or "Content Mix" instead of "Create Tweet".

## Code Examples

### Mapping X Pipeline Items to CalendarEvent
```typescript
// Source: Codebase analysis of CalendarEvent interface in global.d.ts

function mapScheduledToEvents(scheduled: ScheduledPost[]): CalendarEvent[] {
  return scheduled.map(s => {
    const startDate = new Date(s.scheduled_for);
    const endDate = new Date(s.scheduled_for + 3600000); // +1 hour

    let title = 'Scheduled Tweet';
    try {
      const content = JSON.parse(s.draft_content);
      title = content.tweets?.[0]?.text?.slice(0, 60) || 'Scheduled Tweet';
    } catch {
      title = s.draft_content?.slice(0, 60) || 'Scheduled Tweet';
    }

    return {
      id: s.id,
      summary: title,
      description: s.draft_content,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      colorId: 'scheduled', // Used for colour mapping
      source: 'x-pipeline' as any,
    } satisfies CalendarEvent;
  });
}

function mapResearchToEvents(ideas: any[]): CalendarEvent[] {
  return ideas.map(idea => {
    const startDate = new Date(idea.created_at);
    return {
      id: idea.id,
      summary: `[Research] ${idea.title}`,
      description: idea.description,
      start: { date: startDate.toISOString().split('T')[0] }, // All-day
      end: { date: startDate.toISOString().split('T')[0] },
      colorId: 'research',
      source: 'x-pipeline' as any,
    } satisfies CalendarEvent;
  });
}
```

### EpicCalendar Props Extension
```typescript
// Source: Codebase analysis of EpicCalendar.tsx

// Add to EpicCalendar function signature:
interface EpicCalendarProps {
  externalEvents?: CalendarEvent[];
  createButtonLabel?: string;
  onCreateClick?: () => void;
  onExternalDrop?: (event: CalendarEvent, newStart: Date, newEnd: Date) => Promise<boolean>;
  eventColorResolver?: (event: CalendarEvent) => string;
  hideHeader?: boolean;
}

export default function EpicCalendar({
  externalEvents,
  createButtonLabel = 'New Event',
  onCreateClick,
  onExternalDrop,
  eventColorResolver,
}: EpicCalendarProps = {}) {
  // ...existing state...

  // Use external events when provided
  useEffect(() => {
    if (externalEvents !== undefined) {
      setEvents(externalEvents);
      setLoading(false);
    } else {
      fetchEvents();
    }
  }, [externalEvents]);

  // ...in confirmReschedule:
  if (onExternalDrop) {
    const success = await onExternalDrop(event, newStart, newEnd);
    if (!success) { /* rollback */ }
    return;
  }
  // ...existing Google Calendar reschedule logic...
}
```

### Drag-to-Reschedule for X/Twitter
```typescript
// Source: xSchedule.update API from preload.ts

const handleTweetReschedule = async (
  event: CalendarEvent,
  newStart: Date,
  _newEnd: Date
): Promise<boolean> => {
  try {
    const result = await window.clawdbot?.xSchedule?.update({
      id: event.id,
      scheduledFor: newStart.getTime(),
    });

    if (result?.success) {
      // Refresh events
      await loadPipelineAsEvents();
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XCalendarView has own grid (week/day, 8-col grid, 24 hour rows) | Reuse EpicCalendar (month/week/day/agenda) | This phase | Eliminates 550 lines of duplicate calendar code |
| XCalendarView has left sidebar for draft selection | Calendar is center pane, chat is left pane | This phase | Matches ThreePaneLayout pattern |
| XCalendarView uses xSchedule API only (scheduled posts) | Calendar shows all pipeline stages (research/plan/draft/scheduled) | This phase | Full pipeline visibility |

**Deprecated/outdated:**
- Current `XCalendarView.tsx` (552 lines): Will be entirely replaced. It is a self-contained calendar with its own week/day views, draft sidebar, optimal time slot picker. None of this code will be retained.

## Data Model Analysis

### X Pipeline Tables (from electron/main.ts IPC handlers)

| Table | Key Fields | Status Values | Date Field |
|-------|-----------|---------------|------------|
| `x_research_ideas` | id, title, description, proposed_by, status | proposed, approved, rejected | created_at (epoch ms) |
| `x_content_plans` | id, title, content_type, thread_length, proposed_by, status | proposed, approved, rejected | created_at (epoch ms) |
| `x_drafts` | id, plan_id, version, content, proposed_by, status, media_paths | draft, approved, rejected | created_at (epoch ms) |
| `x_scheduled_posts` | id, draft_id, scheduled_for, status, metadata | scheduled | scheduled_for (epoch ms), created_at |

### CalendarEvent Target Shape (from global.d.ts)

| Field | Type | Mapping Strategy |
|-------|------|-----------------|
| id | string | Direct from pipeline item id |
| summary | string | Title for research/plan; first 60 chars of tweet text for draft/scheduled |
| description | string | Description or content |
| start.dateTime / start.date | string | `new Date(created_at).toISOString()` for research/plan/draft; `new Date(scheduled_for).toISOString()` for scheduled |
| end.dateTime / end.date | string | +1 hour for timed, same day for all-day |
| colorId | string | Pipeline stage name: 'research' / 'plan' / 'draft' / 'scheduled' |
| source | string | 'x-pipeline' (custom, for identification) |

### Colour-Coding Requirements (XTW-15)

The requirement specifies four statuses: research, plan, draft, scheduled. These map directly to the four pipeline stages. Recommended colour assignments using existing clawd design tokens:

| Stage | Colour Suggestion | CSS Classes | Reasoning |
|-------|------------------|-------------|-----------|
| research | Purple | `bg-review-subtle text-review` or custom purple | Exploratory, early stage |
| plan | Blue | `bg-info-subtle text-info` | Planning phase, informational |
| draft | Yellow/Orange | `bg-warning-subtle text-warning` | Work in progress, needs attention |
| scheduled | Green | `bg-success-subtle text-success` | Ready to go, confirmed |

## Layout Requirements (XTW-18)

Current XTwitterPage layout flow:

1. `XTwitterPage` renders `ThreePaneLayout` with `hideRightPane={!showApprovalPane}`
2. `showApprovalPane` = `TABS_WITH_APPROVAL.includes(activeTab)`
3. `TABS_WITH_APPROVAL = ['plan', 'drafts']` -- calendar is NOT in this list
4. When `hideRightPane=true`: right pane + resize handle hidden, center pane expands to fill

**Result:** Calendar tab already shows only two panes (chat + content). No change needed for XTW-18 -- the existing ThreePaneLayout + TABS_WITH_APPROVAL logic handles it.

For the calendar tab specifically:
- **Left pane** = XAgentChatPane (Social Manager agent chat)
- **Center pane** = XCalendarView (the refactored EpicCalendar)
- **Right pane** = Hidden (no approval queue)

## Open Questions

1. **Should research/plan/draft items appear on the calendar as all-day events?**
   - What we know: These items have `created_at` but no scheduled time. Only `x_scheduled_posts` have `scheduled_for`.
   - What's unclear: Whether showing all pipeline items on the calendar adds value, or if only scheduled posts should appear.
   - Recommendation: Show all four stages for full pipeline visibility (per XTW-15 requirement), but place research/plan/draft as all-day events on their creation date, and scheduled posts at their scheduled time.

2. **Should drag-to-reschedule work for all pipeline stages or only scheduled posts?**
   - What we know: Only scheduled posts have a `scheduled_for` field that can be updated. Research/plan/draft items don't have a schedule date.
   - What's unclear: Whether dragging a draft to a date should auto-schedule it.
   - Recommendation: Only enable drag-to-reschedule for scheduled posts (items with `source === 'x-pipeline'` and `colorId === 'scheduled'`). Other stages should be draggable=false.

3. **"Create Tweet" button action**
   - What we know: XTW-17 says "Create Tweet" button should be top-right on calendar. EpicCalendar has "New Event" button there.
   - What's unclear: What "Create Tweet" should do -- open a draft composer? Start a chat with the Writer agent?
   - Recommendation: Navigate to the drafts tab with the composer open, or trigger the XDraftComposer modal. Implementation can be a simple callback.

## Sources

### Primary (HIGH confidence)
- `/Users/worker/froggo-dashboard/src/components/EpicCalendar.tsx` -- Full 1617-line calendar component with DnD, month/week/day/agenda views
- `/Users/worker/froggo-dashboard/src/components/XCalendarView.tsx` -- Current 552-line custom calendar (to be replaced)
- `/Users/worker/froggo-dashboard/src/components/XTwitterPage.tsx` -- Tab routing, TABS_WITH_APPROVAL, ThreePaneLayout usage
- `/Users/worker/froggo-dashboard/src/components/XThreePaneLayout.tsx` -- hideRightPane mechanism
- `/Users/worker/froggo-dashboard/src/components/XContentEditorPane.tsx` -- Tab-to-component mapping
- `/Users/worker/froggo-dashboard/src/components/XAgentChatPane.tsx` -- Agent chat pane (Social Manager for calendar tab)
- `/Users/worker/froggo-dashboard/src/components/SchedulePanel.tsx` -- How EpicCalendar is currently used
- `/Users/worker/froggo-dashboard/electron/preload.ts` -- xSchedule, xDraft, xPlan, xResearch APIs
- `/Users/worker/froggo-dashboard/electron/main.ts` -- IPC handler implementations with SQL schemas
- `/Users/worker/froggo-dashboard/src/types/global.d.ts` -- CalendarEvent interface, all type definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code is in the codebase, no external dependencies needed
- Architecture: HIGH -- adapter pattern is straightforward, EpicCalendar props extension is clean
- Pitfalls: HIGH -- identified from reading actual code, not speculation
- Data model: HIGH -- read directly from IPC handlers and SQL queries in main.ts

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- stable codebase, no external dependency changes expected)
