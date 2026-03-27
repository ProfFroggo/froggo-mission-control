// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashCalendarCard — compact today's meetings card for the right column.
 * Fetches GET /api/calendar/today and renders up to 5 events sorted by start time.
 */

import { useState, useEffect } from 'react';
import { CalendarDays, Video } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashCalendarCardProps {
  onNavigate?: (view: string) => void;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; responseStatus: string }>;
  conferenceData?: { entryPoints: Array<{ uri: string; entryPointType: string }> };
  organizer?: string;
  location?: string;
}

interface CalendarResponse {
  events?: CalendarEvent[];
  date?: string;
  needsAuth?: boolean;
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: CalendarEvent }) {
  const now = Date.now();
  const startMs = event.start.dateTime ? new Date(event.start.dateTime).getTime() : null;
  const endMs = event.end?.dateTime ? new Date(event.end.dateTime).getTime() : null;

  const isNow = startMs !== null && endMs !== null ? now >= startMs && now <= endMs : false;
  const isSoon = startMs !== null ? startMs - now > 0 && startMs - now < 60 * 60 * 1000 : false;

  const timeStr = startMs
    ? new Date(startMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'All day';

  const videoLink = event.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === 'video',
  );

  const timeClass = isSoon
    ? 'text-warning-DEFAULT font-semibold'
    : isNow
      ? 'text-info-DEFAULT font-semibold'
      : 'text-mission-control-text-dim';

  return (
    <div
      className={[
        'flex items-start gap-3 px-4 py-2.5 border-l-2',
        isNow
          ? 'bg-info-DEFAULT/5 border-l-info-DEFAULT'
          : 'border-l-transparent',
      ].join(' ')}
    >
      <span className={`text-xs tabular-nums shrink-0 mt-0.5 ${timeClass}`}>
        {timeStr}
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-mission-control-text truncate">{event.summary}</div>
        {event.attendees && event.attendees.length > 1 && (
          <div className="text-[10px] text-mission-control-text-dim">
            {event.attendees.length} attendees
          </div>
        )}
      </div>

      {videoLink && (
        <a
          href={videoLink.uri}
          target="_blank"
          rel="noreferrer"
          className="text-info-DEFAULT hover:text-info-DEFAULT/80 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          title="Join video call"
        >
          <Video size={12} />
        </a>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
      <div className="w-14 h-3 rounded bg-mission-control-border flex-shrink-0" />
      <div className="flex-1 h-3 rounded bg-mission-control-border" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashCalendarCard({ onNavigate }: DashCalendarCardProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/calendar/today');
        if (!res.ok) {
          if (!cancelled) { setEvents([]); setLoading(false); }
          return;
        }
        const json: CalendarResponse = await res.json();
        if (cancelled) return;

        if (json.needsAuth) {
          setNeedsAuth(true);
          setLoading(false);
          return;
        }

        if (Array.isArray(json.events)) {
          const sorted = [...json.events].sort((a, b) => {
            const aTime = a.start.dateTime ?? a.start.date ?? '';
            const bTime = b.start.dateTime ?? b.start.date ?? '';
            return aTime.localeCompare(bTime);
          });
          setEvents(sorted);
        } else {
          setEvents([]);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const displayEvents = events.slice(0, 5);

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <CalendarDays size={15} className="text-mission-control-accent" />
          Today
          {!loading && !needsAuth && events.length > 0 && (
            <span className="text-[10px] text-mission-control-text-dim font-normal">
              {events.length} meeting{events.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => onNavigate?.('schedule')}
          className="text-[10px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
        >
          Calendar →
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : needsAuth ? (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-mission-control-text-dim">Connect Google Calendar</p>
          <button
            type="button"
            onClick={() => onNavigate?.('settings')}
            className="mt-1 text-xs text-mission-control-accent hover:underline"
          >
            Set up in settings →
          </button>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 text-mission-control-text-dim">
          <CalendarDays size={13} className="opacity-40" />
          <span className="text-xs">No meetings today</span>
        </div>
      ) : (
        <div className="divide-y divide-mission-control-border/50">
          {displayEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
          {events.length > 5 && (
            <div className="px-4 py-2 text-[10px] text-mission-control-text-dim">
              +{events.length - 5} more
            </div>
          )}
        </div>
      )}

    </div>
  );
}
