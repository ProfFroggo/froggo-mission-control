import React, { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { Button, IconButton, Badge, Flex, Text, Heading } from '@radix-ui/themes';
import { Session } from '../store/store';
import { showToast } from './Toast';

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
      showToast('warning', 'Invalid Input', 'Please select both date and time');
      return;
    }

    const dateTime = new Date(`${customDate}T${customTime}`);
    if (dateTime.getTime() <= Date.now()) {
      showToast('warning', 'Invalid Time', 'Snooze time must be in the future');
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
      <Badge
        color="orange"
        variant="soft"
        radius="full"
        size="1"
        className="cursor-pointer"
        onClick={handleUnsnooze}
        title="Click to unsnooze"
      >
        <Clock className="w-3 h-3" />
        Until {formatSnoozeTime(snoozeUntil)}
        <X className="w-3 h-3 ml-1" />
      </Badge>
    );
  }

  return (
    <>
      <Button
        size="1"
        variant="soft"
        color="gray"
        onClick={() => setShowModal(true)}
        title="Snooze conversation"
      >
        <Clock className="w-3 h-3" />
        Snooze
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-mission-control-surface rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <Flex align="center" justify="between" mb="4">
              <Heading size="4">Snooze Conversation</Heading>
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                onClick={() => setShowModal(false)}
              >
                <X className="w-5 h-5" />
              </IconButton>
            </Flex>

            {/* Reason input */}
            <div className="mb-4">
              <label htmlFor="snooze-reason" className="block text-sm font-medium text-mission-control-text mb-2">
                Reason (optional)
              </label>
              <input
                id="snooze-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you snoozing this?"
                className="w-full px-3 py-2 border border-mission-control-border rounded-lg bg-mission-control-surface text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent"
              />
            </div>

            {/* Quick options */}
            <div className="mb-4">
              <Text size="2" weight="medium" as="div" mb="2">Quick Snooze</Text>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((option) => (
                  <Button
                    key={option.label}
                    size="2"
                    variant="solid"
                    color="grass"
                    onClick={() => handleQuickSnooze(option)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom date/time */}
            <div className="mb-4">
              <label htmlFor="snooze-date" className="block text-sm font-medium text-mission-control-text mb-2">
                Custom Time
              </label>
              <div className="flex gap-2">
                <input
                  id="snooze-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-3 py-2 border border-mission-control-border rounded-lg bg-mission-control-surface text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="flex-1 px-3 py-2 border border-mission-control-border rounded-lg bg-mission-control-surface text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
              </div>
              <Button
                mt="2"
                size="2"
                variant="solid"
                color="grass"
                disabled={!customDate || !customTime}
                onClick={handleCustomSnooze}
                className="w-full"
              >
                Snooze Until Custom Time
              </Button>
            </div>

            <Button
              size="2"
              variant="surface"
              color="gray"
              onClick={() => setShowModal(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
