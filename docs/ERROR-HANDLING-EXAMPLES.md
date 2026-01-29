# Error Handling Examples

Practical examples of proper error handling in the Froggo Dashboard.

## Example 1: Simple Panel with Error Boundary

```tsx
import { withErrorBoundary } from './components/ProtectedPanels';

function MySimplePanel() {
  return (
    <div className="p-6">
      <h1>My Panel</h1>
      {/* Component content */}
    </div>
  );
}

// Wrap and export - errors in rendering are now caught
export default withErrorBoundary(MySimplePanel, 'My Simple Panel');
```

## Example 2: Panel with Async Data Loading

```tsx
import { useState, useEffect } from 'react';
import { withErrorBoundary } from './components/ProtectedPanels';
import { showToast } from './components/Toast';

function DataPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      // Error boundary won't catch async errors - handle manually
      console.error('Failed to load data:', err);
      setError(err.message);
      showToast('error', 'Failed to load data', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render different states
  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-600">Error: {error}</p>
          <button 
            onClick={loadData}
            className="mt-2 px-4 py-2 bg-clawd-accent text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Render data */}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// Error boundary catches rendering errors, manual handling for async
export default withErrorBoundary(DataPanel, 'Data Panel');
```

## Example 3: Component with User Actions

```tsx
import { useState } from 'react';
import { withErrorBoundary } from './components/ProtectedPanels';
import { showToast } from './components/Toast';

function ActionPanel() {
  const [processing, setProcessing] = useState(false);

  const handleAction = async () => {
    try {
      setProcessing(true);
      
      // Risky operation
      const result = await performAction();
      
      showToast('success', 'Action completed', result.message);
    } catch (err) {
      // Catch and handle event errors explicitly
      console.error('Action failed:', err);
      
      // Provide user-friendly error message
      const userMessage = err.message.includes('network')
        ? 'Network error. Check your connection.'
        : err.message.includes('permission')
        ? 'Permission denied. Check your access.'
        : 'Action failed. Please try again.';
      
      showToast('error', 'Action Failed', userMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleDangerousAction = () => {
    try {
      // Could throw synchronous error
      dangerousOperation();
      showToast('success', 'Success');
    } catch (err) {
      console.error('Dangerous operation failed:', err);
      showToast('error', 'Operation failed');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={handleAction}
        disabled={processing}
        className="px-4 py-2 bg-clawd-accent text-white rounded"
      >
        {processing ? 'Processing...' : 'Safe Action'}
      </button>

      <button
        onClick={handleDangerousAction}
        className="px-4 py-2 bg-red-500 text-white rounded"
      >
        Dangerous Action
      </button>
    </div>
  );
}

async function performAction() {
  // Simulated async operation
  return { message: 'Done' };
}

function dangerousOperation() {
  // Could throw
  if (Math.random() > 0.5) {
    throw new Error('Random failure');
  }
}

export default withErrorBoundary(ActionPanel, 'Action Panel');
```

## Example 4: Form with Validation

```tsx
import { useState } from 'react';
import { withErrorBoundary } from './components/ProtectedPanels';
import { showToast } from './components/Toast';

function FormPanel() {
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate
      const validationErrors = validateForm();
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
      
      setErrors({});
      setSubmitting(true);
      
      // Submit
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Submission failed');
      }
      
      showToast('success', 'Form submitted');
      setFormData({ name: '', email: '' }); // Reset
      
    } catch (err) {
      console.error('Form submission failed:', err);
      
      // User-friendly error
      if (err.message.includes('network') || err.message.includes('fetch')) {
        showToast('error', 'Network error', 'Check your connection and try again');
      } else if (err.message.includes('timeout')) {
        showToast('error', 'Request timeout', 'Server is slow, please try again');
      } else {
        showToast('error', 'Submission failed', err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.name && (
          <p className="text-sm text-red-600 mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.email && (
          <p className="text-sm text-red-600 mt-1">{errors.email}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 bg-clawd-accent text-white rounded"
      >
        {submitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}

export default withErrorBoundary(FormPanel, 'Form Panel');
```

## Example 5: WebSocket Component

```tsx
import { useState, useEffect, useRef } from 'react';
import { withErrorBoundary } from './components/ProtectedPanels';
import { showToast } from './components/Toast';

function LiveDataPanel() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        showToast('success', 'Connected to live updates');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessages(prev => [...prev, message]);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showToast('error', 'Connection error');
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        // Auto-reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      };
      
      wsRef.current = ws;
      
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      showToast('error', 'Failed to connect', 'Will retry in 5 seconds');
      
      // Retry
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  };

  const sendMessage = (message) => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }
      
      wsRef.current.send(JSON.stringify(message));
      showToast('success', 'Message sent');
      
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('error', 'Failed to send', 'Not connected to server');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <span className={`inline-block w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="ml-2">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="space-y-2">
        {messages.map((msg, i) => (
          <div key={i} className="p-2 bg-clawd-surface rounded border">
            {JSON.stringify(msg)}
          </div>
        ))}
      </div>

      <button
        onClick={() => sendMessage({ type: 'ping' })}
        disabled={!connected}
        className="mt-4 px-4 py-2 bg-clawd-accent text-white rounded disabled:opacity-50"
      >
        Send Test Message
      </button>
    </div>
  );
}

export default withErrorBoundary(LiveDataPanel, 'Live Data Panel');
```

## Key Takeaways

1. **Error Boundary catches:** Rendering errors, lifecycle errors
2. **You must handle:** Async errors, event handler errors, WebSocket errors
3. **Always use try/catch** for: async/await, event handlers, risky operations
4. **Provide user feedback:** Toast notifications for errors
5. **Implement retry logic:** Allow users to recover from errors
6. **Log errors:** Console.error for debugging
7. **Test error scenarios:** Make sure recovery works

## Common Mistakes

❌ **Relying on Error Boundary for everything**
```tsx
// This won't work - error boundary doesn't catch async
const handleClick = async () => {
  const data = await fetch('/api'); // Not caught!
};
```

❌ **No user feedback**
```tsx
// User has no idea what happened
try {
  await riskyOperation();
} catch (err) {
  console.error(err); // Silent failure
}
```

❌ **Generic error messages**
```tsx
// Not helpful
showToast('error', 'Error occurred');
```

✅ **Proper error handling**
```tsx
const handleClick = async () => {
  try {
    const data = await fetch('/api');
    showToast('success', 'Data loaded');
  } catch (err) {
    console.error('Fetch failed:', err);
    showToast('error', 'Failed to load data', 'Check your connection');
  }
};
```
