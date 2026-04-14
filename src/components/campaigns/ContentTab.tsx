'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit3, Check, X, Bot, User, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { Button, IconButton, Select, TextField, TextArea } from '@radix-ui/themes';
import { campaignsApi } from '../../lib/api';
import { CHANNEL_ICONS, CHANNEL_LABELS, ALL_CHANNELS } from './channelIcons';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import type { Campaign } from '../../types/campaigns';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Phase {
  id: string;
  campaignId: string;
  name: string;
  startDate: number | null;
  endDate: number | null;
  color: string;
  channels: string[];
  owner: string | null;
  sortOrder: number;
}

interface ContentItem {
  id: string;
  campaignId: string;
  phaseId: string | null;
  scheduledDate: number | null;
  channels: string[];
  description: string;
  angle: string;
  ownerType: 'human' | 'ai';
  ownerId: string;
  approverId: string;
  status: string;
  sortOrder: number;
}

const STATUS_OPTIONS = ['draft', 'scheduled', 'active', 'ongoing', 'in-review', 'done', 'tbd'] as const;
type ContentStatus = typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft:      'bg-mission-control-border text-mission-control-text-dim',
  scheduled:  'bg-blue-500/15 text-blue-400',
  active:     'bg-success/15 text-success',
  ongoing:    'bg-warning/15 text-warning',
  'in-review':'bg-orange-500/15 text-orange-400',
  done:       'bg-success/20 text-success font-semibold',
  tbd:        'bg-mission-control-border/50 text-mission-control-text-dim italic',
};

// ── Channel Pill ───────────────────────────────────────────────────────────────

function ChannelPill({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICONS[channel];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/20">
      {Icon && <Icon size={10} />}
      {CHANNEL_LABELS[channel] ?? channel}
    </span>
  );
}

// ── Inline Item Form ───────────────────────────────────────────────────────────

interface ItemFormProps {
  campaignId: string;
  phaseId: string | null;
  initial?: Partial<ContentItem>;
  onSave: (item: ContentItem) => void;
  onCancel: () => void;
}

function ItemForm({ campaignId, phaseId, initial, onSave, onCancel }: ItemFormProps) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [angle, setAngle] = useState(initial?.angle ?? '');
  const [channels, setChannels] = useState<string[]>(initial?.channels ?? []);
  const [scheduledDate, setScheduledDate] = useState(
    initial?.scheduledDate ? new Date(initial.scheduledDate).toISOString().slice(0, 10) : ''
  );
  const [ownerType, setOwnerType] = useState<'human' | 'ai'>(initial?.ownerType ?? 'human');
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? '');
  const [approverId, setApproverId] = useState(initial?.approverId ?? '');
  const [status, setStatus] = useState<ContentStatus>((initial?.status as ContentStatus) ?? 'draft');
  const [saving, setSaving] = useState(false);

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  async function handleSave() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      const payload = {
        phaseId,
        description: description.trim(),
        angle: angle.trim(),
        channels,
        scheduledDate: scheduledDate ? new Date(scheduledDate).getTime() : null,
        ownerType,
        ownerId: ownerId.trim(),
        approverId: approverId.trim(),
        status,
      };
      let res;
      if (initial?.id) {
        res = await campaignsApi.updateContentItem(campaignId, initial.id, payload);
      } else {
        res = await campaignsApi.createContentItem(campaignId, payload);
      }
      onSave((res as { item: ContentItem }).item);
    } catch {
      showToast('Failed to save content item', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-2.5">
      <TextArea
        placeholder="Content description..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        size="1"
      />
      <TextField.Root
        placeholder="Strategic angle — why this piece, why now"
        value={angle}
        onChange={e => setAngle(e.target.value)}
        size="1"
      />
      <div className="flex flex-wrap gap-1">
        {ALL_CHANNELS.map(ch => (
          <button
            key={ch}
            onClick={() => toggleChannel(ch)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              channels.includes(ch)
                ? 'bg-mission-control-accent/20 text-mission-control-accent border-mission-control-accent/40'
                : 'bg-mission-control-bg text-mission-control-text-dim border-mission-control-border hover:border-mission-control-text-dim'
            }`}
          >
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">Date</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-xs text-mission-control-text"
          />
        </div>
        <div>
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ContentStatus)}
            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-xs text-mission-control-text"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">Owner type</label>
          <select
            value={ownerType}
            onChange={e => setOwnerType(e.target.value as 'human' | 'ai')}
            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-xs text-mission-control-text"
          >
            <option value="human">Human</option>
            <option value="ai">AI Agent</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">Owner</label>
          <TextField.Root size="1" placeholder="Owner name / agent ID" value={ownerId} onChange={e => setOwnerId(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">Approver</label>
          <TextField.Root size="1" placeholder="Approver" value={approverId} onChange={e => setApproverId(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="1" color="gray" onClick={onCancel}>Cancel</Button>
        <Button variant="solid" size="1" onClick={handleSave} disabled={saving || !description.trim()}>
          {saving ? <Spinner size={12} /> : <Check size={13} />} Save
        </Button>
      </div>
    </div>
  );
}

// ── Content Row ────────────────────────────────────────────────────────────────

interface ContentRowProps {
  item: ContentItem;
  campaignId: string;
  onUpdated: (item: ContentItem) => void;
  onDeleted: (id: string) => void;
}

function ContentRow({ item, campaignId, onUpdated, onDeleted }: ContentRowProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await campaignsApi.deleteContentItem(campaignId, item.id);
      onDeleted(item.id);
    } catch {
      showToast('Failed to delete item', 'error');
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <ItemForm
        campaignId={campaignId}
        phaseId={item.phaseId}
        initial={item}
        onSave={updated => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const statusLabel = item.status as ContentStatus;
  const statusClass = STATUS_COLORS[statusLabel] ?? STATUS_COLORS.draft;

  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-surface/40 rounded px-2 -mx-2 transition-colors">
      {/* Date */}
      <div className="flex-shrink-0 w-16 text-center">
        {item.scheduledDate ? (
          <span className="text-[10px] font-medium text-mission-control-text-dim bg-mission-control-border/50 rounded px-1.5 py-0.5 tabular-nums">
            {new Date(item.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        ) : (
          <span className="text-[10px] text-mission-control-text-dim/50">—</span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-mission-control-text leading-snug">{item.description}</p>
        {item.angle && (
          <p className="text-xs text-mission-control-text-dim italic leading-snug">{item.angle}</p>
        )}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {item.channels.map(ch => <ChannelPill key={ch} channel={ch} />)}
        </div>
      </div>

      {/* Meta */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 min-w-[100px]">
        <span className={`px-2 py-0.5 rounded text-[10px] ${statusClass}`}>{item.status}</span>
        <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
          {item.ownerType === 'ai' ? <Bot size={10} className="text-mission-control-accent" /> : <User size={10} />}
          <span className="truncate max-w-[72px]">{item.ownerId || 'unassigned'}</span>
        </div>
        {item.approverId && (
          <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
            <Check size={10} />
            <span className="truncate max-w-[72px]">{item.approverId}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton size="1" variant="ghost" color="gray" onClick={() => setEditing(true)}>
          <Edit3 size={12} />
        </IconButton>
        <IconButton size="1" variant="ghost" color="red" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Spinner size={12} /> : <Trash2 size={12} />}
        </IconButton>
      </div>
    </div>
  );
}

// ── Phase Section ──────────────────────────────────────────────────────────────

interface PhaseSectionProps {
  phase: Phase | null;
  items: ContentItem[];
  campaignId: string;
  onItemCreated: (item: ContentItem) => void;
  onItemUpdated: (item: ContentItem) => void;
  onItemDeleted: (id: string) => void;
  onPhaseDeleted?: (id: string) => void;
}

function PhaseSection({ phase, items, campaignId, onItemCreated, onItemUpdated, onItemDeleted, onPhaseDeleted }: PhaseSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  const color = phase?.color ?? 'var(--mission-control-accent)';
  const label = phase?.name ?? 'Unphased';

  return (
    <div className="border border-mission-control-border rounded-lg overflow-hidden">
      {/* Phase header */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-mission-control-surface cursor-pointer select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-mission-control-text flex-1">{label}</span>
        {phase?.startDate && phase?.endDate && (
          <span className="text-[10px] text-mission-control-text-dim tabular-nums mr-2">
            {new Date(phase.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(phase.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
        <span className="text-[10px] text-mission-control-text-dim mr-2">{items.length} items</span>
        {phase && onPhaseDeleted && (
          <IconButton
            size="1" variant="ghost" color="red"
            onClick={e => { e.stopPropagation(); onPhaseDeleted(phase.id); }}
          >
            <Trash2 size={11} />
          </IconButton>
        )}
        {collapsed ? <ChevronRight size={13} className="text-mission-control-text-dim" /> : <ChevronDown size={13} className="text-mission-control-text-dim" />}
      </div>

      {!collapsed && (
        <div className="px-3 py-2 bg-mission-control-bg space-y-0">
          {items.map(item => (
            <ContentRow
              key={item.id}
              item={item}
              campaignId={campaignId}
              onUpdated={onItemUpdated}
              onDeleted={onItemDeleted}
            />
          ))}
          {items.length === 0 && !addingItem && (
            <p className="text-xs text-mission-control-text-dim py-3 text-center">No content items yet</p>
          )}
          {addingItem ? (
            <div className="pt-2">
              <ItemForm
                campaignId={campaignId}
                phaseId={phase?.id ?? null}
                onSave={item => { onItemCreated(item); setAddingItem(false); }}
                onCancel={() => setAddingItem(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingItem(true)}
              className="w-full text-left text-[10px] text-mission-control-text-dim hover:text-mission-control-accent flex items-center gap-1 py-2 transition-colors"
            >
              <Plus size={11} /> Add content item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Phase Form ─────────────────────────────────────────────────────────────

interface AddPhaseFormProps {
  campaignId: string;
  onCreated: (phase: Phase) => void;
  onCancel: () => void;
}

function AddPhaseForm({ campaignId, onCreated, onCancel }: AddPhaseFormProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await campaignsApi.createPhase(campaignId, {
        name: name.trim(),
        startDate: startDate ? new Date(startDate).getTime() : null,
        endDate: endDate ? new Date(endDate).getTime() : null,
        color,
      });
      onCreated((res as { phase: Phase }).phase);
    } catch {
      showToast('Failed to create phase', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-mission-control-border rounded-lg p-3 space-y-2.5 bg-mission-control-surface">
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
        />
        <TextField.Root
          size="1"
          placeholder="Phase name (e.g. Pre-launch, Launch Week)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-xs text-mission-control-text" />
        </div>
        <div>
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">End date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-xs text-mission-control-text" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="1" color="gray" onClick={onCancel}>Cancel</Button>
        <Button variant="solid" size="1" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? <Spinner size={12} /> : <Check size={13} />} Create phase
        </Button>
      </div>
    </div>
  );
}

// ── ContentTab (main) ──────────────────────────────────────────────────────────

export default function ContentTab({ campaign }: { campaign: Campaign }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPhase, setAddingPhase] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, iRes] = await Promise.all([
        campaignsApi.listPhases(campaign.id),
        campaignsApi.listContentItems(campaign.id),
      ]);
      setPhases((pRes as { phases: Phase[] }).phases ?? []);
      setItems((iRes as { items: ContentItem[] }).items ?? []);
    } catch {
      showToast('Failed to load content', 'error');
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => { load(); }, [load]);

  async function handleDeletePhase(phaseId: string) {
    try {
      await campaignsApi.deletePhase(campaign.id, phaseId);
      setPhases(prev => prev.filter(p => p.id !== phaseId));
      setItems(prev => prev.map(i => i.phaseId === phaseId ? { ...i, phaseId: null } : i));
    } catch {
      showToast('Failed to delete phase', 'error');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size={24} /></div>;
  }

  // Group items by phaseId
  const byPhase: Record<string, ContentItem[]> = {};
  const unphased: ContentItem[] = [];
  for (const item of items) {
    if (item.phaseId && phases.some(p => p.id === item.phaseId)) {
      if (!byPhase[item.phaseId]) byPhase[item.phaseId] = [];
      byPhase[item.phaseId].push(item);
    } else {
      unphased.push(item);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-mission-control-text">Content Calendar</h3>
          <p className="text-xs text-mission-control-text-dim mt-0.5">{items.length} items across {phases.length} phases</p>
        </div>
        <Button
          variant="soft" size="1"
          onClick={() => setAddingPhase(true)}
          disabled={addingPhase}
        >
          <Plus size={13} /> Add phase
        </Button>
      </div>

      {addingPhase && (
        <AddPhaseForm
          campaignId={campaign.id}
          onCreated={phase => { setPhases(prev => [...prev, phase]); setAddingPhase(false); }}
          onCancel={() => setAddingPhase(false)}
        />
      )}

      {/* Phase sections */}
      {phases.map(phase => (
        <PhaseSection
          key={phase.id}
          phase={phase}
          items={byPhase[phase.id] ?? []}
          campaignId={campaign.id}
          onItemCreated={item => setItems(prev => [...prev, item])}
          onItemUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
          onItemDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
          onPhaseDeleted={handleDeletePhase}
        />
      ))}

      {/* Unphased section */}
      <PhaseSection
        phase={null}
        items={unphased}
        campaignId={campaign.id}
        onItemCreated={item => setItems(prev => [...prev, item])}
        onItemUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
        onItemDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
      />

      {phases.length === 0 && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Calendar size={28} className="text-mission-control-text-dim" />
          <p className="text-sm text-mission-control-text-dim">No content planned yet.</p>
          <p className="text-xs text-mission-control-text-dim">Add phases to structure your campaign, then add content items to each phase.</p>
        </div>
      )}
    </div>
  );
}
