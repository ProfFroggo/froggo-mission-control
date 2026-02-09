# Agent Activity Indicator - Quick Implementation

## Backend (DONE)
✅ Added `agents:getActiveSessions` handler in main.ts
✅ Added preload binding
✅ Returns agents active in last 2 minutes

## Frontend Implementation Plan

### 1. Add to Kanban.tsx state:
```typescript
const [activeSessions, setActiveSessions] = useState<Record<string, boolean>>({});

// Poll every 30 seconds
useEffect(() => {
  const pollActiveSessions = async () => {
    const result = await (window as any).clawdbot?.agents?.getActiveSessions();
    if (result?.success) {
      const activeMap: Record<string, boolean> = {};
      result.sessions.forEach((s: any) => {
        activeMap[s.agentId] = true;
      });
      setActiveSessions(activeMap);
    }
  };
  
  pollActiveSessions();
  const interval = setInterval(pollActiveSessions, 30000);
  return () => clearInterval(interval);
}, []);
```

### 2. Add indicator to TaskCard:
```typescript
// In TaskCard component, add near the assignee section:
{task.assignedTo && activeSessions[task.assignedTo] && (
  <div className="flex items-center gap-1 text-green-400 text-xs">
    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
    <span>Active</span>
  </div>
)}
```

### 3. Visual Design:
- Green pulsing dot (w-2 h-2, bg-green-400, animate-pulse)
- "Active" label next to agent avatar
- Only shows when agent updated session within last 2 min

## Time Estimate
- Frontend changes: 15 minutes
- Build & test: 10 minutes
- Total: 25 minutes

## Next Steps
1. Apply these changes to Kanban.tsx
2. Build dashboard
3. Test with active agent sessions
4. Deploy

## Testing
- Create task, assign to coder
- Start working (I should show as active)
- Verify green dot appears on task card
- Wait 2 min, verify dot disappears
