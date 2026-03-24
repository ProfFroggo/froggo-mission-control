import { useState, useEffect, useCallback } from 'react';
import { Button, IconButton, Heading, Box, Flex } from '@radix-ui/themes';
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
  email: { icon: Mail, color: 'text-error', bg: 'bg-error-subtle' },
  message: { icon: MessageSquare, color: 'text-success', bg: 'bg-success-subtle' },
  post: { icon: Calendar, color: 'text-review', bg: 'bg-review-subtle' },
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
            <div className="p-2 bg-review-subtle rounded-lg">
              <Calendar size={24} className="text-review" />
            </div>
            <div>
              <Heading size="5" weight="medium">Content Calendar</Heading>
              <p className="text-sm text-mission-control-text-dim">
                Schedule and manage your content
              </p>
            </div>
          </Flex>

          <Flex align="center" gap="2">
            <Button
              variant="surface"
              size="2"
              onClick={() => setViewMode(viewMode === 'month' ? 'week' : 'month')}
            >
              {viewMode === 'month' ? 'Week View' : 'Month View'}
            </Button>
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
          <IconButton variant="ghost" size="2" onClick={() => navigateMonth(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <Heading size="4" weight="medium">{monthName}</Heading>
          <IconButton variant="ghost" size="2" onClick={() => navigateMonth(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </Flex>
      </Box>

      {/* Calendar Grid */}
      <Box p="6" className="flex-1 overflow-y-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs text-mission-control-text-dim font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="min-h-24 bg-mission-control-bg/30 rounded-lg" />;
            }

            const dayItems = getItemsForDate(date);
            const today = isToday(date);
            const past = isPast(date);

            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDate(date); } }}
                role="button"
                tabIndex={0}
                aria-label={`Select date ${date.toLocaleDateString()}${today ? ', today' : ''}${dayItems.length > 0 ? `, ${dayItems.length} items` : ''}`}
                aria-pressed={selectedDate?.toDateString() === date.toDateString()}
                className={`min-h-24 p-2 rounded-lg border cursor-pointer transition-all ${
                  today
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30'
                    : selectedDate?.toDateString() === date.toDateString()
                    ? 'bg-mission-control-surface border-mission-control-accent/50'
                    : past
                    ? 'bg-mission-control-bg/50 border-transparent opacity-60'
                    : 'bg-mission-control-surface border-mission-control-border hover:border-mission-control-accent/30'
                }`}
              >
                {/* Date number */}
                <div className={`text-sm font-medium mb-1 ${today ? 'text-mission-control-accent' : ''}`}>
                  {date.getDate()}
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map(item => {
                    const config = typeConfig[item.type];
                    const Icon = config.icon;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bg} flex-shrink-0 whitespace-nowrap`}
                      >
                        <Icon size={10} className={config.color} />
                        <span className="truncate">{item.title}</span>
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-xs text-mission-control-text-dim">
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
            <IconButton variant="ghost" size="1" onClick={() => setSelectedDate(null)}>
              ×
            </IconButton>
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
                    className="bg-mission-control-bg rounded-lg"
                  >
                    <div className={`p-1.5 rounded ${config.bg}`}>
                      <Icon size={14} className={config.color} />
                    </div>
                    <Box className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-mission-control-text-dim">
                        {new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </Box>
                    <Flex gap="1">
                      <IconButton variant="ghost" size="1" onClick={() => showToast('info', `Preview: ${item.content}`)} title="Preview">
                        <Eye size={14} className="text-mission-control-text-dim" />
                      </IconButton>
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
