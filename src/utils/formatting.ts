// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Shared formatting utilities — single source of truth.
 * Import from here instead of defining locally in components.
 */

/** Format a timestamp as "X minutes ago", "Xh ago", "Xd ago" etc. */
export function formatTimeAgo(ms?: number): string {
  if (!ms) return 'Never';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Format a future timestamp as "In Xm", "In Xh", or date string. Returns "—" if not set. */
export function formatTimeUntil(ms?: number): string {
  if (!ms) return '—';
  const diff = ms - Date.now();
  if (diff < 0) return 'Overdue';
  if (diff < 60_000) return 'Imminent';
  if (diff < 3_600_000) return `In ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `In ${Math.floor(diff / 3_600_000)}h`;
  return `In ${Math.floor(diff / 86_400_000)}d`;
}

/** Format a due date timestamp with overdue detection. */
export function formatDueDate(ts: number): string {
  const now = Date.now();
  const diff = ts - now;
  if (diff < 0) {
    const overdue = Math.abs(diff);
    if (overdue < 86_400_000) return 'Overdue today';
    return `Overdue by ${Math.floor(overdue / 86_400_000)}d`;
  }
  if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`;
  const date = new Date(ts);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Returns true if the timestamp is in the past. */
export function isOverdue(ts?: number | null): boolean {
  return !!ts && ts < Date.now();
}

/** Format milliseconds as "Xm Ys" duration string. */
export function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

/** Format a date as locale date string. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

/** Format a timestamp as locale time string (HH:MM). */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format a timestamp as "Jan 15, 2:30 PM" */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
