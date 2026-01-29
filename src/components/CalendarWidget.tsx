/**
 * @deprecated CalendarWidget has been replaced by EpicCalendar in Schedule panel.
 * This file is kept for reference but is no longer used in Dashboard.
 * See: src/components/EpicCalendar.tsx (full calendar implementation)
 * Access via: Cmd+Shift+S → Schedule panel → Calendar tab
 */

import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, RefreshCw, ChevronRight, AlertCircle, ExternalLink } from 'lucide-react';
import { gateway } from '../lib/gateway';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  attendees?: number;
  isAllDay?: boolean;
  account?: string;
}

interface CalendarWidgetProps {
  expanded?: boolean;
  onOpenFullCalendar?: () => void;
}

export default function CalendarWidget({ expanded = false, onOpenFullCalendar }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch calendar events directly via IPC
      const result = await (window as any).clawdbot?.calendar?.events('kevin.macarthur@bitso.com', 3);
      console.log('[Calendar] Events result:', result);
      
      if (result?.success && result.events?.events) {
        // Map gog output to our CalendarEvent format
        const mapped = result.events.events.map((e: any) => ({
          id: e.id || String(Date.now()),
          title: e.summary || 'Untitled',
          start: e.start?.dateTime || e.start?.date || '',
          end: e.end?.dateTime || e.end?.date || '',
          location: e.location || '',
          attendees: e.attendees?.length || 0,
          isAllDay: !!e.start?.date && !e.start?.dateTime,
          account: 'kevin.macarthur@bitso.com',
        }));
        setEvents(mapped);
        setLastFetch(Date.now());
      }
    } catch (e: any) {
      console.error('Failed to fetch calendar:', e);
      setError('Could not load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch on mount
    fetchEvents();
    
    // Refresh every 15 minutes
    const interval = setInterval(fetchEvents, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string, isAllDay?: boolean) => {
    if (isAllDay) return 'All day';
    const date = new Date(iso);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getTimeUntil = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return '';
  };

  const isUrgent = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    return diff > 0 && diff < 3600000; // Within 1 hour
  };

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = formatDate(event.start);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <div className={`bg-clawd-surface ${expanded ? 'rounded-xl' : 'rounded-2xl'} border border-clawd-border overflow-hidden`}>
      <div className="p-4 border-b border-clawd-border flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" />
          Calendar
        </h2>
        <div className="flex gap-2">
          {onOpenFullCalendar && (
            <button
              onClick={onOpenFullCalendar}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors text-clawd-text-dim hover:text-clawd-text"
              title="Open Full Calendar"
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className={`${expanded ? 'max-h-96' : 'max-h-64'} overflow-y-auto`}>
        {loading && events.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <Calendar size={32} className="mx-auto mb-3 opacity-50 animate-pulse" />
            <p>Loading calendar...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p>{error}</p>
            <button
              onClick={fetchEvents}
              className="mt-2 text-sm text-clawd-accent hover:underline"
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <Calendar size={32} className="mx-auto mb-3 opacity-50" />
            <p>No upcoming events</p>
            <button
              onClick={fetchEvents}
              className="mt-2 text-sm text-clawd-accent hover:underline"
            >
              Fetch calendar
            </button>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="px-4 py-2 text-xs font-medium text-clawd-text-dim bg-clawd-bg/50">
                  {date}
                </div>
                {dateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 hover:bg-clawd-bg/50 transition-colors ${
                      isUrgent(event.start) ? 'border-l-2 border-l-yellow-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{event.title}</span>
                          {isUrgent(event.start) && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded flex-shrink-0 whitespace-nowrap">
                              {getTimeUntil(event.start)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-clawd-text-dim">
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatTime(event.start, event.isAllDay)}
                            {event.end && !event.isAllDay && ` - ${formatTime(event.end)}`}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin size={14} />
                              {event.location}
                            </span>
                          )}
                          {event.attendees && event.attendees > 1 && (
                            <span className="flex items-center gap-1">
                              <Users size={14} />
                              {event.attendees}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-clawd-text-dim opacity-0 group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {lastFetch > 0 && (
        <div className="px-4 py-2 border-t border-clawd-border text-xs text-clawd-text-dim">
          Updated {new Date(lastFetch).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
