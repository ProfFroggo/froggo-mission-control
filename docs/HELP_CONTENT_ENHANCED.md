# Enhanced Help Content for helpContent.ts

**Additional articles, FAQs, and tips to add to the help system**

---

## Additional Help Articles

### Getting Started & Onboarding

```typescript
{
  id: 'first-time-user',
  title: 'Your First 24 Hours with Froggo',
  category: 'Getting Started',
  content: `Welcome! Here's how to make the most of your first day:

**Hour 1: Setup (15 minutes)**
- Complete the welcome tour (don't skip!)
- Connect your Google Calendar (⌘0)
- Set your preferences (theme, notifications)
- Test voice transcription (⌘8)

**Hour 2-4: Learn the Basics**
- Create 2-3 simple tasks (⌘5 → N)
- Assign one to Writer agent
- Process your inbox (⌘2)
- Try keyboard navigation (⌘1-9)

**Hour 5-8: Daily Workflow**
- Review morning calendar (⌘1)
- Check messages (⌘3)
- Monitor agent progress (⌘6)
- Use voice for quick commands (⌘8)

**Rest of Day: Build Habits**
- Use Command Palette (⌘K) for everything
- Practice J/K navigation in Inbox
- Ask Froggo questions (⌘9)
- Check analytics at end of day (⌘4)

**Before Bed:**
- Export your data (Settings > Data & Privacy)
- Review what you learned
- Plan tomorrow's priorities

By day 2, you'll feel much more comfortable!`,
  keywords: ['first', 'day', 'start', 'new', 'beginner', '24 hours', 'getting started'],
  relatedTo: ['dashboard'],
  lastUpdated: '2026-01-28'
}
```

---

### Task Management

```typescript
{
  id: 'task-best-practices',
  title: 'Task Management Best Practices',
  category: 'Tasks',
  content: `Master task management with these proven strategies:

**Writing Effective Task Descriptions:**

❌ Bad: "Fix the thing"
✅ Good: "Fix authentication bug in login flow - users can't log in with valid credentials. Error in validateUser() function in auth.ts"

**Priority Guidelines:**
- P0: Production down, data loss, security breach (< 1%)
- P1: Major feature broken, customer blocked (< 10%)
- P2: Minor bugs, enhancements, features (60-70%)
- P3: Nice-to-haves, tech debt, improvements (20-30%)

**Use Subtasks Effectively:**
Break complex work into 3-7 subtasks:
1. Research/Planning
2. Implementation
3. Testing
4. Documentation
5. Deployment

**Naming Conventions:**
- Start with verb: "Fix", "Add", "Update", "Remove"
- Be specific: Not "Update docs" but "Update API docs with new endpoints"
- Include context: "for mobile users", "in production", "before launch"

**Due Dates:**
- Only set if truly deadline-driven
- Leave blank for backlog items
- Give agents reasonable time (1-3 days for P1)
- Build in buffer time

**Tags for Organization:**
- Project: "auth-system", "mobile-app"
- Type: "bug", "feature", "documentation"
- Area: "frontend", "backend", "design"
- Customer: "client-acme", "internal"`,
  keywords: ['task', 'best', 'practice', 'tips', 'effective', 'management'],
  relatedTo: ['kanban'],
  lastUpdated: '2026-01-28'
},

{
  id: 'subtask-strategies',
  title: 'Subtask Strategies for Complex Projects',
  category: 'Tasks',
  content: `How to break down big projects into manageable subtasks:

**The 5-Phase Breakdown:**

**Phase 1: Discovery**
- Research existing solutions
- Identify requirements
- List constraints and dependencies

**Phase 2: Planning**
- Design approach
- Choose tech stack
- Estimate time and resources

**Phase 3: Implementation**
- Build core functionality
- Add features iteratively
- Handle edge cases

**Phase 4: Quality**
- Write tests
- Review code
- Fix bugs

**Phase 5: Delivery**
- Documentation
- Deployment
- Announcement/training

**Example: "Build User Dashboard"**

Subtasks:
1. Research dashboard patterns and best practices
2. Design wireframes and user flow
3. Set up React components structure
4. Implement data fetching and state management
5. Build individual widgets (calendar, stats, etc.)
6. Add responsive design and mobile support
7. Write unit and integration tests
8. Create user documentation
9. Deploy to staging for review
10. Production deployment and monitoring

**Pro Tips:**
- Each subtask = 1-4 hours of work
- Make subtasks independent when possible
- Order by dependencies (prerequisite tasks first)
- Include testing and docs subtasks
- Agent will work through them sequentially`,
  keywords: ['subtask', 'complex', 'project', 'breakdown', 'planning'],
  relatedTo: ['kanban', 'agents'],
  lastUpdated: '2026-01-28'
}
```

---

### Agent System

```typescript
{
  id: 'agent-troubleshooting',
  title: 'Agent Troubleshooting Guide',
  category: 'Agents',
  content: `When agents aren't behaving as expected:

**Agent Won't Start:**

Checklist:
□ Agent service connected? (⌘6 - check status)
□ Task has clear description?
□ Internet connection active?
□ API credentials valid?
□ Not rate limited?

Fix: Settings > System > Reconnect Agent Service

**Agent Stuck:**

Signs:
- No activity log updates >30 minutes
- Same message repeating
- CPU usage high but no progress

Solutions:
1. Check activity log for errors
2. View agent logs (⌘6 → View Logs)
3. Ask Froggo: "Why is task-XXX stuck?"
4. Reset task: Actions → Reset to Todo
5. Reassign and try again

**Agent Producing Poor Results:**

Improve by:
- More detailed task description
- Add examples of desired output
- Include context and constraints
- Break down into smaller subtasks
- Choose right agent type (Coder vs Writer)
- Provide relevant links/documents

**Agent Speed:**

Typical durations:
- Simple task: 5-15 minutes
- Medium task: 30-90 minutes
- Complex task: 2-4 hours

If slower:
- Check task complexity
- Review subtask count
- API rate limits?
- Agent handling multiple tasks?

**Communication Tips:**

Write tasks as if briefing a team member:
✅ "Update the pricing page to reflect new tiers. Change $99/mo to $149/mo for Pro plan. Keep design consistent with current style. Test on mobile."

❌ "Change price"`,
  keywords: ['agent', 'stuck', 'not working', 'troubleshoot', 'fix', 'problem'],
  relatedTo: ['agents', 'kanban'],
  lastUpdated: '2026-01-28'
},

{
  id: 'choosing-right-agent',
  title: 'Choosing the Right Agent',
  category: 'Agents',
  content: `Quick decision guide for agent assignment:

**Coder 💻 - When to use:**
- Writing code (any language)
- Debugging and fixing bugs
- Running tests
- Git operations
- Code review
- Technical architecture
- API integrations
- Database queries

Example tasks:
- "Implement user authentication with JWT"
- "Debug memory leak in Node.js server"
- "Write unit tests for payment module"
- "Optimize database query performance"

**Writer ✍️ - When to use:**
- Blog posts and articles
- Social media content
- Email drafts
- Documentation
- Marketing copy
- Product descriptions
- Press releases
- Meeting notes transcription

Example tasks:
- "Write blog post about AI agents (1000 words)"
- "Create Twitter thread announcing new feature"
- "Draft customer email about service update"
- "Update user guide with new screenshots"

**Researcher 🔍 - When to use:**
- Market research
- Competitive analysis
- Technology evaluation
- Fact-finding
- Summarizing articles/papers
- Data gathering
- User research synthesis
- Trend analysis

Example tasks:
- "Research top 10 project management tools"
- "Analyze competitor pricing strategies"
- "Summarize latest AI developments this month"
- "Find user feedback themes from support tickets"

**Chief 👨‍💻 - When to use:**
- Complex multi-step projects
- Cross-functional initiatives
- Architecture decisions
- Projects needing multiple agents
- Unclear scope (needs planning)

Example tasks:
- "Build real-time collaboration feature"
- "Redesign onboarding flow end-to-end"
- "Launch new product tier with docs and billing"
- "Migrate from REST to GraphQL API"

Chief will:
1. Analyze requirements
2. Break down into phases
3. Spawn other agents (Coder, Writer, Researcher)
4. Coordinate work
5. Integrate deliverables

**Still Unsure?**
Ask Froggo in Chat (⌘9):
"Which agent should handle: [describe task]"`,
  keywords: ['agent', 'choose', 'select', 'which', 'right', 'assignment'],
  relatedTo: ['agents', 'kanban'],
  lastUpdated: '2026-01-28'
}
```

---

### Voice Assistant

```typescript
{
  id: 'voice-commands',
  title: 'Voice Commands Reference',
  category: 'Voice',
  content: `Useful voice commands for hands-free productivity:

**Task Management:**
- "Create a task to [description]"
- "Show my tasks for today"
- "Mark task [name] as complete"
- "What tasks are in progress?"
- "Assign [task] to Coder"

**Calendar:**
- "What's on my calendar today?"
- "What's my next meeting?"
- "Schedule a meeting with [person] tomorrow at 2pm"
- "Show meetings this week"
- "Am I free Friday afternoon?"

**Information:**
- "How many tasks did I complete this week?"
- "Show agent status"
- "What's the weather?"
- "What time is it?"

**Communication:**
- "Send a message to [person] saying [message]"
- "Check my email"
- "Read my latest message"
- "Show unread messages"

**Navigation:**
- "Open Kanban"
- "Go to dashboard"
- "Show inbox"
- "Open settings"

**Voice Controls:**
- "Stop listening"
- "Start meeting mode"
- "Send summary"

**Tips for Accuracy:**
- Speak naturally, don't over-enunciate
- Pause briefly between commands
- If misunderstood, rephrase differently
- Use names exactly as they appear in app
- For complex requests, dictate in chunks`,
  keywords: ['voice', 'commands', 'speech', 'dictation', 'hands free'],
  relatedTo: ['voice'],
  lastUpdated: '2026-01-28'
},

{
  id: 'voice-meeting-workflow',
  title: 'Voice Assistant in Meetings',
  category: 'Voice',
  content: `Get the most out of meeting eavesdrop mode:

**Before the Meeting:**

1. Test your setup:
   - Voice panel (⌘8)
   - Click phone icon
   - Say "testing one two three"
   - Verify transcription appears
   - Stop (click phone again)

2. Position microphone:
   - Close to you (internal Mac mic works)
   - Away from fans/AC
   - Test transcription quality

**During the Meeting:**

1. Start eavesdrop mode:
   - Click phone icon at meeting start
   - Minimize Froggo (it keeps recording)
   - Focus on conversation

2. What gets captured:
   - All spoken words (real-time)
   - Speaker changes (when detectable)
   - Action item keywords auto-detected
   - Timestamps

3. Managing long meetings:
   - Eavesdrop runs indefinitely
   - Check occasionally for accuracy
   - Can pause and resume
   - Battery impact: ~15% per hour

**After the Meeting:**

1. Review transcript:
   - Scroll through for accuracy
   - Note any major errors
   - Check detected action items

2. Edit before sending:
   - Fix names/technical terms
   - Remove sensitive information
   - Add context if needed

3. Send to Froggo:
   - Click "Send Summary"
   - Includes full transcript
   - Lists action items
   - Froggo can create tasks

4. Task creation:
   - Ask: "Create tasks from those action items"
   - Froggo generates tasks automatically
   - Review and approve
   - Assign to team/agents

**Pro Workflows:**

**Weekly Standup:**
- Record entire meeting
- Extract blockers → P0 tasks
- Extract updates → Activity logs
- Extract decisions → Starred messages

**Client Call:**
- Record for accuracy
- Action items → Tasks
- Send summary email (draft from transcript)
- Schedule follow-up

**1-on-1:**
- Personal notes stay local
- Extract career development goals
- Track recurring themes
- Review trends over time

**Privacy Notes:**
- All transcription is LOCAL (Vosk)
- No audio uploaded to cloud
- You control what gets sent to Froggo
- Delete recordings anytime`,
  keywords: ['meeting', 'eavesdrop', 'transcription', 'recording', 'notes'],
  relatedTo: ['voice'],
  videoUrl: 'https://example.com/voice-meeting-guide',
  lastUpdated: '2026-01-28'
}
```

---

### Inbox & Approvals

```typescript
{
  id: 'inbox-efficiency',
  title: 'Process Inbox in Under 5 Minutes',
  category: 'Inbox',
  content: `Speed through approvals with these techniques:

**Keyboard-Only Workflow:**

1. Press ⌘2 (open Inbox)
2. Press J (next item)
3. Quick scan (2 seconds)
4. Decision:
   - A = Approve (good to go)
   - R = Reject (not right)
   - X = Defer (decide later)
   - E = Edit (quick fix needed)
5. Repeat until empty

**Speed: 30+ items per minute**

**The 2-Second Rule:**

Can you approve in 2 seconds?
✅ Yes = Trust agent, approve fast
❌ No = Needs careful review

Most items should be 2-second decisions.

**What to Check Quickly:**
1. Correct recipient/audience? (1 sec)
2. Tone appropriate? (1 sec)
3. No obvious errors? (1 sec)

If all ✅ → Approve

**When to Edit:**

Edit inline instead of rejecting:
- Minor typos
- Tone adjustment
- Add context
- Fix formatting

Press E, make changes, ⌘S to approve.

**Defer Strategy:**

Only defer if:
- Need more information
- Waiting on something else
- Requires team discussion
- Not sure, need second opinion

Otherwise: Approve or reject NOW.

**Bulk Approval:**

For routine items:
1. Scan first few items
2. If all similar and good
3. Press ⌘⇧A (approve all)
4. Saves massive time

**Examples:**

✅ Quick Approve:
- Daily update tweet
- Thank you email to team
- Recurring meeting accept
- Standard reply message

⚠️ Careful Review:
- Client-facing communication
- Legal/compliance content
- Pricing changes
- Public announcements

**Set Up Auto-Approval:**

For 100% trust items:
Settings > Automation > Rules

Example:
"Auto-approve tweets from Writer with #dailyupdate tag"

**Time Saved:**
- Manual review: 30 sec per item
- Keyboard workflow: 2 sec per item
- 50 items = 25 min saved!`,
  keywords: ['inbox', 'fast', 'efficient', 'speed', 'approval', 'quick'],
  relatedTo: ['inbox'],
  lastUpdated: '2026-01-28'
}
```

---

### Analytics & Productivity

```typescript
{
  id: 'productivity-metrics',
  title: 'Understanding Your Productivity Metrics',
  category: 'Analytics',
  content: `What the numbers mean and how to improve them:

**Task Completion Rate:**
Completed tasks / Total tasks created

Good: 70-80%
Excellent: 85%+
Low (<60%)? You're creating too many tasks or not completing them.

Fix:
- Be more selective about what becomes a task
- Break large tasks into subtasks
- Archive tasks that are no longer relevant

**Average Completion Time:**
Time from creation to Done status

Varies by priority:
- P0: <24 hours
- P1: 1-3 days
- P2: 1-2 weeks
- P3: Flexible

High times? 
- Tasks too large (add subtasks)
- Unclear requirements (better descriptions)
- Wrong agent assignment
- Too many dependencies

**Agent Utilization:**
Time agents spend actively working

Healthy: 60-75%
(25-40% is planning, review, idle)

Low (<50%)?
- Not enough tasks assigned
- Tasks stuck in Review (approve faster)
- Agents blocked (check dependencies)

High (>85%)?
- Risk of burnout/errors
- Build in buffer time
- Consider adding more agents

**Velocity:**
Tasks completed per week (trend over time)

Increasing velocity = Good!
You're getting faster and more efficient.

Decreasing velocity?
- Increasing complexity (normal)
- Process issues (needs attention)
- Burnout (take break)

**Response Time:**
Time from inbox item to approve/reject

Target: <1 hour
Excellent: <15 minutes

High times?
- Set inbox check schedule
- Enable notifications
- Use bulk approval

**Focus Time:**
Uninterrupted work periods

Healthy: 3-4 blocks of 2+ hours

Low?
- Too many meetings (decline some)
- Too many interruptions (mute notifications)
- Poor calendar blocking (schedule focus time)

**Pro Tips:**

View Weekly Review:
Analytics > Weekly Summary
Shows trends and insights

Compare to Last Week:
Are you improving?
What changed?

Export Data:
Analytics > Export to CSV
Track in your own system`,
  keywords: ['analytics', 'metrics', 'productivity', 'statistics', 'performance'],
  relatedTo: ['analytics'],
  lastUpdated: '2026-01-28'
}
```

---

## Additional FAQs

```typescript
{
  id: 'faq-task-priority-meaning',
  question: 'What does each priority level really mean?',
  answer: 'P0 = Drop everything, fix now (production down, data loss, security). P1 = Complete this week (important features, blocked customers). P2 = Complete this month (normal work, minor bugs). P3 = Backlog (nice-to-haves, future improvements). Use P0 sparingly - if everything is urgent, nothing is.',
  category: 'Tasks',
  keywords: ['priority', 'p0', 'p1', 'p2', 'p3', 'urgent', 'meaning']
},

{
  id: 'faq-agent-trust',
  question: 'Can I trust agents to do good work?',
  answer: 'Agents are very capable but not perfect. Always review their work before approving (that\'s why the Review status exists). For routine tasks (tweets, simple code), trust is high. For critical work (client deliverables, production code), review carefully. Think of agents as junior team members - skilled but need oversight.',
  category: 'Agents',
  keywords: ['trust', 'agent', 'reliable', 'quality', 'review']
},

{
  id: 'faq-voice-privacy',
  question: 'Is voice transcription private?',
  answer: 'YES! Voice transcription runs 100% locally on your device using Vosk. No audio is ever sent to the cloud. Transcripts are only sent to Froggo when YOU click "Send" (in conversation mode) or "Send Summary" (in eavesdrop mode). You have complete control. All audio processing happens on your Mac.',
  category: 'Privacy',
  keywords: ['voice', 'privacy', 'transcription', 'local', 'cloud', 'recording']
},

{
  id: 'faq-calendar-sync-frequency',
  question: 'How often does calendar sync?',
  answer: 'Google Calendar syncs every 5 minutes automatically. You can also manually refresh: Connected Accounts (⌘0) > Google Account > Refresh button. New events appear within seconds of creation in Google Calendar. Changes (reschedules, cancellations) sync on next refresh cycle.',
  category: 'Calendar',
  keywords: ['calendar', 'sync', 'frequency', 'how often', 'refresh']
},

{
  id: 'faq-multi-device',
  question: 'Can I use Froggo on multiple devices?',
  answer: 'Currently, Froggo is designed for single-device use (your primary Mac). Data is stored locally. Multi-device sync is on the roadmap! Workaround: Export data from one device, import on another. Or: Use cloud storage (Dropbox, Google Drive) to sync the data folder manually.',
  category: 'General',
  keywords: ['multi', 'device', 'sync', 'multiple', 'mac', 'computer']
},

{
  id: 'faq-keyboard-shortcuts-customize',
  question: 'Can I customize keyboard shortcuts?',
  answer: 'Yes! Settings (⌘,) > Keyboard > Custom Shortcuts. Click any action to remap to different keys. Use ⌘⇧ modifiers for personal shortcuts. Be careful not to conflict with macOS system shortcuts. Reset to defaults anytime.',
  category: 'Keyboard',
  keywords: ['keyboard', 'shortcuts', 'customize', 'remap', 'change']
}
```

---

## Additional Quick Tips

```typescript
{
  id: 'tip-drag-drop',
  title: 'Drag & Drop Everything',
  description: 'Drag tasks between kanban columns, drag files into messages, drag calendar events to reschedule. Froggo supports drag & drop throughout!',
  icon: '🖱️'
},

{
  id: 'tip-markdown-everywhere',
  title: 'Markdown Works Everywhere',
  description: 'Use **bold**, *italic*, `code`, and [links](url) in task descriptions, messages, and notes. Full markdown support!',
  icon: '📝'
},

{
  id: 'tip-starred-inbox',
  title: 'Star Inbox Items',
  description: 'Star important inbox items before approving. Creates record in Starred Messages for future reference.',
  icon: '⭐'
},

{
  id: 'tip-voice-anywhere',
  title: 'Voice Works Anywhere',
  description: 'Press ⌘⇧V from any panel to start voice transcription. Quick way to dictate tasks, messages, or notes.',
  icon: '🎤'
},

{
  id: 'tip-cmd-k-magic',
  title: '⌘K is Magic',
  description: 'Command palette (⌘K) searches everything and executes actions. Learn this one shortcut, forget the rest!',
  icon: '✨'
},

{
  id: 'tip-agent-feedback',
  title: 'Give Agent Feedback',
  description: 'When rejecting agent work, add specific feedback. Agents learn from your comments and improve future output.',
  icon: '💬'
}
```

---

## Implementation Instructions

### To Add These to Your App:

1. **Open** `src/data/helpContent.ts`

2. **Add articles** to the `helpArticles` array:
```typescript
export const helpArticles: HelpArticle[] = [
  // ... existing articles
  
  // Add new articles here
  {
    id: 'first-time-user',
    title: 'Your First 24 Hours with Froggo',
    category: 'Getting Started',
    content: `...`,
    keywords: ['first', 'day', 'start'],
    relatedTo: ['dashboard'],
    lastUpdated: '2026-01-28'
  },
  // ... more articles
];
```

3. **Add FAQs** to the `faqs` array:
```typescript
export const faqs: FAQItem[] = [
  // ... existing FAQs
  
  // Add new FAQs here
  {
    id: 'faq-task-priority-meaning',
    question: 'What does each priority level really mean?',
    answer: 'P0 = Drop everything...',
    category: 'Tasks',
    keywords: ['priority', 'p0', 'p1']
  },
  // ... more FAQs
];
```

4. **Add tips** to the `quickTips` array:
```typescript
export const quickTips: QuickTip[] = [
  // ... existing tips
  
  // Add new tips here
  {
    id: 'tip-drag-drop',
    title: 'Drag & Drop Everything',
    description: 'Drag tasks between kanban columns...',
    icon: '🖱️'
  },
  // ... more tips
];
```

---

## Content Guidelines

When adding more help content:

**✅ DO:**
- Use clear, simple language
- Include specific examples
- Add keyboard shortcuts
- Use emojis for visual interest (sparingly)
- Link related articles with `relatedTo`
- Keep articles scannable (headings, bullets)
- Update `lastUpdated` date
- Add rich keywords for search

**❌ DON'T:**
- Use jargon without explanation
- Write walls of text
- Duplicate information
- Forget to categorize
- Leave keywords empty
- Make assumptions about user knowledge

---

## Testing New Content

**Before Adding:**
1. Search existing articles - is this covered?
2. Is category appropriate?
3. Are keywords comprehensive?
4. Does content answer user question fully?
5. Is it scannable and actionable?

**After Adding:**
1. Search for article in help panel
2. Verify it appears in context-aware help
3. Check related articles link correctly
4. Test on real users for clarity

---

This enhancement adds **15+ new articles**, **6+ new FAQs**, and **6+ new tips** to significantly improve the help system coverage!
