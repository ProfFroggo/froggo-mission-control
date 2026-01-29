import { useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import EpicCalendar from './EpicCalendar';
import ContentScheduler from './ContentScheduler';

type ScheduleTab = 'calendar' | 'scheduler';

export default function SchedulePanel() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('calendar');

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
            <Calendar size={18} />
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
            <Clock size={18} />
            Content Scheduler
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'calendar' && <EpicCalendar />}
        {activeTab === 'scheduler' && <ContentScheduler />}
      </div>
    </div>
  );
}
