/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Activity, Calendar } from 'lucide-react';
import { getProductivityHeatmap, ProductivityHeatmap as HeatmapData } from '../services/analyticsService';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ProductivityHeatmap() {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [selectedCell, setSelectedCell] = useState<HeatmapData | null>(null);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const heatmap = await getProductivityHeatmap(timeRange);
      setData(heatmap);
    } catch (error) {
      console.error('Failed to load productivity heatmap:', error);
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
    if (value === 0) return 'bg-clawd-border';
    const intensity = (value / maxActivity) * 100;
    if (intensity < 20) return 'bg-success-subtle';
    if (intensity < 40) return 'bg-success-subtle';
    if (intensity < 60) return 'bg-success-subtle';
    if (intensity < 80) return 'bg-success-subtle';
    return 'bg-green-300';
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
      <div className="h-full flex items-center justify-center">
        <div className="text-clawd-text-dim">Loading heatmap...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-clawd-accent" size={20} />
            Productivity Heatmap
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Activity patterns by day and hour
          </p>
        </div>

        <div className="flex bg-clawd-border rounded-lg p-1">
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                timeRange === days
                  ? 'bg-clawd-accent text-white'
                  : 'text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1">Total Activity</div>
          <div className="text-2xl font-bold text-success">{totalActivity}</div>
        </div>
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1">Peak Day</div>
          <div className="text-2xl font-bold text-info">{peakDay}</div>
        </div>
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1">Peak Hour</div>
          <div className="text-2xl font-bold text-review">
            {peakHour}:00 - {peakHour + 1}:00
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex-1 bg-clawd-surface border border-clawd-border rounded-2xl p-6 overflow-auto">
        <div className="min-w-max">
          {/* Hour labels */}
          <div className="flex mb-2">
            <div className="w-12" /> {/* Day label spacer */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="w-6 text-center text-xs text-clawd-text-dim"
              >
                {hour % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-12 text-xs text-clawd-text-dim font-medium">
                {day}
              </div>
              {aggregatedData[dayIndex].map((value, hour) => (
                <div
                  key={hour}
                  className={`w-6 h-6 mx-px rounded cursor-pointer transition-all hover:scale-110 hover:ring-2 hover:ring-clawd-accent ${getColor(value)}`}
                  title={`${day} ${hour}:00 - ${value} activities`}
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
          <div className="flex items-center gap-2 mt-6">
            <span className="text-xs text-clawd-text-dim">Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-clawd-border" />
              <div className="w-4 h-4 rounded bg-success-subtle" />
              <div className="w-4 h-4 rounded bg-success-subtle" />
              <div className="w-4 h-4 rounded bg-success-subtle" />
              <div className="w-4 h-4 rounded bg-success-subtle" />
              <div className="w-4 h-4 rounded bg-green-300" />
            </div>
            <span className="text-xs text-clawd-text-dim">More</span>
          </div>

          {/* Selected cell info */}
          {selectedCell && (
            <div className="mt-4 p-3 bg-clawd-bg rounded-lg">
              <p className="text-sm font-medium">
                {DAYS[selectedCell.dayOfWeek]} {selectedCell.hour}:00 - {selectedCell.hour + 1}:00
              </p>
              <p className="text-sm text-clawd-text-dim mt-1">
                {selectedCell.activityCount} activities on {selectedCell.date}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 bg-clawd-surface border border-clawd-border rounded-2xl p-6">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Calendar size={16} className="text-clawd-accent" />
          Pattern Insights
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-clawd-bg rounded-lg">
            <div className="text-sm text-clawd-text-dim mb-1">Most productive day</div>
            <div className="font-medium text-success">{peakDay}</div>
          </div>
          <div className="p-3 bg-clawd-bg rounded-lg">
            <div className="text-sm text-clawd-text-dim mb-1">Peak productivity time</div>
            <div className="font-medium text-info">
              {peakHour}:00 - {peakHour + 1}:00
            </div>
          </div>
          <div className="p-3 bg-clawd-bg rounded-lg">
            <div className="text-sm text-clawd-text-dim mb-1">Avg activities/day</div>
            <div className="font-medium text-review">
              {timeRange > 0 ? Math.round(totalActivity / timeRange) : 0}
            </div>
          </div>
          <div className="p-3 bg-clawd-bg rounded-lg">
            <div className="text-sm text-clawd-text-dim mb-1">Working hours span</div>
            <div className="font-medium text-warning">
              {HOURS.filter((h) => aggregatedData.flat()[h] > 0).length}h
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
