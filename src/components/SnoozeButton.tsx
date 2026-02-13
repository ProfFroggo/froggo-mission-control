import React, { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { Session } from '../store/store';

interface SnoozeButtonProps {
  session: Session;
  onSnooze: (sessionId: string, until: number, reason?: string) => void;
  onUnsnooze: (sessionId: string) => void;
  isSnoozed?: boolean;
  snoozeUntil?: number;
}

interface QuickSnoozeOption {
  label: string;
  duration: number; // milliseconds
}

const QUICK_OPTIONS: QuickSnoozeOption[] = [
  { label: '1 hour', duration: 60 * 60 * 1000 },
  { label: '3 hours', duration: 3 * 60 * 60 * 1000 },
  { label: 'Tomorrow 9am', duration: -1 }, // Special case
  { label: '1 day', duration: 24 * 60 * 60 * 1000 },
  { label: '1 week', duration: 7 * 24 * 60 * 60 * 1000 },
];

export const SnoozeButton: React.FC<SnoozeButtonProps> = ({
  session,
  onSnooze,
  onUnsnooze,
  isSnoozed = false,
  snoozeUntil,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [reason, setReason] = useState('');

  const handleQuickSnooze = (option: QuickSnoozeOption) => {
    let until: number;
    const now = Date.now();

    if (option.label === 'Tomorrow 9am') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      until = tomorrow.getTime();
    } else {
      until = now + option.duration;
    }

    onSnooze(session.key, until, reason || undefined);
    setShowModal(false);
    setReason('');
  };

  const handleCustomSnooze = () => {
    if (!customDate || !customTime) {
      alert('Please select both date and time');
      return;
    }

    const dateTime = new Date(`${customDate}T${customTime}`);
    if (dateTime.getTime() <= Date.now()) {
      alert('Snooze time must be in the future');
      return;
    }

    onSnooze(session.key, dateTime.getTime(), reason || undefined);
    setShowModal(false);
    setCustomDate('');
    setCustomTime('');
    setReason('');
  };

  const handleUnsnooze = () => {
    onUnsnooze(session.key);
  };

  const formatSnoozeTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isTomorrow) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isSnoozed && snoozeUntil) {
    return (
      <button
        onClick={handleUnsnooze}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-600 rounded hover:bg-yellow-500/30 transition-colors"
        title="Click to unsnooze"
      >
        <Clock className="w-3 h-3" />
        Until {formatSnoozeTime(snoozeUntil)}
        <X className="w-3 h-3 ml-1" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-clawd-surface text-clawd-text rounded hover:bg-clawd-border transition-colors"
        title="Snooze conversation"
      >
        <Clock className="w-3 h-3" />
        Snooze
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-clawd-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-clawd-text">
                Snooze Conversation
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-clawd-text-dim hover:text-clawd-text-dim"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reason input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you snoozing this?"
                className="w-full px-3 py-2 border border-clawd-border rounded-lg bg-clawd-surface text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick options */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Quick Snooze
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleQuickSnooze(option)}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date/time */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-clawd-text mb-2">
                Custom Time
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-3 py-2 border border-clawd-border rounded-lg bg-clawd-surface text-clawd-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="flex-1 px-3 py-2 border border-clawd-border rounded-lg bg-clawd-surface text-clawd-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleCustomSnooze}
                disabled={!customDate || !customTime}
                className="mt-2 w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-clawd-border disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Snooze Until Custom Time
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full px-4 py-2 bg-clawd-surface text-clawd-text-dim rounded-lg hover:bg-clawd-border font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};
