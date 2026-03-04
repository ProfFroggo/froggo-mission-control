// src/lib/api.ts
// Replaces window.clawdbot.modules.invoke() with fetch calls to Next.js API routes

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
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  create: (agent: { id: string; name: string; role: string; emoji?: string; color?: string; capabilities?: string[]; personality?: string }) =>
    apiCall('/agents', { method: 'POST', body: agent }),
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
  onError: (err: Error) => void
) {
  const controller = new AbortController();

  fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
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
  getAll: (status?: string) =>
    apiCall('/approvals', { params: status ? { status } : undefined }),
  create: (approval: any) =>
    apiCall('/approvals', { method: 'POST', body: approval }),
  respond: (id: string, action: string, notes?: string, adjustedContent?: string) =>
    apiCall(`/approvals/${id}`, { method: 'PATCH', body: { action, notes, adjustedContent } }),
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
  getTaskStats: () => apiCall('/analytics/task-stats'),
  getAgentActivity: () => apiCall('/analytics/agent-activity'),
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
// Compatibility shim — drop-in replacement for window.clawdbot
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
};

// ──────────────────────────────────────────────────
// Library
// ──────────────────────────────────────────────────
export const libraryApi = {
  getFiles: () => apiCall('/library/files'),
  getSkills: () => apiCall('/library/skills'),
};

// ──────────────────────────────────────────────────
// Compatibility shim — drop-in replacement for window.clawdbot
// ──────────────────────────────────────────────────
// Maps old IPC channel names to the new API calls.
// Use ONLY during migration. Refactor components to use typed APIs above in Phase 4.

const IPC_ROUTE_MAP: Record<string, (...args: any[]) => Promise<any>> = {
  'task:getAll': (filters?: any) => taskApi.getAll(filters),
  'task:getById': (id: string) => taskApi.getById(id),
  'task:create': (task: any) => taskApi.create(task),
  'task:update': (id: string, updates: any) => taskApi.update(id, updates),
  'task:delete': (id: string) => taskApi.delete(id),
  'task:addSubtask': (taskId: string, subtask: any) => taskApi.addSubtask(taskId, subtask),
  'task:addActivity': (taskId: string, activity: any) => taskApi.addActivity(taskId, activity),
  'task:getActivity': (taskId: string) => taskApi.getActivity(taskId),
  'agent:getAll': () => agentApi.getAll(),
  'agent:getById': (id: string) => agentApi.getById(id),
  'agent:updateStatus': (id: string, status: string) => agentApi.updateStatus(id, status),
  'agent:spawn': (id: string) => agentApi.spawn(id),
  'agent:kill': (id: string) => agentApi.kill(id),
  'approval:getAll': () => approvalApi.getAll(),
  'approval:create': (data: any) => approvalApi.create(data),
  'approval:approve': (id: string) => approvalApi.respond(id, 'approved'),
  'approval:reject': (id: string) => approvalApi.respond(id, 'rejected'),
  'inbox:getAll': () => inboxApi.getAll(),
  'inbox:create': (item: any) => inboxApi.create(item),
  'inbox:markRead': (id: number) => inboxApi.markRead(id),
  'inbox:convertToTask': (id: number) => inboxApi.convertToTask(id),
  'module:state:load': () => moduleApi.getState(),
  'module:state:save': (id: string, enabled: boolean) => moduleApi.setState(id, enabled),
  'settings:getAll': () => settingsApi.getAll(),
  'settings:get': (key: string) => settingsApi.get(key),
  'settings:set': (key: string, value: any) => settingsApi.set(key, value),
  'analytics:getTokenUsage': (params?: any) => analyticsApi.getTokenUsage(params),
  'analytics:getTaskStats': () => analyticsApi.getTaskStats(),
  'analytics:logEvent': (event: any) => analyticsApi.logEvent(event),
};

export function invokeCompat(channel: string, ...args: any[]): Promise<any> {
  const handler = IPC_ROUTE_MAP[channel];
  if (!handler) {
    console.warn(`[API] Unknown IPC channel: ${channel}. Returning empty.`);
    return Promise.resolve(null);
  }
  return handler(...args);
}
