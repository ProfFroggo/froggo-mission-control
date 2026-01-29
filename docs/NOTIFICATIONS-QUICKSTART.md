# Notifications Quick Start

Get system notifications working in 5 minutes.

## TL;DR

```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const { notifyTaskCompleted } = useNotifications();
  
  const handleComplete = async () => {
    await notifyTaskCompleted('My Task', 'task-123');
  };
  
  return <button onClick={handleComplete}>Test</button>;
}
```

## Setup Checklist

### 1. System Permissions (macOS)
```bash
# Check notification permissions
open "x-apple.systempreferences:com.apple.preference.notifications"

# Find "Froggo" app and enable:
☑️ Allow Notifications
☑️ Show in Notification Center
☑️ Sounds
☑️ Badges
```

### 2. Test Notifications

```typescript
// Add NotificationTester to your dev build
import NotificationTester from './components/NotificationTester';

<NotificationTester />
```

Click the purple bell button → Test notifications → Verify they appear.

### 3. Enable in Settings

Dashboard → Settings (⌘,) → Global Notification Settings:
- ☑️ Enable all notification types
- ☑️ Show desktop notifications by default
- ☑️ Enable notification sounds
- Set quiet hours if needed

## Common Use Cases

### Task Completion
```typescript
const { notifyTaskCompleted } = useNotifications();

// When task is marked complete
await notifyTaskCompleted(taskTitle, taskId);
```

### Agent Failure
```typescript
const { notifyAgentFailed } = useNotifications();

// When agent encounters error
await notifyAgentFailed(
  'Coder',
  'Fix bug',
  'Missing dependencies',
  taskId
);
```

### Approval Request
```typescript
const { notifyApprovalNeeded } = useNotifications();

// When item needs approval
await notifyApprovalNeeded(tweetText, approvalId);
```

### Chat Mention
```typescript
const { notifyChatMention } = useNotifications();

// When mentioned in chat
await notifyChatMention(
  'Kevin',
  'Message preview text',
  sessionId
);
```

## Event Handlers Already Running

The dashboard automatically monitors:
- ✅ Task activity table (10s interval)
- ✅ Approval queue (file watcher)
- ✅ Chat mentions (15s interval)

No additional setup needed! Events are detected automatically.

## Action Buttons (macOS Only)

```typescript
await sendNotification({
  type: 'approval-request',
  title: 'New Tweet',
  body: 'Ready to send?',
  actions: [
    { type: 'approve', text: 'Approve' },
    { type: 'dismiss', text: 'Dismiss' }
  ],
  data: { itemId: 'approval-123' }
});
```

Action buttons appear on macOS notifications. Clicking them triggers:
```typescript
// Handled automatically by useNotifications hook
'approve' → navigate('/inbox?action=approve&id=...')
'dismiss' → dismiss notification
```

## Troubleshooting

### Not seeing notifications?
```typescript
// 1. Test basic notification
const { testNotification } = useNotifications();
await testNotification();

// 2. Check preferences
const { preferences } = useNotifications();
console.log(preferences);

// Expected:
// { enabled: true, taskCompletions: true, ... }
```

### Navigation not working?
Check `useNotifications` hook is used in a component wrapped with router:
```typescript
// In App.tsx
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <MyComponent /> {/* Now useNotifications navigation works */}
</BrowserRouter>
```

### Action buttons not appearing?
- Action buttons only work on macOS
- Other platforms show click-only notifications
- This is a platform limitation

## Full Documentation

See [NOTIFICATIONS.md](./NOTIFICATIONS.md) for complete API reference and architecture details.

## Examples

### Custom Notification
```typescript
const { sendNotification } = useNotifications();

await sendNotification({
  type: 'info',
  title: 'Build Complete',
  body: 'Your app is ready!',
  urgency: 'low',
  silent: false,
  data: { buildId: 'build-456' }
});
```

### Update Preferences
```typescript
const { updatePreferences } = useNotifications();

await updatePreferences({
  taskCompletions: true,
  agentFailures: true,
  sound: false,
  showPreviews: true
});
```

### Listen for Recent Notifications
```typescript
const { recentNotifications } = useNotifications();

return (
  <div>
    {recentNotifications.map(notif => (
      <div key={notif.timestamp}>
        {notif.title}: {notif.body}
      </div>
    ))}
  </div>
);
```

## That's It!

You now have a fully functional notification system with:
- ✅ Native OS notifications
- ✅ Action buttons (macOS)
- ✅ Automatic event detection
- ✅ User preferences
- ✅ Navigation from notifications

Happy notifying! 🐸
