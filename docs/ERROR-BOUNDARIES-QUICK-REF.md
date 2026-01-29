# Error Boundaries - Quick Reference

## 🚀 Quick Start

### Add Error Boundary to New Component

**Easiest Method:**
```tsx
import { withErrorBoundary } from './components/ProtectedPanels';

const MyNewPanel = () => {
  // Your component
};

export default withErrorBoundary(MyNewPanel, 'My New Panel');
```

**Direct Method:**
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

<ErrorBoundary panelName="My Component">
  <MyComponent />
</ErrorBoundary>
```

## ⚡ Common Patterns

### Wrap a Panel
```tsx
// In ProtectedPanels.tsx
import MyPanelRaw from './MyPanel';
export const MyPanel = withErrorBoundary(MyPanelRaw, 'My Panel Name');

// In App.tsx
import { MyPanel } from './components/ProtectedPanels';
```

### Wrap a Modal
```tsx
<ErrorBoundary panelName="Settings Modal">
  <SettingsModal isOpen={isOpen} onClose={onClose} />
</ErrorBoundary>
```

### Custom Error Handler
```tsx
<ErrorBoundary 
  panelName="Analytics"
  onError={(error, info) => {
    console.log('Analytics error:', error);
    sendToErrorTracker(error);
  }}
>
  <AnalyticsPanel />
</ErrorBoundary>
```

## 🔧 Testing Errors

### Test in Dev Mode

Navigate to: `http://localhost:5173/#error-test` (if view is enabled)

Or add test code:
```tsx
// Trigger null reference error
const obj: any = null;
obj.property.nested;

// Trigger network error
throw new Error('Network request failed');

// Trigger timeout error
throw new Error('Request timeout');
```

### Test Error Recovery

1. Trigger an error
2. Click "Try Again" → component should re-render
3. Click "Reload Page" → full app refresh
4. Click "Copy Error Details" → clipboard should have error JSON

## ❌ What Error Boundaries DON'T Catch

```tsx
// ❌ Event handlers - need try/catch
const handleClick = () => {
  riskyFunction(); // Won't be caught!
};

// ✅ Wrap in try/catch
const handleClick = () => {
  try {
    riskyFunction();
  } catch (error) {
    showToast('error', 'Failed');
  }
};

// ❌ Async code - need try/catch
const loadData = async () => {
  const data = await fetch('/api'); // Won't be caught!
};

// ✅ Wrap in try/catch
const loadData = async () => {
  try {
    const data = await fetch('/api');
  } catch (error) {
    showToast('error', 'Failed to load');
  }
};
```

## 📋 Checklist for New Components

- [ ] Wrapped in ErrorBoundary or using withErrorBoundary HOC
- [ ] Panel name provided for error context
- [ ] Async operations have try/catch
- [ ] Event handlers have try/catch
- [ ] Tested error scenarios
- [ ] Verified "Try Again" works
- [ ] Verified error message is user-friendly

## 🎯 Error Patterns We Handle

| Error Type | User Sees | Icon |
|------------|-----------|------|
| Null reference | "Missing Data" | 📦 |
| Network failed | "Connection Problem" | 🌐 |
| Timeout | "Request Timeout" | ⏱️ |
| Function error | "Code Error" | ⚙️ |
| Infinite loop | "Infinite Loop" | ♾️ |
| WebSocket | "Connection Lost" | 🔌 |
| Storage | "Storage Error" | 💾 |
| Permission | "Permission Denied" | 🔒 |

## 🚨 Emergency: App Won't Start

If error boundaries cause startup issues:

1. Check console for actual error
2. Temporarily remove ErrorBoundary wrapper
3. Fix underlying issue
4. Re-add ErrorBoundary wrapper
5. Test recovery

## 📝 Adding New Error Pattern

In `ErrorBoundary.tsx`:

```tsx
const ERROR_PATTERNS = [
  // ... existing patterns
  {
    test: /your regex here/i,
    title: 'User-Friendly Title',
    message: 'What happened in plain language',
    suggestion: 'What the user should do',
    icon: '🔥'
  }
];
```

## 🔗 Related Docs

- Full documentation: `docs/ERROR-BOUNDARIES.md`
- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
