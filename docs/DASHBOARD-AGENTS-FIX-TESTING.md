# Dashboard Agents Fix - Testing & Verification Plan

**Task:** task-1771780536455  
**Date:** 2026-02-22  
**Author:** Senior Coder

---

## Problem Summary

Writer agent was respawned 665+ times over 11 hours due to infinite spawn loop:
1. `dashboard-agents.ts` spawned agents using `openclaw agent --agent <id>` (ephemeral sessions)
2. Agent replied "ready" → session ended (ephemeral behavior)
3. Health check looked for session by key → not found
4. Health check respawned → loop repeated

## Fix Applied

### Change 1: Persistent Session Spawning (Line 50)

**Before:**
```typescript
const cmd = `openclaw agent --agent ${agent.agentId} --message "..." --json`;
```

**After:**
```typescript
const cmd = `openclaw agent --agent ${agent.agentId} --session-id "${agent.sessionKey}" --message "..." --json`;
```

**Impact:** Adding `--session-id` parameter creates persistent labeled sessions that survive beyond a single turn.

### Change 2: Re-enabled Health Check (Lines 133-140)

**Before:**
```typescript
// DISABLED 2026-02-22: Health check causing infinite spawn loop
// if (healthCheckTimer) {
//   clearInterval(healthCheckTimer);
// }
// healthCheckTimer = setInterval(healthCheckLoop, HEALTH_CHECK_INTERVAL);
```

**After:**
```typescript
// FIXED 2026-02-22: Now using persistent labeled sessions
if (healthCheckTimer) {
  clearInterval(healthCheckTimer);
}
healthCheckTimer = setInterval(healthCheckLoop, HEALTH_CHECK_INTERVAL);
```

**Impact:** Health check can now safely monitor sessions because they're persistent and findable.

---

## Testing Plan

### Manual Verification Steps

1. **Start Dashboard App**
   ```bash
   cd ~/froggo-dashboard
   open release/dev/mac-arm64/Froggo.app
   ```

2. **Check Session Creation**
   - Wait 30 seconds for agents to spawn
   - Run: `openclaw sessions list --json | jq '.sessions[] | select(.key | startswith("agent:")) | .key'`
   - **Expected:** Should see persistent sessions for all dashboard agents:
     - `agent:froggo:dashboard`
     - `agent:writer:dashboard`
     - `agent:coder:dashboard`
     - `agent:clara:dashboard`
     - etc. (13 total)

3. **Monitor Spawn Count (Critical Test)**
   - Check Electron console for spawn messages
   - **Expected:** Each agent spawned ONCE at startup
   - **Expected:** No respawn messages for 10+ minutes (health check runs every 60 seconds)
   - **Red flag:** If you see "Spawning X at agent:X:dashboard..." more than once per agent, the loop is back

4. **Verify Health Check Is Running**
   - Check logs for: `[DashboardAgents] Health check monitoring ENABLED (persistent sessions)`
   - **Expected:** Health check runs every 60 seconds
   - **Expected:** No "session not found" warnings

5. **Test Session Persistence**
   - Send a message to Writer in dashboard chat
   - Run: `openclaw sessions list --json | jq '.sessions[] | select(.key == "agent:writer:dashboard")'`
   - **Expected:** Session still exists after message exchange
   - **Expected:** `updatedAt` timestamp is recent

### Automated Verification

```bash
# Monitor spawn count over 10 minutes
tail -f ~/Library/Logs/Froggo/main.log | grep "Spawning" | while read line; do
  echo "$(date): $line"
done

# Expected: 13 spawn messages at startup, then ZERO for 10 minutes
```

### Success Criteria

✅ **Pass:** Each agent spawned exactly ONCE at startup  
✅ **Pass:** Zero respawn events for 10+ minutes  
✅ **Pass:** All 13 persistent sessions visible in `openclaw sessions list`  
✅ **Pass:** Health check logs show no "session not found" warnings  
✅ **Pass:** Sessions persist after message exchanges  

❌ **Fail:** Any agent spawned multiple times without manual trigger  
❌ **Fail:** "session not found" warnings in health check  
❌ **Fail:** Sessions disappear after first message  

---

## Rollback Plan

If the fix doesn't work:

1. **Immediate:** Disable health check again
   ```typescript
   // Comment out lines 136-138 in dashboard-agents.ts
   // healthCheckTimer = setInterval(healthCheckLoop, HEALTH_CHECK_INTERVAL);
   ```

2. **Rebuild:**
   ```bash
   cd ~/froggo-dashboard
   npm run build:dev
   ```

3. **Investigate:** Check `openclaw sessions list` output format to ensure `key` field matches expectations

---

## Notes

- Health check interval: 60 seconds (HEALTH_CHECK_INTERVAL)
- Session keys follow pattern: `agent:<agentId>:dashboard`
- 13 dashboard agents configured in DASHBOARD_AGENTS array
- Previous spawn count before fix: 665+ over 11 hours (~1 spawn per minute)
- Expected spawn count after fix: 13 (one-time at startup)

---

## Manual Test Execution Record

**Tester:** _______________  
**Date:** _______________  
**Build:** _______________  

**Results:**
- [ ] All sessions created at startup
- [ ] No respawns for 10+ minutes
- [ ] Health check running
- [ ] Sessions persist after messages

**Notes:**
