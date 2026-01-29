import { useMemo } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import type { ProductivityHeatmap as HeatmapData } from '../../services/analyticsService';

interface ProductivityHeatmapProps {
  data: HeatmapData[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ProductivityHeatmap({ data }: ProductivityHeatmapProps) {
  // Process data into grid format
  const { heatmapGrid, maxActivity, peakHour, peakDay } = useMemo(() => {
    const grid: Record<number, Record<number, number>> = {};
    let max = 0;
    let maxHour = 0;
    let maxDay = 0;
    let maxCount = 0;

    // Initialize grid
    for (let day = 0; day < 7; day++) {
      grid[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        grid[day][hour] = 0;
      }
    }

    // Fill grid with data
    data.forEach((item) => {
      if (!grid[item.dayOfWeek]) {
        grid[item.dayOfWeek] = {};
      }
      if (!grid[item.dayOfWeek][item.hour]) {
        grid[item.dayOfWeek][item.hour] = 0;
      }
      grid[item.dayOfWeek][item.hour] += item.activityCount;
      max = Math.max(max, grid[item.dayOfWeek][item.hour]);
      
      if (grid[item.dayOfWeek][item.hour] > maxCount) {
        maxCount = grid[item.dayOfWeek][item.hour];
        maxHour = item.hour;
        maxDay = item.dayOfWeek;
      }
    });

    return {
      heatmapGrid: grid,
      maxActivity: max,
      peakHour: maxHour,
      peakDay: maxDay,
    };
  }, [data]);

  // Calculate hour totals for sparkline
  const hourlyTotals = useMemo(() => {
    const totals: number[] = Array(24).fill(0);
    Object.values(heatmapGrid).forEach((dayData) => {
      Object.entries(dayData).forEach(([hour, count]) => {
        totals[parseInt(hour)] += count;
      });
    });
    return totals;
  }, [heatmapGrid]);

  const maxHourlyTotal = Math.max(...hourlyTotals, 1);

  // Get color intensity
  const getColorIntensity = (count: number): string => {
    if (count === 0) return 'bg-clawd-bg';
    const intensity = count / maxActivity;
    if (intensity >= 0.75) return 'bg-clawd-accent';
    if (intensity >= 0.5) return 'bg-purple-500 opacity-75';
    if (intensity >= 0.25) return 'bg-purple-600 opacity-50';
    return 'bg-purple-700 opacity-30';
  };

  const totalActivity = data.reduce((sum, d) => sum + d.activityCount, 0);
  const avgPerHour = totalActivity / (7 * 24);

  return (
    <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Activity size={16} className="text-clawd-accent" />
            Productivity Heatmap
          </h3>
          <p className="text-sm text-clawd-text-dim mt-1">
            Activity patterns by day and hour
          </p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-clawd-accent" />
            <span className="text-sm font-medium">
              {DAYS[peakDay]} {peakHour}:00
            </span>
          </div>
          <div className="text-xs text-clawd-text-dim">Peak productivity</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-clawd-bg rounded-lg">
          <div className="text-2xl font-bold text-clawd-accent">{totalActivity}</div>
          <div className="text-xs text-clawd-text-dim">Total Activities</div>
        </div>
        <div className="text-center p-3 bg-clawd-bg rounded-lg">
          <div className="text-2xl font-bold text-purple-400">{avgPerHour.toFixed(1)}</div>
          <div className="text-xs text-clawd-text-dim">Avg Per Hour</div>
        </div>
        <div className="text-center p-3 bg-clawd-bg rounded-lg">
          <div className="text-2xl font-bold text-blue-400">{maxActivity}</div>
          <div className="text-xs text-clawd-text-dim">Peak Hour</div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="space-y-2">
        {/* Hour labels (top) */}
        <div className="flex items-center">
          <div className="w-12" /> {/* Spacer for day labels */}
          <div className="flex-1 grid grid-cols-24 gap-1 text-xs text-clawd-text-dim text-center">
            {HOURS.map((hour) => (
              <div key={hour} className="w-full">
                {hour % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap rows */}
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="flex items-center gap-2">
            <div className="w-10 text-xs font-medium text-clawd-text-dim text-right">
              {day}
            </div>
            <div className="flex-1 grid grid-cols-24 gap-1">
              {HOURS.map((hour) => {
                const count = heatmapGrid[dayIndex]?.[hour] || 0;
                return (
                  <div
                    key={hour}
                    className={`aspect-square rounded ${getColorIntensity(count)} transition-all hover:scale-110 hover:ring-2 hover:ring-clawd-accent cursor-pointer`}
                    title={`${day} ${hour}:00 - ${count} activities`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Hourly activity sparkline */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-clawd-border">
          <div className="w-10 text-xs font-medium text-clawd-text-dim text-right">
            Total
          </div>
          <div className="flex-1 grid grid-cols-24 gap-1 items-end h-12">
            {hourlyTotals.map((count, hour) => (
              <div
                key={hour}
                className="w-full bg-gradient-to-t from-clawd-accent to-purple-400 rounded-t transition-all hover:opacity-80 cursor-pointer"
                style={{
                  height: `${(count / maxHourlyTotal) * 100}%`,
                  minHeight: count > 0 ? '2px' : '0',
                }}
                title={`${hour}:00 - ${count} total activities`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-clawd-border">
        <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 bg-clawd-bg rounded" />
            <div className="w-4 h-4 bg-purple-700 opacity-30 rounded" />
            <div className="w-4 h-4 bg-purple-600 opacity-50 rounded" />
            <div className="w-4 h-4 bg-purple-500 opacity-75 rounded" />
            <div className="w-4 h-4 bg-clawd-accent rounded" />
          </div>
          <span>More</span>
        </div>
        
        <div className="text-xs text-clawd-text-dim">
          Hover cells for details
        </div>
      </div>
    </div>
  );
}
