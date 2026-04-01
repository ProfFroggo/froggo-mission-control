// Workflow Studio canvas state — Zustand store for the embedded editor
import { create } from 'zustand';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, Connection } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

// ---------- Types matching WS SerializedWorkflow format ----------

export interface BlockConfig {
  tool: string;
  params: Record<string, unknown>;
}

export interface SerializedBlock {
  id: string;
  position: { x: number; y: number };
  config: BlockConfig;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  metadata?: { id: string; name?: string; description?: string; category?: string; icon?: string; color?: string };
  enabled: boolean;
}

export interface SerializedConnection {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface SerializedWorkflow {
  version: string;
  blocks: SerializedBlock[];
  connections: SerializedConnection[];
  loops: Record<string, unknown>;
  parallels?: Record<string, unknown>;
}

export interface WorkflowMeta {
  id: string;
  name: string;
  description: string;
  color: string;
  is_deployed: boolean | number;
  run_count: number;
  created_at: string;
  updated_at: string;
}

// ---------- Block palette (what you can add) ----------

export interface BlockDefinition {
  type: string;
  name: string;
  category: 'trigger' | 'ai' | 'logic' | 'integration' | 'data' | 'utility';
  color: string;
  icon: string; // Lucide icon name
  description: string;
}

export const BLOCK_PALETTE: BlockDefinition[] = [
  // Triggers
  { type: 'starter', name: 'Trigger', category: 'trigger', color: '#22c55e', icon: 'Zap', description: 'Entry point — schedule, webhook, manual, or API' },
  { type: 'generic_webhook', name: 'Webhook Trigger', category: 'trigger', color: '#06b6d4', icon: 'Webhook', description: 'Receive webhooks from any service' },

  // AI
  { type: 'agent', name: 'AI Agent', category: 'ai', color: '#a78bfa', icon: 'Bot', description: 'Claude or LLM for text generation & reasoning' },
  { type: 'thinking', name: 'Thinking', category: 'ai', color: '#818cf8', icon: 'Brain', description: 'Chain-of-thought reasoning step' },
  { type: 'openai', name: 'OpenAI', category: 'ai', color: '#10b981', icon: 'Sparkles', description: 'GPT models for text generation' },
  { type: 'evaluator', name: 'Evaluator', category: 'ai', color: '#14b8a6', icon: 'CheckCircle', description: 'Score and evaluate output quality' },
  { type: 'guardrails', name: 'Guardrails', category: 'ai', color: '#ef4444', icon: 'Shield', description: 'Validate content with safety rules' },

  // Logic
  { type: 'function', name: 'Function', category: 'logic', color: '#60a5fa', icon: 'Code', description: 'JavaScript code for data transformation' },
  { type: 'condition', name: 'Condition', category: 'logic', color: '#fbbf24', icon: 'GitBranch', description: 'Branch execution with if/else' },
  { type: 'router', name: 'Router', category: 'logic', color: '#f59e0b', icon: 'Route', description: 'Multi-way conditional routing' },

  // Integration
  { type: 'api', name: 'API Request', category: 'integration', color: '#f97316', icon: 'Globe', description: 'HTTP request (GET, POST, PUT, DELETE)' },
  { type: 'slack', name: 'Slack', category: 'integration', color: '#e879f9', icon: 'MessageSquare', description: 'Send messages to Slack channels' },
  { type: 'discord', name: 'Discord', category: 'integration', color: '#5865f2', icon: 'MessageCircle', description: 'Send messages to Discord' },
  { type: 'gmail', name: 'Gmail', category: 'integration', color: '#fb7185', icon: 'Mail', description: 'Send emails via Gmail' },
  { type: 'smtp', name: 'SMTP Email', category: 'integration', color: '#f87171', icon: 'AtSign', description: 'Send email via SMTP server' },
  { type: 'webhook_request', name: 'Webhook Out', category: 'integration', color: '#22d3ee', icon: 'Webhook', description: 'Make outbound webhook calls' },
  { type: 'github', name: 'GitHub', category: 'integration', color: '#6b7280', icon: 'Github', description: 'GitHub API operations' },
  { type: 'notion', name: 'Notion', category: 'integration', color: '#64748b', icon: 'FileText', description: 'Create and update Notion pages' },
  { type: 'telegram', name: 'Telegram', category: 'integration', color: '#0ea5e9', icon: 'Send', description: 'Send Telegram messages' },
  { type: 'x_twitter', name: 'X / Twitter', category: 'integration', color: '#000000', icon: 'AtSign', description: 'Post tweets, search, and interact on X' },
  { type: 'google_gmail', name: 'Gmail (MCP)', category: 'integration', color: '#ea4335', icon: 'Mail', description: 'Send, search, read emails via Google MCP' },
  { type: 'google_docs', name: 'Google Docs (MCP)', category: 'integration', color: '#4285f4', icon: 'FileText', description: 'Create, read, edit Google Docs via MCP' },
  { type: 'google_drive', name: 'Google Drive (MCP)', category: 'integration', color: '#0f9d58', icon: 'HardDrive', description: 'Search and manage files in Google Drive' },
  { type: 'google_sheets', name: 'Google Sheets (MCP)', category: 'integration', color: '#0f9d58', icon: 'Table2', description: 'Read and write Google Sheets data' },
  { type: 'google_calendar', name: 'Google Calendar (MCP)', category: 'integration', color: '#4285f4', icon: 'Clock', description: 'Create, list, update calendar events' },

  // MC Actions
  { type: 'send_message', name: 'Send Message', category: 'integration', color: '#818cf8', icon: 'MessageSquare', description: 'Send a message to an agent or chat room' },
  { type: 'create_task', name: 'Create Task', category: 'integration', color: '#22c55e', icon: 'CheckCircle', description: 'Create a task with subtasks and assign to an agent' },
  { type: 'assign_task', name: 'Assign Task', category: 'integration', color: '#60a5fa', icon: 'ArrowRight', description: 'Assign an existing task to an agent' },
  { type: 'update_task_status', name: 'Update Task', category: 'integration', color: '#f59e0b', icon: 'CheckCircle', description: 'Update a task status (todo, in-progress, review, done)' },
  { type: 'send_approval', name: 'Send for Approval', category: 'integration', color: '#e879f9', icon: 'Shield', description: 'Route to the approval queue for human review' },
  { type: 'notify_agent', name: 'Notify Agent', category: 'integration', color: '#06b6d4', icon: 'Bot', description: 'Send a notification to a specific agent' },
  { type: 'send_email_mc', name: 'Send Email', category: 'integration', color: '#fb7185', icon: 'Mail', description: 'Send an email via the platform' },
  { type: 'run_workflow', name: 'Run Workflow', category: 'integration', color: '#a78bfa', icon: 'Workflow', description: 'Trigger another Workflow Studio workflow' },
  { type: 'save_to_library', name: 'Save to Library', category: 'integration', color: '#14b8a6', icon: 'FileText', description: 'Save output to the document library' },

  // Data
  { type: 'search', name: 'Web Search', category: 'data', color: '#f97316', icon: 'Search', description: 'Search the web for information' },
  { type: 'knowledge', name: 'Knowledge Base', category: 'data', color: '#06b6d4', icon: 'Database', description: 'Search and manage MC knowledge articles' },
  { type: 'memory', name: 'Memory Vault', category: 'data', color: '#8b5cf6', icon: 'HardDrive', description: 'Search Obsidian vault and store memories' },
  { type: 'table', name: 'Table', category: 'data', color: '#0ea5e9', icon: 'Table2', description: 'Data table operations' },
  { type: 'file', name: 'Library File', category: 'data', color: '#64748b', icon: 'File', description: 'Read/write files in MC library' },

  // Utility
  { type: 'wait', name: 'Delay', category: 'utility', color: '#94a3b8', icon: 'Clock', description: 'Wait before continuing' },
  { type: 'response', name: 'Response', category: 'utility', color: '#4ade80', icon: 'ArrowRight', description: 'Return output from workflow' },
  { type: 'note', name: 'Note', category: 'utility', color: '#fbbf24', icon: 'StickyNote', description: 'Documentation annotation' },
  { type: 'variables', name: 'Variables', category: 'utility', color: '#a78bfa', icon: 'Variable', description: 'Set and get workflow variables' },
  { type: 'human_in_the_loop', name: 'Human Input', category: 'utility', color: '#f97316', icon: 'Hand', description: 'Pause and wait for human input' },
];

export const BLOCK_CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'trigger', label: 'Triggers', color: '#22c55e' },
  { id: 'ai', label: 'AI', color: '#a78bfa' },
  { id: 'logic', label: 'Logic', color: '#60a5fa' },
  { id: 'integration', label: 'Integrations', color: '#f97316' },
  { id: 'data', label: 'Data', color: '#06b6d4' },
  { id: 'utility', label: 'Utility', color: '#94a3b8' },
];

// ---------- Block field definitions for the inspector ----------

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'code' | 'switch' | 'agent-select' | 'subtask-list';
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export const BLOCK_FIELDS: Record<string, FieldDef[]> = {
  starter: [
    { key: 'triggerType', label: 'Trigger Type', type: 'select', options: [
      { value: 'manual', label: 'Manual' },
      { value: 'schedule', label: 'Schedule' },
      { value: 'webhook', label: 'Webhook' },
      { value: 'api', label: 'API' },
    ], defaultValue: 'manual' },
    { key: 'schedule', label: 'Cron Expression', type: 'text', placeholder: '0 9 * * *  (daily at 9am)' },
    { key: 'webhookPath', label: 'Webhook Path', type: 'text', placeholder: '/webhook/my-trigger' },
  ],
  generic_webhook: [
    { key: 'webhookPath', label: 'Path', type: 'text', placeholder: '/webhook/my-endpoint' },
    { key: 'method', label: 'Method', type: 'select', options: [
      { value: 'POST', label: 'POST' },
      { value: 'GET', label: 'GET' },
      { value: 'PUT', label: 'PUT' },
    ], defaultValue: 'POST' },
    { key: 'secret', label: 'Secret (optional)', type: 'text', placeholder: 'Signing secret for verification' },
  ],
  agent: [
    { key: 'agentId', label: 'MC Agent', type: 'agent-select', placeholder: 'Select an agent or use a model directly' },
    { key: 'model', label: 'Model', type: 'select', options: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
      { value: 'MiniMax-M1', label: 'MiniMax M1' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    ], defaultValue: 'claude-sonnet-4-20250514' },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant that...' },
    { key: 'userPrompt', label: 'User Prompt', type: 'textarea', placeholder: 'Analyze the following data: {{input}}' },
    { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: '0.7' },
    { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: '4096' },
  ],
  thinking: [
    { key: 'model', label: 'Model', type: 'select', options: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    ], defaultValue: 'claude-sonnet-4-20250514' },
    { key: 'prompt', label: 'Thinking Prompt', type: 'textarea', placeholder: 'Reason step by step about {{input}}' },
    { key: 'maxTokens', label: 'Budget Tokens', type: 'number', defaultValue: '8192' },
  ],
  openai: [
    { key: 'model', label: 'Model', type: 'select', options: [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ], defaultValue: 'gpt-4o' },
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are...' },
    { key: 'userPrompt', label: 'User Prompt', type: 'textarea', placeholder: '{{input}}' },
    { key: 'temperature', label: 'Temperature', type: 'number', defaultValue: '0.7' },
    { key: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: '4096' },
  ],
  evaluator: [
    { key: 'criteria', label: 'Evaluation Criteria', type: 'textarea', placeholder: 'Rate the quality of the response on a scale of 1-10...' },
    { key: 'rubric', label: 'Rubric', type: 'textarea', placeholder: 'Define scoring rubric...' },
    { key: 'model', label: 'Model', type: 'select', options: [
      { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { value: 'gpt-4o', label: 'GPT-4o' },
    ], defaultValue: 'claude-sonnet-4-20250514' },
  ],
  guardrails: [
    { key: 'rules', label: 'Safety Rules', type: 'textarea', placeholder: 'No PII allowed\nNo harmful content\nMust be factual' },
    { key: 'action', label: 'On Violation', type: 'select', options: [
      { value: 'block', label: 'Block output' },
      { value: 'warn', label: 'Warn and pass' },
      { value: 'retry', label: 'Retry generation' },
    ], defaultValue: 'block' },
  ],
  function: [
    { key: 'code', label: 'JavaScript Code', type: 'code', placeholder: '// Transform input data\nconst input = $.input;\n\nreturn {\n  result: input\n};', defaultValue: '// Transform input data\nconst input = $.input;\n\nreturn {\n  result: input\n};' },
  ],
  condition: [
    { key: 'condition', label: 'Condition', type: 'textarea', placeholder: '$.input.status === "success"' },
    { key: 'trueLabel', label: 'True Branch Label', type: 'text', placeholder: 'Success', defaultValue: 'True' },
    { key: 'falseLabel', label: 'False Branch Label', type: 'text', placeholder: 'Failure', defaultValue: 'False' },
  ],
  router: [
    { key: 'condition', label: 'Routing Expression', type: 'textarea', placeholder: '$.input.type' },
    { key: 'routes', label: 'Routes (JSON array)', type: 'textarea', placeholder: '[\n  { "value": "typeA", "label": "Route A" },\n  { "value": "typeB", "label": "Route B" }\n]' },
  ],
  api: [
    { key: 'method', label: 'Method', type: 'select', options: [
      { value: 'GET', label: 'GET' },
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
      { value: 'PATCH', label: 'PATCH' },
      { value: 'DELETE', label: 'DELETE' },
    ], defaultValue: 'GET' },
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/endpoint' },
    { key: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{\n  "Authorization": "Bearer {{apiKey}}"\n}' },
    { key: 'body', label: 'Request Body', type: 'textarea', placeholder: '{\n  "key": "value"\n}' },
  ],
  slack: [
    { key: 'channel', label: 'Channel', type: 'text', placeholder: '#general' },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Hello from Workflow Studio! {{input}}' },
    { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/...' },
  ],
  discord: [
    { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://discord.com/api/webhooks/...' },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: '{{input}}' },
    { key: 'username', label: 'Bot Name', type: 'text', placeholder: 'Workflow Bot' },
  ],
  gmail: [
    { key: 'to', label: 'To', type: 'text', placeholder: 'user@example.com' },
    { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Workflow Report: {{date}}' },
    { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Hi,\n\nHere is your report...\n\n{{input}}' },
  ],
  smtp: [
    { key: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'Port', type: 'number', defaultValue: '587' },
    { key: 'to', label: 'To', type: 'text', placeholder: 'user@example.com' },
    { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Subject line' },
    { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email body...' },
  ],
  webhook_request: [
    { key: 'url', label: 'Webhook URL', type: 'text', placeholder: 'https://example.com/webhook' },
    { key: 'method', label: 'Method', type: 'select', options: [
      { value: 'POST', label: 'POST' },
      { value: 'PUT', label: 'PUT' },
    ], defaultValue: 'POST' },
    { key: 'payload', label: 'Payload', type: 'textarea', placeholder: '{\n  "event": "workflow_complete",\n  "data": {{input}}\n}' },
  ],
  github: [
    { key: 'action', label: 'Action', type: 'select', options: [
      { value: 'create-issue', label: 'Create Issue' },
      { value: 'create-pr', label: 'Create Pull Request' },
      { value: 'add-comment', label: 'Add Comment' },
      { value: 'list-issues', label: 'List Issues' },
    ], defaultValue: 'create-issue' },
    { key: 'repo', label: 'Repository', type: 'text', placeholder: 'owner/repo' },
    { key: 'title', label: 'Title', type: 'text', placeholder: 'Issue title' },
    { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Description...' },
  ],
  notion: [
    { key: 'action', label: 'Action', type: 'select', options: [
      { value: 'create-page', label: 'Create Page' },
      { value: 'update-page', label: 'Update Page' },
      { value: 'query-database', label: 'Query Database' },
    ], defaultValue: 'create-page' },
    { key: 'databaseId', label: 'Database ID', type: 'text', placeholder: 'Notion database ID' },
    { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Page content or query...' },
  ],
  telegram: [
    { key: 'chatId', label: 'Chat ID', type: 'text', placeholder: '-100123456789' },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: '{{input}}' },
    { key: 'botToken', label: 'Bot Token', type: 'text', placeholder: '123456:ABC-...' },
  ],
  send_message: [
    { key: 'to', label: 'To (Agent)', type: 'agent-select' },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Message content...\n\n{{input}}' },
  ],
  create_task: [
    { key: 'title', label: 'Task Title', type: 'text', placeholder: 'HR: Daily Report — {{date}}' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What needs to be done...' },
    { key: 'planningNotes', label: 'Planning Notes', type: 'textarea', placeholder: 'Step-by-step approach for the agent...' },
    { key: 'priority', label: 'Priority', type: 'select', options: [
      { value: 'p0', label: 'P0 — Critical' },
      { value: 'p1', label: 'P1 — High' },
      { value: 'p2', label: 'P2 — Medium' },
      { value: 'p3', label: 'P3 — Low' },
    ], defaultValue: 'p2' },
    { key: 'assignTo', label: 'Assign To', type: 'agent-select' },
    { key: 'subtasks', label: 'Subtasks', type: 'subtask-list' },
  ],
  assign_task: [
    { key: 'taskId', label: 'Task ID', type: 'text', placeholder: 'task-xxx or {{input.taskId}}' },
    { key: 'agentId', label: 'Agent', type: 'agent-select' },
  ],
  update_task_status: [
    { key: 'taskId', label: 'Task ID', type: 'text', placeholder: 'task-xxx or {{input.taskId}}' },
    { key: 'status', label: 'New Status', type: 'select', options: [
      { value: 'todo', label: 'Todo' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'review', label: 'Review' },
      { value: 'done', label: 'Done' },
    ], defaultValue: 'in-progress' },
  ],
  send_approval: [
    { key: 'description', label: 'What needs approval?', type: 'textarea', placeholder: 'Please review and approve...\n\n{{input}}' },
    { key: 'approvers', label: 'Approvers (comma-separated)', type: 'text', placeholder: 'kevin, clara...' },
  ],
  notify_agent: [
    { key: 'agentId', label: 'Agent', type: 'agent-select' },
    { key: 'message', label: 'Notification Message', type: 'textarea', placeholder: 'Hey, {{input}}...' },
  ],
  send_email_mc: [
    { key: 'to', label: 'To', type: 'text', placeholder: 'recipient@example.com' },
    { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject' },
    { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email body...\n\n{{input}}' },
  ],
  run_workflow: [
    { key: 'workflowId', label: 'Workflow ID', type: 'text', placeholder: 'Workflow Studio workflow ID' },
    { key: 'inputs', label: 'Inputs (JSON)', type: 'textarea', placeholder: '{\n  "key": "value"\n}' },
  ],
  save_to_library: [
    { key: 'folder', label: 'Folder', type: 'text', placeholder: 'reports, research, generated-content...' },
    { key: 'filename', label: 'Filename (optional)', type: 'text', placeholder: 'report-{date}.md — auto-generated if empty' },
    { key: 'content', label: 'Content', type: 'textarea', placeholder: '{{input}}' },
  ],
  google_gmail: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'send', label: 'Send Email' },
      { value: 'search', label: 'Search Emails' },
      { value: 'get', label: 'Get Email' },
      { value: 'createDraft', label: 'Create Draft' },
      { value: 'listLabels', label: 'List Labels' },
    ], defaultValue: 'send' },
    { key: 'to', label: 'To', type: 'text', placeholder: 'user@example.com' },
    { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject' },
    { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email body content...\n\n{{input}}' },
    { key: 'query', label: 'Search Query', type: 'text', placeholder: 'from:someone@example.com subject:report' },
  ],
  google_docs: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'create', label: 'Create Document' },
      { value: 'getText', label: 'Get Text' },
      { value: 'appendText', label: 'Append Text' },
      { value: 'insertText', label: 'Insert Text' },
      { value: 'replaceText', label: 'Find & Replace' },
      { value: 'find', label: 'Find Document' },
    ], defaultValue: 'create' },
    { key: 'title', label: 'Document Title', type: 'text', placeholder: 'My Document' },
    { key: 'documentId', label: 'Document ID or URL', type: 'text', placeholder: 'Paste Google Doc URL or ID' },
    { key: 'content', label: 'Content', type: 'textarea', placeholder: '{{input}}' },
    { key: 'searchQuery', label: 'Search Query', type: 'text', placeholder: 'quarterly report' },
  ],
  google_drive: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'search', label: 'Search Files' },
      { value: 'findFolder', label: 'Find Folder' },
      { value: 'download', label: 'Download File' },
    ], defaultValue: 'search' },
    { key: 'query', label: 'Search Query', type: 'text', placeholder: 'name contains "report"' },
    { key: 'folderId', label: 'Folder ID', type: 'text', placeholder: 'Google Drive folder ID' },
    { key: 'fileId', label: 'File ID', type: 'text', placeholder: 'Google Drive file ID' },
  ],
  google_sheets: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'getRange', label: 'Read Range' },
      { value: 'getText', label: 'Get All Text' },
      { value: 'getMetadata', label: 'Get Metadata' },
      { value: 'find', label: 'Find Spreadsheet' },
    ], defaultValue: 'getRange' },
    { key: 'spreadsheetId', label: 'Spreadsheet ID or URL', type: 'text', placeholder: 'Paste Sheets URL or ID' },
    { key: 'range', label: 'Range', type: 'text', placeholder: 'Sheet1!A1:D10' },
    { key: 'query', label: 'Search Query', type: 'text', placeholder: 'budget 2026' },
  ],
  google_calendar: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'listEvents', label: 'List Events' },
      { value: 'createEvent', label: 'Create Event' },
      { value: 'findFreeTime', label: 'Find Free Time' },
      { value: 'getEvent', label: 'Get Event' },
      { value: 'deleteEvent', label: 'Delete Event' },
    ], defaultValue: 'listEvents' },
    { key: 'calendarId', label: 'Calendar ID', type: 'text', placeholder: 'primary', defaultValue: 'primary' },
    { key: 'summary', label: 'Event Title', type: 'text', placeholder: 'Team Meeting' },
    { key: 'startTime', label: 'Start Time', type: 'text', placeholder: '2026-04-01T10:00:00' },
    { key: 'endTime', label: 'End Time', type: 'text', placeholder: '2026-04-01T11:00:00' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Meeting agenda...' },
  ],
  x_twitter: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'post_tweet', label: 'Post Tweet' },
      { value: 'search_tweets', label: 'Search Tweets' },
      { value: 'get_user', label: 'Get User Profile' },
      { value: 'reply', label: 'Reply to Tweet' },
    ], defaultValue: 'post_tweet' },
    { key: 'content', label: 'Tweet Content', type: 'textarea', placeholder: '{{input}}' },
    { key: 'query', label: 'Search Query', type: 'text', placeholder: 'keyword OR from:username' },
    { key: 'username', label: 'Username', type: 'text', placeholder: 'elonmusk' },
    { key: 'replyToId', label: 'Reply to Tweet ID', type: 'text', placeholder: '1234567890' },
    { key: 'maxResults', label: 'Max Results', type: 'number', defaultValue: '10' },
    { key: 'bearerToken', label: 'Bearer Token (optional)', type: 'text', placeholder: 'Falls back to x_bearer_token from Settings' },
  ],
  search: [
    { key: 'query', label: 'Search Query', type: 'text', placeholder: '{{input}}' },
    { key: 'engine', label: 'Engine', type: 'select', options: [
      { value: 'google', label: 'Google' },
      { value: 'perplexity', label: 'Perplexity' },
      { value: 'tavily', label: 'Tavily' },
    ], defaultValue: 'google' },
    { key: 'maxResults', label: 'Max Results', type: 'number', defaultValue: '5' },
  ],
  knowledge: [
    { key: 'operation', label: 'Operation', type: 'select', options: [
      { value: 'search', label: 'Search Articles (FTS)' },
      { value: 'list', label: 'List Articles' },
      { value: 'get', label: 'Get Article by ID' },
      { value: 'create', label: 'Create Article' },
      { value: 'update', label: 'Update Article' },
      { value: 'delete', label: 'Delete Article' },
    ], defaultValue: 'search' },
    { key: 'query', label: 'Search Query', type: 'text', placeholder: '{{input}}' },
    { key: 'category', label: 'Category', type: 'text', placeholder: 'general' },
    { key: 'scope', label: 'Scope', type: 'text', placeholder: 'all' },
    { key: 'articleId', label: 'Article ID (for get/update/delete)', type: 'text', placeholder: '' },
    { key: 'title', label: 'Title (for create/update)', type: 'text', placeholder: 'Article Title' },
    { key: 'content', label: 'Content (for create/update)', type: 'textarea', placeholder: '{{input}}' },
    { key: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'tag1, tag2' },
  ],
  memory: [
    { key: 'action', label: 'Action', type: 'select', options: [
      { value: 'search', label: 'Search Vault (Obsidian)' },
      { value: 'read', label: 'Read from Cache' },
      { value: 'write', label: 'Write to Vault' },
      { value: 'clear', label: 'Clear from Cache' },
    ], defaultValue: 'search' },
    { key: 'query', label: 'Search Query / Key', type: 'text', placeholder: '{{input}}' },
    { key: 'value', label: 'Value (for write)', type: 'textarea', placeholder: '{{input}}' },
    { key: 'mode', label: 'Search Mode', type: 'select', options: [
      { value: 'search', label: 'Full-text (BM25)' },
      { value: 'vsearch', label: 'Vector Search' },
      { value: 'query', label: 'Natural Language Query' },
    ], defaultValue: 'search' },
    { key: 'limit', label: 'Max Results', type: 'number', defaultValue: '10' },
  ],
  table: [
    { key: 'action', label: 'Action', type: 'select', options: [
      { value: 'read', label: 'Read / Pass-through' },
      { value: 'write', label: 'Write JSON' },
      { value: 'query', label: 'Filter / Transform' },
      { value: 'merge', label: 'Merge Block Outputs' },
    ], defaultValue: 'read' },
    { key: 'data', label: 'Data / JSON', type: 'textarea', placeholder: '{"column": "value"}' },
    { key: 'query', label: 'Query Expression (for filter)', type: 'code', placeholder: 'rows.filter(r => r.status === "active")' },
    { key: 'sources', label: 'Block IDs to merge (comma-separated)', type: 'text', placeholder: 'block-1, block-2' },
  ],
  file: [
    { key: 'action', label: 'Action', type: 'select', options: [
      { value: 'read', label: 'Read File' },
      { value: 'write', label: 'Write / Append File' },
      { value: 'list', label: 'List Files' },
      { value: 'list-folders', label: 'List Folders' },
      { value: 'delete', label: 'Delete File' },
    ], defaultValue: 'read' },
    { key: 'path', label: 'File Path (relative to library)', type: 'text', placeholder: 'workflow-output/report.md' },
    { key: 'content', label: 'Content (for write)', type: 'textarea', placeholder: '{{input}}' },
    { key: 'category', label: 'Category filter (for list)', type: 'text', placeholder: '' },
    { key: 'limit', label: 'Max Results (for list)', type: 'number', defaultValue: '20' },
  ],
  wait: [
    { key: 'duration', label: 'Duration (seconds)', type: 'number', defaultValue: '5' },
  ],
  response: [
    { key: 'outputKey', label: 'Output Key', type: 'text', placeholder: 'result', defaultValue: 'result' },
    { key: 'template', label: 'Response Template', type: 'textarea', placeholder: '{{input}}' },
  ],
  note: [
    { key: 'content', label: 'Note', type: 'textarea', placeholder: 'Add documentation or notes here...' },
  ],
  variables: [
    { key: 'action', label: 'Action', type: 'select', options: [
      { value: 'set', label: 'Set Variable' },
      { value: 'get', label: 'Get Variable' },
    ], defaultValue: 'set' },
    { key: 'name', label: 'Variable Name', type: 'text', placeholder: 'myVar' },
    { key: 'value', label: 'Value', type: 'textarea', placeholder: '{{input}}' },
  ],
  human_in_the_loop: [
    { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Please review the following and approve:\n\n{{input}}' },
    { key: 'timeout', label: 'Timeout (seconds)', type: 'number', defaultValue: '3600' },
  ],
};

// ---------- Helpers: serialisation <-> ReactFlow ----------

export function workflowToFlow(wf: SerializedWorkflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (wf.blocks ?? []).map((b) => ({
    id: b.id,
    type: 'workflowBlock',
    position: b.position,
    data: { ...b },
  }));
  const edges: Edge[] = (wf.connections ?? []).map((c, i) => ({
    id: `e-${c.source}-${c.target}-${i}`,
    source: c.source,
    target: c.target,
    sourceHandle: c.sourceHandle,
    targetHandle: c.targetHandle,
    type: 'smoothstep',
    animated: true,
    style: { stroke: 'var(--mission-control-border)', strokeWidth: 2 },
  }));
  return { nodes, edges };
}

export function flowToWorkflow(nodes: Node[], edges: Edge[]): SerializedWorkflow {
  const blocks: SerializedBlock[] = nodes.map((n) => {
    const d = n.data as Record<string, any>;
    return {
      id: n.id,
      position: n.position,
      config: d.config ?? { tool: d.type ?? 'function', params: {} },
      inputs: d.inputs ?? {},
      outputs: d.outputs ?? {},
      metadata: d.metadata ?? { id: n.id, name: d.name ?? n.id },
      enabled: d.enabled ?? true,
    };
  });
  const connections: SerializedConnection[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }));
  return { version: '1', blocks, connections, loops: {}, parallels: {} };
}

// ---------- Store ----------

export type BlockExecStatus = 'idle' | 'running' | 'completed' | 'errored';

interface CanvasState {
  // Data
  workflowId: string | null;
  workflowMeta: WorkflowMeta | null;
  nodes: Node[];
  edges: Edge[];
  dirty: boolean;

  // Execution
  executing: boolean;
  lastExecutionId: string | null;
  blockExecStates: Record<string, BlockExecStatus>;

  // UI
  selectedBlockId: string | null;
  showBlockPalette: boolean;

  // Actions
  setWorkflow: (id: string, meta: WorkflowMeta, wf: SerializedWorkflow) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addBlock: (def: BlockDefinition, position?: { x: number; y: number }) => string;
  removeBlock: (id: string) => void;
  updateBlockData: (id: string, data: Partial<SerializedBlock>) => void;
  selectBlock: (id: string | null) => void;
  setShowBlockPalette: (v: boolean) => void;
  setExecuting: (v: boolean, executionId?: string) => void;
  setBlockExecState: (blockId: string, status: BlockExecStatus) => void;
  resetBlockExecStates: () => void;
  setDirty: (v: boolean) => void;
  getSerializedWorkflow: () => SerializedWorkflow;
  reset: () => void;
}

let blockCounter = 0;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  workflowId: null,
  workflowMeta: null,
  nodes: [],
  edges: [],
  dirty: false,
  selectedBlockId: null,
  showBlockPalette: false,
  executing: false,
  lastExecutionId: null,
  blockExecStates: {},

  setWorkflow: (id, meta, wf) => {
    const { nodes, edges } = workflowToFlow(wf);
    set({ workflowId: id, workflowMeta: meta, nodes, edges, dirty: false, selectedBlockId: null, blockExecStates: {} });
  },

  onNodesChange: (changes) => {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), dirty: true }));
  },

  onEdgesChange: (changes) => {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), dirty: true }));
  },

  onConnect: (connection: Connection) => {
    set((s) => ({
      edges: addEdge({ ...connection, type: 'smoothstep', animated: true, style: { stroke: 'var(--mission-control-border)', strokeWidth: 2 } }, s.edges),
      dirty: true,
    }));
  },

  addBlock: (def, position) => {
    const id = `block-${++blockCounter}-${Date.now()}`;
    const pos = position ?? { x: (get().nodes.length % 5) * 300, y: Math.floor(get().nodes.length / 5) * 200 + 100 };
    const node: Node = {
      id,
      type: 'workflowBlock',
      position: pos,
      data: {
        id,
        type: def.type,
        name: def.name,
        config: { tool: def.type, params: {} },
        inputs: {},
        outputs: { response: 'string' },
        metadata: { id, name: def.name, description: def.description, category: def.category, icon: def.icon, color: def.color },
        enabled: true,
      },
    };
    set((s) => ({ nodes: [...s.nodes, node], dirty: true }));
    return id;
  },

  removeBlock: (id) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      dirty: true,
      selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
    }));
  },

  updateBlockData: (id, data) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
      dirty: true,
    }));
  },

  selectBlock: (id) => set({ selectedBlockId: id }),
  setShowBlockPalette: (v) => set({ showBlockPalette: v }),
  setExecuting: (v, executionId) => set({ executing: v, lastExecutionId: executionId ?? null }),
  setBlockExecState: (blockId, status) =>
    set((s) => ({ blockExecStates: { ...s.blockExecStates, [blockId]: status } })),
  resetBlockExecStates: () => set({ blockExecStates: {} }),
  setDirty: (v) => set({ dirty: v }),

  getSerializedWorkflow: () => {
    const { nodes, edges } = get();
    return flowToWorkflow(nodes, edges);
  },

  reset: () => set({
    workflowId: null, workflowMeta: null, nodes: [], edges: [],
    dirty: false, selectedBlockId: null, showBlockPalette: false,
    executing: false, lastExecutionId: null, blockExecStates: {},
  }),
}));
