// Gateway stub — no WebSocket connection. All methods are no-ops or return empty data.
// The Derek Gateway (ws://127.0.0.1:18789) is not used in this platform.

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

export interface RunCallback {
  onDelta?: (delta: string, payload: unknown) => void;
  onMessage?: (content: string, payload: unknown) => void;
  onEnd?: (payload: unknown) => void;
  onError?: (error: string, payload: unknown) => void;
}

export type GatewayListener = (...args: any[]) => void;

const NOOP = () => {};

class GatewayStub {
  // Chat works via HTTP API routes — always "connected"
  get connected() { return true; }

  connect()    { /* no-op */ }
  disconnect() { /* no-op */ }

  getState(): ConnectionState { return 'connected'; }
  getSessionKey(): string { return ''; }
  setSessionKey(_key: string) { /* no-op */ }

  /** Returns a no-op unsubscribe function */
  on(_event: string, _listener: GatewayListener): () => void { return NOOP; }

  getReconnectAttempts(): number { return 0; }
  getOfflineQueueSize(): number  { return 0; }
  getLastError(): string | null  { return null; }
  clearOfflineQueue()            { /* no-op */ }
  clearRunId(_runId: string)     { /* no-op */ }

  // ── Core request ──────────────────────────────────────────────────────────
  async request<T = unknown>(_method: string, _params?: Record<string, unknown>): Promise<T> {
    return {} as T;
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  async getSessions() { return { sessions: [] as any[] }; }
  async getAgentIdentity(_sessionKey?: string) { return {}; }
  async getChatHistory(_limit?: number) { return { messages: [] as any[] }; }
  async sendToMain(_message: string): Promise<void> { /* no-op */ }
  async sendChat(_message: string) { return { content: '' }; }
  async sendChatStreaming(_message: string): Promise<string | undefined> { return undefined; }
  async sendChatWithCallbacks(
    _message: string,
    _sessionKey: string,
    callbacks: RunCallback,
  ): Promise<undefined> {
    setTimeout(() => callbacks.onError?.('Gateway not available', {}), 0);
    return undefined;
  }
  async abortChat() { return {}; }
  async deleteSession(_sessionKey: string) { return {}; }
  async spawnAgent(_task: string, _label: string, _model?: string) { return {}; }
  async sendToSession(_sessionKey: string, _message: string) { return {}; }
  async getSessionHistory(_sessionKey: string, _limit?: number) { return { messages: [] as any[] }; }

  // ── Channels ──────────────────────────────────────────────────────────────
  async getChannelsStatus() {
    return {
      channelOrder: [] as string[],
      channelLabels: {} as Record<string, string>,
      channelAccounts: {} as Record<string, any[]>,
      channelDefaultAccountId: {} as Record<string, string>,
    };
  }
  async channelLogout(_channel: string, _accountId?: string) { return {}; }

  // ── Cron ─────────────────────────────────────────────────────────────────
  async getCronJobs() { return { jobs: [] as any[] }; }
  async getCronStatus() { return {}; }
  async addCronJob(_job: Record<string, unknown>) { return {}; }
  async updateCronJob(_id: string, _patch: Record<string, unknown>) { return {}; }
  async removeCronJob(_id: string) { return {}; }
  async runCronJob(_id: string, _mode?: 'force' | 'due') { return {}; }
  async getCronRuns(_id: string, _limit?: number) { return { entries: [] as any[] }; }

  // ── Skills ────────────────────────────────────────────────────────────────
  async getSkillsStatus() { return {}; }
  async getSkillsBins() { return { bins: [] as string[] }; }
  async installSkill(_name: string, _installId: string) { return {}; }
  async updateSkill(_skillKey: string, _opts: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }) { return {}; }

  // ── Nodes ─────────────────────────────────────────────────────────────────
  async getNodes() { return { nodes: [] as any[] }; }
  async describeNode(_nodeId: string) { return {}; }
  async renameNode(_nodeId: string, _displayName: string) { return {}; }
  async listNodePairRequests() { return {}; }
  async approveNodePair(_requestId: string) { return {}; }
  async rejectNodePair(_requestId: string) { return {}; }

  // ── Config ────────────────────────────────────────────────────────────────
  async getConfig() {
    return { exists: false, valid: false, hash: '', config: {} as Record<string, unknown>, raw: '', issues: [] as any[] };
  }
  async getConfigSchema() { return { schema: {} as Record<string, unknown>, uiHints: {} as Record<string, unknown>, version: '' }; }
  async applyConfig(_raw: string, _baseHash: string, _restartDelayMs?: number) { return {}; }

  // ── Logs ──────────────────────────────────────────────────────────────────
  async tailLogs(_opts?: { cursor?: number; limit?: number; maxBytes?: number }) {
    return { file: '', cursor: 0, size: 0, lines: [] as string[], truncated: false };
  }
}

export const gateway = new GatewayStub();

export function reconnectGateway() { /* no-op */ }
export function forceReconnect()   { /* no-op */ }

// No auto-connect on load
