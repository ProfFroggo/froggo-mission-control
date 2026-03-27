// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Gateway — routes platform features to local API endpoints.
// Chat uses the /api/agents/[id]/run streaming endpoint.
// Cron, config, and logs use their respective API routes.
// Nodes/skills/channels are Derek Gateway concepts not used in this platform.

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

export interface RunCallback {
  onDelta?: (delta: string, payload: unknown) => void;
  onMessage?: (content: string, payload: unknown) => void;
  onEnd?: (payload: unknown) => void;
  onError?: (error: string, payload: unknown) => void;
}

export type GatewayListener = (...args: any[]) => void;

const NOOP = () => {};

// ── Error classification ──────────────────────────────────────────────────────
function classifyError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT'))
      return 'Connection timed out — the agent may be busy';
    if (msg.includes('429'))
      return 'Rate limited — please wait a moment';
    if (msg.includes('503') || msg.includes('502'))
      return 'Agent service temporarily unavailable';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network'))
      return 'Network connection lost';
    return err.message;
  }
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}

// ── Retry wrapper for non-streaming requests ──────────────────────────────────
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Don't retry client errors (4xx) — they won't change on retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

class Gateway {
  get connected() { return true; }

  connect()    { /* no external connection needed */ }
  disconnect() { /* no-op */ }

  getState(): ConnectionState { return 'connected'; }
  getSessionKey(): string { return ''; }
  setSessionKey(_key: string) { /* no-op */ }

  on(_event: string, _listener: GatewayListener): () => void { return NOOP; }

  getReconnectAttempts(): number { return 0; }
  getOfflineQueueSize(): number  { return 0; }
  getLastError(): string | null  { return null; }
  clearOfflineQueue()            { /* no-op */ }
  clearRunId(_runId: string)     { /* no-op */ }

  // ── Core request (proxies to API routes) ─────────────────────────────────
  async request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const res = await fetch('/api/gateway/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params }),
      });
      if (!res.ok) return {} as T;
      return res.json();
    } catch {
      return {} as T;
    }
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  async getSessions() {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) return { sessions: [] as any[] };
      return res.json();
    } catch { return { sessions: [] as any[] }; }
  }

  async getAgentIdentity(_sessionKey?: string) { return {}; }

  async getChatHistory(limit = 50, sessionKey?: string) {
    try {
      if (!sessionKey) return { messages: [] as any[] };
      const params = new URLSearchParams({ limit: String(limit), sessionKey });
      const res = await fetch(`/api/messages?${params}`);
      if (!res.ok) return { messages: [] as any[] };
      return res.json();
    } catch { return { messages: [] as any[] }; }
  }

  async sendToMain(_message: string): Promise<void> { /* no-op for standalone */ }

  async sendChat(message: string) {
    try {
      const res = await fetchWithRetry('/api/agents/mission-control/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) return { content: '' };
      const data = await res.json();
      return { content: data.content ?? data.result ?? '' };
    } catch { return { content: '' }; }
  }

  async sendChatStreaming(message: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      let full = '';
      this.sendChatWithCallbacks(message, '', {
        onDelta: (d) => { full += d; },
        onEnd:   () => resolve(full),
        onError: () => resolve(full || undefined),
      });
    });
  }

  async sendChatWithCallbacks(
    message: string,
    agentId: string,
    callbacks: RunCallback,
  ): Promise<undefined> {
    const id = agentId || 'mission-control';
    try {
      const res = await fetch(`/api/agents/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, stream: true }),
      });

      if (!res.ok || !res.body) {
        const statusMsg =
          res.status === 429 ? 'Rate limited — please wait a moment' :
          res.status === 503 || res.status === 502 ? 'Agent service temporarily unavailable' :
          res.status === 408 ? 'Connection timed out — the agent may be busy' :
          `Agent run failed (${res.status})`;
        callbacks.onError?.(statusMsg, {});
        return undefined;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.delta ?? parsed.content ?? parsed.text ?? '';
            if (delta) {
              fullContent += delta;
              callbacks.onDelta?.(delta, parsed);
            }
          } catch {
            // Non-JSON chunk — treat as raw text delta if non-empty
            if (data) {
              fullContent += data;
              callbacks.onDelta?.(data, {});
            }
          }
        }
      }

      callbacks.onMessage?.(fullContent, {});
      callbacks.onEnd?.({});
    } catch (err) {
      callbacks.onError?.(classifyError(err), {});
    }
    return undefined;
  }

  async abortChat()                                                  { return {}; }
  async deleteSession(_sessionKey: string)                           { return {}; }
  async spawnAgent(_task: string, _label: string, _model?: string)   { return {}; }
  async sendToSession(_sessionKey: string, _message: string)         { return {}; }
  async getSessionHistory(_sessionKey: string, _limit?: number)      { return { messages: [] as any[] }; }

  // ── Channels — not applicable in standalone platform ─────────────────────
  async getChannelsStatus() {
    return {
      channelOrder:           [] as string[],
      channelLabels:          {} as Record<string, string>,
      channelAccounts:        {} as Record<string, any[]>,
      channelDefaultAccountId:{} as Record<string, string>,
    };
  }
  async channelLogout(_channel: string, _accountId?: string) { return {}; }

  // ── Cron — backed by /api/schedule ───────────────────────────────────────
  async getCronJobs() {
    try {
      const res = await fetch('/api/schedule');
      if (!res.ok) return { jobs: [] as any[] };
      const jobs = await res.json();
      return { jobs: Array.isArray(jobs) ? jobs : [] };
    } catch { return { jobs: [] as any[] }; }
  }

  async getCronStatus() {
    try {
      const res = await fetch('/api/schedule');
      if (!res.ok) return {};
      return res.json();
    } catch { return {}; }
  }

  async addCronJob(job: Record<string, unknown>) {
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!res.ok) return {};
      return res.json();
    } catch { return {}; }
  }

  async updateCronJob(id: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/schedule/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return {};
      return res.json();
    } catch { return {}; }
  }

  async removeCronJob(id: string) {
    try {
      const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
      if (!res.ok) return {};
      return res.json();
    } catch { return {}; }
  }

  async runCronJob(id: string, _mode?: 'force' | 'due') {
    try {
      const res = await fetch(`/api/schedule/${id}/run`, { method: 'POST' });
      if (!res.ok) return {};
      return res.json();
    } catch { return {}; }
  }

  async getCronRuns(_id: string, _limit?: number) { return { entries: [] as any[] }; }

  // ── Skills — not applicable in standalone platform ────────────────────────
  async getSkillsStatus()  { return {}; }
  async getSkillsBins()    { return { bins: [] as string[] }; }
  async installSkill(_name: string, _installId: string)   { return {}; }
  async updateSkill(_key: string, _opts: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }) { return {}; }

  // ── Nodes — not applicable in standalone platform ─────────────────────────
  async getNodes()                                          { return { nodes: [] as any[] }; }
  async describeNode(_nodeId: string)                       { return {}; }
  async renameNode(_nodeId: string, _displayName: string)   { return {}; }
  async listNodePairRequests()                              { return {}; }
  async approveNodePair(_requestId: string)                 { return {}; }
  async rejectNodePair(_requestId: string)                  { return {}; }

  // ── Config — backed by /api/settings ─────────────────────────────────────
  async getConfig() {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return { exists: false, valid: false, hash: '', config: {}, raw: '', issues: [] };
      const config = await res.json();
      return {
        exists: true,
        valid:  true,
        hash:   '',
        config,
        raw:    JSON.stringify(config, null, 2),
        issues: [] as any[],
      };
    } catch {
      return { exists: false, valid: false, hash: '', config: {} as Record<string, unknown>, raw: '', issues: [] as any[] };
    }
  }

  async getConfigSchema() {
    return { schema: {} as Record<string, unknown>, uiHints: {} as Record<string, unknown>, version: '' };
  }

  async applyConfig(raw: string, _baseHash: string, _restartDelayMs?: number) {
    try {
      const config = JSON.parse(raw);
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) return {};
      return res.json();
    } catch { return {}; }
  }

  // ── Logs — backed by /api/logs ────────────────────────────────────────────
  async tailLogs(opts?: { cursor?: number; limit?: number; maxBytes?: number }) {
    try {
      const params = new URLSearchParams();
      if (opts?.cursor !== undefined) params.set('cursor', String(opts.cursor));
      if (opts?.limit  !== undefined) params.set('limit',  String(opts.limit));
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) return { file: '', cursor: 0, size: 0, lines: [], truncated: false };
      return res.json();
    } catch {
      return { file: '', cursor: 0, size: 0, lines: [] as string[], truncated: false };
    }
  }
}

export const gateway = new Gateway();

export function reconnectGateway() { /* no external connection */ }
export function forceReconnect()   { /* no external connection */ }
