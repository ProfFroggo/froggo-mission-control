import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import EpicCalendar from './EpicCalendar';
import ContentScheduler from './ContentScheduler';
import { Spinner } from './LoadingStates';
import EmptyState from './EmptyState';
import ErrorDisplay from './ErrorDisplay';
import { ErrorBoundary } from './ErrorBoundary';

type ScheduleTab = 'calendar' | 'scheduler';

export default function SchedulePanel() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('calendar');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasCalendar, setHasCalendar] = useState(true);

  useEffect(() => {
    // Check if calendar IPC is available (schedule data source)
    const checkAvailability = async () => {
      try {
        const available = !!window.clawdbot?.calendar;
        setHasCalendar(available);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load schedule'));
      } finally {
        setIsLoading(false);
      }
    };
    checkAvailability();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        context={{ action: 'load schedule', resource: 'calendar data' }}
        onRetry={() => { setIsLoading(true); setError(null); }}
      />
    );
  }

  if (!hasCalendar) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={Calendar}
          title="No schedule data"
          description="Calendar integration is not configured. Set up calendar access to see your schedule here."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center px-6">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-4 font-medium transition-all border-b-2 ${
              activeTab === 'calendar'
                ? 'text-clawd-accent border-clawd-accent'
                : 'text-clawd-text-dim border-transparent hover:text-clawd-text hover:bg-clawd-border/30'
            }`}
          >
            <Calendar size={16} />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`flex items-center gap-2 px-4 py-4 font-medium transition-all border-b-2 ${
              activeTab === 'scheduler'
                ? 'text-clawd-accent border-clawd-accent'
                : 'text-clawd-text-dim border-transparent hover:text-clawd-text hover:bg-clawd-border/30'
            }`}
          >
            <Clock size={16} />
            Content Scheduler
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary componentName={`Schedule-${activeTab}`}>
          {activeTab === 'calendar' && <EpicCalendar />}
          {activeTab === 'scheduler' && <ContentScheduler />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
