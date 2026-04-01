import { useState, useEffect } from 'react';
import { Calendar, MapPin, Video, RefreshCw, ChevronRight } from 'lucide-react';
import { Flex, Heading, Spinner } from '@radix-ui/themes';

interface TodayCalendarWidgetProps {
  onNavigate?: (view: 'schedule') => void;
}

export default function TodayCalendarWidget({ onNavigate }: TodayCalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTodayEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetch('/api/calendar/today').then(r => r.ok ? r.json() : null).catch(() => null);

      if (result?.events) {
        // Sort by start time
        const sorted = result.events.sort((a: CalendarEvent, b: CalendarEvent) => {
          const aTime = a.start.dateTime || a.start.date || '';
          const bTime = b.start.dateTime || b.start.date || '';
          return aTime.localeCompare(bTime);
        });
        setEvents(sorted);
      } else {
        setEvents([]);
      }
    } catch (e) {
      setError('Failed to load calendar');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayEvents();
    // Refresh every 5 minutes
    const interval = setInterval(loadTodayEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (event: CalendarEvent): string => {
    if (event.start.date && !event.start.dateTime) {
      return 'All day';
    }
    if (event.start.dateTime) {
      const date = new Date(event.start.dateTime);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return '';
  };

  const isNow = (event: CalendarEvent): boolean => {
    const start = event.start.dateTime;
    const end = event.end?.dateTime;
    if (!start || !end) return false;
    const now = Date.now();
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    return now >= startTime && now <= endTime;
  };

  const isUpcoming = (event: CalendarEvent): boolean => {
    if (!event.start.dateTime) return false;
    const now = Date.now();
    const start = new Date(event.start.dateTime).getTime();
    const diff = start - now;
    return diff > 0 && diff < 3600000; // Within next hour
  };

  const getMeetingLink = (event: CalendarEvent): string | null => {
    if (!event.conferenceData?.entryPoints) return null;
    const videoEntry = event.conferenceData.entryPoints.find(e => 
      e.entryPointType === 'video' || e.uri.includes('meet.google.com') || e.uri.includes('zoom.us')
    );
    return videoEntry?.uri || null;
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      {/* Header */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
        <Flex align="center" gap="2">
          <Calendar size={16} className="text-info" />
          <div>
            <Heading size="3" weight="medium">Today&apos;s Schedule</Heading>
            <p className="text-xs text-mission-control-text-dim">{dateStr}</p>
          </div>
        </Flex>
        <Flex align="center" gap="2">
          <button
            onClick={loadTodayEvents}
            disabled={loading}
            title="Refresh"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => onNavigate?.('schedule')}
            className="flex items-center gap-1 text-sm text-mission-control-accent hover:underline"
          >
            View All <ChevronRight size={14} />
          </button>
        </Flex>
      </Flex>

      {/* Events List */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center">
            <Spinner size="3" />
            <p className="text-sm text-mission-control-text-dim">Loading events...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-error">
            <p className="text-sm">{error}</p>
            <button type="button" onClick={loadTodayEvents} className="mt-2 text-xs text-mission-control-accent hover:underline">
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center">
            <Calendar size={28} className="mx-auto mb-2 opacity-50 text-mission-control-text-dim" />
            <p className="text-sm text-mission-control-text-dim">No events today</p>
            <p className="text-xs text-mission-control-text-dim mt-1">Enjoy your free time!</p>
          </div>
        ) : (
          <div>
            {events.slice(0, 5).map((event) => {
              const meetingLink = getMeetingLink(event);
              const timeStr = formatTime(event);
              const happening = isNow(event);
              const upcoming = isUpcoming(event);
              const isAllDay = event.start.date && !event.start.dateTime;

              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-border/10 transition-colors ${
                    happening ? 'bg-info/10' : ''
                  }`}
                >
                  {/* Status dot */}
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      happening ? 'bg-info' : upcoming ? 'bg-warning' : 'bg-mission-control-border'
                    }`}
                  />

                  {/* Time */}
                  {isAllDay ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim w-16 flex-shrink-0 text-center">
                      All day
                    </span>
                  ) : (
                    <span className="text-[10px] tabular-nums text-mission-control-text-dim w-16 flex-shrink-0 font-mono">
                      {timeStr}
                    </span>
                  )}

                  {/* Title + location */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-mission-control-text truncate">
                        {event.summary}
                      </p>
                      {happening && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-info/10 text-info border border-info/30 flex-shrink-0">
                          Now
                        </span>
                      )}
                      {upcoming && !happening && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 flex-shrink-0">
                          Soon
                        </span>
                      )}
                    </div>
                    {event.location && (
                      <Flex align="center" gap="1" className="mt-0.5 text-[10px] text-mission-control-text-dim">
                        <MapPin size={9} />
                        <span className="truncate">{event.location}</span>
                      </Flex>
                    )}
                  </div>

                  {/* Join meeting button */}
                  {meetingLink && (
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1.5 bg-mission-control-accent/10 text-mission-control-accent rounded-lg hover:bg-mission-control-accent hover:text-white transition-colors"
                      title="Join meeting"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video size={13} />
                    </a>
                  )}
                </div>
              );
            })}

            {events.length > 5 && (
              <div className="px-4 py-2.5">
                <button type="button" onClick={() => onNavigate?.('schedule')} className="text-xs text-mission-control-accent hover:underline">
                  +{events.length - 5} more event{events.length - 5 > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
