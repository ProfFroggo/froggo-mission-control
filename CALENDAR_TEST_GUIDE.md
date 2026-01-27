# Unified Calendar Panel Test Guide

## 🎯 What to Test

The Unified Calendar shows **three types of events** in one view:
1. **🗓️ Google Calendar events** (blue)
2. **🐦 Scheduled posts** (purple) - tweets, emails
3. **✅ Task deadlines** (green) - Kanban tasks with due dates

## Quick Test Checklist

### ✅ Phase 0: Unified View Verification
1. Start the dashboard: `cd ~/clawd/clawd-dashboard && npm run electron:dev`
2. Navigate to Calendar panel (Cmd+5 or via Sidebar)
3. Verify you see "Unified Calendar" as the title
4. Check for filter toggles below the header:
   - 🗓️ Calendar (blue)
   - 🐦 Posts (purple)
   - ✅ Tasks (green)
5. Each toggle should show a count
6. Verify events from all three sources appear in the list

### ✅ Phase 1: Basic UI & Navigation
1. Start the dashboard: `cd ~/clawd/clawd-dashboard && npm run electron:dev`
2. On the Dashboard, verify CalendarWidget displays upcoming events
3. Click the "Open Full Calendar" icon (external link) in CalendarWidget header
4. Should navigate to the full CalendarPanel view

### ✅ Phase 2: View Calendar Events
1. In CalendarPanel, verify events are loading from Google Calendar
2. Check that events are grouped by date (Today, Tomorrow, etc.)
3. Verify urgent events (< 1 hour) have yellow border + countdown badge
4. Check event details display: title, time, location, attendees

### ✅ Phase 3: Multi-Account Support
1. Click the account selector buttons at the top
2. Switch between: Bitso (Work), Carbium, Personal
3. Verify events reload for the selected account

### ✅ Phase 4: View Modes (Future Enhancement)
1. Click Day/Week/Month view buttons
2. Currently shows list view for all modes
3. Events auto-refresh every 5 minutes

### ✅ Phase 5: Create Event
1. Click "New Event" button (top right)
2. Fill in the form:
   - **Title:** "Test Event" (required)
   - **Start Date:** Today or tomorrow (required)
   - **Start Time:** Any time (or toggle "All day")
   - **Location:** "Test Location"
   - **Description:** "This is a test"
   - **Attendees:** "test@example.com" (comma-separated)
   - **Recurrence:** Select "Daily" or "Weekly"
   - **Time Zone:** Select your timezone
3. Click "Create Event"
4. Should show success toast
5. Event should appear in the list
6. Verify in Google Calendar web interface

### ✅ Phase 6: Edit Event
1. Click the Edit icon (pencil) on any event
2. Modify the title or other fields
3. Click "Update Event"
4. Should show success toast
5. Changes should be reflected in the list
6. Verify in Google Calendar

### ✅ Phase 7: Delete Event
1. Click the Delete icon (trash) on any event
2. Confirm the deletion dialog
3. Should show success toast
4. Event should disappear from list
5. Verify removal in Google Calendar

### ✅ Phase 8: Refresh
1. Make a change in Google Calendar web interface
2. Click the Refresh button in CalendarPanel
3. Changes should appear in the dashboard

### ✅ Phase 9: All-Day Events
1. Create a new event
2. Toggle "All day event" checkbox
3. Start/End time fields should hide
4. Only date fields visible
5. Create and verify event shows "All day" in list

### ✅ Phase 10: Recurring Events
1. Create a new event with recurrence
2. Select "Daily", "Weekly", or "Monthly"
3. Event should show a recurrence icon (↻) in list
4. Verify recurrence in Google Calendar

### ✅ Phase 11: Filter Toggles (UNIFIED CALENDAR)
1. Verify all three filter toggles are visible
2. Click "Calendar" toggle to hide Google Calendar events
   - Blue events disappear
   - Count updates to 0
   - Click again to show them
3. Click "Posts" toggle to hide scheduled posts
   - Purple events disappear
   - Count updates to 0
   - Click again to show them
4. Click "Tasks" toggle to hide task deadlines
   - Green events disappear
   - Count updates to 0
   - Click again to show them
5. Try toggling all three off - should show empty state
6. Toggle all back on - all events return

### ✅ Phase 12: Event Type Differentiation
1. **Calendar events** should have:
   - Blue left border
   - Calendar icon in blue circle
   - Edit and Delete buttons
   - Location and attendees (if any)
2. **Scheduled posts** should have:
   - Purple left border
   - X icon (tweets) or Mail icon (emails)
   - Status badge (pending/sent)
   - No edit/delete buttons (use Schedule panel)
3. **Task deadlines** should have:
   - Green left border
   - CheckCircle icon in green circle
   - Priority badge (high/medium/low)
   - Project tag
   - No edit/delete buttons (use Kanban panel)

### ✅ Phase 13: Click Behavior by Type
1. Click a **calendar event**:
   - Should open edit modal
   - Can modify and save
2. Click a **scheduled post**:
   - Should show info toast
   - Says "Edit via Schedule panel"
3. Click a **task deadline**:
   - Should show info toast
   - Says "View in Tasks panel"

## Command-Line Testing

### Test gog CLI Directly
```bash
# List events
GOG_ACCOUNT=kevin.macarthur@bitso.com gog calendar events --days 7 --json

# Create test event
GOG_ACCOUNT=kevin.macarthur@bitso.com gog calendar create primary \
  --summary "CLI Test Event" \
  --from "2026-01-28T14:00:00+01:00" \
  --to "2026-01-28T15:00:00+01:00" \
  --location "Test Location"

# Update event (replace EVENT_ID)
GOG_ACCOUNT=kevin.macarthur@bitso.com gog calendar update primary EVENT_ID \
  --summary "Updated Title"

# Delete event (replace EVENT_ID)
GOG_ACCOUNT=kevin.macarthur@bitso.com gog calendar delete primary EVENT_ID
```

### Check IPC Handlers
```bash
# From Electron DevTools Console:
window.clawdbot.calendar.events('kevin.macarthur@bitso.com', 7)
window.clawdbot.calendar.createEvent({
  account: 'kevin.macarthur@bitso.com',
  title: 'Console Test',
  start: '2026-01-28T15:00:00+01:00',
  end: '2026-01-28T16:00:00+01:00'
})
```

## Expected Results

### Success Indicators
- ✅ CalendarWidget loads on Dashboard
- ✅ "Open Full Calendar" button navigates to CalendarPanel
- ✅ Events load and display correctly
- ✅ Account switching works
- ✅ Create event modal opens and functions
- ✅ Events created via UI appear in Google Calendar
- ✅ Edit event updates successfully
- ✅ Delete event removes from calendar
- ✅ Toast notifications appear for all actions
- ✅ No console errors

### Error Handling
- Form validation prevents empty title/date
- Network errors show user-friendly messages
- Failed operations show error toasts
- Refresh button available to retry

## Troubleshooting

### If events don't load:
1. Check `gog` CLI is installed: `which gog`
2. Verify OAuth: `gog calendar events --account kevin.macarthur@bitso.com`
3. Check Electron console for errors
4. Verify IPC handlers in main.ts

### If create/update/delete fails:
1. Check command syntax in Electron logs
2. Test gog CLI directly (see above)
3. Verify calendar ID is "primary"
4. Check GOG_ACCOUNT environment variable

### If UI doesn't update:
1. Check network tab in DevTools
2. Verify IPC responses in console
3. Click Refresh button manually
4. Check if events array is updating

## Known Limitations

1. **View modes:** Month/week views show list format (future: grid calendar)
2. **Recurring events:** Can create but not edit recurrence (gog CLI limitation)
3. **Calendar selection:** Uses "primary" calendar only (future: multi-calendar)
4. **Time zone:** Respects selected timezone but doesn't auto-detect
5. **Attendees:** Shows count but no RSVP status

## Future Enhancements

- Grid-based month/week calendar view
- Drag-and-drop event rescheduling
- Event color coding
- Conflict detection
- Calendar sync status indicator
- Event search/filter
- Quick event creation (natural language)
- Meeting links (Google Meet integration)
- Reminders UI
- Export to .ics

---

**Status:** ✅ Ready for testing
**Build:** ✅ Passing
**Documentation:** ✅ Complete
