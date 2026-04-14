'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit3, Check, X, Bot, User,
  ChevronDown, ChevronRight, Calendar, Mail,
  DollarSign, Zap, MessageSquare, Flag, Send, ListTodo,
} from 'lucide-react';
import { Button, IconButton, TextField, TextArea } from '@radix-ui/themes';
import { campaignsApi } from '../../lib/api';
import { CHANNEL_ICONS, CHANNEL_LABELS, ALL_CHANNELS } from './channelIcons';
import { showToast } from '../Toast';
import { Spinner } from '../LoadingStates';
import type { Campaign } from '../../types/campaigns';

// ── Types ──────────────────────────────────────────────────────────────────────

type ContentType = 'social' | 'email' | 'paid' | 'trigger';

interface Phase {
  id: string;
  campaignId: string;
  name: string;
  startDate: number | null;
  endDate: number | null;
  color: string;
  channels: string[];
  owner: string | null;
  milestones: string[];
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
  notes: string;
  weekTheme: string;
  segment: string;
  audience: string;
  cadence: string;
  contentType: ContentType;
  ownerType: 'human' | 'ai';
  ownerId: string;
  approverId: string;
  status: string;
  sortOrder: number;
  taskId: string | null;
}

const STATUS_OPTIONS = ['draft', 'scheduled', 'active', 'ongoing', 'in-review', 'done', 'tbd'] as const;
type ContentStatus = typeof STATUS_OPTIONS[number];

const STATUS_COLORS: Record<ContentStatus, string> = {
  draft:       'bg-mission-control-border text-mission-control-text-dim',
  scheduled:   'bg-blue-500/15 text-blue-400',
  active:      'bg-success/15 text-success',
  ongoing:     'bg-warning/15 text-warning',
  'in-review': 'bg-orange-500/15 text-orange-400',
  done:        'bg-success/20 text-success font-semibold',
  tbd:         'bg-mission-control-border/50 text-mission-control-text-dim italic',
};

// ── Content view tabs ──────────────────────────────────────────────────────────

const CONTENT_VIEWS: { id: ContentType; label: string; icon: typeof Calendar }[] = [
  { id: 'social',   label: 'Social / Content', icon: MessageSquare },
  { id: 'email',    label: 'Email / CLM',       icon: Mail },
  { id: 'paid',     label: 'Paid Media',         icon: DollarSign },
  { id: 'trigger',  label: 'Triggers',           icon: Zap },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function ChannelPill({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICONS[channel];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/20">
      {Icon && <Icon size={10} />}
      {CHANNEL_LABELS[channel] ?? channel}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status as ContentStatus] ?? STATUS_COLORS.draft;
  return <span className={`px-2 py-0.5 rounded text-[10px] ${cls}`}>{status}</span>;
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Item Form (adapts per content type) ───────────────────────────────────────

interface ItemFormProps {
  campaignId: string;
  contentType: ContentType;
  phaseId: string | null;
  phases: Phase[];
  initial?: Partial<ContentItem>;
  onSave: (item: ContentItem) => void;
  onCancel: () => void;
}

function ItemForm({ campaignId, contentType, phaseId, phases, initial, onSave, onCancel }: ItemFormProps) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [angle, setAngle] = useState(initial?.angle ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [weekTheme, setWeekTheme] = useState(initial?.weekTheme ?? '');
  const [segment, setSegment] = useState(initial?.segment ?? '');
  const [audience, setAudience] = useState(initial?.audience ?? '');
  const [cadence, setCadence] = useState(initial?.cadence ?? '');
  const [channels, setChannels] = useState<string[]>(initial?.channels ?? []);
  const [scheduledDate, setScheduledDate] = useState(
    initial?.scheduledDate ? new Date(initial.scheduledDate).toISOString().slice(0, 10) : ''
  );
  const [ownerType, setOwnerType] = useState<'human' | 'ai'>(initial?.ownerType ?? 'human');
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? '');
  const [status, setStatus] = useState<ContentStatus>((initial?.status as ContentStatus) ?? 'draft');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(initial?.phaseId ?? phaseId);
  const [saving, setSaving] = useState(false);

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  async function handleSave() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      const payload = {
        contentType,
        phaseId: selectedPhaseId,
        description: description.trim(),
        angle: angle.trim(),
        notes: notes.trim(),
        weekTheme: weekTheme.trim(),
        segment: segment.trim(),
        audience: audience.trim(),
        cadence: cadence.trim(),
        channels,
        scheduledDate: scheduledDate ? new Date(scheduledDate).getTime() : null,
        ownerType,
        ownerId: ownerId.trim(),
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

  // Field labels change per type
  const descLabel = contentType === 'social' ? 'Content / Caption' :
    contentType === 'email' ? 'Email / Trigger Name' :
    contentType === 'paid' ? 'Headline' : 'Trigger Description';
  const notesLabel = contentType === 'email' ? 'Subject Line' :
    contentType === 'paid' ? 'Ad Copy / Notes' : 'Notes';
  const dateLabel = contentType === 'email' ? 'Send Date' :
    contentType === 'paid' ? 'Start Date' : 'Date';

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 space-y-2.5">
      <TextArea
        placeholder={descLabel}
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        size="1"
      />

      {/* Type-specific fields */}
      {contentType === 'social' && (
        <TextField.Root size="1" placeholder="Week Theme (e.g. Week 1 — Pre-Launch Hype)"
          value={weekTheme} onChange={e => setWeekTheme(e.target.value)} />
      )}
      {(contentType === 'email' || contentType === 'trigger') && (
        <TextField.Root size="1" placeholder="Segment (e.g. All registered users / DeFi-ready Bitso users)"
          value={segment} onChange={e => setSegment(e.target.value)} />
      )}
      {contentType === 'trigger' && (
        <TextField.Root size="1" placeholder="Cadence (e.g. Ongoing / Weekly)"
          value={cadence} onChange={e => setCadence(e.target.value)} />
      )}
      {contentType === 'paid' && (
        <TextField.Root size="1" placeholder="Target Audience (e.g. DeFi-ready Bitso users)"
          value={audience} onChange={e => setAudience(e.target.value)} />
      )}

      <TextField.Root size="1" placeholder={notesLabel}
        value={notes} onChange={e => setNotes(e.target.value)} />
      <TextField.Root size="1" placeholder="Strategic angle — why this piece, why now"
        value={angle} onChange={e => setAngle(e.target.value)} />

      {/* Channels */}
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
          <label className="text-[10px] text-mission-control-text-dim mb-1 block">{dateLabel}</label>
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
          <TextField.Root size="1" placeholder="Name / agent" value={ownerId} onChange={e => setOwnerId(e.target.value)} />
        </div>
        {contentType === 'social' && phases.length > 0 && (
          <div className="col-span-2">
            <label className="text-[10px] text-mission-control-text-dim mb-1 block">Phase</label>
            <select
              value={selectedPhaseId ?? ''}
              onChange={e => setSelectedPhaseId(e.target.value || null)}
              className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-xs text-mission-control-text"
            >
              <option value="">— Unphased —</option>
              {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
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

// ── Flat item row (email / paid / trigger) ─────────────────────────────────────

interface FlatRowProps {
  item: ContentItem;
  contentType: ContentType;
  campaignId: string;
  phases: Phase[];
  onUpdated: (item: ContentItem) => void;
  onDeleted: (id: string) => void;
}

function FlatRow({ item, contentType, campaignId, phases, onUpdated, onDeleted }: FlatRowProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  if (editing) {
    return (
      <ItemForm
        campaignId={campaignId}
        contentType={contentType}
        phaseId={null}
        phases={phases}
        initial={item}
        onSave={updated => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  async function handleDispatch() {
    setDispatching(true);
    try {
      const res = await campaignsApi.dispatchContentItem(campaignId, item.id) as { task?: { id: string }; item?: ContentItem };
      if (res.item) onUpdated(res.item);
      showToast('Dispatched to agent', 'success');
    } catch { showToast('Dispatch failed', 'error'); }
    finally { setDispatching(false); }
  }

  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-surface/40 rounded px-2 -mx-2 transition-colors">
      {/* Date */}
      <div className="flex-shrink-0 w-16 text-center pt-0.5">
        <span className="text-[10px] font-medium text-mission-control-text-dim bg-mission-control-border/50 rounded px-1.5 py-0.5 tabular-nums">
          {fmtDate(item.scheduledDate)}
        </span>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-mission-control-text leading-snug font-medium">{item.description}</p>

        {/* Type-specific meta */}
        {contentType === 'email' && item.segment && (
          <p className="text-xs text-mission-control-text-dim">
            <span className="text-mission-control-text-dim/60">Segment:</span> {item.segment}
          </p>
        )}
        {contentType === 'email' && item.notes && (
          <p className="text-xs text-mission-control-text-dim">
            <span className="text-mission-control-text-dim/60">Subject:</span> {item.notes}
          </p>
        )}
        {contentType === 'trigger' && item.cadence && (
          <p className="text-xs text-mission-control-text-dim">
            <span className="text-mission-control-text-dim/60">Cadence:</span> {item.cadence}
          </p>
        )}
        {contentType === 'trigger' && item.segment && (
          <p className="text-xs text-mission-control-text-dim">
            <span className="text-mission-control-text-dim/60">Segment:</span> {item.segment}
          </p>
        )}
        {contentType === 'paid' && item.audience && (
          <p className="text-xs text-mission-control-text-dim">
            <span className="text-mission-control-text-dim/60">Audience:</span> {item.audience}
          </p>
        )}
        {item.angle && (
          <p className="text-xs text-mission-control-text-dim italic">{item.angle}</p>
        )}
        {item.channels.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {item.channels.map(ch => <ChannelPill key={ch} channel={ch} />)}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 min-w-[90px]">
        <StatusBadge status={item.status} />
        <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
          {item.ownerType === 'ai' ? <Bot size={10} className="text-mission-control-accent" /> : <User size={10} />}
          <span className="truncate max-w-[72px]">{item.ownerId || 'unassigned'}</span>
        </div>
        {item.taskId && (
          <span className="flex items-center gap-0.5 text-[9px] text-mission-control-accent/70 bg-mission-control-accent/8 px-1.5 py-0.5 rounded">
            <ListTodo size={8} /> task
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.ownerType === 'ai' && (
          <IconButton size="1" variant="ghost" color="blue" onClick={handleDispatch} disabled={dispatching}
            title={item.taskId ? 'Re-dispatch to agent' : 'Dispatch to agent'}>
            {dispatching ? <Spinner size={12} /> : <Send size={12} />}
          </IconButton>
        )}
        <IconButton size="1" variant="ghost" color="gray" onClick={() => setEditing(true)}>
          <Edit3 size={12} />
        </IconButton>
        <IconButton size="1" variant="ghost" color="red"
          onClick={async () => {
            setDeleting(true);
            try {
              await campaignsApi.deleteContentItem(campaignId, item.id);
              onDeleted(item.id);
            } catch { showToast('Failed to delete', 'error'); setDeleting(false); }
          }}
          disabled={deleting}
        >
          {deleting ? <Spinner size={12} /> : <Trash2 size={12} />}
        </IconButton>
      </div>
    </div>
  );
}

// ── Social content row (inside phase sections) ─────────────────────────────────

interface SocialRowProps {
  item: ContentItem;
  campaignId: string;
  phases: Phase[];
  onUpdated: (item: ContentItem) => void;
  onDeleted: (id: string) => void;
}

function SocialRow({ item, campaignId, phases, onUpdated, onDeleted }: SocialRowProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  if (editing) {
    return (
      <ItemForm
        campaignId={campaignId}
        contentType="social"
        phaseId={item.phaseId}
        phases={phases}
        initial={item}
        onSave={updated => { onUpdated(updated); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  async function handleDispatch() {
    setDispatching(true);
    try {
      const res = await campaignsApi.dispatchContentItem(campaignId, item.id) as { task?: { id: string }; item?: ContentItem };
      if (res.item) onUpdated(res.item);
      showToast('Dispatched to agent', 'success');
    } catch { showToast('Dispatch failed', 'error'); }
    finally { setDispatching(false); }
  }

  return (
    <div className="group flex items-start gap-3 py-2.5 border-b border-mission-control-border/40 last:border-0 hover:bg-mission-control-surface/40 rounded px-2 -mx-2 transition-colors">
      {/* Date + week theme */}
      <div className="flex-shrink-0 w-28 pt-0.5 space-y-0.5">
        <span className="block text-[10px] font-medium text-mission-control-text-dim tabular-nums">
          {fmtDate(item.scheduledDate)}
        </span>
        {item.weekTheme && (
          <span className="block text-[9px] text-mission-control-accent/70 truncate max-w-[108px]">
            {item.weekTheme}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-mission-control-text leading-snug">{item.description}</p>
        {item.angle && <p className="text-xs text-mission-control-text-dim italic">{item.angle}</p>}
        {item.notes && <p className="text-xs text-mission-control-text-dim">{item.notes}</p>}
        {item.channels.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {item.channels.map(ch => <ChannelPill key={ch} channel={ch} />)}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 min-w-[90px]">
        <StatusBadge status={item.status} />
        <div className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
          {item.ownerType === 'ai' ? <Bot size={10} className="text-mission-control-accent" /> : <User size={10} />}
          <span className="truncate max-w-[72px]">{item.ownerId || 'unassigned'}</span>
        </div>
        {item.taskId && (
          <span className="flex items-center gap-0.5 text-[9px] text-mission-control-accent/70 bg-mission-control-accent/8 px-1.5 py-0.5 rounded">
            <ListTodo size={8} /> task
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.ownerType === 'ai' && (
          <IconButton size="1" variant="ghost" color="blue" onClick={handleDispatch} disabled={dispatching}
            title={item.taskId ? 'Re-dispatch to agent' : 'Dispatch to agent'}>
            {dispatching ? <Spinner size={12} /> : <Send size={12} />}
          </IconButton>
        )}
        <IconButton size="1" variant="ghost" color="gray" onClick={() => setEditing(true)}>
          <Edit3 size={12} />
        </IconButton>
        <IconButton size="1" variant="ghost" color="red"
          onClick={async () => {
            setDeleting(true);
            try {
              await campaignsApi.deleteContentItem(campaignId, item.id);
              onDeleted(item.id);
            } catch { showToast('Failed to delete', 'error'); setDeleting(false); }
          }}
          disabled={deleting}
        >
          {deleting ? <Spinner size={12} /> : <Trash2 size={12} />}
        </IconButton>
      </div>
    </div>
  );
}

// ── Phase Section (social view) ────────────────────────────────────────────────

interface PhaseSectionProps {
  phase: Phase | null;
  items: ContentItem[];
  campaignId: string;
  allPhases: Phase[];
  onItemCreated: (item: ContentItem) => void;
  onItemUpdated: (item: ContentItem) => void;
  onItemDeleted: (id: string) => void;
  onPhaseDeleted?: (id: string) => void;
  onPhaseUpdated?: (phase: Phase) => void;
}

function PhaseSection({
  phase, items, campaignId, allPhases,
  onItemCreated, onItemUpdated, onItemDeleted, onPhaseDeleted, onPhaseUpdated,
}: PhaseSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [editingMilestones, setEditingMilestones] = useState(false);
  const [milestoneText, setMilestoneText] = useState(phase?.milestones.join('\n') ?? '');
  const [savingMilestones, setSavingMilestones] = useState(false);

  const color = phase?.color ?? 'var(--mission-control-accent)';
  const label = phase?.name ?? 'Unphased';
  const milestones = phase?.milestones ?? [];

  async function saveMilestones() {
    if (!phase) return;
    setSavingMilestones(true);
    try {
      const next = milestoneText.split('\n').map(s => s.trim()).filter(Boolean);
      await campaignsApi.updatePhase(campaignId, phase.id, { milestones: next });
      if (onPhaseUpdated) onPhaseUpdated({ ...phase, milestones: next });
      setEditingMilestones(false);
    } catch { showToast('Failed to save milestones', 'error'); }
    finally { setSavingMilestones(false); }
  }

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
            {fmtDate(phase.startDate)} – {fmtDate(phase.endDate)}
          </span>
        )}
        <span className="text-[10px] text-mission-control-text-dim mr-2">{items.length} items</span>
        {milestones.length > 0 && (
          <span className="text-[10px] text-mission-control-accent mr-1">
            <Flag size={10} className="inline mr-0.5" />{milestones.length}
          </span>
        )}
        {phase && onPhaseDeleted && (
          <IconButton size="1" variant="ghost" color="red"
            onClick={e => { e.stopPropagation(); onPhaseDeleted(phase.id); }}
          >
            <Trash2 size={11} />
          </IconButton>
        )}
        {collapsed ? <ChevronRight size={13} className="text-mission-control-text-dim" /> : <ChevronDown size={13} className="text-mission-control-text-dim" />}
      </div>

      {!collapsed && (
        <div className="px-3 py-2 bg-mission-control-bg space-y-0">
          {/* Milestones section */}
          {phase && (
            <div className="mb-2 pb-2 border-b border-mission-control-border/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider flex items-center gap-1">
                  <Flag size={9} /> Milestones
                </span>
                <button
                  onClick={() => { setEditingMilestones(v => !v); setMilestoneText(milestones.join('\n')); }}
                  className="text-[10px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                >
                  {editingMilestones ? 'Cancel' : milestones.length > 0 ? 'Edit' : '+ Add'}
                </button>
              </div>
              {editingMilestones ? (
                <div className="space-y-1.5">
                  <textarea
                    value={milestoneText}
                    onChange={e => setMilestoneText(e.target.value)}
                    placeholder="One milestone per line&#10;e.g. Announce colosseum launch&#10;e.g. Reach 1K registered users"
                    rows={4}
                    className="w-full bg-mission-control-bg border border-mission-control-border rounded px-2 py-1.5 text-xs text-mission-control-text resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="1" color="gray" onClick={() => setEditingMilestones(false)}>Cancel</Button>
                    <Button variant="solid" size="1" onClick={saveMilestones} disabled={savingMilestones}>
                      {savingMilestones ? <Spinner size={11} /> : <Check size={11} />} Save
                    </Button>
                  </div>
                </div>
              ) : milestones.length > 0 ? (
                <ul className="space-y-0.5">
                  {milestones.map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-mission-control-text">
                      <span className="text-mission-control-accent mt-0.5">•</span>
                      {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-mission-control-text-dim/50 italic">No milestones set</p>
              )}
            </div>
          )}

          {/* Items */}
          {items.map(item => (
            <SocialRow
              key={item.id}
              item={item}
              campaignId={campaignId}
              phases={allPhases}
              onUpdated={onItemUpdated}
              onDeleted={onItemDeleted}
            />
          ))}
          {items.length === 0 && !addingItem && (
            <p className="text-xs text-mission-control-text-dim py-2 text-center">No social content yet</p>
          )}
          {addingItem ? (
            <div className="pt-2">
              <ItemForm
                campaignId={campaignId}
                contentType="social"
                phaseId={phase?.id ?? null}
                phases={allPhases}
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

function AddPhaseForm({ campaignId, onCreated, onCancel }: {
  campaignId: string;
  onCreated: (phase: Phase) => void;
  onCancel: () => void;
}) {
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
        <input type="color" value={color} onChange={e => setColor(e.target.value)}
          className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent" />
        <TextField.Root size="1" placeholder="Phase name (e.g. Pre-launch, Launch Week)"
          value={name} onChange={e => setName(e.target.value)} className="flex-1" />
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

// ── Flat view (email / paid / trigger) ────────────────────────────────────────

function FlatView({
  items, contentType, campaignId, phases,
  onItemCreated, onItemUpdated, onItemDeleted,
}: {
  items: ContentItem[];
  contentType: ContentType;
  campaignId: string;
  phases: Phase[];
  onItemCreated: (item: ContentItem) => void;
  onItemUpdated: (item: ContentItem) => void;
  onItemDeleted: (id: string) => void;
}) {
  const [addingItem, setAddingItem] = useState(false);

  const typedItems = items.filter(i => i.contentType === contentType);

  const emptyMessages: Record<ContentType, string> = {
    social: 'No social content yet',
    email: 'No email sequences yet. Add your first trigger or send.',
    paid: 'No paid media placements yet.',
    trigger: 'No behavioral triggers yet.',
  };

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-mission-control-text-dim">{typedItems.length} items</span>
        <Button variant="soft" size="1" onClick={() => setAddingItem(true)} disabled={addingItem}>
          <Plus size={13} /> Add item
        </Button>
      </div>

      {addingItem && (
        <ItemForm
          campaignId={campaignId}
          contentType={contentType}
          phaseId={null}
          phases={phases}
          onSave={item => { onItemCreated(item); setAddingItem(false); }}
          onCancel={() => setAddingItem(false)}
        />
      )}

      {typedItems.length === 0 && !addingItem && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-sm text-mission-control-text-dim">{emptyMessages[contentType]}</p>
        </div>
      )}

      <div>
        {typedItems.map(item => (
          <FlatRow
            key={item.id}
            item={item}
            contentType={contentType}
            campaignId={campaignId}
            phases={phases}
            onUpdated={onItemUpdated}
            onDeleted={onItemDeleted}
          />
        ))}
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
  const [activeView, setActiveView] = useState<ContentType>('social');

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

  const socialItems = items.filter(i => i.contentType === 'social' || !i.contentType);

  // Group social items by phase
  const byPhase: Record<string, ContentItem[]> = {};
  const unphased: ContentItem[] = [];
  for (const item of socialItems) {
    if (item.phaseId && phases.some(p => p.id === item.phaseId)) {
      if (!byPhase[item.phaseId]) byPhase[item.phaseId] = [];
      byPhase[item.phaseId].push(item);
    } else {
      unphased.push(item);
    }
  }

  const totalByType: Record<ContentType, number> = {
    social: socialItems.length,
    email: items.filter(i => i.contentType === 'email').length,
    paid: items.filter(i => i.contentType === 'paid').length,
    trigger: items.filter(i => i.contentType === 'trigger').length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-2 border-b border-mission-control-border">
        <div>
          <h3 className="text-sm font-semibold text-mission-control-text">Content Calendar</h3>
          <p className="text-xs text-mission-control-text-dim mt-0.5">
            {items.length} items · {phases.length} phases
          </p>
        </div>
        {activeView === 'social' && (
          <Button variant="soft" size="1" onClick={() => setAddingPhase(true)} disabled={addingPhase}>
            <Plus size={13} /> Add phase
          </Button>
        )}
      </div>

      {/* Content type tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-mission-control-border/50 overflow-x-auto">
        {CONTENT_VIEWS.map(view => {
          const Icon = view.icon;
          const count = totalByType[view.id];
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
              }`}
            >
              <Icon size={12} />
              {view.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  isActive ? 'bg-mission-control-accent/20 text-mission-control-accent' : 'bg-mission-control-border text-mission-control-text-dim'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeView === 'social' && (
          <div className="p-4 space-y-4">
            {addingPhase && (
              <AddPhaseForm
                campaignId={campaign.id}
                onCreated={phase => { setPhases(prev => [...prev, phase]); setAddingPhase(false); }}
                onCancel={() => setAddingPhase(false)}
              />
            )}

            {phases.map(phase => (
              <PhaseSection
                key={phase.id}
                phase={phase}
                items={byPhase[phase.id] ?? []}
                campaignId={campaign.id}
                allPhases={phases}
                onItemCreated={item => setItems(prev => [...prev, item])}
                onItemUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                onItemDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
                onPhaseDeleted={handleDeletePhase}
                onPhaseUpdated={updated => setPhases(prev => prev.map(p => p.id === updated.id ? updated : p))}
              />
            ))}

            <PhaseSection
              phase={null}
              items={unphased}
              campaignId={campaign.id}
              allPhases={phases}
              onItemCreated={item => setItems(prev => [...prev, item])}
              onItemUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
              onItemDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
            />

            {phases.length === 0 && socialItems.length === 0 && !addingPhase && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Calendar size={28} className="text-mission-control-text-dim" />
                <p className="text-sm text-mission-control-text-dim">No social content planned yet.</p>
                <p className="text-xs text-mission-control-text-dim">Add phases to structure your campaign, then add content items to each phase.</p>
              </div>
            )}
          </div>
        )}

        {activeView !== 'social' && (
          <FlatView
            items={items}
            contentType={activeView}
            campaignId={campaign.id}
            phases={phases}
            onItemCreated={item => setItems(prev => [...prev, item])}
            onItemUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
            onItemDeleted={id => setItems(prev => prev.filter(i => i.id !== id))}
          />
        )}
      </div>
    </div>
  );
}
