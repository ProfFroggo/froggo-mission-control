# Froggo Dashboard Design System & Style Guide

**Version:** 2.0  
**Last Updated:** January 30, 2026  
**Task:** task-1769809773003  
**Status:** 🚧 In Progress

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Design Principles](#design-principles)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Component Library](#component-library)
7. [Motion & Animation](#motion--animation)
8. [Accessibility](#accessibility)
9. [Page-Specific Patterns](#page-specific-patterns)
10. [Modal System](#modal-system)
11. [Theme Support](#theme-support)
12. [Implementation Checklist](#implementation-checklist)

---

## Design Philosophy

### Core Belief
**Every pixel serves the user's workflow.** This is not art—this is a productivity tool. Beautiful, yes. But functional first.

### Inspiration Sources

#### Linear
- **What we adopt:** Purposeful minimalism, keyboard-first interactions, instant feedback
- **Why:** Speed and clarity. No decoration without function.

#### Notion
- **What we adopt:** Flexible information density, calm gray-scale foundation, progressive disclosure
- **Why:** Users need to focus on content, not chrome.

#### Vercel (Geist)
- **What we adopt:** Typography-first hierarchy, precise spacing scale, subtle gradients
- **Why:** Text clarity = cognitive clarity.

#### Stripe
- **What we adopt:** Accessibility-first design, trust through consistency, clear status indicators
- **Why:** This tool manages critical workflows—users must trust it completely.

#### Arc
- **What we adopt:** Bold use of color for meaning, spatial awareness, playful micro-interactions
- **Why:** Delight doesn't contradict function—it enhances engagement.

---

## Design Principles

### 1. **Workflow First**
Every element must answer: "How does this help the user complete their task faster?"

**Examples:**
- Modals can be dismissed with `Esc`
- Tables support `⌘+Click` for multi-select
- Search is always accessible via `⌘+K`
- Actions have keyboard shortcuts

### 2. **Predictable Consistency**
Same action, same result, same appearance—everywhere.

**Rules:**
- All buttons use same height scale (32px/40px/48px)
- All cards have same border radius (12px)
- All modals follow same padding structure
- All status colors map to same meanings

### 3. **Progressive Disclosure**
Show what's needed now. Hide what's not. Reveal on demand.

**Examples:**
- Task cards show summary; click for full detail
- Agent panels collapse advanced metrics
- Settings use tabs, not infinite scroll

### 4. **Immediate Feedback**
User takes action → UI responds within 100ms (perceived).

**Rules:**
- Buttons show hover state on mouseover
- Clicks show active state
- Async operations show loading state
- Success/error shows toast notification

### 5. **Accessible by Default**
Not a nice-to-have. Not a phase 2. Built-in from the start.

**Requirements:**
- WCAG 2.1 AA minimum (AAA where possible)
- All interactive elements keyboard-navigable
- Color is never the only indicator
- Focus states are visible and clear

---

## Color System

### Philosophy
Dark-first design with light mode support. Colors communicate **meaning and hierarchy**, not decoration.

### Base Palette (Dark Theme)

```css
/* Surfaces */
--clawd-bg: #0a0a0a;          /* Page background - near black */
--clawd-surface: #141414;     /* Cards, panels - elevated */
--clawd-border: #262626;      /* Dividers, borders - subtle */

/* Text */
--clawd-text: #fafafa;        /* Primary text - high contrast */
--clawd-text-dim: #a1a1aa;    /* Secondary text - reduced emphasis */

/* Accent */
--clawd-accent: #22c55e;      /* Primary action - green (Froggo brand) */
--clawd-accent-dim: #16a34a;  /* Hover/active state */
```

### Semantic Colors

**Success** - Green (#22c55e)
- Completed tasks
- Active agents
- Successful operations

**Error** - Red (#ef4444)
- Failed operations
- Destructive actions
- Critical alerts

**Warning** - Amber (#f59e0b)
- Pending reviews
- Attention needed
- Non-critical alerts

**Info** - Blue (#3b82f6)
- Informational messages
- In-progress states
- Neutral highlights

**Review** - Purple (#a855f7)
- Items awaiting review
- Draft states
- Secondary workflow states

### Channel Brand Colors

Respect brand identities for external platforms:

```css
--channel-discord: #5865F2;
--channel-telegram: #229ED9;
--channel-whatsapp: #25D366;
--channel-webchat: #a855f7;
```

### Color Usage Rules

1. **Never use color alone** to communicate information (accessibility)
2. **Backgrounds use 10% opacity** of semantic colors (`rgba(34, 197, 94, 0.1)`)
3. **Borders use 30% opacity** of semantic colors
4. **Text uses 100% opacity** of semantic colors
5. **Interactive states**:
   - Default: base color
   - Hover: 10% lighter/darker
   - Active: 20% lighter/darker
   - Disabled: 50% opacity

### Light Theme Overrides

```css
:root.light {
  --clawd-bg: #fafafa;
  --clawd-surface: #ffffff;
  --clawd-border: #e4e4e7;
  --clawd-text: #18181b;
  --clawd-text-dim: #52525b;
  /* Accent remains same for brand consistency */
}
```

---

## Typography

### Philosophy
**Clarity through hierarchy.** Users scan before they read. Make scanning effortless.

### Font Stack

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace;
```

**Why system fonts?**
- Instant load (no FOUT/FOIT)
- Native feel
- Excellent rendering
- Already optimized by OS

### Type Scale

| Token | Size | Use Case | Line Height | Weight |
|-------|------|----------|-------------|--------|
| `--text-display` | 30px | Hero sections, major page titles | 1.25 | 700 |
| `--text-heading-lg` | 24px | Page headings | 1.25 | 600 |
| `--text-heading` | 20px | Section headings | 1.25 | 600 |
| `--text-subheading` | 18px | Card titles, subsection headers | 1.5 | 500 |
| `--text-body` | 16px | Body text (default) | 1.5 | 400 |
| `--text-small` | 14px | Secondary information, labels | 1.5 | 400 |
| `--text-caption` | 12px | Captions, timestamps, metadata | 1.5 | 400 |

### Typography Rules

1. **One h1 per page** - Reserve for page title only
2. **Skip heading levels** - Never jump from h1 → h3
3. **Line length** - Limit to 65-75 characters for readability
4. **Line height** - 1.5 for body text, 1.25 for headings
5. **Contrast** - Minimum 4.5:1 for body text, 3:1 for large text (WCAG AA)

### Usage Examples

```jsx
// Page title
<h1 className="text-display">Dashboard</h1>

// Section heading
<h2 className="text-heading-lg">Active Tasks</h2>

// Card title
<h3 className="text-subheading">Task #1234</h3>

// Body text (default)
<p className="text-body">This is the task description...</p>

// Secondary info
<span className="text-small text-dim">Updated 2 hours ago</span>

// Metadata
<time className="text-caption text-dim">Jan 30, 2026</time>
```

---

## Spacing & Layout

### Philosophy
**Mathematical consistency beats artistic interpretation.** Use the 4px base unit scale religiously.

### Spacing Scale

Based on 4px increments:

```css
--space-1: 4px    /* Minimal */
--space-2: 8px    /* Compact */
--space-3: 12px   /* Normal */
--space-4: 16px   /* Comfortable (default) */
--space-6: 24px   /* Loose */
--space-8: 32px   /* Spacious */
--space-12: 48px  /* Section divider */
--space-16: 64px  /* Page section */
```

### Semantic Spacing

Use these for specific purposes:

```css
--spacing-inline: 8px        /* Icon + text gap */
--spacing-inline-tight: 6px  /* Tight inline elements */
--spacing-stack: 16px        /* Vertical stacking (default) */
--spacing-card: 16px         /* Card internal padding */
--spacing-card-lg: 24px      /* Large panel padding */
--spacing-section: 24px      /* Between page sections */
```

### Layout Patterns

#### Grid System
Use CSS Grid for complex layouts, Flexbox for simple ones.

```css
/* Dashboard grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-6);
}

/* Three-pane layout (Inbox) */
.three-pane {
  display: grid;
  grid-template-columns: 280px 400px 1fr;
  gap: 0;
  height: 100%;
}
```

#### Card Padding
Consistent internal padding creates predictable rhythm:

```css
/* Small card */
.card-sm {
  padding: var(--space-3); /* 12px */
}

/* Default card */
.card {
  padding: var(--space-4); /* 16px */
}

/* Large panel */
.card-lg {
  padding: var(--space-6); /* 24px */
}
```

#### Vertical Rhythm
Stack elements with consistent spacing:

```css
/* Form fields */
.form-field + .form-field {
  margin-top: var(--space-4); /* 16px */
}

/* Sections */
.section + .section {
  margin-top: var(--space-section); /* 24px */
}

/* Page sections */
.page-section + .page-section {
  margin-top: var(--space-12); /* 48px */
}
```

---

## Component Library

### Buttons

**Purpose:** Trigger actions. Make them obvious and accessible.

#### Variants

```jsx
// Primary - Main CTAs
<button className="btn-base btn-primary">
  Save Changes
</button>

// Secondary - Less emphasis
<button className="btn-base btn-secondary">
  Cancel
</button>

// Ghost - Minimal chrome
<button className="btn-base btn-ghost">
  Learn More
</button>

// Danger - Destructive actions
<button className="btn-base btn-danger">
  Delete Forever
</button>

// Icon-only
<button className="btn-base btn-icon">
  <Icon name="settings" />
</button>
```

#### Sizing

```css
/* Small - 32px height */
.btn-sm {
  height: var(--button-height-sm);
  padding: 0 12px;
  font-size: var(--text-small);
}

/* Medium (default) - 40px height */
.btn-base {
  height: var(--button-height-md);
  padding: 0 16px;
  font-size: var(--text-body);
}

/* Large - 48px height */
.btn-lg {
  height: var(--button-height-lg);
  padding: 0 24px;
  font-size: var(--text-subheading);
}
```

#### States

```css
/* Default */
.btn-primary {
  background: var(--clawd-accent);
  color: white;
}

/* Hover */
.btn-primary:hover {
  background: var(--clawd-accent-dim);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Active */
.btn-primary:active {
  transform: translateY(0);
}

/* Disabled */
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Focus (keyboard) */
.btn-primary:focus-visible {
  outline: 2px solid var(--clawd-accent);
  outline-offset: 2px;
}
```

---

### Cards

**Purpose:** Contain related information and actions.

#### Base Structure

```jsx
<div className="card-base">
  {/* Card content */}
</div>
```

#### Variants

```css
/* Standard card */
.card-base {
  background: var(--clawd-surface);
  border: 1px solid var(--clawd-border);
  border-radius: var(--radius-lg); /* 12px */
  padding: var(--spacing-card); /* 16px */
}

/* Glassmorphism card */
.card-glass {
  background: rgba(20, 20, 20, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  padding: var(--spacing-card-lg); /* 24px */
  box-shadow: var(--shadow-lg);
}

/* Interactive card */
.card-interactive {
  cursor: pointer;
  transition: all 200ms ease-out;
}

.card-interactive:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
  border-color: rgba(255, 255, 255, 0.2);
}
```

#### Stats Card Pattern

```jsx
<div className="card-stats">
  <div className="card-stats-icon">
    <Icon name="check-circle" className="text-success" />
  </div>
  <div className="card-stats-content">
    <div className="card-stats-label">Completed Today</div>
    <div className="card-stats-value">23</div>
  </div>
</div>
```

---

### Forms

**Purpose:** Collect user input. Make it easy and forgiving.

#### Input Fields

```jsx
// Text input
<div className="form-field">
  <label className="form-label">Task Title</label>
  <input 
    type="text" 
    className="input-base" 
    placeholder="Enter task title..."
  />
  <span className="form-hint">Brief, actionable description</span>
</div>

// With error state
<div className="form-field">
  <label className="form-label">Email</label>
  <input 
    type="email" 
    className="input-base input-error" 
    aria-invalid="true"
  />
  <span className="form-error">Please enter a valid email</span>
</div>
```

#### Textarea

```jsx
<textarea 
  className="textarea-base" 
  placeholder="Enter description..."
  rows={5}
/>
```

#### Select

```jsx
<select className="select-base">
  <option value="">Choose an option</option>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>
```

#### Checkbox & Radio

```jsx
// Checkbox
<label className="flex items-center gap-2">
  <input type="checkbox" className="checkbox-base" />
  <span className="text-body">I agree to terms</span>
</label>

// Radio group
<fieldset className="space-y-2">
  <legend className="form-label">Priority</legend>
  <label className="flex items-center gap-2">
    <input type="radio" name="priority" value="p0" />
    <span>Critical (P0)</span>
  </label>
  <label className="flex items-center gap-2">
    <input type="radio" name="priority" value="p1" />
    <span>High (P1)</span>
  </label>
</fieldset>
```

---

### Badges

**Purpose:** Label status, category, or count.

#### Status Badges

```jsx
<span className="badge-base badge-success">Done</span>
<span className="badge-base badge-warning">In Progress</span>
<span className="badge-base badge-error">Failed</span>
<span className="badge-base badge-info">Pending</span>
<span className="badge-base badge-review">Review</span>
<span className="badge-base badge-muted">Archived</span>
```

#### Count Badge

```jsx
<button className="relative">
  Inbox
  <span className="badge-count">23</span>
</button>
```

#### Priority Badges

```jsx
<span className="badge-base" style={{
  background: 'var(--priority-p0-bg)',
  color: 'var(--priority-p0)',
  borderColor: 'var(--priority-p0)'
}}>
  P0 - Critical
</span>
```

---

### Modals

**Purpose:** Focus attention on a specific task without leaving the page.

#### Base Structure

```jsx
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={onClose} />
  <div className="modal-container">
    <div className="modal-header">
      <h2 className="modal-title">Modal Title</h2>
      <button onClick={onClose} className="btn-icon btn-ghost">
        <Icon name="x" />
      </button>
    </div>
    <div className="modal-content">
      {/* Content here */}
    </div>
    <div className="modal-footer">
      <button className="btn-base btn-secondary" onClick={onClose}>
        Cancel
      </button>
      <button className="btn-base btn-primary" onClick={onSave}>
        Save Changes
      </button>
    </div>
  </div>
</div>
```

#### Size Variants

```css
/* Small - 400px */
.modal-sm { max-width: var(--modal-width-sm); }

/* Medium (default) - 600px */
.modal-md { max-width: var(--modal-width-md); }

/* Large - 800px */
.modal-lg { max-width: var(--modal-width-lg); }

/* Extra large - 1200px */
.modal-xl { max-width: var(--modal-width-xl); }
```

#### Accessibility

- **Trap focus** inside modal while open
- **Close on Esc** key
- **Return focus** to trigger element on close
- **aria-modal="true"** on container
- **aria-labelledby** pointing to title

---

### Lists

**Purpose:** Display collections of items with consistent structure.

#### Basic List

```jsx
<div className="space-y-2">
  {items.map(item => (
    <div key={item.id} className="list-item">
      <div className="list-item-icon">
        <Icon name={item.icon} />
      </div>
      <div className="list-item-content">
        <div className="list-item-title">{item.title}</div>
        <div className="list-item-subtitle">{item.subtitle}</div>
      </div>
      <div className="list-item-action">
        <Icon name="chevron-right" />
      </div>
    </div>
  ))}
</div>
```

#### Interactive List

```jsx
<div className="space-y-1">
  {items.map(item => (
    <button 
      key={item.id} 
      className="list-item-interactive w-full"
      onClick={() => handleClick(item)}
    >
      {/* Content */}
    </button>
  ))}
</div>
```

---

### Tables

**Purpose:** Display structured data with sorting and filtering.

#### Structure

```jsx
<table className="table-base">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
      <th>Priority</th>
      <th className="text-right">Actions</th>
    </tr>
  </thead>
  <tbody>
    {data.map(row => (
      <tr key={row.id} className="table-row">
        <td>{row.name}</td>
        <td>
          <span className="badge-base badge-success">
            {row.status}
          </span>
        </td>
        <td>{row.priority}</td>
        <td className="text-right">
          <button className="btn-icon btn-ghost">
            <Icon name="more" />
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

#### Styling

```css
.table-base {
  width: 100%;
  border-collapse: collapse;
}

.table-base th {
  text-align: left;
  padding: 12px 16px;
  font-size: var(--text-small);
  font-weight: var(--font-semibold);
  color: var(--clawd-text-dim);
  border-bottom: 1px solid var(--clawd-border);
}

.table-base td {
  padding: 16px;
  border-bottom: 1px solid var(--clawd-border);
}

.table-row:hover {
  background: rgba(255, 255, 255, 0.02);
}
```

---

### Avatars

**Purpose:** Represent users, agents, or entities visually.

#### Variants

```jsx
// With image
<div className="avatar">
  <img src={user.avatar} alt={user.name} />
</div>

// Fallback with initials
<div className="avatar">
  <div className="avatar-fallback">
    {user.initials}
  </div>
</div>

// Sizes
<div className="avatar avatar-sm">...</div>  {/* 32px */}
<div className="avatar">...</div>             {/* 40px default */}
<div className="avatar avatar-lg">...</div>   {/* 48px */}
<div className="avatar avatar-xl">...</div>   {/* 64px */}
```

---

### Empty States

**Purpose:** Guide users when no data exists yet.

```jsx
<div className="empty-state">
  <div className="empty-state-icon">
    <Icon name="inbox" size={48} />
  </div>
  <h3 className="empty-state-title">No tasks yet</h3>
  <p className="empty-state-description">
    Create your first task to get started with Froggo.
  </p>
  <button className="btn-base btn-primary">
    <Icon name="plus" />
    Create Task
  </button>
</div>
```

---

## Motion & Animation

### Philosophy
**Animation serves function, not decoration.** Every motion should communicate state or guide attention.

### Duration Scale

```css
--duration-instant: 50ms;   /* Micro-interactions */
--duration-fast: 150ms;     /* Hover, focus */
--duration-normal: 200ms;   /* Modals, dropdowns */
--duration-slow: 300ms;     /* Page transitions */
```

### Easing Functions

```css
--ease-out: cubic-bezier(0, 0, 0.2, 1);        /* Default */
--ease-in: cubic-bezier(0.4, 0, 1, 1);         /* Exits */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);   /* Symmetric */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);  /* Smooth glide */
```

### When to Animate

**✅ DO animate:**
- Hover states (150ms)
- Modal enter/exit (200ms)
- Page transitions (300ms)
- Loading indicators (continuous)
- Success/error feedback (200ms)

**❌ DON'T animate:**
- Large data tables
- Rapid repeated actions
- Critical actions (unless for feedback)
- During user scrolling

### Animation Examples

```css
/* Button hover */
.btn-primary {
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Modal fade-in */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-container {
  animation: fade-in-up var(--duration-normal) var(--ease-out);
}

/* Loading spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 0.6s linear infinite;
}
```

---

## Accessibility

### Philosophy
**Accessibility is not optional.** It's a core requirement from day one.

### WCAG 2.1 AA Compliance

#### Color Contrast

- **Body text (16px):** Minimum 4.5:1 contrast ratio
- **Large text (18px+):** Minimum 3:1 contrast ratio
- **UI components:** Minimum 3:1 contrast ratio

**Testing:**
```bash
# Use browser DevTools or online tools
# Check: foreground vs background for all text
```

#### Focus Indicators

```css
/* All interactive elements */
*:focus-visible {
  outline: 2px solid var(--clawd-accent);
  outline-offset: 2px;
}

/* Custom focus ring */
.btn-base:focus-visible {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
}
```

#### Keyboard Navigation

**Requirements:**
- All interactive elements accessible via `Tab`
- Logical tab order (left→right, top→bottom)
- `Enter` or `Space` to activate
- `Esc` to dismiss modals/dropdowns
- Arrow keys for lists/menus

#### Screen Reader Support

```jsx
// Descriptive labels
<button aria-label="Close modal">
  <Icon name="x" aria-hidden="true" />
</button>

// Status announcements
<div role="status" aria-live="polite">
  Task created successfully
</div>

// Loading states
<button disabled aria-busy="true">
  <Spinner aria-hidden="true" />
  <span className="sr-only">Loading...</span>
  Save
</button>

// Hidden but accessible
<span className="sr-only">
  New message from Kevin
</span>
```

#### Motion Preferences

```css
/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Page-Specific Patterns

### Dashboard (Overview)

**Purpose:** At-a-glance status of all systems.

**Layout:**
- Grid of stat cards (4 columns on desktop, responsive)
- Quick actions bar at top
- Recent activity feed
- Calendar widget
- Email widget

**Components:**
- Stats cards with icons
- Line charts for trends
- Badge indicators for status
- Quick action buttons

**Example:**
```jsx
<div className="dashboard-grid">
  <StatCard 
    icon="check-circle" 
    label="Tasks Complete" 
    value="23" 
    trend="+12%"
    color="success"
  />
  <StatCard 
    icon="clock" 
    label="In Progress" 
    value="5" 
    color="warning"
  />
  {/* More cards... */}
</div>
```

---

### Inbox (Three-Pane)

**Purpose:** Unified communications view for all channels.

**Layout:**
```
┌──────────┬──────────┬─────────────────┐
│ Accounts │ Messages │ Message Detail  │
│ Folders  │   List   │   + Reply       │
│ 280px    │  400px   │     Flex        │
└──────────┴──────────┴─────────────────┘
```

**Left Pane (Accounts):**
- Folder tree
- Account list with badges (unread count)
- Filter controls
- VIP contacts

**Center Pane (Message List):**
- Scrollable message list
- Search bar at top
- Sort/filter controls
- Channel indicator badges

**Right Pane (Detail):**
- Full message content
- Inline reply composer
- Attachments
- Conversation history

**Interactions:**
- Click message → opens in right pane
- `⌘+R` to reply
- `⌘+K` for quick search
- Drag to assign folders

---

### Tasks (Kanban)

**Purpose:** Visual task management with agent assignment.

**Layout:**
```
┌─────────┬─────────┬─────────┬──────┐
│  Todo   │Progress │ Review  │ Done │
│         │         │         │      │
│  [...]  │  [...]  │  [...]  │ [...] │
└─────────┴─────────┴─────────┴──────┘
```

**Columns:**
1. **Todo** - Pending tasks
2. **In Progress** - Active work
3. **Review** - Awaiting approval
4. **Done** - Completed

**Task Card:**
```jsx
<div className="task-card">
  <div className="task-header">
    <span className="badge-base badge-priority-p1">P1</span>
    <span className="task-id text-caption text-dim">#1234</span>
  </div>
  <h4 className="task-title">Fix login bug</h4>
  <div className="task-meta">
    <Avatar user={assignee} size="sm" />
    <span className="text-caption text-dim">2 hours ago</span>
  </div>
  <div className="task-footer">
    <span className="badge-base badge-info">coder</span>
    <div className="task-actions">
      <button className="btn-icon btn-ghost">
        <Icon name="edit" />
      </button>
    </div>
  </div>
</div>
```

**Interactions:**
- Drag & drop to move columns
- Click card → open detail modal
- `⌘+N` to create new task
- Filter by agent, priority, status

---

### Agents Panel

**Purpose:** Manage and monitor all agents.

**Layout:**
- Grid of agent cards
- Filter/sort controls
- Spawn new agent button
- Performance metrics

**Agent Card:**
```jsx
<div className="card-base card-interactive">
  <div className="flex items-start gap-4">
    <Avatar agent={agent} size="lg" />
    <div className="flex-1">
      <h3 className="text-heading">{agent.name}</h3>
      <p className="text-small text-dim">{agent.role}</p>
      <div className="flex gap-2 mt-2">
        <span className="badge-base badge-success">Active</span>
        <span className="badge-base badge-info">
          {agent.tasksCompleted} tasks
        </span>
      </div>
    </div>
    <button className="btn-icon btn-ghost">
      <Icon name="more" />
    </button>
  </div>
  <div className="mt-4">
    <ProgressBar 
      value={agent.currentTaskProgress} 
      label="Current task"
    />
  </div>
</div>
```

---

### Analytics Panel

**Purpose:** Visualize metrics and trends.

**Components:**
- Line charts (tasks over time)
- Bar charts (agent performance)
- Pie charts (task distribution)
- Metric cards

**Chart Style:**
- Dark background
- Green accent for primary series
- Muted colors for secondary series
- Grid lines at 10% opacity
- Hover tooltips

---

### X/Twitter Panel

**Purpose:** Compose and monitor tweets.

**Layout:**
- Compose area at top
- Mentions feed
- Scheduled tweets
- Analytics summary

**Tweet Composer:**
```jsx
<div className="card-base">
  <textarea 
    className="textarea-base" 
    placeholder="What's happening?"
    maxLength={280}
  />
  <div className="flex items-center justify-between mt-4">
    <div className="flex gap-2">
      <button className="btn-icon btn-ghost">
        <Icon name="image" />
      </button>
      <button className="btn-icon btn-ghost">
        <Icon name="smile" />
      </button>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-caption text-dim">
        {charCount}/280
      </span>
      <button className="btn-base btn-primary">
        Tweet
      </button>
    </div>
  </div>
</div>
```

---

### Settings Panel

**Purpose:** Configure all application settings.

**Layout:**
- Tab navigation (Appearance, Accounts, Notifications, etc.)
- Form sections with clear headings
- Apply/Save buttons

**Example Section:**
```jsx
<section className="settings-section">
  <h3 className="text-heading mb-4">Appearance</h3>
  
  <div className="form-field">
    <label className="form-label">Theme</label>
    <select className="select-base">
      <option value="dark">Dark</option>
      <option value="light">Light</option>
      <option value="auto">Auto</option>
    </select>
  </div>
  
  <div className="form-field">
    <label className="flex items-center gap-2">
      <input type="checkbox" className="checkbox-base" />
      <span>Reduce motion</span>
    </label>
    <span className="form-hint">
      Minimize animations for accessibility
    </span>
  </div>
</section>
```

---

## Modal System

### Standard Modals

We have 40+ modals. All must follow this structure:

```jsx
<BaseModal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  size="md" // sm | md | lg | xl
>
  <div className="modal-content">
    {/* Content here */}
  </div>
  
  <div className="modal-footer">
    <button className="btn-base btn-secondary" onClick={onClose}>
      Cancel
    </button>
    <button className="btn-base btn-primary" onClick={onSave}>
      Save
    </button>
  </div>
</BaseModal>
```

### Modal Catalog

| Modal | Purpose | Size | Components |
|-------|---------|------|------------|
| TaskModal | Create/edit tasks | md | Form, agent selector, priority picker |
| AgentDetailModal | View agent details | lg | Stats, activity feed, skill tags |
| AgentChatModal | Chat with agent | md | Message list, input field |
| ContactModal | Add/edit contact | sm | Form, avatar uploader |
| SnoozeModal | Snooze conversation | sm | Time picker, reason input |
| AccountDetailModal | View account info | md | Stats, connection status, actions |
| NotificationSettingsModal | Configure notifications | lg | Tabs, toggles, test button |

### Modal Consistency Rules

1. **Same padding:** All modals use `--spacing-card-lg` (24px)
2. **Same border radius:** All use `--radius-lg` (12px)
3. **Same backdrop:** All use `rgba(0, 0, 0, 0.6)` with 12px blur
4. **Same animation:** All fade-in-up with 200ms duration
5. **Same close behavior:** All close on Esc, backdrop click
6. **Same focus management:** All trap focus and return to trigger

---

## Theme Support

### Dark Theme (Default)

```css
:root {
  --clawd-bg: #0a0a0a;
  --clawd-surface: #141414;
  --clawd-border: #262626;
  --clawd-text: #fafafa;
  --clawd-text-dim: #a1a1aa;
}
```

### Light Theme

```css
:root.light {
  --clawd-bg: #fafafa;
  --clawd-surface: #ffffff;
  --clawd-border: #e4e4e7;
  --clawd-text: #18181b;
  --clawd-text-dim: #52525b;
}
```

### Theme Toggle

```jsx
<button 
  onClick={toggleTheme}
  className="btn-icon btn-ghost"
  aria-label="Toggle theme"
>
  <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
</button>
```

### Testing Both Themes

**Mandatory:** Every component must be tested in BOTH light and dark modes.

**Process:**
1. Implement component in dark mode (default)
2. Toggle to light mode
3. Screenshot both
4. Compare contrast ratios
5. Adjust if needed
6. Document in learning log

---

## Implementation Checklist

### Phase 1: Foundation ✅
- [x] Design tokens defined
- [x] Component patterns created
- [x] Accessibility guidelines written
- [x] Style guide documentation complete

### Phase 2: Component Audit (In Progress)
- [ ] Audit all 20+ panels for consistency
- [ ] Audit all 40+ modals for consistency
- [ ] Document deviations from design system
- [ ] Create fix tasks for each deviation

### Phase 3: Global Patterns
- [ ] Implement consistent card padding
- [ ] Standardize all button heights
- [ ] Unify form field styling
- [ ] Normalize modal structures
- [ ] Apply semantic color usage

### Phase 4: Page-Specific Refinements
- [ ] Dashboard grid optimization
- [ ] Inbox three-pane polish
- [ ] Tasks kanban interaction improvements
- [ ] Agents panel card redesign
- [ ] Analytics chart theming
- [ ] X panel composer refinement
- [ ] Settings tab consistency

### Phase 5: Modal Overhaul
- [ ] TaskModal redesign
- [ ] AgentDetailModal polish
- [ ] All 40+ modals reviewed
- [ ] Consistent close/cancel behavior
- [ ] Focus management verified

### Phase 6: Accessibility Pass
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Color contrast verified (WCAG AA)
- [ ] Focus indicators visible
- [ ] ARIA labels complete

### Phase 7: Theme Testing
- [ ] All components tested in light mode
- [ ] All components tested in dark mode
- [ ] Screenshots captured for both
- [ ] Contrast issues resolved
- [ ] Theme toggle works everywhere

### Phase 8: Performance
- [ ] Animation reduced-motion tested
- [ ] Large lists optimized
- [ ] Modal transitions smooth
- [ ] No layout shifts

---

## Usage Notes

### For Designers
This is your creative direction bible. Every decision here has a "why." If you deviate, document why.

### For Developers (Coders)
Use the CSS tokens religiously. Never hard-code colors, spacing, or sizes. If a token doesn't exist, ask—don't invent.

### For Reviewers
Check for:
1. Consistent use of tokens
2. Accessibility requirements met
3. Both themes tested
4. Keyboard navigation works
5. Motion respects reduced-motion preference

---

## Maintenance

**This is a living document.** As we learn what works (and doesn't), we update this guide.

**Update process:**
1. Identify pattern/component issue
2. Research solution (Linear, Notion, etc.)
3. Propose change in this doc
4. Get approval
5. Implement across codebase
6. Document in DESIGNER_LEARNING_LOG.md

---

## Credits

**Design Research:** Linear, Notion, Vercel, Stripe, Arc  
**Implementation:** Froggo Dashboard Team  
**Task:** task-1769809773003  
**Creative Director:** Designer Agent (Subagent)

---

**Last Updated:** January 30, 2026  
**Version:** 2.0  
**Status:** 🚧 Living Document
