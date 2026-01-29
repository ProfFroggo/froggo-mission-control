# Error Boundaries - Visual Guide

## Before vs. After

### ❌ Before: Application Without Error Boundaries

```
┌─────────────────────────────────────┐
│  Froggo Dashboard                    │
├─────────────────────────────────────┤
│  Sidebar │ Kanban Panel             │
│          │                           │
│  📋 Inbox│  💥 ERROR OCCURRED        │
│  📊 Tasks│                           │
│  👥 Agents                           │
│          │  (Entire app crashes)     │
│  🐦 X    │  (White screen of death)  │
│          │  (No recovery option)     │
│  ⚙️ Settings                          │
└─────────────────────────────────────┘

Problem: One component error = entire app down
User sees: Blank screen or cryptic technical error
Recovery: Manual browser refresh (loses state)
```

### ✅ After: Application With Error Boundaries

```
┌─────────────────────────────────────────────────────────┐
│  Froggo Dashboard                                        │
├─────────────────────────────────────────────────────────┤
│  Sidebar │ ┌──────────────────────────────────────────┐│
│          │ │  ⏱️  Request Timeout                     ││
│  📋 Inbox│ │  in Kanban Board                         ││
│  📊 Tasks│ │                                          ││
│  👥 Agents │  What happened?                          ││
│          │ │  The request took too long to complete  ││
│  🐦 X    │ │                                          ││
│          │ │  💡 What to try                          ││
│  ⚙️ Settings  The server might be slow. Try           ││
│          │ │  refreshing the page.                    ││
│          │ │                                          ││
│          │ │  [↻ Try Again] [🔄 Reload] [📋 Copy]    ││
│          │ └──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

Benefit: Only affected panel shows error
User sees: Helpful error message with recovery options
Recovery: One-click "Try Again" or selective reload
```

## Error Types Visual Reference

### 1. Missing Data (Null Reference)

```
┌────────────────────────────────────┐
│  📦  Missing Data                  │
│  in Dashboard Panel                │
│                                    │
│  What happened?                    │
│  Some expected data is not         │
│  available yet.                    │
│                                    │
│  💡 What to try                    │
│  Try refreshing the page or        │
│  waiting a moment for data to load.│
│                                    │
│  [↻ Try Again] [🔄 Reload Page]   │
└────────────────────────────────────┘
```

### 2. Network Error

```
┌────────────────────────────────────┐
│  🌐  Connection Problem            │
│  in Chat Panel                     │
│                                    │
│  What happened?                    │
│  Unable to connect to the server.  │
│                                    │
│  💡 What to try                    │
│  Check your internet connection    │
│  and try again.                    │
│                                    │
│  [↻ Try Again] [🔄 Reload Page]   │
└────────────────────────────────────┘
```

### 3. Timeout Error

```
┌────────────────────────────────────┐
│  ⏱️  Request Timeout               │
│  in Voice Assistant                │
│                                    │
│  What happened?                    │
│  The request took too long to      │
│  complete.                         │
│                                    │
│  💡 What to try                    │
│  The server might be slow. Try     │
│  refreshing the page.              │
│                                    │
│  [↻ Try Again] [🔄 Reload Page]   │
└────────────────────────────────────┘
```

### 4. Permission Denied

```
┌────────────────────────────────────┐
│  🔒  Permission Denied             │
│  in Voice Assistant                │
│                                    │
│  What happened?                    │
│  The app does not have permission  │
│  to perform this action.           │
│                                    │
│  💡 What to try                    │
│  Check your browser permissions    │
│  and try again.                    │
│                                    │
│  [↻ Try Again] [🔄 Reload Page]   │
└────────────────────────────────────┘
```

### 5. Code Error (Development Mode)

```
┌────────────────────────────────────────────────────┐
│  ⚙️  Code Error                                    │
│  in Settings Panel                                 │
│                                                    │
│  What happened?                                    │
│  Something unexpected happened in the application. │
│                                                    │
│  💡 What to try                                    │
│  Try refreshing the page. If this persists,        │
│  please report it.                                 │
│                                                    │
│  🔧 Stack Trace (dev mode) ▼                       │
│  TypeError: Cannot read property 'foo' of null     │
│      at SettingsPanel.render (Settings.tsx:42)     │
│      at finishClassComponent ...                   │
│                                                    │
│  [↻ Try Again] [🔄 Reload Page] [📋 Copy Details] │
└────────────────────────────────────────────────────┘
```

## Error Boundary Hierarchy

```
App.tsx (Root Boundary)
│
├── TopBar (Boundary)
│   └── Navigation, User menu
│
├── Sidebar (Boundary)
│   └── Navigation links
│
├── Main Content
│   │
│   ├── Dashboard (Protected)
│   │   ├── CalendarWidget
│   │   ├── EmailWidget
│   │   └── QuickActions
│   │
│   ├── Kanban (Protected)
│   │   ├── TaskCard
│   │   └── TaskDetailPanel
│   │
│   ├── Chat (Protected)
│   │   ├── MessageList
│   │   └── MessageInput
│   │
│   ├── Voice (Protected)
│   │   ├── Vosk Transcription
│   │   └── Audio Controls
│   │
│   └── ... (all other panels)
│
├── Command Palette (Boundary)
├── Global Search (Boundary)
├── Toast System (Boundary)
│
└── Modals (Each in Boundary)
    ├── Contact Modal
    ├── Skill Modal
    └── Task Modal
```

## User Flow Examples

### Scenario 1: Network Error While Loading Tasks

```
1. User clicks "Tasks" in sidebar
   └─> Kanban panel starts loading

2. Network request fails
   └─> Error boundary catches error

3. User sees friendly error:
   ┌────────────────────────────────┐
   │  🌐 Connection Problem         │
   │  Unable to connect to server   │
   │  [↻ Try Again]                 │
   └────────────────────────────────┘

4. User clicks "Try Again"
   └─> Panel resets and retries load

5. Success! Tasks load
   └─> User continues working
```

### Scenario 2: Permission Error in Voice Panel

```
1. User opens Voice panel
   └─> Requests microphone access

2. User denies permission
   └─> Error boundary catches error

3. User sees helpful message:
   ┌────────────────────────────────┐
   │  🔒 Permission Denied          │
   │  Check browser permissions     │
   │  [↻ Try Again]                 │
   └────────────────────────────────┘

4. User clicks "Try Again"
   └─> Permission prompt appears again

5. User grants permission
   └─> Voice panel works
```

### Scenario 3: Component Crash in Settings

```
1. User opens Settings
   └─> Component has rendering bug

2. Error occurs during render
   └─> Error boundary catches error

3. User sees error (dev mode):
   ┌────────────────────────────────┐
   │  ⚙️ Code Error                 │
   │  in Settings Panel             │
   │  🔧 Stack Trace ▼              │
   │  [↻ Try Again] [📋 Copy]      │
   └────────────────────────────────┘

4. Developer sees stack trace
   └─> Can fix the bug

5. User clicks "Reload Page"
   └─> App restarts fresh
```

## Component Integration Patterns

### Pattern 1: Wrap Individual Panel

```tsx
// MyPanel.tsx
function MyPanel() {
  return <div>Panel content</div>;
}

export default withErrorBoundary(MyPanel, 'My Panel');
```

### Pattern 2: Wrap in App.tsx

```tsx
// App.tsx
<ErrorBoundary panelName="Special Section">
  <SpecialComponent />
</ErrorBoundary>
```

### Pattern 3: Wrap Modal

```tsx
// Modal usage
<ErrorBoundary panelName="Settings Modal">
  <SettingsModal 
    isOpen={isOpen} 
    onClose={onClose} 
  />
</ErrorBoundary>
```

### Pattern 4: Nested Boundaries

```tsx
// Outer boundary catches panel errors
<ErrorBoundary panelName="Dashboard">
  <Dashboard>
    {/* Inner boundary catches widget errors */}
    <ErrorBoundary panelName="Calendar Widget">
      <CalendarWidget />
    </ErrorBoundary>
    
    <ErrorBoundary panelName="Email Widget">
      <EmailWidget />
    </ErrorBoundary>
  </Dashboard>
</ErrorBoundary>
```

## Icon Reference

| Error Type | Icon | Color |
|------------|------|-------|
| Missing Data | 📦 Database | Orange |
| Network Problem | 🌐 Network | Red |
| Fetch Failed | 📡 Wifi | Red |
| Timeout | ⏱️ Clock | Yellow |
| Code Error | ⚙️ Code | Purple |
| Loading Error | 🔄 Refresh | Blue |
| Infinite Loop | ♾️ Alert | Red |
| WebSocket | 🔌 Wifi | Orange |
| Storage | 💾 Database | Yellow |
| Permission | 🔒 Lock | Red |
| Default | ⚠️ Alert | Red |

## Action Button Reference

| Button | Icon | Action | When to Show |
|--------|------|--------|--------------|
| Try Again | ↻ | Resets error boundary | Non-critical errors |
| Reload Page | 🔄 | Full page refresh | All errors |
| Go Home | 🏠 | Navigate to / | Critical errors |
| Copy Details | 📋 | Copy error report | All errors |

## Development vs. Production

### Development Mode
```
┌────────────────────────────────────┐
│  ⚙️ Code Error                     │
│  in Settings Panel                 │
│                                    │
│  What happened?                    │
│  Something unexpected happened.    │
│                                    │
│  💡 What to try                    │
│  Try refreshing the page.          │
│                                    │
│  🔧 Stack Trace (dev mode) ▼       │
│  ┌──────────────────────────────┐ │
│  │ TypeError: ...               │ │
│  │   at Component.render():42   │ │
│  │   at finishClass...          │ │
│  └──────────────────────────────┘ │
│                                    │
│  [↻ Try Again] [📋 Copy Details]  │
└────────────────────────────────────┘

Shows: Stack traces, component stacks
Purpose: Debugging and development
```

### Production Mode
```
┌────────────────────────────────────┐
│  ⚙️ Code Error                     │
│  in Settings Panel                 │
│                                    │
│  What happened?                    │
│  Something unexpected happened.    │
│                                    │
│  💡 What to try                    │
│  Try refreshing the page. If this  │
│  persists, please report it.       │
│                                    │
│  [↻ Try Again] [🔄 Reload Page]   │
└────────────────────────────────────┘

Hides: Technical details
Shows: User-friendly messages only
Purpose: Clean UX for end users
```

## Testing Checklist

Use this visual checklist when testing error boundaries:

```
Error Boundary Testing
├─ ✓ Trigger null reference error
│  └─ See "Missing Data" message
├─ ✓ Trigger network error
│  └─ See "Connection Problem" message
├─ ✓ Trigger timeout error
│  └─ See "Request Timeout" message
├─ ✓ Click "Try Again"
│  └─ Component resets and retries
├─ ✓ Click "Reload Page"
│  └─ Full app refresh works
├─ ✓ Click "Copy Error Details"
│  └─ Clipboard has error JSON
├─ ✓ Test in dev mode
│  └─ Stack traces visible
├─ ✓ Test in production build
│  └─ Stack traces hidden
└─ ✓ Test nested boundaries
   └─ Only inner component fails
```

## Summary

Error boundaries transform the error experience from:

**❌ Technical → ✅ User-Friendly**  
**❌ Scary → ✅ Helpful**  
**❌ Crash → ✅ Graceful**  
**❌ No recovery → ✅ Easy recovery**  

Making errors less frightening and more actionable.
