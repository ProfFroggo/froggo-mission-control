# Calendar Source Toggles - Implementation Proof

## Files Created/Modified

### 1. NEW FILE: CalendarFilterModal.tsx
\`\`\`bash
$ wc -l src/components/CalendarFilterModal.tsx
     335 src/components/CalendarFilterModal.tsx
\`\`\`

**Features:**
- Filter button triggers modal
- Lists all calendar sources (Google accounts, Social, Mission Control, Holidays)
- Toggle each source on/off
- Color indicators per source
- Select All / Deselect All
- Save to localStorage
- Real-time filter application

### 2. MODIFIED: CalendarPanel.tsx
**Changes:**
- Added \`CalendarFilterModal\` import
- Added \`showFilterModal\` state
- Added \`enabledCalendarSources\` state
- Added \`isSourceEnabled()\` check function
- Modified \`fetchEvents()\` to fetch from ALL accounts (not just selected)
- Apply source filters before displaying events
- Added "Calendars" filter button in header
- Load preferences from localStorage on mount

### 3. MODIFIED: SettingsPanel.tsx
**New Section Added: "Calendar Accounts"**
- List all authenticated Google accounts
- Status indicators (green=connected, red=error)
- Calendar count per account
- "Add Account" button → launches gog auth
- "Remove Account" button → deletes credentials
- "Test Connection" button → verifies account status
- Loading states & empty states

### 4. MODIFIED: electron/main.ts
**5 New IPC Handlers Added:**
\`\`\`typescript
ipcMain.handle('calendar:listCalendars', ...)    // List calendars for account
ipcMain.handle('calendar:listAccounts', ...)     // Check which accounts are authenticated
ipcMain.handle('calendar:addAccount', ...)       // Launch gog auth flow
ipcMain.handle('calendar:removeAccount', ...)    // Delete account credentials
ipcMain.handle('calendar:testConnection', ...)   // Test if account works
\`\`\`

### 5. MODIFIED: electron/preload.ts
**Extended calendar object with:**
\`\`\`typescript
calendar: {
  // Existing...
  events: (account?, days?) => ...
  createEvent: (params) => ...
  updateEvent: (params) => ...
  deleteEvent: (params) => ...
  
  // NEW:
  listAccounts: () => ...
  listCalendars: (account) => ...
  addAccount: () => ...
  removeAccount: (account) => ...
  testConnection: (account) => ...
}
\`\`\`

## User Flow

### Filter Calendars:
1. Open Calendar panel
2. Click "Calendars" button (next to Refresh)
3. Modal opens showing all sources
4. Toggle sources on/off
5. Click "Apply Filters"
6. Events refresh with only enabled sources

### Manage Accounts:
1. Open Settings (⌘,)
2. Scroll to "Calendar Accounts" section
3. See list of accounts with status
4. Click "Add Account" → Terminal opens for OAuth
5. Click "Test Connection" → verify status
6. Click trash icon → remove account (with confirmation)

## Technical Details

### localStorage Key
\`calendar-filter-preferences\` stores array of enabled source IDs:
\`\`\`json
[
  "google:kevin.macarthur@bitso.com",
  "google:kevin@carbium.io",
  "social:twitter",
  "mission-control:tasks"
]
\`\`\`

### Source ID Format
- Google: \`google:{email}\` or \`google:{email}:{calendar_id}\`
- Social: \`social:twitter\`
- Mission Control: \`mission-control:tasks\`
- Holidays: \`holidays:gibraltar\`

### gog CLI Integration
All account management uses gog CLI:
- List calendars: \`GOG_ACCOUNT={email} gog calendar calendars --json\`
- Auth: \`gog auth\` (opens browser for OAuth)
- Remove: Delete \`~/Library/Application Support/gogcli/{email}.json\`

## Benefits

✅ **Multi-account support** - All Google accounts shown in one view  
✅ **Granular filtering** - Toggle individual calendar sources  
✅ **Persistent preferences** - Filters saved to localStorage  
✅ **Account management** - Add/remove accounts from Settings  
✅ **Status monitoring** - Test connection to verify accounts work  
✅ **Unified view** - Calendar events + social posts + tasks in one place  

## Screenshots (Manual Testing Required)

1. Calendar Panel with filter button
2. Filter modal showing all sources
3. Settings panel with Calendar Accounts section
4. Account status indicators (green/red)
5. Terminal window for gog auth flow

---

**Status:** Implementation complete, ready for testing
**Files:** 5 files modified/created
**Lines added:** ~500 LOC
