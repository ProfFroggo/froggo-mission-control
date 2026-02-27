// Gateway WebSocket Client - connects to Clawdbot gateway
import { createLogger } from '../utils/logger';

const logger = createLogger('Gateway');
const DEFAULT_GATEWAY_WS = 'ws://127.0.0.1:18789';
const DEFAULT_TOKEN = '';
const DEFAULT_SESSION_KEY = 'agent:froggo:dashboard'; // Default session key (overridable via setSessionKey)

/** Session types - properly typed */
interface SessionInfo {
  key: string;
  agentId?: string;
  label?: string;
  state?: string;
  createdAt?: number;
  lastActivity?: number;
  [key: string]: unknown;
}

/** Cron job types - properly typed */
interface CronJob {
  id: string;
  name?: string;
  schedule: Record<string, unknown>;
  enabled?: boolean;
  lastRun?: number;
  nextRun?: number;
}

interface CronRunEntry {
  id: string;
  jobId: string;
  timestamp: number;
  status: string;
  output?: string;
}

interface NodeInfo {
  id: string;
  name?: string;
  status?: string;
  [key: string]: unknown;
}

interface ConfigData {
  [key: string]: unknown;
}

interface ConfigIssues {
  path?: string;
  message?: string;
}

/** Chat event data - properly typed */
interface ChatEventData {
  runId?: string;
  message?: {
    content?: Array<{ text?: string }>;
  };
  content?: string;
  delta?: string;
  state?: 'delta' | 'final' | 'error';
  error?: boolean;
  final?: boolean;
}

interface ChatErrorData {
  message?: string;
  error?: string;
}

/** Callback interface for per-runId event handling */
export interface RunCallback {
  onDelta?: (delta: string, payload: ChatEventData) => void;
  onMessage?: (content: string, payload: ChatEventData) => void;
  onEnd?: (payload: ChatEventData) => void;
  onError?: (error: string, payload: ChatErrorData) => void;
}

/** Generic listener type for gateway events - using any for backward compatibility with existing consumers */
export type GatewayListener = (...args: any[]) => void;

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
  } catch { /* ignore */ }
  return { gatewayUrl: DEFAULT_GATEWAY_WS, gatewayToken: DEFAULT_TOKEN };
}

// Fetch gateway token from openclaw config via Electron IPC — always overwrite to stay in sync
let _configTokenLoaded = false;
async function ensureGatewayToken() {
  if (_configTokenLoaded) return;
  _configTokenLoaded = true;
  try {
    const w = window as any;
    const token = await w.clawdbot?.gateway?.getToken?.();
    if (token) {
      const saved = JSON.parse(localStorage.getItem('froggo-settings') || '{}');
      saved.gatewayToken = token;
      localStorage.setItem('froggo-settings', JSON.stringify(saved));
      logger.debug('[Gateway] Loaded token from openclaw config');
      gateway.connect();
    }
  } catch { /* ignore */ }
}

type Listener = GatewayListener;

export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

/** Queued action for offline replay */
interface QueuedAction {
  method: string;
  params: unknown;
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

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
  // Offline queue for actions during disconnection
  private offlineQueue: QueuedAction[] = [];
  private maxOfflineQueueSize = 50;
  private lastError: string | null = null;

  // Event listener references for cleanup
  private visibilityChangeHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

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
      this.visibilityChangeHandler = () => {
        if (document.visibilityState === 'visible') {
          logger.debug('[Gateway] Tab visible, checking connection...');
          this.checkConnection();
        }
      };
      this.onlineHandler = () => {
        logger.debug('[Gateway] Network online, reconnecting...');
        this.reconnectNow();
      };
      document.addEventListener('visibilitychange', this.visibilityChangeHandler);
      window.addEventListener('online', this.onlineHandler);
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
      logger.debug('[Gateway] Already connecting...');
      return;
    }
    
    this.cleanup();
    
    const settings = getSettings();
    this.gatewayUrl = settings.gatewayUrl;
    this.token = settings.gatewayToken;

    this.setState('connecting');
    logger.debug('[Gateway] Connecting to:', this.gatewayUrl, '(attempt', this.reconnectAttempts + 1, ')');

    try {
      this.ws = new WebSocket(this.gatewayUrl);
    } catch (err) {
      // '[Gateway] Failed to create WebSocket:', err;
      this.setState('disconnected');
      this.scheduleReconnect();
      return;
    }

    this.connectTimeoutTimer = window.setTimeout(() => {
      if (this.state !== 'connected') {
        console.warn('[Gateway] Connection timeout');
        this.cleanup();
        this.setState('disconnected');
        this.scheduleReconnect();
      }
    }, this.CONNECT_TIMEOUT);

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // this.lastPong = Date.now();
        
        if (msg.type !== 'event' || !msg.event?.startsWith('chat.')) {
          logger.debug('[Gateway] Received:', msg.type, msg.event || msg.method || '');
        }

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
                logger.debug('[Gateway] Connected successfully');
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
          
          // Debug log for chat-related events
          if (msg.event?.startsWith('chat')) {
            logger.debug('[Gateway] Chat event:', msg.event, 'isOurSession:', isOurSession, 'runId:', payload?.runId, 'payload:', JSON.stringify(payload).slice(0, 200));
          }

          // Per-runId callback dispatch — fires BEFORE session-based filtering
          // so components that registered for a specific runId always get their events
          const eventRunId = payload?.runId;
          if (eventRunId && this.runCallbacks.has(eventRunId)) {
            const cb = this.runCallbacks.get(eventRunId)!;
            // Extract ALL text blocks, not just the first one (handles thinking blocks)
            let content = '';
            if (payload?.message?.content && Array.isArray(payload.message.content)) {
              content = payload.message.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
            } else if (payload?.content) {
              content = payload.content;
            }
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
        // '[Gateway] Parse error:', err;
      }
    };

    this.ws.onopen = () => {
      logger.debug('[Gateway] WebSocket opened');
    };

    this.ws.onclose = (event) => {
      const wasConnected = this.state === 'connected';
      this.lastError = `Connection closed (code: ${event.code})`;
      logger.debug('[Gateway] WebSocket closed:', event.code);
      this.cleanup();
      this.setState('disconnected');
      this.scheduleReconnect();
      // Emit connection lost event for UI feedback
      if (wasConnected) {
        this.emit('connectionLost', { 
          code: event.code, 
          reason: event.reason,
          attempts: this.reconnectAttempts 
        });
      }
    };

    this.ws.onerror = (err) => {
      this.lastError = 'WebSocket connection error';
      console.error('[Gateway] WebSocket error:', err);
      this.emit('connectionError', { error: this.lastError, attempts: this.reconnectAttempts });
    };
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      logger.debug('[Gateway] State:', oldState, '->', newState);
      this.emit('stateChange', { state: newState, oldState, attempts: this.reconnectAttempts, error: this.lastError });
      
      if (newState === 'connected') {
        this.emit('connect', {});
        // Process offline queue
        this.processOfflineQueue();
      } else if (newState === 'disconnected' && oldState !== 'disconnected') {
        this.emit('disconnect', { attempts: this.reconnectAttempts, error: this.lastError });
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

    // Cleanup global event listeners
    if (typeof document !== 'undefined' && this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    if (typeof window !== 'undefined' && this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    for (const [_id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Connection closed'));
    }
    this.pending.clear();

    // Fire onError for any in-flight runCallbacks so components can reset streaming state
    for (const [runId, cb] of this.runCallbacks) {
      try { cb.onError?.('Connection closed', {}); } catch { /* ignore */ }
      this.activeRunIds.delete(runId);
    }
    this.runCallbacks.clear();

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch { /* ignore */ }
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
      // '[Gateway] Heartbeat failed:', err;
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
    
    logger.debug('[Gateway] Reconnecting in', delay, 'ms');
    
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
        client: { id: 'openclaw-control-ui', version: '1.0.0', platform: 'electron', mode: 'ui' },
        role: 'operator',
        scopes: ['operator.admin', 'operator.write', 'operator.read'],
        caps: ['streaming'],
        auth: { token: this.token },
      }
    };
    logger.debug('[Gateway] Authenticating...');
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

  async request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    // If offline, queue the action for later replay
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.state !== 'connected') {
      // Only queue write operations, not reads
      const writeMethods = ['send', 'chat.send', 'sessions.spawn', 'sessions.delete', 'cron.add', 'cron.update', 'cron.remove', 'skills.install', 'skills.update', 'config.apply', 'channels.logout'];
      if (writeMethods.some(m => method.startsWith(m))) {
        return this.queueOfflineAction<T>(method, params);
      }
      throw new Error('Not connected');
    }
    const id = `req-${Date.now()}-${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }

  /** Queue an action to be replayed when connection is restored */
  private queueOfflineAction<T>(method: string, params: unknown): Promise<T> {
    if (this.offlineQueue.length >= this.maxOfflineQueueSize) {
      return Promise.reject(new Error('Offline queue is full. Changes cannot be saved.'));
    }
    
    return new Promise((resolve, reject) => {
      this.offlineQueue.push({ method, params, resolve: resolve as (value: any) => void, reject });
      this.emit('actionQueued', { method, queueSize: this.offlineQueue.length });
    });
  }

  /** Process queued offline actions when connection is restored */
  private async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    this.emit('processingOfflineQueue', { count: queue.length });
    
    for (const action of queue) {
      try {
        const result = await this.request(action.method, action.params as Record<string, unknown>);
        action.resolve(result);
      } catch (err) {
        action.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
    
    this.emit('offlineQueueProcessed', { processed: queue.length });
  }

  /** Get current reconnection attempt count */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /** Get offline queue size */
  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  /** Get last connection error */
  getLastError(): string | null {
    return this.lastError;
  }

  /** Clear offline queue (e.g., when user logs out) */
  clearOfflineQueue() {
    const count = this.offlineQueue.length;
    // Reject all queued actions
    for (const action of this.offlineQueue) {
      action.reject(new Error('Connection closed - action cancelled'));
    }
    this.offlineQueue = [];
    this.emit('offlineQueueCleared', { count });
  }

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(l => {
      try { l(data); } catch (e) { console.error('[Gateway] Listener error:', e); }
    });
  }

  getState(): ConnectionState { return this.state; }
  getSessionKey(): string { return this.sessionKey; }
  
  setSessionKey(key: string) {
    this.sessionKey = key;
    // Fire onError for any in-flight callbacks from the old session
    for (const [runId, cb] of this.runCallbacks) {
      try { cb.onError?.('Session changed', {}); } catch { /* ignore */ }
      this.activeRunIds.delete(runId);
    }
    this.runCallbacks.clear();
    this.activeRunIds.clear();
    logger.debug('[Gateway] Session key changed to:', key);
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
    return this.request<{ sessions: SessionInfo[] }>('sessions.list', {});
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
    
    const result = await this.request<{ status?: string; error?: string }>('send', {
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
    return new Promise((resolve, reject) => {
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

      // Helper: capture runId from first event that carries one
      const captureRunId = (data: ChatEventData) => {
        if (!ourRunId && data.runId) {
          ourRunId = data.runId;
          logger.debug('[Gateway] Captured runId from event:', ourRunId);
        }
      };

      // Helper: reject events from other sessions
      const isOurEvent = (data: ChatEventData): boolean => {
        if (ourRunId && data.runId && data.runId !== ourRunId) return false;
        return true;
      };

      // Delta accumulator — append-only streaming content
      const unsub2 = this.on('chat.delta', (_event: string, data: ChatEventData) => {
        captureRunId(data);
        if (!isOurEvent(data)) return;
        if (data.delta) responseContent += data.delta;
      });

      // Final message — authoritative full content replaces accumulated deltas
      const unsub3 = this.on('chat.message', (_event: string, data: ChatEventData) => {
        captureRunId(data);
        if (!isOurEvent(data)) return;
        if (data.content) responseContent = data.content;
        finish(responseContent);
      });

      // Unified chat event — only used for final-state detection (no content mutation)
      const unsub1 = this.on('chat', (_event: string, data: ChatEventData) => {
        captureRunId(data);
        if (!isOurEvent(data)) return;

        if (data.state === 'final' || data.final) {
          // If chat.message already set authoritative content, use it; otherwise use what we accumulated
          // Extract ALL text blocks, not just the first one (handles thinking blocks)
          let text = '';
          if (data.message?.content && Array.isArray(data.message.content)) {
            text = data.message.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');
          } else if (data.content) {
            text = data.content;
          }
          if (text && !responseContent) responseContent = text;
          logger.debug('[Gateway] Chat final received for runId:', ourRunId, 'content:', responseContent.slice(0, 100));
          finish(responseContent);
        }
      });

      const unsub4 = this.on('chat.end', () => {
        finish(responseContent);
      });
      
      const unsub5 = this.on('chat.error', (_event: string, data: ChatErrorData) => {
        fail(new Error(data.message || data.error || 'Chat error'));
      });

      // Timeout after 60 seconds (if deltas are streaming, content will be non-empty)
      const timeout = setTimeout(() => {
        if (responseContent) {
          finish(responseContent);
        } else {
          fail(new Error('Response timeout'));
        }
      }, 60000);

      // Kick off the async request without making the executor itself async
      void (async () => {
        try {
          logger.debug('[Gateway] sendChat calling request...');
          const result = await this.request<{ runId?: string; content?: string }>('chat.send', {
            message,
            sessionKey: this.sessionKey,
            idempotencyKey,
          });
          logger.debug('[Gateway] sendChat request returned:', JSON.stringify(result));

          // Capture runId to filter streaming events
          if (result?.runId) {
            ourRunId = result.runId;
            logger.debug('[Gateway] Tracking runId:', ourRunId);
          }

          // If we got a direct response (non-streaming), use it
          if (result?.content) {
            clearTimeout(timeout);
            finish(result.content);
          }
          // Otherwise wait for streaming events
          logger.debug('[Gateway] sendChat waiting for streaming events for runId:', ourRunId);
        } catch (e: unknown) {
          // '[Gateway] sendChat error:', e;
          clearTimeout(timeout);
          fail(e instanceof Error ? e : new Error(String(e)));
        }
      })();
    });
  }

  // Fire-and-forget send for streaming UI — returns runId for event filtering
  async sendChatStreaming(message: string): Promise<string | undefined> {
    const idempotencyKey = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await this.request<{ runId?: string }>('chat.send', {
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
    const result = await this.request<{ runId?: string }>('chat.send', {
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
    return this.request<{ jobs: CronJob[] }>('cron.list', { includeDisabled: true });
  }
  async getCronStatus() {
    return this.request('cron.status', {});
  }
  async addCronJob(job: Record<string, unknown>) {
    return this.request('cron.add', job);
  }
  async updateCronJob(id: string, patch: Record<string, unknown>) {
    return this.request('cron.update', { id, patch });
  }
  async removeCronJob(id: string) {
    return this.request('cron.remove', { id });
  }
  async runCronJob(id: string, mode: 'force' | 'due' = 'force') {
    return this.request('cron.run', { id, mode });
  }
  async getCronRuns(id: string, limit = 20) {
    return this.request<{ entries: CronRunEntry[] }>('cron.runs', { id, limit });
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
    return this.request<{ nodes: NodeInfo[] }>('node.list', {});
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
    return this.request<{ exists: boolean; valid: boolean; hash: string; config: ConfigData; raw: string; issues?: ConfigIssues[] }>('config.get', {});
  }
  async getConfigSchema() {
    return this.request<{ schema: Record<string, unknown>; uiHints: Record<string, unknown>; version: string }>('config.schema', {});
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
if (typeof window !== 'undefined' && window.clawdbot?.gateway?.onBroadcast) {
  window.clawdbot.gateway.onBroadcast((broadcastData: { type: string; event: string; payload: any }) => {
    logger.debug('[Gateway] Received broadcast from main:', broadcastData.event);
    // Emit the event locally to all listeners
    if (broadcastData.event && broadcastData.payload) {
      gateway['emit'](broadcastData.event, broadcastData.payload);
    }
  });
}

ensureGatewayToken();
gateway.connect();
