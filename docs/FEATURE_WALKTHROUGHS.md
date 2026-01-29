# Froggo Dashboard - Feature Walkthroughs

**Step-by-step guides for every major feature**

---

## Table of Contents

1. [First-Time Setup](#first-time-setup)
2. [Creating Your First Task](#creating-your-first-task)
3. [Working with Agents](#working-with-agents)
4. [Approval Workflow](#approval-workflow)
5. [Voice Assistant Setup](#voice-assistant-setup)
6. [Calendar Integration](#calendar-integration)
7. [Message Organization](#message-organization)
8. [Advanced Task Management](#advanced-task-management)
9. [Keyboard Shortcuts Mastery](#keyboard-shortcuts-mastery)
10. [Data Export & Backup](#data-export--backup)

---

## First-Time Setup

### Goal
Get Froggo configured and ready for daily use

### Prerequisites
- Froggo.app installed in Applications
- Google account (for calendar/email)
- Twitter/X account (optional)

### Steps

**1. Launch Froggo** (5 minutes)

```
1. Double-click Froggo.app in Applications
2. Grant permissions when prompted:
   ✓ Microphone access
   ✓ Notifications
3. Wait for app to load (first launch takes ~30s)
```

**2. Complete Welcome Tour** (10 minutes)

```
⚠️  Don't skip the tour! It's interactive and helpful.

The tour covers:
• Dashboard overview
• Keyboard navigation basics
• Task creation
• Agent system introduction
• Voice features
```

**3. Connect Google Account** (5 minutes)

```
1. Press ⌘0 or click "Connected Accounts"
2. Click "+ Add Google Account"
3. Browser opens → Choose account
4. Grant permissions:
   ✓ Calendar (read/write)
   ✓ Gmail (read)
   ✓ Contacts (read)
5. Wait for "Connected ✓" status
6. Verify calendar events appear in Dashboard (⌘1)
```

**4. Set Your Preferences** (5 minutes)

```
1. Press ⌘, to open Settings
2. Appearance tab:
   • Theme: Dark / Light / System
   • Accent color: Pick your brand color
   • Font size: Adjust if needed
3. Notifications tab:
   • Enable desktop notifications
   • Set quiet hours (optional)
   • Choose sound effects
4. Keyboard tab:
   • Review shortcuts
   • Customize if desired
5. Click "Save Changes"
```

**5. Create Test Task** (2 minutes)

```
1. Press ⌘5 to open Kanban
2. Press N for new task
3. Fill in:
   Title: "Test task - ignore"
   Description: "Testing the system"
   Priority: P3
   Assigned to: (leave unassigned)
4. Press ⌘S to save
5. Task appears in Todo column ✓
6. Click task to view details
7. Click trash icon to delete
```

**✓ Setup Complete!**

You're ready to use Froggo. Try pressing `⌘K` to explore the command palette.

---

## Creating Your First Task

### Goal
Create a task and assign it to an agent

### Duration
5-10 minutes

### Walkthrough

**Step 1: Open Kanban Board**

```
Press: ⌘5
Or: Click "Kanban" in sidebar
```

You'll see four columns: Todo, In Progress, Review, Done

**Step 2: Create New Task**

```
Press: N
Or: Click "+ New Task" button
```

A form appears on the right side.

**Step 3: Fill Basic Information**

```
Title*: "Write blog post about AI agents"
Description: 
"""
Create a 1000-word blog post explaining how AI agents 
work in Froggo Dashboard. Target audience: developers.

Key points:
- What are AI agents?
- How task assignment works
- Example workflow
- Benefits and limitations
"""
```

*Tip: Use markdown in description for formatting*

**Step 4: Set Priority**

```
Priority dropdown:
• P0 - Critical (fix ASAP) ← For emergencies only
• P1 - High (this week) ← Important tasks
• P2 - Medium (this month) ← Regular work
• P3 - Low (backlog) ← Nice to have

Choose: P1 (High)
```

**Step 5: Assign Agent**

```
Assigned to dropdown:
• None (manual task for you)
• Coder 💻 (for code-related work)
• Writer ✍️ (for content creation) ← Choose this!
• Researcher 🔍 (for research/analysis)
• Chief 👨‍💻 (for complex projects)

Select: Writer
```

**Step 6: Add Subtasks (Optional)**

```
Click "+ Add Subtask"

Subtask 1: "Research AI agent patterns"
Subtask 2: "Write draft outline"
Subtask 3: "Write full post"
Subtask 4: "Edit and proofread"
```

Agents work through subtasks systematically.

**Step 7: Set Due Date (Optional)**

```
Click calendar icon
Choose: Next Friday
```

**Step 8: Add Tags (Optional)**

```
Tags field: "blog, content, ai"
```

Tags help with filtering and organization.

**Step 9: Save Task**

```
Press: ⌘S
Or: Click "Create Task"
```

**Step 10: Verify Task Created**

```
✓ Task card appears in Todo column
✓ Shows Writer avatar
✓ Shows P1 badge
✓ Shows 0/4 subtasks completed
```

**Step 11: Watch Agent Pick It Up**

```
Within seconds:
1. Task moves to "In Progress"
2. Agent session spawns (see Agents panel, ⌘6)
3. Activity log starts updating
4. Click task to watch progress in real-time
```

**Step 12: Review Deliverable**

```
When task moves to "Review":
1. Click task card
2. Read "Activity" tab for agent's work
3. Check "Files" tab for deliverables
4. Review the blog post draft
```

**Step 13: Approve**

```
If satisfied:
• Click "Approve" button
• Task moves to Done ✓

If needs revision:
• Click "Request Changes"
• Add comments with feedback
• Task returns to In Progress
• Agent addresses feedback
```

**🎉 Congratulations!**

You've created, assigned, and completed your first agent task!

---

## Working with Agents

### Goal
Understand how to effectively delegate work to agents

### Agent Selection Guide

**When to use Coder 💻:**
- Writing new code
- Debugging existing code
- Running tests
- Git operations (commit, push, PR)
- Code review
- Tech documentation

**Example task for Coder:**
```
Title: "Fix authentication bug in login flow"
Description: "Users report they can't log in with valid credentials.
Error appears to be in validateUser() function in auth.ts.
Debug and fix the issue."
```

**When to use Writer ✍️:**
- Blog posts and articles
- Social media content (tweets, threads)
- Documentation (user guides, READMEs)
- Email drafts
- Marketing copy
- Proofreading and editing

**Example task for Writer:**
```
Title: "Create Twitter thread about new voice feature"
Description: "Announce our new voice assistant feature in 5-7 tweet thread.
Tone: Excited but professional. Highlight real-time transcription
and privacy (local processing). Include call-to-action."
```

**When to use Researcher 🔍:**
- Web research and fact-finding
- Competitive analysis
- Data gathering
- Summarizing long articles
- Market research
- Technology evaluation

**Example task for Researcher:**
```
Title: "Research best practices for AI agent design"
Description: "Find and summarize top 10 resources on designing
AI agent systems. Focus on: task decomposition, error handling,
context management. Provide annotated list with key takeaways."
```

**When to use Chief 👨‍💻:**
- Complex multi-step projects
- Features requiring multiple agents
- Architecture decisions
- Project planning
- Cross-functional work

**Example task for Chief:**
```
Title: "Implement real-time collaboration feature"
Description: "Add multi-user real-time editing to task descriptions.
Research approach, design architecture, coordinate implementation
across frontend/backend. This will need Researcher + Coder."
```

---

### Delegation Best Practices

**✅ Provide Clear Context**

```
Bad:
Title: "Fix the thing"
Description: "It's broken"

Good:
Title: "Fix calendar sync error"
Description: "Google Calendar events not syncing since yesterday.
Error in console: 'Calendar API returned 401'. Check OAuth token
expiration. Test with test-calendar-sync.ts after fixing."
```

**✅ Set Appropriate Priority**

```
P0: Production down, data loss, security breach
P1: Major feature broken, customer blocked, important deadline
P2: Minor bug, enhancement, normal feature work
P3: Nice to have, tech debt, future improvement
```

**✅ Break Down Complex Work**

```
Don't:
Title: "Build new dashboard"

Do:
Title: "Build analytics dashboard"
Subtasks:
1. Design data model and schema
2. Create API endpoints
3. Build React components
4. Add charts and visualizations
5. Write tests
6. Documentation
```

**✅ Review Promptly**

Agents wait in Review status. Don't leave them hanging!

```
Goal: Review within 1-2 hours of completion
• Read deliverables carefully
• Test if it's code
• Provide specific feedback if rejecting
• Approve when satisfied
```

---

## Approval Workflow

### Goal
Efficiently review and approve agent work

### Walkthrough

**Step 1: Open Inbox**

```
Press: ⌘2
Or: Click "Inbox" in sidebar
Badge shows pending count
```

**Step 2: Navigate Items**

```
Keyboard navigation (fastest):
• J = Next item
• K = Previous item
• Enter = View details

Mouse navigation:
• Click any item in left sidebar
```

**Step 3: Review Content**

Each item type shows different info:

**Tweet:**
```
✓ Tweet text (280 char)
✓ Media attachments
✓ Scheduled time (if scheduled)
✓ Engagement prediction
✓ Thread context (if part of thread)
```

**Email:**
```
✓ To/From/Subject
✓ Body (markdown formatted)
✓ Attachments
✓ Original message (if reply)
```

**Calendar:**
```
✓ Event details
✓ Attendees
✓ Your response (Accept/Decline/Maybe)
✓ Conflicts with other events
```

**Step 4: Edit if Needed**

```
Press: E
Or: Click "Edit" button

Make changes to:
• Text content
• Recipients
• Timing
• Metadata

Press ⌘S to save edits
```

**Step 5: Approve**

```
Press: A
Or: Click "Approve ✓"

Item executes immediately:
• Tweet posts to X
• Email sends
• Calendar response submits
```

**Step 6: Or Reject**

```
Press: R
Or: Click "Reject ✗"

Add reason (optional):
"Tone is too casual for this client"

Item is discarded and agent notified
```

**Step 7: Or Defer**

```
Press: X
Or: Click "Defer"

Item stays in inbox for later review
Good for "need more info" situations
```

**Step 8: Bulk Actions**

```
Approve multiple at once:
1. Select items (⌘ + click)
2. Press ⌘⇧A
3. Confirm bulk approval

Or approve all:
1. Press ⌘⇧A (without selection)
2. Approves all visible items
```

---

### Approval Tips

**⚡ Speed Techniques:**

```
1. Use keyboard navigation exclusively
2. Scan quickly - trust agents for routine work
3. Edit inline instead of rejecting
4. Set up auto-approval rules for trusted content
```

**🛡️ Safety Checks:**

```
Before approving:
✓ Correct recipient/audience?
✓ Tone appropriate?
✓ No typos or errors?
✓ Links work?
✓ Timing is right?
```

**📋 Auto-Approval Setup:**

```
Settings > Automation > Auto-Approval Rules

Example rules:
• "Auto-approve tweets from Writer with hashtag #dailyupdate"
• "Auto-approve emails to team@company.com"
• "Auto-approve calendar accepts for recurring meetings"

⚠️ Use cautiously - mistakes happen!
```

---

## Voice Assistant Setup

### Goal
Configure and master voice features

### Part 1: First-Time Configuration

**Step 1: Open Voice Panel**

```
Press: ⌘8
Or: Click "Voice" in sidebar
```

**Step 2: Grant Microphone Permission**

```
Browser prompts for microphone access
Click "Allow"

If blocked:
1. Browser address bar → permissions icon
2. Change microphone to "Allow"
3. Refresh page
```

**Step 3: Select Microphone**

```
Click gear icon (settings)
Microphone dropdown:
• Built-in Microphone ← Default
• External USB mic
• Bluetooth headset
• AirPods

Choose your preferred device
```

**Step 4: Download Vosk Model**

```
First use triggers automatic download:
"Downloading speech recognition model... (45 MB)"

Wait for completion (~30-60 seconds)
Model caches locally for offline use
```

**Step 5: Configure TTS Voice**

```
Settings → TTS Voice:
• Samantha (Female, American) ← Recommended
• Karen (Female, Australian)
• Daniel (Male, British)

Click each to hear preview
Choose your favorite
```

**Step 6: Adjust Sensitivity**

```
Settings → Silence Detection:
• 0.5s - Very sensitive (triggers fast)
• 1.0s - Balanced
• 2.0s - Default (recommended)
• 5.0s - Patient (waits longer)

Test each to find your preference
```

**Step 7: Test It Out**

```
1. Click the frog orb
2. Say: "Hello Froggo"
3. Watch transcription appear in real-time
4. After 2s silence, message sends
5. Froggo responds via text-to-speech
6. Listening auto-restarts
7. Click orb to stop
```

**✓ Voice Setup Complete!**

---

### Part 2: Conversation Mode

**Use Case:** Quick voice commands and questions

**How to Use:**

```
1. Click frog orb (or press Space when focused)
2. Speak clearly at normal pace
3. Transcription appears in real-time
4. Wait 2 seconds (silence detection)
5. Message auto-sends
6. Froggo responds via TTS
7. Listening restarts automatically
8. Continue conversation
9. Click orb to end
```

**Example Conversation:**

```
You: "What's on my calendar today?"
[2s pause]
Froggo: [TTS] "You have three meetings today: 
         Stand-up at 9 AM, client call at 2 PM, 
         and team sync at 4 PM."

You: "Create a task to prepare for the client call"
[2s pause]
Froggo: [TTS] "Created task 'Prepare for client call' 
         with priority P1. Assigned to you. 
         Would you like to add details?"

You: "Yes, make it due at 1 PM today"
[2s pause]
Froggo: [TTS] "Updated task with due date today at 1 PM."

You: "Thanks, that's all"
[Click orb to stop]
```

**Pro Tips:**

```
✓ Speak naturally - conversational tone works best
✓ Pause between thoughts for clarity
✓ Say "stop listening" to end without clicking
✓ Use wake word "Hey Froggo" (experimental)
✓ Works offline after model downloaded
```

---

### Part 3: Meeting Eavesdrop Mode

**Use Case:** Transcribe meetings and capture action items

**How to Use:**

```
1. Click phone icon (not the orb!)
2. Transcription starts continuously
3. No messages sent automatically
4. Speak freely in meeting
5. Action items auto-detected:
   • "Let's schedule..." → 📅
   • "I'll send..." → 📧
   • "We should..." → ✅
6. After meeting: Click "Send Summary"
7. Full transcript + action items → Froggo
8. Click phone icon to stop
```

**Example Meeting:**

```
[Click phone icon]

Person A: "Let's schedule a follow-up for next Tuesday"
[📅 Auto-detected]

Person B: "I'll send the deck after this call"
[📧 Auto-detected]

You: "We should update the pricing model by Friday"
[✅ Auto-detected]

Person A: "Sounds good. Any other questions?"

[Meeting ends - Click "Send Summary"]

Froggo receives:
---
Meeting Transcript:
[Full text above]

Action Items Detected:
1. 📅 Schedule follow-up for next Tuesday
2. 📧 Send deck after call
3. ✅ Update pricing model by Friday
---

You: "Froggo, create tasks from those action items"

Froggo: [Creates 3 tasks in Kanban]
```

**Pro Tips:**

```
✓ Start recording at meeting start
✓ Keep mic close but not too close
✓ Works in Zoom, Meet, Slack calls
✓ Review transcript before sending
✓ Edit auto-detected action items if needed
✓ Privacy: All processing is local!
```

---

## Calendar Integration

### Goal
Sync Google Calendar and manage events

### Walkthrough

**Step 1: Connect Google Calendar**

```
1. Press ⌘0 (Connected Accounts)
2. Click "+ Add Google Account"
3. Select account in browser OAuth flow
4. Grant calendar permissions
5. Wait for "Connected ✓"
```

**Step 2: Choose Calendars to Sync**

```
1. Click connected account
2. "Manage Calendars" button
3. Checkboxes for each calendar:
   ✓ Primary (your main calendar)
   ✓ Work calendar
   ✓ Shared team calendar
   ☐ Birthdays (maybe not needed)
4. Click "Save Selection"
```

**Step 3: View Events in Dashboard**

```
Press ⌘1 for Dashboard
Calendar widget shows:
• Today's meetings (time-sorted)
• Next 3 upcoming events
• Event title, time, duration
• Attendees (hover to see)
• Join button for video calls
```

**Step 4: Event Details**

```
Click any event to see:
• Full description
• All attendees
• Location / video link
• Attached files
• RSVP status
• Related tasks (if any)
```

**Step 5: Quick Actions**

```
From event card:
• "Join Call" → Opens Zoom/Meet/etc
• "Snooze" → Remind me 10 min before
• "Create prep task" → Auto-creates task
• "Decline" → Send decline response
```

**Step 6: Create Calendar Event**

```
Dashboard → Calendar widget → "+ New Event"

Fill in:
• Title: "Client Review Meeting"
• Date: Tomorrow
• Time: 2:00 PM
• Duration: 30 min
• Attendees: client@company.com
• Video: Auto-generate Meet link
• Description: "Quarterly review"

Click "Create"
→ Goes to Inbox for approval
```

**Step 7: Approve Calendar Changes**

```
Press ⌘2 (Inbox)
Review event details
Press A to approve
Event created in Google Calendar
Attendees receive invitation
```

---

### Calendar Tips

**🎯 Best Practices:**

```
✓ Sync only calendars you need
✓ Create prep tasks for important meetings
✓ Use voice eavesdrop during calls
✓ Block focus time on calendar
✓ Set event reminders (10 min before)
```

**⚡ Power User:**

```
• Use voice: "What's my next meeting?"
• Ask Froggo: "Summarize today's calendar"
• Create task: "Prep for [meeting name]"
• Auto-join calls from notification
```

---

## Message Organization

### Goal
Master folders, starred messages, and snooze

### Part 1: Starred Messages

**What to Star:**
- Important decisions
- Action items
- Reference information
- Follow-up needed

**How to Star:**

```
1. Open any message (Comms Inbox, ⌘3)
2. Click star icon on message
3. Optional: Add note and category
4. Message saved to Starred collection
```

**View Starred:**

```
Press: ⌘⇧S
Or: ⌘K → "Starred Messages"

Interface shows:
• All starred messages (any channel)
• Category badges
• Search bar (full-text)
• Filter by category/channel/date
```

**Example Workflow:**

```
During meeting:
1. Client says important requirement
2. Star that message → Category: "Decision"
3. Add note: "Must include in proposal"

Later:
1. Press ⌘⇧S
2. Filter by category: "Decision"
3. Review all key decisions
4. Create tasks from starred items
```

---

### Part 2: Folders

**Create Folders:**

```
Settings > Organization > "+ New Folder"

Folder: "VIP Clients"
Icon: 🤝
Color: Blue
Description: "High-priority client conversations"

Click "Create"
```

**Assign Conversations:**

```
Method 1: Right-click conversation
→ "Add to Folder"
→ Select folder
→ Click "Assign"

Method 2: Tag button on conversation card
→ Choose folder(s)
→ Can assign to multiple!
```

**Filter by Folder:**

```
Comms Inbox (⌘3)
→ Click folder badge/button
→ Shows only conversations in that folder
→ Click "All" to clear filter
```

**Smart Folders (Coming Soon):**

```
Auto-assign based on rules:
• All from @client → "Clients" folder
• Contains keyword "urgent" → "Priority" folder
• From phone numbers → "Calls" folder
```

---

### Part 3: Snooze & Reminders

**Quick Snooze:**

```
Click moon icon on conversation
Choose:
• 1 hour
• 3 hours
• Tonight (9 PM)
• Tomorrow (9 AM)
• Next week
• Custom
```

**Custom Snooze:**

```
"Custom" option:
→ Date/time picker
→ Optional reason: "Wait for client response"
→ Click "Snooze"

Conversation hidden until snooze expires
```

**Reminders:**

```
When snooze expires:
• Conversation surfaces at top of list
• Pulsing red badge
• Notification (if enabled)
• Click to unsnooze and respond
```

**Example Workflow:**

```
Client: "I'll get back to you tomorrow with the details"

You:
1. Click moon icon on conversation
2. Choose "Tomorrow, 9 AM"
3. Add reason: "Waiting for client details"
4. Conversation disappears

Tomorrow at 9 AM:
• Conversation reappears with badge
• Reminder notification
• Respond promptly
```

---

## Advanced Task Management

### Goal
Master complex task workflows

### Technique 1: Task Templates

**Create Reusable Templates:**

```
For recurring workflows:

Template: "Blog Post Production"
Subtasks:
1. Research topic
2. Write outline
3. Draft content (1000 words)
4. Edit and proofread
5. Create social media snippets
6. Schedule for publishing

Save as template in Settings
```

**Use Template:**

```
1. Create new task
2. Click "From Template"
3. Choose "Blog Post Production"
4. Customize title/description
5. All subtasks auto-populated
```

---

### Technique 2: Task Dependencies

**Link Tasks:**

```
Task A: "Design API schema"
Task B: "Implement API endpoints"

Task B depends on Task A

How to set:
1. Open Task B details
2. "Dependencies" section
3. Add Task A
4. Task B won't start until A is done
```

**Visual Indicators:**

```
Task card shows:
🔗 Waiting on: "Design API schema"

Agent won't start Task B automatically
```

---

### Technique 3: Recurring Tasks

**Schedule Repeating Work:**

```
Settings > Automation > Recurring Tasks

Example:
Task: "Weekly status report"
Frequency: Every Friday
Time: 9:00 AM
Assigned to: Writer
Priority: P2
Auto-create: 2 days before

System creates task automatically
```

---

### Technique 4: Task Chaining

**Sequential Workflows:**

```
Project: "Launch new feature"

Chain tasks:
1. Research → Assigned to Researcher
   ↓ (On completion, auto-creates next task)
2. Design → Assigned to Chief
   ↓
3. Implementation → Assigned to Coder
   ↓
4. Documentation → Assigned to Writer
   ↓
5. Announcement → Assigned to Writer

Setup once, runs automatically
```

---

### Technique 5: Task Analytics

**Track Performance:**

```
Press ⌘4 (Analytics)

View:
• Completion rate by agent
• Average time per priority
• Bottlenecks (tasks stuck in Review)
• Velocity trends
• Agent utilization

Use insights to:
• Optimize task assignment
• Identify slow agents
• Adjust priorities
• Plan capacity
```

---

## Keyboard Shortcuts Mastery

### Goal
Become a keyboard power user

### Learning Path

**Week 1: Navigation (⌘1-9)**

```
Practice daily:
⌘1 → Dashboard
⌘2 → Inbox
⌘3 → Comms
⌘4 → Analytics
⌘5 → Kanban
⌘6 → Agents
⌘7 → X/Twitter
⌘8 → Voice
⌘9 → Chat

Goal: Navigate without thinking
```

**Week 2: Global Actions**

```
Add to muscle memory:
⌘K → Global search
⌘P → Command palette
⌘? → Help
⌘, → Settings
⌘M → Mute
⌘N → New (context-aware)

Practice: Do every action via keyboard
```

**Week 3: Task Management**

```
In Kanban (⌘5):
N → New task
⌘I → Task info
⌘E → Edit
⌘D → Duplicate
⌘B → Bookmark
⌘Enter → Complete

Practice: Never touch mouse in Kanban
```

**Week 4: Inbox Speed**

```
In Inbox (⌘2):
J → Next
K → Previous
A → Approve
R → Reject
X → Defer
⌘⇧A → Approve all

Goal: Process 30+ items/minute
```

---

### Custom Shortcuts

**Personalize Your Workflow:**

```
Settings > Keyboard > Customize

Map frequently-used actions:
Example: ⌘⇧T → "Create task from clipboard"

Your custom shortcuts:
1. ________________ → ⌘⇧_
2. ________________ → ⌘⇧_
3. ________________ → ⌘⇧_
```

---

## Data Export & Backup

### Goal
Ensure your data is safe and portable

### Manual Export

**Full Data Export:**

```
Settings > Data & Privacy > Export All Data

Exports:
✓ All tasks (with history)
✓ Message history (all channels)
✓ Calendar events
✓ Contacts and skills
✓ Agent logs
✓ Settings configuration
✓ Starred messages
✓ Folders and organization

Format: JSON (developer-friendly)
Size: ~10-50 MB typical
Time: 1-2 minutes

Downloads as: froggo-export-YYYY-MM-DD.zip
```

**Selective Export:**

```
Export specific data types:

Tasks only:
1. Kanban (⌘5) → ⋯ menu
2. "Export tasks"
3. Choose: JSON or CSV
4. Filter: Date range, agent, status

Messages only:
1. Comms (⌘3) → ⋯ menu
2. "Export conversations"
3. Filter: Channel, date range
4. Format: JSON with full metadata
```

---

### Automatic Backups

**System Auto-Backup:**

```
Froggo backs up automatically:

Schedule:
• 3:00 AM - Full database backup
• 9:00 AM - Incremental export
• 3:00 PM - Incremental export
• 9:00 PM - Incremental export

Location:
~/clawd/backups/

Retention:
• Full backups: 30 days
• Incremental: 7 days
• Automatic cleanup of old backups
```

**Verify Backups:**

```
Settings > Data & Privacy > View Backups

Shows:
• Backup date/time
• Size
• Type (full/incremental)
• Status (✓ verified / ⚠️ corrupted)
• Quick restore button
```

---

### Restore from Backup

**When to Restore:**

- Accidental data deletion
- Software bug corrupted data
- Want to revert to earlier state
- Migrating to new device

**How to Restore:**

```
Settings > Data & Privacy > Restore from Backup

1. Choose backup file:
   • Most recent (recommended)
   • Or specific date/time
2. Preview what will be restored
3. Click "Restore"
4. Confirm: "This will replace current data"
5. App restarts with restored data
6. Verify everything looks correct
```

**⚠️ Restore overwrites current data!**

Export current state first if unsure.

---

### Cloud Sync (Coming Soon)

**Encrypted cloud backup:**

```
Settings > Data & Privacy > Cloud Sync

• End-to-end encrypted
• Automatic sync across devices
• Version history (30 days)
• Quick restore on new device
• Optional: Google Drive, Dropbox, iCloud
```

Currently: Manual export + store in your cloud service

---

## Conclusion

You now have comprehensive walkthroughs for all major features!

**Next Steps:**

1. Practice each workflow once
2. Bookmark this guide for reference
3. Join community Discord for tips
4. Watch video tutorials for visual learning
5. Customize to your workflow

**Questions?**

Press `⌘?` to search help or `⌘9` to ask Froggo directly.

Happy Frogging! 🐸
