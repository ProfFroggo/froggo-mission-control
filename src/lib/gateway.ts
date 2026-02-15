// Gateway WebSocket Client - connects to Clawdbot gateway

const DEFAULT_GATEWAY_WS = 'ws://127.0.0.1:18789';
const DEFAULT_TOKEN = '';
const DEFAULT_SESSION_KEY = 'agent:froggo:dashboard'; // Default session key (overridable via setSessionKey)

/** Callback interface for per-runId event handling */
export interface RunCallback {
  onDelta?: (delta: string, payload: any) => void;
  onMessage?: (content: string, payload: any) => void;
  onEnd?: (payload: any) => void;
  onError?: (error: string, payload: any) => void;
}

// Load settings from localStorage
function getSettings(): { gatewayUrl: string; gatewayToken: string } {
  try {
    const saved = localStorage.getItem('froggo-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        gatewayUrl: parsed.gatewayUrl || DEFAULT_GATEWAY_WS,
        gatewayToken: parsed.gatewayToken || DEFAULT_TOKEN,
      };
    }
  } catch {}
  return { gatewayUrl: DEFAULT_GATEWAY_WS, gatewayToken: DEFAULT_TOKEN };
}

// Fetch gateway token from openclaw config via Electron IPC (async, one-time)
let _configTokenLoaded = false;
async function ensureGatewayToken() {
  if (_configTokenLoaded) return;
  _configTokenLoaded = true;
  const settings = getSettings();
  if (settings.gatewayToken) return; // already have one
  try {
    const w = window as any;
    const token = await w.clawdbot?.gateway?.getToken?.();
    if (token) {
      const saved = JSON.parse(localStorage.getItem('froggo-settings') || '{}');
      saved.gatewayToken = token;
      localStorage.setItem('froggo-settings', JSON.stringify(saved));
    }
  } catch {}
}

type Listener = (event: any) => void;

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

class Gateway {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: number }>();
  private listeners = new Map<string, Set<Listener>>();
  private state: ConnectionState = 'disconnected';
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private baseReconnectDelay = 1000;
  private sessionKey = DEFAULT_SESSION_KEY;
  private gatewayUrl = DEFAULT_GATEWAY_WS;
  private token = DEFAULT_TOKEN;
  private activeRunIds = new Set<string>();
  // Per-runId callback system — components register handlers keyed by runId
  // so multiple concurrent requests (e.g. multi-agent rooms) each get their own events
  private runCallbacks = new Map<string, RunCallback>();
  
  // Heartbeat
  private heartbeatInterval: number | null = null;
  private heartbeatTimeout: number | null = null;
  // private lastPong = 0;
  private readonly HEARTBEAT_INTERVAL = 30000;
  private readonly HEARTBEAT_TIMEOUT = 10000;
  private readonly CONNECT_TIMEOUT = 15000;
  private connectTimeoutTimer: number | null = null;

  get connected() { return this.state === 'connected'; }

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkConnection();
        }
      });

      window.addEventListener('online', () => {
        this.reconnectNow();
      });
    }
  }

  private checkConnection() {
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.sendHeartbeat();
    } else if (this.state === 'disconnected') {
      this.connect();
    }
  }

  connect() {
    if (this.state === 'connecting' || this.state === 'authenticating') {
      return;
    }

    this.cleanup();

    const settings = getSettings();
    this.gatewayUrl = settings.gatewayUrl;
    this.token = settings.gatewayToken;

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.gatewayUrl);
    } catch (err) {
      console.error('[Gateway] Failed to create WebSocket:', err);
      this.setState('disconnected');
      this.scheduleReconnect();
      return;
    }

    this.connectTimeoutTimer = window.setTimeout(() => {
      if (this.state !== 'connected') {
        this.cleanup();
        this.setState('disconnected');
        this.scheduleReconnect();
      }
    }, this.CONNECT_TIMEOUT);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // this.lastPong = Date.now();

        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          this.setState('authenticating');
          this.sendConnect();
          return;
        }

        if (msg.type === 'res' && msg.id?.startsWith('ping-')) {
          this.clearHeartbeatTimeout();
          return;
        }

        if (msg.type === 'res') {
          const p = this.pending.get(msg.id);
          if (p) {
            clearTimeout(p.timer);
            this.pending.delete(msg.id);
            if (msg.ok) {
              if (msg.id.startsWith('connect-')) {
                this.onConnected();
              }
              p.resolve(msg.payload);
            } else {
              console.error('[Gateway] Request failed:', msg.id, msg.error);
              p.reject(new Error(msg.error?.message || 'Request failed'));
            }
          }
          return;
        }

        if (msg.type === 'event') {
          const payload = msg.payload || {};
          const eventSessionKey = payload?.sessionKey || '';
          // Accept events that match our current session key OR have a tracked runId.
          // If no routing info is present, REJECT the event to prevent cross-session bleed.
          const matchesSession = eventSessionKey && eventSessionKey === this.sessionKey;
          const matchesRunId = payload?.runId && this.activeRunIds.has(payload.runId);
          const isOurSession = matchesSession || matchesRunId;

          // Per-runId callback dispatch — fires BEFORE session-based filtering
          // so components that registered for a specific runId always get their events
          const eventRunId = payload?.runId;
          if (eventRunId && this.runCallbacks.has(eventRunId)) {
            const cb = this.runCallbacks.get(eventRunId)!;
            const content = payload?.message?.content?.[0]?.text || payload?.content || '';
            if (msg.event === 'chat.delta' || (msg.event === 'chat' && payload?._event === 'delta')) {
              const delta = payload?.delta || '';
              if (delta && cb.onDelta) cb.onDelta(delta, payload);
            }
            if (msg.event === 'chat.message' || (msg.event === 'chat' && payload?.state === 'final')) {
              if (content && cb.onMessage) cb.onMessage(content, payload);
              if (cb.onEnd) cb.onEnd(payload);
              this.runCallbacks.delete(eventRunId);
              this.activeRunIds.delete(eventRunId);
            }
            if (msg.event === 'chat.end') {
              if (cb.onEnd) cb.onEnd(payload);
              this.runCallbacks.delete(eventRunId);
              this.activeRunIds.delete(eventRunId);
            }
            if (msg.event === 'chat.error') {
              const errMsg = payload?.message || payload?.error || 'Unknown error';
              if (cb.onError) cb.onError(errMsg, payload);
              this.runCallbacks.delete(eventRunId);
              this.activeRunIds.delete(eventRunId);
            }
            // Also handle the unified 'chat' event with state field
            if (msg.event === 'chat') {
              if (payload?.state === 'final') {
                if (content && cb.onMessage) cb.onMessage(content, payload);
                if (cb.onEnd) cb.onEnd(payload);
                this.runCallbacks.delete(eventRunId);
                this.activeRunIds.delete(eventRunId);
              } else if (payload?.state === 'delta') {
                // Delta: payload.delta has incremental text, content has full accumulated text
                const deltaText = payload?.delta;
                if (deltaText && cb.onDelta) {
                  cb.onDelta(deltaText, payload);
                } else if (content && cb.onMessage) {
                  // No incremental delta available — send full content as message update
                  cb.onMessage(content, payload);
                }
              }
            }
          }

          if (msg.event === 'chat.delta' && isOurSession) {
            this.emit('chat.delta', payload);
            this.emit('chat', { ...payload, _event: 'delta' });
          } else if (msg.event === 'chat.message' && isOurSession) {
            this.emit('chat.message', payload);
            this.emit('chat', { ...payload, _event: 'message', final: true });
          } else if (msg.event === 'chat.end' && isOurSession) {
            this.emit('chat.end', payload);
            this.emit('chat', { ...payload, _event: 'end', final: true });
          } else if (msg.event === 'chat.error' && isOurSession) {
            this.emit('chat.error', payload);
            this.emit('chat', { ...payload, _event: 'error', error: true });
          }
          
          // Only emit session-routed events if they belong to our session
          // Global events (no routing info) are still emitted to allow system-wide notifications
          const hasRoutingInfo = eventSessionKey || payload?.runId;
          if (!hasRoutingInfo || isOurSession) {
            this.emit(msg.event, payload);
            this.emit('*', msg);
          }
        }
      } catch (err) {
        console.error('[Gateway] Parse error:', err);
      }
    };

    this.ws.onclose = (event) => {
      this.cleanup();
      this.setState('disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[Gateway] WebSocket error:', err);
    };
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.emit('stateChange', { state: newState, oldState });

      if (newState === 'connected') {
        this.emit('connect', {});
      } else if (newState === 'disconnected' && oldState !== 'disconnected') {
        this.emit('disconnect', {});
      }
    }
  }

  private onConnected() {
    this.reconnectAttempts = 0;
    
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    
    this.startHeartbeat();
    this.setState('connected');
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    this.stopHeartbeat();
    
    for (const [_id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Connection closed'));
    }
    this.pending.clear();
    
    if (this.ws) {
      try { 
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close(); 
      } catch {}
      this.ws = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // this.lastPong = Date.now();
    
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private sendHeartbeat() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    
    const id = `ping-${Date.now()}`;
    try {
      this.ws.send(JSON.stringify({ type: 'req', id, method: 'sessions.list', params: { limit: 1 } }));
      
      this.heartbeatTimeout = window.setTimeout(() => {
        console.warn('[Gateway] Heartbeat timeout');
        this.cleanup();
        this.setState('disconnected');
        this.scheduleReconnect();
      }, this.HEARTBEAT_TIMEOUT);
    } catch (err) {
      console.error('[Gateway] Heartbeat failed:', err);
      this.cleanup();
      this.setState('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private reconnectNow() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
    this.setState('disconnected');
    this.reconnectAttempts = 0;
    this.connect();
  }

  private sendConnect() {
    const id = `connect-${Date.now()}`;
    const connectMsg = {
      type: 'req', 
      id, 
      method: 'connect',
      params: {
        minProtocol: 3, 
        maxProtocol: 3,
        client: { id: 'webchat-ui', version: '1.0.0', platform: 'electron', mode: 'webchat' },
        role: 'operator',
        scopes: ['operator.admin', 'operator.write', 'operator.read'],
        caps: ['streaming'],
        auth: { token: this.token },
      }
    };
    this.ws?.send(JSON.stringify(connectMsg));

    const timer = window.setTimeout(() => {
      if (this.pending.has(id)) {
        this.pending.delete(id);
        console.error('[Gateway] Auth timeout');
        this.cleanup();
        this.setState('disconnected');
        this.scheduleReconnect();
      }
    }, 10000);

    this.pending.set(id, {
      resolve: () => {},
      reject: (err) => {
        console.error('[Gateway] Auth failed:', err);
        this.setState('disconnected');
      },
      timer
    });
  }

  async request<T = any>(method: string, params: any = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.state !== 'connected') {
      throw new Error('Not connected');
    }
    const id = `req-${Date.now()}-${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 120000);
      
      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(l => {
      try { l(data); } catch (e) { console.error('[Gateway] Listener error:', e); }
    });
  }

  getState(): ConnectionState { return this.state; }
  getSessionKey(): string { return this.sessionKey; }
  
  setSessionKey(key: string) {
    this.sessionKey = key;
    this.activeRunIds.clear();
  }

  // High-level methods
  async getSessions() {
    if (!this.connected) {
      console.warn('[Gateway] getSessions called before connected, waiting...');
      // Wait up to 5 seconds for connection
      for (let i = 0; i < 50; i++) {
        if (this.connected) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (!this.connected) {
        throw new Error('Not connected');
      }
    }
    return this.request<{ sessions: any[] }>('sessions.list', {});
  }

  async getAgentIdentity(sessionKey?: string) {
    return this.request('agent.identity.get', sessionKey ? { sessionKey } : {});
  }

  async getChatHistory(limit = 50) {
    return this.request('chat.history', { sessionKey: this.sessionKey, limit });
  }

  // Send chat and return a promise that resolves when response is complete
  // Send message directly to Discord channel using send method
  async sendToMain(message: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const idempotencyKey = `dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const result = await this.request('send', {
      to: 'channel:1465351776759975977',  // Discord #get_shit_done channel
      message: message,
      channel: 'discord',
      idempotencyKey: idempotencyKey,
    });

    if (!result || result.status === 'error') {
      throw new Error(result?.error || 'Failed to send to Discord');
    }
  }

  sendChat(message: string): Promise<{ content: string }> {
    return new Promise(async (resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      const idempotencyKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let responseContent = '';
      let resolved = false;
      
      const cleanup = () => {
        unsub1();
        unsub2();
        unsub3();
        unsub4();
        unsub5();
      };

      const finish = (content: string) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          resolve({ content });
        }
      };

      const fail = (err: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(err);
        }
      };

      // Track the actual runId from the gateway response
      let ourRunId = '';
      
      // Listen for streaming events (gateway sends 'chat' with state field)
      const unsub1 = this.on('chat', (data: any) => {
        // Only process events for OUR request (filter out other sessions like Discord)
        if (ourRunId && data.runId && data.runId !== ourRunId) {
          // Different runId, ignore - this is from another session
          return;
        }
        
        // Extract text content
        const text = data.message?.content?.[0]?.text || data.content || data.delta || '';
        if (text) {
          responseContent = text; // Full content, not delta
        }
        
        // Check for final state
        if (data.state === 'final') {
          finish(responseContent);
        }
      });

      // Also listen for legacy event names
      const unsub2 = this.on('chat.delta', (data: any) => {
        if (data.delta) responseContent += data.delta;
      });

      const unsub3 = this.on('chat.message', (data: any) => {
        if (data.content) responseContent = data.content;
      });

      const unsub4 = this.on('chat.end', () => {
        finish(responseContent);
      });

      const unsub5 = this.on('chat.error', (data: any) => {
        fail(new Error(data.message || data.error || 'Chat error'));
      });

      // Timeout after 2 minutes
      const timeout = setTimeout(() => {
        if (responseContent) {
          finish(responseContent);
        } else {
          fail(new Error('Response timeout'));
        }
      }, 120000);

      try {
        const result = await this.request('chat.send', {
          message,
          sessionKey: this.sessionKey,
          idempotencyKey,
        });

        // Capture runId to filter streaming events
        if (result?.runId) {
          ourRunId = result.runId;
        }

        // If we got a direct response (non-streaming), use it
        if (result?.content) {
          clearTimeout(timeout);
          finish(result.content);
        }
        // Otherwise wait for streaming events
      } catch (e: any) {
        console.error('[Gateway] sendChat error:', e);
        clearTimeout(timeout);
        fail(e);
      }
    });
  }

  // Fire-and-forget send for streaming UI — returns runId for event filtering
  async sendChatStreaming(message: string): Promise<string | undefined> {
    const idempotencyKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await this.request('chat.send', { 
      message, 
      sessionKey: this.sessionKey, 
      idempotencyKey,
    });
    const runId = result?.runId;
    if (runId) {
      this.activeRunIds.add(runId);
    }
    return runId;
  }

  /** Remove a tracked runId (call when response is complete) */
  clearRunId(runId: string) {
    this.activeRunIds.delete(runId);
    this.runCallbacks.delete(runId);
  }

  /**
   * Send a chat message to ANY session key with per-request callbacks.
   * Does NOT require setSessionKey() — each request is self-contained.
   * Perfect for multi-agent rooms where multiple agents respond concurrently.
   */
  async sendChatWithCallbacks(
    message: string,
    sessionKey: string,
    callbacks: RunCallback,
  ): Promise<string | undefined> {
    const idempotencyKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await this.request('chat.send', {
      message,
      sessionKey,
      idempotencyKey,
    });
    const runId = result?.runId;
    if (runId) {
      this.activeRunIds.add(runId);
      this.runCallbacks.set(runId, callbacks);
      // Safety timeout — clean up after 3 minutes if no response
      setTimeout(() => {
        if (this.runCallbacks.has(runId)) {
          console.warn('[Gateway] RunId timeout, cleaning up:', runId);
          const cb = this.runCallbacks.get(runId);
          if (cb?.onError) cb.onError('Response timeout', {});
          this.runCallbacks.delete(runId);
          this.activeRunIds.delete(runId);
        }
      }, 180000);
    }
    return runId;
  }

  async abortChat() {
    return this.request('chat.abort', { sessionKey: this.sessionKey });
  }

  async deleteSession(sessionKey: string) {
    return this.request('sessions.delete', { sessionKey });
  }

  async spawnAgent(task: string, label: string, model?: string) {
    return this.request('sessions.spawn', {
      task,
      label,
      model: model || 'anthropic/claude-sonnet-4',
      runTimeoutSeconds: 300,
      cleanup: 'keep',
    });
  }

  async sendToSession(sessionKey: string, message: string) {
    return this.request('sessions.send', { sessionKey, message });
  }

  async getSessionHistory(sessionKey: string, limit = 20) {
    return this.request('sessions.history', { sessionKey, limit });
  }

  // --- Channels ---
  async getChannelsStatus() {
    return this.request<{
      channelOrder: string[];
      channelLabels: Record<string, string>;
      channelAccounts: Record<string, Array<{
        accountId: string; name?: string; connected?: boolean; enabled?: boolean;
        configured?: boolean; linked?: boolean; running?: boolean;
        reconnectAttempts?: number; lastConnectedAt?: number; lastError?: string;
        lastStartAt?: number; lastStopAt?: number; lastInboundAt?: number;
        lastOutboundAt?: number; dmPolicy?: string; mode?: string;
        tokenSource?: string; botTokenSource?: string;
      }>>;
      channelDefaultAccountId: Record<string, string>;
    }>('channels.status', {});
  }
  async channelLogout(channel: string, accountId?: string) {
    return this.request('channels.logout', { channel, accountId });
  }

  // --- Cron ---
  async getCronJobs() {
    return this.request<{ jobs: any[] }>('cron.list', { includeDisabled: true });
  }
  async getCronStatus() {
    return this.request('cron.status', {});
  }
  async addCronJob(job: any) {
    return this.request('cron.add', job);
  }
  async updateCronJob(id: string, patch: any) {
    return this.request('cron.update', { id, patch });
  }
  async removeCronJob(id: string) {
    return this.request('cron.remove', { id });
  }
  async runCronJob(id: string, mode: 'force' | 'due' = 'force') {
    return this.request('cron.run', { id, mode });
  }
  async getCronRuns(id: string, limit = 20) {
    return this.request<{ entries: any[] }>('cron.runs', { id, limit });
  }

  // --- Skills ---
  async getSkillsStatus() {
    return this.request('skills.status', {});
  }
  async getSkillsBins() {
    return this.request<{ bins: string[] }>('skills.bins', {});
  }
  async installSkill(name: string, installId: string) {
    return this.request('skills.install', { name, installId });
  }
  async updateSkill(skillKey: string, opts: { enabled?: boolean; apiKey?: string; env?: Record<string, string> }) {
    return this.request('skills.update', { skillKey, ...opts });
  }

  // --- Nodes ---
  async getNodes() {
    return this.request<{ nodes: any[] }>('node.list', {});
  }
  async describeNode(nodeId: string) {
    return this.request('node.describe', { nodeId });
  }
  async renameNode(nodeId: string, displayName: string) {
    return this.request('node.rename', { nodeId, displayName });
  }
  async listNodePairRequests() {
    return this.request('node.pair.list', {});
  }
  async approveNodePair(requestId: string) {
    return this.request('node.pair.approve', { requestId });
  }
  async rejectNodePair(requestId: string) {
    return this.request('node.pair.reject', { requestId });
  }

  // --- Config ---
  async getConfig() {
    return this.request<{ exists: boolean; valid: boolean; hash: string; config: any; raw: string; issues?: any[] }>('config.get', {});
  }
  async getConfigSchema() {
    return this.request<{ schema: any; uiHints: any; version: string }>('config.schema', {});
  }
  async applyConfig(raw: string, baseHash: string, restartDelayMs = 2000) {
    return this.request('config.apply', { raw, baseHash, restartDelayMs });
  }

  // --- Logs ---
  async tailLogs(opts?: { cursor?: number; limit?: number; maxBytes?: number }) {
    return this.request<{ file: string; cursor: number; size: number; lines: string[]; truncated?: boolean; reset?: boolean }>('logs.tail', opts || {});
  }
}

export const gateway = new Gateway();

export function reconnectGateway() {
  gateway['reconnectNow']();
}

export function forceReconnect() {
  reconnectGateway();
}

// Set up listener for broadcast events from Electron main process
// This enables real-time task updates when database changes happen
if (typeof window !== 'undefined' && (window as any).clawdbot?.gateway?.onBroadcast) {
  (window as any).clawdbot.gateway.onBroadcast((broadcastData: { type: string; event: string; payload: any }) => {
    // Emit the event locally to all listeners
    if (broadcastData.event && broadcastData.payload) {
      gateway['emit'](broadcastData.event, broadcastData.payload);
    }
  });
}

// Load gateway token from Electron IPC, then connect
(async () => {
  try {
    const w = window as any;
    const token = await w.clawdbot?.gateway?.getToken?.();
    if (token) {
      const saved = JSON.parse(localStorage.getItem('froggo-settings') || '{}');
      saved.gatewayToken = token;
      localStorage.setItem('froggo-settings', JSON.stringify(saved));
    }
  } catch (e) {
    console.error('[Gateway] Token fetch failed:', e);
  }
  gateway.connect();
})();
