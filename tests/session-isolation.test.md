# Session Isolation Test

**Purpose:** Verify that messages from one agent session do NOT appear in another agent session.

**Bug Reference:** task-1770767185651 (2026-02-11)  
**Fixed in:** commit 4f6f321

## Test Scenario

1. **Setup:**
   - Open dashboard in two browser tabs/windows
   - Tab 1: Set session to `agent:froggo:dashboard`
   - Tab 2: Set session to `agent:degen-frog:dashboard`

2. **Test:**
   - In Tab 1: Send message to Froggo
   - In Tab 2: Monitor for any events/messages

3. **Expected Result:**
   - Tab 2 should NOT receive any chat events from Froggo's session
   - Only system-wide events (task updates, kanban changes) should appear in both tabs

4. **Failure Mode:**
   - If Tab 2 receives Froggo's chat messages → session bleed bug

## Manual Test Steps

```bash
# Terminal 1: Start dashboard
cd ~/froggo-dashboard
npm run dev

# Terminal 2: Monitor gateway logs
tail -f ~/.openclaw/logs/gateway.log | grep -E "event|chat"

# Browser Tab 1 (Froggo):
# 1. Open http://localhost:5173
# 2. Open DevTools Console
# 3. Run: gateway.setSessionKey('agent:froggo:dashboard')
# 4. Send a chat message

# Browser Tab 2 (Degen-frog):
# 1. Open http://localhost:5173 in new tab
# 2. Open DevTools Console
# 3. Run: gateway.setSessionKey('agent:degen-frog:dashboard')
# 4. Monitor console for any chat events
# 5. Expected: NO chat.delta/chat.message events from Froggo

# Pass criteria: Tab 2 console shows ZERO chat events from Froggo's session
```

## Automated Test (TODO)

```typescript
// tests/gateway-session-isolation.test.ts
import { describe, it, expect } from 'vitest';
import { Gateway } from '../src/lib/gateway';

describe('Gateway Session Isolation', () => {
  it('should not emit events from other sessions', async () => {
    const gateway1 = new Gateway();
    const gateway2 = new Gateway();
    
    gateway1.setSessionKey('agent:froggo:dashboard');
    gateway2.setSessionKey('agent:degen-frog:dashboard');
    
    const receivedEvents: any[] = [];
    gateway2.on('chat.message', (event) => {
      receivedEvents.push(event);
    });
    
    // Simulate event from gateway with sessionKey for froggo
    const mockEvent = {
      type: 'event',
      event: 'chat.message',
      payload: {
        sessionKey: 'agent:froggo:main',
        content: 'Test message from Froggo'
      }
    };
    
    // gateway2 (degen-frog) should NOT receive this event
    // (would need to inject mock WebSocket message)
    
    expect(receivedEvents).toHaveLength(0);
  });
  
  it('should emit events that match session key', async () => {
    const gateway = new Gateway();
    gateway.setSessionKey('agent:froggo:dashboard');
    
    const receivedEvents: any[] = [];
    gateway.on('chat.message', (event) => {
      receivedEvents.push(event);
    });
    
    // Simulate event with matching sessionKey
    const mockEvent = {
      type: 'event',
      event: 'chat.message',
      payload: {
        sessionKey: 'agent:froggo:dashboard',
        content: 'Test message'
      }
    };
    
    // gateway SHOULD receive this event
    // (would need to inject mock WebSocket message)
    
    expect(receivedEvents).toHaveLength(1);
  });
  
  it('should emit system-wide events to all sessions', async () => {
    const gateway1 = new Gateway();
    const gateway2 = new Gateway();
    
    gateway1.setSessionKey('agent:froggo:dashboard');
    gateway2.setSessionKey('agent:degen-frog:dashboard');
    
    const events1: any[] = [];
    const events2: any[] = [];
    
    gateway1.on('task.updated', (e) => events1.push(e));
    gateway2.on('task.updated', (e) => events2.push(e));
    
    // Simulate system-wide event (no sessionKey)
    const mockEvent = {
      type: 'event',
      event: 'task.updated',
      payload: {
        taskId: 'task-123',
        status: 'done'
      }
    };
    
    // BOTH gateways should receive this event
    // (would need to inject mock WebSocket message)
    
    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
  });
});
```

## Regression Prevention

**Before deploying WebSocket changes:**
1. Run manual test above
2. Check gateway logs for cross-session events
3. Verify session filtering logic in code review

**CI/CD Integration (TODO):**
- Add automated test to pre-deploy checks
- Run multi-session test in CI pipeline
- Alert on any cross-session event leakage

## Related Files

- `src/lib/gateway.ts` - Session filtering logic (lines 159-170, 232-237)
- `src/components/ChatPanel.tsx` - Message display (should only show own session)
- Gateway logs: `~/.openclaw/logs/gateway.log`

## Test Results

**2026-02-11 (Post-fix):**
- Manual test: PASS ✅
- No cross-session events observed
- Session isolation working correctly

**2026-02-10 (Pre-fix):**
- Manual test: FAIL ❌
- Froggo's messages appeared in degen-frog session
- Root cause: noRoutingInfo fallback + unconditional emit()

---

**Maintainer:** senior-coder  
**Last Updated:** 2026-02-11 01:10 GMT+1
