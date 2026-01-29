import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Activity, Lock, Inbox, Loader } from 'lucide-react';
import { useStore } from '../store/store';
import { gateway, ConnectionState } from '../lib/gateway';
import { FocusModeIndicator, FocusModeSelector, useFocusMode } from './FocusMode';

interface SystemStatus {
  watcherRunning: boolean;
  killSwitchOn: boolean;
  pendingInbox: number;
  inProgressTasks: number;
}

interface TopBarProps {
  onCallClick?: () => void;
  onNavigate?: (view: string) => void;
  sidebarWidth?: number;
}

/** Compact connection dot — green/yellow/red with tooltip */
function ConnectionDot({ state }: { state: ConnectionState }) {
  const color = state === 'connected' ? 'bg-green-400' : 
    (state === 'connecting' || state === 'authenticating') ? 'bg-yellow-400 animate-pulse' : 'bg-red-400';
  const label = state === 'connected' ? 'Online' : 
    state === 'connecting' ? 'Connecting' : 
    state === 'authenticating' ? 'Authenticating' : 'Offline';
  
  return (
    <div
      className={`w-2 h-2 rounded-full ${color} flex-shrink-0`}
      title={`Gateway: ${label}`}
      aria-label={`Gateway connection: ${label}`}
      role="status"
    />
  );
}

export default function TopBar({ onCallClick, onNavigate, sidebarWidth = 208 }: TopBarProps) {
  const { isMuted, toggleMuted, isMeetingActive, toggleMeeting } = useStore();
  const [status, setStatus] = useState<SystemStatus>({
    watcherRunning: false,
    killSwitchOn: true,
    pendingInbox: 0,
    inProgressTasks: 0,
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
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

  const handleCallClick = () => {
    toggleMeeting();
    onCallClick?.();
  };

  // Only show attention-worthy items (not normal/healthy states)
  const showKillSwitch = status.killSwitchOn;
  const showWatcherDown = !status.watcherRunning;

  return (
    <header 
      className="drag-region fixed top-0 right-0 h-11 z-50 flex items-center justify-between px-3 bg-clawd-bg/80 backdrop-blur-sm border-b border-white/[0.04] transition-all duration-200" 
      style={{ left: `${sidebarWidth}px` }}
      role="banner"
      aria-label="Top navigation bar"
    >
      {/* Left: Status indicators — only show what needs attention */}
      <div className="no-drag flex items-center gap-1.5" role="status" aria-label="System status">
        <ConnectionDot state={connectionState} />

        {showWatcherDown && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400">
            <Activity size={12} aria-hidden="true" />
            <span>Watcher down</span>
          </div>
        )}

        {showKillSwitch && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400">
            <Lock size={12} aria-hidden="true" />
            <span>Blocked</span>
          </div>
        )}

        {focusMode && (
          <FocusModeIndicator mode={focusMode} onClick={() => setFocusSelectorOpen(true)} />
        )}

        {status.pendingInbox > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-yellow-500/10 text-yellow-400">
            <Inbox size={12} aria-hidden="true" />
            <span className="tabular-nums">{status.pendingInbox}</span>
          </div>
        )}

        {status.inProgressTasks > 0 && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-400">
            <Loader size={12} className="animate-spin" aria-hidden="true" />
            <span className="tabular-nums">{status.inProgressTasks}</span>
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="no-drag flex items-center gap-1.5">
        {/* Meeting indicator (only when active) */}
        {isMeetingActive && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-red-500/15 text-red-400 animate-pulse">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full" aria-hidden="true" />
            <span>Meeting</span>
          </div>
        )}

        {/* Mute button */}
        <button
          onClick={toggleMuted}
          className={`p-1.5 rounded-md transition-colors ${
            isMuted 
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
              : 'text-clawd-text-dim hover:text-clawd-text hover:bg-white/[0.06]'
          }`}
          title={isMuted ? 'Unmute (⌘M)' : 'Mute (⌘M)'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={isMuted}
        >
          {isMuted ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
        </button>

        {/* Call button */}
        <button
          onClick={handleCallClick}
          className={`p-1.5 rounded-md transition-colors ${
            isMeetingActive 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'text-clawd-text-dim hover:text-clawd-text hover:bg-white/[0.06]'
          }`}
          title={isMeetingActive ? 'End meeting' : 'Start meeting'}
          aria-label={isMeetingActive ? 'End meeting' : 'Start meeting'}
          aria-pressed={isMeetingActive}
        >
          {isMeetingActive ? <PhoneOff size={15} aria-hidden="true" /> : <Phone size={15} aria-hidden="true" />}
        </button>

        {/* Home */}
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="text-lg cursor-pointer hover:scale-110 transition-transform p-1 leading-none"
          title="Dashboard"
          aria-label="Go to dashboard"
        >
          🐸
        </button>
      </div>

      {/* Focus Mode Selector */}
      <FocusModeSelector
        isOpen={focusSelectorOpen}
        onClose={() => setFocusSelectorOpen(false)}
        currentMode={focusMode}
        onSelectMode={setFocusMode}
      />
    </header>
  );
}
