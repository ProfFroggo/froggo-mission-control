---
title: System Architecture
tags: [knowledge, architecture, system]
updated: 2026-03-08
---

# Mission Control — System Architecture

## Mermaid Diagram

```mermaid
graph TD
    subgraph Git["Git Repository — ~/git/mission-control-nextjs"]
        APP["Next.js 15 App Router\n(src/, app/)"]
        MCP_DB["tools/mission-control-db-mcp/\nSQLite MCP Server\n11 tools: task_*, chat_*, approval_*"]
        MCP_MEM["tools/memory-mcp/\nObsidian MCP Server\n4 tools: search/recall/write/read"]
        HOOKS["tools/hooks/\napproval-hook.js (PreToolUse)\nreview-gate.js (PostToolUse)\nsession-sync.js (Stop)"]
        STREAM["app/api/agents/[id]/stream/\nSpawns claude CLI per message\n--print --output-format stream-json"]
    end

    subgraph UI["Web UI — localhost:3000"]
        CHATPANEL["ChatPanel.tsx\n1-on-1 agent chat"]
        ROOMVIEW["ChatRoomView.tsx\nMulti-agent rooms"]
        TASKBOARD["Task Board\nKanban pipeline"]
        APPROVALS["Approvals Queue\nTier 2/3 gating"]
    end

    subgraph Agents["Agents — ~/mission-control/agents/"]
        MC["mission-control/\nOrchestrator\nSOUL.md + MEMORY.md"]
        CODER["coder/\nSoftware Engineer\nSOUL.md + MEMORY.md"]
        CLARA["clara/\nQA + Review\nSOUL.md + MEMORY.md"]
        CHIEF["chief/\nStrategist\nSOUL.md + MEMORY.md"]
        HR["hr/\nAgent Creator\nSOUL.md + MEMORY.md"]
    end

    subgraph Vault["Obsidian Vault — ~/mission-control/"]
        MEM_KNOW["memory/knowledge/\ndecisions, gotchas, patterns"]
        MEM_DAILY["memory/daily/\ndaily progress notes"]
        MEM_SESS["memory/sessions/\nsession sync logs"]
        AG_MEM["agents/{id}/MEMORY.md\nper-agent memory"]
        LIBRARY["library/\nall agent deliverables\ncode/, docs/, design/"]
    end

    subgraph Data["Data — ~/mission-control/data/"]
        DB["mission-control.db\nSQLite WAL\ntasks, agents, sessions,\nchat, approvals, token_usage"]
    end

    subgraph Search["Search — QMD or ripgrep"]
        QMD["QMD (preferred)\nBM25 + vector + hybrid\ncollections: agents/memory/library/skills"]
        RG["ripgrep (fallback)\nFull-text search"]
    end

    subgraph CLI["Claude CLI"]
        RESUME["--resume SESSION_ID\nskips boot, fast"]
        NEW["--system-prompt SOUL.md\nnew session from HOME\nno CLAUDE.md boot"]
    end

    subgraph Settings["Settings — .claude/settings.json"]
        PROJ_SET["~/git/mission-control-nextjs/.claude/\nPermissions + MCP config"]
        MC_SET["~/mission-control/.claude/\nHooks: approval, review-gate, session-sync"]
    end

    %% Connections
    UI --> STREAM
    STREAM --> CLI
    CLI --> Agents
    Agents --> MCP_DB
    Agents --> MCP_MEM
    MCP_DB --> DB
    MCP_MEM --> Vault
    MCP_MEM --> QMD
    QMD --> Vault
    RG --> Vault
    HOOKS --> DB
    HOOKS --> Vault
    Settings --> CLI
    MC_SET --> HOOKS
    APP --> DB
    APP --> UI
    MCP_DB & MCP_MEM --> Git
```

## Key Flows

### Chat Message Flow
1. UI (ChatPanel) POST → `/api/agents/[id]/stream`
2. Route checks `globalThis._agentSessions` for existing session
3. If session exists → `claude --resume SESSION_ID` (fast, ~2s)
4. If new → `claude --print --system-prompt SOUL.md` from HOME (no boot sequence)
5. CLI streams JSON events → SSE to browser
6. Agent calls MCP tools mid-stream (task_*, memory_write, etc.)
7. On result event: session ID saved to DB + in-memory map
8. After every turn: agent writes to memory vault via `memory_write`

### Memory Write Flow
- Agent calls `mcp__memory__memory_write { category, title, content }`
- MCP routes: decision/gotcha/pattern → `memory/knowledge/`, daily → `memory/daily/`, agent → `agents/{id}/`
- QMD auto-indexes on next search or session-sync hook

### Task Pipeline
```
todo → internal-review → in-progress → agent-review → done
             ↕                              ↕
        human-review                  human-review
     (needs human input)         (external dependency)
```
- Clara gates `internal-review` before work begins
- `review-gate.js` hook fires on every task_update to trigger Clara review
- **`blocked` does not exist** — use `human-review` instead

## Core Directory Map

```
~/mission-control/
├── agents/          ← agent workspaces (SOUL, MEMORY, tasks, deliverables)
├── data/            ← SQLite DB (NOT indexed by search)
├── library/         ← all agent output files (indexed)
├── logs/            ← runtime logs (NOT indexed)
├── memory/          ← Obsidian vault core (indexed)
│   ├── knowledge/   ← decisions, gotchas, patterns, architecture
│   ├── daily/       ← daily progress notes
│   ├── sessions/    ← session sync logs from Stop hook
│   ├── agents/      ← agent memory files (Obsidian)
│   └── templates/   ← note templates
├── skills/          ← shared skill files (indexed)
└── .claude/         ← hooks config

~/git/mission-control-nextjs/
├── app/api/         ← Next.js API routes
├── src/components/  ← React UI components
├── src/store/       ← Zustand state
├── tools/
│   ├── mission-control-db-mcp/  ← SQLite MCP server
│   ├── memory-mcp/              ← Obsidian/QMD MCP server
│   └── hooks/                   ← Claude CLI hooks
└── .claude/settings.json        ← MCP + permissions config
```

## MCP Tools Available to All Agents

### mission-control_db
- `task_list`, `task_create`, `task_update`, `task_add_activity`
- `subtask_create`, `subtask_update`
- `chat_post`, `chat_read`, `chat_rooms_list`
- `approval_create`, `approval_check`
- `agent_status`

### memory
- `memory_search` — BM25/vector/hybrid across all of ~/mission-control/
- `memory_recall` — recent notes by topic + recency
- `memory_write` — write to vault (decision/gotcha/pattern/daily/agent)
- `memory_read` — read specific vault file by path
