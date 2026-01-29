# Notification System Integration Guide

Quick guide to integrate and test the notification system in Froggo Dashboard.

## ✅ What's Already Working

The notification system is **fully functional** out of the box:
- Event listeners are running in `electron/main.ts`
- IPC handlers are registered
- Settings UI is accessible in Settings panel
- Native notifications work automatically

**No additional integration required for production use.**

## 🧪 Adding the Testing Tool (Development)

To test notifications during development, add the NotificationTester component:

### Option 1: Quick Test (Temporary)

Edit `src/App.tsx`:

```typescript
import NotificationTester from './components/NotificationTester';

// Add before the closing tag of your main component
function App() {
  return (
    <div>
      {/* Your existing app content */}
      
      {/* Add this line for testing */}
      {import.meta.env.DEV && <NotificationTester />}
    </div>
  );
}
```

### Option 2: Settings Panel Integration (Permanent)

Edit `src/components/EnhancedSettingsPanel.tsx`:

```typescript
import { useNotifications } from '../hooks/useNotifications';

// Inside the Notifications section, add a test button:
const { testNotification } = useNotifications();

<button
  onClick={testNotification}
  className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80"
>
  Test Notification
</button>
```

## 🎯 Testing Checklist

### 1. System Permissions

**macOS:**
```bash
# Open notification settings
open "x-apple.systempreferences:com.apple.preference.notifications"
```

Find "Froggo" and enable:
- ☑️ Allow Notifications
- ☑️ Show in Notification Center  
- ☑️ Sounds
- ☑️ Badges

### 2. Launch Dashboard

```bash
cd ~/clawd/clawd-dashboard
npm run electron:dev
```

### 3. Test Basic Notification

If you added NotificationTester:
1. Look for purple bell button (bottom-right)
2. Click "Basic Test Notification"
3. Verify notification appears in macOS notification center

Or via Settings:
1. Press `⌘,` to open Settings
2. Go to Global Notification Settings
3. Click "Test Notification" button (if added)

### 4. Test Event Detection

The system automatically monitors events. To test:

**Task Completion:**
```bash
# Mark a task complete in froggo-db
froggo-db task-update task-XXX --status done

# Or via SQL
sqlite3 ~/clawd/data/froggo.db \
  "INSERT INTO task_activity (task_id, action, message, timestamp) \
   VALUES ('task-123', 'completed', 'Test task completed', $(date +%s)000)"

# Wait up to 10 seconds for notification
```

**Approval Request:**
```bash
# Add item to approval queue
echo '{
  "items": [{
    "id": "approval-test-1",
    "title": "Test approval: Hello World",
    "type": "tweet",
    "content": "Test tweet content",
    "created_at": '$(date +%s)000'
  }]
}' > ~/clawd/approvals/queue.json

# Notification appears immediately (file watcher)
```

**Agent Failure:**
```bash
# Simulate agent failure
sqlite3 ~/clawd/data/froggo.db \
  "INSERT INTO task_activity (task_id, action, message, agent_id, timestamp) \
   VALUES ('task-123', 'failed', 'Test failure reason', 'coder', $(date +%s)000)"

# Wait up to 10 seconds for notification
```

### 5. Test Action Buttons (macOS)

1. Trigger an approval notification (see above)
2. Notification should show [Approve] [Dismiss] buttons
3. Click [Approve] → Dashboard opens to inbox
4. Verify navigation works

### 6. Test Settings

**Global Settings:**
1. Dashboard → Settings (⌘,)
2. Go to "Global Notification Settings"
3. Toggle various options
4. Test notification again
5. Verify settings respected

**Per-Conversation Settings:**
1. Go to Sessions/Chat panel
2. Right-click conversation → Notification Settings
3. Test per-conversation preferences
4. Verify overrides work

## 📊 Verification Commands

```bash
# Check event listener logs
# Look for: [Notifications] Event listeners started
tail -f ~/clawd/clawd-dashboard/electron-logs/*.log | grep Notification

# Check preference file
cat ~/clawd/data/notification-prefs.json

# Check recent task activity (for testing)
sqlite3 ~/clawd/data/froggo.db \
  "SELECT * FROM task_activity ORDER BY timestamp DESC LIMIT 5"

# Check approval queue
cat ~/clawd/approvals/queue.json

# Test notification service directly (if you want to write a test script)
node -e "
const { notificationService } = require('./electron/notification-service');
notificationService.info('Test', 'This is a test');
"
```

## 🐛 Troubleshooting

### Notifications Not Appearing

1. **Check system permissions**
   ```bash
   # macOS - should show "authorized"
   defaults read com.apple.notificationcenterui.plist
   ```

2. **Check preferences**
   ```bash
   cat ~/clawd/data/notification-prefs.json
   # enabled should be true
   ```

3. **Check Do Not Disturb**
   - macOS: Control Center → Focus → Do Not Disturb should be OFF

4. **Check quiet hours**
   - Settings → Current time outside quiet hours range

5. **Check electron logs**
   ```bash
   tail -f ~/clawd/clawd-dashboard/electron-logs/*.log
   ```

### Action Buttons Not Working

- **Expected:** Only works on macOS
- **Other platforms:** Click notification itself to navigate

### Navigation Not Working

1. Verify router is set up in App.tsx
2. Check browser console for errors
3. Verify useNotifications hook is used in routed component

## 🎨 Customizing Notifications

### Change Sound

Edit `electron/notification-service.ts`:

```typescript
// In show() method
const notification = new Notification({
  // ... other options
  sound: 'Hero', // macOS sound name
  // or
  silent: true, // No sound
});
```

### Add Custom Action

Edit `useNotifications.ts`:

```typescript
handleNotificationAction(action: NotificationAction) {
  switch (action.actionType) {
    case 'my-custom-action':
      // Do something custom
      console.log('Custom action triggered!', action.data);
      break;
    // ... existing cases
  }
}
```

### Change Icons

Edit `electron/notification-service.ts`:

```typescript
private getIconForType(type: string): string | undefined {
  const iconMap: Record<string, string> = {
    'task-completed': '/path/to/custom-icon.png',
    // ... other types
  };
  return iconMap[type];
}
```

## 📦 Production Deployment

No additional steps required! The notification system is already integrated:

1. Build app: `npm run electron:build`
2. Package: `npm run electron:pack`
3. Distribute: Notifications work automatically

Users just need to:
1. Grant notification permissions on first launch
2. Configure preferences in Settings (optional)

## 🔧 Advanced Configuration

### Change Polling Intervals

Edit `electron/main.ts` (search for "startNotificationListeners"):

```typescript
// Task activity check (default 10s)
setInterval(() => {
  // ... task activity polling
}, 10000); // Change this value (milliseconds)

// Chat mention check (default 15s)
setInterval(() => {
  // ... mention checking
}, 15000); // Change this value
```

### Add New Notification Type

1. **Add type to NotificationService** (`electron/notification-service.ts`):
   ```typescript
   myNewNotification(title: string, data: any) {
     this.show({
       type: 'my-new-type',
       title: title,
       body: 'Custom body',
       data: data,
     });
   }
   ```

2. **Add preference** (extend `NotificationPreferences`):
   ```typescript
   interface NotificationPreferences {
     // ... existing
     myNewType: boolean;
   }
   ```

3. **Add event listener** (`electron/main.ts`):
   ```typescript
   // In startNotificationListeners()
   setInterval(() => {
     // Check for your custom event
     if (someCondition) {
       notificationService.myNewNotification('Title', data);
     }
   }, 10000);
   ```

4. **Add settings UI** (GlobalNotificationSettings.tsx):
   ```typescript
   <label>
     <input
       type="checkbox"
       checked={myNewType}
       onChange={(e) => setMyNewType(e.target.checked)}
     />
     Enable my new notifications
   </label>
   ```

## 📚 Documentation

- **Full Reference:** `docs/NOTIFICATIONS.md`
- **Quick Start:** `docs/NOTIFICATIONS-QUICKSTART.md`
- **Implementation Summary:** `NOTIFICATION_SYSTEM_SUMMARY.md`

## 🎉 You're Done!

The notification system is complete and ready to use. Test it, configure it, enjoy it! 🐸

---

**Questions?** Check the documentation or grep for "notification" in the codebase.
