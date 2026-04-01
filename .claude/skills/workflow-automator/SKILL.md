---
name: workflow-automator
description: How to create, edit, and manage Workflow Studio workflows programmatically via the API
---

# Workflow Automator Skill

## Overview
Workflow Studio is the platform's visual automation system. Agents can create, edit, execute, and manage workflows via the REST API at `/api/local/workflows`.

## API Endpoints

### List Workflows
```
GET /api/local/workflows?limit=50&offset=0
→ { workflows: WorkflowSummary[] }
```

### Create Workflow
```
POST /api/local/workflows
Body: { name: string, description?: string, state: SerializedWorkflow }
→ { id: string, name: string, ... }
```

### Update Workflow
```
PUT /api/local/workflows/:id
Body: { name?, description?, state?, is_deployed?: 0|1 }
→ WorkflowDetail
```

### Delete Workflow
```
DELETE /api/local/workflows/:id
```

### Execute Workflow
```
POST /api/local/workflows/:id/execute
Body: { input?: any }
→ { id: string, workflowId: string, status: string, result?: any }
```

### List Executions
```
GET /api/local/workflows/:id/executions?limit=50&offset=0
→ { executions: ExecutionResult[] }
```

## SerializedWorkflow Format

Every workflow is a JSON object with this structure:

```json
{
  "version": "1",
  "blocks": [
    {
      "id": "unique-string-id",
      "position": { "x": 100, "y": 200 },
      "config": {
        "tool": "block_type",
        "params": { /* block-specific parameters */ }
      },
      "inputs": {},
      "outputs": { "response": "string" },
      "metadata": {
        "id": "same-as-block-id",
        "name": "Human-readable name",
        "icon": "LucideIconName",
        "color": "#hexcolor",
        "category": "trigger|ai|logic|integration|data|utility"
      },
      "enabled": true
    }
  ],
  "connections": [
    { "source": "block-id", "target": "block-id" }
  ],
  "loops": {}
}
```

## Block Types Reference

### Triggers
| Type | Params |
|------|--------|
| `starter` | triggerType ("manual"\|"schedule"\|"webhook"\|"api"), schedule (cron), webhookPath |
| `generic_webhook` | webhookPath, method, secret |

### AI
| Type | Params |
|------|--------|
| `agent` | agentId (MC agent), model, systemPrompt, userPrompt, temperature, maxTokens |
| `thinking` | model, prompt, maxTokens |
| `openai` | model, systemPrompt, userPrompt, temperature, maxTokens |
| `evaluator` | criteria, rubric, model |
| `guardrails` | rules, action ("block"\|"warn"\|"retry") |

### Logic
| Type | Params |
|------|--------|
| `function` | code (JavaScript, use `$.input` for input data) |
| `condition` | condition (JS expression), trueLabel, falseLabel |
| `router` | condition, routes (JSON array of {value, label}) |

### Integrations
| Type | Params |
|------|--------|
| `api` | method, url, headers (JSON), body |
| `slack` | channel, message, webhookUrl |
| `discord` | webhookUrl, message, username |
| `gmail` | to, subject, body |
| `github` | action, repo, title, body |
| `notion` | action, databaseId, content |
| `telegram` | chatId, message, botToken |
| `x_twitter` | operation ("post_tweet"\|"search_tweets"\|"get_user"\|"reply"), content, query, username, replyToId, maxResults, bearerToken |

### Google Workspace (MCP)
| Type | Params |
|------|--------|
| `google_gmail` | operation, to, subject, body, query |
| `google_docs` | operation, title, documentId, content, searchQuery |
| `google_drive` | operation, query, folderId, fileId |
| `google_sheets` | operation, spreadsheetId, range, query |
| `google_calendar` | operation, calendarId, summary, startTime, endTime, description |

### MC Actions
| Type | Params |
|------|--------|
| `send_message` | to (agent ID or room), message |
| `create_task` | title, description, planningNotes, priority, assignTo, subtasks (newline-separated) |
| `assign_task` | taskId, agentId |
| `update_task_status` | taskId, status |
| `send_approval` | description, approvers (comma-separated) |
| `notify_agent` | agentId, message |
| `send_email_mc` | to, subject, body |
| `run_workflow` | workflowId, inputs (JSON) |
| `save_to_library` | folder, filename, content |

### Data
| Type | Params |
|------|--------|
| `search` | query, engine, maxResults |
| `knowledge` | collectionId, query, topK |
| `memory` | action, key, value |
| `table` | action, tableName, data/query |
| `file` | action, path, content |

### Utility
| Type | Params |
|------|--------|
| `wait` | duration, unit |
| `response` | outputKey, template |
| `note` | text |
| `variables` | action, key, value |
| `human_in_the_loop` | prompt, timeout |

## Variable References
- `{{input}}` — output from the previous block in the chain
- `{{blockId.response}}` — output from a specific block by its ID
- `$.input` — in function blocks (JavaScript context)

## Layout Guidelines
- Position blocks left-to-right, ~300px horizontal spacing
- Main flow at y: 200; branches at y: 100 and y: 300
- Always start with a trigger block at x: 100
- Use descriptive block IDs: "trigger-daily", "agent-analyze", "slack-notify"

## Example: Creating a Daily Report Workflow

```javascript
const workflow = {
  version: "1",
  blocks: [
    {
      id: "trigger-daily",
      position: { x: 100, y: 200 },
      config: { tool: "starter", params: { triggerType: "schedule", schedule: "0 9 * * 1-5" } },
      inputs: {}, outputs: { response: "string" },
      metadata: { id: "trigger-daily", name: "Daily 9am", icon: "Zap", color: "#22c55e", category: "trigger" },
      enabled: true
    },
    {
      id: "agent-report",
      position: { x: 400, y: 200 },
      config: { tool: "agent", params: { model: "claude-sonnet-4-20250514", systemPrompt: "Summarize team status.", userPrompt: "Generate today's team health report." } },
      inputs: {}, outputs: { response: "string" },
      metadata: { id: "agent-report", name: "Generate Report", icon: "Bot", color: "#a78bfa", category: "ai" },
      enabled: true
    },
    {
      id: "save-report",
      position: { x: 700, y: 200 },
      config: { tool: "save_to_library", params: { folder: "reports", filename: "daily-health-{{date}}.md", content: "{{input}}" } },
      inputs: {}, outputs: { response: "string" },
      metadata: { id: "save-report", name: "Save Report", icon: "FileText", color: "#14b8a6", category: "integration" },
      enabled: true
    }
  ],
  connections: [
    { source: "trigger-daily", target: "agent-report" },
    { source: "agent-report", target: "save-report" }
  ],
  loops: {}
};

// Create via API
const response = await fetch('/api/local/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Daily Team Health Report', state: workflow })
});
```

## Condition/Router Blocks
When using condition blocks, connections must specify `sourceHandle`:
```json
{ "source": "condition-1", "target": "success-handler", "sourceHandle": "true" },
{ "source": "condition-1", "target": "failure-handler", "sourceHandle": "false" }
```

## Best Practices
1. Always start with a trigger block
2. End with a response or save_to_library block
3. Use guardrails before sending external messages
4. Add human_in_the_loop before destructive actions
5. Use descriptive block names, not generic ones
6. Set `is_deployed: 1` only after testing
7. Fill in realistic params — don't leave placeholders
