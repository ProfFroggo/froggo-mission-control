import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: boolean;
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This week', type: 'week' },
  { label: 'This month', type: 'month' },
  { label: 'This quarter', type: 'quarter' },
  { label: 'This year', type: 'year' },
];

export default function DateRangePicker({ value, onChange, presets = true }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(
    value.start.toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState(
    value.end.toISOString().split('T')[0]
  );

  const applyPreset = (preset: any) => {
    const end = new Date();
    let start = new Date();

    if (preset.days) {
      start.setDate(end.getDate() - preset.days);
    } else if (preset.type === 'week') {
      start = new Date(end);
      start.setDate(end.getDate() - end.getDay()); // Start of week (Sunday)
    } else if (preset.type === 'month') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (preset.type === 'quarter') {
      const quarter = Math.floor(end.getMonth() / 3);
      start = new Date(end.getFullYear(), quarter * 3, 1);
    } else if (preset.type === 'year') {
      start = new Date(end.getFullYear(), 0, 1);
    }

    onChange({ start, end });
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    
    if (start <= end) {
      onChange({ start, end });
      setIsOpen(false);
    }
  };

  const formatDateRange = (range: DateRange) => {
    const format = (date: Date) =>
      date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${format(range.start)} - ${format(range.end)}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setIsOpen(!isOpen); } }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Date range picker, currently ${formatDateRange(value)}`}
        className="flex items-center gap-2 px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
      >
        <Calendar size={16} />
        <span className="text-sm">{formatDateRange(value)}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setIsOpen(false); } }}
            role="button"
            tabIndex={0}
            aria-label="Close date range picker"
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl z-50 p-4" role="listbox" aria-label="Date range options">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Select Date Range</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-clawd-border rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {presets && (
              <div className="mb-4">
                <div className="text-sm text-clawd-text-dim mb-2">Quick Presets</div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-2 text-sm bg-clawd-bg hover:bg-clawd-border rounded-lg transition-colors text-left"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-clawd-border pt-4">
              <div className="text-sm text-clawd-text-dim mb-2">Custom Range</div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="date-range-start" className="block text-xs text-clawd-text-dim mb-1">
                    Start Date
                  </label>
                  <input
                    id="date-range-start"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    max={customEnd}
                    className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent"
                  />
                </div>
                <div>
                  <label htmlFor="date-range-end" className="block text-xs text-clawd-text-dim mb-1">
                    End Date
                  </label>
                  <input
                    id="date-range-end"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    min={customStart}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent"
                  />
                </div>
                <button
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd || customStart > customEnd}
                  className="w-full px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Custom Range
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
