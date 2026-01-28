# Froggo Dashboard

**AI-powered productivity hub** built with Electron, React, TypeScript, and Tailwind CSS.

---

## Features

### 🏠 Dashboard (⌘2)
- **Stats Overview:** Sessions, tasks, agents, calendar, email
- **Active Work:** Current tasks being worked on
- **Recent Activity:** Task progress and updates
- **Quick Actions:** Navigate to any panel

### 💬 Chat (⌘3)
- Direct communication with Froggo Brain via Gateway
- Message history with full context
- Send messages to running sessions/agents
- Real-time connection status

### 📋 Tasks (⌘5) - Kanban Board
- **Drag & Drop:** Move tasks between columns
- **Subtasks:** Break down work into actionable steps
- **Agent Assignment:** Assign to Coder, Researcher, Writer, Chief
- **Activity Log:** Track progress and updates
- **Priority:** P0, P1, P2, P3 levels
- **Project Labels:** Organize by project
- **Full CRUD:** Create, edit, delete tasks

### 🤖 Agents (⌘6)
- **View Active Agents:** See all running sub-agents
- **Spawn Agents:** Create Coder, Researcher, Writer, Chief
- **Monitor Progress:** Check session history and status
- **Send Messages:** Communicate with running agents

### 📅 Schedule (⌘⇧S)

#### **Epic Calendar** (Tab 1)
- **4 Views:** Month, Week, Day, Agenda
- **Multi-Account Support:** kevin@carbium.io, kevin.macarthur@bitso.com
- **CRUD Operations:** Create, edit, delete calendar events
- **Drag & Drop:** Reschedule events by dragging to new times/dates
- **Color Coding:** Different colors per account
- **Navigation:** Prev/Today/Next, Month/Year selector

**Status:** Frontend complete, backend integration pending (gog CLI commands)

#### **Content Scheduler** (Tab 2)
- **Platforms:** Twitter (280 char limit), Email
- **Composer:** Write content, select platform, schedule time
- **Approval Queue:** All posts require approval before sending
- **Management:** Edit, delete, send now, filter by status
- **Auto-execution:** Scheduled posts sent at specified time
- **Integration:** Twitter via `bird`, Email via `gog gmail`

**Status:** Production ready ✅

### 🐦 X/Twitter (⌘7)
- **Compose Tweets:** Draft and queue tweets for approval
- **Mentions:** View recent mentions
- **Home Timeline:** Browse recent tweets
- **Queue Management:** Approve/reject queued posts

### 🎤 Voice (⌘8)
- **Real-time Transcription:** Vosk streaming recognition
- **Conversation Mode:** Speak → transcribe → send → TTS response
- **Meeting Eavesdrop:** Continuous listening with action item detection
- **TTS Responses:** Web Speech API (Samantha/Karen/Daniel voices)

### 📥 Inbox (⌘1)
- **Approval Queue:** Review tweets, emails, messages before sending
- **Quick Actions:** Approve, reject, edit, schedule
- **Filters:** Pending, approved, rejected
- **Batch Operations:** Approve all
- **Integration:** Auto-populated by agents and schedulers

### 📱 Sessions (⌘4)
- **View All Sessions:** Discord, Telegram, WhatsApp, Web, Cron, Sub-agents
- **Channel Filter:** Filter by platform
- **Session History:** View message transcripts
- **Direct Messaging:** Send messages to any session

---

## Keyboard Shortcuts

| Shortcut | Panel | Description |
|----------|-------|-------------|
| ⌘1 | Inbox | Approval queue |
| ⌘2 | Dashboard | Stats & overview |
| ⌘3 | Chat | Talk to Froggo |
| ⌘4 | Sessions | All sessions |
| ⌘5 | Tasks | Kanban board |
| ⌘6 | Agents | Agent management |
| ⌘7 | X | Twitter integration |
| ⌘8 | Voice | Voice assistant |
| ⌘⇧S | Schedule | Calendar + Scheduler |
| ⌘K | Command | Quick navigation |
| ⌘, | Settings | App preferences |

---

## Tech Stack

- **Framework:** Electron + React
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Calendar:** Custom EpicCalendar component
- **Voice:** Vosk (real-time), Whisper (fallback)
- **Database:** SQLite (froggo.db)
- **Backend:** Clawdbot Gateway (Node.js)

---

## Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Clawdbot Gateway running

### Setup
```bash
cd ~/clawd/clawd-dashboard
npm install
```

### Run Dev Mode
```bash
npm run electron:dev
```

### Build Production
```bash
npm run electron:build
```

**Output:** `release/mac-arm64/Froggo.app`

---

## File Structure

```
clawd-dashboard/
├── electron/
│   ├── main.ts          # Electron main process + IPC handlers
│   └── preload.ts       # Bridge between main/renderer
├── src/
│   ├── components/      # React components
│   │   ├── Dashboard.tsx
│   │   ├── EpicCalendar.tsx     # 634 lines, 4 views + CRUD
│   │   ├── ContentScheduler.tsx # 439 lines, scheduler UI
│   │   ├── Kanban.tsx
│   │   ├── VoicePanel.tsx
│   │   └── ...
│   ├── lib/
│   │   └── gateway.ts   # Gateway communication
│   ├── store/
│   │   └── store.ts     # Zustand state management
│   ├── types/
│   │   └── global.d.ts  # TypeScript definitions
│   └── App.tsx          # Main app component
├── public/              # Static assets
└── package.json
```

---

## Configuration

### Gateway Connection
Set in Electron main process (`electron/main.ts`):
```typescript
const GATEWAY_URL = 'http://localhost:3355';
```

### Database
Location: `~/clawd/data/froggo.db`

Tables:
- `tasks` - Kanban tasks
- `subtasks` - Task breakdown
- `activities` - Task activity log
- `schedule` - Scheduled posts
- `inbox` - Approval queue
- `facts` - Memory/learnings
- `work_log` - Work tracking

---

## Integration

### Clawdbot Gateway
Dashboard communicates with Gateway via HTTP + IPC:
- **Status:** Connection health check
- **Sessions:** List all active sessions
- **Tasks:** Sync with froggo-db
- **Inbox:** Approval queue management
- **Schedule:** Scheduled post management
- **Agents:** Spawn and communicate with sub-agents

### External Services
- **Google Calendar:** Via `gog calendar` CLI
- **Gmail:** Via `gog gmail` CLI
- **Twitter:** Via `bird` CLI
- **WhatsApp:** Via `wacli` CLI

---

## Troubleshooting

### Dashboard won't load
1. Check Gateway is running: `clawdbot status`
2. Check logs: `~/Library/Logs/Froggo/main.log`
3. Restart app: `pkill Froggo && open ~/clawd/clawd-dashboard/release/mac-arm64/Froggo.app`

### Calendar not loading events
1. Verify gog CLI: `which gog`
2. Check OAuth: `gog calendar events --days 7`
3. Check accounts: `GOG_ACCOUNT=kevin@carbium.io gog calendar events --days 7`

### Voice not working
1. Check Vosk model: `ls ~/clawd/vosk-models/`
2. Grant mic permissions: System Settings → Privacy → Microphone → Froggo
3. Test Vosk: Check console for "Vosk available" message

---

## Known Issues

### Calendar CRUD Operations
**Status:** Frontend complete, backend blocked

**Issue:** `gog calendar` CLI missing create/update/delete commands

**Workaround:** Read-only calendar works. CRUD operations implemented but cannot save until backend commands added.

**Required commands:**
```bash
gog calendar events create --summary "..." --start "..." --end "..."
gog calendar events update --event-id "..." --summary "..."
gog calendar events delete --event-id "..."
```

---

## Contributing

This is Kevin's personal productivity hub. Not open for external contributions.

For internal work:
1. Create task in Kanban
2. Assign to appropriate agent
3. Document in task activity log
4. Update CHANGELOG.md
5. Commit with descriptive message

---

## Support

**Internal use only.**  
Questions → Ask Froggo via Chat panel (⌘3)

---

## License

Proprietary - Kevin MacArthur © 2026
