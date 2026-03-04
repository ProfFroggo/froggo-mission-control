# Summary 12-02: Events Polling + useRealtimeUpdates Hook

## What was done
- Created app/api/events/route.ts — returns tasks, approvals, chatMessages, agentStatus since given timestamp
- Created src/hooks/useRealtimeUpdates.ts — polls /api/events every 3s, calls onUpdate callback when data arrives

## Files
- app/api/events/route.ts (new)
- src/hooks/useRealtimeUpdates.ts (new)

## Commit
feat(12-02): add events polling endpoint + useRealtimeUpdates hook for real-time dashboard updates
