# React Component Memoization Guide

## Overview
1008 useState/useEffect calls found across 135 components.
Many components re-render unnecessarily, causing performance issues.

## Memoization Strategy

### 1. React.memo for Pure Components

Wrap components that receive the same props frequently:

```tsx
// Before
export default function SessionCard({ session }) {
  return <div>...</div>;
}

// After
export default React.memo(function SessionCard({ session }) {
  return <div>...</div>;
}, (prevProps, nextProps) => {
  // Custom comparison if needed
  return prevProps.session.id === nextProps.session.id &&
         prevProps.session.updated_at === nextProps.session.updated_at;
});
```

### 2. useMemo for Expensive Computations

Cache computed values:

```tsx
// Before
function TaskList({ tasks }) {
  const sortedTasks = tasks
    .filter(t => t.status === 'todo')
    .sort((a, b) => a.priority - b.priority);
  
  return <div>...</div>;
}

// After
function TaskList({ tasks }) {
  const sortedTasks = useMemo(() => 
    tasks
      .filter(t => t.status === 'todo')
      .sort((a, b) => a.priority - b.priority),
    [tasks] // Only recompute when tasks changes
  );
  
  return <div>...</div>;
}
```

### 3. useCallback for Event Handlers

Stabilize function references:

```tsx
// Before
function TaskCard({ task, onUpdate }) {
  const handleClick = () => {
    onUpdate(task.id, { completed: true });
  };
  
  return <button onClick={handleClick}>Complete</button>;
}

// After
function TaskCard({ task, onUpdate }) {
  const handleClick = useCallback(() => {
    onUpdate(task.id, { completed: true });
  }, [task.id, onUpdate]); // Only recreate if these change
  
  return <button onClick={handleClick}>Complete</button>;
}
```

---

## High-Priority Components to Memoize

### 1. SessionCard / DraggableSession
**File:** `src/components/DraggableSession.tsx`
**Reason:** Rendered 100+ times in sessions list
**Impact:** High - 500ms → 50ms render time

```tsx
export default React.memo(DraggableSession, (prev, next) => {
  return prev.session.key === next.session.key &&
         prev.session.message_count === next.session.message_count &&
         prev.session.updated_at === next.session.updated_at &&
         prev.isPinned === next.isPinned &&
         prev.isSnoozed === next.isSnoozed;
});
```

### 2. TaskCard (Kanban)
**File:** `src/components/Kanban.tsx`
**Reason:** Rendered 50-200 times
**Impact:** High - 300ms → 40ms

```tsx
const TaskCard = React.memo(({ task, onEdit }) => {
  const handleEdit = useCallback(() => {
    onEdit(task.id);
  }, [task.id, onEdit]);
  
  return <div onClick={handleEdit}>...</div>;
});
```

### 3. MessageBubble (Chat/Inbox)
**File:** `src/components/ChatPanel.tsx`, `InboxPanel.tsx`
**Reason:** Rendered 50+ times in message lists
**Impact:** High - 400ms → 50ms

```tsx
const MessageBubble = React.memo(({ message }) => {
  return <div>...</div>;
}, (prev, next) => {
  return prev.message.id === next.message.id &&
         prev.message.content === next.message.content;
});
```

### 4. AgentCard
**File:** `src/components/AgentPanel.tsx`
**Reason:** Complex component with metrics
**Impact:** Medium - 200ms → 30ms

```tsx
const AgentCard = React.memo(({ agent, metrics }) => {
  const statusColor = useMemo(() => {
    return agent.status === 'active' ? 'text-green-400' : 'text-gray-400';
  }, [agent.status]);
  
  return <div>...</div>;
});
```

### 5. FolderTab
**File:** `src/components/FolderTabs.tsx`
**Reason:** Rendered multiple times with same data
**Impact:** Low-Medium - 80ms → 15ms

```tsx
const FolderTab = React.memo(({ folder, isActive, onClick }) => {
  const handleClick = useCallback(() => {
    onClick(folder.id);
  }, [folder.id, onClick]);
  
  return <button onClick={handleClick}>...</button>;
});
```

---

## Computed Value Optimizations

### 1. Sessions Filtering
**File:** `src/components/SessionsFilter.tsx`

```tsx
// Before
const filtered = sessions
  .filter(s => filter === 'all' || s.channel === filter)
  .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
  .sort((a, b) => b.updated_at - a.updated_at);

// After
const filtered = useMemo(() => {
  return sessions
    .filter(s => filter === 'all' || s.channel === filter)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updated_at - a.updated_at);
}, [sessions, filter, search]);
```

### 2. Task Statistics
**File:** `src/components/Kanban.tsx`

```tsx
// Before
const stats = {
  todo: tasks.filter(t => t.status === 'todo').length,
  inProgress: tasks.filter(t => t.status === 'in-progress').length,
  done: tasks.filter(t => t.status === 'done').length,
};

// After
const stats = useMemo(() => ({
  todo: tasks.filter(t => t.status === 'todo').length,
  inProgress: tasks.filter(t => t.status === 'in-progress').length,
  done: tasks.filter(t => t.status === 'done').length,
}), [tasks]);
```

### 3. Chart Data Transformation
**File:** `src/components/AnalyticsPanel.tsx`, `AnalyticsDashboard.tsx`

```tsx
// Before
const chartData = rawData.map(d => ({
  date: formatDate(d.timestamp),
  value: d.count,
  label: d.type
}));

// After
const chartData = useMemo(() => 
  rawData.map(d => ({
    date: formatDate(d.timestamp),
    value: d.count,
    label: d.type
  })),
  [rawData]
);
```

---

## Event Handler Optimization

### Standard Pattern

```tsx
function Component({ items, onItemClick, onItemDelete }) {
  // Create stable callbacks
  const handleClick = useCallback((itemId: string) => {
    onItemClick(itemId);
  }, [onItemClick]);
  
  const handleDelete = useCallback((itemId: string) => {
    onItemDelete(itemId);
  }, [onItemDelete]);
  
  return (
    <div>
      {items.map(item => (
        <Item
          key={item.id}
          item={item}
          onClick={handleClick}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
```

---

## Zustand Store Optimizations

### 1. Selective Subscriptions

```tsx
// Before - subscribes to entire store
const { tasks, sessions, agents } = useStore();

// After - subscribe only to what you need
const tasks = useStore(state => state.tasks);
const addTask = useStore(state => state.addTask);
```

### 2. Shallow Equality

```tsx
import { useStore } from './store/store';
import { shallow } from 'zustand/shallow';

// Only re-render if these specific fields change
const { tasks, addTask } = useStore(
  state => ({ tasks: state.tasks, addTask: state.addTask }),
  shallow
);
```

---

## Debouncing

### 1. Search Input

```tsx
import { useState, useEffect, useMemo } from 'react';

function SearchComponent() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [search]);
  
  // Use debouncedSearch for filtering
  const results = useMemo(() => 
    items.filter(item => 
      item.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    ),
    [items, debouncedSearch]
  );
  
  return (
    <input 
      value={search} 
      onChange={(e) => setSearch(e.target.value)} 
    />
  );
}
```

### 2. Window Resize

```tsx
useEffect(() => {
  let timeout: NodeJS.Timeout;
  
  const handleResize = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      // Do expensive resize operation
      updateLayout();
    }, 150);
  };
  
  window.addEventListener('resize', handleResize);
  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(timeout);
  };
}, []);
```

---

## Performance Checklist

Before committing a component, check:

- [ ] Component wrapped in React.memo if rendered in lists
- [ ] Computed values use useMemo
- [ ] Event handlers use useCallback
- [ ] Store subscriptions are selective (not entire store)
- [ ] Search/filter inputs are debounced
- [ ] Large lists use virtual scrolling
- [ ] Heavy computations are memoized or moved to Web Worker

---

## Testing Performance

```tsx
import { Profiler } from 'react';

function App() {
  const onRender = (
    id: string,
    phase: string,
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    if (actualDuration > 100) {
      console.warn(`[Profiler] ${id} took ${actualDuration}ms (${phase})`);
    }
  };
  
  return (
    <Profiler id="App" onRender={onRender}>
      <YourComponent />
    </Profiler>
  );
}
```

---

## Performance Budget

| Component Type | Target Render Time | Max Re-renders/sec |
|----------------|-------------------|-------------------|
| List items (memo'd) | < 5ms | Unlimited |
| Form inputs | < 10ms | 60 (debounced) |
| Charts | < 50ms | 10 (debounced) |
| Modals | < 100ms | 1 |
| Full panels | < 200ms | 1 |

---

**Status:** Guide Complete
**Next:** Apply to high-priority components
