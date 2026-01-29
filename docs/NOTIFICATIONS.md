# System Notifications

Native OS notifications for Froggo Dashboard with action buttons and comprehensive event handling.

## Overview

The notification system provides real-time native OS notifications for important events:
- ✅ **Task Completions** - When tasks are marked as complete
- ⚠️ **Agent Failures** - When agents encounter blockers or failures
- 🔔 **Approval Requests** - When items enter the approval queue
- 💬 **Chat Mentions** - When you're mentioned in conversations

## Features

### Native OS Integration
- **macOS**: Full notification center integration with action buttons
- **Windows**: Windows notification system support
- **Linux**: Desktop notification daemon integration

### Action Buttons (macOS)
Notifications can include action buttons that trigger actions without opening the app:
- **Approve/Dismiss** - Quick approval actions
- **View Task** - Navigate directly to task details
- **View Chat** - Jump to relevant conversation

### Smart Notification Management
- **Quiet Hours** - Suppress notifications during specified times
- **Priority Levels** - Filter by notification importance
- **Sound Control** - Per-notification-type sound settings
- **Preview Control** - Show/hide message previews for privacy
- **Do Not Disturb** - Global notification pause with timer

### Event Detection
The system automatically monitors:
- Task activity table for completions and agent status
- Approval queue for new requests
- Session logs for mentions and important messages

## Architecture

### Components

```
electron/notification-service.ts
├── NotificationService class
│   ├── Preference management (load/save)
│   ├── Native notification display
│   ├── Action button handling
│   └── Navigation triggers
└── IPC handlers
    ├── notifications:get-prefs
    ├── notifications:update-prefs
    ├── notifications:send
    └── notifications:test

electron/main.ts
└── Event listeners
    ├── Task activity watcher (10s interval)
    ├── Approval queue watcher (file system)
    └── Chat mention watcher (15s interval)

src/hooks/useNotifications.ts
├── React hook for notification management
├── Action handlers
├── Navigation from notifications
└── Convenience methods

src/components/
├── NotificationSettingsModal.tsx - Per-conversation settings
├── GlobalNotificationSettings.tsx - Global defaults
└── NotificationTester.tsx - Development testing tool
```

### Data Flow

```
Event Occurs
  ↓
Event Listener Detects (electron/main.ts)
  ↓
NotificationService.show() (electron/notification-service.ts)
  ↓
Check Preferences (enabled, quiet hours, etc.)
  ↓
Display Native Notification
  ↓
User Clicks/Takes Action
  ↓
IPC Event → Renderer Process
  ↓
useNotifications Hook Handles Action
  ↓
Navigate or Execute Action
```

## Usage

### React Components

```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const {
    preferences,
    recentNotifications,
    testNotification,
    notifyTaskCompleted,
    notifyAgentFailed,
    notifyApprovalNeeded,
    notifyChatMention,
  } = useNotifications();

  // Send task completion notification
  const handleTaskComplete = async () => {
    await notifyTaskCompleted('Implement feature X', 'task-123');
  };

  // Send agent failure notification
  const handleAgentError = async () => {
    await notifyAgentFailed(
      'Coder',
      'Fix bug Y',
      'Missing dependencies',
      'task-456'
    );
  };

  // Send approval request notification
  const handleNewApproval = async () => {
    await notifyApprovalNeeded('Tweet: Hello World!', 'approval-789');
  };

  // Send chat mention notification
  const handleMention = async () => {
    await notifyChatMention(
      'Kevin',
      'Hey @Froggo, can you help?',
      'session-abc'
    );
  };

  return (
    <div>
      <button onClick={handleTaskComplete}>Notify Task Complete</button>
      <button onClick={testNotification}>Test Notification</button>
    </div>
  );
}
```

### Custom Notifications

```typescript
import { useNotifications } from '../hooks/useNotifications';

const { sendNotification } = useNotifications();

await sendNotification({
  type: 'info',
  title: 'Custom Notification',
  body: 'This is a custom message',
  urgency: 'normal',
  silent: false,
  actions: [
    { type: 'custom-action', text: 'Do Something' }
  ],
  data: { customField: 'value' }
});
```

### Preference Management

```typescript
const { preferences, updatePreferences } = useNotifications();

// Update specific preferences
await updatePreferences({
  taskCompletions: true,
  agentFailures: true,
  sound: false,
  showPreviews: true
});
```

## Notification Types

### Task Completed
```typescript
notificationService.taskCompleted(taskTitle: string, taskId: string)
```
- **Icon**: ✅
- **Title**: "Task Completed"
- **Body**: Task title
- **Click Action**: Navigate to tasks view
- **Data**: `{ taskId }`

### Agent Failure
```typescript
notificationService.agentFailed(
  agentName: string,
  taskTitle: string,
  reason: string,
  taskId?: string
)
```
- **Icon**: ⚠️
- **Title**: "{agentName} Blocked"
- **Body**: Task title + reason
- **Urgency**: Critical
- **Click Action**: Navigate to agents view
- **Data**: `{ taskId, agentName, reason }`

### Approval Needed
```typescript
notificationService.approvalNeeded(itemTitle: string, itemId: string)
```
- **Icon**: 🔔
- **Title**: "Approval Needed"
- **Body**: Item title
- **Actions**: [Approve, Dismiss]
- **Click Action**: Navigate to inbox
- **Data**: `{ itemId }`

### Chat Mention
```typescript
notificationService.chatMention(from: string, preview: string, sessionId?: string)
```
- **Icon**: 💬
- **Title**: "{from} mentioned you"
- **Body**: Message preview
- **Click Action**: Navigate to chat
- **Data**: `{ from, sessionId }`

## Preferences

### Global Defaults
Stored in: `~/clawd/data/notification-prefs.json`

```json
{
  "enabled": true,
  "taskCompletions": true,
  "agentFailures": true,
  "approvalRequests": true,
  "chatMentions": true,
  "sound": true,
  "showPreviews": true
}
```

### Per-Conversation Settings
Managed via NotificationSettingsModal component:
- Override global defaults per conversation
- Custom keywords for alerts
- Conversation-specific quiet hours
- Quick mute actions (1h, 4h, 24h, 1 week)

## Action Handlers

Action buttons in notifications trigger IPC events that are handled in the renderer:

```typescript
// In useNotifications hook
handleNotificationAction(action: NotificationAction) {
  switch (action.actionType) {
    case 'approve':
      navigate(`/inbox?action=approve&id=${action.data.itemId}`);
      break;
    case 'dismiss':
      // Handle dismissal
      break;
    case 'view-task':
      navigate(`/tasks?id=${action.data.taskId}`);
      break;
    case 'view-chat':
      navigate(`/chat?session=${action.data.sessionId}`);
      break;
  }
}
```

## Development & Testing

### NotificationTester Component
Development tool for testing all notification types:

```typescript
import NotificationTester from '../components/NotificationTester';

// Add to your dev build
<NotificationTester />
```

Features:
- Quick test buttons for all notification types
- View recent notifications
- Check current preferences
- Testing tips and guidance

### Testing Checklist
- [ ] macOS notification center permissions granted
- [ ] Notifications appear in notification center
- [ ] Click notification focuses app and navigates correctly
- [ ] Action buttons work (macOS only)
- [ ] Sound plays (if enabled)
- [ ] Quiet hours respected
- [ ] Preferences save/load correctly
- [ ] Do Not Disturb mode works
- [ ] Per-conversation settings override globals

## Event Monitoring

### Task Activity Monitoring
Polls `task_activity` table every 10 seconds:
```sql
SELECT a.*, t.title as task_title 
FROM task_activity a 
JOIN tasks t ON a.task_id = t.id 
WHERE a.timestamp > [last_check]
```

Triggers:
- `action = 'completed'` → Task completion notification
- `action = 'blocked' or 'failed'` → Agent failure notification

### Approval Queue Monitoring
Watches `~/clawd/approvals/queue.json` for changes via file system watcher.
Triggers notification for new items in queue.

### Chat Mention Monitoring
Polls `~/.clawdbot/sessions/*.json` every 15 seconds.
Searches for mentions (@Kevin, "Kevin") in recent messages.

## Platform-Specific Notes

### macOS
- Full notification center integration
- Action buttons supported
- Badge updates
- Focus/restore on click

### Windows
- Windows 10+ notification system
- Limited action button support
- Toast notifications

### Linux
- Desktop notification daemon required
- Varies by distribution
- Basic notification support

## Troubleshooting

### Notifications Not Appearing
1. Check system notification permissions
2. Verify `enabled: true` in preferences
3. Check Do Not Disturb mode
4. Test with `testNotification()`
5. Check quiet hours settings

### Action Buttons Not Working
- Action buttons only work on macOS
- Other platforms show click-only notifications

### Sounds Not Playing
1. Check `sound: true` in preferences
2. Verify system volume
3. Check per-notification-type settings

### Navigation Not Working
1. Check browser console for errors
2. Verify IPC handlers registered
3. Test with NotificationTester component

## API Reference

### IPC Handlers (Electron Main)
```typescript
ipcMain.handle('notifications:get-prefs', async () => Promise<NotificationPreferences>)
ipcMain.handle('notifications:update-prefs', async (_, updates) => Promise<{success: boolean}>)
ipcMain.handle('notifications:send', async (_, options) => Promise<{success: boolean}>)
ipcMain.handle('notifications:test', async () => Promise<{success: boolean}>)
```

### IPC Events (Electron → Renderer)
```typescript
'notification-received' → { type, title, body, timestamp, data }
'notification-action' → { actionType, data }
'navigate-to-view' → (view, data)
'notification-prefs-updated' → NotificationPreferences
```

### Hook Methods
```typescript
useNotifications() => {
  preferences: NotificationPreferences | null
  recentNotifications: SystemNotification[]
  loadPreferences: () => Promise<void>
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>
  sendNotification: (options: NotificationOptions) => Promise<void>
  testNotification: () => Promise<void>
  notifyTaskCompleted: (title: string, taskId: string) => Promise<void>
  notifyAgentFailed: (agent: string, task: string, reason: string, taskId?: string) => Promise<void>
  notifyApprovalNeeded: (title: string, itemId: string) => Promise<void>
  notifyChatMention: (from: string, preview: string, sessionId?: string) => Promise<void>
}
```

## Future Enhancements

- [ ] Notification history panel in dashboard
- [ ] Custom sound files per notification type
- [ ] Advanced filtering rules
- [ ] Notification templates
- [ ] Batch notification summaries
- [ ] Push notifications to mobile devices
- [ ] Webhook integrations for external notifications

## See Also

- [Settings Panel Documentation](./SETTINGS.md)
- [Task System Documentation](./TASKS.md)
- [Agent System Documentation](./AGENTS.md)
- [Chat System Documentation](./CHAT.md)
