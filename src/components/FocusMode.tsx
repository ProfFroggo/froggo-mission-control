import { useState, useEffect } from 'react';
import { Moon, Coffee, Home, Briefcase, X, Clock, BellOff } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
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
    color: 'bg-[var(--color-info)]',
    holdApprovals: false,
    muteNotifications: false,
  },
  {
    type: 'personal',
    icon: Coffee,
    label: 'Personal',
    description: 'Relaxed, non-urgent only',
    color: 'bg-[var(--color-review)]',
    holdApprovals: false,
    muteNotifications: true,
  },
  {
    type: 'family',
    icon: Home,
    label: 'Family Time',
    description: 'Only urgent notifications',
    color: 'bg-[var(--color-success)]',
    holdApprovals: true,
    muteNotifications: true,
  },
  {
    type: 'dnd',
    icon: Moon,
    label: 'Do Not Disturb',
    description: 'Complete silence',
    color: 'bg-[var(--color-error)]',
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
    <Button
      variant="solid"
      color="violet"
      size="1"
      onClick={onClick}
    >
      <Icon size={14} />
      <span>{config.label}</span>
    </Button>
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

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (mode: FocusModeType) => {
    onSelectMode(mode);
    showToast('info', mode ? `${modes.find(m => m.type === mode)?.label} activated` : 'Focus mode off');
    onClose();
  };

  return (
    <Flex align="center" justify="center" p="4" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <Flex align="center" justify="between" className="px-4 py-3 border-b border-mission-control-border">
          <div>
            <h2 className="text-sm font-semibold text-mission-control-text">Focus Mode</h2>
            <p className="text-xs text-mission-control-text-dim">Control notifications and approvals</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </Flex>

        {/* Mode Options */}
        <div className="p-4 space-y-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = currentMode === mode.type;

            return (
              <button
                type="button"
                key={mode.type}
                onClick={() => handleSelect(mode.type)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-mission-control-accent bg-mission-control-accent/10'
                    : 'border-mission-control-border hover:border-mission-control-accent/50'
                }`}
              >
                <Flex align="center" gap="3">
                  <div className={`p-2 rounded-lg ${mode.color} text-white`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-mission-control-text">{mode.label}</div>
                    <div className="text-xs text-mission-control-text-dim">{mode.description}</div>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-mission-control-text-dim">
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
                </Flex>
              </button>
            );
          })}
        </div>

        {/* Turn Off */}
        {currentMode && (
          <div className="p-4 border-t border-mission-control-border">
            <Button
              variant="surface"
              color="gray"
              size="2"
              onClick={() => handleSelect(null)}
              className="w-full"
            >
              Turn off Focus Mode
            </Button>
          </div>
        )}

        {/* Duration (optional) */}
        <div className="p-4 border-t border-mission-control-border bg-mission-control-bg rounded-b-2xl">
          <div className="text-xs text-mission-control-text-dim mb-2">Auto-disable after:</div>
          <Flex gap="2">
            {[30, 60, 120, null].map((mins) => (
              <Button
                key={mins ?? 'never'}
                variant={duration === mins ? 'solid' : 'surface'}
                color={duration === mins ? 'violet' : 'gray'}
                size="1"
                onClick={() => setDuration(mins)}
              >
                {mins ? `${mins}m` : 'Never'}
              </Button>
            ))}
          </Flex>
        </div>
      </div>
    </Flex>
  );
}

// Custom hook for focus mode state
export function useFocusMode() {
  const [focusMode, setFocusMode] = useState<FocusModeType>(() => {
    const saved = localStorage.getItem('focusMode');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_e) {
        // Ignore malformed saved data
      }
    }
    return null;
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
