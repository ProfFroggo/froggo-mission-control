# Mission Control Dashboard - Complete User Guide

**Version:** 1.0.0  
**Last Updated:** January 29, 2026

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Panel Reference](#panel-reference)
5. [Workflows](#workflows)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is Mission Control Dashboard?

Mission Control Dashboard is an AI-powered productivity hub that orchestrates specialized agents to handle your tasks, manage communications, and keep you organized. It combines:

- **Task Management** - Full Kanban board with agent assignment
- **Agent Orchestration** - Coder, Writer, Researcher, and Chief agents
- **Communication Hub** - Inbox, approvals, and multi-channel messaging
- **Voice Assistant** - Real-time transcription and conversation
- **Calendar Integration** - Google Calendar sync and management
- **Analytics** - Track productivity and agent performance

### Key Benefits

✅ **AI-Powered Automation** - Agents handle repetitive and complex tasks  
✅ **Unified Interface** - All tools in one place  
✅ **Privacy-First** - Local processing, you own your data  
✅ **Keyboard-Driven** - Full keyboard navigation for power users  
✅ **Context-Aware** - Mission Control understands your workflow  

---

## Getting Started

### System Requirements

- **Operating System:** macOS 11+ (Big Sur or later)
- **Memory:** 4GB RAM minimum, 8GB recommended
- **Storage:** 500MB free space
- **Internet:** Required for agent execution and API calls
- **Microphone:** Required for voice features (optional)

### Installation

1. **Download** the latest release from your distribution channel
2. **Install** by dragging Mission Control.app to Applications
3. **Launch** the application
4. **Grant permissions** when prompted:
   - Microphone access (for voice features)
   - Notifications (for alerts and reminders)
5. **Complete setup wizard** on first launch

### First Launch

When you first open Mission Control:

1. **Welcome Tour** - Interactive walkthrough of core features (recommended)
2. **Connect Accounts** - Link Google Calendar, email, and social media
3. **Set Preferences** - Choose theme, default panel, and notification settings
4. **Create First Task** - Try creating a simple task to test the system

**⚡ Quick Start:** Press `⌘K` for the command palette and type your first command!

---

## Core Concepts

### The Dashboard Philosophy

Mission Control operates on three principles:

1. **Kanban-First Workflow** - All work flows through the task board
2. **Agent Delegation** - Specialized agents for specialized work
3. **Human Oversight** - You review and approve before execution

### Agent System

Mission Control uses **specialized agents** that act as virtual team members:

| Agent | Role | Best For |
|-------|------|----------|
| **Coder 💻** | Software development | Code writing, debugging, git operations |
| **Writer ✍️** | Content creation | Tweets, blog posts, documentation |
| **Researcher 🔍** | Information gathering | Web research, analysis, summarization |
| **Chief 👨‍💻** | Project leadership | Complex projects using GSD methodology |

**How Agents Work:**
1. You create a task and assign it to an agent
2. Agent spawns with task context
3. Agent executes work and logs progress
4. Task moves to Review when complete
5. You review and approve deliverables
6. Agent reports completion

### Task Lifecycle

```
┌──────┐    ┌─────────────┐    ┌────────┐    ┌──────┐
│ Todo │ -> │ In Progress │ -> │ Review │ -> │ Done │
└──────┘    └─────────────┘    └────────┘    └──────┘
              (Agent active)    (Your review)
```

**Status Meanings:**
- **Todo** - Waiting to be picked up
- **In Progress** - Agent is actively working
- **Review** - Work complete, awaiting your approval
- **Done** - Approved and completed

### Approval Workflow

External communications (tweets, emails) require approval:

1. Agent completes draft → Inbox
2. You review content
3. Approve = executes | Reject = discards
4. Optional: Edit before approving

---

## Panel Reference

### 1. Dashboard (⌘1)

**Purpose:** Your command center - overview of everything

**Widgets:**
- **Calendar Widget** - Today's meetings from Google Calendar
  - Shows next 3 meetings
  - Click to view details
  - Join video calls with one click
- **Email Widget** - Recent unread emails
  - Shows 5 most recent
  - Quick reply or mark as read
  - Filters by account
- **Stats Widget** - Key metrics
  - Tasks completed today/week
  - Active agent sessions
  - Inbox pending count
- **Quick Actions** - Floating buttons
  - Global search (🔍)
  - New task (➕)
  - Add contact (👤)
  - Add skill (📚)
  - Approve all (✅)

**Customization:**
- Drag widgets to reorder
- Hide/show widgets in Settings
- Choose default view (list/grid)
- Set refresh interval

---

### 2. Inbox (⌘2)

**Purpose:** Approval queue for outgoing content

**What Appears Here:**
- Tweets drafted by agents
- Outgoing emails
- Scheduled social posts
- Calendar event responses
- Message replies (WhatsApp, Telegram, etc.)

**Interface:**
- **Left Sidebar:** List of pending items
- **Main Panel:** Preview of selected item
- **Actions Bar:** Approve, Reject, Edit, Defer

**Keyboard Navigation:**
- `J` - Next item
- `K` - Previous item
- `A` - Approve selected
- `R` - Reject selected
- `X` - Defer (decide later)
- `⌘⇧A` - Approve all visible
- `Enter` - Open for editing

**Item Types:**
1. **Tweet** - Shows text, media, scheduled time
2. **Email** - Subject, recipients, body, attachments
3. **Message** - Platform, recipient, content
4. **Calendar** - Event details, response type

**Editing Before Approval:**
1. Click item to select
2. Press `E` or click "Edit"
3. Make changes
4. Press `⌘S` to save and approve

---

### 3. Comms Inbox (⌘3)

**Purpose:** Multi-channel message management

**Channels Supported:**
- WhatsApp
- Telegram
- Discord
- Email (inbox view)
- SMS (when configured)

**Features:**
- **Unified view** - All channels in one place
- **Smart filtering** - By channel, unread, starred
- **Quick reply** - Inline message composition
- **Thread support** - Maintain conversation context
- **Rich media** - Images, videos, documents

**Filtering:**
- Click channel icons to filter
- "All" shows combined view
- "Unread" badge count
- Search within messages

**Message Actions:**
- **Reply** - Quick reply inline
- **Star** - Bookmark important messages
- **Snooze** - Hide until later (reminder)
- **Assign to folder** - Organize by project/topic
- **Mark as done** - Archive from view

---

### 4. Analytics (⌘4)

**Purpose:** Productivity insights and performance metrics

**Dashboard Sections:**

**Overview:**
- Tasks completed (today/week/month)
- Average completion time
- Agent utilization rate
- Response time metrics

**Task Analytics:**
- Completion rate by agent
- Tasks by status (pie chart)
- Tasks by priority (bar chart)
- Velocity trend (line chart)

**Agent Performance:**
- Tasks completed per agent
- Average task duration
- Success rate
- Active vs idle time

**Time Tracking:**
- Hours logged by project
- Time distribution (work/meetings/focus)
- Peak productivity hours
- Interruption analysis

**Export Options:**
- CSV export for all data
- Custom date ranges
- Filter by agent, project, or tag
- Generate PDF reports

---

### 5. Kanban (⌘5)

**Purpose:** Full task management board

**Board Layout:**
```
┌──────────┬──────────────┬──────────┬──────────┐
│  Todo    │ In Progress  │  Review  │   Done   │
├──────────┼──────────────┼──────────┼──────────┤
│ Tasks    │ Tasks        │ Tasks    │ Tasks    │
│ awaiting │ being worked │ awaiting │ completed│
│ pickup   │ by agents    │ approval │ and done │
└──────────┴──────────────┴──────────┴──────────┘
```

**Task Card Components:**
- **Title** - Brief description
- **Priority Badge** - P0 (critical) to P3 (low)
- **Agent Avatar** - Who it's assigned to
- **Progress Bar** - Subtasks completed
- **Tags** - Project/category labels
- **Time Estimate** - Expected duration
- **Due Date** - Deadline (if set)

**Creating Tasks:**

1. **Press `N`** or click "+ New Task"
2. **Fill Details:**
   - Title (required)
   - Description (markdown supported)
   - Priority (P0-P3)
   - Assigned Agent
   - Due Date (optional)
   - Tags (optional)
3. **Add Subtasks:**
   - Break down complex work
   - Each subtask can be checked off independently
4. **Save:**
   - Press `⌘S` or click "Create Task"
   - Task appears in Todo column

**Task Details Panel:**

Click any task to open details:

**Tabs:**
- **Overview** - Full description, metadata, progress
- **Subtasks** - Checklist with completion status
- **Activity** - Full log of all actions and agent updates
- **Comments** - Discussion thread
- **Files** - Attachments and deliverables

**Actions:**
- `⌘I` - Toggle info panel
- `⌘E` - Edit task
- `⌘D` - Duplicate task
- `⌘B` - Bookmark/star
- `⌘⇧D` - Delete task
- `⌘Enter` - Complete task

**Drag & Drop:**
- Drag tasks between columns to change status
- Drag to reorder within column
- Multi-select with `⌘` + click

**Filters:**
- **By Agent** - Show only tasks for specific agent
- **By Priority** - P0, P1, P2, P3
- **By Tag** - Project or category
- **By Status** - Any column
- **Search** - Full-text search

---

### 6. Agents (⌘6)

**Purpose:** Monitor and manage active agents

**Agent Cards:**

Each agent has a status card showing:
- **Status** - Idle | Working | Blocked
- **Current Task** - What they're working on
- **Progress** - Percentage complete
- **Time Active** - How long they've been working
- **Last Update** - Most recent activity log

**Actions Per Agent:**
- **View Details** - Full session info
- **View Logs** - Complete activity history
- **Pause** - Temporarily stop (requires resume)
- **Terminate** - Force stop (use cautiously)

**Agent Queue:**

See upcoming tasks assigned to each agent:
- Tasks waiting in queue
- Estimated start time
- Priority sorting

**Session Management:**

Click "View All Sessions" to see:
- All active agent sessions
- Session duration
- Task context
- Resource usage
- Logs and output

---

### 7. X/Twitter (⌘7)

**Purpose:** Social media management for X (Twitter)

**Compose Tweet:**

1. **Press `⌘N`** or click "New Tweet"
2. **Write Content:**
   - 280 character limit (live counter)
   - Markdown formatting preview
   - Mention autocompletion (@username)
   - Hashtag suggestions (#trending)
3. **Add Media:**
   - Drag & drop images (up to 4)
   - GIF picker
   - Poll creator (2-4 options)
4. **Schedule (Optional):**
   - Pick date/time
   - Or use "Optimal time" suggestion
5. **Submit:**
   - Goes to Inbox for approval
   - Or schedule directly if auto-approved

**Timeline View:**
- Home feed
- Mentions
- Notifications
- DMs (when supported)

**Thread Composer:**

For multi-tweet threads:
1. Click "New Thread"
2. Write first tweet
3. Click "+" to add connected tweet
4. Number indicators show order
5. Submit entire thread for approval

**Analytics:**
- Engagement metrics per tweet
- Follower growth chart
- Best performing content
- Optimal posting times

---

### 8. Voice (⌘8)

**Purpose:** Real-time voice transcription and meeting assistant

**Two Modes:**

#### 1. Conversation Mode (Frog Orb)

**How to Use:**
1. **Click the frog orb** to start listening
2. **Speak naturally** - see real-time transcription
3. **After silence detection** (~2s), message auto-sends to Mission Control
4. **Mission Control responds** via text-to-speech (TTS)
5. **Listening auto-restarts** for continuous conversation
6. **Click orb again** to stop

**Perfect For:**
- Quick voice commands
- Dictating tasks
- Asking questions
- Hands-free interaction

**Example Flow:**
```
You: "Create a task to fix the login bug, priority high"
Mission Control: [TTS] "Created task 'Fix login bug' with priority P1. Assigned to Coder."
You: "Thanks. What's on my calendar today?"
Mission Control: [TTS] "You have 3 meetings: Stand-up at 9am, Client call at 2pm..."
```

#### 2. Meeting Eavesdrop Mode (Phone Icon)

**How to Use:**
1. **Click phone icon** to start continuous listening
2. **Transcription runs** without sending messages
3. **Auto-detects action items:**
   - Schedule keywords ("let's meet next Tuesday")
   - Email triggers ("I'll send you the doc")
   - Task indicators ("we should update the...")
4. **Click "Send Summary"** when meeting ends
   - Sends full transcript
   - Lists detected action items
   - Mission Control can create tasks from action items
5. **Click phone icon** to end

**Perfect For:**
- Transcribing meetings
- Capturing action items
- Taking meeting notes
- Never missing details

**Settings:**

Access via gear icon:
- **TTS Voice** - Samantha, Karen, Daniel
- **Speaking Rate** - Slow, Normal, Fast
- **Silence Threshold** - How long to wait before auto-send (0.5-5s)
- **Auto-Send** - Enable/disable automatic message sending
- **Wake Word** - "Hey Mission Control" detection (experimental)

**Privacy Note:**
All transcription runs **locally on your device** using Vosk. No audio is sent to the cloud.

---

### 9. Chat (⌘9)

**Purpose:** Direct conversation with Mission Control

**How to Use:**

Just type naturally! Mission Control understands context and can:
- Answer questions
- Create tasks
- Search your data
- Execute actions
- Provide help
- Explain features

**Example Conversations:**

```
You: What's on my calendar tomorrow?
Mission Control: You have 2 meetings tomorrow:
- 10am: Team Sync (1 hour)
- 2pm: Client Review (30 min)

You: Create a task to prepare the client deck
Mission Control: Created task "Prepare client deck" in Todo.
Assigned to Writer. Priority P1. Want to add details?

You: Yes, make it due tomorrow at 1pm
Mission Control: Updated task with due date: Jan 30, 1:00 PM.

You: How many tasks did I complete this week?
Mission Control: You completed 23 tasks this week! 🎉
Breakdown: 8 by Coder, 9 by Writer, 6 by Researcher.
```

**Context Awareness:**

Mission Control has access to:
- ✅ Your task board and all tasks
- ✅ Calendar and upcoming events
- ✅ Recent emails and messages
- ✅ Agent activity and status
- ✅ Contacts and skills database
- ✅ Conversation history

**Message Actions:**
- **Copy** - Copy message to clipboard
- **Edit** - Edit your message (before sending)
- **Regenerate** - Ask Mission Control to rephrase
- **Follow-up** - Quick reply shortcuts

**Slash Commands:**

Special commands for power users:
- `/task <description>` - Quick task creation
- `/search <query>` - Search everything
- `/status` - System status
- `/help` - Help on specific topic
- `/export` - Export conversation

---

### 10. Connected Accounts (⌘0)

**Purpose:** Manage integrations and linked accounts

**Account Types:**

#### Google Accounts
- **Calendar** - Sync events and meetings
- **Gmail** - Email integration
- **Contacts** - People database
- **Drive** - File access (coming soon)

**To Connect:**
1. Click "+ Add Google Account"
2. Select account in browser OAuth flow
3. Grant requested permissions
4. Account appears in list
5. Choose which services to enable

#### Social Media
- **X (Twitter)** - Tweet management
- **LinkedIn** - Post scheduling (coming soon)
- **Mastodon** - Federated social (coming soon)

#### Communication
- **WhatsApp** - Message integration
- **Telegram** - Bot and user client
- **Discord** - Server management
- **Slack** - Workspace integration (coming soon)

#### Development
- **GitHub** - Repository access
- **GitLab** - Alternative Git hosting
- **Linear** - Issue tracking (coming soon)
- **Notion** - Knowledge base (coming soon)

**Account Settings:**

For each connected account:
- **Status** - Connected | Disconnected | Error
- **Permissions** - View granted scopes
- **Sync Status** - Last sync time
- **Refresh** - Force re-sync
- **Disconnect** - Remove integration

---

### 11. Settings (⌘,)

**Purpose:** Customize Mission Control to your preferences

**Sections:**

#### Appearance
- **Theme** - Dark, Light, System (auto)
- **Accent Color** - Choose brand color
- **Font Size** - Small, Medium, Large
- **Sidebar Position** - Left, Right
- **Panel Order** - Rearrange sidebar
- **Animations** - Enable/disable transitions

#### Notifications
- **Desktop Notifications** - System alerts
- **Sound Effects** - Notification sounds
- **Badge Count** - Show/hide counts
- **Quiet Hours** - Mute during specified times
- **Priority Alerts** - Only for P0/P1 tasks

#### Automation
- **Auto-Approval Rules** - Trust certain content
  - Example: "Auto-approve tweets from Writer about #productupdate"
- **Scheduled Tasks** - Recurring task templates
- **Agent Triggers** - Auto-assign based on keywords
- **Webhook Integrations** - External automation

#### Privacy & Security
- **Data Retention** - How long to keep data
- **Export Your Data** - Download everything
- **Delete Account** - Permanent removal
- **Session Management** - View active sessions
- **Two-Factor Auth** - Additional security (coming soon)

#### Keyboard
- **Shortcuts Reference** - View all shortcuts
- **Customize Shortcuts** - Remap keys
- **Enable/Disable** - Toggle keyboard navigation
- **Vim Mode** - For power users (experimental)

#### Voice
- **Microphone** - Select input device
- **TTS Voice** - Choose speaker
- **Speaking Rate** - Adjust speed
- **Silence Detection** - Sensitivity
- **Model** - Vosk model selection

---

## Workflows

### Daily Workflow Example

**Morning Routine (15 minutes):**

1. **Open Dashboard (⌘1)**
   - Review today's calendar
   - Check email widget for urgent messages
   - Scan task completion stats from yesterday

2. **Check Inbox (⌘2)**
   - Approve overnight work from agents
   - Review drafted tweets
   - Quick keyboard navigation (J/K/A)

3. **Review Kanban (⌘5)**
   - Check what's in Review
   - Plan today's priorities
   - Assign new tasks to agents

4. **Voice Standup (⌘8)**
   - Click frog orb
   - "What's my top priority today?"
   - "Show me tasks due this week"

**During Work (ongoing):**

5. **Monitor Agents (⌘6)**
   - Check progress every hour
   - Review activity logs
   - Address blockers

6. **Process Communications (⌘3)**
   - Respond to messages
   - Star important items
   - Snooze follow-ups

7. **Use Voice for Meetings (⌘8)**
   - Start eavesdrop mode
   - Let it transcribe automatically
   - Send summary after meeting ends

**End of Day (10 minutes):**

8. **Final Inbox Review (⌘2)**
   - Approve remaining items
   - Defer anything non-urgent

9. **Complete Tasks (⌘5)**
   - Move tasks to Done
   - Review agent work
   - Plan tomorrow

10. **Check Analytics (⌘4)**
    - Review productivity metrics
    - Celebrate wins
    - Identify bottlenecks

---

### Agent-Driven Development Workflow

**For software development tasks:**

1. **Create Master Task (⌘5)**
   ```
   Title: "Build user authentication system"
   Assigned: Chief
   Priority: P1
   ```

2. **Chief Breaks Down Work**
   - Chief agent analyzes requirements
   - Creates subtasks:
     - Design auth flow
     - Implement backend
     - Build frontend components
     - Write tests
     - Documentation

3. **Subtasks Auto-Assigned**
   - Coder: Backend and frontend
   - Writer: Documentation
   - Researcher: Best practices analysis

4. **Monitor Progress**
   - Watch task board (⌘5)
   - Review agent logs (⌘6)
   - Check deliverables

5. **Review & Approve**
   - Each subtask moves to Review
   - Test the code
   - Approve or request changes

6. **Integration**
   - Chief coordinates final integration
   - All code merged
   - Task marked Done

---

### Content Creation Workflow

**For blog posts, tweets, documentation:**

1. **Quick Voice Brief (⌘8)**
   ```
   "Create a task for Writer to draft a blog post 
    about our new feature. Target audience is developers.
    Tone should be technical but friendly. Due Friday."
   ```

2. **Writer Receives Task**
   - Researches topic
   - Drafts outline
   - Writes content
   - Formats with markdown

3. **Draft Moves to Inbox**
   - You receive notification
   - Review content in Inbox (⌘2)
   - Edit inline if needed

4. **Approve or Iterate**
   - **Approve:** Content published/scheduled
   - **Reject with feedback:** Writer revises

5. **Multi-Channel Distribution**
   - Tweet thread created from key points
   - LinkedIn post drafted
   - Newsletter snippet generated
   - All appear in Inbox for approval

---

### Meeting Management Workflow

**Before Meeting:**

1. **Calendar View (⌘1)**
   - Click upcoming meeting
   - View attendees and agenda
   - Join video call with one click

2. **Prep Task**
   - Voice: "Create prep task for 2pm client meeting"
   - Mission Control creates task, assigns to you or Researcher

**During Meeting:**

3. **Start Voice Eavesdrop (⌘8)**
   - Click phone icon
   - Transcription runs silently
   - Focus on conversation

**After Meeting:**

4. **Send Summary**
   - Click "Send Summary" button
   - Mission Control receives transcript + action items
   - Ask: "Create tasks from action items"

5. **Mission Control Auto-Creates Tasks**
   - "Send deck to client" → Task for you
   - "Update pricing model" → Task for Coder
   - "Draft proposal" → Task for Writer

6. **Follow-Up Email**
   - Ask Mission Control: "Draft follow-up email with meeting notes"
   - Email goes to Inbox for review
   - Approve and send

---

## Advanced Features

### Folder Organization

**Purpose:** Organize conversations and tasks into custom folders

**Creating Folders:**

1. Go to Settings > Organization
2. Click "+ New Folder"
3. Choose name, icon, and color
4. Save

**Assigning Items:**

- Right-click conversation/task
- "Add to Folder"
- Select folder(s)
- Items can be in multiple folders

**Smart Folders (Coming Soon):**

Auto-assign based on rules:
- "All messages from @client → Clients folder"
- "All P0 tasks → Urgent folder"

---

### Starred Messages

**Purpose:** Bookmark important messages for quick reference

**Starring:**
- Click star icon on any message
- Works across all channels
- Add optional note and category

**Viewing Starred:**
- Press `⌘⇧S` for starred panel
- Or via Command Palette (⌘K → "Starred")

**Categories:**
- `important` - High priority
- `reference` - Info to remember
- `todo` - Action items
- `decision` - Key decisions
- `follow-up` - Needs follow-up

**Search Starred:**
- Full-text search across all starred items
- Filter by category, channel, or date range

---

### Snooze & Reminders

**Purpose:** Temporarily hide conversations and get reminded later

**Quick Snooze:**
- Click moon icon on conversation
- Choose preset: 1h, 3h, Tonight (9 PM), Tomorrow (9 AM), Next Week

**Custom Snooze:**
- Click "Custom"
- Pick exact date/time
- Add optional reason/note

**Reminders:**
- Expired snoozes surface at top of list
- Pulsing red badge indicates reminder
- Click to unsnooze and respond

---

### Global Search (⌘K)

**Search Everything:**
- Tasks (by title, description, tags)
- Messages (across all channels)
- Contacts (name, email, phone)
- Skills (name, description)
- Calendar events
- Files and attachments

**Search Syntax:**

```
"exact phrase"          # Exact match
tag:project            # By tag
from:agent             # By creator
status:in-progress     # By status
priority:p0            # By priority
date:2026-01-28        # By date
```

**Quick Actions from Search:**
- Press `Enter` to open
- Press `⌘Enter` to open in new context
- Press `⌘⇧Enter` to perform default action

---

### Keyboard Maestro

**Full Keyboard Navigation:**

Every action has a keyboard shortcut. Master these for 10x speed:

**Panel Navigation:** `⌘1-9`  
**Global Actions:** `⌘K`, `⌘P`, `⌘?`, `⌘,`  
**Task Actions:** `N`, `⌘I`, `⌘Enter`, `⌘B`  
**Inbox Navigation:** `J`, `K`, `A`, `R`, `X`  

**Custom Shortcuts:**
- Go to Settings > Keyboard
- Click any action to remap
- Use `⌘⇧` modifiers for personal shortcuts

---

### Export & Backup

**Manual Export:**

Settings > Data & Privacy > Export Data

**What Gets Exported:**
- All tasks (JSON/CSV)
- Message history
- Calendar events
- Contacts and skills
- Agent logs
- Settings configuration

**Automatic Backups:**

Mission Control backs up daily:
- Full database backup (3 AM)
- Incremental backups (9 AM, 3 PM, 9 PM)
- 30 days retention
- Stored locally: `~/mission-control/backups/`

**Restore:**
1. Settings > Data & Privacy > Restore
2. Choose backup file
3. Confirm restore point
4. App restarts with restored data

---

## Best Practices

### Task Management

✅ **DO:**
- Break complex tasks into subtasks
- Set realistic priorities (not everything is P0!)
- Add clear descriptions for agents
- Use tags for organization
- Review agent work promptly

❌ **DON'T:**
- Create vague tasks ("Fix stuff")
- Assign to wrong agent type
- Leave tasks in Review indefinitely
- Duplicate work across multiple tasks

---

### Agent Usage

✅ **DO:**
- Assign specific, well-defined tasks
- Provide necessary context
- Monitor progress regularly
- Review deliverables carefully
- Give feedback for improvements

❌ **DON'T:**
- Assign highly creative decisions
- Expect perfection on first try
- Let agents run without oversight
- Trust blindly without reviewing

---

### Communication

✅ **DO:**
- Approve/reject inbox items promptly
- Edit drafts before approving
- Use snooze for follow-ups
- Star important messages
- Organize with folders

❌ **DON'T:**
- Auto-approve everything
- Let inbox pile up
- Ignore message context
- Forget to follow up

---

### Voice Assistant

✅ **DO:**
- Speak clearly and naturally
- Use eavesdrop mode for meetings
- Review transcripts before sending
- Adjust sensitivity settings
- Keep microphone close

❌ **DON'T:**
- Use in noisy environments
- Speak too fast
- Ignore transcription errors
- Share private meeting recordings
- Forget to stop recording

---

## Troubleshooting

### Common Issues

#### Task Stuck "In Progress"

**Problem:** Task hasn't moved in hours  
**Solution:**
1. Check task activity log for errors
2. View agent logs (⌘6)
3. If stuck: Reset to Todo and reassign
4. Ask Mission Control in Chat: "Why is task-XXX stuck?"

#### Voice Not Working

**Problem:** Transcription not appearing  
**Solution:**
1. Check microphone permissions (System Preferences > Security)
2. Verify correct mic selected (Voice settings)
3. Test mic in another app
4. Ensure Vosk model downloaded (auto-downloads on first use)
5. Check browser console for errors

#### Inbox Items Not Appearing

**Problem:** Agents completed work but nothing in Inbox  
**Solution:**
1. Check if auto-approval is enabled (Settings > Automation)
2. Verify task is in Review status (not Done)
3. Check notification settings
4. Refresh panel (⌘R)

#### Calendar Not Syncing

**Problem:** Events not showing up  
**Solution:**
1. Go to Connected Accounts (⌘0)
2. Check Google Calendar status
3. Click "Refresh" on account
4. If still broken: Disconnect and reconnect account
5. Verify calendar permissions in Google account settings

#### Slow Performance

**Problem:** Dashboard feels laggy  
**Solution:**
1. Close unused panels
2. Clear old data (Settings > Data & Privacy > Clear Cache)
3. Check agent sessions (⌘6) - terminate idle sessions
4. Restart application
5. Check system resources (Activity Monitor)

---

### Error Messages

#### "No Active Task Context"

**Meaning:** Operation requires task context  
**Fix:** Create or select a task before performing action

#### "Agent Session Failed to Spawn"

**Meaning:** Couldn't start agent  
**Fix:** 
1. Check internet connection
2. Verify API credentials (Settings > API)
3. Try again in a few minutes
4. Contact support if persists

#### "Permission Denied"

**Meaning:** Missing system permissions  
**Fix:**
1. Go to System Preferences > Security & Privacy
2. Grant requested permissions
3. Restart Mission Control

---

### Getting Help

**In-App Help:**
- Press `⌘?` for this help panel
- Use Chat (⌘9) to ask Mission Control
- Check FAQ section for common questions

**External Resources:**
- Documentation: https://docs.mission-control.ai
- Video Tutorials: https://youtube.com/@mission-control
- Community: https://discord.gg/mission-control
- Support: support@mission-control.ai

---

## Appendix

### Keyboard Shortcuts Reference

See [KEYBOARD_SHORTCUTS_REFERENCE.md](./KEYBOARD_SHORTCUTS_REFERENCE.md) for complete list.

### Data Storage

All data stored locally in:
- SQLite Database: `~/mission-control/data/mission-control.db`
- Backups: `~/mission-control/backups/`
- Logs: `~/mission-control/logs/`
- Voice Models: `~/Library/Application Support/Mission Control/models/`

### Privacy Policy

- Voice transcription runs 100% locally (Vosk)
- Agent conversations go through Claude API (Anthropic)
- No data sold to third parties
- You own all your data
- Export anytime, delete anytime

---

**Questions?** Press `⌘9` to chat with Mission Control or press `⌘?` to search help articles.
