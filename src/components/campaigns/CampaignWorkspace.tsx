'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, MessageSquare, LayoutGrid, Image as ImageIcon, BarChart2, Radio, FileText,
  Users, Bot, Settings, Plus, X, ChevronDown, Edit3, Trash2, Check,
  Upload, RefreshCw, TrendingUp, TrendingDown, Minus, Link, StickyNote,
  CalendarDays, CheckCircle2, CircleDot, Square, ClipboardList, BookOpen,
} from 'lucide-react';
import { Megaphone, Calendar, DollarSign, Copy, ListTodo, Zap, Activity } from 'lucide-react';
import { campaignsApi, agentApi } from '../../lib/api';
import EpicCalendar from '../EpicCalendar';
import type { Campaign, CampaignMember, CampaignAsset } from '../../types/campaigns';
import AgentAvatar from '../AgentAvatar';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import { useChatRoomStore } from '../../store/chatRoomStore';
import ChatRoomView from '../ChatRoomView';
import Kanban from '../Kanban';
import CampaignDispatchModal from './CampaignDispatchModal';
import { CHANNEL_ICONS, CHANNEL_LABELS, ALL_CHANNELS } from './channelIcons';
import { STATUS_CONFIG, TYPE_COLORS, TYPE_LABELS } from './CampaignCard';
import CampaignROIDashboard from '../CampaignROIDashboard';
import ReactMarkdown from 'react-markdown';
import ContextPanel from '../ContextPanel';
import ContentTab from './ContentTab';
import { Button, IconButton, Flex, TextField, Select, TextArea } from '@radix-ui/themes';

type TabId = 'overview' | 'chat' | 'tasks' | 'timeline' | 'content' | 'assets' | 'channels' | 'results' | 'checklist' | 'context';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'overview',    label: 'Overview',    icon: FileText },
  { id: 'chat',        label: 'Chat',        icon: MessageSquare },
  { id: 'tasks',       label: 'Tasks',       icon: LayoutGrid },
  { id: 'timeline',    label: 'Timeline',    icon: Calendar },
  { id: 'content',     label: 'Content',     icon: CalendarDays },
  { id: 'assets',      label: 'Assets',      icon: ImageIcon },
  { id: 'channels',    label: 'Channels',    icon: Radio },
  { id: 'results',     label: 'Results',     icon: BarChart2 },
  { id: 'checklist',   label: 'Checklist',   icon: ClipboardList },
  { id: 'context',     label: 'Context',     icon: BookOpen },
];

const KPI_LABELS: Record<string, string> = {
  impressions: 'Impressions',
  clicks: 'Clicks',
  conversions: 'Conversions',
  revenue: 'Revenue',
  roas: 'ROAS',
  cac: 'CAC',
};

// ── Chat Tab ───────────────────────────────────────────────────────────────────
function ChatTab({ campaign }: { campaign: Campaign }) {
  const { rooms, loadRooms, createRoom, setActiveRoom } = useChatRoomStore();
  const resolvedRoomIdRef = useRef<string | null>(null);
  const [roomsLoaded, setRoomsLoaded] = useState(false);

  useEffect(() => {
    loadRooms().then(() => setRoomsLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!roomsLoaded) return;
    if (resolvedRoomIdRef.current) {
      setActiveRoom(resolvedRoomIdRef.current);
      return;
    }
    const campaignRoomId = `campaign-${campaign.id}`;
    const existing = rooms.find(r => r.id === campaignRoomId);
    if (existing) {
      resolvedRoomIdRef.current = existing.id;
      setActiveRoom(existing.id);
    } else {
      const memberIds = (campaign.members ?? []).map((m: CampaignMember) => m.agentId);
      const newId = createRoom(campaign.name, memberIds);
      resolvedRoomIdRef.current = newId;
    }
  }, [roomsLoaded, rooms.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = resolvedRoomIdRef.current ? rooms.find(r => r.id === resolvedRoomIdRef.current) : null;

  if (!room) return (
    <div className="flex items-center justify-center h-full"><Spinner size={24} /></div>
  );
  return (
    <div className="h-full">
      <ChatRoomView roomId={room.id} onBack={() => {}} hideDelete hideHeader />
    </div>
  );
}

// ── Assets Tab ────────────────────────────────────────────────────────────────
function AssetsTab({ campaign }: { campaign: Campaign }) {
  const [assets, setAssets] = useState<CampaignAsset[]>(campaign.assets ?? []);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await campaignsApi.get(campaign.id) as { campaign: Campaign };
      setAssets(data.campaign.assets ?? []);
    } catch (err) { console.warn('[CampaignWorkspace] Non-critical:', err); }
    finally { setLoading(false); }
  }, [campaign.id]);

  const ASSET_TYPES = ['', 'image', 'video', 'copy', 'brief', 'report', 'other'];
  const filtered = assets.filter(a => !filterType || a.assetType === filterType);

  function assetBadge(type: string) {
    const map: Record<string, string> = {
      image: 'text-info bg-info/10',
      video: 'text-review bg-review-subtle',
      copy: 'text-success bg-success/10',
      brief: 'text-warning bg-warning/10',
      report: 'text-info bg-info/10',
    };
    return map[type] ?? 'text-muted bg-muted-subtle';
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      draft: 'text-muted bg-muted-subtle',
      approved: 'text-success bg-success/10',
      live: 'text-info bg-info/10',
      archived: 'text-mission-control-text-dim bg-mission-control-surface',
    };
    return map[status] ?? 'text-muted bg-muted-subtle';
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border flex-wrap">
        <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
          {ASSET_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterType === t ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <label className="flex items-center gap-1 px-2.5 py-1 bg-mission-control-accent text-white rounded-lg text-xs font-medium hover:bg-mission-control-accent/90 transition-colors cursor-pointer">
            <Upload size={12} /> Upload
            <input type="file" className="hidden" onChange={() => showToast('File upload coming soon', 'info')} />
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <Flex align="center" justify="center" py="6"><Spinner size={16} /></Flex>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon size={24} className="text-mission-control-text-dim mb-2" />
            <p className="text-sm text-mission-control-text-dim">No assets yet</p>
            <p className="text-xs text-mission-control-text-dim mt-1">Upload images, videos, copy, or brief documents.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(asset => (
              <div key={asset.id} className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-2">
                <div className="w-full h-24 bg-mission-control-border/30 rounded-lg flex items-center justify-center">
                  <ImageIcon size={20} className="text-mission-control-text-dim" />
                </div>
                <div>
                  <p className="text-xs text-mission-control-text truncate font-medium">{asset.fileName}</p>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${assetBadge(asset.assetType)}`}>{asset.assetType}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${statusBadge(asset.status)}`}>{asset.status}</span>
                    {asset.channel && (
                      <span className="text-xs text-mission-control-text-dim">{CHANNEL_LABELS[asset.channel] ?? asset.channel}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Channels Tab ──────────────────────────────────────────────────────────────
function ChannelsTab({ campaign, onUpdate }: { campaign: Campaign; onUpdate: () => void }) {
  const [channelNotes, setChannelNotes] = useState<Record<string, string>>({});
  const [channelLinks, setChannelLinks] = useState<Record<string, string>>({});
  const activeChannels = campaign.channels ?? [];

  const handleToggleChannel = async (ch: string) => {
    const newChannels = activeChannels.includes(ch)
      ? activeChannels.filter(c => c !== ch)
      : [...activeChannels, ch];
    try {
      await campaignsApi.update(campaign.id, { channels: newChannels });
      onUpdate();
    } catch { showToast('Failed to update channels', 'error'); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-3">
        {activeChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Radio size={24} className="text-mission-control-text-dim mb-2" />
            <p className="text-sm text-mission-control-text-dim">No channels active. Add them below.</p>
          </div>
        ) : (
          activeChannels.map(ch => {
            const Icon = CHANNEL_ICONS[ch];
            return (
              <div key={ch} className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-3">
                <Flex align="center" justify="between">
                  <Flex align="center" gap="2">
                    {Icon && <Icon size={16} className="text-mission-control-text" />}
                    <span className="font-medium text-sm text-mission-control-text">{CHANNEL_LABELS[ch] ?? ch}</span>
                  </Flex>
                  <button type="button" onClick={() => handleToggleChannel(ch)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                    Remove
                  </button>
                </Flex>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><Link size={10} /> Live URL</label>
                    <TextField.Root
                      type="url"
                      placeholder="https://..."
                      value={channelLinks[ch] ?? ''}
                      onChange={e => setChannelLinks(prev => ({ ...prev, [ch]: e.target.value }))}
                      size="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><StickyNote size={10} /> Notes</label>
                    <TextField.Root
                      type="text"
                      placeholder="Quick note..."
                      value={channelNotes[ch] ?? ''}
                      onChange={e => setChannelNotes(prev => ({ ...prev, [ch]: e.target.value }))}
                      size="1"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div>
          <p className="text-xs text-mission-control-text-dim mb-2">Add channels</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CHANNELS.filter(ch => !activeChannels.includes(ch)).map(ch => {
              const Icon = CHANNEL_ICONS[ch];
              return (
                <button key={ch} type="button" onClick={() => handleToggleChannel(ch)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
                  {Icon && <Icon size={11} />}
                  {CHANNEL_LABELS[ch]}
                  <Plus size={10} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Performance Tab ────────────────────────────────────────────────────────────
function PerformanceTab({ campaign, onUpdate }: { campaign: Campaign; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [kpis, setKpis] = useState<Record<string, { target: number; actual: number }>>(campaign.kpis ?? {});
  const [saving, setSaving] = useState(false);

  const budget = campaign.budget ?? 0;
  const budgetSpent = campaign.budgetSpent ?? 0;
  const budgetRemaining = Math.max(0, budget - budgetSpent);
  const spendPct = budget > 0 ? Math.min(100, Math.round((budgetSpent / budget) * 100)) : 0;

  const now = Date.now();
  const start = campaign.startDate;
  const end = campaign.endDate;
  const timelineProgress = start && end && end > start
    ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
    : 0;

  const handleSaveKpis = async () => {
    setSaving(true);
    try {
      await campaignsApi.update(campaign.id, { kpis });
      showToast('Metrics updated', 'success');
      setEditing(false);
      onUpdate();
    } catch { showToast('Failed to update metrics', 'error'); }
    finally { setSaving(false); }
  };

  function kpiPct(k: { target: number; actual: number }) {
    if (!k.target || k.target === 0) return 0;
    return Math.min(100, Math.round((k.actual / k.target) * 100));
  }

  function TrendIcon({ pct, hasData }: { pct: number; hasData: boolean }) {
    if (!hasData) return <Minus size={13} className="text-mission-control-text-dim/40" />;
    if (pct >= 100) return <TrendingUp size={13} className="text-success" />;
    if (pct >= 50) return <Minus size={13} className="text-warning" />;
    return <TrendingDown size={13} className="text-error" />;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      <Flex align="center" justify="between">
        <h3 className="text-sm font-medium text-mission-control-text">KPI Tracker</h3>
        <button type="button" onClick={() => setEditing(v => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
          <Edit3 size={12} /> {editing ? 'Cancel' : 'Update Metrics'}
        </button>
      </Flex>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(KPI_LABELS).map(([key, label]) => {
          const entry = kpis[key] ?? { target: 0, actual: 0 };
          const pct = kpiPct(entry);
          const hasData = (entry.target > 0) || (entry.actual > 0);
          return (
            <div key={key} className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-2">
              <Flex align="center" justify="between">
                <span className="text-xs text-mission-control-text-dim">{label}</span>
                <TrendIcon pct={pct} hasData={hasData} />
              </Flex>
              {editing ? (
                <div className="space-y-1.5">
                  <div>
                    <label className="text-xs text-mission-control-text-dim">Target</label>
                    <TextField.Root
                      type="number"
                      value={entry.target || ''}
                      onChange={e => setKpis(prev => ({ ...prev, [key]: { ...entry, target: parseFloat(e.target.value) || 0 } }))}
                      size="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-mission-control-text-dim">Actual</label>
                    <TextField.Root
                      type="number"
                      value={entry.actual || ''}
                      onChange={e => setKpis(prev => ({ ...prev, [key]: { ...entry, actual: parseFloat(e.target.value) || 0 } }))}
                      size="1"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-lg font-semibold text-mission-control-text tabular-nums">
                    {entry.actual > 0 ? entry.actual.toLocaleString() : '—'}
                  </div>
                  {entry.target > 0 && (
                    <>
                      <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim tabular-nums">
                        <span>Target: {entry.target.toLocaleString()}</span>
                        <span>{pct}%</span>
                      </Flex>
                      <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-colors ${pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-error'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <Button variant="solid" size="1" onClick={handleSaveKpis} disabled={saving}>
          {saving ? <Spinner size={12} /> : <Check size={14} />} Save Metrics
        </Button>
      )}

      {budget > 0 && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-mission-control-text">Budget</h4>
          <div className="grid grid-cols-3 gap-3 text-center tabular-nums">
            <div>
              <div className="text-lg font-semibold text-mission-control-text">${budget.toLocaleString()}</div>
              <div className="text-xs text-mission-control-text-dim">Total</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-warning">${budgetSpent.toLocaleString()}</div>
              <div className="text-xs text-mission-control-text-dim">Spent</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-success">${budgetRemaining.toLocaleString()}</div>
              <div className="text-xs text-mission-control-text-dim">Remaining</div>
            </div>
          </div>
          <div>
            <Flex align="center" justify="between" mb="1" className="text-xs text-mission-control-text-dim tabular-nums">
              <span>Spend rate</span><span>{spendPct}%</span>
            </Flex>
            <div className="h-2 bg-mission-control-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-colors ${spendPct > 90 ? 'bg-error' : spendPct > 70 ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${spendPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {start && end && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-mission-control-text">Timeline</h4>
          <Flex align="center" justify="between" mb="1" className="text-xs text-mission-control-text-dim">
            <span>{new Date(start).toLocaleDateString()}</span>
            <span>{timelineProgress}% elapsed</span>
            <span>{new Date(end).toLocaleDateString()}</span>
          </Flex>
          <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
            <div className="h-full bg-mission-control-accent rounded-full transition-colors" style={{ width: `${timelineProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Weekly Grid ────────────────────────────────────────────────────────────
interface KpiWeeklyRow {
  id: string;
  campaignId: string;
  metric: string;
  weekLabel: string;
  weekStart: number;
  target: number | null;
  actual: number | null;
}

function buildCampaignWeeks(startDate: number | null | undefined, endDate: number | null | undefined): { label: string; weekStart: number }[] {
  if (!startDate) return [];
  const end = endDate ?? (startDate + 8 * 7 * 86_400_000); // default 8 weeks
  const weeks: { label: string; weekStart: number }[] = [];
  let cursor = new Date(startDate);
  // Snap to Monday
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  let i = 1;
  while (cursor.getTime() <= end && weeks.length < 26) {
    weeks.push({ label: `W${i}`, weekStart: cursor.getTime() });
    cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    i++;
  }
  return weeks;
}

function KpiWeeklyGrid({ campaign }: { campaign: Campaign }) {
  const [rows, setRows] = useState<KpiWeeklyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editing, setEditing] = useState<{ metric: string; weekLabel: string; field: 'target' | 'actual'; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const weeks = buildCampaignWeeks(campaign.startDate, campaign.endDate);
  const metrics = Object.keys(KPI_LABELS).filter(k => campaign.kpis && campaign.kpis[k]?.target > 0 || true);
  const activeMetrics = Object.keys(KPI_LABELS);

  useEffect(() => {
    import('../../lib/api').then(({ campaignsApi: api }) =>
      api.getKpiWeekly(campaign.id)
        .then((d: { rows?: KpiWeeklyRow[] }) => setRows(d.rows ?? []))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, [campaign.id]);

  const cellKey = (metric: string, weekLabel: string) => `${metric}::${weekLabel}`;
  const byKey: Record<string, KpiWeeklyRow> = {};
  for (const r of rows) byKey[cellKey(r.metric, r.weekLabel)] = r;

  async function handleSeedWeeks() {
    if (!weeks.length) return;
    setSeeding(true);
    try {
      const res = await import('../../lib/api').then(({ campaignsApi: api }) =>
        api.seedKpiWeekly(campaign.id, { metrics: activeMetrics, weeks })
      );
      setRows((res as { rows: KpiWeeklyRow[] }).rows ?? rows);
      showToast('Weekly grid seeded', 'success');
    } catch { showToast('Failed to seed weeks', 'error'); }
    finally { setSeeding(false); }
  }

  async function handleCellSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const week = weeks.find(w => w.label === editing.weekLabel);
      const existing = byKey[cellKey(editing.metric, editing.weekLabel)];
      const payload: Record<string, unknown> = {
        metric: editing.metric,
        weekLabel: editing.weekLabel,
        weekStart: week?.weekStart ?? Date.now(),
        target: existing?.target ?? null,
        actual: existing?.actual ?? null,
        [editing.field]: parseFloat(editing.value) || 0,
      };
      const res = await import('../../lib/api').then(({ campaignsApi: api }) =>
        api.upsertKpiWeekly(campaign.id, payload)
      );
      const updated = (res as { row: KpiWeeklyRow }).row;
      setRows(prev => {
        const idx = prev.findIndex(r => r.metric === editing.metric && r.weekLabel === editing.weekLabel);
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [...prev, updated];
      });
      setEditing(null);
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Spinner size={20} /></div>;
  if (!weeks.length) return (
    <div className="text-center py-8 text-sm text-mission-control-text-dim">
      Set campaign start date to enable the weekly KPI grid.
    </div>
  );

  const hasData = rows.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-mission-control-text">Weekly KPI Matrix</h4>
        {!hasData && (
          <Button variant="soft" size="1" onClick={handleSeedWeeks} disabled={seeding}>
            {seeding ? <Spinner size={12} /> : null}
            Initialize {weeks.length} weeks
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-mission-control-text-dim font-medium py-2 pr-3 sticky left-0 bg-mission-control-bg min-w-[90px]">Metric</th>
              <th className="text-mission-control-text-dim font-medium py-2 pr-3 min-w-[48px]">Type</th>
              {weeks.map(w => (
                <th key={w.label} className="text-center text-mission-control-text-dim font-medium py-2 px-2 min-w-[72px]">
                  <div>{w.label}</div>
                  <div className="text-[9px] font-normal opacity-60">
                    {new Date(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeMetrics.map(metric => (
              ['target', 'actual'].map(field => (
                <tr key={`${metric}-${field}`} className={field === 'target' ? 'border-t border-mission-control-border/40' : ''}>
                  {field === 'target' ? (
                    <td rowSpan={2} className="text-mission-control-text font-medium py-2 pr-3 sticky left-0 bg-mission-control-bg align-middle">
                      {KPI_LABELS[metric]}
                    </td>
                  ) : null}
                  <td className={`py-1 pr-3 ${field === 'target' ? 'text-mission-control-text-dim' : 'text-mission-control-text font-medium'}`}>
                    {field === 'target' ? 'Target' : 'Actual'}
                  </td>
                  {weeks.map(w => {
                    const cell = byKey[cellKey(metric, w.label)];
                    const val = cell?.[field as 'target' | 'actual'];
                    const isEditing = editing?.metric === metric && editing.weekLabel === w.label && editing.field === field;
                    return (
                      <td key={w.label} className="text-center px-2 py-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              className="w-14 bg-mission-control-surface border border-mission-control-accent rounded px-1 py-0.5 text-xs text-mission-control-text text-right tabular-nums"
                              value={editing.value}
                              onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : prev)}
                              onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditing(null); }}
                              autoFocus
                            />
                            <button onClick={handleCellSave} disabled={saving} className="text-success hover:opacity-80"><Check size={11} /></button>
                            <button onClick={() => setEditing(null)} className="text-mission-control-text-dim hover:opacity-80"><X size={11} /></button>
                          </div>
                        ) : (
                          <button
                            className={`tabular-nums px-1.5 py-0.5 rounded hover:bg-mission-control-border/60 transition-colors w-full text-center ${val != null ? (field === 'actual' ? 'text-mission-control-text font-semibold' : 'text-mission-control-text-dim') : 'text-mission-control-text-dim/30'}`}
                            onClick={() => setEditing({ metric, weekLabel: w.label, field: field as 'target' | 'actual', value: val != null ? String(val) : '' })}
                          >
                            {val != null ? val.toLocaleString() : '—'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Timeline Tab Wrapper (toggle between milestone list & full calendar) ───────
type TimelineView = 'timeline' | 'calendar';

function TimelineTabWrapper({ campaign }: { campaign: Campaign }) {
  const [view, setView] = useState<TimelineView>('timeline');

  // Build calendar events from campaign dates
  const campaignEvents: CalendarEvent[] = [];
  if (campaign.startDate) {
    campaignEvents.push({
      id: `campaign-${campaign.id}-start`,
      summary: `${campaign.name} — Start`,
      description: campaign.description || '',
      source: 'mission-control',
      start: { date: new Date(campaign.startDate).toISOString().slice(0, 10) },
      end: { date: new Date(campaign.startDate).toISOString().slice(0, 10) },
    });
  }
  if (campaign.endDate) {
    campaignEvents.push({
      id: `campaign-${campaign.id}-end`,
      summary: `${campaign.name} — End`,
      description: campaign.description || '',
      source: 'mission-control',
      start: { date: new Date(campaign.endDate).toISOString().slice(0, 10) },
      end: { date: new Date(campaign.endDate).toISOString().slice(0, 10) },
    });
  }
  if (campaign.startDate && campaign.endDate && campaign.endDate > campaign.startDate) {
    campaignEvents.push({
      id: `campaign-${campaign.id}-span`,
      summary: campaign.name,
      description: campaign.description || '',
      source: 'mission-control',
      start: { date: new Date(campaign.startDate).toISOString().slice(0, 10) },
      end: { date: new Date(campaign.endDate).toISOString().slice(0, 10) },
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* View toggle */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-2 border-b border-mission-control-border flex-shrink-0">
        <div className="flex bg-mission-control-border/40 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setView('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'timeline' ? 'bg-mission-control-surface text-mission-control-text shadow-sm' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
          >
            <CircleDot size={12} /> Timeline
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-mission-control-surface text-mission-control-text shadow-sm' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
          >
            <CalendarDays size={12} /> Calendar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'timeline' && <TimelineTab campaign={campaign} />}
        {view === 'calendar' && <EpicCalendar externalEvents={campaignEvents} createButtonLabel="Add Campaign Event" />}
      </div>
    </div>
  );
}

// ── Timeline Tab ───────────────────────────────────────────────────────────────
interface TimelineMilestone {
  label: string;
  date: number;
  type: 'start' | 'task' | 'end';
}

function TimelineTab({ campaign }: { campaign: Campaign }) {
  const [tasks, setTasks] = useState<{ id: string; title: string; dueDate?: number | null; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../../lib/api').then(({ taskApi }) =>
      taskApi.getAll({ project: campaign.id })
        .then((d: { tasks?: typeof tasks }) => setTasks(d.tasks ?? []))
        .catch(err => console.warn('[CampaignWorkspace] Non-critical:', err))
        .finally(() => setLoading(false))
    );
  }, [campaign.id]);

  const now = Date.now();
  const start = campaign.startDate ?? null;
  const end = campaign.endDate ?? null;

  const milestones: TimelineMilestone[] = [];
  if (start) milestones.push({ label: 'Campaign start', date: start, type: 'start' });
  for (const t of tasks) {
    if (t.dueDate) milestones.push({ label: t.title, date: t.dueDate as number, type: 'task' });
  }
  if (end) milestones.push({ label: 'Campaign end', date: end, type: 'end' });
  milestones.sort((a, b) => a.date - b.date);

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size={24} /></div>;

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-3">
        <Calendar size={28} className="text-mission-control-text-dim" />
        <p className="text-sm text-mission-control-text-dim">No timeline data yet.</p>
        <p className="text-xs text-mission-control-text-dim">Set start/end dates and add due dates to tasks.</p>
      </div>
    );
  }

  const rangeStart = milestones[0].date;
  const rangeEnd = milestones[milestones.length - 1].date;
  const span = Math.max(rangeEnd - rangeStart, 1);
  const pct = (date: number) => Math.min(100, Math.max(0, ((date - rangeStart) / span) * 100));
  const nowPct = pct(now);

  function dotColor(m: TimelineMilestone) {
    if (m.type === 'start') return 'var(--color-success)';
    if (m.type === 'end') return m.date < now ? 'var(--color-error)' : 'var(--color-info)';
    return m.date < now ? 'var(--mission-control-border)' : 'var(--mission-control-accent)';
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">

      {/* Calendar Grid */}
      {(() => {
        const refDate = start ? new Date(start) : new Date();
        const year = refDate.getFullYear();
        const month = refDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Group milestones by day
        const byDay: Record<number, TimelineMilestone[]> = {};
        for (const m of milestones) {
          const d = new Date(m.date);
          if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(m);
          }
        }

        return (
          <div>
            <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-3">
              {refDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h3>
            <div className="grid grid-cols-7 gap-px bg-mission-control-border rounded-lg overflow-hidden">
              {dayNames.map(d => (
                <div key={d} className="bg-mission-control-surface px-2 py-1.5 text-center text-xs font-medium text-mission-control-text-dim">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-mission-control-bg min-h-[72px]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = `${year}-${month}-${day}` === todayStr;
                const events = byDay[day] || [];
                return (
                  <div key={day} className={`bg-mission-control-bg min-h-[72px] p-1.5 ${isToday ? 'ring-1 ring-inset ring-mission-control-accent' : ''}`}>
                    <span className={`text-xs font-medium ${isToday ? 'text-mission-control-accent' : 'text-mission-control-text-dim'}`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {events.slice(0, 2).map((ev, j) => (
                        <div key={j} className="text-[10px] leading-tight truncate px-1 py-0.5 rounded" style={{ backgroundColor: dotColor(ev) + '22', color: dotColor(ev) }}>
                          {ev.label}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[10px] text-mission-control-text-dim px-1">+{events.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Vertical timeline */}
      <div>
        <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-4">Timeline</h3>
        <div className="relative ml-3">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-0 bottom-0 w-px bg-mission-control-border/50" />
          <div className="space-y-0">
            {milestones.map((m, i) => {
              const isPast = m.date < now;
              const isToday = Math.abs(m.date - now) < 86_400_000;
              const isSoon = !isPast && m.date <= now + 7 * 86_400_000;
              return (
                <div key={i} className="relative flex items-start gap-3 pb-4">
                  {/* Dot on the line */}
                  <div
                    className={`relative z-10 w-3 h-3 rounded-full flex-shrink-0 mt-1 ${isToday ? 'ring-4 ring-mission-control-accent/20' : ''}`}
                    style={{
                      backgroundColor: isPast ? dotColor(m) : 'var(--mission-control-bg)',
                      border: `2px solid ${dotColor(m)}`,
                    }}
                  />
                  {/* Content */}
                  <div className={`flex-1 flex items-center justify-between gap-3 pb-3 ${i < milestones.length - 1 ? 'border-b border-mission-control-border/30' : ''}`}>
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${isPast ? 'text-mission-control-text-dim line-through' : isSoon ? 'text-mission-control-accent' : 'text-mission-control-text'}`}>
                        {m.label}
                      </span>
                      {isToday && <span className="ml-2 text-[10px] tabular-nums text-mission-control-accent font-semibold">Today</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] tabular-nums text-mission-control-text-dim">
                        {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {isPast && <CheckCircle2 size={13} className="text-success" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Budget Tracker ─────────────────────────────────────────────────────────────
function BudgetTracker({ campaign }: { campaign: Campaign }) {
  const [tasks, setTasks] = useState<{ id: string; estimatedHours?: number | null }[]>([]);

  useEffect(() => {
    import('../../lib/api').then(({ taskApi }) =>
      taskApi.getAll({ project: campaign.id })
        .then((d: { tasks?: typeof tasks }) => setTasks(d.tasks ?? []))
        .catch(err => console.warn('[CampaignWorkspace] Non-critical:', err))
    );
  }, [campaign.id]);

  const budget = campaign.budget ?? 0;
  if (budget <= 0) return null;

  const HOURLY_RATE = 50;
  const estimatedSpend = tasks.reduce((acc, t) => acc + ((t.estimatedHours ?? 0) as number) * HOURLY_RATE, 0);
  const actualSpend = campaign.budgetSpent ?? 0;
  const displaySpend = actualSpend > 0 ? actualSpend : estimatedSpend;
  const remaining = Math.max(0, budget - displaySpend);
  const consumedPct = budget > 0 ? Math.min(100, Math.round((displaySpend / budget) * 100)) : 0;
  const isEstimated = actualSpend === 0 && estimatedSpend > 0;

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-3">
      <Flex align="center" justify="between">
        <h3 className="text-sm font-medium text-mission-control-text flex items-center gap-1.5">
          <DollarSign size={14} className="text-mission-control-text-dim" />
          Budget Tracker
        </h3>
        {isEstimated && (
          <span className="text-xs text-mission-control-text-dim italic">est. from task hours</span>
        )}
      </Flex>
      <div className="grid grid-cols-3 gap-3 text-center tabular-nums">
        <div>
          <div className="text-base font-semibold text-mission-control-text">${budget.toLocaleString()}</div>
          <div className="text-xs text-mission-control-text-dim">Total Budget</div>
        </div>
        <div>
          <div className={`text-base font-semibold ${consumedPct > 90 ? 'text-error' : consumedPct > 70 ? 'text-warning' : 'text-mission-control-text'}`}>
            ${Math.round(displaySpend).toLocaleString()}
          </div>
          <div className="text-xs text-mission-control-text-dim">{isEstimated ? 'Est. Spend' : 'Spent'}</div>
        </div>
        <div>
          <div className="text-base font-semibold text-success">${Math.round(remaining).toLocaleString()}</div>
          <div className="text-xs text-mission-control-text-dim">Remaining</div>
        </div>
      </div>
      <div>
        <Flex align="center" justify="between" className="text-xs text-mission-control-text-dim mb-1.5 tabular-nums">
          <span>{consumedPct}% consumed</span>
          <span>{campaign.currency ?? 'USD'}</span>
        </Flex>
        <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-colors duration-500 ${consumedPct > 90 ? 'bg-error' : consumedPct > 70 ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${consumedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({ campaign, onUpdate }: { campaign: Campaign; onUpdate: () => void }) {
  const [editingBrief, setEditingBrief] = useState(false);
  const [brief, setBrief] = useState(campaign.briefContent ?? '');
  const [editingDetails, setEditingDetails] = useState(false);
  const [form, setForm] = useState({
    description: campaign.description ?? '',
    targetAudience: campaign.targetAudience ?? '',
    budget: campaign.budget?.toString() ?? '',
    startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().slice(0, 10) : '',
    endDate: campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 10) : '',
    status: campaign.status,
  });
  const [saving, setSaving] = useState(false);

  const handleSaveBrief = async () => {
    setSaving(true);
    try {
      await campaignsApi.update(campaign.id, { briefContent: brief });
      setEditingBrief(false);
      onUpdate();
      showToast('Brief saved', 'success');
    } catch { showToast('Failed to save brief', 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await campaignsApi.update(campaign.id, {
        description: form.description || null,
        targetAudience: form.targetAudience || null,
        budget: form.budget ? parseFloat(form.budget) : null,
        startDate: form.startDate ? new Date(form.startDate).getTime() : null,
        endDate: form.endDate ? new Date(form.endDate).getTime() : null,
        status: form.status,
      });
      setEditingDetails(false);
      onUpdate();
      showToast('Details updated', 'success');
    } catch { showToast('Failed to update', 'error'); }
    finally { setSaving(false); }
  };

  const handleChannelToggle = async (ch: string) => {
    const channels = campaign.channels ?? [];
    const next = channels.includes(ch) ? channels.filter(c => c !== ch) : [...channels, ch];
    try {
      await campaignsApi.update(campaign.id, { channels: next });
      onUpdate();
    } catch { showToast('Failed to update channels', 'error'); }
  };

  const STATUS_OPTIONS = ['draft', 'planning', 'live', 'paused', 'completed', 'archived'];
  const sc = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const tc = TYPE_COLORS[campaign.type] ?? TYPE_COLORS.general;

  // Quick-stats computed values
  const totalTasks = campaign.totalTasks ?? 0;
  const doneTasks = campaign.doneTasks ?? 0;
  const inProgressTasks = campaign.inProgressTasks ?? 0;
  const taskProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const memberCount = (campaign.members ?? []).length;
  const now = Date.now();
  const timelineStart = campaign.startDate;
  const timelineEnd = campaign.endDate;
  const timelinePct = timelineStart && timelineEnd && timelineEnd > timelineStart
    ? Math.min(100, Math.max(0, Math.round(((now - timelineStart) / (timelineEnd - timelineStart)) * 100)))
    : null;
  const daysRemaining = timelineEnd ? Math.max(0, Math.ceil((timelineEnd - now) / (1000 * 60 * 60 * 24))) : null;
  const isOverdue = timelineEnd != null && now > timelineEnd && campaign.status !== 'completed' && campaign.status !== 'archived';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">

      {/* Quick-stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Tasks */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-1.5">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
            <CheckCircle2 size={12} /> Tasks
          </Flex>
          <div className="text-lg font-semibold text-mission-control-text leading-none tabular-nums">
            {totalTasks > 0 ? `${doneTasks}/${totalTasks}` : '—'}
          </div>
          {totalTasks > 0 && (
            <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-success" style={{ width: `${taskProgress}%` }} />
            </div>
          )}
        </div>

        {/* In progress */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-1.5">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
            <CircleDot size={12} /> In Progress
          </Flex>
          <div className={`text-lg font-semibold leading-none ${inProgressTasks > 0 ? 'text-warning' : 'text-mission-control-text'}`}>
            {inProgressTasks > 0 ? inProgressTasks : '—'}
          </div>
        </div>

        {/* Members */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-1.5">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
            <Users size={12} /> Agents
          </Flex>
          <div className="text-lg font-semibold text-mission-control-text leading-none">
            {memberCount > 0 ? memberCount : '—'}
          </div>
          {memberCount === 0 && (
            <p className="text-xs text-mission-control-text-dim">None assigned</p>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-1.5">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
            <CalendarDays size={12} /> Timeline
          </Flex>
          {timelinePct !== null ? (
            <>
              <div className={`text-lg font-semibold leading-none ${isOverdue ? 'text-error' : daysRemaining !== null && daysRemaining <= 7 ? 'text-warning' : 'text-mission-control-text'}`}>
                {isOverdue ? 'Overdue' : daysRemaining === 0 ? 'Today' : daysRemaining !== null ? `${daysRemaining}d` : `${timelinePct}%`}
              </div>
              <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isOverdue ? 'bg-error' : daysRemaining !== null && daysRemaining <= 7 ? 'bg-warning' : 'bg-info'}`}
                  style={{ width: `${timelinePct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="text-lg font-semibold text-mission-control-text leading-none">—</div>
          )}
        </div>
      </div>

      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
        <Flex align="center" justify="between" mb="3">
          <h3 className="text-sm font-medium text-mission-control-text">Campaign Details</h3>
          <button type="button" onClick={() => setEditingDetails(v => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
            <Edit3 size={11} /> {editingDetails ? 'Cancel' : 'Edit'}
          </button>
        </Flex>
        {editingDetails ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-mission-control-text-dim mb-1 block">Status</label>
              <Select.Root value={form.status} onValueChange={val => setForm(p => ({ ...p, status: val }))}>
                <Select.Trigger className="w-full" />
                <Select.Content>
                  {STATUS_OPTIONS.map(s => <Select.Item key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <label className="text-xs text-mission-control-text-dim mb-1 block">Description</label>
              <TextField.Root value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} size="1" />
            </div>
            <div>
              <label className="text-xs text-mission-control-text-dim mb-1 block">Target audience</label>
              <TextField.Root value={form.targetAudience} onChange={e => setForm(p => ({ ...p, targetAudience: e.target.value }))} size="1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">Budget (USD)</label>
                <TextField.Root type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} size="1" />
              </div>
              <div />
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">Start date</label>
                <TextField.Root type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} size="1" />
              </div>
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">End date</label>
                <TextField.Root type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} size="1" />
              </div>
            </div>
            <Flex gap="2">
              <Button variant="solid" size="1" onClick={handleSaveDetails} disabled={saving}>
                {saving ? <Spinner size={12} /> : <Check size={12} />} Save
              </Button>
              <button type="button" onClick={() => setEditingDetails(false)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                Cancel
              </button>
            </Flex>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-mission-control-text-dim block">Type</span>
              <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border mt-0.5 ${tc}`}>{TYPE_LABELS[campaign.type] ?? campaign.type}</span>
            </div>
            <div>
              <span className="text-xs text-mission-control-text-dim block">Status</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-0.5 ${sc.cls}`}>
                {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                {sc.label}
              </span>
            </div>
            <div>
              <span className="text-xs text-mission-control-text-dim block">Goal</span>
              <span className="text-mission-control-text">{campaign.goal ?? '—'}</span>
            </div>
            <div>
              <span className="text-xs text-mission-control-text-dim block">Budget</span>
              <span className="text-mission-control-text">{campaign.budget != null ? `$${campaign.budget.toLocaleString()} ${campaign.currency}` : '—'}</span>
            </div>
            {campaign.startDate && (
              <div>
                <span className="text-xs text-mission-control-text-dim block">Start</span>
                <span className="text-mission-control-text">{new Date(campaign.startDate).toLocaleDateString()}</span>
              </div>
            )}
            {campaign.endDate && (
              <div>
                <span className="text-xs text-mission-control-text-dim block">End</span>
                <span className="text-mission-control-text">{new Date(campaign.endDate).toLocaleDateString()}</span>
              </div>
            )}
            {campaign.targetAudience && (
              <div className="col-span-2">
                <span className="text-xs text-mission-control-text-dim block">Audience</span>
                <span className="text-mission-control-text">{campaign.targetAudience}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
        <Flex align="center" justify="between" mb="3">
          <h3 className="text-sm font-medium text-mission-control-text">Campaign Brief</h3>
          <button type="button" onClick={() => setEditingBrief(v => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
            <Edit3 size={11} /> {editingBrief ? 'Cancel' : 'Edit'}
          </button>
        </Flex>
        {editingBrief ? (
          <div className="space-y-2">
            <TextArea value={brief} onChange={e => setBrief(e.target.value)} rows={6} variant="soft"
              placeholder="Write the campaign brief: strategy, key messages, creative direction..." />
            <Flex gap="2">
              <Button variant="solid" size="1" onClick={handleSaveBrief} disabled={saving}>
                {saving ? <Spinner size={12} /> : <Check size={12} />} Save Brief
              </Button>
              <button type="button" onClick={() => { setEditingBrief(false); setBrief(campaign.briefContent ?? ''); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                Cancel
              </button>
            </Flex>
          </div>
        ) : (
          <div className="text-sm text-mission-control-text leading-relaxed min-h-[60px] prose prose-invert prose-sm max-w-none">
            {campaign.briefContent ? (
              <ReactMarkdown>{campaign.briefContent}</ReactMarkdown>
            ) : (
              <span className="text-mission-control-text-dim italic">No brief yet. Click Edit to write one.</span>
            )}
          </div>
        )}
      </div>

      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-mission-control-text mb-3">Channels</h3>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CHANNELS.map(ch => {
            const Icon = CHANNEL_ICONS[ch];
            const active = (campaign.channels ?? []).includes(ch);
            return (
              <button
                key={ch}
                onClick={() => handleChannelToggle(ch)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
                }`}
              >
                {Icon && <Icon size={11} />}
                {CHANNEL_LABELS[ch]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Campaign Pulse ────────────────────────────────────────────────────────────
function PulseSection({ campaignId }: { campaignId: string }) {
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<number | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await campaignsApi.generatePulse(campaignId);
      setLastGenerated(Date.now());
      showToast('Pulse report generated — check Campaign Chat', 'success');
    } catch { showToast('Failed to generate pulse', 'error'); }
    finally { setGenerating(false); }
  }

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-3">
      <Flex align="center" justify="between">
        <Flex align="center" gap="2">
          <Activity size={14} className="text-mission-control-accent" />
          <div>
            <h4 className="text-sm font-medium text-mission-control-text">Campaign Pulse</h4>
            <p className="text-xs text-mission-control-text-dim">
              Weekly summary of content status, KPI actuals vs targets, and upcoming items.
              Report is posted to Campaign Chat.
            </p>
          </div>
        </Flex>
        <Button variant="soft" size="1" onClick={handleGenerate} disabled={generating}>
          {generating ? <Spinner size={12} /> : <Activity size={12} />}
          {generating ? 'Generating…' : 'Generate Pulse'}
        </Button>
      </Flex>
      {lastGenerated && (
        <p className="text-[10px] text-mission-control-text-dim">
          Last generated: {new Date(lastGenerated).toLocaleTimeString()} — see Chat tab for the full report.
        </p>
      )}
    </div>
  );
}

// ── Link Automation Modal ──────────────────────────────────────────────────────
const TRIGGER_OPTIONS = [
  { value: 'campaign-started',  label: 'Campaign started' },
  { value: 'campaign-ended',    label: 'Campaign ended' },
  { value: 'milestone-reached', label: 'Milestone reached' },
];

function LinkAutomationModal({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [allAutomations, setAllAutomations] = useState<{ id: string; name: string; status: string }[]>([]);
  const [linked, setLinked] = useState<{ automationId: string; campaignTriggerType: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [triggerType, setTriggerType] = useState('campaign-started');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/automations').then(r => r.json()),
      campaignsApi.listAutomations(campaignId) as Promise<{ automations: { automationId: string; campaignTriggerType: string }[] }>,
    ]).then(([autoRes, linkRes]) => {
      setAllAutomations((autoRes.automations ?? []).filter((a: { status: string }) => a.status !== 'draft'));
      setLinked(linkRes.automations ?? []);
    }).catch(err => console.warn('[CampaignWorkspace] Non-critical:', err)).finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await campaignsApi.linkAutomation(campaignId, selectedId, triggerType);
      showToast('Automation linked', 'success');
      setLinked(prev => [...prev, { automationId: selectedId, campaignTriggerType: triggerType }]);
      setSelectedId('');
    } catch { showToast('Failed to link automation', 'error'); }
    finally { setSaving(false); }
  };

  const handleUnlink = async (automationId: string) => {
    try {
      await campaignsApi.unlinkAutomation(campaignId, automationId);
      setLinked(prev => prev.filter(l => l.automationId !== automationId));
      showToast('Automation unlinked', 'success');
    } catch { showToast('Failed to unlink', 'error'); }
  };

  const linkedIds = new Set(linked.map(l => l.automationId));
  const available = allAutomations.filter(a => !linkedIds.has(a.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <Flex align="center" justify="between">
          <h2 className="text-sm font-semibold text-mission-control-text flex items-center gap-2">
            <Zap size={15} className="text-mission-control-accent" /> Link Automation
          </h2>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
            <X size={16} />
          </button>
        </Flex>

        {loading ? (
          <Flex align="center" justify="center" py="4"><Spinner size={20} /></Flex>
        ) : (
          <>
            {linked.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Linked</p>
                {linked.map(l => {
                  const auto = allAutomations.find(a => a.id === l.automationId);
                  return (
                    <Flex key={l.automationId} align="center" justify="between" className="bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-mission-control-text">{auto?.name ?? l.automationId}</p>
                        <p className="text-[10px] text-mission-control-text-dim capitalize">{l.campaignTriggerType.replace(/-/g, ' ')}</p>
                      </div>
                      <button type="button" onClick={() => handleUnlink(l.automationId)} className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                        <X size={12} />
                      </button>
                    </Flex>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Add automation</p>
              {available.length === 0 ? (
                <p className="text-xs text-mission-control-text-dim py-2">
                  {allAutomations.length === 0
                    ? 'No automations found. Create one in the Automations panel first.'
                    : 'All available automations are already linked.'}
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-mission-control-text-dim mb-1 block">Automation</label>
                    <Select.Root value={selectedId} onValueChange={setSelectedId}>
                      <Select.Trigger className="w-full" placeholder="Select automation..." />
                      <Select.Content>
                        {available.map(a => <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <div>
                    <label className="text-xs text-mission-control-text-dim mb-1 block">Trigger</label>
                    <Select.Root value={triggerType} onValueChange={setTriggerType}>
                      <Select.Trigger className="w-full" />
                      <Select.Content>
                        {TRIGGER_OPTIONS.map(t => <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <Button variant="solid" size="1" onClick={handleLink} disabled={!selectedId || saving} className="w-full justify-center">
                    {saving ? <Spinner size={12} /> : <Zap size={13} />} Link Automation
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Campaign Settings Popover ──────────────────────────────────────────────────
function CampaignSettings({
  campaign, onUpdated, onArchived, onDuplicate,
}: { campaign: Campaign; onUpdated: () => void; onArchived: () => void; onDuplicate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await campaignsApi.update(campaign.id, { name });
      onUpdated();
      setEditing(false);
      showToast('Campaign updated', 'success');
    } catch { showToast('Update failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${campaign.name}"?`)) return;
    try {
      await campaignsApi.delete(campaign.id);
      onArchived();
    } catch { showToast('Archive failed', 'error'); }
  };

  if (!editing) {
    return (
      <div className="absolute right-0 top-full mt-1 w-52 bg-mission-control-bg border border-mission-control-border rounded-xl shadow-xl z-20 py-1 overflow-hidden">
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 w-full px-3 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
          <Edit3 size={14} /> Rename
        </button>
        <button type="button" onClick={onDuplicate} className="inline-flex items-center gap-2 w-full px-3 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors">
          <Copy size={14} /> Duplicate
        </button>
        <div className="my-1 border-t border-mission-control-border" />
        <button type="button" onClick={handleArchive} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors w-full">
          <Trash2 size={14} /> Archive
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-mission-control-bg border border-mission-control-border rounded-lg shadow-xl z-20 p-4 space-y-3">
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 block">Name</label>
        <TextField.Root value={name} onChange={e => setName(e.target.value)} size="1" />
      </div>
      <Flex gap="2">
        <Button variant="solid" size="1" onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
          Cancel
        </button>
      </Flex>
    </div>
  );
}

// ── Checklist Tab ───────────────────────────────────────────────────────────────
interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category: string;
}

const CATEGORY_CLASSES: Record<string, { text: string; bg: string }> = {
  planning:   { text: 'text-mission-control-accent', bg: 'bg-mission-control-accent' },
  creative:   { text: 'text-success',                bg: 'bg-success' },
  compliance: { text: 'text-error',                  bg: 'bg-error' },
  technical:  { text: 'text-warning',                bg: 'bg-warning' },
  general:    { text: 'text-mission-control-text-dim', bg: 'bg-mission-control-text-dim' },
};

function ChecklistTab({ campaign }: { campaign: Campaign }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/checklist`);
      const data = await res.json();
      if (data.success) setItems(data.items);
    } catch (err) { console.warn('[CampaignWorkspace] Non-critical:', err); } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (item: ChecklistItem) => {
    const optimistic = !item.checked;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: optimistic } : i));
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, checked: optimistic }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch (err) {
      console.warn('[CampaignWorkspace] Non-critical:', err);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: item.checked } : i));
      showToast('Failed to update checklist', 'error');
    }
  }, [campaign.id]);

  const reset = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/checklist/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.success) setItems(data.items);
    } catch (err) {
      console.warn('[CampaignWorkspace] Non-critical:', err);
      showToast('Failed to reset checklist', 'error');
    } finally {
      setResetting(false);
    }
  }, [campaign.id]);

  const doneCount = items.filter(i => i.checked).length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const categories = [...new Set(items.map(i => i.category))];

  if (loading) {
    return <Flex align="center" justify="center" py="5"><Spinner size={24} /></Flex>;
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <Flex align="center" justify="between">
        <Flex align="center" gap="3">
          <ClipboardList size={16} className="text-mission-control-text-dim" />
          <div>
            <p className="text-sm font-medium text-mission-control-text">Pre-launch checklist</p>
            <p className="text-xs text-mission-control-text-dim">{doneCount} of {items.length} complete</p>
          </div>
        </Flex>
        <button type="button" onClick={reset} disabled={resetting} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50">
          {resetting ? <Spinner size={12} /> : <RefreshCw size={12} />}
          Reset
        </button>
      </Flex>

      <div>
        <Flex align="center" justify="between" className="mb-1.5">
          <span className="text-[10px] text-mission-control-text-dim uppercase tracking-wider">Progress</span>
          <span className="text-xs font-semibold text-mission-control-text">{pct}%</span>
        </Flex>
        <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-colors duration-500 ${pct === 100 ? 'bg-success' : 'bg-mission-control-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat);
        const catCls = CATEGORY_CLASSES[cat] ?? CATEGORY_CLASSES.general;
        return (
          <div key={cat} className="space-y-2">
            <h4
              className={`text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5 ${catCls.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${catCls.bg}`} />
              {cat}
            </h4>
            {catItems.map(item => (
              <button
                key={item.id}
                onClick={() => toggle(item)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors w-full text-left ${
                  item.checked
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {item.checked ? (
                  <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                ) : (
                  <Square size={16} className="text-mission-control-text-dim flex-shrink-0" />
                )}
                <span
                  className={`text-sm flex-1 ${
                    item.checked
                      ? 'line-through text-mission-control-text-dim'
                      : 'text-mission-control-text'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Workspace ─────────────────────────────────────────────────────────────
interface CampaignWorkspaceProps {
  campaign: Campaign;
  onBack: () => void;
  onUpdated: () => void;
}

export default function CampaignWorkspace({ campaign: initialCampaign, onBack, onUpdated }: CampaignWorkspaceProps) {
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [showLinkAutomation, setShowLinkAutomation] = useState(false);
  const [members, setMembers] = useState<CampaignMember[]>(initialCampaign.members ?? []);
  const [agents, setAgents] = useState<any[]>([]);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [addingAgent, setAddingAgent] = useState<string | null>(null);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const { updateRoomAgents } = useChatRoomStore();
  const campaignRoomId = `campaign-${campaign.id}`;

  const reload = useCallback(async () => {
    try {
      const data = await campaignsApi.get(campaign.id) as { campaign: Campaign };
      setCampaign(data.campaign);
      const newMembers = data.campaign.members ?? [];
      setMembers(newMembers);
      updateRoomAgents(campaignRoomId, newMembers.map(m => m.agentId));
    } catch (err) { console.warn('[CampaignWorkspace] Non-critical:', err); }
  }, [campaign.id, campaignRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload();
    agentApi.getAll().then(setAgents).catch(err => console.warn('[CampaignWorkspace] Non-critical:', err));
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddMember = async (agentId: string) => {
    setAddingAgent(agentId);
    try {
      await campaignsApi.addMember(campaign.id, agentId);
      await reload();
      showToast('Agent added', 'success');
    } catch { showToast('Failed to add agent', 'error'); }
    finally { setAddingAgent(null); }
  };

  const handleRemoveMember = async (agentId: string) => {
    try {
      await campaignsApi.removeMember(campaign.id, agentId);
      setMembers(prev => {
        const next = prev.filter(m => m.agentId !== agentId);
        updateRoomAgents(campaignRoomId, next.map(m => m.agentId));
        return next;
      });
    } catch { showToast('Failed to remove agent', 'error'); }
  };

  const handleGenerateTasks = async () => {
    setGeneratingTasks(true);
    try {
      const result = await campaignsApi.generateTasks(campaign.id) as { success: boolean; tasksCreated: number };
      if (result.success) {
        showToast(`${result.tasksCreated} tasks generated`, 'success');
        setActiveTab('tasks');
        reload();
      } else {
        showToast('Task generation failed', 'error');
      }
    } catch { showToast('Task generation failed', 'error'); }
    finally { setGeneratingTasks(false); }
  };

  const handleDuplicate = async () => {
    try {
      const result = await campaignsApi.duplicate(campaign.id) as { success: boolean; id: string; campaign: Campaign };
      showToast(`Duplicated as "Copy of ${campaign.name}"`, 'success');
      onUpdated();
      // Navigate to new campaign
      if (result.success && result.campaign) {
        setCampaign(result.campaign);
      }
    } catch { showToast('Duplication failed', 'error'); }
  };

  const memberAgentIds = new Set(members.map(m => m.agentId));
  const availableAgents = agents.filter(a => !memberAgentIds.has(a.id) && a.status !== 'archived');
  const sc = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const tc = TYPE_COLORS[campaign.type] ?? TYPE_COLORS.general;

  return (
    <div className="flex flex-col h-full bg-mission-control-surface">
      <div className="bg-mission-control-surface border-b border-mission-control-border">
        <Flex align="center" justify="between" px="4" py="2">
          <Flex align="center" gap="2" className="min-w-0">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors flex-shrink-0">
              <ArrowLeft size={14} /> Campaigns
            </button>
            <span className="text-mission-control-text-dim flex-shrink-0">/</span>
            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: campaign.color }} />
            <span className="text-sm font-medium text-mission-control-text truncate">{campaign.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.cls}`}>
              {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block mr-1" />}
              {sc.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${tc}`}>{TYPE_LABELS[campaign.type] ?? campaign.type}</span>
          </Flex>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center -space-x-1.5">
              {members.slice(0, 5).map(m => (
                <AgentAvatar key={m.agentId} agentId={m.agentId} size="xs" className="ring-1 ring-mission-control-surface" />
              ))}
            </div>
            <button type="button" onClick={() => setShowMemberPanel(v => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
              <Users size={12} /> {members.length} <ChevronDown size={10} />
            </button>
            <div className="w-px h-4 bg-mission-control-border" />
            <button type="button" onClick={handleGenerateTasks} disabled={generatingTasks} title="Generate standard tasks from campaign type" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {generatingTasks ? <Spinner size={12} /> : <ListTodo size={13} />}
              Tasks
            </button>
            <button type="button" onClick={() => setShowLinkAutomation(true)} title="Link an automation to this campaign" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
              <Zap size={13} /> Automation
            </button>
            <Button variant="solid" size="1" onClick={() => setShowDispatch(true)}>
              <Bot size={13} /> Dispatch Agent
            </Button>
            <div className="relative">
              <button type="button" onClick={() => setShowSettings(v => !v)} className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                <Settings size={15} />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
                  <CampaignSettings
                    campaign={campaign}
                    onUpdated={() => { setShowSettings(false); reload(); onUpdated(); }}
                    onArchived={() => { setShowSettings(false); onBack(); }}
                    onDuplicate={() => { setShowSettings(false); handleDuplicate(); }}
                  />
                </>
              )}
            </div>
          </div>
        </Flex>

        {showMemberPanel && (
          <div className="px-4 pb-3 border-t border-mission-control-border pt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map(m => (
                <div key={m.agentId} className="flex items-center gap-1.5 bg-mission-control-surface border border-mission-control-border rounded-full px-2 py-1">
                  <AgentAvatar agentId={m.agentId} size="xs" />
                  <span className="text-xs text-mission-control-text">{(m as any).agentName || m.agentId}</span>
                  <button type="button" onClick={() => handleRemoveMember(m.agentId)} className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {availableAgents.length > 0 && (
                <Select.Root value="" onValueChange={val => { if (val) handleAddMember(val); }} disabled={!!addingAgent}>
                  <Select.Trigger placeholder="+ Add agent" />
                  <Select.Content>
                    {availableAgents.map(a => <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>)}
                  </Select.Content>
                </Select.Root>
              )}
            </div>
          </div>
        )}

        <div className="flex border-t border-mission-control-border px-4 flex-shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-mission-control-accent text-mission-control-accent'
                    : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <Icon size={13} />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview'    && <OverviewTab campaign={campaign} onUpdate={reload} />}
        {activeTab === 'chat'        && <ChatTab campaign={campaign} />}
        {activeTab === 'tasks'       && <Kanban projectId={campaign.id} projectName={campaign.name} onNewTask={() => setShowDispatch(true)} />}
        {activeTab === 'timeline'    && <TimelineTabWrapper campaign={campaign} />}
        {activeTab === 'content'     && <ContentTab campaign={campaign} />}
        {activeTab === 'assets'      && <AssetsTab campaign={campaign} />}
        {activeTab === 'channels'    && <ChannelsTab campaign={campaign} onUpdate={reload} />}
        {activeTab === 'results'     && (
          <div className="h-full overflow-y-auto">
            <PerformanceTab campaign={campaign} onUpdate={reload} />
            <div className="border-t border-mission-control-border px-4 py-4">
              <KpiWeeklyGrid campaign={campaign} />
            </div>
            <div className="border-t border-mission-control-border p-4">
              <PulseSection campaignId={campaign.id} />
            </div>
            <div className="border-t border-mission-control-border">
              <CampaignROIDashboard campaign={campaign} />
            </div>
          </div>
        )}
        {activeTab === 'checklist'   && (
          <div className="h-full overflow-y-auto">
            <ChecklistTab campaign={campaign} />
          </div>
        )}
        {activeTab === 'context'     && <ContextPanel entityType="campaign" entityId={campaign.id} />}
      </div>

      {showDispatch && (
        <CampaignDispatchModal
          campaign={campaign}
          members={members}
          onClose={() => setShowDispatch(false)}
          onDispatched={() => setShowDispatch(false)}
        />
      )}

      {showLinkAutomation && (
        <LinkAutomationModal
          campaignId={campaign.id}
          onClose={() => setShowLinkAutomation(false)}
        />
      )}
    </div>
  );
}
