import { useState, useEffect } from 'react'; // TEST
import { Inbox, Loader, Wifi, WifiOff, Activity } from 'lucide-react';
import { gateway, ConnectionState } from '../lib/gateway';
import { FocusModeIndicator, FocusModeSelector, useFocusMode } from './FocusMode';
import { showToast } from './Toast';
import PlatformHealthDashboard from './PlatformHealthDashboard';

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
  pendingInbox: number;
  inProgressTasks: number;
}

type PlatformStatus = 'ok' | 'degraded' | 'error';

interface TopBarProps {
  onNavigate?: (view: any) => void;
  sidebarWidth?: number;
}

export default function TopBar({ sidebarWidth = 208 }: TopBarProps) {
  const [status, setStatus] = useState<SystemStatus>({
    watcherRunning: false,
    killSwitchOn: true,
    pendingInbox: 0,
    inProgressTasks: 0,
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  const { focusMode, setFocusMode } = useFocusMode();
  const [focusSelectorOpen, setFocusSelectorOpen] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>('ok');
  const [healthDashboardOpen, setHealthDashboardOpen] = useState(false);

  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state, attempts }: { state: ConnectionState; attempts?: number }) => {
      setConnectionState(state);
      if (attempts !== undefined) {
        setReconnectAttempts(attempts);
      }
    });
    return () => { unsub(); };
  }, []);

  // Show toast on connection lost
  useEffect(() => {
    const unsubLost = gateway.on('connectionLost', ({ code, attempts }: { code: number; attempts: number }) => {
      showToast('error', 'Connection lost', `Gateway disconnected (code: ${code}). Retrying... (${attempts})`);
    });
    const unsubError = gateway.on('connectionError', ({ attempts }: { attempts: number }) => {
      showToast('error', 'Connection error', `Gateway connection failed. Retrying... (${attempts})`);
    });
    const unsubConnect = gateway.on('connect', () => {
      if (reconnectAttempts > 0) {
        showToast('success', 'Connected', 'Gateway connection restored');
      }
    });
    const unsubQueued = gateway.on('actionQueued', ({ queueSize }: { queueSize: number }) => {
      setOfflineQueueSize(queueSize);
      showToast('info', 'Offline mode', `Action queued (${queueSize} pending). Will sync when reconnected.`);
    });
    const unsubProcessed = gateway.on('offlineQueueProcessed', ({ processed }: { processed: number }) => {
      setOfflineQueueSize(0);
      if (processed > 0) {
        showToast('success', 'Sync complete', `${processed} queued actions synced`);
      }
    });
    return () => {
      unsubLost();
      unsubError();
      unsubConnect();
      unsubQueued();
      unsubProcessed();
    };
  }, [reconnectAttempts]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setStatus({
            watcherRunning: data?.watcherRunning ?? true,
            killSwitchOn: data?.killSwitchOn ?? false,
            inProgressTasks: data?.inProgressTasks ?? 0,
          } as unknown as SystemStatus);
        }
      } catch {
        // Status check failed
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Poll every 60s (was 10s)
    return () => clearInterval(interval);
  }, []);

  // Platform health status indicator — polls /api/health/metrics every 60s
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health/metrics');
        if (!res.ok) { setPlatformStatus('error'); return; }
        const snap = await res.json();
        const dbOk = snap?.database?.status === 'ok';
        const agentErrors = snap?.agents?.error ?? 0;
        const apiErrors = snap?.api?.errorsLastHour ?? 0;
        const queryMs = snap?.database?.queryTimeMs ?? 0;
        if (!dbOk || agentErrors > 0) {
          setPlatformStatus('error');
        } else if (queryMs > 200 || apiErrors > 5) {
          setPlatformStatus('degraded');
        } else {
          setPlatformStatus('ok');
        }
      } catch {
        setPlatformStatus('error');
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header 
        className="drag-region fixed top-0 right-0 h-12 z-40 flex items-center justify-between px-4 bg-mission-control-surface/80 backdrop-blur-xl border-b border-mission-control-border/50 transition-all duration-200" 
        style={{ left: `${sidebarWidth}px` }}
      >
        {/* Left: Focus mode */}
        <div className="no-drag flex items-center gap-2">
          {focusMode && (
            <FocusModeIndicator mode={focusMode} onClick={() => setFocusSelectorOpen(true)} />
          )}
        </div>

        {/* Right: Connection status + Counters */}
        <div className="no-drag flex items-center gap-3">
          {/* Platform Health Indicator */}
          <button
            type="button"
            onClick={() => setHealthDashboardOpen(true)}
            title={`Platform: ${platformStatus === 'ok' ? 'Healthy' : platformStatus === 'degraded' ? 'Degraded' : 'Error'}`}
            aria-label={`Platform health: ${platformStatus}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full transition-colors hover:bg-mission-control-border min-h-[44px] min-w-[44px]"
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                platformStatus === 'ok'
                  ? 'bg-success'
                  : platformStatus === 'degraded'
                  ? 'bg-warning'
                  : 'bg-error animate-pulse'
              }`}
            />
            <Activity
              size={11}
              className={
                platformStatus === 'ok'
                  ? 'text-success'
                  : platformStatus === 'degraded'
                  ? 'text-warning'
                  : 'text-error'
              }
              aria-hidden="true"
            />
          </button>
          {/* Connection Status Indicator */}
          {connectionState !== 'connected' && (
            <span 
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full ${
                connectionState === 'disconnected' 
                  ? 'bg-error-subtle text-error' 
                  : 'bg-warning-subtle text-warning'
              }`}
              title={connectionState === 'disconnected' 
                ? `Disconnected. Reconnecting... (${reconnectAttempts})` 
                : `Connecting to gateway... (${reconnectAttempts})`}
            >
              {connectionState === 'disconnected' ? (
                <WifiOff size={12} aria-hidden="true" />
              ) : (
                <Wifi size={12} className="animate-pulse" aria-hidden="true" />
              )}
              <span>
                {connectionState === 'disconnected' ? 'Offline' : 'Connecting'}
                {reconnectAttempts > 0 && ` (${reconnectAttempts})`}
              </span>
            </span>
          )}

          {/* Offline Queue Indicator */}
          {offlineQueueSize > 0 && (
            <span 
              className="inline-flex items-center gap-1 text-[11px] font-medium text-info px-2 py-1 rounded-full bg-info-subtle"
              title={`${offlineQueueSize} actions queued for sync`}
            >
              <Loader size={12} className="animate-spin" aria-hidden="true" />
              <span className="tabular-nums">{offlineQueueSize}</span>
            </span>
          )}

          {status.pendingInbox > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning" title={`${status.pendingInbox} pending inbox items`}>
              <Inbox size={12} aria-hidden="true" />
              <span className="tabular-nums">{status.pendingInbox}</span>
            </span>
          )}

          {status.inProgressTasks > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-info" title={`${status.inProgressTasks} tasks in progress`}>
              <Loader size={12} className="animate-spin" aria-hidden="true" />
              <span className="tabular-nums">{status.inProgressTasks}</span>
            </span>
          )}
        </div>
      </header>

      {/* Focus Mode Selector */}
      <FocusModeSelector
        isOpen={focusSelectorOpen}
        onClose={() => setFocusSelectorOpen(false)}
        currentMode={focusMode}
        onSelectMode={setFocusMode}
      />

      {/* Platform Health Dashboard */}
      <PlatformHealthDashboard
        isOpen={healthDashboardOpen}
        onClose={() => setHealthDashboardOpen(false)}
      />
    </>
  );
}
