# Task Detail Panel with Worker Progress

## Overview

A comprehensive task detail panel that displays full task information and real-time worker progress when tasks are assigned to agents.

## Features

### Task Information
- Full task details (title, description, status, project)
- Creation and update timestamps
- Current assignment status
- Quick status change actions

### Worker Progress Tracking
- Real-time session message history
- Agent activity status
- Work session timestamps
- Message categorization (user/system/assistant)

### Quick Actions
- Start work (spawn agent for task)
- Mark task as done
- Reopen completed tasks
- View agent working status

## Usage

### Opening the Detail Panel

Click any task card in the Kanban board to open its detail panel. The panel slides in from the right side of the screen.

### Viewing Worker Progress

When a task is assigned to an agent:
1. The panel shows the assigned agent details
2. If the agent is working, shows "Working..." status with animation
3. Worker Progress section displays:
   - Recent session messages (polls every 3 seconds)
   - Message timestamps
   - Message types (user/system/assistant)
   - Truncated message content (500 char limit)

### Starting Work

If a task is assigned but not yet started:
1. Click the "Start Work" button in the Assignment section
2. This spawns the assigned agent and begins work
3. Progress updates appear in real-time

### Managing Task Status

- **Mark Done**: Click to move task to "done" status
- **Reopen**: Click to move completed task back to "todo"

## Technical Details

### Components

**TaskDetailPanel.tsx**
- Main detail panel component
- Props: `task` (Task | null), `onClose` (function)
- Auto-polls worker progress every 3 seconds when agent assigned
- Slide-in animation on open

### Data Flow

1. User clicks task card → `setSelectedTask(task)` in Kanban
2. Panel loads task data from store
3. If agent assigned, fetches session history via IPC
4. Updates progress every 3 seconds while open
5. Status changes sync to store and froggo-db

### IPC Handlers

Added to support worker progress:

**Preload** (`electron/preload.ts`):
```typescript
sessions: {
  list: () => ipcRenderer.invoke('sessions:list'),
  history: (sessionKey: string, limit?: number) => 
    ipcRenderer.invoke('sessions:history', sessionKey, limit)
}
```

**Main** (`electron/main.ts`):
```typescript
ipcMain.handle('sessions:list', async () => { ... });
ipcMain.handle('sessions:history', async (_, sessionKey, limit) => { ... });
```

Both handlers call the Clawdbot gateway API:
- List: `GET http://localhost:18789/api/sessions`
- History: `GET http://localhost:18789/api/sessions/{sessionKey}/history?limit=N`

### Styling

**Animation** (`src/index.css`):
```css
@keyframes slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.animate-slide-in { animation: slide-in 0.3s ease-out; }
```

## Files Modified

1. `src/components/TaskDetailPanel.tsx` - New component
2. `src/components/Kanban.tsx` - Integrated detail panel
3. `electron/preload.ts` - Added sessions namespace
4. `electron/main.ts` - Added sessions IPC handlers
5. `src/index.css` - Added slide-in animation

## Future Enhancements

- [ ] Editable task fields in detail panel
- [ ] File attachments display
- [ ] Inline task comments
- [ ] Agent output artifacts (code, docs)
- [ ] Progress percentage/completion estimate
- [ ] Kill/pause agent functionality
- [ ] Multi-agent collaboration view
