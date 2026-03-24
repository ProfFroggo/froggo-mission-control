'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Check, Loader2, Bot,
  DollarSign, Leaf, Share2, Mail, Users, FileText, Megaphone, Star, Search, Briefcase,
  Eye, Target, ShoppingCart, Heart, TrendingUp, MessageCircle, Rocket,
  SkipForward, Wand2, Sparkles, Upload, Trash2,
} from 'lucide-react';
import { campaignsApi, agentApi } from '../../lib/api';
import type { Campaign } from '../../types/campaigns';
import AgentAvatar from '../AgentAvatar';
import { CHANNEL_ICONS, CHANNEL_LABELS, ALL_CHANNELS } from './channelIcons';
import { Button, IconButton } from '@radix-ui/themes';

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

  // ── Discovery phase (AI wizard chat, shown before main wizard) ───────────────
  interface DiscoveryMsg { role: 'user' | 'model'; text: string; widget?: string; }
  const [wizardPhase, setWizardPhase] = useState<'discovery' | 'main' | 'context-files'>('discovery');
  const [discoveryMsgs, setDiscoveryMsgs] = useState<DiscoveryMsg[]>([
    { role: 'model', text: "Tell me about this campaign. What are you trying to achieve?" },
  ]);
  const [discoveryInput, setDiscoveryInput] = useState('');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const [discoveryStructuredData, setDiscoveryStructuredData] = useState<Record<string, unknown> | null>(null);
  const discoveryScrollRef = useRef<HTMLDivElement>(null);

  // ── Context files (staged for upload after campaign creation) ────────────────
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [contextFilesDragging, setContextFilesDragging] = useState(false);
  const contextFilesInputRef = useRef<HTMLInputElement>(null);
  const [_createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    discoveryScrollRef.current?.scrollTo({ top: discoveryScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [discoveryMsgs, discoveryLoading]);

  const sendDiscoveryMessage = useCallback(async (text: string, baseOverride?: Array<{ role: 'user' | 'model'; text: string; widget?: string }>) => {
    const base = baseOverride ?? discoveryMsgs;
    const newUserMsg = { role: 'user' as const, text };
    const newMsgs = [...base, newUserMsg];
    setDiscoveryMsgs(newMsgs);
    setDiscoveryLoading(true);
    try {
      const res = await fetch('/api/campaigns/wizard-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role: m.role, text: m.text })) }),
      });
      const data = await res.json();
      if (data.ready && data.structuredData) {
        setDiscoveryReady(true);
        setDiscoveryStructuredData(data.structuredData);
      }
      setDiscoveryMsgs(prev => [...prev, { role: 'model' as const, text: data.text || '', widget: data.widget }]);
    } catch { /* non-critical */ }
    finally { setDiscoveryLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryMsgs]);

  const handleDiscoverySend = useCallback(async () => {
    const text = discoveryInput.trim();
    if (!text || discoveryLoading) return;
    setDiscoveryInput('');
    await sendDiscoveryMessage(text);
  }, [discoveryInput, discoveryLoading, sendDiscoveryMessage]);

  const handleDiscoveryConfirm = () => {
    if (discoveryStructuredData) {
      if (typeof discoveryStructuredData.name === 'string') setName(discoveryStructuredData.name);
      if (typeof discoveryStructuredData.goal === 'string') setGoal(discoveryStructuredData.goal);
      if (Array.isArray(discoveryStructuredData.types)) setTypes(discoveryStructuredData.types as string[]);
      if (Array.isArray(discoveryStructuredData.channels)) setChannels(discoveryStructuredData.channels as string[]);
      if (typeof discoveryStructuredData.targetAudience === 'string') setTargetAudience(discoveryStructuredData.targetAudience);
      if (typeof discoveryStructuredData.budget === 'string') setBudget(discoveryStructuredData.budget.replace(/[^0-9.]/g, ''));
      if (typeof discoveryStructuredData.brief === 'string') setBrief(discoveryStructuredData.brief);
    }
    setWizardPhase('main');
  };

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

      const campaignId = result.campaign?.id ?? result.id;
      setCreatedCampaignId(campaignId);

      // If there are staged context files, show context-files phase
      if (stagedFiles.length > 0) {
        setCreating(false);
        setWizardPhase('context-files');
        // Upload files in background
        for (const file of stagedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('entityType', 'campaign');
          formData.append('entityId', campaignId);
          fetch('/api/context-files/upload', { method: 'POST', body: formData }).catch(() => {});
        }
        // Give it a moment then close and call onCreated
        setTimeout(() => {
          onCreated(result.campaign ?? {
            id: campaignId, name, type: types[0] ?? 'general', types, goal,
            status: 'draft', channels, budgetSpent: 0, currency: 'USD',
            kpis: {}, color: '#6366f1', createdAt: Date.now(), updatedAt: Date.now(),
          });
        }, 500);
      } else {
        onCreated(result.campaign ?? {
          id: campaignId, name, type: types[0] ?? 'general', types, goal,
          status: 'draft', channels, budgetSpent: 0, currency: 'USD',
          kpis: {}, color: '#6366f1', createdAt: Date.now(), updatedAt: Date.now(),
        });
      }
    } catch (err) {
      setCreationError(err instanceof Error ? err.message : 'Failed to create campaign');
      setCreating(false);
    }
  }, [name, types, goal, channels, brief, targetAudience, startDate, endDate, budget, selectedAgents, stagedFiles, onCreated]);

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
                <Button key={t.value} variant={sel ? 'solid' : 'ghost'} color={sel ? 'violet' : 'gray'} size="1" onClick={() => toggleType(t.value)}>
                  <Icon size={15} />
                  <span className="text-xs font-medium">{t.label}</span>
                  <span className="text-xs opacity-60 leading-tight">{t.desc}</span>
                </Button>
              );
            })}
          </div>
          {step === 'types' && types.length > 0 && (
            <Button variant="solid" size="1" onClick={() => {
              const labels = types.map(v => TYPE_OPTIONS.find(o => o.value === v)?.label ?? v).join(', ');
              setMessages(prev => [...prev, userMsg(labels)]);
              advanceTo('goal');
            }}>
              <Check size={14} /> Confirm selection
            </Button>
          )}
        </div>
      );

      case 'goal': return (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {GOAL_OPTIONS.map(g => {
            const Icon = g.icon;
            const sel = goal === g.value;
            return (
              <Button key={g.value} variant={sel ? 'solid' : 'ghost'} color={sel ? 'violet' : 'gray'} size="1"
                onClick={() => {
                  if (step !== 'goal') return;
                  setGoal(g.value);
                  setMessages(prev => [...prev, userMsg(g.label)]);
                  advanceTo('channels');
                }}>
                <Icon size={15} />
                <span className="text-xs font-medium">{g.label}</span>
                <span className="text-xs opacity-60 leading-tight">{g.desc}</span>
              </Button>
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
                <Button key={ch} variant={sel ? 'solid' : 'ghost'} color={sel ? 'violet' : 'gray'} size="1" onClick={() => toggleChannel(ch)}>
                  {Icon && <Icon size={15} />}
                  <span className="text-sm font-medium">{CHANNEL_LABELS[ch]}</span>
                  {sel && <Check size={11} className="ml-auto flex-shrink-0" />}
                </Button>
              );
            })}
          </div>
          {step === 'channels' && channels.length > 0 && (
            <Button variant="solid" size="1" onClick={() => {
              const labels = channels.map(c => CHANNEL_LABELS[c] ?? c).join(', ');
              setMessages(prev => [...prev, userMsg(labels)]);
              advanceTo('audience');
            }}>
              <Check size={14} /> Confirm channels
            </Button>
          )}
        </div>
      );

      case 'audience': return (
        step === 'audience' ? (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="1" onClick={() => handleAudienceSubmit('')}>
              <SkipForward size={13} /> Skip
            </Button>
          </div>
        ) : null
      );

      case 'budget': return (
        step === 'budget' ? (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" size="1" onClick={() => handleBudgetSubmit('')}>
              <SkipForward size={13} /> Skip
            </Button>
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
              <Button variant="solid" size="1" onClick={() => {
                const parts = [startDate, endDate].filter(Boolean).join(' → ');
                setMessages(prev => [...prev, userMsg(parts)]);
                advanceTo('brief');
              }}>
                <Check size={14} /> Confirm dates
              </Button>
            )}
            <Button variant="ghost" size="1" onClick={() => {
              setMessages(prev => [...prev, userMsg('Skipped')]);
              advanceTo('brief');
            }}>
              <SkipForward size={13} /> Skip
            </Button>
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
            <Button variant="ghost" size="1" onClick={handleDraftBrief} disabled={draftingBrief}>
              {draftingBrief ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Draft with AI
            </Button>
            {brief.trim().length > 0 && (
              <Button variant="solid" size="1" onClick={() => handleBriefTextSubmit(brief)}>
                <Check size={13} /> Use this brief
              </Button>
            )}
            <Button variant="ghost" size="1" onClick={() => handleBriefTextSubmit('')}>
              <SkipForward size={13} /> Skip
            </Button>
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
                  <Button key={agent.id} variant={sel ? 'soft' : 'ghost'} color={sel ? 'violet' : 'gray'} size="1" onClick={() => toggleAgent(agent.id)}>
                    <AgentAvatar agentId={agent.id} size="sm" fallbackEmoji={agent.emoji} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-mission-control-text">{agent.name}</div>
                      {agent.role && <div className="text-xs text-mission-control-text-dim truncate">{agent.role}</div>}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-mission-control-accent bg-mission-control-accent' : 'border-mission-control-border'}`}>
                      {sel && <Check size={9} className="text-white" />}
                    </div>
                  </Button>
                );
              })}
              {agents.length === 0 && (
                <p className="text-sm text-mission-control-text-dim text-center py-4">No agents available. Create agents first.</p>
              )}
            </div>
          )}
          <Button variant="solid" size="1" onClick={() => {
            const agentNames = agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name);
            const label = agentNames.length > 0 ? agentNames.join(', ') : 'No agents assigned';
            setMessages(prev => [...prev, userMsg(label)]);
            setWizardPhase('context-files');
          }}>
            <Check size={14} /> {selectedAgents.length > 0 ? `Assign ${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''}` : 'Continue without agents'}
          </Button>
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
            <div className="px-3 py-2.5 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {creationError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="solid" size="1" onClick={handleCreate} disabled={creating}>
              {creating ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Rocket size={14} /> Launch Campaign</>}
            </Button>
            <Button variant="ghost" size="1" onClick={() => {
              // Go back to name step — restart conversation
              setMessages([]);
              setStep('name');
              setName(''); setTypes([]); setGoal(''); setChannels([]);
              setTargetAudience(''); setBudget(''); setStartDate(''); setEndDate('');
              setBrief(''); setSelectedAgents([]); setCreationError(null);
              sendAgentMessage("Let's set up your campaign. What's it called?", 'name', 200);
            }}>
              Start over
            </Button>
          </div>
        </div>
      ) : null;

      default:
        return null;
    }
  }

  // ── Discovery widget renderer (reuses form state, sends selection as message) ─
  function renderDiscoveryWidget(widget: string) {
    switch (widget) {
      case 'types': return (
        <div className="mt-2 space-y-2 max-w-[82%]">
          <div className="grid grid-cols-2 gap-1.5">
            {TYPE_OPTIONS.map(t => {
              const Icon = t.icon;
              const sel = types.includes(t.value);
              return (
                <Button key={t.value} variant={sel ? 'solid' : 'ghost'} color={sel ? 'violet' : 'gray'} size="1" onClick={() => toggleType(t.value)}>
                  <Icon size={13} />
                  <span className="text-xs font-medium">{t.label}</span>
                </Button>
              );
            })}
          </div>
          {types.length > 0 && (
            <Button variant="solid" size="1" onClick={() => sendDiscoveryMessage(types.map(v => TYPE_OPTIONS.find(o => o.value === v)?.label ?? v).join(', '))}>
              <Check size={12} /> Confirm ({types.length} selected)
            </Button>
          )}
        </div>
      );
      case 'goal': return (
        <div className="mt-2 grid grid-cols-2 gap-1.5 max-w-[82%]">
          {GOAL_OPTIONS.map(g => {
            const Icon = g.icon;
            return (
              <Button key={g.value} variant={goal === g.value ? 'solid' : 'ghost'} color={goal === g.value ? 'violet' : 'gray'} size="1" onClick={() => { setGoal(g.value); sendDiscoveryMessage(g.label); }}>
                <Icon size={13} />
                <span className="text-xs font-medium">{g.label}</span>
              </Button>
            );
          })}
        </div>
      );
      case 'channels': return (
        <div className="mt-2 space-y-2 max-w-[82%]">
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_CHANNELS.map(ch => {
              const Icon = CHANNEL_ICONS[ch];
              const sel = channels.includes(ch);
              return (
                <Button key={ch} variant={sel ? 'solid' : 'ghost'} color={sel ? 'violet' : 'gray'} size="1" onClick={() => toggleChannel(ch)}>
                  {Icon && <Icon size={13} />}
                  <span className="text-xs font-medium">{CHANNEL_LABELS[ch]}</span>
                  {sel && <Check size={10} className="ml-auto flex-shrink-0" />}
                </Button>
              );
            })}
          </div>
          {channels.length > 0 && (
            <Button variant="solid" size="1" onClick={() => sendDiscoveryMessage(channels.map(c => CHANNEL_LABELS[c] ?? c).join(', '))}>
              <Check size={12} /> Confirm ({channels.length} selected)
            </Button>
          )}
        </div>
      );
      case 'dates': return (
        <div className="mt-2 space-y-2 max-w-[82%]">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-mission-control-text-dim mb-1 block">Start</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text text-xs focus:outline-none focus:border-mission-control-accent" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-mission-control-text-dim mb-1 block">End</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text text-xs focus:outline-none focus:border-mission-control-accent" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="solid" size="1" onClick={() => sendDiscoveryMessage(startDate || endDate ? `${startDate || 'TBD'} → ${endDate || 'TBD'}` : 'No specific dates')}>
              <Check size={12} /> Confirm dates
            </Button>
            <Button variant="ghost" size="1" onClick={() => sendDiscoveryMessage('No specific dates yet')}>
              <SkipForward size={12} /> Skip
            </Button>
          </div>
        </div>
      );
      case 'budget': return (
        <div className="mt-2 space-y-2 max-w-[82%]">
          <input type="number" placeholder="e.g. 50000" value={budget} onChange={e => setBudget(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text text-xs focus:outline-none focus:border-mission-control-accent"
            onKeyDown={e => e.key === 'Enter' && sendDiscoveryMessage(budget ? `$${parseFloat(budget).toLocaleString()}` : 'No budget set')} />
          <div className="flex gap-2">
            <Button variant="solid" size="1" onClick={() => sendDiscoveryMessage(budget ? `$${parseFloat(budget).toLocaleString()}` : 'No budget set')}>
              <Check size={12} /> Confirm budget
            </Button>
            <Button variant="ghost" size="1" onClick={() => sendDiscoveryMessage('No budget defined yet')}>
              <SkipForward size={12} /> Skip
            </Button>
          </div>
        </div>
      );
      default: return null;
    }
  }

  // ── Active discovery widget — shown below the last model message ──────────────
  const activeDiscoveryWidget = (() => {
    if (discoveryLoading || discoveryReady) return null;
    const last = discoveryMsgs[discoveryMsgs.length - 1];
    return (last?.role === 'model' && last.widget) ? last.widget : null;
  })();

  // ── Discovery phase (AI wizard) ───────────────────────────────────────────────
  if (wizardPhase === 'discovery') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-mission-control-border">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-mission-control-accent" />
              <span className="text-sm font-semibold text-mission-control-text">New Campaign</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="1" onClick={() => setWizardPhase('main')}>
                Skip
              </Button>
              <IconButton variant="ghost" size="1" onClick={onClose}>
                <X size={16} />
              </IconButton>
            </div>
          </div>

          <div ref={discoveryScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
            {discoveryMsgs.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2'} w-full`}>
                  {msg.role === 'model' && (
                    <div className="w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={14} className="text-mission-control-accent" />
                    </div>
                  )}
                  <div className={`max-w-[82%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-mission-control-accent text-white rounded-br-sm'
                      : 'bg-mission-control-surface text-mission-control-text rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
                {/* Render widget below the last model message that has one */}
                {msg.role === 'model' && i === discoveryMsgs.length - 1 && activeDiscoveryWidget && (
                  <div className="pl-9 w-full">
                    {renderDiscoveryWidget(activeDiscoveryWidget)}
                  </div>
                )}
              </div>
            ))}
            {discoveryLoading && (
              <div className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-mission-control-accent" />
                </div>
                <div className="bg-mission-control-surface px-4 py-3 rounded-lg rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {discoveryReady && discoveryStructuredData && (
              <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-accent/30 rounded-lg">
                <p className="text-xs text-mission-control-text-dim mb-1 font-medium">Ready to create:</p>
                <p className="text-sm font-semibold text-mission-control-text">{String(discoveryStructuredData.name ?? '')}</p>
                {!!discoveryStructuredData.goal && (
                  <p className="text-xs text-mission-control-text-dim mt-0.5 line-clamp-2">{String(discoveryStructuredData.goal)}</p>
                )}
                <Button variant="solid" size="1" onClick={handleDiscoveryConfirm} className="mt-2 w-full justify-center">
                  Looks good →
                </Button>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-mission-control-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={discoveryInput}
                onChange={e => setDiscoveryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleDiscoverySend()}
                placeholder="Tell me about your campaign..."
                disabled={discoveryLoading}
                className="flex-1 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-1 focus:ring-mission-control-accent disabled:opacity-50"
              />
              <IconButton variant="solid" size="2" onClick={handleDiscoverySend} disabled={!discoveryInput.trim() || discoveryLoading}>
                <Send size={14} />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Context files phase ────────────────────────────────────────────────────────
  if (wizardPhase === 'context-files') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-mission-control-border">
            <div>
              <div className="text-sm font-semibold text-mission-control-text">Add Context Files</div>
              <div className="text-xs text-mission-control-text-dim">Optional — upload files Gemini should use as context</div>
            </div>
            <IconButton variant="ghost" size="1" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setContextFilesDragging(true); }}
              onDragLeave={() => setContextFilesDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setContextFilesDragging(false);
                if (e.dataTransfer.files) setStagedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
              }}
              onClick={() => contextFilesInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                contextFilesDragging
                  ? 'border-mission-control-accent bg-mission-control-accent/10'
                  : 'border-mission-control-border hover:border-mission-control-accent/50 hover:bg-mission-control-surface'
              }`}
            >
              <input
                ref={contextFilesInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) setStagedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }}
              />
              <Upload size={20} className="mx-auto text-mission-control-text-dim mb-2" />
              <p className="text-sm text-mission-control-text-dim">Drop files here or click to upload</p>
              <p className="text-xs text-mission-control-text-dim mt-1">Docs, images, PDFs, briefs — any file</p>
            </div>

            {stagedFiles.length > 0 && (
              <div className="space-y-1.5">
                {stagedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
                    <span className="flex-1 text-sm text-mission-control-text truncate">{f.name}</span>
                    <span className="text-xs text-mission-control-text-dim">{(f.size / 1024).toFixed(0)}KB</span>
                    <IconButton variant="ghost" size="1" color="red" onClick={() => setStagedFiles(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 size={12} />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-mission-control-border">
            <Button variant="solid" size="1" onClick={() => {
              setWizardPhase('main');
              advanceTo('review');
            }} className="w-full justify-center">
              {stagedFiles.length > 0 ? `Continue with ${stagedFiles.length} file${stagedFiles.length !== 1 ? 's' : ''}` : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    );
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
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-mission-control-text-dim">Active</span>
              </div>
            </div>
          </div>
          <IconButton variant="ghost" size="1" onClick={onClose}>
            <X size={16} />
          </IconButton>
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
              <IconButton variant="solid" size="2" onClick={handleInputSend} disabled={step === 'name' ? freeInput.trim().length < 2 : false} className="flex-shrink-0">
                <Send size={15} />
              </IconButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
