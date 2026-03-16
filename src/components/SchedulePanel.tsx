import { useState, useEffect } from 'react';
import { Calendar, Clock, RefreshCw, ListTodo } from 'lucide-react';
import EpicCalendar from './EpicCalendar';
import TaskScheduler from './TaskScheduler';
import ContentScheduler from './ContentScheduler';
import CronTab from './CronTab';
import { Spinner } from './LoadingStates';
import EmptyState from './EmptyState';
import ErrorDisplay from './ErrorDisplay';
import { ErrorBoundary } from './ErrorBoundary';

type ScheduleTab = 'calendar' | 'tasks' | 'scheduler' | 'crons';

export default function SchedulePanel() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('calendar');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasCalendar, setHasCalendar] = useState(true);

  useEffect(() => {
    // Check if schedule API is available
    const checkAvailability = async () => {
      try {
        // Always available via REST API
        setHasCalendar(true);
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
      <div className="border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center px-4">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'calendar'
                ? 'text-mission-control-accent border-mission-control-accent'
                : 'text-mission-control-text-dim border-transparent hover:text-mission-control-text hover:bg-mission-control-surface'
            }`}
          >
            <Calendar size={16} />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'text-mission-control-accent border-mission-control-accent'
                : 'text-mission-control-text-dim border-transparent hover:text-mission-control-text hover:bg-mission-control-surface'
            }`}
          >
            <ListTodo size={16} />
            Task Scheduler
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'scheduler'
                ? 'text-mission-control-accent border-mission-control-accent'
                : 'text-mission-control-text-dim border-transparent hover:text-mission-control-text hover:bg-mission-control-surface'
            }`}
          >
            <Clock size={16} />
            Content Scheduler
          </button>
          <button
            onClick={() => setActiveTab('crons')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'crons'
                ? 'text-mission-control-accent border-mission-control-accent'
                : 'text-mission-control-text-dim border-transparent hover:text-mission-control-text hover:bg-mission-control-surface'
            }`}
          >
            <RefreshCw size={16} />
            Cron Jobs
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary key={activeTab} componentName={`Schedule-${activeTab}`}>
          {activeTab === 'calendar' && <EpicCalendar />}
          {activeTab === 'tasks' && <TaskScheduler />}
          {activeTab === 'scheduler' && <ContentScheduler />}
          {activeTab === 'crons' && <CronTab />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
