/**
 * Centralized help content for the Froggo Dashboard
 * Searchable, categorized, context-aware help system
 */

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  relatedTo?: string[]; // Related panel/feature IDs
  videoUrl?: string;
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
  icon?: string;
}

export const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    id: 'getting-started',
    title: 'Getting Started with Froggo',
    category: 'Getting Started',
    content: `Welcome to Froggo, your AI-powered productivity dashboard!

**First Steps:**
1. Explore the sidebar panels using ⌘1-9 keyboard shortcuts
2. Try the Command Palette (⌘K) for quick navigation
3. Check your Inbox (⌘1) for communications
4. View your dashboard (⌘2) for overview and stats
5. View your tasks in the Kanban board (⌘4)

**Key Features:**
- **Inbox**: 3-pane communications view for email, WhatsApp, Telegram, Discord
- **Dashboard**: Overview of your day, calendar, and quick stats
- **Analytics**: Dashboard analytics and metrics
- **Tasks**: Full kanban board with agent assignment
- **Agents**: Manage Coder, Writer, Researcher, and Chief agents
- **X**: Compose tweets and check mentions
- **Voice**: Real-time voice transcription and meeting assistant
- **Chat**: Direct conversation with Froggo
- **Approvals**: Approve tweets, emails, and agent-generated content

Use this help panel (⌘?) anytime you need guidance!`,
    keywords: ['start', 'begin', 'intro', 'welcome', 'first', 'new', 'overview'],
    videoUrl: 'https://example.com/getting-started',
    lastUpdated: '2026-01-28'
  },
  
  // Dashboard
  {
    id: 'dashboard-overview',
    title: 'Dashboard Overview',
    category: 'Dashboard',
    content: `The Dashboard (⌘2) is your command center.

**Widgets:**
- **Calendar**: Today's meetings and events from Google Calendar
- **Email**: Recent unread emails from connected accounts
- **Quick Stats**: Task completion, agent activity, and system status
- **Quick Actions**: Floating action buttons for common tasks

**Quick Actions:**
- 🔍 Global Search (⌘K)
- ➕ New Task
- 👤 Add Contact
- 📚 Add Skill
- ✅ Approve All (bulk approve inbox items)

**Customization:**
Go to Settings (⌘,) to customize your dashboard layout, theme, and default panel.`,
    keywords: ['dashboard', 'home', 'overview', 'widgets', 'calendar', 'email', 'stats'],
    relatedTo: ['dashboard'],
    lastUpdated: '2026-01-28'
  },

  // Inbox & Approvals
  {
    id: 'inbox-approvals',
    title: 'Communications Inbox',
    category: 'Inbox',
    content: `The Inbox (⌘1) is your 3-pane communications hub for email, WhatsApp, Telegram, and Discord.

**Layout:**
- **Left Pane**: Account/folder selector (Gmail, WhatsApp, Telegram, Discord, X DMs)
- **Center Pane**: Message/conversation list
- **Right Pane**: Message detail with inline reply

**Features:**
- Multi-account email support (Gmail)
- Unified messaging across platforms
- Search and filter messages
- AI-assisted reply composition
- Inline message threading

The Approval Queue (⌘0) shows agent-generated content awaiting your review.

**What Gets Approved:**
- Tweets composed by agents
- Outgoing emails
- Calendar event responses
- Scheduled posts

**Keyboard Navigation:**
- J/K: Navigate between items
- A: Approve selected item
- R: Reject item
- X: Defer (decide later)
- ⌘⇧A: Approve all visible items

**Workflow:**
1. Review item content and metadata
2. Edit if needed before approving
3. Approve or reject
4. Item is executed or discarded

**Auto-Approval:**
You can enable auto-approval for trusted content in Settings > Automation.`,
    keywords: ['inbox', 'approve', 'approval', 'review', 'tweet', 'email', 'pending'],
    relatedTo: ['inbox'],
    videoUrl: 'https://example.com/inbox-workflow',
    lastUpdated: '2026-01-28'
  },

  // Tasks & Kanban
  {
    id: 'kanban-tasks',
    title: 'Task Management & Kanban',
    category: 'Tasks',
    content: `The Kanban board (⌘5) is your task management system.

**Task Workflow:**
Todo → In Progress → Review → Done

**Creating Tasks:**
1. Press N or click "+ New Task"
2. Add title, description, and priority
3. Assign to an agent (Coder, Writer, Researcher, Chief)
4. Add subtasks for complex work
5. Task auto-moves through workflow stages

**Agent Assignment:**
- **Coder**: Software development, debugging, code review
- **Writer**: Content creation, social posts, documentation
- **Researcher**: Web research, analysis, summarization
- **Chief**: Lead engineer for complex projects (GSD methodology)

**Keyboard Shortcuts:**
- N: New task
- ⌘I: Task details
- ⌘Enter: Complete task
- ⌘⇧D: Duplicate task
- ⌘B: Bookmark/star task

**Task Filters:**
- Filter by status, priority, agent, or tags
- Search tasks with ⌘K
- View task activity log for full history`,
    keywords: ['kanban', 'tasks', 'todo', 'workflow', 'agent', 'assign', 'subtasks', 'project'],
    relatedTo: ['kanban', 'agents'],
    videoUrl: 'https://example.com/kanban-guide',
    lastUpdated: '2026-01-28'
  },

  // Agents
  {
    id: 'agents-system',
    title: 'Agent System',
    category: 'Agents',
    content: `Froggo can spawn specialized agents to handle tasks.

**Available Agents:**

**Coder (💻)**
- Writes, reviews, and debugs code
- Runs tests and builds
- Git operations
- Tech stack: TypeScript, React, Node.js, Python

**Writer (✍️)**
- Creates content (tweets, blog posts, docs)
- Edits and proofreads
- Social media management
- Maintains consistent voice

**Researcher (🔍)**
- Web research and analysis
- Data gathering
- Summarization
- Competitive analysis

**Chief (👨‍💻)**
- Lead engineer for complex projects
- Uses GSD (Get Shit Done) methodology
- Breaks down projects into phases
- Spawns sub-agents for execution

**How It Works:**
1. Create a task in Kanban
2. Assign to appropriate agent
3. Agent receives task context and spawns
4. Agent executes work and logs progress
5. Task moves to Review when complete
6. You review and approve deliverables

**Monitoring:**
- View active agent sessions in Agents panel (⌘6)
- Check task activity logs for progress updates
- Agents log all actions for full transparency`,
    keywords: ['agent', 'coder', 'writer', 'researcher', 'chief', 'ai', 'spawn', 'assign'],
    relatedTo: ['agents', 'kanban'],
    videoUrl: 'https://example.com/agents-explained',
    lastUpdated: '2026-01-28'
  },

  // Voice Chat
  {
    id: 'voice-chat',
    title: 'Voice Chat',
    category: 'Voice',
    content: `Voice Chat (⌘8) provides real-time bidirectional voice conversations with agents via Gemini Live.

**Features:**
- Select any agent to talk to
- Real-time audio streaming (speak and hear responses)
- Camera and screen sharing support
- Text input during calls
- Tool calling (create tasks, spawn agents, check status)
- Full conversation history per agent

**How to use:**
1. Select an agent from the dropdown
2. Press the call button to connect
3. Speak naturally — the agent hears and responds in real-time
4. Use camera/screen share buttons during a call for visual context
5. Press end call when done

**Privacy:**
All transcription runs locally on your device using Vosk. No cloud processing.`,
    keywords: ['voice', 'speech', 'transcription', 'vosk', 'meeting', 'audio', 'microphone', 'tts'],
    relatedTo: ['voice'],
    videoUrl: 'https://example.com/voice-assistant',
    lastUpdated: '2026-01-28'
  },

  // Chat
  {
    id: 'chat-panel',
    title: 'Chat with Froggo',
    category: 'Chat',
    content: `Chat panel (⌘9) for direct conversation with Froggo.

**How to Use:**
- Type naturally - no special commands needed
- Froggo understands context from your workspace
- Reference tasks, contacts, calendar events, etc.
- Froggo can perform actions (create tasks, send messages, etc.)

**Message Actions:**
- Edit messages before sending
- Copy responses
- Regenerate if you want a different answer
- Export conversation history

**Tips:**
- Be specific about what you want
- Froggo can see your calendar, tasks, and inbox
- Ask Froggo to explain features or troubleshoot
- Use "Froggo, can you..." for polite requests

**Context Awareness:**
Froggo has access to:
- Your task board and projects
- Calendar and upcoming meetings
- Recent emails and messages
- Agent activity
- System status`,
    keywords: ['chat', 'conversation', 'talk', 'message', 'ask', 'froggo', 'ai'],
    relatedTo: ['chat'],
    lastUpdated: '2026-01-28'
  },

  // X/Twitter
  {
    id: 'twitter-panel',
    title: 'Social Media Integration',
    category: 'Social Media',
    content: `The X panel (⌘7) manages your Twitter presence.

**Features:**
- Compose new tweets
- View mentions and replies
- Schedule tweets for later
- Check engagement stats
- Search your timeline

**Compose Tweet:**
1. Press ⌘N or click "New Tweet"
2. Write your tweet (280 chars)
3. Add media if desired
4. Option to schedule for later
5. Submit for approval (goes to Inbox)

**Smart Scheduling:**
- Content calendar suggests optimal posting times
- Queue multiple tweets
- Agent can compose tweets from task instructions

**Safety:**
All tweets require approval before posting (unless auto-approval enabled in Settings).

**Keyboard Shortcuts:**
- ⌘N: New tweet
- ⌘Enter: Send/submit
- ⌘⇧R: Retweet
- ⌘L: Like`,
    keywords: ['twitter', 'x', 'tweet', 'social', 'post', 'mentions', 'timeline'],
    relatedTo: ['twitter'],
    lastUpdated: '2026-01-28'
  },

  // Keyboard Shortcuts
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts Reference',
    category: 'Productivity',
    content: `Master these keyboard shortcuts for maximum efficiency.

**Navigation (⌘1-9):**
- ⌘1: Inbox (Communications)
- ⌘2: Dashboard
- ⌘3: Analytics
- ⌘4: Tasks (Kanban)
- ⌘5: Agents
- ⌘6: Social Media
- ⌘7: Voice
- ⌘8: Chat
- ⌘9: Connected Accounts
- ⌘0: Approvals

**Global Actions:**
- ⌘K: Global search
- ⌘P: Command palette
- ⌘?: Keyboard shortcuts help
- ⌘,: Settings
- ⌘M: Toggle mute
- ⌘N: New (context-aware)
- ⌘S: Save/submit

**Appearance & Navigation:**
- ⌘⇧D: Toggle dark/light mode (quick theme switch)
- ⌥↑: Scroll up
- ⌥↓: Scroll down
- ⌥⇞: Scroll page up
- ⌥⇟: Scroll page down

**Quick Actions:**
- ⌘⇧M: Quick message
- ⌘⇧N: Add contact
- ⌘⇧K: Add skill
- ⌘⇧S: Starred messages

**Task Management:**
- N: New task
- ⌘I: Task info
- ⌘Enter: Complete
- ⌘B: Bookmark

**Inbox Navigation:**
- J: Next item
- K: Previous item
- A: Approve
- R: Reject
- X: Defer

Press ⌘? anytime to view the full shortcut reference.`,
    keywords: ['keyboard', 'shortcuts', 'hotkey', 'keys', 'navigation', 'productivity', 'theme', 'scroll'],
    lastUpdated: '2026-01-30'
  },

  // Theme Toggle & Scroll Navigation
  {
    id: 'theme-scroll-hotkeys',
    title: 'Theme Toggle & Scroll Navigation',
    category: 'Productivity',
    content: `Quickly switch themes and navigate without using your mouse.

**Theme Toggle (⌘⇧D):**
Press ⌘⇧D (Cmd+Shift+D) to instantly toggle between dark and light mode. This works from any page and shows a toast notification confirming the change.

**Why use it?**
- Quick testing of light/dark mode designs
- Switch based on time of day or lighting conditions
- No need to open Settings panel
- Works everywhere in the app

**Scroll Navigation (⌥ + Arrows):**
Use Option/Alt key with arrow keys to scroll through content:
- ⌥↑ (Option+Up): Scroll up smoothly
- ⌥↓ (Option+Down): Scroll down smoothly
- ⌥⇞ (Option+Page Up): Scroll up by page
- ⌥⇟ (Option+Page Down): Scroll down by page

**Why use it?**
- Keyboard-only navigation
- Precise scrolling without mouse/trackpad
- Faster than reaching for mouse
- Smooth scroll animation for comfort

**Pro Tips:**
- Use theme toggle during screen sharing to improve visibility
- Combine scroll navigation with other keyboard shortcuts for full hands-on-keyboard workflow
- Theme preference is saved automatically
- Scroll amount is optimized for readability

These features are designed for power users who prefer keyboard navigation and frequent testing workflows.`,
    keywords: ['theme', 'dark', 'light', 'toggle', 'scroll', 'navigation', 'keyboard', 'hotkey', 'accessibility'],
    relatedTo: ['settings', 'dashboard'],
    lastUpdated: '2026-01-30'
  },

  // Settings
  {
    id: 'settings-customization',
    title: 'Settings & Customization',
    category: 'Customization',
    content: `Customize Froggo to your preferences (⌘,).

**Appearance:**
- Theme: Dark, Light, or System
- Accent color: Choose your brand color
- Default panel: Set startup view
- Sidebar order: Rearrange panels

**Accounts:**
- Connect Google Calendar
- Add email accounts
- Link social media
- Configure webhooks

**Automation:**
- Auto-approval rules
- Scheduled tasks
- Agent triggers
- Notification preferences

**Privacy & Security:**
- Voice transcription (local only)
- Data retention policies
- Export your data
- Session management

**Integrations:**
- GitHub, GitLab
- Slack, Discord, Telegram
- Notion, Linear
- Custom webhooks

Settings sync across devices when logged in.`,
    keywords: ['settings', 'preferences', 'customize', 'theme', 'appearance', 'config'],
    relatedTo: ['settings'],
    lastUpdated: '2026-01-28'
  }
];

export const faqs: FAQItem[] = [
  {
    id: 'faq-what-is-froggo',
    question: 'What is Froggo?',
    answer: 'Froggo is an AI-powered productivity dashboard that orchestrates specialized agents to handle your tasks, manage communications, and keep you organized. Think of it as your personal AI chief of staff.',
    category: 'General',
    keywords: ['what', 'about', 'froggo', 'intro']
  },
  {
    id: 'faq-agents-vs-manual',
    question: 'When should I use an agent vs. doing it myself?',
    answer: 'Use agents for: repetitive tasks, research-heavy work, code generation, content creation, and anything that benefits from AI assistance. Do it yourself for: creative decisions, sensitive communications, strategic planning, and anything requiring personal judgment.',
    category: 'Agents',
    keywords: ['agent', 'when', 'use', 'vs', 'manual']
  },
  {
    id: 'faq-approval-required',
    question: 'Why do tweets and emails need approval?',
    answer: 'Safety first! Agents can make mistakes, so all external communications require your review. You can enable auto-approval for trusted content types in Settings > Automation.',
    category: 'Inbox',
    keywords: ['approval', 'why', 'review', 'tweet', 'email']
  },
  {
    id: 'faq-task-stuck',
    question: 'My task is stuck "In Progress" - what happened?',
    answer: 'If a task is stuck, the agent may have encountered an error or lost context. Check the task activity log for details. You can manually reset the task to "Todo" and respawn the agent, or ask Froggo in Chat to investigate.',
    category: 'Tasks',
    keywords: ['stuck', 'task', 'in progress', 'agent', 'not moving']
  },
  {
    id: 'faq-voice-not-working',
    question: 'Voice transcription isn\'t working',
    answer: 'Check: 1) Microphone permissions in browser, 2) Correct microphone selected in Voice settings, 3) Vosk model downloaded (should auto-download). If still broken, check browser console for errors.',
    category: 'Voice',
    keywords: ['voice', 'not working', 'microphone', 'transcription', 'broken']
  },
  {
    id: 'faq-keyboard-shortcuts',
    question: 'How do I see all keyboard shortcuts?',
    answer: 'Press ⌘? (Cmd+Shift+/) to open the keyboard shortcuts reference. You can also find them in Settings > Keyboard.',
    category: 'Productivity',
    keywords: ['keyboard', 'shortcuts', 'hotkeys', 'how']
  },
  {
    id: 'faq-data-privacy',
    question: 'Where is my data stored?',
    answer: 'All data is stored locally in SQLite databases on your machine. Voice transcription runs locally using Vosk (no cloud). Agent conversations go through the Clawdbot gateway but are not stored externally. You own your data.',
    category: 'Privacy',
    keywords: ['data', 'privacy', 'storage', 'security', 'where']
  },
  {
    id: 'faq-agent-cost',
    question: 'Do agents cost money to run?',
    answer: 'Agents use the Claude API through Anthropic. Costs are minimal for typical usage (~$0.01-0.10 per task). You can monitor usage in Settings > API Usage.',
    category: 'Agents',
    keywords: ['cost', 'money', 'price', 'api', 'usage']
  },
  {
    id: 'faq-multiple-accounts',
    question: 'Can I connect multiple email/calendar accounts?',
    answer: 'Yes! Go to Settings > Connected Accounts (⌘0) to add multiple Google accounts, calendars, and email addresses. The dashboard will aggregate data from all connected sources.',
    category: 'Accounts',
    keywords: ['multiple', 'accounts', 'email', 'calendar', 'google']
  },
  {
    id: 'faq-mobile-app',
    question: 'Is there a mobile app?',
    answer: 'Not yet, but it\'s on the roadmap! For now, you can access Froggo via mobile browser (responsive design). Voice features work best on desktop.',
    category: 'General',
    keywords: ['mobile', 'app', 'phone', 'ios', 'android']
  },
  {
    id: 'faq-offline-mode',
    question: 'Does Froggo work offline?',
    answer: 'Partially. You can view cached data and use voice transcription offline. However, agent execution, chat, and API features require internet. Full offline mode is planned for future releases.',
    category: 'General',
    keywords: ['offline', 'internet', 'connection', 'work']
  },
  {
    id: 'faq-export-data',
    question: 'Can I export my data?',
    answer: 'Yes! Go to Settings > Data & Privacy > Export Data. You can export tasks, conversations, contacts, and all database contents as JSON or CSV.',
    category: 'Privacy',
    keywords: ['export', 'data', 'download', 'backup']
  }
];

export const quickTips: QuickTip[] = [
  {
    id: 'tip-command-palette',
    title: 'Use Command Palette',
    description: 'Press ⌘K to quickly navigate anywhere or perform actions without touching the mouse.',
    icon: '⚡'
  },
  {
    id: 'tip-task-subtasks',
    title: 'Break Down Complex Tasks',
    description: 'Add subtasks to complex projects. Agents work through them systematically.',
    icon: '📋'
  },
  {
    id: 'tip-voice-meeting',
    title: 'Use Voice for Meetings',
    description: 'Enable meeting eavesdrop mode to transcribe calls and auto-detect action items.',
    icon: '🎙️'
  },
  {
    id: 'tip-global-search',
    title: 'Search Everything',
    description: 'Global search (⌘K) finds tasks, contacts, messages, skills, and more instantly.',
    icon: '🔍'
  },
  {
    id: 'tip-agent-assignment',
    title: 'Assign the Right Agent',
    description: 'Coder for code, Writer for content, Researcher for analysis. Choose wisely!',
    icon: '🤖'
  },
  {
    id: 'tip-inbox-keyboard',
    title: 'Approve with Keyboard',
    description: 'Use J/K to navigate inbox and A/R to approve/reject. Lightning fast!',
    icon: '⌨️'
  },
  {
    id: 'tip-theme-toggle',
    title: 'Quick Theme Switch',
    description: 'Press ⌘⇧D to instantly toggle between dark and light mode. Perfect for testing or adjusting to lighting conditions!',
    icon: '🌓'
  },
  {
    id: 'tip-scroll-navigation',
    title: 'Keyboard Scrolling',
    description: 'Use ⌥↑/↓ (Option+Arrows) to scroll smoothly without touching your mouse. Full keyboard workflow!',
    icon: '⬆️'
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
