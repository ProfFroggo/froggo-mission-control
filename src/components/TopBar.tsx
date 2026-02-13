import { useState, useEffect } from 'react';
import { Inbox, Loader } from 'lucide-react';
import { gateway, ConnectionState } from '../lib/gateway';
import { FocusModeIndicator, FocusModeSelector, useFocusMode } from './FocusMode';

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
  pendingInbox: number;
  inProgressTasks: number;
}

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
  const [_connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const { focusMode, setFocusMode } = useFocusMode();
  const [focusSelectorOpen, setFocusSelectorOpen] = useState(false);

  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await (window as any).clawdbot?.system?.status();
        if (result?.success) {
          setStatus(result.status);
        }
      } catch (e) {
        console.error('[TopBar] Status check failed:', e);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header 
        className="drag-region fixed top-0 right-0 h-12 z-40 flex items-center justify-between px-4 bg-clawd-surface/80 backdrop-blur-xl border-b border-white/[0.08] dark:border-gray-800/50 transition-all duration-200" 
        style={{ left: `${sidebarWidth}px` }}
      >
        {/* Left: Focus mode */}
        <div className="no-drag flex items-center gap-2">
          {focusMode && (
            <FocusModeIndicator mode={focusMode} onClick={() => setFocusSelectorOpen(true)} />
          )}
        </div>

        {/* Right: Counters only */}
        <div className="no-drag flex items-center gap-3">
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
    </>
  );
}
