// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashInboxCard — Inbox summary card.
 * Fetches GET /api/inbox?limit=50 on mount and every 2 minutes.
 * Shows unread count, starred count, 24h count, and the 4 most recent items
 * (unread prioritised).
 */
import { useState, useEffect } from 'react';
import { Inbox, MessageSquare } from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatting';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InboxItem {
  id: number;
  type: string;
  title: string;
  content: string;
  channel: string | null;
  status: string | null;
  createdAt: number;
  metadata: Record<string, unknown>;
  starred: 0 | 1;
  isRead: 0 | 1;
  tags: string[];
}

interface DashInboxCardProps {
  onNavigate?: (view: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const MS_IN_24H = 86_400_000;

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1 py-2 px-3 text-center">
      <div
        className={`text-sm font-bold tabular-nums ${
          highlight ? 'text-info-DEFAULT' : 'text-mission-control-text'
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-mission-control-text-dim">{label}</div>
    </div>
  );
}

function InboxRow({ item, onClick }: { item: InboxItem; onClick: () => void }) {
  const isUnread = !item.isRead;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-4 py-2 hover:bg-mission-control-bg transition-colors text-left"
    >
      <MessageSquare
        size={12}
        className="text-mission-control-text-dim flex-shrink-0 mt-0.5"
      />
      <span
        className={`flex-1 min-w-0 text-xs truncate ${
          isUnread
            ? 'text-mission-control-text font-medium'
            : 'text-mission-control-text-dim'
        }`}
      >
        {item.title}
      </span>
      <span className="text-[10px] text-mission-control-text-dim/60 shrink-0 tabular-nums">
        {formatTimeAgo(item.createdAt)}
      </span>
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-4 py-2">
          <div className="w-3 h-3 rounded bg-mission-control-border animate-pulse flex-shrink-0" />
          <div className="flex-1 h-3 rounded bg-mission-control-border animate-pulse" />
          <div className="w-10 h-3 rounded bg-mission-control-border animate-pulse" />
        </div>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashInboxCard({ onNavigate }: DashInboxCardProps) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInbox() {
    try {
      const res = await fetch('/api/inbox?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InboxItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      // Silently keep existing state on error; avoid clearing the list
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInbox();
    const timer = setInterval(fetchInbox, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const unread = items.filter((i) => !i.isRead).length;
  const starred = items.filter((i) => i.starred).length;
  const recent24h = items.filter((i) => i.createdAt > Date.now() - MS_IN_24H).length;

  // Unread first, then by createdAt descending
  const recentItems = [...items].sort((a, b) => {
    if (!a.isRead && b.isRead) return -1;
    if (a.isRead && !b.isRead) return 1;
    return b.createdAt - a.createdAt;
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Inbox size={15} className="text-mission-control-accent" />
          Inbox
          {unread > 0 && (
            <span className="bg-info-DEFAULT text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unread}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => onNavigate?.('inbox')}
          className="text-[10px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
        >
          Open →
        </button>
      </div>

      {/* Stats row */}
      <div className="flex divide-x divide-mission-control-border border-b border-mission-control-border">
        <StatPill label="Unread" value={unread} highlight={unread > 0} />
        <StatPill label="Starred" value={starred} />
        <StatPill label="Last 24h" value={recent24h} />
      </div>

      {/* Item list */}
      {loading ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <div className="px-4 py-4 text-center">
          <Inbox size={18} className="mx-auto mb-1.5 text-mission-control-text-dim opacity-30" />
          <p className="text-xs text-mission-control-text-dim">Inbox is empty</p>
        </div>
      ) : (
        <div className="divide-y divide-mission-control-border/50">
          {recentItems.slice(0, 4).map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onClick={() => onNavigate?.('inbox')}
            />
          ))}
        </div>
      )}

    </div>
  );
}
