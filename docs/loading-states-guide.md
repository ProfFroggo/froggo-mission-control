# Loading States Guide

## Overview

The dashboard now includes comprehensive loading states, spinners, and progress indicators for all async operations. This improves perceived performance and provides clear user feedback during data fetching and operations.

## Components

All loading state components are located in `/src/components/LoadingStates.tsx`.

### Available Components

#### 1. **Spinner**
Basic animated spinner for inline loading indicators.

```tsx
import { Spinner } from './LoadingStates';

<Spinner size={16} className="text-blue-400" />
```

**Props:**
- `size?: number` - Size in pixels (default: 16)
- `className?: string` - Additional CSS classes

#### 2. **LoadingButton**
Button component with built-in loading state.

```tsx
import { LoadingButton } from './LoadingStates';

<LoadingButton
  loading={isLoading}
  onClick={handleClick}
  variant="primary"
  size="md"
  icon={<Save size={16} />}
>
  Save Changes
</LoadingButton>
```

**Props:**
- `loading?: boolean` - Show loading state
- `disabled?: boolean` - Disable button
- `onClick?: () => void` - Click handler
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'`
- `size?: 'sm' | 'md' | 'lg'`
- `icon?: ReactNode` - Icon to show when not loading
- `type?: 'button' | 'submit' | 'reset'`

#### 3. **Skeleton Screens**
Placeholder components while data is loading.

```tsx
import { Skeleton, TaskCardSkeleton, AgentCardSkeleton, SessionCardSkeleton, TableRowSkeleton } from './LoadingStates';

// Generic skeleton
<Skeleton width="w-full" height="h-4" rounded="md" />

// Pre-built skeletons
<TaskCardSkeleton />
<AgentCardSkeleton />
<SessionCardSkeleton />
<TableRowSkeleton columns={4} />
```

#### 4. **LoadingOverlay**
Full-screen or panel loading overlay with backdrop.

```tsx
import { LoadingOverlay } from './LoadingStates';

<LoadingOverlay message="Loading tasks..." fullScreen={false} />
```

#### 5. **EmptyState**
Display when data loads but is empty.

```tsx
import { EmptyState } from './LoadingStates';

<EmptyState
  icon={<Inbox size={48} />}
  title="No tasks found"
  description="Create your first task to get started"
  action={{
    label: "Create Task",
    onClick: handleCreate,
    icon: <Plus size={16} />
  }}
/>
```

#### 6. **ProgressBar**
For long-running operations with progress tracking.

```tsx
import { ProgressBar } from './LoadingStates';

<ProgressBar
  progress={75}
  label="Processing files..."
  showPercentage={true}
/>
```

#### 7. **InlineLoader**
Small inline loading indicator with optional text.

```tsx
import { InlineLoader } from './LoadingStates';

<InlineLoader text="Loading..." size="md" />
```

#### 8. **PulsingDot**
Real-time activity indicator.

```tsx
import { PulsingDot } from './LoadingStates';

<PulsingDot color="bg-green-500" size={8} />
```

## Implementation Examples

### Kanban Board

The Kanban board now includes:
- **Skeleton screens** while tasks are loading
- **Loading spinners** on task operations (delete, spawn, move)
- **Animated refresh button** with spinner
- **Disabled states** during operations

```tsx
// Refresh with loading state
const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  try {
    await loadTasksFromDB();
  } finally {
    setIsRefreshing(false);
  }
};

<button
  onClick={handleRefresh}
  disabled={isRefreshing}
  className="..."
>
  <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
</button>
```

```tsx
// Task operations with loading
const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());

const handleDeleteTask = async (taskId: string) => {
  setDeletingTasks(prev => new Set(prev).add(taskId));
  try {
    await deleteTask(taskId);
  } finally {
    setDeletingTasks(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }
};

// In TaskCard
<TaskCard
  isDeleting={deletingTasks.has(task.id)}
  isSpawning={spawningTasks.has(task.id)}
  isMoving={movingTasks.has(task.id)}
/>
```

### Agent Panel

The Agent Panel includes:
- **Loading indicators** during metrics fetch
- **Spinning refresh button** during reload
- **Inline loaders** in analytics header

```tsx
const [loadingMetrics, setLoadingMetrics] = useState(false);

const loadAgentMetrics = async () => {
  setLoadingMetrics(true);
  try {
    const data = await window.clawdbot.agents.getMetrics();
    setAgentMetrics(data);
  } finally {
    setLoadingMetrics(false);
  }
};

<h2 className="...">
  Performance Analytics
  {loadingMetrics && <InlineLoader size="sm" />}
</h2>
```

### Chat Panel

Already implemented with:
- **Loader2 spinners** on send button during message processing
- **Loading states** for suggested replies
- **Streaming indicators** during response generation

### Widgets

Calendar and Email widgets include:
- **Loading messages** with pulsing icons
- **Error states** with retry buttons
- **Empty states** when no data

## Best Practices

### 1. Track Operation State

Always track loading states for async operations:

```tsx
const [loading, setLoading] = useState(false);
const [operationInProgress, setOperationInProgress] = useState<Set<string>>(new Set());
```

### 2. Show Immediate Feedback

Start showing loading indicators **before** the async operation:

```tsx
const handleAction = async () => {
  setLoading(true); // Show immediately
  try {
    await performAction();
  } finally {
    setLoading(false); // Hide when done
  }
};
```

### 3. Disable During Operations

Prevent duplicate operations by disabling buttons:

```tsx
<LoadingButton
  loading={isLoading}
  disabled={isLoading}
  onClick={handleAction}
>
  Submit
</LoadingButton>
```

### 4. Use Skeleton Screens

Show skeleton screens for initial data load:

```tsx
{loading && items.length === 0 ? (
  <>
    <TaskCardSkeleton />
    <TaskCardSkeleton />
    <TaskCardSkeleton />
  </>
) : (
  items.map(item => <ItemCard key={item.id} item={item} />)
)}
```

### 5. Provide Context

Always tell users what's happening:

```tsx
<InlineLoader text="Fetching messages..." />
<LoadingOverlay message="Processing your request..." />
<ProgressBar label="Uploading files..." progress={progress} />
```

### 6. Handle Errors

Show error states with retry options:

```tsx
{error ? (
  <EmptyState
    icon={<AlertCircle size={48} />}
    title="Failed to load"
    description={error}
    action={{
      label: "Try Again",
      onClick: handleRetry
    }}
  />
) : (
  // ... content
)}
```

## Store Integration

The global store (`/src/store/store.ts`) includes a `loading` object:

```typescript
loading: {
  tasks: boolean;
  sessions: boolean;
  agents: boolean;
  approvals: boolean;
}
```

Access these in components:

```tsx
const { loading } = useStore();

{loading.tasks && <InlineLoader text="Loading tasks..." />}
```

## Testing

When testing components with loading states:

```tsx
import { render, screen, waitFor } from '@testing-library/react';

test('shows loading spinner during fetch', async () => {
  const { rerender } = render(<MyComponent loading={true} />);
  
  expect(screen.getByRole('status')).toBeInTheDocument();
  
  rerender(<MyComponent loading={false} />);
  
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

## Performance Considerations

### 1. Debounce Rapid Updates

For operations that might fire rapidly:

```tsx
const [loading, setLoading] = useState(false);
const timeoutRef = useRef<NodeJS.Timeout>();

const debouncedLoad = () => {
  clearTimeout(timeoutRef.current);
  setLoading(true);
  timeoutRef.current = setTimeout(() => {
    performLoad().finally(() => setLoading(false));
  }, 300);
};
```

### 2. Avoid Excessive Skeletons

Don't show too many skeleton items:

```tsx
// ✅ Good: Reasonable number
<>
  <TaskCardSkeleton />
  <TaskCardSkeleton />
  <TaskCardSkeleton />
</>

// ❌ Bad: Too many
{Array.from({ length: 100 }).map((_, i) => <TaskCardSkeleton key={i} />)}
```

### 3. Lazy Load Components

Use React.lazy for heavy components:

```tsx
const HeavyPanel = lazy(() => import('./HeavyPanel'));

<Suspense fallback={<LoadingPanel />}>
  <HeavyPanel />
</Suspense>
```

## Migration Checklist

When adding loading states to a new component:

- [ ] Identify all async operations
- [ ] Add loading state variables
- [ ] Implement loading wrappers for async functions
- [ ] Add loading indicators to UI
- [ ] Show skeleton screens for initial load
- [ ] Disable buttons during operations
- [ ] Handle error states
- [ ] Test loading behavior
- [ ] Verify perceived performance improvement

## Files Modified

### Core Loading Components
- `/src/components/LoadingStates.tsx` - Main loading components library
- `/src/components/Skeleton.tsx` - Additional skeleton variants
- `/src/components/LoadingPanel.tsx` - Fallback panel

### Components Updated
- `/src/components/Kanban.tsx` - Task operations, refresh, skeletons
- `/src/components/AgentPanel.tsx` - Metrics loading, refresh
- `/src/components/ChatPanel.tsx` - Message sending, suggestions (already had)
- `/src/components/InboxPanel.tsx` - Approval operations (already had)
- `/src/components/TodayCalendarWidget.tsx` - Events loading (already had)
- `/src/components/EmailWidget.tsx` - Email fetch (already had)

## Future Enhancements

Potential improvements:
- [ ] Global loading bar (like YouTube/GitHub)
- [ ] Toast notifications for background operations
- [ ] Optimistic UI updates (show change before confirmation)
- [ ] Progressive loading (load critical data first)
- [ ] Retry logic with exponential backoff
- [ ] Loading state persistence across navigation

## Support

For questions or issues with loading states, check:
- Component props documentation in `/src/components/LoadingStates.tsx`
- Store loading state in `/src/store/store.ts`
- Example implementations in Kanban and AgentPanel

---

**Last Updated:** 2026-01-29
**Task:** task-1769656025360
**Implemented By:** coder agent
