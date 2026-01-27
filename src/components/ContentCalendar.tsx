import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Twitter, Mail, MessageSquare, Calendar, Clock, Edit3, Trash2, Eye } from 'lucide-react';
import { showToast } from './Toast';
import EmptyState from './EmptyState';

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
  tweet: { icon: Twitter, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  email: { icon: Mail, color: 'text-red-400', bg: 'bg-red-500/20' },
  message: { icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/20' },
  post: { icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/20' },
};

export default function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const loadScheduledItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await (window as any).clawdbot?.schedule?.list().catch(() => null);
      if (result?.items) {
        setItems(result.items.map((item: any) => ({
          ...item,
          scheduledFor: new Date(item.scheduledFor),
        })));
      }
    } catch (e) {
      console.error('Failed to load schedule:', e);
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <Calendar size={24} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Content Calendar</h1>
              <p className="text-sm text-clawd-text-dim">
                Schedule and manage your content
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'month' ? 'week' : 'month')}
              className="px-3 py-1.5 bg-clawd-border text-clawd-text-dim rounded-lg text-sm hover:text-clawd-text"
            >
              {viewMode === 'month' ? 'Week View' : 'Month View'}
            </button>
            <button 
              onClick={() => {
                showToast('Select a date on the calendar to schedule content', 'info');
                setSelectedDate(new Date());
              }}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90"
            >
              <Plus size={16} />
              Schedule
            </button>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-medium">{monthName}</h2>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs text-clawd-text-dim font-medium py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="min-h-24 bg-clawd-bg/30 rounded-xl" />;
            }

            const dayItems = getItemsForDate(date);
            const today = isToday(date);
            const past = isPast(date);

            return (
              <div
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`min-h-24 p-2 rounded-xl border cursor-pointer transition-all ${
                  today
                    ? 'bg-clawd-accent/10 border-clawd-accent/30'
                    : selectedDate?.toDateString() === date.toDateString()
                    ? 'bg-clawd-surface border-clawd-accent/50'
                    : past
                    ? 'bg-clawd-bg/50 border-transparent opacity-60'
                    : 'bg-clawd-surface border-clawd-border hover:border-clawd-accent/30'
                }`}
              >
                {/* Date number */}
                <div className={`text-sm font-medium mb-1 ${today ? 'text-clawd-accent' : ''}`}>
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
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bg} truncate`}
                      >
                        <Icon size={10} className={config.color} />
                        <span className="truncate">{item.title}</span>
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-xs text-clawd-text-dim">
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected date panel */}
      {selectedDate && (
        <div className="border-t border-clawd-border bg-clawd-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">
              {selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-clawd-text-dim hover:text-clawd-text"
            >
              ×
            </button>
          </div>

          {getItemsForDate(selectedDate).length === 0 ? (
            <div className="text-center py-4 text-clawd-text-dim">
              <p className="text-sm">No content scheduled</p>
              <button 
                onClick={() => showToast('Schedule content feature coming soon', 'info')}
                className="mt-2 text-clawd-accent text-sm hover:underline"
              >
                + Add content
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {getItemsForDate(selectedDate).map(item => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 bg-clawd-bg rounded-lg"
                  >
                    <div className={`p-1.5 rounded ${config.bg}`}>
                      <Icon size={14} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-clawd-text-dim">
                        {new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => showToast(`Preview: ${item.content}`, 'info')}
                        className="p-1 hover:bg-clawd-border rounded"
                        title="Preview"
                      >
                        <Eye size={14} className="text-clawd-text-dim" />
                      </button>
                      <button 
                        onClick={() => showToast('Edit feature coming soon', 'info')}
                        className="p-1 hover:bg-clawd-border rounded"
                        title="Edit"
                      >
                        <Edit3 size={14} className="text-clawd-text-dim" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
