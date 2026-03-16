'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Check, Loader2, Bot,
  DollarSign, Leaf, Share2, Mail, Users, FileText, Megaphone, Star, Search, Briefcase,
  Eye, Target, ShoppingCart, Heart, TrendingUp, MessageCircle, Rocket,
  SkipForward, Wand2,
} from 'lucide-react';
import { campaignsApi, agentApi } from '../../lib/api';
import type { Campaign } from '../../types/campaigns';
import AgentAvatar from '../AgentAvatar';
import { CHANNEL_ICONS, CHANNEL_LABELS, ALL_CHANNELS } from './channelIcons';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  { value: 'awareness',  label: 'Brand Awareness',  icon: Eye,           desc: 'Reach new audiences, boost visibility' },
  { value: 'lead_gen',   label: 'Lead Generation',  icon: Target,        desc: 'Capture qualified leads' },
  { value: 'conversion', label: 'Conversion',       icon: ShoppingCart,  desc: 'Drive purchases or sign-ups' },
  { value: 'retention',  label: 'Retention',        icon: Heart,         desc: 'Keep and re-engage existing users' },
  { value: 'revenue',    label: 'Revenue',          icon: TrendingUp,    desc: 'Directly drive revenue growth' },
  { value: 'engagement', label: 'Engagement',       icon: MessageCircle, desc: 'Increase interaction and community' },
  { value: 'launch',     label: 'Product Launch',   icon: Rocket,        desc: 'Coordinate a product or feature launch' },
];

// ── Types ──────────────────────────────────────────────────────────────────────

type ConvStep =
  | 'name'
  | 'types'
  | 'goal'
  | 'channels'
  | 'audience'
  | 'budget'
  | 'dates'
  | 'brief'
  | 'team'
  | 'review';

interface AgentInfo { id: string; name: string; emoji?: string; status: string; role?: string }

interface Message {
  id: string;
  role: 'agent' | 'user';
  content: string;
  blockStep?: ConvStep;
  timestamp: number;
}

interface Props {
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

function agentMsg(content: string, blockStep?: ConvStep): Message {
  return { id: uid(), role: 'agent', content, blockStep, timestamp: Date.now() };
}

function userMsg(content: string): Message {
  return { id: uid(), role: 'user', content, timestamp: Date.now() };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CampaignCreationWizard({ onClose, onCreated }: Props) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [goal, setGoal] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [brief, setBrief] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<ConvStep>('name');
  const [messages, setMessages] = useState<Message[]>([]);
  const [freeInput, setFreeInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftingBrief, setDraftingBrief] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, agentTyping]);

  // ── Send agent message with typing delay ────────────────────────────────────
  const sendAgentMessage = useCallback((content: string, blockStep?: ConvStep, delay = 400) => {
    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      setMessages(prev => [...prev, agentMsg(content, blockStep)]);
    }, delay);
  }, []);

  // ── Initialise conversation (guarded against React StrictMode double-mount) ──
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    sendAgentMessage("Let's set up your campaign. What's it called?", 'name', 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Advance to next step after user input ───────────────────────────────────
  const advanceTo = useCallback((nextStep: ConvStep, delayMs = 400) => {
    setStep(nextStep);

    const messages: Record<ConvStep, { text: string; block?: ConvStep }> = {
      name: { text: "Let's set up your campaign. What's it called?", block: 'name' },
      types: { text: '', block: 'types' },
      goal: { text: "What's the main goal?", block: 'goal' },
      channels: { text: 'Which channels will you use?', block: 'channels' },
      audience: { text: 'Who\'s the target audience? (optional — skip to continue)', block: 'audience' },
      budget: { text: 'What\'s the budget in USD? (optional)', block: 'budget' },
      dates: { text: 'Any campaign dates? (optional)', block: 'dates' },
      brief: { text: 'Want to add a brief or description? I can help draft one.', block: 'brief' },
      team: { text: 'Who should work on this?', block: 'team' },
      review: { text: "All set! Here's your campaign summary:", block: 'review' },
    };

    const cfg = messages[nextStep];
    if (cfg.text) {
      sendAgentMessage(cfg.text, cfg.block, delayMs);
    }

    // Load agents when reaching team step
    if (nextStep === 'team' && agents.length === 0) {
      setLoadingAgents(true);
      agentApi.getAll()
        .then((data: unknown[]) => setAgents((data as AgentInfo[]).filter(a => a.status !== 'archived')))
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, [sendAgentMessage, agents.length]);

  // ── Handle user submitting their name ───────────────────────────────────────
  const handleNameSubmit = useCallback(() => {
    const trimmed = freeInput.trim();
    if (trimmed.length < 2) return;
    setName(trimmed);
    setMessages(prev => [...prev, userMsg(trimmed)]);
    setFreeInput('');
    // Agent responds with name + asks for types
    setAgentTyping(true);
    setTimeout(() => {
      setAgentTyping(false);
      setMessages(prev => [
        ...prev,
        agentMsg(`Got it — "${trimmed}". What kind of campaign is this? Pick one or more:`, 'types'),
      ]);
      setStep('types');
    }, 400);
  }, [freeInput]);

  // ── Handle free-text audience submit ────────────────────────────────────────
  const handleAudienceSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setTargetAudience(trimmed);
      setMessages(prev => [...prev, userMsg(trimmed)]);
    } else {
      setMessages(prev => [...prev, userMsg('Skipped')]);
    }
    setFreeInput('');
    advanceTo('budget');
  }, [advanceTo]);

  // ── Handle budget submit ─────────────────────────────────────────────────────
  const handleBudgetSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setBudget(trimmed);
      setMessages(prev => [...prev, userMsg(`$${parseFloat(trimmed).toLocaleString()}`)]);
    } else {
      setMessages(prev => [...prev, userMsg('Skipped')]);
    }
    setFreeInput('');
    advanceTo('dates');
  }, [advanceTo]);

  // ── Handle free-text brief submit ───────────────────────────────────────────
  const handleBriefTextSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setBrief(trimmed);
      setMessages(prev => [...prev, userMsg(trimmed.slice(0, 80) + (trimmed.length > 80 ? '…' : ''))]);
    } else {
      setMessages(prev => [...prev, userMsg('Skipped')]);
    }
    setFreeInput('');
    advanceTo('team');
  }, [advanceTo]);

  // ── Draft brief via API ──────────────────────────────────────────────────────
  const handleDraftBrief = useCallback(async () => {
    setDraftingBrief(true);
    try {
      const res = await fetch('/api/campaigns/brief-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, types, goal, channels, targetAudience }),
      });
      const data = await res.json();
      if (data.brief) {
        setBrief(data.brief);
        setMessages(prev => [...prev, userMsg('Draft generated')]);
      }
    } catch {
      // non-critical — leave brief empty
    } finally {
      setDraftingBrief(false);
    }
  }, [name, types, goal, channels, targetAudience]);

  // ── Create campaign ──────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreationError(null);
    try {
      const result = await campaignsApi.create({
        name: name.trim(),
        types,
        type: types[0] ?? 'general',
        goal,
        channels,
        briefContent: brief.trim() || undefined,
        targetAudience: targetAudience.trim() || undefined,
        startDate: startDate ? new Date(startDate).getTime() : undefined,
        endDate: endDate ? new Date(endDate).getTime() : undefined,
        budget: budget ? parseFloat(budget) : undefined,
        color: '#6366f1',
        memberAgentIds: selectedAgents,
      }) as { success: boolean; id: string; campaign: Campaign };
      onCreated(result.campaign ?? {
        id: result.id, name, type: types[0] ?? 'general', types, goal,
        status: 'draft', channels, budgetSpent: 0, currency: 'USD',
        kpis: {}, color: '#6366f1', createdAt: Date.now(), updatedAt: Date.now(),
      });
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Failed to create campaign');
      setCreating(false);
    }
  }, [name, types, goal, channels, brief, targetAudience, startDate, endDate, budget, selectedAgents, onCreated]);

  // ── Toggle helpers ───────────────────────────────────────────────────────────
  const toggleType = (v: string) => setTypes(prev => prev.includes(v) ? prev.filter(t => t !== v) : [...prev, v]);
  const toggleChannel = (v: string) => setChannels(prev => prev.includes(v) ? prev.filter(c => c !== v) : [...prev, v]);
  const toggleAgent = (v: string) => setSelectedAgents(prev => prev.includes(v) ? prev.filter(a => a !== v) : [...prev, v]);

  // ── Current-step input placeholder ──────────────────────────────────────────
  const showTextInput = step === 'name' || step === 'audience' || step === 'budget';
  const inputPlaceholder =
    step === 'name' ? 'e.g., Q3 Product Launch, Summer Retention Drive…' :
    step === 'audience' ? 'e.g., 25-35 in LATAM interested in crypto…' :
    step === 'budget' ? 'e.g., 50000' : '';

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleInputSend();
  };

  const handleInputSend = () => {
    if (step === 'name') handleNameSubmit();
    else if (step === 'audience') handleAudienceSubmit(freeInput);
    else if (step === 'budget') handleBudgetSubmit(freeInput);
  };

  // ── Render inline block for a given step ────────────────────────────────────
  function renderBlock(blockStep: ConvStep) {
    switch (blockStep) {
      case 'types': return (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map(t => {
              const Icon = t.icon;
              const sel = types.includes(t.value);
              return (
                <button
                  key={t.value}
                  onClick={() => toggleType(t.value)}
                  className={`flex flex-col gap-1.5 p-3 rounded-lg border text-left transition-all ${
                    sel
                      ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                      : 'border-mission-control-border hover:border-mission-control-accent/30 text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  <Icon size={15} />
                  <span className="text-xs font-medium">{t.label}</span>
                  <span className="text-xs opacity-60 leading-tight">{t.desc}</span>
                </button>
              );
            })}
          </div>
          {step === 'types' && types.length > 0 && (
            <button
              onClick={() => {
                const labels = types.map(v => TYPE_OPTIONS.find(o => o.value === v)?.label ?? v).join(', ');
                setMessages(prev => [...prev, userMsg(labels)]);
                advanceTo('goal');
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors"
            >
              <Check size={14} /> Confirm selection
            </button>
          )}
        </div>
      );

      case 'goal': return (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {GOAL_OPTIONS.map(g => {
            const Icon = g.icon;
            const sel = goal === g.value;
            return (
              <button
                key={g.value}
                onClick={() => {
                  if (step !== 'goal') return;
                  setGoal(g.value);
                  setMessages(prev => [...prev, userMsg(g.label)]);
                  advanceTo('channels');
                }}
                className={`flex flex-col gap-1.5 p-3 rounded-lg border text-left transition-all ${
                  sel
                    ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                    : 'border-mission-control-border hover:border-mission-control-accent/30 text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <Icon size={15} />
                <span className="text-xs font-medium">{g.label}</span>
                <span className="text-xs opacity-60 leading-tight">{g.desc}</span>
              </button>
            );
          })}
        </div>
      );

      case 'channels': return (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_CHANNELS.map(ch => {
              const Icon = CHANNEL_ICONS[ch];
              const sel = channels.includes(ch);
              return (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${
                    sel
                      ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                      : 'border-mission-control-border hover:border-mission-control-accent/30 text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {Icon && <Icon size={15} />}
                  <span className="text-sm font-medium">{CHANNEL_LABELS[ch]}</span>
                  {sel && <Check size={11} className="ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          {step === 'channels' && channels.length > 0 && (
            <button
              onClick={() => {
                const labels = channels.map(c => CHANNEL_LABELS[c] ?? c).join(', ');
                setMessages(prev => [...prev, userMsg(labels)]);
                advanceTo('audience');
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors"
            >
              <Check size={14} /> Confirm channels
            </button>
          )}
        </div>
      );

      case 'audience': return (
        step === 'audience' ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleAudienceSubmit('')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-sm hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <SkipForward size={13} /> Skip
            </button>
          </div>
        ) : null
      );

      case 'budget': return (
        step === 'budget' ? (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleBudgetSubmit('')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-sm hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <SkipForward size={13} /> Skip
            </button>
          </div>
        ) : null
      );

      case 'dates': return step === 'dates' ? (
        <div className="mt-3 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-mission-control-text-dim mb-1 block">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-mission-control-text-dim mb-1 block">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  const parts = [startDate, endDate].filter(Boolean).join(' → ');
                  setMessages(prev => [...prev, userMsg(parts)]);
                  advanceTo('brief');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors"
              >
                <Check size={14} /> Confirm dates
              </button>
            )}
            <button
              onClick={() => {
                setMessages(prev => [...prev, userMsg('Skipped')]);
                advanceTo('brief');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-sm hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <SkipForward size={13} /> Skip
            </button>
          </div>
        </div>
      ) : null;

      case 'brief': return step === 'brief' ? (
        <div className="mt-3 space-y-3">
          <textarea
            placeholder="Describe the campaign strategy, key messages, creative direction…"
            value={brief}
            onChange={e => setBrief(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDraftBrief}
              disabled={draftingBrief}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-mission-control-accent/40 text-mission-control-accent rounded-lg text-sm hover:bg-mission-control-accent/10 transition-colors disabled:opacity-50"
            >
              {draftingBrief ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Draft with AI
            </button>
            {brief.trim().length > 0 && (
              <button
                onClick={() => handleBriefTextSubmit(brief)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors"
              >
                <Check size={13} /> Use this brief
              </button>
            )}
            <button
              onClick={() => handleBriefTextSubmit('')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-mission-control-border text-mission-control-text-dim rounded-lg text-sm hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <SkipForward size={13} /> Skip
            </button>
          </div>
        </div>
      ) : null;

      case 'team': return step === 'team' ? (
        <div className="mt-3 space-y-3">
          {loadingAgents ? (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin text-mission-control-text-dim" />
            </div>
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
                <p className="text-sm text-mission-control-text-dim text-center py-4">No agents available. Create agents first.</p>
              )}
            </div>
          )}
          <button
            onClick={() => {
              const agentNames = agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name);
              const label = agentNames.length > 0 ? agentNames.join(', ') : 'No agents assigned';
              setMessages(prev => [...prev, userMsg(label)]);
              advanceTo('review');
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors"
          >
            <Check size={14} /> {selectedAgents.length > 0 ? `Assign ${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''}` : 'Continue without agents'}
          </button>
        </div>
      ) : null;

      case 'review': return step === 'review' ? (
        <div className="mt-3 space-y-4">
          {/* Summary card */}
          <div className="bg-mission-control-bg border border-mission-control-border rounded-lg p-4 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-mission-control-accent/20 border border-mission-control-accent/30">
                <Megaphone size={15} className="text-mission-control-accent" />
              </div>
              <div>
                <div className="font-semibold text-mission-control-text">{name}</div>
                <div className="text-xs text-mission-control-text-dim">
                  {types.map(t => TYPE_OPTIONS.find(o => o.value === t)?.label ?? t).join(', ')}
                  {goal && ` · ${GOAL_OPTIONS.find(o => o.value === goal)?.label ?? goal}`}
                </div>
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {targetAudience && (
                <div><span className="text-mission-control-text-dim">Audience: </span><span className="text-mission-control-text">{targetAudience}</span></div>
              )}
              {budget && (
                <div><span className="text-mission-control-text-dim">Budget: </span><span className="text-mission-control-text">${parseFloat(budget).toLocaleString()}</span></div>
              )}
              {startDate && (
                <div><span className="text-mission-control-text-dim">Start: </span><span className="text-mission-control-text">{startDate}</span></div>
              )}
              {endDate && (
                <div><span className="text-mission-control-text-dim">End: </span><span className="text-mission-control-text">{endDate}</span></div>
              )}
              {selectedAgents.length > 0 && (
                <div className="col-span-2">
                  <span className="text-mission-control-text-dim">Team: </span>
                  <span className="text-mission-control-text">{agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name).join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {creationError && (
            <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {creationError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Rocket size={14} /> Launch Campaign</>}
            </button>
            <button
              onClick={() => {
                // Go back to name step — restart conversation
                setMessages([]);
                setStep('name');
                setName(''); setTypes([]); setGoal(''); setChannels([]);
                setTargetAudience(''); setBudget(''); setStartDate(''); setEndDate('');
                setBrief(''); setSelectedAgents([]); setCreationError(null);
                sendAgentMessage("Let's set up your campaign. What's it called?", 'name', 200);
              }}
              className="text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors underline underline-offset-2"
            >
              Start over
            </button>
          </div>
        </div>
      ) : null;

      default:
        return null;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center">
              <Bot size={15} className="text-mission-control-accent" />
            </div>
            <div>
              <span className="font-semibold text-mission-control-text text-sm">Campaign Planner</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-mission-control-text-dim">Active</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Chat messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          style={{ minHeight: 0 }}
        >
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'agent' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center mt-0.5">
                  <Bot size={13} className="text-mission-control-accent" />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'agent'
                    ? 'bg-mission-control-surface border border-mission-control-border text-mission-control-text rounded-tl-sm'
                    : 'bg-mission-control-accent text-white rounded-tr-sm'
                }`}>
                  {msg.content}
                </div>
                {/* Inline block rendered below agent message */}
                {msg.role === 'agent' && msg.blockStep && (
                  <div className="w-full">
                    {renderBlock(msg.blockStep)}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {agentTyping && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center">
                <Bot size={13} className="text-mission-control-accent" />
              </div>
              <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-mission-control-surface border border-mission-control-border">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-mission-control-text-dim animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-mission-control-text-dim animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-mission-control-text-dim animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom free-text input — shown for text entry steps */}
        {showTextInput && (
          <div className="flex-shrink-0 border-t border-mission-control-border px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type={step === 'budget' ? 'number' : 'text'}
                placeholder={inputPlaceholder}
                value={freeInput}
                onChange={e => setFreeInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                min={step === 'budget' ? '0' : undefined}
                autoFocus
                className="flex-1 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent text-sm"
              />
              <button
                onClick={handleInputSend}
                disabled={step === 'name' ? freeInput.trim().length < 2 : false}
                className="flex items-center justify-center w-9 h-9 bg-mission-control-accent rounded-lg text-white hover:bg-mission-control-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
