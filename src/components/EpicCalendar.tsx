import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Video, Users, RefreshCw } from 'lucide-react';

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    responseStatus: string;
    organizer?: boolean;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      uri: string;
      entryPointType: string;
    }>;
  };
  htmlLink?: string;
  account?: string;
}

interface EventsData {
  events: CalendarEvent[];
  account: string;
}

export default function EpicCalendar() {
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accounts = ['kevin@carbium.io', 'kevin.macarthur@bitso.com'];

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const allEvents: CalendarEvent[] = [];
      
      for (const account of accounts) {
        try {
          const response = await window.electron.execute(
            `GOG_ACCOUNT=${account} gog calendar events --days 30 --json`
          );
          
          if (response.stdout) {
            const data: EventsData = JSON.parse(response.stdout);
            const accountEvents = data.events.map(event => ({
              ...event,
              account
            }));
            allEvents.push(...accountEvents);
          }
        } catch (err) {
          console.error(`Failed to fetch events for ${account}:`, err);
        }
      }

      setEvents(allEvents);
    } catch (err) {
      setError('Failed to fetch calendar events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    const offset = direction === 'prev' ? -1 : 1;

    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + offset);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (7 * offset));
    } else {
      newDate.setDate(newDate.getDate() + offset);
    }

    setCurrentDate(newDate);
  };

  const getDateRangeText = () => {
    if (view === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      return 'Upcoming Events';
    }
  };

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
              {getDateRangeText()}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
              title="Refresh events"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => navigateDate('today')}
                className="px-3 py-1.5 text-sm bg-clawd-bg hover:bg-clawd-border rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => navigateDate('next')}
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
      <div className="flex-1 overflow-auto">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-clawd-accent" />
              <p className="text-clawd-text-dim">Loading calendar events...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Calendar size={32} className="mx-auto mb-4 text-red-500" />
              <p className="text-red-500">{error}</p>
              <button
                onClick={fetchEvents}
                className="mt-4 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {view === 'month' && <MonthView currentDate={currentDate} events={events} />}
            {view === 'week' && <WeekView currentDate={currentDate} events={events} />}
            {view === 'day' && <DayView currentDate={currentDate} events={events} />}
            {view === 'agenda' && <AgendaView currentDate={currentDate} events={events} />}
          </>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday as first day
  return new Date(d.setDate(diff));
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getEventTime(event: CalendarEvent): { start: Date; end: Date; isAllDay: boolean } {
  const isAllDay = !event.start.dateTime;
  const start = new Date(event.start.dateTime || event.start.date!);
  const end = new Date(event.end.dateTime || event.end.date!);
  return { start, end, isAllDay };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Event Card Component
function EventCard({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const { start, end, isAllDay } = getEventTime(event);
  const meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
  const accountColor = event.account === 'kevin@carbium.io' ? 'bg-blue-500' : 'bg-purple-500';

  if (compact) {
    return (
      <div className={`text-xs px-2 py-1 ${accountColor} text-white rounded mb-1 truncate cursor-pointer hover:opacity-80 transition-opacity`}
           title={event.summary}>
        {!isAllDay && <span className="font-medium">{formatTime(start)} </span>}
        {event.summary}
      </div>
    );
  }

  return (
    <div className="bg-clawd-surface rounded-lg border border-clawd-border p-4 hover:border-clawd-accent transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold flex-1">{event.summary}</h3>
        <div className={`w-2 h-2 rounded-full ${accountColor} ml-2 mt-1`} title={event.account} />
      </div>

      <div className="space-y-1.5 text-sm text-clawd-text-dim">
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>
            {isAllDay ? 'All day' : `${formatTime(start)} - ${formatTime(end)}`}
          </span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {meetLink && (
          <div className="flex items-center gap-2">
            <Video size={14} />
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-clawd-accent hover:underline truncate">
              Google Meet
            </a>
          </div>
        )}

        {event.attendees && event.attendees.length > 1 && (
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span>{event.attendees.length} attendees</span>
          </div>
        )}
      </div>

      {event.description && (
        <p className="mt-3 text-sm text-clawd-text-dim line-clamp-2"
           dangerouslySetInnerHTML={{ __html: event.description.replace(/<[^>]*>/g, '') }} />
      )}
    </div>
  );
}

// Month View
function MonthView({ currentDate, events }: { currentDate: Date; events: CalendarEvent[] }) {
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = getWeekStart(firstDay);
  
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  const iterDate = new Date(startDate);

  // Build 6 weeks (42 days)
  for (let i = 0; i < 42; i++) {
    currentWeek.push(new Date(iterDate));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    iterDate.setDate(iterDate.getDate() + 1);
  }

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const { start, end } = getEventTime(event);
      return date >= new Date(start.setHours(0, 0, 0, 0)) && 
             date <= new Date(end.setHours(23, 59, 59, 999));
    });
  };

  const today = new Date();
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();

  return (
    <div className="h-full p-6">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border h-full flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-clawd-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center py-3 text-sm font-semibold text-clawd-text-dim">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-rows-6">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b border-clawd-border last:border-b-0">
              {week.map((date, dayIdx) => {
                const dayEvents = getEventsForDay(date);
                const isToday = isSameDay(date, today);
                const inCurrentMonth = isCurrentMonth(date);

                return (
                  <div
                    key={dayIdx}
                    className={`border-r border-clawd-border last:border-r-0 p-2 ${
                      !inCurrentMonth ? 'bg-clawd-bg opacity-50' : ''
                    } hover:bg-clawd-border/30 transition-colors cursor-pointer overflow-hidden`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'bg-clawd-accent text-white w-6 h-6 rounded-full flex items-center justify-center' : ''
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map(event => (
                        <EventCard key={event.id} event={event} compact />
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-clawd-text-dim pl-2">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Week View
function WeekView({ currentDate, events }: { currentDate: Date; events: CalendarEvent[] }) {
  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();

  const getEventsForDayAndHour = (date: Date, hour: number) => {
    return events.filter(event => {
      const { start, end } = getEventTime(event);
      const eventStart = new Date(start);
      const eventEnd = new Date(end);
      
      if (!isSameDay(eventStart, date) && !isSameDay(eventEnd, date)) return false;
      
      const hourStart = new Date(date);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(date);
      hourEnd.setHours(hour, 59, 59, 999);

      return eventStart <= hourEnd && eventEnd >= hourStart;
    });
  };

  return (
    <div className="h-full p-6">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border h-full flex flex-col overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 border-b border-clawd-border flex-shrink-0">
          <div className="p-3 text-sm font-semibold text-clawd-text-dim border-r border-clawd-border">
            Time
          </div>
          {weekDays.map(date => {
            const isToday = isSameDay(date, today);
            return (
              <div
                key={date.toISOString()}
                className={`text-center p-3 border-r border-clawd-border last:border-r-0 ${
                  isToday ? 'bg-clawd-accent/10' : ''
                }`}
              >
                <div className="text-xs text-clawd-text-dim">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-semibold ${
                  isToday ? 'text-clawd-accent' : ''
                }`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-auto">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-clawd-border min-h-[60px]">
              <div className="p-2 text-xs text-clawd-text-dim border-r border-clawd-border">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {weekDays.map(date => {
                const dayEvents = getEventsForDayAndHour(date, hour);
                const isToday = isSameDay(date, today);
                
                return (
                  <div
                    key={`${date.toISOString()}-${hour}`}
                    className={`border-r border-clawd-border last:border-r-0 p-1 ${
                      isToday ? 'bg-clawd-accent/5' : ''
                    } hover:bg-clawd-border/30 transition-colors cursor-pointer`}
                  >
                    {dayEvents.map(event => (
                      <EventCard key={event.id} event={event} compact />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Day View
function DayView({ currentDate, events }: { currentDate: Date; events: CalendarEvent[] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  const isToday = isSameDay(currentDate, today);

  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      const { start, end } = getEventTime(event);
      const eventStart = new Date(start);
      const eventEnd = new Date(end);
      
      if (!isSameDay(eventStart, currentDate) && !isSameDay(eventEnd, currentDate)) return false;
      
      const hourStart = new Date(currentDate);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(currentDate);
      hourEnd.setHours(hour, 59, 59, 999);

      return eventStart <= hourEnd && eventEnd >= hourStart;
    });
  };

  const allDayEvents = events.filter(event => {
    const { start, isAllDay } = getEventTime(event);
    return isAllDay && isSameDay(start, currentDate);
  });

  return (
    <div className="h-full p-6">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border h-full flex flex-col overflow-hidden">
        {/* All-day events */}
        {allDayEvents.length > 0 && (
          <div className="border-b border-clawd-border p-4 space-y-2 flex-shrink-0">
            <div className="text-xs font-semibold text-clawd-text-dim mb-2">ALL DAY</div>
            {allDayEvents.map(event => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        )}

        {/* Time slots */}
        <div className="flex-1 overflow-auto">
          {hours.map(hour => {
            const hourEvents = getEventsForHour(hour);
            const currentHour = isToday && new Date().getHours() === hour;

            return (
              <div
                key={hour}
                className={`border-b border-clawd-border min-h-[80px] flex ${
                  currentHour ? 'bg-clawd-accent/5' : ''
                }`}
              >
                <div className="w-24 p-3 text-sm text-clawd-text-dim border-r border-clawd-border flex-shrink-0">
                  {hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                </div>
                <div className="flex-1 p-3 space-y-2 hover:bg-clawd-border/30 transition-colors cursor-pointer">
                  {hourEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Agenda View
function AgendaView({ currentDate, events }: { currentDate: Date; events: CalendarEvent[] }) {
  // Group events by date, starting from currentDate
  const upcomingEvents = events
    .filter(event => {
      const { start } = getEventTime(event);
      return start >= currentDate;
    })
    .sort((a, b) => {
      const aStart = getEventTime(a).start;
      const bStart = getEventTime(b).start;
      return aStart.getTime() - bStart.getTime();
    });

  const eventsByDate = upcomingEvents.reduce((acc, event) => {
    const { start } = getEventTime(event);
    const dateKey = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const today = new Date();

  if (upcomingEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
          <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
          <p className="text-sm text-clawd-text-dim">Your calendar is clear!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {Object.entries(eventsByDate).map(([dateStr, dateEvents]) => {
          const eventDate = getEventTime(dateEvents[0]).start;
          const isToday = isSameDay(eventDate, today);
          const isTomorrow = isSameDay(eventDate, new Date(today.getTime() + 86400000));

          return (
            <div key={dateStr} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dateStr}
                </h2>
                <div className="h-px flex-1 bg-clawd-border" />
                <span className="text-sm text-clawd-text-dim">
                  {dateEvents.length} {dateEvents.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              <div className="space-y-3">
                {dateEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
