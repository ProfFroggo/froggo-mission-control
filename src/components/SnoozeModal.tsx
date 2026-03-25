// LEGACY: SnoozeModal uses file-level suppression for intentional stable ref patterns.
// Modal for snooze functionality - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import { Clock, Calendar, Moon, Sunrise, Coffee, AlertCircle, Trash2 } from 'lucide-react';
import { Button, Flex, TextField } from '@radix-ui/themes';
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
      const result = await fetch(`/api/notifications?action=snooze-get&sessionKey=${encodeURIComponent(sessionKey)}`).then(r => r.ok ? r.json() : { success: false });
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

      const result = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snooze-set', sessionKey, until: String(snoozeUntil), reason: reason || undefined }),
      }).then(r => r.ok ? r.json() : { success: false });
      
      if (result.success) {
        // Snooze set successfully
        onClose();
      } else {
        setError(result.error || 'Failed to set snooze');
      }
    } catch (err: unknown) {
      // '[SnoozeModal] Failed to set snooze:', err;
      setError(err instanceof Error ? err.message : 'Failed to set snooze');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsnooze = async () => {
    try {
      setSubmitting(true);
      setError('');

      const result = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snooze-unset', sessionKey }),
      }).then(r => r.ok ? r.json() : { success: false });
      
      if (result.success) {
        // Unsnooze successful
        onClose();
      } else {
        setError(result.error || 'Failed to unsnooze');
      }
    } catch (err: unknown) {
      // '[SnoozeModal] Failed to unsnooze:', err;
      setError(err instanceof Error ? err.message : 'Failed to unsnooze');
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
        icon={<Clock size={20} className="text-mission-control-accent" />}
        onClose={onClose}
      />

      <BaseModalBody>
        {/* Session Name */}
        <div className="mb-4 p-3 bg-mission-control-bg rounded-lg">
          <p className="text-sm text-mission-control-text-dim">Session</p>
          <p className="font-medium truncate">{sessionName}</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-mission-control-text-dim">
            <Clock size={32} className="mx-auto mb-2 animate-spin" />
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* Current Snooze Status */}
            {currentSnooze && (
              <div className={`mb-4 p-3 rounded-lg border-2 ${
                isExpired 
                  ? 'bg-[var(--color-error)]/10 border-[var(--color-error)]/30' 
                  : 'bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30'
              }`}>
                <Flex align="start" gap="2">
                  <AlertCircle size={16} className={isExpired ? 'text-[var(--color-error)] mt-0.5' : 'text-[var(--color-warning)] mt-0.5'} />
                  <div className="flex-1">
                    <p className={`font-medium ${isExpired ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'}`}>
                      {isExpired ? '⏰ Reminder!' : 'Currently Snoozed'}
                    </p>
                    <p className="text-sm text-mission-control-text-dim mt-1">
                      {isExpired ? 'Expired ' : 'Until '}{formatSnoozeTime(currentSnooze.snooze_until)}
                    </p>
                    {currentSnooze.snooze_reason && (
                      <p className="text-sm text-mission-control-text-dim mt-1 italic">
                        &quot;{currentSnooze.snooze_reason}&quot;
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleUnsnooze}
                    disabled={submitting}
                    type="button"
                    variant="outline"
                    color="red"
                    size="1"
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                </Flex>
              </div>
            )}

            {/* Quick Options */}
            <div className="mb-4">
              <p className="text-sm font-medium text-mission-control-text-dim mb-2">Quick Snooze</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.label}
                      onClick={() => handleQuickSnooze(option)}
                      disabled={submitting}
                      type="button"
                      variant="outline"
                      color="gray"
                      size="2"
                      className="justify-start"
                    >
                      <Icon size={16} />
                      <span className="text-sm">{option.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Custom DateTime */}
            <div className="mb-4 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
              <p className="text-sm font-medium text-mission-control-text-dim mb-3">Custom Time</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label htmlFor="snooze-date" className="text-xs text-mission-control-text-dim block mb-1">Date</label>
                  <TextField.Root
                    id="snooze-date"
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    size="2"
                    className="w-full"
                  />
                </div>
                <div>
                  <label htmlFor="snooze-time" className="text-xs text-mission-control-text-dim block mb-1">Time</label>
                  <TextField.Root
                    id="snooze-time"
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    size="2"
                    className="w-full"
                  />
                </div>
              </div>
              <Button
                onClick={handleCustomSnooze}
                disabled={submitting || !customDate || !customTime}
                type="button"
                variant="solid"
                size="2"
                className="w-full"
              >
                Set Custom Snooze
              </Button>
            </div>

            {/* Optional Reason */}
            <div className="mb-4">
              <label htmlFor="snooze-reason" className="text-sm font-medium text-mission-control-text-dim block mb-2">
                Reason (Optional)
              </label>
              <TextField.Root
                id="snooze-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Waiting for response, Follow up later..."
                size="2"
                className="w-full"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
                <p className="text-sm text-[var(--color-error)]">{error}</p>
              </div>
            )}
          </>
        )}
      </BaseModalBody>

      <BaseModalFooter align="right">
        <button
          onClick={onClose}
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          Cancel
        </button>
      </BaseModalFooter>
    </BaseModal>
  );
}
