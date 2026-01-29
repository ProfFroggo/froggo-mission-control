# In-App Tooltip Guidelines

**How to implement effective contextual help throughout the dashboard**

---

## Philosophy

Tooltips should:
- **Clarify** - Explain what's not obvious
- **Guide** - Help users take the next step
- **Educate** - Teach without interrupting
- **Be Brief** - One or two sentences max

Tooltips should NOT:
- Repeat the label text
- State the obvious
- Be verbose or preachy
- Replace good UX design

---

## Tooltip Component

### Basic Usage

```tsx
import Tooltip from './components/Tooltip';

<Tooltip content="Brief explanation here">
  <button>Feature Button</button>
</Tooltip>
```

### With Help Icon

```tsx
import { HelpTooltip } from './components/Tooltip';

<label className="flex items-center gap-2">
  Task Priority
  <HelpTooltip content="P0 = Critical (ASAP), P1 = High (this week), P2 = Medium (this month), P3 = Low (backlog)" />
</label>
```

### Props

```tsx
interface TooltipProps {
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // ms before showing (default: 500)
  maxWidth?: number; // pixels (default: 250)
  disabled?: boolean;
  showArrow?: boolean; // default: true
  interactive?: boolean; // can hover over tooltip
}
```

---

## Where to Add Tooltips

### ✅ Always Include Tooltips For:

**1. Technical Terms**
```tsx
<HelpTooltip content="Kanban is a visual workflow management method using boards and cards" />
```

**2. Priority Levels**
```tsx
<HelpTooltip content="P0: Production down or data loss - fix immediately" />
```

**3. Agent Types**
```tsx
<HelpTooltip content="Coder agent handles software development, debugging, git operations, and technical documentation" />
```

**4. Status Meanings**
```tsx
<HelpTooltip content="In Progress: Agent is actively working on this task. Check activity log for updates." />
```

**5. Icon Buttons**
```tsx
<Tooltip content="Star this message for quick access later">
  <button><Star size={16} /></button>
</Tooltip>
```

**6. Advanced Settings**
```tsx
<HelpTooltip content="Silence detection: How long to wait after you stop speaking before sending message (1-5 seconds)" />
```

**7. Destructive Actions**
```tsx
<Tooltip content="⚠️ This permanently deletes the task. Use Archive to hide instead." position="top">
  <button className="text-red-500">Delete Forever</button>
</Tooltip>
```

**8. Keyboard Shortcuts**
```tsx
<Tooltip content="Press ⌘K for global search">
  <input placeholder="Search..." />
</Tooltip>
```

**9. Pro Tips**
```tsx
<HelpTooltip content="💡 Pro tip: Use subtasks to break down complex work. Agents work through them systematically." />
```

**10. Limitations/Constraints**
```tsx
<Tooltip content="Maximum 280 characters (Twitter limit)">
  <textarea maxLength={280} />
</Tooltip>
```

---

### ❌ Don't Add Tooltips For:

**1. Self-Explanatory Buttons**
```tsx
❌ <Tooltip content="Click to save">
     <button>Save</button>
   </Tooltip>

✅ <button>Save</button> <!-- No tooltip needed -->
```

**2. Repeating the Label**
```tsx
❌ <Tooltip content="Enter your email address">
     <input placeholder="Email address" />
   </Tooltip>
```

**3. Standard UI Patterns**
```tsx
❌ Close button (X) - universally understood
❌ Hamburger menu - standard pattern
❌ Checkbox - no explanation needed
```

**4. When Good UX Makes It Clear**
```tsx
<!-- If your UI is clear, you don't need tooltips -->
<button className="bg-green-500 text-white px-4 py-2 rounded">
  Approve ✓
</button>
<!-- Green + checkmark + "Approve" = obviously positive action -->
```

---

## Writing Effective Tooltip Text

### ✅ Good Examples

**Clear & Concise:**
```tsx
<HelpTooltip content="Agents handle tasks automatically based on their specialization" />
```

**Action-Oriented:**
```tsx
<Tooltip content="Click to view full task details and activity log">
  <button>View Details</button>
</Tooltip>
```

**Educational:**
```tsx
<HelpTooltip content="Review status means agent completed work and it's awaiting your approval before moving to Done" />
```

**Warning/Safety:**
```tsx
<Tooltip content="⚠️ All tweets require approval before posting. Disable in Settings > Automation for auto-approval." />
```

**With Keyboard Shortcut:**
```tsx
<Tooltip content="Open command palette (⌘K) to search everything">
  <SearchIcon />
</Tooltip>
```

**With Pro Tip:**
```tsx
<HelpTooltip content="💡 Use J/K keys to navigate inbox items without touching the mouse" />
```

---

### ❌ Bad Examples

**Too Obvious:**
```tsx
❌ <Tooltip content="This button creates a new task">
     <button>New Task</button>
   </Tooltip>
<!-- The button text already says that! -->
```

**Too Verbose:**
```tsx
❌ <HelpTooltip content="The priority system in Froggo uses a scale from P0 to P3 where P0 represents the highest priority items that need immediate attention such as production issues or critical bugs, while P1 represents high priority work that should be completed within the current week, and P2 is for medium priority items..." />
<!-- Way too long! -->

✅ <HelpTooltip content="P0 = Critical (ASAP), P1 = High (this week), P2 = Medium (this month), P3 = Low (backlog)" />
<!-- Much better! -->
```

**Jargon Without Explanation:**
```tsx
❌ <HelpTooltip content="Uses OAuth 2.0 PKCE flow with refresh token rotation" />
<!-- What does this mean to a normal user? -->

✅ <HelpTooltip content="Securely connects to your Google account. You can disconnect anytime in settings." />
<!-- User-friendly! -->
```

**Patronizing:**
```tsx
❌ <HelpTooltip content="You should really enable notifications or you might miss important updates!" />

✅ <HelpTooltip content="Get desktop notifications for task completions and mentions" />
```

---

## Tooltip Patterns by Component Type

### Form Fields

**Text Input:**
```tsx
<div>
  <label className="flex items-center gap-2">
    Task Title
    <HelpTooltip content="Brief description of what needs to be done (50 chars recommended)" />
  </label>
  <input type="text" placeholder="e.g., Fix login bug" />
</div>
```

**Dropdown/Select:**
```tsx
<div>
  <label className="flex items-center gap-2">
    Assigned Agent
    <HelpTooltip content="Coder: Software dev | Writer: Content | Researcher: Analysis | Chief: Complex projects" />
  </label>
  <select>
    <option value="coder">Coder 💻</option>
    <option value="writer">Writer ✍️</option>
    <option value="researcher">Researcher 🔍</option>
    <option value="chief">Chief 👨‍💻</option>
  </select>
</div>
```

**Checkbox:**
```tsx
<label className="flex items-center gap-2">
  <input type="checkbox" />
  <span>Enable auto-approval</span>
  <HelpTooltip content="⚠️ Approved items execute immediately without review. Use with caution." />
</label>
```

**Radio Group:**
```tsx
<fieldset>
  <legend className="flex items-center gap-2">
    Priority Level
    <HelpTooltip content="Higher priority tasks are worked on first. Be realistic - not everything is P0!" />
  </legend>
  <label><input type="radio" name="priority" value="p0" /> P0 - Critical</label>
  <label><input type="radio" name="priority" value="p1" /> P1 - High</label>
  <label><input type="radio" name="priority" value="p2" /> P2 - Medium</label>
  <label><input type="radio" name="priority" value="p3" /> P3 - Low</label>
</fieldset>
```

---

### Buttons & Actions

**Primary Action:**
```tsx
<Tooltip content="Send to approval queue (⌘Enter)">
  <button className="btn-primary">Submit</button>
</Tooltip>
```

**Destructive Action:**
```tsx
<Tooltip content="⚠️ Permanently delete this task. This cannot be undone." position="top">
  <button className="btn-danger">Delete</button>
</Tooltip>
```

**Icon Button:**
```tsx
<Tooltip content="Bookmark this task for quick access (⌘B)">
  <button><Star size={16} /></button>
</Tooltip>
```

**Toggle Button:**
```tsx
<Tooltip content={isListening ? "Stop listening" : "Start voice transcription (⌘⇧V)"}>
  <button onClick={toggleListening}>
    {isListening ? <MicOff /> : <Mic />}
  </button>
</Tooltip>
```

---

### Status Indicators

**Badge with Tooltip:**
```tsx
<Tooltip content="Agent is actively working on this task. Check activity log for progress.">
  <span className="badge badge-blue">In Progress</span>
</Tooltip>
```

**Icon with Status:**
```tsx
<Tooltip content="Connected to Google Calendar. Last synced 2 minutes ago.">
  <CheckCircle className="text-green-500" size={16} />
</Tooltip>
```

**Loading State:**
```tsx
<Tooltip content="Syncing events from Google Calendar...">
  <Spinner />
</Tooltip>
```

---

### Navigation Elements

**Sidebar Item:**
```tsx
<Tooltip content="Kanban task board - Manage tasks with agents (⌘5)" position="right">
  <NavItem icon={<Kanban />} label="Tasks" />
</Tooltip>
```

**Breadcrumb:**
```tsx
<Tooltip content="Return to task list">
  <a href="/tasks">Tasks</a>
</Tooltip>
```

**Tab:**
```tsx
<Tooltip content="View full task activity log and agent updates">
  <Tab>Activity</Tab>
</Tooltip>
```

---

### Data Display

**Chart Element:**
```tsx
<Tooltip content="Tasks completed this week: 23 (↑ 15% from last week)">
  <BarChartElement />
</Tooltip>
```

**Table Header:**
```tsx
<th>
  <span className="flex items-center gap-1">
    Completion Rate
    <HelpTooltip content="Percentage of tasks moved to Done status within their due date" />
  </span>
</th>
```

**Truncated Text:**
```tsx
<Tooltip content={fullText}>
  <div className="truncate">{fullText}</div>
</Tooltip>
```

---

## Advanced Patterns

### Conditional Tooltips

```tsx
<Tooltip 
  content={
    hasPermission 
      ? "Click to edit task details" 
      : "⚠️ You don't have permission to edit this task"
  }
  disabled={!hasPermission}
>
  <button disabled={!hasPermission}>Edit</button>
</Tooltip>
```

---

### Dynamic Content

```tsx
<Tooltip 
  content={
    <div>
      <strong>{task.title}</strong>
      <div className="text-xs mt-1">
        Assigned to: {task.agent}<br />
        Due: {formatDate(task.dueDate)}<br />
        Progress: {task.progress}%
      </div>
    </div>
  }
>
  <TaskCard task={task} />
</Tooltip>
```

---

### Multi-Step Tooltip

```tsx
const [step, setStep] = useState(0);

const tooltipContent = [
  "Step 1: Create a task with clear description",
  "Step 2: Assign to appropriate agent",
  "Step 3: Monitor progress in Agents panel",
  "Step 4: Review deliverables when complete"
];

<Tooltip 
  content={
    <div>
      {tooltipContent[step]}
      <button onClick={() => setStep((step + 1) % tooltipContent.length)}>
        Next Tip
      </button>
    </div>
  }
  interactive={true}
>
  <InfoIcon />
</Tooltip>
```

---

### Tooltip with Link

```tsx
<Tooltip 
  content={
    <div>
      Learn more about agent system
      <a href="/help/agents" className="text-blue-400 hover:underline">
        View Guide →
      </a>
    </div>
  }
  interactive={true}
>
  <HelpCircle />
</Tooltip>
```

---

## Accessibility

### ARIA Labels

Tooltips should complement, not replace, ARIA labels:

```tsx
<Tooltip content="Mark as important">
  <button 
    aria-label="Star this message"
    onClick={handleStar}
  >
    <Star size={16} />
  </button>
</Tooltip>
```

### Keyboard Access

Tooltips should appear on focus, not just hover:

```tsx
<Tooltip content="Description">
  <button onFocus={showTooltip} onBlur={hideTooltip}>
    Action
  </button>
</Tooltip>
```

### Screen Readers

Use `aria-describedby` for important tooltips:

```tsx
<div>
  <label id="priority-label">Priority</label>
  <select aria-labelledby="priority-label" aria-describedby="priority-help">
    <option>P0</option>
    <option>P1</option>
  </select>
  <HelpTooltip 
    id="priority-help"
    content="P0 = Critical, P1 = High, P2 = Medium, P3 = Low"
  />
</div>
```

---

## Testing Tooltips

### Checklist

- [ ] Appears on hover after delay
- [ ] Appears on focus (keyboard navigation)
- [ ] Positions correctly (doesn't go off-screen)
- [ ] Text is readable (contrast, size)
- [ ] Content is helpful (not obvious/redundant)
- [ ] Arrow points to correct element
- [ ] Disappears when mouse/focus leaves
- [ ] Doesn't block important UI
- [ ] Works with screen readers
- [ ] Mobile: Shows on tap (if applicable)

---

## Common Mistakes to Avoid

### ❌ Tooltip Overload

Don't put tooltips on everything:
```tsx
❌ <!-- Too many tooltips makes UI cluttered -->
<Tooltip content="..."><button>Save</button></Tooltip>
<Tooltip content="..."><button>Cancel</button></Tooltip>
<Tooltip content="..."><button>Delete</button></Tooltip>
<Tooltip content="..."><button>Export</button></Tooltip>

✅ <!-- Only on unclear or advanced actions -->
<button>Save</button>
<button>Cancel</button>
<Tooltip content="⚠️ Permanently deletes"><button>Delete</button></Tooltip>
<button>Export</button>
```

---

### ❌ Hiding Critical Info in Tooltips

Tooltips should enhance, not replace primary UI:

```tsx
❌ <!-- User must hover to see error -->
<input className="border-red-500" />
<Tooltip content="Email format is invalid">
  <ErrorIcon />
</Tooltip>

✅ <!-- Error is visible by default -->
<input className="border-red-500" />
<p className="text-red-500 text-sm mt-1">
  Email format is invalid
</p>
```

---

### ❌ Tooltips on Disabled Elements

Disabled elements don't trigger hover/focus:

```tsx
❌ <Tooltip content="Complete previous step first">
     <button disabled>Next</button>
   </Tooltip>

✅ <Tooltip content="Complete previous step first">
     <div> {/* Wrapper receives hover */}
       <button disabled>Next</button>
     </div>
   </Tooltip>
```

---

## Tooltip Implementation Checklist

### For Each New Feature/Panel:

1. **Identify Unclear Elements**
   - Technical terms
   - Icon buttons
   - Advanced settings
   - Destructive actions

2. **Write Clear, Brief Text**
   - One or two sentences
   - Action-oriented
   - Include keyboard shortcuts if applicable

3. **Choose Appropriate Position**
   - `top` - Default for most elements
   - `bottom` - For header elements
   - `left/right` - For sidebar items

4. **Test with Real Users**
   - Are tooltips helpful?
   - Are they appearing when expected?
   - Is the text clear?

5. **Iterate Based on Feedback**
   - Too verbose? Shorten.
   - Still unclear? Rephrase.
   - Getting ignored? Maybe not needed.

---

## Resources

**Component File:**
`src/components/Tooltip.tsx`

**Usage Examples:**
See existing panels:
- `src/components/TaskDetailPanel.tsx`
- `src/components/VoicePanel.tsx`
- `src/components/SettingsPanel.tsx`

**Help Content:**
`src/data/helpContent.ts`

For detailed help articles that tooltips can link to.

---

## Quick Reference

```tsx
// Basic tooltip
<Tooltip content="Helpful text">
  <Element />
</Tooltip>

// With help icon
<HelpTooltip content="Explanation" />

// Custom position
<Tooltip content="Text" position="right">
  <Element />
</Tooltip>

// With delay
<Tooltip content="Text" delay={1000}>
  <Element />
</Tooltip>

// Disabled when not needed
<Tooltip content="Text" disabled={!needsHelp}>
  <Element />
</Tooltip>

// Interactive (can hover over tooltip)
<Tooltip content={<ComplexContent />} interactive>
  <Element />
</Tooltip>
```

---

**Remember:** Good tooltips make your UI more discoverable and learnable without being intrusive.

**Goal:** Users should be able to figure out features on their own, with tooltips providing that last bit of clarity when needed.
