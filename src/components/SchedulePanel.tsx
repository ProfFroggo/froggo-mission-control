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
import TabNav, { type TabNavItem } from './TabNav';

type ScheduleTab = 'calendar' | 'tasks' | 'scheduler' | 'crons';

const SCHEDULE_TABS: TabNavItem[] = [
  { id: 'calendar',  label: 'Calendar',          icon: Calendar  },
  { id: 'tasks',     label: 'Task Scheduler',     icon: ListTodo  },
  { id: 'scheduler', label: 'Content Scheduler',  icon: Clock     },
  { id: 'crons',     label: 'Cron Jobs',          icon: RefreshCw },
];

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
        <TabNav
          tabs={SCHEDULE_TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as ScheduleTab)}
          paddingX="px-4"
        />
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
