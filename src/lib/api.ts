// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/lib/api.ts
// REST API client for all mission-control platform endpoints — fetch calls to Next.js API routes

type ApiOptions = {
  method?: string;
  body?: any;
  params?: Record<string, string>;
};

async function apiCall<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(process.env.NEXT_PUBLIC_API_TOKEN ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ──────────────────────────────────────────────────
// Tasks
// ──────────────────────────────────────────────────
export const taskApi = {
  getAll: (filters?: Record<string, string>) =>
    apiCall('/tasks', { params: filters }),
  getById: (id: string) =>
    apiCall(`/tasks/${id}`),
  create: (task: any) =>
    apiCall('/tasks', { method: 'POST', body: task }),
  update: (id: string, updates: any) =>
    apiCall(`/tasks/${id}`, { method: 'PATCH', body: updates }),
  delete: (id: string) =>
    apiCall(`/tasks/${id}`, { method: 'DELETE' }),
  addSubtask: (taskId: string, subtask: any) =>
    apiCall(`/tasks/${taskId}/subtasks`, { method: 'POST', body: subtask }),
  updateSubtask: (taskId: string, subtaskId: string, updates: any) =>
    apiCall(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: updates }),
  deleteSubtask: (taskId: string, subtaskId: string) =>
    apiCall(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),
  getSubtasks: (taskId: string) =>
    apiCall(`/tasks/${taskId}/subtasks`),
  getActivity: (taskId: string) =>
    apiCall(`/tasks/${taskId}/activity`),
  addActivity: (taskId: string, activity: any) =>
    apiCall(`/tasks/${taskId}/activity`, { method: 'POST', body: activity }),
  getAttachments: (taskId: string) =>
    apiCall(`/tasks/${taskId}/attachments`),
  addAttachment: (taskId: string, attachment: any) =>
    apiCall(`/tasks/${taskId}/attachments`, { method: 'POST', body: attachment }),
};

// ──────────────────────────────────────────────────
// Agents
// ──────────────────────────────────────────────────
export const agentApi = {
  getAll: () => apiCall('/agents'),
  getById: (id: string) => apiCall(`/agents/${id}`),
  updateStatus: (id: string, status: string) =>
    apiCall(`/agents/${id}/status`, { method: 'PATCH', body: { status } }),
  spawn: (id: string) =>
    apiCall(`/agents/${id}/spawn`, { method: 'POST' }),
  kill: (id: string) =>
    apiCall(`/agents/${id}/kill`, { method: 'POST' }),
  readSoul: (id: string) => apiCall(`/agents/${id}/soul`),
  writeSoul: (id: string, content: string) =>
    apiCall(`/agents/${id}/soul`, { method: 'PUT', body: { content } }),
  readModels: (id: string) => apiCall(`/agents/${id}/models`),
  writeModels: (id: string, config: any) =>
    apiCall(`/agents/${id}/models`, { method: 'PUT', body: config }),
  getConfig: (id: string) => apiCall(`/agents/${id}/config`),
  patchConfig: (id: string, data: Record<string, unknown>) =>
    apiCall(`/agents/${id}/config`, { method: 'PATCH', body: data }),
  create: (agent: { id: string; name: string; role: string; emoji?: string; color?: string; capabilities?: string[]; personality?: string }) =>
    apiCall('/agents', { method: 'POST', body: agent }),
  hire: (data: { id: string; name: string; emoji?: string; role: string; personality?: string; capabilities?: string[] }) =>
    apiCall('/agents/hire', { method: 'POST', body: data }),
};

// ──────────────────────────────────────────────────
// Chat / Sessions
// ──────────────────────────────────────────────────
export const chatApi = {
  getSessions: () => apiCall('/chat/sessions'),
  getMessages: (sessionKey: string) =>
    apiCall(`/chat/sessions/${encodeURIComponent(sessionKey)}/messages`),
  createSession: (agentId: string) =>
    apiCall('/chat/sessions', { method: 'POST', body: { agentId } }),
  deleteSession: (sessionKey: string) =>
    apiCall(`/chat/sessions/${encodeURIComponent(sessionKey)}`, { method: 'DELETE' }),
  saveMessage: (sessionKey: string, msg: { role: string; content: string; timestamp: number; channel?: string }) =>
    apiCall(`/chat/sessions/${encodeURIComponent(sessionKey)}/messages`, { method: 'POST', body: msg }),
};

// SSE streaming for chat
export function streamMessage(
  agentId: string,
  message: string,
  onChunk: (chunk: any) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  sessionKey?: string,
) {
  const controller = new AbortController();

  fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.NEXT_PUBLIC_API_TOKEN ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}` } : {}),
    },
    body: JSON.stringify({ message, ...(sessionKey ? { sessionKey } : {}) }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      onError(new Error(`Stream error: ${response.status}`));
      return;
    }
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            onChunk(JSON.parse(data));
          } catch {}
        }
      }
    }
    onDone();
  }).catch(onError);

  return () => controller.abort();
}

// ──────────────────────────────────────────────────
// Approvals
// ──────────────────────────────────────────────────
export const approvalApi = {
  getAll: (status?: string, category?: string) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (category) params.category = category;
    return apiCall('/approvals', { params: Object.keys(params).length ? params : undefined });
  },
  create: (approval: any) =>
    apiCall('/approvals', { method: 'POST', body: approval }),
  respond: (id: string, action: string, notes?: string, adjustedContent?: string) =>
    apiCall(`/approvals/${id}`, { method: 'PATCH', body: { action, notes, adjustedContent } }),
  batchRespond: (ids: string[], action: string, reason?: string) =>
    apiCall('/approvals', { method: 'PATCH', body: { ids, action, reason } }),
};

// ──────────────────────────────────────────────────
// Inbox
// ──────────────────────────────────────────────────
export const inboxApi = {
  getAll: (filters?: Record<string, string>) =>
    apiCall('/inbox', { params: filters }),
  create: (item: any) =>
    apiCall('/inbox', { method: 'POST', body: item }),
  update: (id: number, updates: any) =>
    apiCall(`/inbox/${id}`, { method: 'PATCH', body: updates }),
  delete: (id: number) =>
    apiCall(`/inbox/${id}`, { method: 'DELETE' }),
  markRead: (id: number) =>
    apiCall(`/inbox/${id}/read`, { method: 'POST' }),
  star: (id: number, starred: boolean) =>
    apiCall(`/inbox/${id}/star`, { method: 'POST', body: { starred } }),
  convertToTask: (id: number) =>
    apiCall(`/inbox/${id}/convert-to-task`, { method: 'POST' }),
};

// ──────────────────────────────────────────────────
// Chat Rooms (inter-agent communication)
// ──────────────────────────────────────────────────
export const chatRoomApi = {
  list: () => apiCall('/chat-rooms'),
  getMessages: (roomId: string, since?: number) =>
    apiCall(`/chat-rooms/${roomId}/messages`, {
      params: since ? { since: String(since) } : undefined,
    }),
  postMessage: (roomId: string, content: string, agentId?: string) =>
    apiCall(`/chat-rooms/${roomId}/messages`, {
      method: 'POST',
      body: { content, agentId: agentId || 'human' },
    }),
};

// ──────────────────────────────────────────────────
// Sessions
// ──────────────────────────────────────────────────
export const sessionApi = {
  getAll: () => apiCall('/sessions'),
  getForAgent: (agentId: string) => apiCall(`/agents/${agentId}/session`),
  create: (agentId: string, sessionId: string, model?: string) =>
    apiCall(`/agents/${agentId}/session`, { method: 'POST', body: { sessionId, model } }),
  delete: (agentId: string) =>
    apiCall(`/agents/${agentId}/session`, { method: 'DELETE' }),
};

// ──────────────────────────────────────────────────
// Analytics
// ──────────────────────────────────────────────────
export const analyticsApi = {
  getTokenUsage: (params?: Record<string, string>) =>
    apiCall('/analytics/token-usage', { params }),
  getTaskStats: (days?: number) => apiCall(`/analytics/task-stats${days ? `?days=${days}` : ''}`),
  getAgentActivity: () => apiCall('/analytics/agent-activity'),
  getHeatmap: (days?: number) => apiCall(`/analytics/heatmap${days ? `?days=${days}` : ''}`),
  getSubtaskStats: () => apiCall('/analytics/subtasks'),
  logEvent: (event: any) =>
    apiCall('/analytics/events', { method: 'POST', body: event }),
};

// ──────────────────────────────────────────────────
// Modules
// ──────────────────────────────────────────────────
export const moduleApi = {
  getState: () => apiCall('/modules/state'),
  setState: (moduleId: string, enabled: boolean) =>
    apiCall(`/modules/${moduleId}/state`, { method: 'PATCH', body: { enabled } }),
  install: (moduleId: string) =>
    apiCall('/modules/install', { method: 'POST', body: { moduleId } }),
};

// ──────────────────────────────────────────────────
// Settings
// ──────────────────────────────────────────────────
export const settingsApi = {
  getAll: () => apiCall('/settings'),
  get: (key: string) => apiCall(`/settings/${key}`),
  set: (key: string, value: any) =>
    apiCall(`/settings/${key}`, { method: 'PUT', body: { value } }),
};

// ──────────────────────────────────────────────────
// Marketplace
// ──────────────────────────────────────────────────
export const marketplaceApi = {
  listAgents: () => apiCall('/marketplace/agents'),
  listModules: () => apiCall('/marketplace/modules'),
  installAgent: (packageId: string) =>
    apiCall(`/marketplace/agents/${packageId}/install`, { method: 'POST' }),
  installModule: (packageId: string) =>
    apiCall(`/marketplace/modules/${packageId}/install`, { method: 'POST' }),
};

// ──────────────────────────────────────────────────
// Catalog (v4.0 Agent & Module Library)
// ──────────────────────────────────────────────────
export const catalogApi = {
  listAgents: () => apiCall('/catalog/agents'),
  getAgent: (id: string) => apiCall(`/catalog/agents/${id}`),
  setAgentInstalled: (id: string, installed: boolean) =>
    apiCall(`/catalog/agents/${id}`, { method: 'PATCH', body: { installed } }),
  registerAgent: (data: Record<string, unknown>) =>
    apiCall('/catalog/agents', { method: 'POST', body: data }),
  fireAgent: (id: string) =>
    apiCall(`/catalog/agents/${id}`, { method: 'DELETE' }),
  hireAgent: (data: { id: string; name: string; emoji?: string; role?: string; personality?: string; capabilities?: string[]; color?: string }) =>
    apiCall('/agents/hire', { method: 'POST', body: data }),
  listModules: () => apiCall('/catalog/modules'),
  getModule: (id: string) => apiCall(`/catalog/modules/${id}`),
  setModuleInstalled: (id: string, installed: boolean) =>
    apiCall(`/catalog/modules/${id}`, { method: 'PATCH', body: { installed } }),
  setModuleEnabled: (id: string, enabled: boolean) =>
    apiCall(`/catalog/modules/${id}`, { method: 'PATCH', body: { enabled } }),
  uninstallModule: (id: string) =>
    apiCall(`/catalog/modules/${id}`, { method: 'DELETE' }),
};

// ──────────────────────────────────────────────────
// Compatibility shim — maps legacy IPC channel names to REST API calls
// ──────────────────────────────────────────────────
// Maps old IPC channel names to the new API calls.
// Use ONLY during migration. Refactor components to use typed APIs above in Phase 4.

// ──────────────────────────────────────────────────
// Finance
// ──────────────────────────────────────────────────
export const financeApi = {
  getAccounts: () => apiCall('/finance/accounts'),
  getTransactions: (params?: Record<string, string>) =>
    apiCall(`/finance/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  getBudget: () => apiCall('/finance/budget'),
};

// ──────────────────────────────────────────────────
// Accounts (connected social accounts)
// ──────────────────────────────────────────────────
export const accountsApi = {
  getAll: () => apiCall('/accounts'),
  add: (data: Record<string, unknown>) =>
    apiCall('/accounts', { method: 'POST', body: data }),
};

// ──────────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────────
export const notificationsApi = {
  getAll: (since?: number) =>
    apiCall(`/notifications${since ? '?since=' + since : ''}`),
  create: (title: string, body: string, agentId?: string) =>
    apiCall('/notifications', { method: 'POST', body: { title, body, agentId } }),
};

// ──────────────────────────────────────────────────
// Schedule
// ──────────────────────────────────────────────────
export const scheduleApi = {
  getAll: () => apiCall('/schedule'),
  create: (data: Record<string, unknown>) =>
    apiCall('/schedule', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    apiCall(`/schedule/${id}`, { method: 'PATCH', body: data }),
  delete: (id: string) =>
    apiCall(`/schedule/${id}`, { method: 'DELETE' }),
};

// ──────────────────────────────────────────────────
// Library
// ──────────────────────────────────────────────────
export const libraryApi = {
  getFiles: () => apiCall('/library/files') as Promise<{ files: any[] }>,
  getSkills: () => apiCall('/library/skills') as Promise<{ skills: any[] }>,
  createSkill: (data: { name: string; slug?: string; content?: string; url?: string }) =>
    apiCall('/library/skills', { method: 'POST', body: data }),
};

// ──────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: Record<string, string>) =>
    apiCall('/projects', { params }),
  get: (id: string) =>
    apiCall(`/projects/${id}`),
  create: (data: any) =>
    apiCall('/projects', { method: 'POST', body: data }),
  update: (id: string, data: any) =>
    apiCall(`/projects/${id}`, { method: 'PATCH', body: data }),
  archive: (id: string) =>
    apiCall(`/projects/${id}`, { method: 'DELETE' }),
  getMembers: (id: string) =>
    apiCall(`/projects/${id}/members`),
  addMember: (id: string, agentId: string, role = 'member') =>
    apiCall(`/projects/${id}/members`, { method: 'POST', body: { agentId, role, action: 'add' } }),
  removeMember: (id: string, agentId: string) =>
    apiCall(`/projects/${id}/members`, { method: 'POST', body: { agentId, action: 'remove' } }),
  getFiles: (id: string) =>
    apiCall(`/projects/${id}/files`),
  uploadFile: (id: string, name: string, content: string, encoding = 'utf-8') =>
    apiCall(`/projects/${id}/files`, { method: 'POST', body: { name, content, encoding } }),
  dispatch: (id: string, data: any) =>
    apiCall(`/projects/${id}/dispatch`, { method: 'POST', body: data }),
  getMilestones: (id: string) =>
    apiCall(`/projects/${id}/milestones`),
  createMilestone: (id: string, data: { title: string; dueDate?: number }) =>
    apiCall(`/projects/${id}/milestones`, { method: 'POST', body: data }),
  updateMilestone: (id: string, milestoneId: string, data: { title?: string; dueDate?: number; completed?: boolean }) =>
    apiCall(`/projects/${id}/milestones`, { method: 'PATCH', body: { milestoneId, ...data } }),
  deleteMilestone: (id: string, milestoneId: string) =>
    apiCall(`/projects/${id}/milestones?milestoneId=${encodeURIComponent(milestoneId)}`, { method: 'DELETE' }),
};

export const updateApi = {
  check: () => apiCall<{ current: string; latest: string | null; updateAvailable: boolean; releaseNotes: string | null; error?: string }>('/update'),
};

// ──────────────────────────────────────────────────
// Automations
// ──────────────────────────────────────────────────
export const automationsApi = {
  getAll: () => apiCall('/automations'),
  create: (data: Record<string, unknown>) =>
    apiCall('/automations', { method: 'POST', body: data }),
  update: (id: string, data: Record<string, unknown>) =>
    apiCall('/automations', { method: 'PATCH', params: { id }, body: data }),
  delete: (id: string) =>
    apiCall('/automations', { method: 'DELETE', params: { id } }),
  run: (id: string) =>
    apiCall(`/automations/${id}/run`, { method: 'POST' }),
};

// ──────────────────────────────────────────────────
// Campaigns
// ──────────────────────────────────────────────────
export const campaignsApi = {
  list: (status?: string, type?: string) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (type) params.type = type;
    return apiCall('/campaigns', { params: Object.keys(params).length ? params : undefined });
  },
  get: (id: string) => apiCall(`/campaigns/${id}`),
  create: (data: any) => apiCall('/campaigns', { method: 'POST', body: data }),
  update: (id: string, data: any) => apiCall(`/campaigns/${id}`, { method: 'PATCH', body: data }),
  delete: (id: string) => apiCall(`/campaigns/${id}`, { method: 'DELETE' }),
  addMember: (id: string, agentId: string, role = 'member') =>
    apiCall(`/campaigns/${id}/members`, { method: 'POST', body: { agentId, role, action: 'add' } }),
  removeMember: (id: string, agentId: string) =>
    apiCall(`/campaigns/${id}/members`, { method: 'POST', body: { agentId, action: 'remove' } }),
  dispatch: (id: string, data: any) =>
    apiCall(`/campaigns/${id}/dispatch`, { method: 'POST', body: data }),
};

