import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

export default function EpicCalendar() {
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Calendar size={24} className="text-clawd-accent" />
              Epic Calendar
            </h1>
            <div className="text-sm text-clawd-text-dim">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const newDate = new Date(currentDate);
                  if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
                  else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
                  else newDate.setDate(newDate.getDate() - 1);
                  setCurrentDate(newDate);
                }}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 text-sm bg-clawd-bg hover:bg-clawd-border rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(currentDate);
                  if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
                  else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
                  else newDate.setDate(newDate.getDate() + 1);
                  setCurrentDate(newDate);
                }}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 bg-clawd-bg rounded-lg p-1">
              {(['month', 'week', 'day', 'agenda'] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    view === v
                      ? 'bg-clawd-accent text-white'
                      : 'hover:bg-clawd-border'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Create Event Button */}
            <button className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors">
              <Plus size={18} />
              New Event
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-auto p-6">
        {view === 'month' && <MonthView currentDate={currentDate} />}
        {view === 'week' && <WeekView currentDate={currentDate} />}
        {view === 'day' && <DayView currentDate={currentDate} />}
        {view === 'agenda' && <AgendaView currentDate={currentDate} />}
      </div>
    </div>
  );
}

// Placeholder view components (to be implemented in Phase 1.2)
function MonthView({ currentDate }: { currentDate: Date }) {
  return (
    <div className="bg-clawd-bg rounded-xl border border-clawd-border p-8 text-center">
      <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
      <h3 className="text-lg font-semibold mb-2">Month View</h3>
      <p className="text-sm text-clawd-text-dim">Coming in Phase 1.2</p>
      <p className="text-xs text-clawd-text-dim mt-1">
        Showing: {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}

function WeekView({ currentDate }: { currentDate: Date }) {
  return (
    <div className="bg-clawd-bg rounded-xl border border-clawd-border p-8 text-center">
      <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
      <h3 className="text-lg font-semibold mb-2">Week View</h3>
      <p className="text-sm text-clawd-text-dim">Coming in Phase 1.2</p>
      <p className="text-xs text-clawd-text-dim mt-1">
        Week of {currentDate.toLocaleDateString()}
      </p>
    </div>
  );
}

function DayView({ currentDate }: { currentDate: Date }) {
  return (
    <div className="bg-clawd-bg rounded-xl border border-clawd-border p-8 text-center">
      <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
      <h3 className="text-lg font-semibold mb-2">Day View</h3>
      <p className="text-sm text-clawd-text-dim">Coming in Phase 1.2</p>
      <p className="text-xs text-clawd-text-dim mt-1">
        {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </div>
  );
}

function AgendaView({ currentDate }: { currentDate: Date }) {
  return (
    <div className="bg-clawd-bg rounded-xl border border-clawd-border p-8 text-center">
      <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
      <h3 className="text-lg font-semibold mb-2">Agenda View</h3>
      <p className="text-sm text-clawd-text-dim">Coming in Phase 1.2</p>
      <p className="text-xs text-clawd-text-dim mt-1">
        Upcoming events from {currentDate.toLocaleDateString()}
      </p>
    </div>
  );
}
