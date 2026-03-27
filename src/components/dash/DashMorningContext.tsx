// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashMorningContext — "This Morning" start-of-day context panel.
 * Section A: Today's calendar events with Prep / Follow-up task shortcuts.
 * Section B: Inbox summary per configured email account with triage actions.
 */

import { useState, useEffect } from 'react';
import {
  Calendar,
  Mail,
  Clock,
  Video,
  Briefcase,
  Diamond,
  ChevronDown,
  ClipboardList,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import { useUserSettings } from '../../store/userSettings';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashMorningContextProps {
  onNavigate?: (view: string) => void;
  onCreateTask?: (partial: { title: string; priority: string }) => void;
}

// ─── Email count response ─────────────────────────────────────────────────────

interface EmailCounts {
  unread: number;
  action: number;
  starred: number;
}

interface EmailAccountData {
  email: string;
  label: string;
  counts: EmailCounts | null;
  loading: boolean;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function formatEventTime(event: CalendarEvent): string {
  if (event.start.date && !event.start.dateTime) {
    return 'All day';
  }
  if (event.start.dateTime) {
    return new Date(event.start.dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return '';
}

function isEventHappening(event: CalendarEvent): boolean {
  const start = event.start.dateTime;
  const end = event.end?.dateTime;
  if (!start || !end) return false;
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
}

function isEventUpcoming(event: CalendarEvent): boolean {
  if (!event.start.dateTime) return false;
  const diff = new Date(event.start.dateTime).getTime() - Date.now();
  return diff > 0 && diff < 3_600_000; // within next hour
}

function getVideoLink(event: CalendarEvent): string | null {
  const entry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === 'video' || e.uri.includes('meet.google.com') || e.uri.includes('zoom.us'),
  );
  return entry?.uri ?? null;
}

// ─── Account icon helper ──────────────────────────────────────────────────────

function AccountIcon({ label }: { label: string }) {
  if (label === 'Bitso') return <Briefcase size={14} />;
  if (label === 'Carbium') return <Diamond size={14} />;
  return <Mail size={14} />;
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
      <div className="w-14 h-3 rounded bg-mission-control-border flex-shrink-0" />
      <div className="flex-1 h-3 rounded bg-mission-control-border" />
      <div className="w-12 h-5 rounded bg-mission-control-border flex-shrink-0" />
      <div className="w-16 h-5 rounded bg-mission-control-border flex-shrink-0" />
    </div>
  );
}

function InboxSkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
      <div className="w-4 h-4 rounded bg-mission-control-border flex-shrink-0" />
      <div className="flex-1 h-3 rounded bg-mission-control-border" />
      <div className="w-10 h-3 rounded bg-mission-control-border" />
      <div className="w-10 h-3 rounded bg-mission-control-border" />
      <div className="w-16 h-6 rounded bg-mission-control-border flex-shrink-0" />
    </div>
  );
}

// ─── Triage dropdown ──────────────────────────────────────────────────────────

interface TriageMenuProps {
  label: string;
  onCreateTask: (partial: { title: string; priority: string }) => void;
}

function TriageMenu({ label, onCreateTask }: TriageMenuProps) {
  const [open, setOpen] = useState(false);

  function handleAction(title: string) {
    onCreateTask({ title, priority: 'p1' });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/40 transition-colors"
      >
        Triage
        <ChevronDown size={11} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg min-w-[220px] py-1 overflow-hidden">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-xs text-mission-control-text hover:bg-mission-control-bg transition-colors"
              onClick={() => handleAction(`Summarize and prioritize ${label} inbox`)}
            >
              Ask agent to summarize
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-xs text-mission-control-text hover:bg-mission-control-bg transition-colors"
              onClick={() => handleAction(`Draft replies for ${label} inbox action items`)}
            >
              Draft replies for action items
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Calendar section ─────────────────────────────────────────────────────────

interface CalendarSectionProps {
  onCreateTask?: DashMorningContextProps['onCreateTask'];
}

function CalendarSection({ onCreateTask }: CalendarSectionProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/calendar/today')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        if (cancelled) return;

        if (res?.events) {
          const sorted = [...res.events].sort((a: CalendarEvent, b: CalendarEvent) => {
            const aTime = a.start.dateTime || a.start.date || '';
            const bTime = b.start.dateTime || b.start.date || '';
            return aTime.localeCompare(bTime);
          });
          setEvents(sorted);
        } else {
          setEvents([]);
        }
      } catch {
        if (!cancelled) setError('Could not load calendar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const displayEvents = events.slice(0, 4);
  const hasTaskButtons = typeof onCreateTask === 'function';

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Calendar size={16} className="text-info-DEFAULT" />
          Today
        </h2>
        {!loading && !error && events.length > 4 && (
          <span className="text-xs text-mission-control-text-dim tabular-nums">
            +{events.length - 4} more
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="px-4 py-3 text-xs text-error-DEFAULT">{error}</div>
      ) : displayEvents.length === 0 ? (
        <div className="px-4 py-3 text-xs text-mission-control-text-dim">No meetings today</div>
      ) : (
        <div className="divide-y divide-mission-control-border/40">
          {displayEvents.map((event) => {
            const happening = isEventHappening(event);
            const upcoming = isEventUpcoming(event);
            const videoLink = getVideoLink(event);
            const timeStr = formatEventTime(event);
            const isAllDay = event.start.date && !event.start.dateTime;

            return (
              <div
                key={event.id}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 transition-colors',
                  happening
                    ? 'bg-info-DEFAULT/10 border-l-2 border-l-info-DEFAULT'
                    : 'border-l-2 border-l-transparent',
                ].join(' ')}
              >
                {/* Time */}
                <span
                  className={[
                    'text-[11px] tabular-nums font-mono w-16 flex-shrink-0',
                    happening
                      ? 'text-info-DEFAULT font-semibold'
                      : upcoming
                        ? 'text-warning-DEFAULT'
                        : 'text-mission-control-text-dim',
                  ].join(' ')}
                >
                  {isAllDay ? 'All day' : timeStr}
                </span>

                {/* Title */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <p className="text-xs font-medium text-mission-control-text truncate">
                    {event.summary}
                  </p>
                  {happening && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-info-subtle text-info-DEFAULT border border-info-border flex-shrink-0">
                      Now
                    </span>
                  )}
                  {upcoming && !happening && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-subtle text-warning-DEFAULT border border-warning-border flex-shrink-0">
                      Soon
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {videoLink && (
                    <a
                      href={videoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-mission-control-text-dim hover:text-mission-control-accent hover:bg-mission-control-accent/10 transition-colors"
                      title="Join meeting"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video size={12} />
                    </a>
                  )}
                  {hasTaskButtons && (
                    <>
                      <button
                        type="button"
                        title={`Create prep task for "${event.summary}"`}
                        onClick={() =>
                          onCreateTask({ title: `Prep: ${event.summary}`, priority: 'p1' })
                        }
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-mission-control-text-dim border border-mission-control-border hover:text-mission-control-text hover:border-mission-control-accent/40 transition-colors"
                      >
                        <ClipboardList size={10} />
                        Prep
                      </button>
                      <button
                        type="button"
                        title={`Create follow-up task for "${event.summary}"`}
                        onClick={() =>
                          onCreateTask({ title: `Follow-up: ${event.summary}`, priority: 'p2' })
                        }
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-mission-control-text-dim border border-mission-control-border hover:text-mission-control-text hover:border-mission-control-accent/40 transition-colors"
                      >
                        <ArrowRight size={10} />
                        Follow-up
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inbox section ────────────────────────────────────────────────────────────

interface InboxSectionProps {
  onCreateTask?: DashMorningContextProps['onCreateTask'];
}

function InboxSection({ onCreateTask }: InboxSectionProps) {
  const { emailAccounts } = useUserSettings();
  const [accountData, setAccountData] = useState<EmailAccountData[]>([]);

  // Initialise loading state per account whenever emailAccounts changes
  useEffect(() => {
    if (emailAccounts.length === 0) return;

    setAccountData(
      emailAccounts.map((a) => ({ email: a.email, label: a.label, counts: null, loading: true })),
    );

    let cancelled = false;

    async function fetchAll() {
      const results = await Promise.all(
        emailAccounts.map(async (acc) => {
          try {
            const res = await fetch(`/api/email/counts?account=${encodeURIComponent(acc.email)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null);
            return {
              email: acc.email,
              label: acc.label,
              counts: res
                ? { unread: res.unread ?? 0, action: res.action ?? 0, starred: res.starred ?? 0 }
                : null,
              loading: false,
            };
          } catch {
            return { email: acc.email, label: acc.label, counts: null, loading: false };
          }
        }),
      );
      if (!cancelled) setAccountData(results);
    }

    fetchAll();
    const interval = setInterval(fetchAll, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [emailAccounts]);

  // Hide the section if no accounts are configured
  if (emailAccounts.length === 0) return null;

  const hasTaskButtons = typeof onCreateTask === 'function';

  return (
    <div>
      {/* Section header */}
      <div className="px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Inbox size={16} className="text-success-DEFAULT" />
          Inbox
        </h2>
      </div>

      {/* Account rows */}
      <div className="divide-y divide-mission-control-border/40">
        {accountData.length === 0
          ? emailAccounts.map((acc) => (
              <InboxSkeletonRow key={acc.email} />
            ))
          : accountData.map((acc) => (
              <div
                key={acc.email}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                {/* Icon */}
                <span className="text-mission-control-text-dim flex-shrink-0">
                  <AccountIcon label={acc.label} />
                </span>

                {/* Label + counts */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs font-medium text-mission-control-text truncate">
                    {acc.label}
                  </span>

                  {acc.loading ? (
                    <span className="text-[10px] text-mission-control-text-dim animate-pulse">
                      loading…
                    </span>
                  ) : acc.counts ? (
                    <>
                      {acc.counts.unread > 0 && (
                        <span className="text-[11px] text-mission-control-text-dim tabular-nums flex items-center gap-0.5">
                          <Mail size={10} className="opacity-50" />
                          {acc.counts.unread}
                        </span>
                      )}
                      {acc.counts.action > 0 && (
                        <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded-full bg-error-subtle text-error-DEFAULT border border-error-border">
                          {acc.counts.action} action
                        </span>
                      )}
                      {acc.counts.unread === 0 && acc.counts.action === 0 && (
                        <span className="text-[11px] text-mission-control-text-dim/60">clear</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-mission-control-text-dim/60">unavailable</span>
                  )}
                </div>

                {/* Triage button */}
                {hasTaskButtons && (
                  <TriageMenu label={acc.label} onCreateTask={onCreateTask} />
                )}
              </div>
            ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashMorningContext({ onNavigate: _onNavigate, onCreateTask }: DashMorningContextProps) {
  const { emailAccounts } = useUserSettings();
  const hasInbox = emailAccounts.length > 0;

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border">
        <Clock size={15} className="text-mission-control-text-dim flex-shrink-0" />
        <h2 className="text-sm font-bold text-mission-control-text">This Morning</h2>
      </div>

      {/* Calendar */}
      <CalendarSection onCreateTask={onCreateTask} />

      {/* Divider between sections — only when inbox is present */}
      {hasInbox && (
        <div className="border-t border-mission-control-border" />
      )}

      {/* Inbox */}
      {hasInbox && (
        <InboxSection onCreateTask={onCreateTask} />
      )}
    </div>
  );
}
