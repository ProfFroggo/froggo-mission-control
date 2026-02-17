/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Clock, Calendar, Moon, Sunrise, Coffee, AlertCircle, Trash2 } from 'lucide-react';
import BaseModal, { BaseModalHeader, BaseModalBody, BaseModalFooter } from './BaseModal';

interface SnoozeModalProps {
  sessionKey: string;
  sessionName: string;
  onClose: () => void;
}

interface SnoozeData {
  id: number;
  session_id: string;
  snooze_until: number;
  snooze_reason?: string;
  reminder_sent: number;
  created_at: number;
  updated_at: number;
}

const QUICK_OPTIONS = [
  { label: '1 Hour', icon: Clock, hours: 1 },
  { label: '3 Hours', icon: Coffee, hours: 3 },
  { label: 'Tonight (9 PM)', icon: Moon, custom: (now: Date) => {
    const target = new Date(now);
    target.setHours(21, 0, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }},
  { label: 'Tomorrow (9 AM)', icon: Sunrise, custom: (now: Date) => {
    const target = new Date(now);
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    return target.getTime();
  }},
  { label: 'Next Week', icon: Calendar, days: 7 },
];

export default function SnoozeModal({ sessionKey, sessionName, onClose }: SnoozeModalProps) {
  const [currentSnooze, setCurrentSnooze] = useState<SnoozeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCurrentSnooze();
  }, [sessionKey]);

  const loadCurrentSnooze = async () => {
    try {
      setLoading(true);
      const result = await window.clawdbot!.snooze.get(sessionKey);
      if (result.success && result.snooze) {
        // Convert SnoozeEntry to SnoozeData format
        const snoozeData: SnoozeData = {
          id: 0,
          session_id: result.snooze.sessionKey,
          snooze_until: new Date(result.snooze.until).getTime(),
          snooze_reason: result.snooze.snooze_reason || result.snooze.reason,
          reminder_sent: 0,
          created_at: result.snooze.createdAt || Date.now(),
          updated_at: Date.now(),
        };
        setCurrentSnooze(snoozeData);
        setReason(snoozeData.snooze_reason || '');
      }
    } catch (err) {
      // '[SnoozeModal] Failed to load current snooze:', err;
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSnooze = async (option: typeof QUICK_OPTIONS[0]) => {
    const now = new Date();
    let snoozeUntil: number;

    if (option.custom) {
      snoozeUntil = option.custom(now);
    } else if (option.hours) {
      snoozeUntil = now.getTime() + (option.hours * 60 * 60 * 1000);
    } else if (option.days) {
      snoozeUntil = now.getTime() + (option.days * 24 * 60 * 60 * 1000);
    } else {
      return;
    }

    await setSnooze(snoozeUntil);
  };

  const handleCustomSnooze = async () => {
    if (!customDate || !customTime) {
      setError('Please select both date and time');
      return;
    }

    const snoozeUntil = new Date(`${customDate}T${customTime}`).getTime();
    
    if (snoozeUntil <= Date.now()) {
      setError('Snooze time must be in the future');
      return;
    }

    await setSnooze(snoozeUntil);
  };

  const setSnooze = async (snoozeUntil: number) => {
    try {
      setSubmitting(true);
      setError('');

      const result = await window.clawdbot!.snooze.set(sessionKey, String(snoozeUntil), reason || undefined);
      
      if (result.success) {
        // Snooze set successfully
        onClose();
      } else {
        setError(result.error || 'Failed to set snooze');
      }
    } catch (err: unknown) {
      // '[SnoozeModal] Failed to set snooze:', err;
      setError(err.message || 'Failed to set snooze');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsnooze = async () => {
    try {
      setSubmitting(true);
      setError('');

      const result = await window.clawdbot!.snooze.unset(sessionKey);
      
      if (result.success) {
        // Unsnooze successful
        onClose();
      } else {
        setError(result.error || 'Failed to unsnooze');
      }
    } catch (err: unknown) {
      // '[SnoozeModal] Failed to unsnooze:', err;
      setError(err.message || 'Failed to unsnooze');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSnoozeTime = (timestamp: number): string => {
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

  const isExpired = currentSnooze && currentSnooze.snooze_until <= Date.now();

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      size="md"
      ariaLabel="Snooze Conversation"
    >
      <BaseModalHeader
        title="Snooze Conversation"
        icon={<Clock size={20} className="text-clawd-accent" />}
        onClose={onClose}
      />

      <BaseModalBody>
        {/* Session Name */}
        <div className="mb-4 p-3 bg-clawd-bg rounded-lg">
          <p className="text-sm text-clawd-text-dim">Session</p>
          <p className="font-medium truncate">{sessionName}</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-clawd-text-dim">
            <Clock size={32} className="mx-auto mb-2 animate-spin" />
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* Current Snooze Status */}
            {currentSnooze && (
              <div className={`mb-4 p-3 rounded-lg border-2 ${
                isExpired 
                  ? 'bg-error-subtle border-error-border' 
                  : 'bg-warning-subtle border-warning-border'
              }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className={isExpired ? 'text-error mt-0.5' : 'text-warning mt-0.5'} />
                  <div className="flex-1">
                    <p className={`font-medium ${isExpired ? 'text-error' : 'text-warning'}`}>
                      {isExpired ? '⏰ Reminder!' : 'Currently Snoozed'}
                    </p>
                    <p className="text-sm text-clawd-text-dim mt-1">
                      {isExpired ? 'Expired ' : 'Until '}{formatSnoozeTime(currentSnooze.snooze_until)}
                    </p>
                    {currentSnooze.snooze_reason && (
                      <p className="text-sm text-clawd-text-dim mt-1 italic">
                        &quot;{currentSnooze.snooze_reason}&quot;
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleUnsnooze}
                    disabled={submitting}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-error-subtle text-error border border-error-border hover:bg-error-subtle rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Quick Options */}
            <div className="mb-4">
              <p className="text-sm font-medium text-clawd-text-dim mb-2">Quick Snooze</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.label}
                      onClick={() => handleQuickSnooze(option)}
                      disabled={submitting}
                      type="button"
                      className="flex items-center gap-2 p-3 bg-clawd-bg hover:bg-clawd-border border border-clawd-border rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Icon size={16} className="text-clawd-accent" />
                      <span className="text-sm">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom DateTime */}
            <div className="mb-4 p-3 bg-clawd-bg rounded-lg border border-clawd-border">
              <p className="text-sm font-medium text-clawd-text-dim mb-3">Custom Time</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label htmlFor="snooze-date" className="text-xs text-clawd-text-dim block mb-1">Date</label>
                  <input
                    id="snooze-date"
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-clawd-surface border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label htmlFor="snooze-time" className="text-xs text-clawd-text-dim block mb-1">Time</label>
                  <input
                    id="snooze-time"
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full bg-clawd-surface border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
                  />
                </div>
              </div>
              <button
                onClick={handleCustomSnooze}
                disabled={submitting || !customDate || !customTime}
                type="button"
                className="w-full px-4 py-2 bg-clawd-accent hover:bg-clawd-accent-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Set Custom Snooze
              </button>
            </div>

            {/* Optional Reason */}
            <div className="mb-4">
              <label htmlFor="snooze-reason" className="text-sm font-medium text-clawd-text-dim block mb-2">
                Reason (Optional)
              </label>
              <input
                id="snooze-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Waiting for response, Follow up later..."
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-clawd-accent"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-error-subtle border border-error-border rounded-lg">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}
          </>
        )}
      </BaseModalBody>

      <BaseModalFooter align="right">
        <button
          onClick={onClose}
          type="button"
          className="px-4 py-2 bg-clawd-border hover:bg-clawd-bg text-clawd-text rounded-lg transition-colors"
        >
          Cancel
        </button>
      </BaseModalFooter>
    </BaseModal>
  );
}
