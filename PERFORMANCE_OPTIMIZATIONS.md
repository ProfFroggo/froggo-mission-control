# Dashboard Performance Optimizations
**Task:** task-1769656343098  
**Date:** 2026-01-28  
**Agent:** Coder

## Current State Analysis

### ✅ Already Implemented
1. **Lazy Loading** - All major panels lazy-loaded via `ProtectedPanels.tsx`
2. **Error Boundaries** - Prevent cascading failures
3. **Memoization** - 77+ instances of React.memo/useMemo/useCallback across components
4. **Database Indexes** - Comprehensive indexing on tasks, subtasks, task_activity tables

### 🎯 Performance Bottlenecks Identified

#### 1. **Excessive Polling (Kanban)**
**Issue:** Polling every 10 seconds even when data unchanged  
**Impact:** Unnecessary re-renders, network overhead, CPU usage

**Current Code (Kanban.tsx:86-107):**
```typescript
useEffect(() => {
  loadTasksFromDB();
  
  let interval: NodeJS.Timeout;
  
  const startPolling = () => {
    interval = setInterval(loadTasksFromDB, 10000); // Too frequent
  };
  
  const stopPolling = () => {
    if (interval) clearInterval(interval);
  };
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopPolling();
    } else {
      loadTasksFromDB();
      startPolling();
    }
  };
  
  startPolling();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    stopPolling();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [loadTasksFromDB]);
```

**Fix:** WebSocket-based updates OR smarter polling with hash comparison

#### 2. **Missing Composite Index for Common Query**
**Issue:** Tasks query uses temp B-TREE for sorting  
**Query:**
```sql
SELECT * FROM tasks WHERE status = 'todo' ORDER BY updated_at DESC LIMIT 50;
```

**Current Plan:**
```
SEARCH tasks USING INDEX idx_tasks_status (status=?)
USE TEMP B-TREE FOR ORDER BY
```

**Fix:** Add composite index `(status, updated_at DESC)`

#### 3. **Store State Updates Trigger Full Re-renders**
**Issue:** Zustand store updates cause all subscribed components to re-render  
**Example:** Loading states object update re-renders all components using `useStore()`

**Current (store.ts):**
```typescript
loading: {
  tasks: boolean;
  sessions: boolean;
  agents: boolean;
  approvals: boolean;
  activities: boolean;
  [key: string]: boolean;
};
setLoading: (key: string, value: boolean) => void;
```

**Fix:** Use Zustand selectors to subscribe only to needed state slices

#### 4. **Heavy Components Not Memoized**
**Candidates:**
- `TaskCard` (rendered dozens of times in Kanban columns)
- `AgentMetricsCard` (complex calculations)
- `ActivityFeed` items

#### 5. **No Performance Monitoring**
**Issue:** No visibility into actual render performance  
**Fix:** Add React Profiler hooks + performance metrics collection

---

## Optimization Plan

### Phase 1: Database Optimization (High Impact, Low Risk)
1. Add composite index for common query patterns
2. Add query result limits where missing
3. Optimize task activity queries with pagination

### Phase 2: Component Optimization (High Impact, Medium Risk)
1. Memo-ize TaskCard component in Kanban
2. Add useMemo for expensive computations (activity feed filtering, task grouping)
3. Use Zustand selectors instead of full store subscriptions
4. Debounce search/filter inputs

### Phase 3: Smart Polling (Medium Impact, Medium Risk)
1. Implement hash-based change detection
2. Increase poll interval to 30s (from 10s)
3. Consider WebSocket for real-time updates (future)

### Phase 4: Monitoring (Low Impact, High Value)
1. Add PerformanceObserver for component render times
2. Collect metrics: render duration, re-render count, memory usage
3. Dashboard panel showing performance metrics

---

## Implementation Tasks

### ✅ Task 1: Add Database Composite Index
**Priority:** P1 (Quick win)  
**Effort:** 5 minutes

```sql
-- Add composite index for common query
CREATE INDEX IF NOT EXISTS idx_tasks_status_updated 
ON tasks(status, updated_at DESC);

-- Test query plan improvement
EXPLAIN QUERY PLAN 
SELECT * FROM tasks WHERE status = 'todo' ORDER BY updated_at DESC LIMIT 50;
```

**Expected Result:** No temp B-TREE, direct index scan

### ⏳ Task 2: Optimize Store Selectors
**Priority:** P1  
**Effort:** 30 minutes

**Replace:**
```typescript
const { tasks, agents, moveTask } = useStore();
```

**With:**
```typescript
const tasks = useStore(state => state.tasks);
const agents = useStore(state => state.agents);
const moveTask = useStore(state => state.moveTask);
```

**Impact:** Components only re-render when specific slices change

### ⏳ Task 3: Memoize TaskCard Component
**Priority:** P1  
**Effort:** 15 minutes

```typescript
const TaskCard = memo(({ task, onEdit, onDelete, onMove }: TaskCardProps) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if task changed
  return prevProps.task.id === nextProps.task.id &&
         prevProps.task.status === nextProps.task.status &&
         prevProps.task.updatedAt === nextProps.task.updatedAt;
});
```

### ⏳ Task 4: Smart Polling with Change Detection
**Priority:** P2  
**Effort:** 45 minutes

```typescript
// Store last data hash
const [dataHash, setDataHash] = useState('');

const loadTasksWithChangeDetection = useCallback(async () => {
  const tasks = await loadTasksFromDB();
  const hash = hashTasks(tasks); // Simple hash function
  
  if (hash !== dataHash) {
    setDataHash(hash);
    // Only update UI if data actually changed
  }
}, [dataHash, loadTasksFromDB]);

// Increase poll interval
const POLL_INTERVAL = 30000; // 30s instead of 10s
```

### ⏳ Task 5: Add Performance Monitoring
**Priority:** P2  
**Effort:** 1 hour

**Create:** `src/lib/performanceMonitoring.ts`

```typescript
interface PerformanceMetric {
  component: string;
  renderTime: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  
  logRender(component: string, renderTime: number) {
    this.metrics.push({
      component,
      renderTime,
      timestamp: Date.now()
    });
    
    // Keep last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }
  
  getSlowRenders(threshold = 16): PerformanceMetric[] {
    return this.metrics.filter(m => m.renderTime > threshold);
  }
  
  getAverageRenderTime(component: string): number {
    const componentMetrics = this.metrics.filter(m => m.component === component);
    if (componentMetrics.length === 0) return 0;
    
    const sum = componentMetrics.reduce((acc, m) => acc + m.renderTime, 0);
    return sum / componentMetrics.length;
  }
}

export const perfMonitor = new PerformanceMonitor();
```

**Usage in PerformanceProfiler.tsx:**
```typescript
import { Profiler, ProfilerOnRenderCallback } from 'react';
import { perfMonitor } from '../lib/performanceMonitoring';

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration
) => {
  if (phase === 'mount' || phase === 'update') {
    perfMonitor.logRender(id, actualDuration);
    
    // Warn on slow renders
    if (actualDuration > 50) {
      console.warn(`[Perf] Slow render detected: ${id} took ${actualDuration.toFixed(2)}ms`);
    }
  }
};

export default function PerformanceProfiler({ id, children }) {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
```

### ⏳ Task 6: Add Query Limits
**Priority:** P1  
**Effort:** 20 minutes

**Audit queries without LIMIT:**
```bash
grep -r "SELECT.*FROM tasks" src/lib/*.ts | grep -v LIMIT
```

**Add limits to:**
- Task activity queries: `LIMIT 50`
- Session queries: `LIMIT 100`
- Approval queries: `LIMIT 50`

---

## Expected Impact

### Database Optimizations
- **Query Time:** 40-60% reduction on task queries
- **CPU Usage:** 20-30% reduction during polling

### Component Optimizations
- **Re-render Count:** 50-70% reduction (via selectors)
- **Frame Rate:** More consistent 60fps on interactions

### Polling Optimizations
- **Network Requests:** 66% reduction (10s → 30s)
- **Wasted Renders:** 80-90% reduction (change detection)

### Overall
- **Memory Usage:** 15-25% reduction (fewer component instances)
- **Battery Impact:** 20-30% improvement (less polling, fewer re-renders)
- **Perceived Performance:** Smoother interactions, faster response

---

## Testing Plan

1. **Before Metrics:**
   - Measure baseline render times using React DevTools Profiler
   - Record query execution times (SQLite EXPLAIN)
   - Monitor memory usage (Chrome DevTools)

2. **After Each Change:**
   - Re-run profiler to measure improvement
   - Check for regressions (visual bugs, missing updates)
   - Verify data consistency

3. **Regression Tests:**
   - Ensure all features still work
   - No missing task updates
   - Filters/search still accurate
   - Real-time updates functioning

---

## Next Steps

1. ✅ **Document findings** (this file)
2. ⏳ **Implement Phase 1** (database optimizations)
3. ⏳ **Implement Phase 2** (component optimizations)
4. ⏳ **Measure and validate improvements**
5. ⏳ **Document results for Kevin**

---

## Notes

- Already good foundation (lazy loading, memoization, indexes)
- Main wins: Store selectors, composite index, change detection
- Low-hanging fruit first, complex changes later
- Monitor real-world impact with metrics
