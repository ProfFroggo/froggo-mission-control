import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, Terminal, Activity, AlertCircle } from 'lucide-react';
import { gateway, reconnectGateway } from '../lib/gateway';
import type { ConnectionState } from '../lib/gateway';
import { showToast } from './Toast';
import { createLogger } from '../utils/logger';

const logger = createLogger('DebugTab');

export default function DebugTab() {
  const [gwState, setGwState] = useState<ConnectionState>(gateway.getState());
  const [sessions, setSessions] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [logCursor, setLogCursor] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessResult, logResult] = await Promise.all([
        gateway.getSessions().catch((err) => { logger.error('Failed to get sessions:', err); return null; }),
        gateway.tailLogs({ limit: 50 }).catch((err) => { logger.error('Failed to tail logs:', err); return null; }),
      ]);
      if (sessResult?.sessions) setSessions(sessResult.sessions);
      if (logResult?.lines) {
        setLogs(logResult.lines);
        setLogCursor(logResult.cursor);
      }
    } catch (e) {
      // 'Debug load failed:', e;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = gateway.on('stateChange', (data: any) => setGwState(data.state));
    return () => { unsub(); };
  }, [loadData]);

  const handleReconnect = () => {
    reconnectGateway();
    showToast('info', 'Reconnecting...');
  };

  const refreshLogs = async () => {
    try {
      const result = await gateway.tailLogs({ cursor: logCursor, limit: 50 });
      if (result?.lines?.length) {
        setLogs(prev => [...prev, ...result.lines].slice(-200));
        setLogCursor(result.cursor);
      }
    } catch (e) {
      // 'Failed to refresh logs:', e;
    }
  };

  const stateColor = {
    connected: 'text-success',
    connecting: 'text-warning',
    authenticating: 'text-warning',
    disconnected: 'text-error',
  };

  const stateIcon = gwState === 'connected' ? Wifi : WifiOff;
  const StateIcon = stateIcon;

  const formatTimeAgo = (ms?: number) => {
    if (!ms) return '—';
    const diff = Date.now() - ms;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Gateway Connection */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-mission-control-accent" />
            <h2 className="font-semibold">Gateway Connection</h2>
          </div>
          <button type="button" onClick={handleReconnect} className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-border rounded-lg text-sm hover:bg-mission-control-border/80">
            <RefreshCw size={14} /> Reconnect
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <StateIcon size={24} className={stateColor[gwState]} />
            <div>
              <div className={`font-medium ${stateColor[gwState]}`}>{gwState.charAt(0).toUpperCase() + gwState.slice(1)}</div>
              <div className="text-sm text-mission-control-text-dim">Session: {gateway.getSessionKey()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-mission-control-accent" />
            <h2 className="font-semibold">Active Sessions ({sessions.length})</h2>
          </div>
          <button type="button" onClick={loadData} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-border rounded-lg text-sm hover:bg-mission-control-border/80" aria-label="Refresh sessions">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="divide-y divide-mission-control-border max-h-64 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-mission-control-text-dim">No sessions</div>
          ) : sessions.map((s: any, i: number) => (
            <div key={i} className="p-3 flex items-center gap-3 hover:bg-mission-control-bg/50">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                Date.now() - (s.updatedAt || 0) < 300000 ? 'bg-success' : 'bg-mission-control-bg0'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.label || s.key || s.sessionKey}</div>
                <div className="text-xs text-mission-control-text-dim">{s.channel || s.kind || 'unknown'} • {formatTimeAgo(s.updatedAt || s.createdAt)}</div>
              </div>
              {s.model && <div className="text-xs text-mission-control-text-dim">{s.model}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Logs */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-mission-control-accent" />
            <h2 className="font-semibold">Recent Logs</h2>
          </div>
          <button type="button" onClick={refreshLogs} className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-border rounded-lg text-sm hover:bg-mission-control-border/80">
            <RefreshCw size={14} /> Load More
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2 bg-mission-control-bg font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-mission-control-text-dim">No logs</div>
          ) : logs.map((line, i) => {
            const isError = /\berror\b/i.test(line);
            const isWarn = /\bwarn/i.test(line);
            return (
              <div key={i} className={`py-0.5 px-2 ${isError ? 'text-error' : isWarn ? 'text-warning' : 'text-mission-control-text-dim'}`}>
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
