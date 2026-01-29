# Error Boundary System

**Status:** ✅ Complete (2026-01-28)

## Overview

The Froggo Dashboard now has comprehensive error handling via React Error Boundaries. When errors occur, users see helpful recovery suggestions instead of blank screens or crashes.

## Features

✅ **User-friendly error messages** - Clear, non-technical language  
✅ **Recovery suggestions** - Actionable steps to resolve the issue  
✅ **Pattern matching** - Recognizes common errors and provides specific guidance  
✅ **Graceful degradation** - Only the failed component breaks, not the whole app  
✅ **Error reporting** - Copy error details for debugging  
✅ **Development mode** - Show technical stack traces in dev builds  

## Architecture

### Components

1. **ErrorBoundary.tsx** - Core error boundary component with smart error detection
2. **ProtectedPanels.tsx** - All major panels wrapped with error boundaries
3. **ErrorBoundaryTest.tsx** - Test component for development (dev mode only)

### Error Pattern Detection

The system recognizes these error patterns and provides tailored messages:

| Pattern | User Message | Suggestion |
|---------|--------------|------------|
| `Cannot read property of null/undefined` | Missing Data | Refresh or wait for data to load |
| `Network failed` | Connection Problem | Check internet connection |
| `Failed to fetch` | Network Error | Server might be down, try again |
| `timeout` | Request Timeout | Server is slow, refresh the page |
| `is not a function` | Code Error | Refresh, report if persists |
| `before initialization` | Loading Error | Refresh to restart loading |
| `Maximum update depth` | Infinite Loop | Refresh, report if repeats |
| `WebSocket` | Connection Lost | Check connection and refresh |
| `localStorage/sessionStorage` | Storage Error | Check storage space or clear cache |
| `permission denied` | Permission Denied | Check browser permissions |

### Boundary Hierarchy

```
App (Root Boundary)
├── TopBar (Boundary)
├── Sidebar (Boundary)
├── Main Content
│   ├── Dashboard (Protected Panel)
│   ├── Kanban (Protected Panel)
│   ├── Agents (Protected Panel)
│   ├── Chat (Protected Panel)
│   ├── Voice (Protected Panel)
│   ├── Settings (Protected Panel)
│   ├── X/Twitter (Protected Panel)
│   ├── Inbox (Protected Panel)
│   ├── ... (all panels protected)
├── Command Palette (Boundary)
├── Toast System (Boundary)
├── Global Search (Boundary)
├── Quick Actions (Boundary)
└── Modals (Each in Boundary)
    ├── Contact Modal
    └── Skill Modal
```

## Usage

### Wrapping a New Component

**Option 1: Use the HOC (Recommended)**

```tsx
import { withErrorBoundary } from './components/ProtectedPanels';

const MyPanel = () => {
  // Your component code
};

export default withErrorBoundary(MyPanel, 'My Panel Name');
```

**Option 2: Direct Wrapper**

```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function MyComponent() {
  return (
    <ErrorBoundary panelName="My Component">
      <ActualComponent />
    </ErrorBoundary>
  );
}
```

**Option 3: Add to ProtectedPanels.tsx**

```tsx
// Import raw component
import MyPanelRaw from './MyPanel';

// Wrap and export
export const MyPanel = withErrorBoundary(MyPanelRaw, 'My Panel');
```

### Custom Error Handler

```tsx
<ErrorBoundary 
  panelName="Special Panel"
  onError={(error, errorInfo) => {
    // Custom logging, analytics, etc.
    console.log('Error in Special Panel:', error);
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Custom Fallback UI

```tsx
<ErrorBoundary 
  panelName="Minimal Panel"
  fallback={<div>Oops! Something went wrong.</div>}
>
  <MyComponent />
</ErrorBoundary>
```

## Testing

### Development Testing

1. Start dev server: `npm run dev`
2. Navigate to error test page by adding `error-test` view
3. Click buttons to trigger different error types
4. Verify error UI appears correctly
5. Test recovery actions (Try Again, Reload)

### Test Different Scenarios

```tsx
// Test null reference
const obj = null;
obj.property.nested; // Triggers "Missing Data" message

// Test network error
throw new Error('Network request failed');

// Test timeout
throw new Error('Request timeout: took too long');

// Test function error
const notAFunction = 'string';
notAFunction(); // Triggers "Code Error" message
```

### Manual Testing Checklist

- [ ] Error appears with friendly message
- [ ] Suggestion is relevant to error type
- [ ] "Try Again" button resets component
- [ ] "Reload Page" button refreshes app
- [ ] "Copy Error Details" copies to clipboard
- [ ] Development mode shows stack trace
- [ ] Production mode hides stack trace
- [ ] Only failed component breaks (not whole app)

## Error Handling Best Practices

### What Error Boundaries Catch

✅ Errors during rendering  
✅ Errors in lifecycle methods  
✅ Errors in constructors  

### What Error Boundaries Don't Catch

❌ Event handlers (use try/catch)  
❌ Async code (use try/catch with async/await)  
❌ Server-side rendering errors  
❌ Errors in the error boundary itself  

### Handling Async Errors

Error boundaries **cannot** catch async errors. Handle them explicitly:

```tsx
// ❌ BAD - Error boundary won't catch this
const handleClick = async () => {
  const data = await fetchData(); // If this fails, app crashes
};

// ✅ GOOD - Explicit error handling
const handleClick = async () => {
  try {
    const data = await fetchData();
  } catch (error) {
    console.error('Failed to fetch:', error);
    showToast('error', 'Failed to load data');
  }
};
```

### Handling Event Errors

```tsx
// ❌ BAD - Error boundary won't catch this
const handleClick = () => {
  riskyOperation(); // If this fails, app crashes
};

// ✅ GOOD - Explicit try/catch
const handleClick = () => {
  try {
    riskyOperation();
  } catch (error) {
    console.error('Operation failed:', error);
    showToast('error', 'Operation failed');
  }
};
```

## Recovery Actions

Each error screen provides three actions:

1. **Copy Error Details** - Copies error info to clipboard for reporting
2. **Try Again** - Resets the error boundary and retries rendering
3. **Reload Page** - Full page refresh (clears all state)

## Logging and Monitoring

Errors are automatically logged to the console with:
- Panel name
- Error message
- Stack trace
- Component stack

To add external error tracking:

```tsx
// In App.tsx or root component
if (window.errorTracker) {
  // Errors will be automatically sent to your tracker
}
```

## Future Enhancements

- [ ] Add error analytics dashboard
- [ ] Implement retry with exponential backoff
- [ ] Add "Report Bug" button with pre-filled issue
- [ ] Network status detection for better error messages
- [ ] Offline mode fallback
- [ ] Error recovery suggestions based on user history

## Files

- `src/components/ErrorBoundary.tsx` - Core implementation
- `src/components/ProtectedPanels.tsx` - Wrapped panel exports
- `src/components/ErrorBoundaryTest.tsx` - Test component (dev only)
- `src/App.tsx` - Root-level error boundaries
- `docs/ERROR-BOUNDARIES.md` - This document

## Related

- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- Error Handling Best Practices: https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react
