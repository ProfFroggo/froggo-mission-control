# 🐂 Ox Lite Dashboard

**Lightweight sub-agent dashboard for Ox (Bitso Onchain worker)**

## Features

### ✅ Task Inbox
- View tasks assigned from Froggo/Kevin
- Filter by status (all/todo/in-progress)
- Priority badges, subtask progress
- Empty state when no tasks

### ✅ Workload Tracker
- Mini Kanban board (To Do → In Progress → Review → Done)
- Visual task cards with priority
- Subtask completion tracking
- Footer stats

### ✅ Sub-Agent Management
- Spawn/track sub-agents (coder/writer/researcher)
- 6-agent capacity limit (Kevin's rule)
- Status monitoring (idle/working/completed/error)
- Running time tracking

### ✅ Guardrails & Settings
- Max sub-agent limits
- Allowed agent types
- Approval requirements (external/financial/api-keys)
- Auto-escalate toggle
- Time limits
- Notify Froggo toggle

### ✅ Analytics
- Tasks completed, success rate
- Avg completion time
- Hours worked
- Time range filter (today/week/month)
- Recent activity list

## Tech Stack
- React + TypeScript
- Electron
- Tailwind CSS
- Zustand (state management)
- Lucide icons

## Quick Start

```bash
cd ~/clawd/ox-lite-dashboard
npm install
npm run electron:dev
```

## Build

```bash
npm run electron:build
```

## Design

- **Theme:** Amber/orange (workhouse energy)
- **Branding:** 🐂 Ox Lite
- **Focus:** Sub-agent work management
- **Parent:** Forked from Froggo Dashboard

## Protocol Integration

Receives tasks via Discord #froggo-ox-tasks channel:
- `TASK_ASSIGN` → Appears in inbox
- `TASK_UPDATE` → Sent for each subtask
- `TASK_COMPLETE` → Sent when done

---

Built by Ox • Bitso Onchain Worker • v1.0.0
