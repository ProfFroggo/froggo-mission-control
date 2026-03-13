// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Centralized help content for the Mission Control Dashboard
 * Searchable, categorized, context-aware help system
 */

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  relatedTo?: string[]; // Related panel/feature IDs
  lastUpdated?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
}

export interface QuickTip {
  id: string;
  title: string;
  description: string;
}

export const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    id: 'getting-started',
    title: 'Getting Started with Mission Control',
    category: 'Getting Started',
    content: `Welcome to Mission Control — your AI agent orchestration platform.

**First Steps:**
1. Explore the sidebar panels using ⌘1-9 keyboard shortcuts
2. Try the Command Palette (⌘K) for quick navigation
3. Open the Agents panel to see your active agents
4. Create your first task in the Kanban board
5. Chat directly with Mission Control agent

**Key Panels:**
- **Inbox**: Approval queue for agent-generated content
- **Dashboard**: System overview and agent activity
- **Tasks**: Kanban board with full task lifecycle
- **Agents**: Manage agents, view sessions, set permissions
- **Chat Rooms**: Real-time rooms for agent-to-agent and human-to-agent comms
- **Projects**: Organize tasks into projects with dedicated workspaces
- **Approvals**: Review agent actions before they execute

**How agents run:**
Mission Control spawns Claude Code CLI processes per agent. Each agent has a persistent session — conversations carry full history automatically. Sessions are kept alive with background keepalive pings so context is never lost.

Use this help panel (⌘?) anytime you need guidance.`,
    keywords: ['start', 'begin', 'intro', 'welcome', 'first', 'new', 'overview'],
    lastUpdated: '2026-03-08'
  },

  // Task Lifecycle
  {
    id: 'task-lifecycle',
    title: 'Task Lifecycle & Workflow',
    category: 'Tasks',
    content: `Every task flows through a defined lifecycle with built-in quality gates.

**Lifecycle:**
todo → pre-review → in-progress → review → done (with human-review branching off at any stage)

**Stage Descriptions:**

**todo** — Task created. Needs planningNotes and subtasks before it can proceed. Assign an agent and the system moves it to Pre-review automatically.

**pre-review (internal-review)** — Clara's Pre-review gate. Automatically entered when a task is assigned to an agent. Clara verifies: agent assigned, planningNotes written, subtasks created. Approved → dispatched to agent. Rejected → back to Todo with notes on what's missing. Agents cannot set this status manually — the system manages it.

**in-progress** — Agent is working. The assigned agent spawns, reads its task, and executes subtasks. Progress is logged via task activity.

**review** — Agent has submitted. Clara verifies ALL planned work was completed. If incomplete, Clara sends back to in-progress with specific notes. If complete, advances to done.

**human-review** — Branches off at ANY stage for: (1) external actions needing human approval (tweets, emails, deploys) via approval_create, (2) genuine blockers needing a human decision. Check the notes to understand what's needed.

**done** — Task complete and verified by Clara.

**Important:** There is no "blocked" status. If work is blocked, move to human-review so a human can investigate and unblock.

**The system sets Pre-review (internal-review) automatically** when an agent is assigned — agents do not set this themselves. Clara then reviews and dispatches.`,
    keywords: ['lifecycle', 'workflow', 'status', 'todo', 'review', 'done', 'internal-review', 'in-progress', 'human-review', 'clara', 'blocked'],
    relatedTo: ['kanban', 'tasks'],
    lastUpdated: '2026-03-08'
  },

  // Agents
  {
    id: 'agents-system',
    title: 'Agent System',
    category: 'Agents',
    content: `Mission Control runs a team of specialized Claude Code CLI agents.

**Your Agents:**

**Mission Control**
- Your primary orchestrator and chief of staff
- Answers questions, breaks down goals, delegates work
- Creates and assigns tasks to other agents
- Chat with Mission Control directly from the Chat tab

**Coder**
- Software development, debugging, code review
- Runs tests, git operations, build pipelines
- Writes and edits code across the full stack

**Clara**
- Quality reviewer — runs automatically on every task
- Validates plans at Pre-review (internal-review) stage — triggered automatically when a task is assigned
- Verifies completed work at review stage
- Approves or rejects with specific, actionable notes

**Chief**
- Lead architect for complex multi-phase projects
- Uses GSD (Get Shit Done) methodology
- Breaks projects into milestones and phases
- Spawns and coordinates sub-agents

**HR**
- Team and people operations
- Onboarding, policy documentation, scheduling

**Trust Tiers:**
Each agent has a trust tier that controls what tools it can use:
- restricted: read-only, limited MCP access
- apprentice: read/write, MCP DB tools
- worker: full dev tools, web access, bash
- trusted: full access including notebooks
- admin: unrestricted

Set trust tiers in Agents > select agent > Permissions tab.

**Sessions:**
Each agent maintains a persistent Claude CLI session per chat surface. Sessions are kept alive automatically with background pings every 25 minutes so you never lose conversation context.`,
    keywords: ['agent', 'coder', 'clara', 'chief', 'hr', 'mission-control', 'ai', 'spawn', 'assign', 'trust', 'tier', 'permissions'],
    relatedTo: ['agents', 'kanban'],
    lastUpdated: '2026-03-08'
  },

  // Kanban
  {
    id: 'kanban-tasks',
    title: 'Kanban Board',
    category: 'Tasks',
    content: `The Kanban board (Tasks panel) is your task management center.

**Creating Tasks:**
1. Click "+ New Task" or press N
2. Add title, description, and priority (P0-P3)
3. Write planningNotes with the full approach and steps
4. Add 2+ subtasks for complex work
5. Assign to an agent — the system automatically moves the task to Pre-review for Clara to validate before work starts

**Task Priority:**
- P0: Critical / on-fire
- P1: High — do today
- P2: Normal (default)
- P3: Low / someday

**Subtasks:**
Add subtasks to break complex work into trackable steps. Agents work through subtasks systematically and mark each complete as they go.

**Task Detail Panel:**
Click any task to open the detail view:
- Overview tab: edit task fields, view progress
- Activity tab: full log of all agent actions
- Subtasks tab: manage subtask checklist
- Chat tab: per-task conversation thread with the assigned agent

**Filters:**
Filter the board by status, priority, agent, or search by keyword. View by kanban columns or as a flat list.`,
    keywords: ['kanban', 'tasks', 'todo', 'workflow', 'agent', 'assign', 'subtasks', 'project', 'priority', 'filter'],
    relatedTo: ['kanban', 'agents'],
    lastUpdated: '2026-03-08'
  },

  // Chat & Rooms
  {
    id: 'chat-rooms',
    title: 'Chat & Chat Rooms',
    category: 'Chat',
    content: `Two ways to communicate with agents: direct chat and rooms.

**Direct Agent Chat:**
Click any agent in the Agents panel and open the Chat tab. This is a persistent 1-on-1 conversation with that agent. The session carries full history — the agent remembers everything from previous messages.

**Mission Control Chat:**
The main Chat panel is a direct line to the Mission Control orchestrator agent. Use it to:
- Ask questions about tasks, projects, or system state
- Give high-level goals — Mission Control breaks them down
- Request status updates across all agents
- Trigger delegation to specialized agents

**Chat Rooms:**
Rooms are shared spaces for agent-to-agent and human-to-agent collaboration. Create rooms for specific projects or topics. Multiple agents can participate in the same room.

Agents can message each other directly using:
mcp__mission-control-db__chat_post { roomId: "agent:{target}", agentId: "{from}", content: "..." }

**Per-Task Chat:**
Each task has its own Chat tab in the Task Detail Panel. Open a task and switch to Chat to have a focused conversation with the assigned agent about that specific task.

**Session Continuity:**
Each chat surface (direct, room, task) maintains its own independent persistent session. You can have parallel conversations with the same agent across different surfaces without them interfering.`,
    keywords: ['chat', 'conversation', 'room', 'message', 'talk', 'mission-control', 'direct', 'task chat'],
    relatedTo: ['chat'],
    lastUpdated: '2026-03-08'
  },

  // Projects
  {
    id: 'projects',
    title: 'Projects',
    category: 'Projects',
    content: `Projects group related tasks into a structured workspace.

**Creating a Project:**
1. Go to the Projects module (install via Modules Library if not visible)
2. Click "New Project" — opens the creation wizard
3. Set name, description, and team members
4. A dedicated chat room is created automatically
5. A library folder is created at ~/mission-control/library/projects/{id}/

**Project Workspace:**
Each project has its own workspace view with:
- Filtered task board showing only project tasks
- Project-specific chat room
- File browser for project library files
- Dispatch controls to spawn agents on project tasks

**Linking Tasks:**
Assign tasks to a project when creating them. Agents working within a project context write their output files to the project library folder.

**Dispatch:**
Use the project dispatch modal to spawn an agent on all open project tasks at once, or select specific tasks to execute.`,
    keywords: ['projects', 'workspace', 'organize', 'group', 'tasks', 'library', 'dispatch'],
    relatedTo: ['projects'],
    lastUpdated: '2026-03-08'
  },

  // Approvals
  {
    id: 'approvals',
    title: 'Approvals & Inbox',
    category: 'Approvals',
    content: `The Approvals panel holds agent-created items awaiting your review.

**What Needs Approval:**
Agents call mcp__mission-control-db__approval_create before taking any external action:
- Tweets and social posts
- Outgoing emails
- Deploys and destructive operations
- Any action flagged for human sign-off

**Approval Flow:**
1. Agent submits approval request with context
2. Item appears in the Approvals panel
3. Review the content and agent's reasoning
4. Approve → agent proceeds with the action
5. Reject → agent receives your feedback and can revise

**Keyboard Navigation:**
- J/K: Navigate between items
- A: Approve selected
- R: Reject selected

**The Hook:**
A PostToolUse hook fires on every mcp__mission-control-db__task_update that moves a task into review status. This automatically triggers Clara's review cycle — you don't need to manually trigger Clara.`,
    keywords: ['approvals', 'inbox', 'approve', 'reject', 'review', 'tweet', 'email', 'hook', 'clara'],
    relatedTo: ['inbox', 'approvals'],
    lastUpdated: '2026-03-08'
  },

  // Keyboard Shortcuts
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts Reference',
    category: 'Productivity',
    content: `Master these keyboard shortcuts for maximum efficiency.

**Navigation (⌘1-9):**
- ⌘1: Inbox / Approvals
- ⌘2: Dashboard
- ⌘3: Analytics
- ⌘4: Tasks (Kanban)
- ⌘5: Agents
- ⌘6: Chat Rooms
- ⌘7: Projects
- ⌘8: Voice
- ⌘9: Settings
- ⌘0: Connected Accounts

**Global Actions:**
- ⌘K: Global search / command palette
- ⌘?: Keyboard shortcuts help
- ⌘,: Settings
- ⌘N: New (context-aware)
- ⌘S: Save / submit

**Appearance:**
- ⌘⇧D: Toggle dark/light mode

**Scroll Navigation:**
- ⌥↑: Scroll up
- ⌥↓: Scroll down
- ⌥⇞: Scroll page up
- ⌥⇟: Scroll page down

**Task Management:**
- N: New task
- ⌘Enter: Complete
- ⌘B: Bookmark / star

**Approval Navigation:**
- J: Next item
- K: Previous item
- A: Approve
- R: Reject

Press ⌘? anytime to view the full shortcut reference.`,
    keywords: ['keyboard', 'shortcuts', 'hotkey', 'keys', 'navigation', 'productivity', 'theme', 'scroll'],
    lastUpdated: '2026-03-08'
  },

  // Settings
  {
    id: 'settings-customization',
    title: 'Settings & Customization',
    category: 'Customization',
    content: `Customize Mission Control to your preferences (⌘,).

**Appearance:**
- Theme: Dark, Light, or System
- Accent color
- Default panel on startup

**Agent Security:**
- Set global disallowed tools (applies to all agents)
- Per-agent disallowed tool overrides
- Trust tier controls what tool categories each agent can access

**Modules:**
Install optional modules from the Modules Library:
- Projects module
- Additional panel types

**Crons & Automation:**
Background jobs run automatically:
- Task dispatcher (every 5 min): picks up assigned tasks and dispatches agents
- Clara review cron (every 3 min): sweeps tasks in review status and triggers Clara
- Session keepalive (every 25 min): pings active CLI sessions to prevent expiry

**MCP Servers:**
Two MCP servers are configured automatically:
- mission-control-db: 17 tools for tasks, chat, approvals, schedules
- memory: 4 tools for reading/writing the memory vault (~/mission-control/memory/)

**Agent Files:**
Each agent reads from ~/mission-control/agents/{agent-id}/:
- SOUL.md: Agent identity, responsibilities, and behavior rules
- MEMORY.md: Agent-specific persistent memory

Edit these files directly to tune agent behavior.`,
    keywords: ['settings', 'preferences', 'customize', 'theme', 'appearance', 'config', 'modules', 'cron', 'mcp', 'soul', 'memory'],
    relatedTo: ['settings'],
    lastUpdated: '2026-03-08'
  }
];

export const faqs: FAQItem[] = [
  {
    id: 'faq-what-is-mission-control',
    question: 'What is Mission Control?',
    answer: 'Mission Control is an AI agent orchestration platform that runs a team of specialized Claude Code CLI agents to handle your tasks, manage communications, and execute work autonomously. Think of it as a command center for your AI team.',
    category: 'General',
    keywords: ['what', 'about', 'mission-control', 'intro']
  },
  {
    id: 'faq-how-agents-run',
    question: 'How do agents actually run?',
    answer: 'Each agent is a Claude Code CLI process spawned on demand. The server uses --print --output-format stream-json --verbose to get a real-time JSON event stream. Sessions are identified by a server-side session ID and resumed with --resume on subsequent messages so the agent retains full conversation history.',
    category: 'Agents',
    keywords: ['agent', 'how', 'run', 'cli', 'claude', 'session', 'process']
  },
  {
    id: 'faq-task-lifecycle',
    question: 'What is the task lifecycle?',
    answer: 'todo → pre-review → in-progress → review → done (with human-review branching off at any stage). Pre-review (internal-review) is set automatically by the system when an agent is assigned — agents cannot set it manually. Clara validates at Pre-review before work starts, and verifies completed work at review before marking done. Moving todo → in-progress directly is blocked by MCP.',
    category: 'Tasks',
    keywords: ['task', 'lifecycle', 'status', 'workflow', 'stages']
  },
  {
    id: 'faq-approval-required',
    question: 'Why do some agent actions need approval?',
    answer: 'Agents call approval_create before taking any external action (tweets, emails, deploys). This gives you a chance to review and approve before the action is executed. The Approvals panel collects these requests.',
    category: 'Approvals',
    keywords: ['approval', 'why', 'review', 'external', 'action']
  },
  {
    id: 'faq-task-stuck',
    question: 'My task is stuck "In Progress" — what happened?',
    answer: 'Check the task activity log for the last action the agent took. Common causes: agent hit a tool permission error, session expired mid-task (rare with keepalive), or the agent is waiting on a dependency. Move to human-review if you need to unblock it manually. There is no blocked status — human-review is the correct state for genuinely stuck work.',
    category: 'Tasks',
    keywords: ['stuck', 'task', 'in progress', 'agent', 'not moving', 'blocked']
  },
  {
    id: 'faq-agent-cost',
    question: 'Do agents cost money to run?',
    answer: 'Agents use Claude Code CLI which runs under your Anthropic subscription (Claude Max or Claude for Work). There is no per-call API billing — costs are covered by your plan. Token usage per agent session is tracked and visible in the Agents panel.',
    category: 'Agents',
    keywords: ['cost', 'money', 'price', 'api', 'usage', 'subscription', 'billing']
  },
  {
    id: 'faq-keyboard-shortcuts',
    question: 'How do I see all keyboard shortcuts?',
    answer: 'Press ⌘? (Cmd+Shift+/) to open the keyboard shortcuts reference. Common ones: ⌘K for global search, ⌘1-9 for panel navigation, N for new task, ⌘, for settings.',
    category: 'Productivity',
    keywords: ['keyboard', 'shortcuts', 'hotkeys', 'how']
  },
  {
    id: 'faq-data-privacy',
    question: 'Where is my data stored?',
    answer: 'All data is stored locally in a SQLite database at ~/mission-control/data/mission-control.db. Agent memory is stored in ~/mission-control/memory/ (an Obsidian-compatible vault). Agent output files go to ~/mission-control/library/. Nothing is stored externally beyond the Claude CLI sessions on Anthropic\'s servers.',
    category: 'Privacy',
    keywords: ['data', 'privacy', 'storage', 'security', 'where', 'local']
  },
  {
    id: 'faq-session-context',
    question: 'Do agents remember previous conversations?',
    answer: 'Yes. Each agent maintains a persistent Claude CLI session per chat surface (direct chat, room, or task). A background keepalive service pings each active session every 25 minutes to prevent Anthropic\'s server-side session expiry. If a session does expire, the last 40 messages are injected as context when the fresh session starts.',
    category: 'Agents',
    keywords: ['memory', 'context', 'remember', 'session', 'history', 'keepalive', 'expire']
  },
  {
    id: 'faq-clara-review',
    question: 'What does Clara do?',
    answer: 'Clara is the quality reviewer. She runs automatically at two lifecycle stages: (1) Pre-review (internal-review) — validates that planningNotes, subtasks, and agent assignment are in place before work begins; tasks enter Pre-review automatically when assigned, agents cannot set it manually; (2) review — verifies that all planned work was completed before marking done. Clara can reject and send tasks back with specific notes.',
    category: 'Agents',
    keywords: ['clara', 'review', 'quality', 'gate', 'approve', 'reject', 'auto']
  },
  {
    id: 'faq-mcp-tools',
    question: 'What MCP tools do agents have access to?',
    answer: 'Two MCP servers: (1) mission-control-db with 17 tools covering tasks, chat, approvals, schedules, inbox, and agent status. (2) memory with 4 tools (memory_search, memory_recall, memory_write, memory_read) for the QMD-powered memory vault. Tool access is gated by each agent\'s trust tier.',
    category: 'Agents',
    keywords: ['mcp', 'tools', 'tools', 'access', 'database', 'memory']
  },
  {
    id: 'faq-export-data',
    question: 'Can I export my data?',
    answer: 'The raw SQLite database is at ~/mission-control/data/mission-control.db — you can query it directly with sqlite3 or any SQLite client. Agent memory is plain Markdown files in ~/mission-control/memory/ and is fully portable.',
    category: 'Privacy',
    keywords: ['export', 'data', 'download', 'backup', 'sqlite', 'portable']
  }
];

export const quickTips: QuickTip[] = [
  {
    id: 'tip-command-palette',
    title: 'Use Command Palette',
    description: 'Press ⌘K to quickly navigate anywhere or perform actions without touching the mouse.',
  },
  {
    id: 'tip-task-subtasks',
    title: 'Always Add Subtasks',
    description: 'Tasks need planningNotes and 2+ subtasks before Clara will pass Pre-review. Break work down and write the plan before assigning to an agent.',
  },
  {
    id: 'tip-task-chat',
    title: 'Per-Task Chat',
    description: 'Open any task and switch to the Chat tab for a focused conversation with the assigned agent about that specific task.',
  },
  {
    id: 'tip-global-search',
    title: 'Search Everything',
    description: 'Global search (⌘K) finds tasks, agents, rooms, and more instantly across all panels.',
  },
  {
    id: 'tip-agent-assignment',
    title: 'Pick the Right Agent',
    description: 'Coder for code, Clara auto-runs reviews, Chief for complex multi-phase projects. Mission Control orchestrates everything.',
  },
  {
    id: 'tip-approval-keyboard',
    title: 'Approve with Keyboard',
    description: 'Use J/K to navigate approvals and A/R to approve/reject. Faster than clicking.',
  },
  {
    id: 'tip-theme-toggle',
    title: 'Quick Theme Switch',
    description: 'Press ⌘⇧D to instantly toggle between dark and light mode.',
  },
  {
    id: 'tip-soul-edit',
    title: 'Tune Agent Behavior',
    description: 'Edit ~/mission-control/agents/{agent-id}/SOUL.md to change how an agent thinks and what it prioritizes.',
  }
];

// Context-aware help: returns relevant articles based on current panel
export function getContextHelp(panel: string): HelpArticle[] {
  return helpArticles.filter(article =>
    article.relatedTo?.includes(panel) ||
    article.category.toLowerCase() === panel.toLowerCase()
  );
}

// Search help articles
export function searchHelp(query: string): HelpArticle[] {
  const lowerQuery = query.toLowerCase();
  return helpArticles.filter(article =>
    article.title.toLowerCase().includes(lowerQuery) ||
    article.content.toLowerCase().includes(lowerQuery) ||
    article.keywords.some(kw => kw.includes(lowerQuery))
  );
}

// Search FAQs
export function searchFAQs(query: string): FAQItem[] {
  const lowerQuery = query.toLowerCase();
  return faqs.filter(faq =>
    faq.question.toLowerCase().includes(lowerQuery) ||
    faq.answer.toLowerCase().includes(lowerQuery) ||
    faq.keywords.some(kw => kw.includes(lowerQuery))
  );
}
