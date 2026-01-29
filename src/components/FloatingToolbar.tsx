import { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, ChevronUp, ChevronDown } from 'lucide-react';
import { useStore } from '../store/store';

/**
 * Floating collapsible toolbar — holds voice + phone controls.
 * Anchored bottom-right, always accessible.
 */
export default function FloatingToolbar({ onCallClick }: { onCallClick?: () => void }) {
  const { isMuted, toggleMuted, isMeetingActive, toggleMeeting } = useStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleCallClick = () => {
    toggleMeeting();
    onCallClick?.();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1">
      {/* Expanded controls */}
      {!collapsed && (
        <div className="flex items-center gap-1 bg-clawd-surface/95 backdrop-blur-md border border-white/[0.08] rounded-xl px-2 py-1.5 shadow-lg shadow-black/20">
          {/* Meeting indicator */}
          {isMeetingActive && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 animate-pulse mr-1">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Live
            </span>
          )}

          {/* Mute */}
          <button
            onClick={toggleMuted}
            className={`p-2 rounded-lg transition-colors ${
              isMuted 
                ? 'text-red-400 hover:bg-red-500/10' 
                : 'text-clawd-text-dim hover:text-clawd-text hover:bg-white/[0.06]'
            }`}
            title={isMuted ? 'Unmute (⌘M)' : 'Mute (⌘M)'}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          {/* Call */}
          <button
            onClick={handleCallClick}
            className={`p-2 rounded-lg transition-colors ${
              isMeetingActive 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'text-clawd-text-dim hover:text-clawd-text hover:bg-white/[0.06]'
            }`}
            title={isMeetingActive ? 'End meeting' : 'Start meeting'}
            aria-label={isMeetingActive ? 'End meeting' : 'Start meeting'}
          >
            {isMeetingActive ? <PhoneOff size={16} /> : <Phone size={16} />}
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-1.5 rounded-full bg-clawd-surface/90 border border-white/[0.08] text-clawd-text-dim hover:text-clawd-text transition-colors shadow-md"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show media controls' : 'Hide media controls'}
      >
        {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </div>
  );
}
