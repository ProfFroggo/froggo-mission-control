import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Activity, Lock, Unlock, Inbox, Loader, Wifi, WifiOff } from 'lucide-react';
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
}

export default function TopBar({ onCallClick, onNavigate }: TopBarProps) {
  const { isMuted, toggleMuted, isMeetingActive, toggleMeeting } = useStore();
  const [status, setStatus] = useState<SystemStatus>({
    watcherRunning: false,
    killSwitchOn: true,
    pendingInbox: 0,
    inProgressTasks: 0,
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const { focusMode, setFocusMode, config } = useFocusMode();
  const [focusSelectorOpen, setFocusSelectorOpen] = useState(false);

  // Track gateway connection
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    return () => {
      unsub();
    };
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
    const interval = setInterval(checkStatus, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  const handleCallClick = () => {
    toggleMeeting();
    onCallClick?.();
  };

  return (
    <div className="drag-region fixed top-0 right-0 h-12 z-50 flex items-center justify-between px-4" style={{ left: '208px' }}>
      {/* System Status Indicators */}
      <div className="no-drag flex items-center gap-3">
        {/* Gateway Connection */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
          connectionState === 'connected'
            ? 'bg-green-500/10 text-green-400'
            : connectionState === 'connecting' || connectionState === 'authenticating'
            ? 'bg-yellow-500/10 text-yellow-400'
            : 'bg-red-500/10 text-red-400'
        }`}>
          {connectionState === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>
            {connectionState === 'connected' ? 'Online' : 
             connectionState === 'connecting' ? 'Connecting...' :
             connectionState === 'authenticating' ? 'Auth...' : 'Offline'}
          </span>
        </div>

        {/* OX LITE: Removed Watcher and Kill Switch status - not relevant for Ox */}

        {/* Focus Mode */}
        {focusMode && (
          <FocusModeIndicator mode={focusMode} onClick={() => setFocusSelectorOpen(true)} />
        )}

        {/* Pending Inbox */}
        {status.pendingInbox > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-yellow-500/10 text-yellow-400">
            <Inbox size={12} />
            <span>{status.pendingInbox} pending</span>
          </div>
        )}

        {/* In-Progress Tasks */}
        {status.inProgressTasks > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-blue-500/10 text-blue-400">
            <Loader size={12} className="animate-spin" />
            <span>{status.inProgressTasks} running</span>
          </div>
        )}
      </div>

      {/* Right side controls */}
      <div className="no-drag flex items-center gap-2">
      {/* Mute status indicator */}
      {isMuted && (
        <div className="no-drag flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
          <MicOff size={14} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">Muted</span>
          <span className="text-xs text-red-400/60">⌘M</span>
        </div>
      )}
      
      {/* Meeting active indicator */}
      {isMeetingActive && !isMuted && (
        <div className="no-drag flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full animate-pulse">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-xs text-red-400 font-medium">Meeting Active</span>
        </div>
      )}

      {/* Mute button - always visible */}
      <button
        onClick={toggleMuted}
        className={`no-drag p-2 rounded-lg transition-all duration-200 ${
          isMuted 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
            : 'bg-clawd-surface/80 text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-surface'
        }`}
        title={isMuted ? 'Unmute (⌘M)' : 'Mute (⌘M)'}
      >
        {isMuted ? (
          <MicOff size={18} />
        ) : (
          <Mic size={18} />
        )}
      </button>

      {/* Call button - triggers meeting mode */}
      <button
        onClick={handleCallClick}
        className={`no-drag p-2 rounded-lg transition-all duration-200 ${
          isMeetingActive 
            ? 'bg-red-500 text-white animate-pulse hover:bg-red-600' 
            : 'bg-clawd-accent text-white hover:bg-clawd-accent/80'
        }`}
        title={isMeetingActive ? 'End meeting' : 'Start meeting mode'}
      >
        {isMeetingActive ? (
          <PhoneOff size={18} />
        ) : (
          <Phone size={18} />
        )}
      </button>

      {/* Frog emoji button - far right */}
      <button
        onClick={() => onNavigate?.('dashboard')}
        className="no-drag text-2xl cursor-pointer hover:scale-110 transition-transform p-1"
        title="Dashboard"
      >
        🐂
      </button>
      </div>

      {/* Focus Mode Selector */}
      <FocusModeSelector
        isOpen={focusSelectorOpen}
        onClose={() => setFocusSelectorOpen(false)}
        currentMode={focusMode}
        onSelectMode={setFocusMode}
      />
    </div>
  );
}
