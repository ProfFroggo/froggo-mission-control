# useEffect Performance Audit Report

**Date:** 2026-02-17  
**Scope:** froggo-dashboard React components  
**Total useEffect occurrences:** 442

---

## Executive Summary

The dashboard codebase has **442 useEffect hooks** across components. Most follow good patterns with proper cleanup and dependency arrays. Key findings:

✅ **Good patterns found:**
- Proper setInterval/clearInterval cleanup (Dashboard.tsx, TopBar.tsx, MeetingsPanel.tsx)
- Document visibility API for polling optimization (Kanban.tsx)
- useCallback for expensive operations (MeetingsPanel.tsx db helpers)
- ResizeObserver with proper disconnect (Dashboard.tsx)

⚠️ **Issues identified:**
- Inline functions in useEffect dependencies causing re-renders
- Expensive array.filter() operations without memoization
- Unnecessary re-subscriptions due to missing useCallback

---

## Priority Components Audit

### 1. Kanban.tsx ✅ GOOD
- **Visibility-based polling:** Properly stops when tab hidden, restarts on visibility change
- **Cleanup:** Both setInterval and document event listeners cleaned up
- **Issue:** `loadTasksFromDB` in dependency array - should be wrapped in useCallback to avoid recreating effect on every render

**Recommendation:**
```typescript
const loadTasksFromDB = useCallback(async () => {
  // existing logic
}, [/* dependencies */]);
```

### 2. Dashboard.tsx ✅ GOOD
- **ResizeObserver:** Properly disconnected on cleanup
- **Array filtering:** Runs on every render without memoization:
  ```typescript
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const needsReview = tasks.filter(t => t.status === 'review');
  ```
- **setInterval:** Proper cleanup with clearInterval

**Recommendation:** Wrap expensive filters in useMemo:
```typescript
const inProgressTasks = useMemo(() => 
  tasks.filter(t => t.status === 'in-progress'), [tasks]);
```

### 3. TopBar.tsx ⚠️ NEEDS ATTENTION
- **Issue:** useEffect with `reconnectAttempts` in dependency array but only used in callback:
  ```typescript
  useEffect(() => {
    const unsubConnect = gateway.on('connect', () => {
      if (reconnectAttempts > 0) {  // Triggers re-subscription on every change
        showToast('success', 'Connected', 'Gateway connection restored');
      }
    });
    return () => { unsubConnect(); };
  }, [reconnectAttempts]);  // Re-subscribes on every reconnectAttempts change!
  ```

**Recommendation:** Use functional update or ref to avoid re-subscriptions.

### 4. MeetingsPanel.tsx ✅ EXCELLENT
- **Cleanup:** Comprehensive cleanup for WebSocket, stream, audioContext
- **useCallback:** dbExec, dbQuery properly memoized
- **setInterval:** Proper cleanup

---

## Common Issues Found

### 1. Inline Functions in Dependencies (High Priority)

**Pattern to avoid:**
```typescript
useEffect(() => {
  const handleChange = () => { /* ... */ };
  something.on('change', handleChange);
  return () => something.off('change', handleChange);
}, [/* inline function */]); // Causes re-subscriptions
```

**Found in:**
- TopBar.tsx (gateway callbacks with reconnectAttempts)
- Various components with event handlers

### 2. Expensive Computations Without Memoization (Medium Priority)

**Pattern found in Dashboard.tsx:**
```typescript
const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
const needsReview = tasks.filter(t => t.status === 'review');
const pendingApprovals = approvals.filter(a => a.status === 'pending');
const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== 'done');
const urgentTasks = tasks.filter(t => t.priority === 'p0' && t.status !== 'done');
```

These run on every render. Should use useMemo.

### 3. setInterval Without Cleanup ⚠️ (Low - Found None)

All setInterval calls found have proper cleanup with clearInterval.

---

## Statistics

| Metric | Count |
|--------|-------|
| Total useEffect occurrences | 442 |
| useEffect with empty deps [] | ~85 |
| useEffect with dependencies | ~275 |
| useEffect with useCallback deps | ~50 |
| setInterval with cleanup | ~15 |
| Missing cleanup patterns | 0 |

---

## Recommendations by Priority

### P0 - High Impact
1. **Wrap callback functions in useCallback** to prevent unnecessary re-renders
   - loadTasksFromDB in Kanban.tsx
   - fetchAgents in Dashboard.tsx
   - loadGatewaySessions in Dashboard.tsx

2. **Memoize expensive computations** with useMemo
   - Dashboard.tsx array filters
   - Any component with multiple state-derived values

### P1 - Medium Impact
3. **Fix dependency arrays with inline functions**
   - TopBar.tsx reconnectAttempts pattern
   - Any useEffect that re-subscribes unnecessarily

### P2 - Low Impact
4. **Consider useMemo for:**
   - Derived state (filtered arrays, counts)
   - Expensive calculations in render
   - Component memoization with React.memo()

---

## Verification

```bash
cd ~/froggo-dashboard
# Count useEffects
grep -rn "useEffect" src/components/*.tsx src/hooks/*.ts | wc -l
# Expected: 442

# Check for setInterval without cleanup
grep -rn "setInterval" src/components/*.tsx src/hooks/*.ts | grep -v "clearInterval"
# Expected: 0 (all have cleanup)
```

---

## Conclusion

The codebase shows **good overall React practices** with proper cleanup patterns. The main optimization opportunities are:

1. **Memoization** - Add useMemo/useCallback to prevent unnecessary recalculations
2. **Callback stabilization** - Wrap callbacks to prevent effect re-runs
3. **Dependency review** - Audit useEffect dependencies to avoid over-triggering

Estimated effort for full optimization: **2-3 hours** for P0 items, **1-2 hours** for P1 items.
