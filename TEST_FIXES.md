# Testing Emergency Dashboard Fixes

## Quick Test Script

```bash
# 1. Kill all running instances
pkill -9 -f "electron.*clawd-dashboard"
pkill -9 -f "vite.*clawd-dashboard"
sleep 2

# 2. Clean start
cd ~/clawd/clawd-dashboard
npm run electron:dev
```

## Manual Test Checklist

### Core Functionality
- [ ] App starts without errors
- [ ] Vite connects on correct port (5173 or 5174)
- [ ] No console errors about missing APIs

### Panel Tests
Navigate to each panel via keyboard shortcuts and verify no errors:

1. **⌘1 - Inbox**
   - [ ] Panel loads
   - [ ] No "Inbox Error" message
   - [ ] Can view conversations

2. **⌘8 - Chat**  
   - [ ] Panel loads
   - [ ] No "Chat Panel Error" message
   - [ ] Can type message (doesn't need to send)

3. **⌘5 - Agents**
   - [ ] Panel loads
   - [ ] No "Agent Panel Error" message
   - [ ] Shows agent list or "no agents" message

4. **⌘6 - X/Twitter**
   - [ ] Panel loads
   - [ ] No "X/Twitter Error" message
   - [ ] Shows tabs (Research, Plan, etc.)

5. **⌘7 - Voice** (if enabled)
   - [ ] Panel loads OR shows proper disabled message
   - [ ] No "Voice Assistant Error" if enabled

6. **Context Control** (⌘⇧C)
   - [ ] Panel loads
   - [ ] No "Context Control Error" message
   - [ ] Shows context files list

7. **Code Agent Dashboard** (⌘⇧D)
   - [ ] Panel loads
   - [ ] No "Code Agent Dashboard Error" message
   - [ ] Shows sessions/commits (or empty state)

### UI Tests

8. **⌘9 - Connected Accounts**
   - [ ] Panel loads
   - [ ] No "Failed to load accounts - Unknown error" toast
   - [ ] Shows accounts list or empty state

9. **⌘4 - Kanban** (Search Box)
   - [ ] Search input visible
   - [ ] Magnifying glass icon visible
   - [ ] Icon doesn't overlap with typed text
   - [ ] Can type in search box

10. **⌘2 - Dashboard** (Stat Cards)
    - [ ] All 4 stat cards visible
    - [ ] No text overflow ("Progress..." truncated properly)
    - [ ] Card titles fully visible
    - [ ] Subtitles fully visible

### Browser Console

Check for errors:
```javascript
// Should see minimal/no errors
// Acceptable: "Waiting for gateway connection..."
// NOT acceptable: "Cannot read property 'list' of undefined"
```

## Expected Console Output (Good)
```
[XPanel] Component mounted
[XPanel] window.clawdbot available: true
[XPanel] window.clawdbot.twitter available: true
[ConnectedAccounts] FIX: Use 'accounts' API
[Gateway] Connecting to: ws://127.0.0.1:18789
[Gateway] Connected
```

## Expected Console Output (Bad - Should Not See)
```
TypeError: Cannot read property 'list' of undefined
Uncaught (in promise) TypeError: clawdbot.connectedAccounts is undefined
Error: Failed to load accounts - Unknown error
```

## Screenshot Verification

Take screenshots and compare with original error screenshots:

1. Inbox panel - should show 3-pane layout or empty state (not error)
2. Chat panel - should show chat interface (not error)
3. Agent panel - should show agent cards (not error)
4. X/Twitter panel - should show tabs (not error)
5. Voice panel - should show interface or disabled message (not error)
6. Context panel - should show file list (not error)
7. Code Dashboard - should show sessions (not error)
8. Accounts panel - should show account list or empty (not "Failed to load")
9. Search box - should show icon without overlap
10. Dashboard cards - should show stats without text overflow

## Performance Check

Monitor for issues:
- [ ] App responds to keyboard shortcuts within 100ms
- [ ] Panel switches happen smoothly
- [ ] No memory leaks (check Activity Monitor after 5 min)
- [ ] CPU usage reasonable (<50% idle, <150% active)

## Regression Tests

Ensure we didn't break anything:
- [ ] Gateway connection works
- [ ] Can create new task (⌘K → "new task")
- [ ] Can navigate between panels
- [ ] Settings panel works (⌘,)
- [ ] Command palette works (⌘K)

---

**If all tests pass:** ✅ Fixes verified, ready for production  
**If any tests fail:** 🔴 Document failure, investigate, fix, re-test
