import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { useStore } from '../store/store';

interface TopBarProps {
  onCallClick?: () => void;
}

export default function TopBar({ onCallClick }: TopBarProps) {
  const { isMuted, toggleMuted, isMeetingActive, toggleMeeting } = useStore();

  const handleCallClick = () => {
    toggleMeeting();
    onCallClick?.();
  };

  return (
    <div className="drag-region fixed top-0 right-0 h-12 z-50 flex items-center justify-end px-4 gap-2" style={{ left: '208px' }}>
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
    </div>
  );
}
