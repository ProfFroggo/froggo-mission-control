// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Flex, Box } from '@radix-ui/themes';

interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

interface AgentActivityTimelineProps {
  agentId: string;
}

export default function AgentActivityTimeline({ agentId }: AgentActivityTimelineProps) {
  const [days, setDays] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Fetch task_activity for this agent, last 7 days
    fetch(`/api/agents/${agentId}/activity-timeline`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.days)) {
          setDays(data.days);
        } else {
          // Build empty 7-day array as fallback
          setDays(buildEmptyDays());
        }
      })
      .catch(() => { if (!cancelled) setDays(buildEmptyDays()); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [agentId]);

  if (loading) {
    return (
      <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
        <Calendar size={12} />
        <span>Loading activity...</span>
      </Flex>
    );
  }

  const maxCount = Math.max(...days.map(d => d.count), 1);

  const getIntensityClass = (count: number): string => {
    if (count === 0) return 'bg-mission-control-border/40';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'bg-mission-control-accent/25';
    if (ratio < 0.5)  return 'bg-mission-control-accent/50';
    if (ratio < 0.75) return 'bg-mission-control-accent/75';
    return 'bg-mission-control-accent';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isToday = (dateStr: string) => {
    return dateStr === new Date().toISOString().slice(0, 10);
  };

  return (
    <Box className="space-y-1">
      <Flex align="center" gap="1" mb="2" className="text-xs text-mission-control-text-dim">
        <Calendar size={11} />
        <span>7-day activity</span>
      </Flex>
      <Flex align="end" gap="1" className="relative">
        {days.map((day) => (
          <Flex key={day.date} direction="column" align="center" gap="1" className="relative flex-1">
            <div
              className={`w-full rounded transition-colors cursor-default ${getIntensityClass(day.count)} ${isToday(day.date) ? 'ring-1 ring-mission-control-accent/60' : ''}`}
              style={{ height: 24 }}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
            />
            <span className="text-[9px] text-mission-control-text-dim/60 leading-none">
              {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
            </span>
          </Flex>
        ))}

        {/* Tooltip */}
        {hoveredDay && (
          <Box className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 px-2 py-1 bg-mission-control-bg0 border border-mission-control-border rounded text-xs whitespace-nowrap shadow-lg pointer-events-none">
            {formatDate(hoveredDay.date)}: {hoveredDay.count} {hoveredDay.count === 1 ? 'action' : 'actions'}
          </Box>
        )}
      </Flex>
      <Flex align="center" justify="between" mt="1" className="text-[9px] text-mission-control-text-dim/50">
        <span>Less</span>
        <Flex align="center" gap="1">
          {['bg-mission-control-border/40', 'bg-mission-control-accent/25', 'bg-mission-control-accent/50', 'bg-mission-control-accent/75', 'bg-mission-control-accent'].map((cls, i) => (
            <Box key={i} className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
          ))}
        </Flex>
        <span>More</span>
      </Flex>
    </Box>
  );
}

function buildEmptyDays(): DayActivity[] {
  const result: DayActivity[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return result;
}
