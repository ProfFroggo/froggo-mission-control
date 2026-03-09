// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// tools.ts
// Gemini FunctionDeclarations for voice bridge — mirrors MCP tools + routing functions.

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export const VOICE_FUNCTIONS: FunctionDeclaration[] = [
  // Task management
  {
    name: 'task_list',
    description: 'List tasks on the board, optionally filtered by status or assignee',
    parameters: {
      type: 'object',
      properties: {
        status:     { type: 'string', description: 'Filter by status: todo, in-progress, review, done', enum: ['todo', 'in-progress', 'internal-review', 'review', 'human-review', 'done', 'blocked'] },
        assignedTo: { type: 'string', description: 'Agent ID to filter by' },
        limit:      { type: 'string', description: 'Max number of tasks to return' },
      },
    },
  },
  {
    name: 'task_create',
    description: 'Create a new task on the board',
    parameters: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description and acceptance criteria' },
        assignedTo:  { type: 'string', description: 'Agent ID to assign to' },
        priority:    { type: 'string', description: 'Priority level', enum: ['p0', 'p1', 'p2', 'p3'] },
        project:     { type: 'string', description: 'Project name' },
      },
      required: ['title'],
    },
  },
  {
    name: 'task_update',
    description: 'Update a task status, assignee, or progress',
    parameters: {
      type: 'object',
      properties: {
        id:         { type: 'string', description: 'Task ID' },
        status:     { type: 'string', description: 'New status', enum: ['todo', 'in-progress', 'internal-review', 'review', 'human-review', 'done', 'blocked'] },
        assignedTo: { type: 'string', description: 'Agent ID to reassign to' },
        progress:   { type: 'string', description: 'Progress percentage 0-100' },
      },
      required: ['id'],
    },
  },
  // Agent management
  {
    name: 'agent_status',
    description: 'Get the current status of all agents or a specific agent',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Specific agent ID, or omit for all agents' },
      },
    },
  },
  {
    name: 'agent_spawn',
    description: 'Start or resume an agent in a tmux pane',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID to spawn' },
      },
      required: ['agentId'],
    },
  },
  // Memory
  {
    name: 'memory_search',
    description: 'Search the memory vault for past decisions, patterns, or notes',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        mode:  { type: 'string', description: 'Search mode', enum: ['hybrid', 'bm25', 'vector'] },
      },
      required: ['query'],
    },
  },
  // Routing
  {
    name: 'delegate_to_claude',
    description: 'Delegate a task or question to a Claude Code agent via the task board',
    parameters: {
      type: 'object',
      properties: {
        agentId:     { type: 'string', description: 'Target agent ID' },
        instruction: { type: 'string', description: 'Full instruction for the agent' },
        priority:    { type: 'string', description: 'Task priority', enum: ['p0', 'p1', 'p2', 'p3'] },
      },
      required: ['agentId', 'instruction'],
    },
  },
  {
    name: 'switch_agent',
    description: 'Switch the active voice persona to a different agent',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID to switch to' },
      },
      required: ['agentId'],
    },
  },
  // Approvals
  {
    name: 'approval_list',
    description: 'List pending approvals in the queue',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status', enum: ['pending', 'approved', 'rejected'] },
      },
    },
  },
  {
    name: 'approval_respond',
    description: 'Approve or reject a pending approval',
    parameters: {
      type: 'object',
      properties: {
        id:     { type: 'string', description: 'Approval ID' },
        action: { type: 'string', description: 'Approve or reject', enum: ['approve', 'reject'] },
        notes:  { type: 'string', description: 'Optional notes or reason' },
      },
      required: ['id', 'action'],
    },
  },
];
