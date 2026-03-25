import { useState, useEffect, useCallback } from 'react';
import { Button, Heading, Box, Flex } from '@radix-ui/themes';
import { ChevronLeft, ChevronRight, Plus, Mail, MessageSquare, Calendar, Eye } from 'lucide-react';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { showToast } from './Toast';
import { scheduleApi } from '../lib/api';

interface ScheduledItem {
  id: string;
  type: 'tweet' | 'email' | 'message' | 'post';
  title: string;
  content: string;
  scheduledFor: Date;
  status: 'scheduled' | 'sent' | 'failed' | 'draft';
  channel?: string;
}

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  tweet: { icon: XIcon, color: 'text-mission-control-text', bg: 'bg-mission-control-text/10' },
  email: { icon: Mail, color: 'text-[var(--color-error)]', bg: 'bg-[var(--color-error)]/10' },
  message: { icon: MessageSquare, color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10' },
  post: { icon: Calendar, color: 'text-[var(--color-review)]', bg: 'bg-[var(--color-review)]-subtle' },
};

export default function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [_loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const loadScheduledItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scheduleApi.getAll().catch(() => null);
      if (result?.items) {
        setItems(result.items.map((item: any) => ({
          ...item,
          scheduledFor: new Date(item.scheduledFor),
        })));
      }
    } catch (e) {
      // Failed to load schedule
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduledItems();
  }, [loadScheduledItems]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getItemsForDate = (date: Date) => {
    return items.filter(item => {
      const itemDate = new Date(item.scheduledFor);
      return itemDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Flex direction="column" height="100%">
      {/* Header */}
      <Box p="6" className="border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" justify="between" mb="4">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/10 rounded-lg">
              <Calendar size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <Heading size="5" weight="medium">Content Calendar</Heading>
              <p className="text-sm text-mission-control-text-dim">
                Schedule and manage your content
              </p>
            </div>
          </Flex>

          <Flex align="center" gap="2">
            <button
              onClick={() => setViewMode(viewMode === 'month' ? 'week' : 'month')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-mission-control-border text-sm font-medium text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/30 transition-colors"
            >
              {viewMode === 'month' ? 'Week View' : 'Month View'}
            </button>
            <Button
              variant="solid"
              size="2"
              onClick={() => {
                showToast('info', 'Select a date on the calendar to schedule content');
                setSelectedDate(new Date());
              }}
            >
              <Plus size={16} />
              Schedule
            </Button>
          </Flex>
        </Flex>

        {/* Month navigation */}
        <Flex align="center" justify="between">
          <button
            onClick={() => navigateMonth(-1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <Heading size="4" weight="medium">{monthName}</Heading>
          <button
            onClick={() => navigateMonth(1)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </Flex>
      </Box>

      {/* Calendar Grid */}
      <Box p="6" className="flex-1 overflow-y-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="min-h-24 rounded-lg" />;
            }

            const dayItems = getItemsForDate(date);
            const today = isToday(date);
            const past = isPast(date);
            const isSelected = selectedDate?.toDateString() === date.toDateString();

            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDate(date); } }}
                role="button"
                tabIndex={0}
                aria-label={`Select date ${date.toLocaleDateString()}${today ? ', today' : ''}${dayItems.length > 0 ? `, ${dayItems.length} items` : ''}`}
                aria-pressed={isSelected}
                className={`min-h-24 p-2 rounded-lg border cursor-pointer transition-colors ${
                  today
                    ? 'bg-mission-control-surface border-mission-control-border/30 ring-2 ring-[var(--mission-control-accent)]'
                    : isSelected
                    ? 'bg-mission-control-surface border-mission-control-accent/50'
                    : past
                    ? 'bg-mission-control-surface border-mission-control-border/30 opacity-50'
                    : 'bg-mission-control-surface border-mission-control-border/30 hover:bg-mission-control-border/20'
                }`}
              >
                {/* Date number */}
                <div className={`text-sm mb-1 ${today ? 'text-mission-control-accent font-bold' : 'text-mission-control-text/70'}`}>
                  {date.getDate()}
                </div>

                {/* Items */}
                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map(item => {
                    const config = typeConfig[item.type];
                    const Icon = config.icon;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] truncate ${config.bg}`}
                      >
                        <Icon size={9} className={`flex-shrink-0 ${config.color}`} />
                        <span className={`truncate ${config.color}`}>{item.title}</span>
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-mission-control-text-dim/70 pl-0.5">
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Box>

      {/* Selected date panel */}
      {selectedDate && (
        <Box p="4" className="border-t border-mission-control-border bg-mission-control-surface">
          <Flex align="center" justify="between" mb="3">
            <Heading size="3" weight="medium">
              {selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Heading>
            <button
              onClick={() => setSelectedDate(null)}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </Flex>

          {getItemsForDate(selectedDate).length === 0 ? (
            <div className="text-center py-4 text-mission-control-text-dim">
              <p className="text-sm">No content scheduled for this date</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {getItemsForDate(selectedDate).map(item => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                return (
                  <Flex
                    key={item.id}
                    align="center"
                    gap="3"
                    p="2"
                    className="bg-mission-control-surface border border-mission-control-border rounded-xl"
                  >
                    <div className={`p-1.5 rounded-lg ${config.bg} flex-shrink-0`}>
                      <Icon size={14} className={config.color} />
                    </div>
                    <Box className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-12 text-[11px] tabular-nums text-mission-control-text-dim/70 flex-shrink-0">
                          {new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </Box>
                    <Flex gap="1">
                      <button
                        onClick={() => showToast('info', `Preview: ${item.content}`)}
                        title="Preview"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                    </Flex>
                  </Flex>
                );
              })}
            </div>
          )}
        </Box>
      )}
    </Flex>
  );
}
