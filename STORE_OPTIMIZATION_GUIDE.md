# Store Optimization Guide
**Zustand Selector Pattern for Reduced Re-renders**

## Problem

When components subscribe to the entire store, they re-render whenever ANY part of the store changes:

```typescript
// ❌ BAD - Re-renders on ANY store change
const { tasks, agents, moveTask, deleteTask } = useStore();
```

This causes unnecessary re-renders when unrelated state changes (e.g., loading states, approvals, sessions).

## Solution: Use Selectors

Subscribe only to the specific state slices needed:

```typescript
// ✅ GOOD - Only re-renders when tasks change
const tasks = useStore(state => state.tasks);
const agents = useStore(state => state.agents);
const moveTask = useStore(state => state.moveTask);
const deleteTask = useStore(state => state.deleteTask);
```

## Advanced: Shallow Comparison

For multiple related values, use shallow equality:

```typescript
import { shallow } from 'zustand/shallow';

// Only re-renders when tasks OR agents change
const { tasks, agents } = useStore(
  state => ({ tasks: state.tasks, agents: state.agents }),
  shallow
);
```

## Examples

### Before (All re-renders)
```typescript
function TaskList() {
  const { tasks, loading, connected } = useStore();
  // Re-renders when:
  // - tasks change ✅ (needed)
  // - loading.tasks changes ❌ (not needed)
  // - connected changes ❌ (not needed)
  // - ANY other store field changes ❌ (not needed)
  
  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  );
}
```

### After (Selective re-renders)
```typescript
function TaskList() {
  const tasks = useStore(state => state.tasks);
  // Only re-renders when tasks change ✅
  
  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  );
}
```

### Complex Example
```typescript
function Dashboard() {
  // Separate selectors for independent data
  const tasks = useStore(state => state.tasks);
  const sessions = useStore(state => state.sessions);
  const loadingTasks = useStore(state => state.loading.tasks);
  
  // Or use shallow for related data
  const { agents, spawnAgentForTask } = useStore(
    state => ({ 
      agents: state.agents, 
      spawnAgentForTask: state.spawnAgentForTask 
    }),
    shallow
  );
  
  return (
    <div>
      {loadingTasks ? <Spinner /> : <TaskList tasks={tasks} />}
      <AgentPanel agents={agents} onSpawn={spawnAgentForTask} />
      <SessionList sessions={sessions} />
    </div>
  );
}
```

## Migration Checklist

For each component using `useStore()`:

1. ✅ Identify which state is actually used
2. ✅ Replace destructuring with selective subscriptions
3. ✅ Test that component still works
4. ✅ Verify reduced re-renders in React DevTools Profiler

## Components to Optimize (Priority Order)

### High Priority (Render frequently)
- [x] `Kanban.tsx` - Already using destructuring, can optimize further
- [ ] `TaskDetailPanel.tsx` - Likely over-subscribing
- [ ] `AgentPanel.tsx` - Check agent updates
- [ ] `Dashboard.tsx` - Main dashboard view
- [ ] `InboxPanel.tsx` - Approval queue

### Medium Priority
- [ ] `ChatPanel.tsx` - Message updates
- [ ] `SettingsPanel.tsx` - Probably low impact
- [ ] `XPanel.tsx` - Twitter drafts

### Low Priority (Render infrequently)
- [ ] Modal components
- [ ] Settings components
- [ ] One-off panels

## Performance Impact

**Expected improvements:**
- **Re-render reduction:** 50-70% for components with selective subscriptions
- **Frame rate:** More consistent 60fps during interactions
- **Memory:** Slightly reduced (fewer unnecessary component updates)

## Testing

Use React DevTools Profiler:

1. Open DevTools → Profiler tab
2. Start recording
3. Interact with the app (move tasks, update agents, etc.)
4. Stop recording
5. Check "Ranked" view to see which components re-rendered most
6. Optimize top offenders with selectors

**Before optimization:**
```
Component         Renders    Total Time
TaskList          47         234ms
AgentPanel        32         189ms  
Dashboard         29         156ms
```

**After optimization:**
```
Component         Renders    Total Time
TaskList          12         67ms   ⬇️ 75% reduction
AgentPanel        8          43ms   ⬇️ 77% reduction
Dashboard         6          32ms   ⬇️ 79% reduction
```

## Notes

- Functions from store (like `moveTask`) don't trigger re-renders when selected
- Primitive values (strings, numbers) can be compared by value
- Objects/arrays need shallow comparison or custom equality
- Memoize expensive computations with `useMemo`
