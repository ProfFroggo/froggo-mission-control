'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, MessageSquare, LayoutGrid, Image as ImageIcon, BarChart2, Radio, FileText,
  Users, Bot, Settings, Plus, X, ChevronDown, Edit3, Trash2, Check,
  Upload, RefreshCw, TrendingUp, TrendingDown, Minus, Link, StickyNote,
  CalendarDays, CheckCircle2, CircleDot,
} from 'lucide-react';
import { Megaphone } from 'lucide-react';
import { campaignsApi, agentApi } from '../../lib/api';
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

type TabId = 'overview' | 'chat' | 'tasks' | 'assets' | 'channels' | 'performance';

const TABS: { id: TabId; label: string; icon: typeof MessageSquare }[] = [
  { id: 'overview',    label: 'Overview',    icon: FileText },
  { id: 'chat',        label: 'Chat',        icon: MessageSquare },
  { id: 'tasks',       label: 'Tasks',       icon: LayoutGrid },
  { id: 'assets',      label: 'Assets',      icon: ImageIcon },
  { id: 'channels',    label: 'Channels',    icon: Radio },
  { id: 'performance', label: 'Performance', icon: BarChart2 },
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
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [campaign.id]);

  const ASSET_TYPES = ['', 'image', 'video', 'copy', 'brief', 'report', 'other'];
  const filtered = assets.filter(a => !filterType || a.assetType === filterType);

  function assetBadge(type: string) {
    const map: Record<string, string> = {
      image: 'text-blue-400 bg-blue-400/10',
      video: 'text-purple-400 bg-purple-400/10',
      copy: 'text-green-400 bg-green-400/10',
      brief: 'text-amber-400 bg-amber-400/10',
      report: 'text-cyan-400 bg-cyan-400/10',
    };
    return map[type] ?? 'text-gray-400 bg-gray-400/10';
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      draft: 'text-gray-400 bg-gray-400/10',
      approved: 'text-green-400 bg-green-400/10',
      live: 'text-blue-400 bg-blue-400/10',
      archived: 'text-gray-400/50 bg-gray-400/5',
    };
    return map[status] ?? 'text-gray-400 bg-gray-400/10';
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-mission-control-border flex-wrap">
        <div className="flex items-center gap-1">
          {ASSET_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors capitalize ${
                filterType === t
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'
              }`}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface rounded transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <label className="flex items-center gap-1 px-2.5 py-1 bg-mission-control-accent text-white rounded text-xs font-medium hover:bg-mission-control-accent/90 transition-colors cursor-pointer">
            <Upload size={12} /> Upload
            <input type="file" className="hidden" onChange={() => showToast('File upload coming soon', 'info')} />
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner size={16} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon size={24} className="text-mission-control-text-dim mb-2" />
            <p className="text-sm text-mission-control-text-dim">No assets yet</p>
            <p className="text-xs text-mission-control-text-dim mt-1">Upload images, videos, copy, or brief documents.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(asset => (
              <div key={asset.id} className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3 space-y-2">
                <div className="w-full h-24 bg-mission-control-border/30 rounded-lg flex items-center justify-center">
                  <ImageIcon size={20} className="text-mission-control-text-dim" />
                </div>
                <div>
                  <p className="text-xs text-mission-control-text-primary truncate font-medium">{asset.fileName}</p>
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
              <div key={ch} className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {Icon && <Icon size={16} className="text-mission-control-text-primary" />}
                    <span className="font-medium text-sm text-mission-control-text-primary">{CHANNEL_LABELS[ch] ?? ch}</span>
                  </div>
                  <button onClick={() => handleToggleChannel(ch)} className="text-xs text-mission-control-text-dim hover:text-error transition-colors">
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><Link size={10} /> Live URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={channelLinks[ch] ?? ''}
                      onChange={e => setChannelLinks(prev => ({ ...prev, [ch]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1"><StickyNote size={10} /> Notes</label>
                    <input
                      type="text"
                      placeholder="Quick note..."
                      value={channelNotes[ch] ?? ''}
                      onChange={e => setChannelNotes(prev => ({ ...prev, [ch]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
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
                <button
                  key={ch}
                  onClick={() => handleToggleChannel(ch)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-mission-control-border rounded-lg text-mission-control-text-dim hover:border-mission-control-accent/40 hover:text-mission-control-accent transition-colors"
                >
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

  function TrendIcon({ pct }: { pct: number }) {
    if (pct >= 100) return <TrendingUp size={13} className="text-success" />;
    if (pct >= 50) return <Minus size={13} className="text-warning" />;
    return <TrendingDown size={13} className="text-error" />;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-mission-control-text">KPI Tracker</h3>
        <button onClick={() => setEditing(v => !v)} className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors">
          <Edit3 size={12} /> {editing ? 'Cancel' : 'Update Metrics'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(KPI_LABELS).map(([key, label]) => {
          const entry = kpis[key] ?? { target: 0, actual: 0 };
          const pct = kpiPct(entry);
          return (
            <div key={key} className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-mission-control-text-dim">{label}</span>
                <TrendIcon pct={pct} />
              </div>
              {editing ? (
                <div className="space-y-1.5">
                  <div>
                    <label className="text-xs text-mission-control-text-dim">Target</label>
                    <input
                      type="number"
                      value={entry.target || ''}
                      onChange={e => setKpis(prev => ({ ...prev, [key]: { ...entry, target: parseFloat(e.target.value) || 0 } }))}
                      className="w-full px-2 py-1 text-xs bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-mission-control-text-dim">Actual</label>
                    <input
                      type="number"
                      value={entry.actual || ''}
                      onChange={e => setKpis(prev => ({ ...prev, [key]: { ...entry, actual: parseFloat(e.target.value) || 0 } }))}
                      className="w-full px-2 py-1 text-xs bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-lg font-semibold text-mission-control-text-primary">
                    {entry.actual > 0 ? entry.actual.toLocaleString() : '—'}
                  </div>
                  {entry.target > 0 && (
                    <>
                      <div className="flex items-center justify-between text-xs text-mission-control-text-dim">
                        <span>Target: {entry.target.toLocaleString()}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct >= 100 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                          }}
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
        <button onClick={handleSaveKpis} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors">
          {saving ? <Spinner size={12} /> : <Check size={14} />} Save Metrics
        </button>
      )}

      {budget > 0 && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-medium text-mission-control-text">Budget</h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-semibold text-mission-control-text-primary">${budget.toLocaleString()}</div>
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
            <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
              <span>Spend rate</span><span>{spendPct}%</span>
            </div>
            <div className="h-2 bg-mission-control-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${spendPct}%`,
                  backgroundColor: spendPct > 90 ? 'var(--color-error)' : spendPct > 70 ? 'var(--color-warning)' : 'var(--color-success)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {start && end && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-medium text-mission-control-text">Timeline</h4>
          <div className="flex items-center justify-between text-xs text-mission-control-text-dim mb-1">
            <span>{new Date(start).toLocaleDateString()}</span>
            <span>{timelineProgress}% elapsed</span>
            <span>{new Date(end).toLocaleDateString()}</span>
          </div>
          <div className="h-2 bg-mission-control-border rounded-full overflow-hidden">
            <div className="h-full bg-mission-control-accent rounded-full transition-all" style={{ width: `${timelineProgress}%` }} />
          </div>
        </div>
      )}
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
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* Quick-stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Tasks */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
            <CheckCircle2 size={12} /> Tasks
          </div>
          <div className="text-lg font-semibold text-mission-control-text-primary leading-none">
            {totalTasks > 0 ? `${doneTasks}/${totalTasks}` : '—'}
          </div>
          {totalTasks > 0 && (
            <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${taskProgress}%`, backgroundColor: 'var(--color-success)' }} />
            </div>
          )}
        </div>

        {/* In progress */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
            <CircleDot size={12} /> In Progress
          </div>
          <div className={`text-lg font-semibold leading-none ${inProgressTasks > 0 ? 'text-warning' : 'text-mission-control-text-primary'}`}>
            {inProgressTasks > 0 ? inProgressTasks : '—'}
          </div>
        </div>

        {/* Members */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
            <Users size={12} /> Agents
          </div>
          <div className="text-lg font-semibold text-mission-control-text-primary leading-none">
            {memberCount > 0 ? memberCount : '—'}
          </div>
          {memberCount === 0 && (
            <p className="text-xs text-mission-control-text-dim">None assigned</p>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
            <CalendarDays size={12} /> Timeline
          </div>
          {timelinePct !== null ? (
            <>
              <div className={`text-lg font-semibold leading-none ${isOverdue ? 'text-error' : daysRemaining !== null && daysRemaining <= 7 ? 'text-warning' : 'text-mission-control-text-primary'}`}>
                {isOverdue ? 'Overdue' : daysRemaining === 0 ? 'Today' : daysRemaining !== null ? `${daysRemaining}d` : `${timelinePct}%`}
              </div>
              <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${timelinePct}%`,
                    backgroundColor: isOverdue ? 'var(--color-error)' : daysRemaining !== null && daysRemaining <= 7 ? 'var(--color-warning)' : 'var(--color-info, #6366f1)',
                  }}
                />
              </div>
            </>
          ) : (
            <div className="text-lg font-semibold text-mission-control-text-primary leading-none">—</div>
          )}
        </div>
      </div>

      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-mission-control-text">Campaign Details</h3>
          <button onClick={() => setEditingDetails(v => !v)} className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-1">
            <Edit3 size={11} /> {editingDetails ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editingDetails ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-mission-control-text-dim mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full text-sm px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-mission-control-text-dim mb-1 block">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full text-sm px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-mission-control-text-dim mb-1 block">Target audience</label>
              <input type="text" value={form.targetAudience} onChange={e => setForm(p => ({ ...p, targetAudience: e.target.value }))}
                className="w-full text-sm px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">Budget (USD)</label>
                <input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))}
                  className="w-full text-sm px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none" />
              </div>
              <div />
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">Start date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full text-sm px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">End date</label>
                <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  className="w-full text-sm px-2 py-1.5 bg-mission-control-bg border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveDetails} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-mission-control-accent text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors">
                {saving ? <Spinner size={12} /> : <Check size={12} />} Save
              </button>
              <button onClick={() => setEditingDetails(false)}
                className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded text-xs hover:text-mission-control-text-primary transition-colors">
                Cancel
              </button>
            </div>
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
                {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                {sc.label}
              </span>
            </div>
            <div>
              <span className="text-xs text-mission-control-text-dim block">Goal</span>
              <span className="text-mission-control-text-primary">{campaign.goal ?? '—'}</span>
            </div>
            <div>
              <span className="text-xs text-mission-control-text-dim block">Budget</span>
              <span className="text-mission-control-text-primary">{campaign.budget != null ? `$${campaign.budget.toLocaleString()} ${campaign.currency}` : '—'}</span>
            </div>
            {campaign.startDate && (
              <div>
                <span className="text-xs text-mission-control-text-dim block">Start</span>
                <span className="text-mission-control-text-primary">{new Date(campaign.startDate).toLocaleDateString()}</span>
              </div>
            )}
            {campaign.endDate && (
              <div>
                <span className="text-xs text-mission-control-text-dim block">End</span>
                <span className="text-mission-control-text-primary">{new Date(campaign.endDate).toLocaleDateString()}</span>
              </div>
            )}
            {campaign.targetAudience && (
              <div className="col-span-2">
                <span className="text-xs text-mission-control-text-dim block">Audience</span>
                <span className="text-mission-control-text-primary">{campaign.targetAudience}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-mission-control-text">Campaign Brief</h3>
          <button onClick={() => setEditingBrief(v => !v)} className="text-xs text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-1">
            <Edit3 size={11} /> {editingBrief ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {editingBrief ? (
          <div className="space-y-2">
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={6}
              className="w-full px-3 py-2 text-sm bg-mission-control-bg border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 resize-none"
              placeholder="Write the campaign brief: strategy, key messages, creative direction..." />
            <div className="flex gap-2">
              <button onClick={handleSaveBrief} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-mission-control-accent text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors">
                {saving ? <Spinner size={12} /> : <Check size={12} />} Save Brief
              </button>
              <button onClick={() => { setEditingBrief(false); setBrief(campaign.briefContent ?? ''); }}
                className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded text-xs hover:text-mission-control-text-primary transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-mission-control-text-primary whitespace-pre-wrap leading-relaxed min-h-[60px]">
            {campaign.briefContent || <span className="text-mission-control-text-dim italic">No brief yet. Click Edit to write one.</span>}
          </div>
        )}
      </div>

      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
        <h3 className="text-sm font-medium text-mission-control-text mb-3">Channels</h3>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CHANNELS.map(ch => {
            const Icon = CHANNEL_ICONS[ch];
            const active = (campaign.channels ?? []).includes(ch);
            return (
              <button key={ch} onClick={() => handleChannelToggle(ch)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all ${
                  active
                    ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-accent/30'
                }`}>
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

// ── Campaign Settings Popover ──────────────────────────────────────────────────
function CampaignSettings({
  campaign, onUpdated, onArchived,
}: { campaign: Campaign; onUpdated: () => void; onArchived: () => void }) {
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
      <div className="absolute right-0 top-full mt-1 w-48 bg-mission-control-bg border border-mission-control-border rounded-xl shadow-xl z-20 py-1 overflow-hidden">
        <button onClick={() => setEditing(true)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mission-control-text-primary hover:bg-mission-control-surface transition-colors">
          <Edit3 size={14} /> Rename
        </button>
        <button onClick={handleArchive} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-error hover:bg-error-subtle transition-colors">
          <Trash2 size={14} /> Archive
        </button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 w-64 bg-mission-control-bg border border-mission-control-border rounded-xl shadow-xl z-20 p-4 space-y-3">
      <div>
        <label className="text-xs text-mission-control-text-dim mb-1 block">Name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full px-2 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded text-mission-control-text-primary focus:outline-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-1.5 bg-mission-control-accent text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-mission-control-accent/90 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)}
          className="px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded text-xs hover:text-mission-control-text-primary transition-colors">
          Cancel
        </button>
      </div>
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
  const [members, setMembers] = useState<CampaignMember[]>(initialCampaign.members ?? []);
  const [agents, setAgents] = useState<any[]>([]);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [addingAgent, setAddingAgent] = useState<string | null>(null);
  const { updateRoomAgents } = useChatRoomStore();
  const campaignRoomId = `campaign-${campaign.id}`;

  const reload = useCallback(async () => {
    try {
      const data = await campaignsApi.get(campaign.id) as { campaign: Campaign };
      setCampaign(data.campaign);
      const newMembers = data.campaign.members ?? [];
      setMembers(newMembers);
      updateRoomAgents(campaignRoomId, newMembers.map(m => m.agentId));
    } catch { /* non-critical */ }
  }, [campaign.id, campaignRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload();
    agentApi.getAll().then(setAgents).catch(() => {});
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

  const memberAgentIds = new Set(members.map(m => m.agentId));
  const availableAgents = agents.filter(a => !memberAgentIds.has(a.id) && a.status !== 'archived');
  const sc = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG.draft;
  const tc = TYPE_COLORS[campaign.type] ?? TYPE_COLORS.general;

  return (
    <div className="flex flex-col h-full bg-mission-control-bg0">
      <div className="bg-mission-control-surface border-b border-mission-control-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-mission-control-text-dim hover:text-mission-control-text-primary transition-colors flex-shrink-0">
              <ArrowLeft size={14} /> Campaigns
            </button>
            <span className="text-mission-control-text-dim flex-shrink-0">/</span>
            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: campaign.color }} />
            <span className="text-sm font-medium text-mission-control-text-primary truncate">{campaign.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.cls}`}>
              {sc.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1" />}
              {sc.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${tc}`}>{TYPE_LABELS[campaign.type] ?? campaign.type}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center -space-x-1.5">
              {members.slice(0, 5).map(m => (
                <AgentAvatar key={m.agentId} agentId={m.agentId} size="xs" className="ring-1 ring-mission-control-surface" />
              ))}
            </div>
            <button onClick={() => setShowMemberPanel(v => !v)}
              className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface px-2 py-1 rounded transition-colors">
              <Users size={12} /> {members.length} <ChevronDown size={10} />
            </button>
            <div className="w-px h-4 bg-mission-control-border" />
            <button onClick={() => setShowDispatch(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-xs font-medium">
              <Bot size={13} /> Dispatch Agent
            </button>
            <div className="relative">
              <button onClick={() => setShowSettings(v => !v)}
                className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface rounded-lg transition-colors">
                <Settings size={15} />
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSettings(false)} />
                  <CampaignSettings
                    campaign={campaign}
                    onUpdated={() => { setShowSettings(false); reload(); onUpdated(); }}
                    onArchived={() => { setShowSettings(false); onBack(); }}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {showMemberPanel && (
          <div className="px-4 pb-3 border-t border-mission-control-border pt-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map(m => (
                <div key={m.agentId} className="flex items-center gap-1.5 bg-mission-control-surface border border-mission-control-border rounded-full px-2 py-1">
                  <AgentAvatar agentId={m.agentId} size="xs" />
                  <span className="text-xs text-mission-control-text-primary">{(m as any).agentName || m.agentId}</span>
                  <button onClick={() => handleRemoveMember(m.agentId)} className="text-mission-control-text-dim hover:text-error transition-colors">
                    <X size={10} />
                  </button>
                </div>
              ))}
              {availableAgents.length > 0 && (
                <select defaultValue="" onChange={e => { if (e.target.value) handleAddMember(e.target.value); e.target.value = ''; }}
                  disabled={!!addingAgent}
                  className="text-xs px-2 py-1 bg-mission-control-accent/20 border border-mission-control-accent/40 text-mission-control-accent rounded-full focus:outline-none cursor-pointer">
                  <option value="" disabled>+ Add agent</option>
                  {availableAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        <div className="flex border-t border-mission-control-border overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-mission-control-accent text-mission-control-accent'
                    : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text-primary'
                }`}>
                <Icon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview'    && <OverviewTab campaign={campaign} onUpdate={reload} />}
        {activeTab === 'chat'        && <ChatTab campaign={campaign} />}
        {activeTab === 'tasks'       && <Kanban projectId={campaign.id} projectName={campaign.name} onNewTask={() => setShowDispatch(true)} />}
        {activeTab === 'assets'      && <AssetsTab campaign={campaign} />}
        {activeTab === 'channels'    && <ChannelsTab campaign={campaign} onUpdate={reload} />}
        {activeTab === 'performance' && <PerformanceTab campaign={campaign} onUpdate={reload} />}
      </div>

      {showDispatch && (
        <CampaignDispatchModal
          campaign={campaign}
          members={members}
          onClose={() => setShowDispatch(false)}
          onDispatched={() => setShowDispatch(false)}
        />
      )}
    </div>
  );
}
