// LEGACY: ProductivityHeatmap uses file-level suppression for intentional patterns.
// loadData is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import { Activity, Calendar } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { getProductivityHeatmap, ProductivityHeatmap as HeatmapData } from '../services/analyticsService';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ProductivityHeatmap({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<HeatmapData | null>(null);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const heatmap = await getProductivityHeatmap(days);
      setData(heatmap);
    } catch (error) {
      // 'Failed to load productivity heatmap:', error;
    } finally {
      setLoading(false);
    }
  };

  // Aggregate data by day and hour
  const aggregatedData = DAYS.map((_, dayIndex) => {
    const dayData = HOURS.map((hour) => {
      const cells = data.filter(
        (d) => d.dayOfWeek === dayIndex && d.hour === hour
      );
      return cells.reduce((sum, cell) => sum + cell.activityCount, 0);
    });
    return dayData;
  });

  // Find max activity for color scaling
  const maxActivity = Math.max(
    ...aggregatedData.flat(),
    1
  );

  const getColor = (value: number) => {
    if (value === 0) return 'bg-mission-control-border/40';
    const intensity = (value / maxActivity) * 100;
    if (intensity < 20) return 'bg-[var(--color-success)]/15';
    if (intensity < 40) return 'bg-[var(--color-success)]/30';
    if (intensity < 60) return 'bg-[var(--color-success)]/50';
    if (intensity < 80) return 'bg-[var(--color-success)]/70';
    return 'bg-[var(--color-success)]';
  };

  const peakDay = DAYS[
    aggregatedData.indexOf(
      aggregatedData.reduce((max, day) => 
        day.reduce((a, b) => a + b, 0) > max.reduce((a, b) => a + b, 0) ? day : max
      )
    )
  ];

  const peakHourIndex = aggregatedData.flat().indexOf(maxActivity);
  const peakHour = HOURS[peakHourIndex % 24];

  const totalActivity = data.reduce((sum, d) => sum + d.activityCount, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-mission-control-border/20 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[280px] bg-mission-control-border/20 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <Flex align="center" justify="between" className="mb-6">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2 text-mission-control-text">
            <Activity className="text-mission-control-accent" size={16} />
            Productivity Heatmap
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-mission-control-text-dim mt-1">
            Activity patterns by day and hour
          </p>
        </div>
      </Flex>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Total Activity</div>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text">{totalActivity}</div>
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Peak Day</div>
          <div className="text-2xl font-bold text-mission-control-text">{peakDay}</div>
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Peak Hour</div>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text">
            {peakHour}:00 – {peakHour + 1}:00
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
        <div>
          {/* Hour labels */}
          <div className="grid mb-2" style={{ gridTemplateColumns: '3rem repeat(24, 1fr)' }}>
            <div /> {/* Day label spacer */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-center text-xs text-mission-control-text-dim"
              >
                {hour % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="grid items-center mb-1" style={{ gridTemplateColumns: '3rem repeat(24, 1fr)' }}>
              <div className="text-xs text-mission-control-text-dim font-medium">
                {day}
              </div>
              {aggregatedData[dayIndex].map((value, hour) => (
                <div
                  key={hour}
                  className={`aspect-square mx-px rounded cursor-pointer transition-[colors,transform] hover:scale-110 hover:ring-2 hover:ring-mission-control-accent max-h-8 ${getColor(value)}`}
                  title={`${day} ${hour}:00 - ${value} activities`}
                  role="presentation"
                  onMouseEnter={() => {
                    const cellData = data.find(
                      (d) => d.dayOfWeek === dayIndex && d.hour === hour
                    );
                    if (cellData) setSelectedCell(cellData);
                  }}
                  onMouseLeave={() => setSelectedCell(null)}
                />
              ))}
            </div>
          ))}

          {/* Legend */}
          <Flex align="center" gap="2" className="mt-6">
            <span className="text-xs text-mission-control-text-dim">Less</span>
            <Flex gap="1">
              <div className="w-4 h-4 rounded bg-mission-control-border/40" />
              <div className="w-4 h-4 rounded bg-[var(--color-success)]/15" />
              <div className="w-4 h-4 rounded bg-[var(--color-success)]/30" />
              <div className="w-4 h-4 rounded bg-[var(--color-success)]/50" />
              <div className="w-4 h-4 rounded bg-[var(--color-success)]/70" />
              <div className="w-4 h-4 rounded bg-[var(--color-success)]" />
            </Flex>
            <span className="text-xs text-mission-control-text-dim">More</span>
          </Flex>

          {/* Selected cell info */}
          {selectedCell && (
            <div className="mt-4 p-3 bg-mission-control-bg rounded-lg">
              <p className="text-sm font-medium">
                {DAYS[selectedCell.dayOfWeek]} {selectedCell.hour}:00 - {selectedCell.hour + 1}:00
              </p>
              <p className="text-sm text-mission-control-text-dim mt-1">
                {selectedCell.activityCount} activities on {selectedCell.date}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
          <Calendar size={12} className="text-mission-control-text-dim" />
          Pattern Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-mission-control-border/10 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Most productive day</div>
            <div className="text-sm font-medium text-mission-control-text">{peakDay}</div>
          </div>
          <div className="p-3 bg-mission-control-border/10 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Peak productivity time</div>
            <div className="text-sm font-medium tabular-nums text-mission-control-text">
              {peakHour}:00 – {peakHour + 1}:00
            </div>
          </div>
          <div className="p-3 bg-mission-control-border/10 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Avg activities/day</div>
            <div className="text-sm font-medium tabular-nums text-mission-control-text">
              {days > 0 ? Math.round(totalActivity / days) : 0}
            </div>
          </div>
          <div className="p-3 bg-mission-control-border/10 rounded-lg">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Working hours span</div>
            <div className="text-sm font-medium tabular-nums text-mission-control-text">
              {HOURS.filter((h) => aggregatedData.flat()[h] > 0).length}h
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
