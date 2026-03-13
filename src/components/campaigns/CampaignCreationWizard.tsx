'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Loader2,
  DollarSign, Leaf, Share2, Mail, Users, FileText, Megaphone, Star, Search, Briefcase,
  Eye, Target, ShoppingCart, Heart, TrendingUp, MessageCircle, Rocket,
} from 'lucide-react';
import { campaignsApi, agentApi } from '../../lib/api';
import type { Campaign } from '../../types/campaigns';
import AgentAvatar from '../AgentAvatar';
import { CHANNEL_ICONS, CHANNEL_LABELS, ALL_CHANNELS } from './channelIcons';

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#f43f5e',
];

const TYPE_OPTIONS = [
  { value: 'paid',       label: 'Paid',       icon: DollarSign,  desc: 'Google Ads, Meta Ads, sponsored' },
  { value: 'organic',    label: 'Organic',     icon: Leaf,        desc: 'Non-paid growth and reach' },
  { value: 'social',     label: 'Social',      icon: Share2,      desc: 'Social media campaigns' },
  { value: 'email',      label: 'Email / CLM', icon: Mail,        desc: 'Email, CRM, lifecycle' },
  { value: 'clm',        label: 'CLM',         icon: Users,       desc: 'Customer lifecycle marketing' },
  { value: 'content',    label: 'Content',     icon: FileText,    desc: 'Blog, video, content marketing' },
  { value: 'pr',         label: 'PR',          icon: Megaphone,   desc: 'Press releases, media outreach' },
  { value: 'influencer', label: 'Influencer',  icon: Star,        desc: 'Influencer & creator partnerships' },
  { value: 'seo',        label: 'SEO',         icon: Search,      desc: 'Search engine optimization' },
  { value: 'general',    label: 'General',     icon: Briefcase,   desc: 'Multi-channel or uncategorized' },
];

const GOAL_OPTIONS = [
  { value: 'awareness',  label: 'Brand Awareness',   icon: Eye,            desc: 'Reach new audiences, boost visibility' },
  { value: 'lead_gen',   label: 'Lead Generation',   icon: Target,         desc: 'Capture qualified leads' },
  { value: 'conversion', label: 'Conversion',        icon: ShoppingCart,   desc: 'Drive purchases or sign-ups' },
  { value: 'retention',  label: 'Retention',         icon: Heart,          desc: 'Keep and re-engage existing users' },
  { value: 'revenue',    label: 'Revenue',           icon: TrendingUp,     desc: 'Directly drive revenue growth' },
  { value: 'engagement', label: 'Engagement',        icon: MessageCircle,  desc: 'Increase interaction and community' },
  { value: 'launch',     label: 'Product Launch',    icon: Rocket,         desc: 'Coordinate a product or feature launch' },
];

interface Agent { id: string; name: string; emoji?: string; status: string; role?: string }

interface Props {
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}

type Step = 'basics' | 'channels' | 'details' | 'team' | 'launch';
const STEPS: { id: Step; label: string }[] = [
  { id: 'basics',   label: 'Basics' },
  { id: 'channels', label: 'Channels' },
  { id: 'details',  label: 'Details' },
  { id: 'team',     label: 'Team' },
  { id: 'launch',   label: 'Launch' },
];

export default function CampaignCreationWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('basics');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [goal, setGoal] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [brief, setBrief] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (step === 'team' && agents.length === 0) {
      setLoadingAgents(true);
      agentApi.getAll()
        .then((data: any[]) => setAgents((data as Agent[]).filter(a => a.status !== 'archived')))
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, [step]);

  const stepIdx = STEPS.findIndex(s => s.id === step);

  const canAdvance = () => {
    if (step === 'basics') return name.trim().length >= 2 && type !== '' && goal !== '';
    if (step === 'channels') return channels.length > 0;
    return true;
  };

  const advance = () => {
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
  };

  const back = () => {
    if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id);
  };

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await campaignsApi.create({
        name: name.trim(),
        type,
        goal,
        channels,
        briefContent: brief.trim() || undefined,
        targetAudience: targetAudience.trim() || undefined,
        startDate: startDate ? new Date(startDate).getTime() : undefined,
        endDate: endDate ? new Date(endDate).getTime() : undefined,
        budget: budget ? parseFloat(budget) : undefined,
        color,
        memberAgentIds: selectedAgents,
      }) as { success: boolean; id: string; campaign: Campaign };
      onCreated(result.campaign ?? { id: result.id, name, type, goal, status: 'draft', channels, budgetSpent: 0, currency: 'USD', kpis: {}, color, createdAt: Date.now(), updatedAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
      setCreating(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find(t => t.value === type);
  const selectedGoal = GOAL_OPTIONS.find(g => g.value === goal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center">
              <Megaphone size={16} className="text-mission-control-accent" />
            </div>
            <span className="font-semibold text-mission-control-text">New Campaign</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-mission-control-border">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                s.id === step ? 'text-mission-control-accent' :
                i < stepIdx ? 'text-mission-control-text-dim' :
                'text-mission-control-text-dim/40'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border transition-colors ${
                  s.id === step ? 'bg-mission-control-accent text-white border-mission-control-accent' :
                  i < stepIdx ? 'bg-mission-control-surface border-mission-control-border text-mission-control-text-dim' :
                  'border-mission-control-border/40 text-mission-control-text-dim/40'
                }`}>
                  {i < stepIdx ? <Check size={10} /> : i + 1}
                </div>
                {s.label}
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-px bg-mission-control-border/50" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Step 1: Basics */}
          {step === 'basics' && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-mission-control-text mb-2 block">Campaign name *</label>
                <input
                  type="text"
                  placeholder="e.g., Q3 Product Launch, Summer Retention Drive..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-mission-control-text mb-3 block">Campaign type *</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TYPE_OPTIONS.map(t => {
                    const Icon = t.icon;
                    const sel = type === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all ${
                          sel
                            ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                            : 'border-mission-control-border hover:border-mission-control-accent/30 text-mission-control-text-dim hover:text-mission-control-text-primary'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="text-xs font-medium">{t.label}</span>
                        <span className="text-xs opacity-60 leading-tight">{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-mission-control-text mb-3 block">Campaign goal *</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {GOAL_OPTIONS.map(g => {
                    const Icon = g.icon;
                    const sel = goal === g.value;
                    return (
                      <button
                        key={g.value}
                        onClick={() => setGoal(g.value)}
                        className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all ${
                          sel
                            ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                            : 'border-mission-control-border hover:border-mission-control-accent/30 text-mission-control-text-dim hover:text-mission-control-text-primary'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="text-xs font-medium">{g.label}</span>
                        <span className="text-xs opacity-60 leading-tight">{g.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-sm font-medium text-mission-control-text mb-2 block">Campaign color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-mission-control-bg ring-white scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Channels */}
          {step === 'channels' && (
            <div className="space-y-4">
              <p className="text-sm text-mission-control-text-dim">Select the channels this campaign will run on. You can always adjust this later.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_CHANNELS.map(ch => {
                  const Icon = CHANNEL_ICONS[ch];
                  const sel = channels.includes(ch);
                  return (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        sel
                          ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                          : 'border-mission-control-border hover:border-mission-control-accent/30 text-mission-control-text-dim hover:text-mission-control-text-primary'
                      }`}
                    >
                      {Icon && <Icon size={16} />}
                      <span className="text-sm font-medium">{CHANNEL_LABELS[ch]}</span>
                      {sel && <Check size={12} className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
              {channels.length === 0 && (
                <p className="text-xs text-warning flex items-center gap-1">Select at least one channel to continue.</p>
              )}
            </div>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-mission-control-text mb-2 block">Campaign brief</label>
                <textarea
                  placeholder="Describe the campaign strategy, key messages, creative direction, expected outcomes..."
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 resize-none text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-mission-control-text mb-2 block">Target audience</label>
                <input
                  type="text"
                  placeholder="e.g., 25-35 year olds in LATAM interested in crypto..."
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  className="w-full px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-mission-control-text mb-2 block">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-mission-control-text mb-2 block">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary focus:outline-none focus:border-mission-control-accent/50 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-mission-control-text mb-2 block">Budget (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim text-sm">$</span>
                  <input
                    type="number"
                    placeholder="50000"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    min="0"
                    className="w-full pl-7 pr-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Team */}
          {step === 'team' && (
            <div className="space-y-4">
              <p className="text-sm text-mission-control-text-dim">Assign agents to this campaign. They'll be added to the campaign chat and can receive dispatched tasks.</p>
              {loadingAgents ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-mission-control-text-dim" /></div>
              ) : (
                <div className="space-y-1.5">
                  {agents.map(agent => {
                    const sel = selectedAgents.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        onClick={() => toggleAgent(agent.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left ${
                          sel ? 'border-mission-control-accent/50 bg-mission-control-accent/10' : 'border-mission-control-border hover:border-mission-control-accent/30'
                        }`}
                      >
                        <AgentAvatar agentId={agent.id} size="sm" fallbackEmoji={agent.emoji} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-mission-control-text">{agent.name}</div>
                          {agent.role && <div className="text-xs text-mission-control-text-dim truncate">{agent.role}</div>}
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-mission-control-accent bg-mission-control-accent' : 'border-mission-control-border'}`}>
                          {sel && <Check size={9} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                  {agents.length === 0 && (
                    <p className="text-sm text-mission-control-text-dim text-center py-6">No agents available. Create agents first.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Launch */}
          {step === 'launch' && (
            <div className="space-y-5">
              <p className="text-sm text-mission-control-text-dim">Review your campaign before creating it.</p>

              {error && (
                <div className="px-3 py-2.5 bg-error-subtle border border-error/30 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-3">
                {/* Campaign identity */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <div>
                    <div className="font-semibold text-mission-control-text">{name}</div>
                    {selectedType && selectedGoal && (
                      <div className="text-xs text-mission-control-text-dim">
                        {selectedType.label} · {selectedGoal.label}
                      </div>
                    )}
                  </div>
                </div>

                {/* Channels */}
                <div>
                  <p className="text-xs text-mission-control-text-dim mb-1.5">Channels</p>
                  <div className="flex flex-wrap gap-1.5">
                    {channels.map(ch => {
                      const Icon = CHANNEL_ICONS[ch];
                      return (
                        <span key={ch} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-mission-control-surface border border-mission-control-border rounded-full text-mission-control-text-dim">
                          {Icon && <Icon size={10} />}
                          {CHANNEL_LABELS[ch]}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {targetAudience && (
                    <div>
                      <span className="text-mission-control-text-dim">Audience: </span>
                      <span className="text-mission-control-text-primary">{targetAudience}</span>
                    </div>
                  )}
                  {budget && (
                    <div>
                      <span className="text-mission-control-text-dim">Budget: </span>
                      <span className="text-mission-control-text-primary">${parseFloat(budget).toLocaleString()}</span>
                    </div>
                  )}
                  {startDate && (
                    <div>
                      <span className="text-mission-control-text-dim">Start: </span>
                      <span className="text-mission-control-text-primary">{startDate}</span>
                    </div>
                  )}
                  {endDate && (
                    <div>
                      <span className="text-mission-control-text-dim">End: </span>
                      <span className="text-mission-control-text-primary">{endDate}</span>
                    </div>
                  )}
                </div>

                {/* Team */}
                {selectedAgents.length > 0 && (
                  <div>
                    <p className="text-xs text-mission-control-text-dim mb-1.5">Team ({selectedAgents.length})</p>
                    <p className="text-xs text-mission-control-text-primary">
                      {agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-mission-control-border">
          <button
            onClick={stepIdx === 0 ? onClose : back}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 border border-mission-control-border text-mission-control-text-dim rounded-lg hover:text-mission-control-text-primary hover:bg-mission-control-surface transition-colors text-sm disabled:opacity-40"
          >
            {stepIdx === 0 ? (
              <><X size={14} /> Cancel</>
            ) : (
              <><ChevronLeft size={14} /> Back</>
            )}
          </button>

          {step !== 'launch' ? (
            <button
              onClick={advance}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 px-5 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? (
                <><Loader2 size={14} className="animate-spin" /> Creating...</>
              ) : (
                <><Check size={14} /> Create Campaign</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
