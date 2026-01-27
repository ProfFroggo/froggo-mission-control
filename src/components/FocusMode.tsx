import { useState, useEffect } from 'react';
import { Moon, Sun, Coffee, Home, Briefcase, X, Clock, Bell, BellOff } from 'lucide-react';
import { showToast } from './Toast';

type FocusModeType = 'work' | 'personal' | 'family' | 'dnd' | null;

interface FocusModeConfig {
  type: FocusModeType;
  icon: any;
  label: string;
  description: string;
  color: string;
  holdApprovals: boolean;
  muteNotifications: boolean;
}

const modes: FocusModeConfig[] = [
  {
    type: 'work',
    icon: Briefcase,
    label: 'Work Mode',
    description: 'Focus on work tasks',
    color: 'bg-blue-500',
    holdApprovals: false,
    muteNotifications: false,
  },
  {
    type: 'personal',
    icon: Coffee,
    label: 'Personal',
    description: 'Relaxed, non-urgent only',
    color: 'bg-purple-500',
    holdApprovals: false,
    muteNotifications: true,
  },
  {
    type: 'family',
    icon: Home,
    label: 'Family Time',
    description: 'Only urgent notifications',
    color: 'bg-green-500',
    holdApprovals: true,
    muteNotifications: true,
  },
  {
    type: 'dnd',
    icon: Moon,
    label: 'Do Not Disturb',
    description: 'Complete silence',
    color: 'bg-red-500',
    holdApprovals: true,
    muteNotifications: true,
  },
];

interface FocusModeIndicatorProps {
  mode: FocusModeType;
  onClick: () => void;
}

export function FocusModeIndicator({ mode, onClick }: FocusModeIndicatorProps) {
  if (!mode) return null;
  
  const config = modes.find(m => m.type === mode);
  if (!config) return null;
  
  const Icon = config.icon;
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-white ${config.color} hover:opacity-90 transition-opacity`}
    >
      <Icon size={12} />
      <span>{config.label}</span>
    </button>
  );
}

interface FocusModeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: FocusModeType;
  onSelectMode: (mode: FocusModeType) => void;
}

export function FocusModeSelector({ isOpen, onClose, currentMode, onSelectMode }: FocusModeSelectorProps) {
  const [duration, setDuration] = useState<number | null>(null);
  
  if (!isOpen) return null;

  const handleSelect = (mode: FocusModeType) => {
    onSelectMode(mode);
    showToast('info', mode ? `${modes.find(m => m.type === mode)?.label} activated` : 'Focus mode off');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-clawd-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Focus Mode</h2>
            <p className="text-sm text-clawd-text-dim">Control notifications and approvals</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-clawd-border rounded-xl">
            <X size={20} />
          </button>
        </div>

        {/* Mode Options */}
        <div className="p-4 space-y-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = currentMode === mode.type;
            
            return (
              <button
                key={mode.type}
                onClick={() => handleSelect(mode.type)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  isSelected 
                    ? 'border-clawd-accent bg-clawd-accent/10' 
                    : 'border-clawd-border hover:border-clawd-accent/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${mode.color} text-white`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{mode.label}</div>
                    <div className="text-sm text-clawd-text-dim">{mode.description}</div>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-clawd-text-dim">
                    {mode.holdApprovals && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> Hold approvals
                      </span>
                    )}
                    {mode.muteNotifications && (
                      <span className="flex items-center gap-1">
                        <BellOff size={10} /> Mute notifications
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Turn Off */}
        {currentMode && (
          <div className="p-4 border-t border-clawd-border">
            <button
              onClick={() => handleSelect(null)}
              className="w-full py-3 bg-clawd-border rounded-xl text-clawd-text-dim hover:bg-clawd-border/80 transition-colors"
            >
              Turn off Focus Mode
            </button>
          </div>
        )}

        {/* Duration (optional) */}
        <div className="p-4 border-t border-clawd-border bg-clawd-bg rounded-b-2xl">
          <div className="text-xs text-clawd-text-dim mb-2">Auto-disable after:</div>
          <div className="flex gap-2">
            {[30, 60, 120, null].map((mins) => (
              <button
                key={mins ?? 'never'}
                onClick={() => setDuration(mins)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  duration === mins 
                    ? 'bg-clawd-accent text-white' 
                    : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {mins ? `${mins}m` : 'Never'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom hook for focus mode state
export function useFocusMode() {
  const [focusMode, setFocusMode] = useState<FocusModeType>(() => {
    const saved = localStorage.getItem('focusMode');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('focusMode', JSON.stringify(focusMode));
  }, [focusMode]);

  const config = focusMode ? modes.find(m => m.type === focusMode) : null;

  return {
    focusMode,
    setFocusMode,
    config,
    isHoldingApprovals: config?.holdApprovals ?? false,
    isMuted: config?.muteNotifications ?? false,
  };
}
