---
title: MCP Tools Reference
tags: [knowledge, mcp, tools]
updated: 2026-03-08
---

# MCP Tools Reference

## mission-control_db MCP
All agents have access to these tools via `mcp__mission-control_db__*`.

### Task Management
| Tool | Description |
|------|-------------|
| `mcp__mission-control_db__task_create` | Create a new task (`title`, `description`, `assignedTo`, `parentTaskId`, `priority`, `project`) |
| `mcp__mission-control_db__task_update` | Update a task (`id`, `status`, `progress`, `planningNotes`, `lastAgentUpdate`, `reviewerId`) |
| `mcp__mission-control_db__task_list` | List tasks with optional filters (`status`, `assignedTo`, `project`) |
| `mcp__mission-control_db__task_add_activity` | Log task activity (`taskId`, `agentId`, `message`, `action`) |
| `mcp__mission-control_db__subtask_create` | Create a subtask linked to a parent task |
| `mcp__mission-control_db__subtask_update` | Update a subtask status |

### Communication
| Tool | Description |
|------|-------------|
| `mcp__mission-control_db__chat_post` | Post to a chat room channel |
| `mcp__mission-control_db__chat_read` | Read messages from a channel |
| `mcp__mission-control_db__chat_rooms_list` | List available chat rooms |

### Approvals & Status
| Tool | Description |
|------|-------------|
| `mcp__mission-control_db__approval_create` | Create a human-approval request for external actions |
| `mcp__mission-control_db__approval_check` | Check status of an approval request |
| `mcp__mission-control_db__agent_status` | Get/set agent status |

## memory MCP
| Tool | Description |
|------|-------------|
| `mcp__memory__memory_write` | Write a memory note (`path`, `content`) |
| `mcp__memory__memory_search` | Search memory vault (`query`) — BM25/vector/hybrid |
| `mcp__memory__memory_recall` | Recent notes by topic + recency |
| `mcp__memory__memory_read` | Read a specific vault file by path |

## cron MCP
| Tool | Description |
|------|-------------|
| `mcp__cron__schedule_create` | Create a scheduled job |
| `mcp__cron__schedule_list` | List all scheduled jobs |

## Key Rules
- ALWAYS use `mcp__mission-control_db__task_*` for task management — NOT the built-in TaskCreate/TaskList tools
- NEVER skip `task_add_activity` — log every meaningful action
- External actions (tweets, emails, deploys, purchases) MUST use `mcp__mission-control_db__approval_create` first
- Memory writes go to `memory_write` — never write directly to vault files

## MCP Registration
MCP servers are registered in `~/mission-control/.claude/settings.json` and available in every agent session launched from that workspace directory.

## Related
- [[knowledge/task-lifecycle]]
- [[knowledge/architecture]]
