# Error Handling & UX Boundaries Guide

## Overview

This guide documents the comprehensive error handling system implemented for the Froggo Dashboard. All components follow consistent patterns for error states, validation, confirmation dialogs, and graceful degradation.

## New Components

### 1. **ErrorDisplay** (`src/components/ErrorDisplay.tsx`)

Comprehensive error display with recovery actions.

**Features:**
- User-friendly error messages
- Automatic error categorization
- Recovery action suggestions
- Inline and full-page variants
- Stack trace display (dev mode)

**Usage:**
```tsx
import ErrorDisplay from './ErrorDisplay';

// Full page error
<ErrorDisplay
  error={error}
  context={{ action: 'load tasks', resource: 'tasks' }}
  onRetry={() => refetch()}
  showStack={process.env.NODE_ENV === 'development'}
/>

// Inline error
<ErrorDisplay
  error={error}
  inline
  onDismiss={() => setError(null)}
/>
```

### 2. **ConfirmDialog** (`src/components/ConfirmDialog.tsx`)

Confirmation dialogs for destructive actions.

**Features:**
- Danger/warning/info variants
- Required input confirmation (type-to-confirm)
- Loading states
- Preset configurations
- Accessible and keyboard-friendly

**Usage:**
```tsx
import ConfirmDialog, { useConfirmDialog, confirmPresets } from './ConfirmDialog';

function MyComponent() {
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();

  const handleDelete = () => {
    showConfirm(
      confirmPresets.deleteTask('My Task'),
      async () => {
        await deleteTask();
        showToast('success', 'Task deleted');
      }
    );
  };

  return (
    <>
      <button onClick={handleDelete}>Delete</button>
      <ConfirmDialog
        open={open}
        {...config}
        onConfirm={onConfirm}
        onClose={closeConfirm}
      />
    </>
  );
}
```

**Presets available:**
- `confirmPresets.deleteTask(taskTitle)`
- `confirmPresets.deleteAgent(agentName)` (requires input)
- `confirmPresets.abortAgent(agentName)`
- `confirmPresets.clearData()` (requires input)
- `confirmPresets.reopenTask()`
- `confirmPresets.approveChanges()`

### 3. **ErrorBoundary** (`src/components/ErrorBoundary.tsx`)

Global error boundary for catching React errors.

**Features:**
- Graceful error recovery
- Error reporting (copy to clipboard)
- Multiple error detection
- Custom fallback support
- Production error logging ready

**Usage:**
```tsx
import ErrorBoundary from './ErrorBoundary';

// Wrap your app or components
<ErrorBoundary onError={(error, info) => logToService(error)}>
  <App />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary fallback={<CustomErrorPage />}>
  <RiskyComponent />
</ErrorBoundary>

// Use imperative error handler
function MyComponent() {
  const handleError = useErrorHandler();
  
  const doSomething = async () => {
    try {
      await riskyOperation();
    } catch (err) {
      handleError(err); // Throws to error boundary
    }
  };
}
```

### 4. **ValidatedInput** (`src/components/ValidatedInput.tsx`)

Input components with built-in validation.

**Components:**
- `ValidatedInput` - Text input
- `ValidatedTextarea` - Textarea with character count
- `ValidatedSelect` - Select dropdown

**Usage:**
```tsx
import { ValidatedInput, ValidatedTextarea, ValidatedSelect } from './ValidatedInput';
import { commonRules } from '../utils/validation';

<ValidatedInput
  label="Task Title"
  rules={commonRules.taskTitle()}
  onChange={(value, valid) => {
    setTitle(value);
    setIsValid(valid);
  }}
  placeholder="Enter task title..."
  helpText="Be clear and actionable"
/>

<ValidatedTextarea
  label="Description"
  rules={commonRules.taskDescription()}
  maxLength={2000}
  showCharCount
  rows={4}
/>

<ValidatedSelect
  label="Priority"
  options={[
    { value: 'p0', label: 'Urgent' },
    { value: 'p1', label: 'High' },
    { value: 'p2', label: 'Medium' },
    { value: 'p3', label: 'Low' },
  ]}
  rules={[commonRules.required('Priority')]}
/>
```

## Utilities

### Error Messages (`src/utils/errorMessages.ts`)

Enhanced error message system with recovery suggestions.

**Key Functions:**

```tsx
import { getErrorInfo, getUserFriendlyError, getRecoveryActions } from '../utils/errorMessages';

// Get comprehensive error info
const errorInfo = getErrorInfo(error, {
  action: 'save task',
  resource: 'task',
  technical: 'Database connection failed',
});

console.log(errorInfo);
// {
//   title: 'Database Error',
//   message: 'We're having trouble saving your changes...',
//   recoverable: true,
//   severity: 'error',
//   code: 'DATABASE_ERROR',
//   recovery: [
//     { label: 'Try Again', action: 'retry' },
//     { label: 'Restart App', action: 'restart' }
//   ]
// }

// Legacy compatibility
const message = getUserFriendlyError(error, { action: 'load data' });

// Get recovery actions
const actions = getRecoveryActions(error);
```

**Error Types Handled:**
- Network errors (ENOTFOUND, fetch failures)
- Timeout errors
- Permission denied (403, EACCES)
- Not found (404, ENOENT)
- Server errors (5xx)
- Authentication (401)
- Rate limiting (429)
- Validation errors (400)
- Database errors (SQLite, IPC)
- Agent spawn errors
- Conflict errors (409)

### Validation (`src/utils/validation.ts`)

Input validation utilities with common rules.

**Key Functions:**

```tsx
import { validate, commonRules, validateFile, formatFileSize } from '../utils/validation';

// Validate input
const result = validate(value, [
  commonRules.required('Task title'),
  commonRules.minLength(3, 'Task title'),
  commonRules.maxLength(200, 'Task title'),
]);

if (!result.valid) {
  console.log(result.error); // "Task title must be at least 3 characters"
}

// Common validation rules
commonRules.required(fieldName);
commonRules.minLength(length, fieldName);
commonRules.maxLength(length, fieldName);
commonRules.email();
commonRules.url();
commonRules.taskTitle();
commonRules.taskDescription();
commonRules.agentName();
commonRules.fileName();
commonRules.noSpecialChars();
commonRules.alphanumeric();
commonRules.noWhitespace();

// File validation
const fileResult = validateFile(file, {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['image/png', 'image/jpeg'],
  allowedExtensions: ['png', 'jpg', 'jpeg'],
});

// Format file size
formatFileSize(1048576); // "1 MB"
```

**Custom Validation:**

```tsx
import { ValidationRule } from '../utils/validation';

const customRule: ValidationRule = {
  type: 'custom',
  message: 'Task title must start with a verb',
  validator: (value) => /^(add|fix|update|create|build)/i.test(value),
};
```

## Integration Patterns

### 1. **Form with Validation**

```tsx
function TaskForm() {
  const [title, setTitle] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await createTask({ title });
      showToast('success', 'Task created');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <ErrorDisplay
          error={error}
          context={{ action: 'create task' }}
          onRetry={handleSubmit}
          inline
          onDismiss={() => setError(null)}
        />
      )}
      
      <ValidatedInput
        label="Task Title"
        rules={commonRules.taskTitle()}
        onChange={(value, valid) => {
          setTitle(value);
          setIsValid(valid);
        }}
      />
      
      <LoadingButton
        onClick={handleSubmit}
        loading={loading}
        disabled={!isValid}
      >
        Create Task
      </LoadingButton>
    </div>
  );
}
```

### 2. **Delete Action with Confirmation**

```tsx
function TaskCard({ task }) {
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();
  const [error, setError] = useState(null);

  const handleDelete = () => {
    showConfirm(
      confirmPresets.deleteTask(task.title),
      async () => {
        try {
          await deleteTask(task.id);
          showToast('success', 'Task deleted');
        } catch (err) {
          setError(err);
          showToast('error', 'Failed to delete task');
        }
      }
    );
  };

  return (
    <>
      <button onClick={handleDelete}>Delete</button>
      
      <ConfirmDialog
        open={open}
        {...config}
        onConfirm={onConfirm}
        onClose={closeConfirm}
      />
      
      {error && (
        <ErrorDisplay error={error} inline />
      )}
    </>
  );
}
```

### 3. **Data Loading with Error States**

```tsx
function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  if (loading) {
    return <LoadingOverlay message="Loading tasks..." />;
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        context={{ action: 'load tasks', resource: 'tasks' }}
        onRetry={loadTasks}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        type="tasks"
        action={{
          label: 'Create Task',
          onClick: () => setModalOpen(true),
          icon: <Plus size={16} />,
        }}
      />
    );
  }

  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  );
}
```

### 4. **File Upload with Validation**

```tsx
function FileUpload() {
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateFile(file, {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedExtensions: ['pdf', 'doc', 'docx'],
    });

    if (!validation.valid) {
      setError(new Error(validation.error));
      return;
    }

    setError(null);
    setUploading(true);

    try {
      await uploadFile(file);
      showToast('success', 'File uploaded');
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {error && (
        <ErrorDisplay error={error} inline onDismiss={() => setError(null)} />
      )}
      
      <input
        type="file"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      
      {uploading && <InlineLoader text="Uploading..." />}
    </div>
  );
}
```

## Best Practices

### 1. **Always Validate User Input**

```tsx
// ✅ Good
<ValidatedInput
  rules={[commonRules.required('Email'), commonRules.email()]}
  onChange={(value, valid) => setFormValid(valid)}
/>

// ❌ Bad - no validation
<input onChange={(e) => setEmail(e.target.value)} />
```

### 2. **Confirm Destructive Actions**

```tsx
// ✅ Good - confirmation dialog
const handleDelete = () => {
  showConfirm(confirmPresets.deleteTask(task.title), () => deleteTask());
};

// ❌ Bad - immediate deletion
const handleDelete = () => {
  deleteTask();
};
```

### 3. **Provide Error Context**

```tsx
// ✅ Good - specific context
<ErrorDisplay
  error={error}
  context={{
    action: 'save task',
    resource: 'task',
    technical: 'Connection timeout',
  }}
/>

// ❌ Bad - generic error
<div>Error: {error.message}</div>
```

### 4. **Show Loading States**

```tsx
// ✅ Good
{loading && <LoadingOverlay message="Saving..." />}
{!loading && !error && tasks.length === 0 && <EmptyState />}
{!loading && error && <ErrorDisplay error={error} />}
{!loading && !error && tasks.length > 0 && <TaskList tasks={tasks} />}

// ❌ Bad - no feedback
<TaskList tasks={tasks} />
```

### 5. **Enable Error Recovery**

```tsx
// ✅ Good - retry option
<ErrorDisplay
  error={error}
  onRetry={() => refetch()}
  onDismiss={() => setError(null)}
/>

// ❌ Bad - dead end
<div>Error occurred. {error.message}</div>
```

### 6. **Use Empty States**

```tsx
// ✅ Good
if (items.length === 0) {
  return (
    <EmptyState
      type="tasks"
      action={{
        label: 'Create First Task',
        onClick: openModal,
      }}
    />
  );
}

// ❌ Bad
if (items.length === 0) {
  return <div>No items</div>;
}
```

## Checklist for New Components

When creating a new component, ensure:

- [ ] **Validation** - User inputs are validated with clear error messages
- [ ] **Loading states** - Show spinners/skeletons while loading
- [ ] **Error handling** - Catch errors and show user-friendly messages
- [ ] **Empty states** - Handle empty data gracefully
- [ ] **Confirmation** - Destructive actions require confirmation
- [ ] **Recovery** - Provide retry/refresh options for errors
- [ ] **Accessibility** - Keyboard navigation, focus management
- [ ] **Toast feedback** - Success/error notifications for actions

## Testing

### Manual Testing Checklist

- [ ] Submit empty form → validation errors shown
- [ ] Submit invalid data → specific error messages
- [ ] Network error → user-friendly message with retry
- [ ] Delete action → confirmation dialog appears
- [ ] Type-to-confirm required → cannot proceed without correct input
- [ ] Loading state → spinner/skeleton displayed
- [ ] Empty data → helpful empty state with action
- [ ] Error recovery → retry button works
- [ ] Keyboard navigation → all actions accessible via keyboard

### Error Simulation

```tsx
// Simulate errors for testing
const simulateError = (type: string) => {
  const errors = {
    network: new Error('Failed to fetch'),
    timeout: { code: 'ETIMEDOUT', message: 'Request timeout' },
    auth: { status: 401, message: 'Unauthorized' },
    notFound: { status: 404, message: 'Not found' },
    validation: { message: 'invalid input' },
    database: new Error('SQLITE_ERROR: database locked'),
  };
  return errors[type];
};

// Use in dev mode
if (process.env.NODE_ENV === 'development') {
  throw simulateError('network');
}
```

## Migration Guide

### Converting Existing Components

**Before:**
```tsx
const handleSave = async () => {
  try {
    await saveTask(task);
    alert('Saved!');
  } catch (err) {
    console.error(err);
    alert('Error saving');
  }
};

return (
  <div>
    <input value={title} onChange={(e) => setTitle(e.target.value)} />
    <button onClick={handleSave}>Save</button>
  </div>
);
```

**After:**
```tsx
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

const handleSave = async () => {
  setLoading(true);
  setError(null);
  
  try {
    await saveTask(task);
    showToast('success', 'Task saved');
  } catch (err) {
    setError(err);
  } finally {
    setLoading(false);
  }
};

return (
  <div>
    {error && (
      <ErrorDisplay
        error={error}
        context={{ action: 'save task' }}
        inline
        onRetry={handleSave}
        onDismiss={() => setError(null)}
      />
    )}
    
    <ValidatedInput
      label="Title"
      value={title}
      rules={commonRules.taskTitle()}
      onChange={(value, valid) => {
        setTitle(value);
        setIsValid(valid);
      }}
    />
    
    <LoadingButton
      onClick={handleSave}
      loading={loading}
      disabled={!isValid}
    >
      Save
    </LoadingButton>
  </div>
);
```

## Summary

The error handling system provides:

✅ **User-friendly error messages** - No more technical jargon  
✅ **Input validation** - Prevent bad data before submission  
✅ **Confirmation dialogs** - Prevent accidental destructive actions  
✅ **Recovery actions** - Users can retry/refresh/navigate  
✅ **Loading states** - Clear feedback during async operations  
✅ **Empty states** - Helpful guidance when no data  
✅ **Error boundaries** - Graceful degradation for React errors  
✅ **Consistent patterns** - Same UX across all components

This creates a professional, polished, and user-friendly experience throughout the dashboard.
