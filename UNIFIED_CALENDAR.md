# Unified Calendar - Phase 1 Implementation

## 🎯 Vision: One Calendar, All Commitments

The Unified Calendar consolidates **three types of time commitments** into a single view:

1. **🗓️ Google Calendar Events** - Meetings, appointments, personal events
2. **🐦 Scheduled Posts** - Tweets, emails, social content ready to publish
3. **✅ Task Deadlines** - Kanban tasks with due dates

**Why This Matters:** Instead of checking multiple panels, see ALL time commitments in one place.

---

## 🎨 Visual Design

### Event Type Styling

| Type | Icon | Color | Border | Background |
|------|------|-------|--------|------------|
| Calendar Event | 🗓️ Calendar | Blue | `border-l-blue-500` | `bg-blue-500/10` |
| Scheduled Post | 🐦 X / 📧 Mail | Purple/White | `border-l-purple-500` | `bg-purple-500/10` |
| Task Deadline | ✅ CheckCircle | Green | `border-l-green-500` | `bg-green-500/10` |

### Additional Indicators

- **Urgent events** (< 1 hour): Yellow border + countdown badge
- **Priority badges** (tasks): Red (high), Yellow (medium), Gray (low)
- **Status badges** (posts): Purple (pending), Green (sent)
- **Recurring icon**: ↻ for repeating calendar events
- **Project tags**: Gray pill for task projects

---

## 🔧 Implementation Details

### Data Sources

#### 1. Google Calendar Events
```typescript
const calResult = await window.clawdbot.calendar.events(selectedAccount, daysToFetch);
```
- Pulls from `gog calendar events --json`
- Multi-account support (Bitso, Carbium, Personal)
- Supports recurring events, all-day events, attendees

#### 2. Scheduled Posts
```typescript
const scheduleResult = await window.clawdbot.schedule.list();
```
- Pulls from schedule system (tweet, email, message)
- Shows only pending items by default
- Displays content preview in title

#### 3. Task Deadlines
```typescript
const tasksResult = await window.clawdbot.tasks.list();
```
- Filters tasks with `dueDate` field
- Excludes completed tasks (`status !== 'done'`)
- Shows project, priority, assignee

### Unified Event Model

```typescript
interface UnifiedEvent {
  id: string;              // Prefixed: 'cal_', 'post_', 'task_'
  type: 'calendar' | 'post' | 'task';
  title: string;
  start: string;           // ISO date/time
  end?: string;
  
  // Calendar-specific
  location?: string;
  attendees?: { email: string; displayName?: string }[];
  description?: string;
  isAllDay?: boolean;
  recurring?: boolean;
  account?: string;
  timeZone?: string;
  
  // Post-specific
  postType?: 'tweet' | 'email' | 'message';
  content?: string;
  status?: 'pending' | 'sent' | 'cancelled' | 'failed';
  
  // Task-specific
  taskId?: string;
  project?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}
```

---

## 🎛️ Features

### Filter Toggles
Located in the header below account selector:

- **🗓️ Calendar** (Blue) - Show/hide Google Calendar events
- **🐦 Posts** (Purple) - Show/hide scheduled posts
- **✅ Tasks** (Green) - Show/hide task deadlines

Each toggle shows the count of filtered items.

### Interaction Behavior

**Click behavior varies by event type:**

| Type | Action |
|------|--------|
| Calendar Event | Opens edit modal (full CRUD) |
| Scheduled Post | Shows info toast ("Edit via Schedule panel") |
| Task Deadline | Shows info toast ("View in Tasks panel") |

**Future Enhancement:** Deep links to appropriate panels (navigate to task detail, post edit)

### CRUD Operations (Calendar Events Only)

- **Create** - "New Event" button → Full form modal
- **Edit** - Pencil icon → Pre-filled modal
- **Delete** - Trash icon → Confirmation dialog

Only calendar events support inline CRUD. Posts and tasks should be edited in their respective panels.

---

## 📊 Data Flow

```
CalendarPanel
  ├─ fetchEvents()
  │   ├─ Fetch Google Calendar (showCalendarEvents = true)
  │   ├─ Fetch Scheduled Posts (showScheduledPosts = true)
  │   └─ Fetch Task Deadlines (showTaskDeadlines = true)
  │
  ├─ Merge & Sort by start time
  │
  └─ Group by date (Today, Tomorrow, Specific dates)
      └─ Render with type-specific styling
```

---

## 🧪 Testing Guide

### Verification Steps

1. **Calendar Events**
   - ✅ Shows existing Google Calendar events
   - ✅ Color: Blue border + Calendar icon
   - ✅ Click opens edit modal
   - ✅ Can create/edit/delete

2. **Scheduled Posts**
   - ✅ Shows pending tweets/emails from schedule system
   - ✅ Color: Purple border + X/Mail icon
   - ✅ Shows status badge (pending)
   - ✅ Click shows info toast

3. **Task Deadlines**
   - ✅ Shows tasks with due dates
   - ✅ Color: Green border + CheckCircle icon
   - ✅ Shows priority badge + project tag
   - ✅ Click shows info toast

4. **Filtering**
   - ✅ Toggle each type on/off
   - ✅ Counts update correctly
   - ✅ Events disappear/reappear

5. **Urgency**
   - ✅ Events < 1 hour get yellow border
   - ✅ Countdown badge appears
   - ✅ Works for all event types

### Test Data Setup

```bash
# Create a Google Calendar event (via dashboard UI or gog)
gog calendar create primary --summary "Test Meeting" \
  --from "2026-01-28T15:00:00+01:00" --to "2026-01-28T16:00:00+01:00"

# Schedule a post (via dashboard Schedule panel)
# Or via Electron console:
window.clawdbot.schedule.add({
  type: 'tweet',
  content: 'Test scheduled tweet',
  scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
})

# Create a task with due date (via dashboard Kanban)
# Or via Electron console:
window.clawdbot.tasks.sync({
  title: 'Test task',
  status: 'todo',
  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  project: 'Dashboard'
})
```

---

## 🚀 Future Enhancements

### Phase 2: Grid Calendar View
- Month grid with cells for each day
- Week view with time slots
- Day view with hourly breakdown
- Drag-and-drop rescheduling

### Phase 3: Deep Links
- Click post → Navigate to Schedule panel with post selected
- Click task → Navigate to Kanban with TaskDetailPanel open
- Click calendar event → Keep current modal (already working)

### Phase 4: Quick Actions
- Snooze task deadline
- Reschedule post (drag to new time)
- Mark task done from calendar
- Send post now (without opening Schedule panel)

### Phase 5: Advanced Features
- Conflict detection (overlapping events)
- Smart scheduling suggestions
- Calendar sync across accounts
- Export to .ics
- Natural language event creation ("tomorrow at 3pm")
- Recurring task support

---

## 📁 Files Modified

- ✅ `src/components/CalendarPanel.tsx` - Complete rewrite for unified view
- ✅ `electron/main.ts` - Calendar CRUD handlers (already added)
- ✅ `electron/preload.ts` - IPC bindings (already exist)

---

## 🎯 Status

**Phase 1: Unified Calendar View** ✅ **COMPLETE**

- ✅ Multi-source data fetching
- ✅ Type-based styling & icons
- ✅ Filter toggles
- ✅ Event grouping by date
- ✅ Urgency indicators
- ✅ Calendar event CRUD
- ✅ Click handlers (info toasts for post/task)
- ✅ Build passing
- ✅ Ready for testing

**Next:** Test with real data, then add deep links in Phase 2.

---

## 💡 Key Innovation

**Before:** Three separate views for time commitments  
**After:** One unified timeline showing everything

**User Benefit:** At a glance, see conflicts, gaps, and full schedule across work, content, and tasks.

---

**Implementation Time:** ~1 hour (enhancement from original calendar implementation)  
**Build Status:** ✅ Passing  
**Documentation:** ✅ Complete
