# Phase 21: Agent Session Architecture

## Problem

Every chat surface is a different hack. The main ChatPanel has decent sessions (SSE streaming, SOUL.md, MCP tools, message history). But:

- **TaskChatTab**: Has agent identity but zero task context (no planning notes, subtasks, acceptance criteria)
- **XAgentChatPane**: Stateless one-shot CLI calls, no real session continuity, 6 messages of fake "history"
- **ChatRoomView**: Multi-agent rooms work but agents have no shared memory
- **Library Assistant**: Stub with hardcoded responses
- **No memory injection**: Agent memory files (~/mission-control/memory/agents/{id}/) are never loaded
- **No knowledge base**: Agents can't search KB from chat (only via MCP tools in dispatched tasks)
- **No context compaction**: Long conversations degrade — no summarization, no smart context window management
- **Session keys inconsistent**: 5 different formats, no unified session model

## Goal

Unified session layer that all chat surfaces use. Every session has: agent identity (SOUL.md), conversation history (compacted), agent memory files, knowledge base access, task/surface context, and proper persistence.

## Phases

- [ ] **21.1: Unified Session Service** — Single server-side service that manages sessions across all surfaces
- [ ] **21.2: Memory + Knowledge Injection** — Load agent memory files + KB articles into every session
- [ ] **21.3: Context Compaction** — Intelligent conversation summarization when context grows large
- [ ] **21.4: Surface-Specific Context** — Task context injection, social tab data, room agent coordination
- [ ] **21.5: Session UI** — Session indicators, memory status, context usage, session management

## Phase Details

### Phase 21.1: Unified Session Service
**Goal**: Replace the 5 different chat implementations with one session service that all surfaces call.

The service handles:
- Session creation (key, agentId, surface type, metadata)
- Agent identity loading (SOUL.md from catalog/agents/{id}/)
- Message persistence (save/load from messages table)
- Conversation history assembly (last N messages, respecting context budget)
- Claude CLI invocation (--print for one-shot, --resume for persistent sessions)
- Response streaming (SSE for main chat, JSON for lightweight surfaces)

API: `POST /api/sessions/chat` — unified endpoint that replaces:
- `/api/agents/{id}/chat` (main ChatPanel)
- `/api/chat/generate-reply` (social module + task chat)

Session key format: `{surface}:{agentId}:{contextId}`
- `chat:designer:main` — 1-1 chat with designer
- `task:coder:task-abc123` — coder working on specific task
- `social:social-manager:pipeline` — social manager on pipeline tab
- `room:room-123:clara` — Clara in a chat room

**Plans**: 2

### Phase 21.2: Memory + Knowledge Injection
**Goal**: Every agent session has access to the agent's memory files and can search the knowledge base.

Memory injection:
- On session start, load `~/mission-control/memory/agents/{agentId}/` directory
- Read all .md files (sorted by modified date, newest first)
- Inject as structured context: "Your memory files:" + truncated content
- Budget: 2000 tokens for memory (compacted if larger)
- Memory protocol: after task completion, agent saves learnings to memory dir

Knowledge base injection:
- On session start, load top 3 relevant KB articles (by scope + recency)
- For social-manager: always include Voice & Style Guide
- For task sessions: include articles tagged with the task's project/tags
- Search endpoint: agent can request KB search mid-conversation via a tool-like pattern
- Budget: 1500 tokens for KB context

**Plans**: 2

### Phase 21.3: Context Compaction
**Goal**: When conversation grows beyond context budget, intelligently summarize older messages instead of dropping them.

Strategy:
- Context budget per session: ~40% of model context (leave room for agent response)
- When messages exceed budget: summarize oldest 70% into a 500-token summary
- Summary stored in session metadata (reused on next message)
- Running summary updates every 10 messages
- Critical information preserved: decisions made, files mentioned, errors encountered
- Use Gemini Flash Lite for summarization (cheap, fast, doesn't consume Claude context)

Session state machine:
- `fresh` → no history, full context available
- `active` → messages accumulating, within budget
- `compacting` → running summarization
- `compacted` → older messages summarized, summary + recent messages in context

**Plans**: 2

### Phase 21.4: Surface-Specific Context
**Goal**: Each chat surface injects the right context for its purpose.

Task chat context:
- Task title, description, planning notes, acceptance criteria
- Subtask list with completion status
- Recent task activity (last 10 entries)
- Related files (from task attachments)
- Project context (if task belongs to a project)

Social module context:
- Tab-specific live data (already implemented — move into session service)
- X account metrics (followers, recent performance)
- Pending mentions count, approval queue size
- Active automations status

Chat room context:
- Room topic/purpose
- List of participating agents with roles
- Shared decisions made in the room
- Pinned messages

1-1 chat context:
- Agent's current task (if busy)
- Agent's recent activity
- Agent's status and capabilities

**Plans**: 2

### Phase 21.5: Session UI
**Goal**: Users can see session state, memory usage, and manage sessions.

Session indicators:
- In chat header: show session age, message count, context usage %
- Memory badge: "3 memory files loaded" indicator
- KB badge: "2 KB articles in context" indicator
- Compaction indicator: "Conversation summarized" when compaction occurs

Session management:
- "New session" button — starts fresh (no history carry-over)
- "Export session" — download conversation as markdown
- Session list in settings — see all active sessions, delete old ones

**Plans**: 1

## Progress

| Phase | Plans | Status |
|-------|-------|--------|
| 21.1 Unified Session Service | 0/2 | Not started |
| 21.2 Memory + Knowledge | 0/2 | Not started |
| 21.3 Context Compaction | 0/2 | Not started |
| 21.4 Surface Context | 0/2 | Not started |
| 21.5 Session UI | 0/1 | Not started |
