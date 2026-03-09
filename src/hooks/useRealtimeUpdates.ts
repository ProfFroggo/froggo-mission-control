// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useEffect, useRef } from 'react';

interface RealtimeEvents {
  tasks: Array<{ id: string; status: string; assignedTo: string; updatedAt: number }>;
  approvals: Array<{ id: string; status: string; type: string; createdAt: number }>;
  chatMessages: Array<{ id: number; roomId: string; agentId: string; timestamp: number }>;
  agentStatus: Array<{ id: string; status: string; lastActivity: number }>;
}

export function useRealtimeUpdates(
  onUpdate: (events: RealtimeEvents) => void,
  intervalMs = 3000
) {
  const lastTimestamp = useRef(Date.now());
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/events?since=${lastTimestamp.current}`);
        if (!res.ok) return;
        const events: RealtimeEvents = await res.json();
        const hasUpdates =
          events.tasks.length > 0 ||
          events.approvals.length > 0 ||
          events.chatMessages.length > 0 ||
          events.agentStatus.length > 0;
        if (hasUpdates) {
          lastTimestamp.current = Date.now();
          onUpdateRef.current(events);
        }
      } catch {}
    };

    const interval = setInterval(poll, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}
