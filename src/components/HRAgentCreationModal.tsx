import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Check, CheckCircle, XCircle, Circle, Sparkles, GraduationCap } from 'lucide-react';
import { showToast } from './Toast';
import { useStore } from '../store/store';
import { catalogApi } from '../lib/api';

interface HRAgentCreationModalProps {
  onClose: () => void;
  onAgentCreated?: (agent: CreatedAgent) => void;
}

interface CreatedAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
  capabilities: string[];
  personality: string;
}

interface Message {
  role: 'hr' | 'user';
  content: string;
  timestamp: number;
}

interface CreationStep {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  errorMsg?: string;
}

type Stage = 'chat' | 'creating' | 'done';

const AGENT_COLORS = [
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#3F51B5',
  '#009688', '#CDDC39', '#795548', '#607D8B', '#673AB7',
];

const HR_SYSTEM = `You are HR for the Mission Control AI agent team. Your job is to onboard a new agent through a short conversational interview.

Collect these fields one at a time (in order):
1. name — what to call the agent (simple, lowercase-friendly)
2. role — their specialty/job title
3. style — how they work (e.g. "fast and pragmatic", "meticulous and thorough")
4. skills — a few specific capabilities (comma-separated)
5. personality — traits that define them (or offer to auto-generate)

Rules:
- Ask one question at a time. Keep responses short (1-2 sentences max).
- Acknowledge what the user said before asking the next question.
- At the review stage, show a clean summary and ask for confirmation.
- If the user wants to change something, parse the field and value, update the summary, and show it again.
- When the user confirms (says "create", "yes", "looks good", "ship it", etc), output EXACTLY this JSON block on its own line and nothing else after it:
  AGENT_CONFIG:{"name":"...","role":"...","style":"...","skills":["..."],"personality":"..."}
- Be warm, human, and brief. You're building a real team member.`;

function inferTrustTier(role: string): 'worker' | 'apprentice' {
  const lower = role.toLowerCase();
  if (/senior|lead|architect|principal|staff|head|chief|director|vp/.test(lower)) return 'worker';
  return 'apprentice';
}

function buildSteps(_agentId: string): CreationStep[] {
  return [
    { id: 'catalog',     label: 'Register in agent catalog',    detail: 'catalog/agents/{id}.json',                              status: 'pending' },
    { id: 'workspace',   label: 'Create workspace & identity',   detail: '~/mission-control/agents/{id}/ + agents table',         status: 'pending' },
    { id: 'research',    label: 'Research role & skills',        detail: 'AI-powered skill discovery for this role',              status: 'pending' },
    { id: 'avatar',      label: 'Generate profile picture',      detail: 'Pixar-style avatar (DALL-E 3 or styled SVG)',           status: 'pending' },
    { id: 'permissions', label: 'Configure trust & permissions', detail: 'Set permission tier and recommended model',             status: 'pending' },
    { id: 'skills',      label: 'Assign skills & tools',         detail: 'Apply researched capabilities to agent settings',       status: 'pending' },
    { id: 'training',    label: 'Seed onboarding task',          detail: 'Create a first-day orientation task',                   status: 'pending' },
  ];
}

export default function HRAgentCreationModal({ onClose, onAgentCreated }: HRAgentCreationModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>('chat');
  const [isClosing, setIsClosing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([]);
  const [creationDone, setCreationDone] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [pendingConfig, setPendingConfig] = useState<CreatedAgent | null>(null);
  const [generatedAvatarSvg, setGeneratedAvatarSvg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [creationSteps]);

  // Kick off conversation — ref guard prevents React Strict Mode double-invoke
  const initCalledRef = useRef(false);
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    askHR('');
  }, []);

  const addHRMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'hr', content, timestamp: Date.now() }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
  };

  const askHR = async (userMessage: string) => {
    setIsTyping(true);

    if (userMessage) {
      conversationRef.current.push({ role: 'user', content: userMessage });
    }

    const history = conversationRef.current
      .map(m => `${m.role === 'user' ? 'User' : 'HR'}: ${m.content}`)
      .join('\n');

    const prompt = userMessage
      ? `${HR_SYSTEM}\n\n${history ? `Conversation so far:\n${history}\n\n` : ''}User just said: ${JSON.stringify(userMessage)}\n\nYour response:`
      : `${HR_SYSTEM}\n\nStart the conversation. Give a brief greeting and ask the first question (agent name).`;

    try {
      const res = await fetch('/api/agents/hr/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, sessionKey: 'hr-agent-creation' }),
      });
      const raw = await res.json();
      let reply = raw?.response || raw?.content || raw?.message || raw?.text || '';
      if (!reply && typeof raw === 'string') reply = raw;

      setIsTyping(false);

      const configMatch = reply.match(/AGENT_CONFIG:(\{.+\})/);
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1]);
          const agentId = config.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const emoji = pickEmoji(config.role);
          const color = AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)];

          const visibleReply = reply.replace(/AGENT_CONFIG:\{.+\}/, '').trim();
          if (visibleReply) addHRMessage(visibleReply);

          setPendingConfig({
            id: agentId,
            name: config.name,
            emoji,
            role: config.role,
            color,
            capabilities: Array.isArray(config.skills)
              ? config.skills
              : config.skills?.split(',').map((s: string) => s.trim()) || [],
            personality: config.personality,
          });

          conversationRef.current.push({ role: 'hr', content: visibleReply || reply });
          return;
        } catch {
          // Config parse failed — treat as normal reply
        }
      }

      const cleanReply = reply.replace(/^HR:\s*/i, '').trim();
      addHRMessage(cleanReply);
      conversationRef.current.push({ role: 'hr', content: cleanReply });

    } catch (err: unknown) {
      setIsTyping(false);
      const msg = err instanceof Error ? err.message : String(err);
      addHRMessage(`Something went wrong reaching the HR agent. (${msg.slice(0, 60)})`);
    }
  };

  const handleSend = () => {
    if (!input.trim() || stage !== 'chat' || isTyping) return;
    const text = input.trim();
    setInput('');
    addUserMessage(text);
    askHR(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── Creation steps ────────────────────────────────────────────────────────

  const updateStep = (id: string, status: CreationStep['status'], errorMsg?: string) => {
    setCreationSteps(prev => prev.map(s => s.id === id ? { ...s, status, errorMsg } : s));
  };

  const runStep = async (stepId: string, fn: () => Promise<void>): Promise<boolean> => {
    updateStep(stepId, 'running');
    try {
      await fn();
      updateStep(stepId, 'done');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep(stepId, 'error', msg.slice(0, 80));
      return false;
    }
  };

  const softStep = async (stepId: string, fn: () => Promise<void>): Promise<void> => {
    updateStep(stepId, 'running');
    try {
      await fn();
      // fn() may have already called updateStep('done') with a custom detail — only
      // set done if still running (guards against the research step's self-update)
      setCreationSteps(prev => prev.map(s =>
        s.id === stepId && s.status === 'running' ? { ...s, status: 'done' } : s
      ));
    } catch {
      setCreationSteps(prev => prev.map(s =>
        s.id === stepId && s.status === 'running' ? { ...s, status: 'skipped' } : s
      ));
    }
  };

  const startCreation = async (cfg: CreatedAgent) => {
    const steps = buildSteps(cfg.id);
    setCreationSteps(steps);
    setStage('creating');
    setCreationDone(false);
    setCreationError(null);

    // Research results — populated by step 3, consumed by steps 4–6
    let researchedSkills: string[]  = cfg.capabilities;
    let researchedTools: string[]   = inferTools(cfg.role, cfg.capabilities);
    let researchedModel             = 'sonnet';
    let researchedTier              = inferTrustTier(cfg.role);
    let researchedSpecs: string[]   = [];

    // ── Step 1: Catalog ──
    const catalogOk = await runStep('catalog', () =>
      catalogApi.registerAgent({
        id: cfg.id,
        name: cfg.name,
        emoji: cfg.emoji,
        role: cfg.role,
        description: cfg.role,
        capabilities: cfg.capabilities,
        category: 'custom',
        model: 'sonnet',
        version: '1.0.0',
      })
    );
    if (!catalogOk) {
      setCreationError('Could not register agent in catalog.');
      return;
    }

    // ── Step 2: Workspace ──
    const workspaceOk = await runStep('workspace', () =>
      catalogApi.hireAgent({
        id: cfg.id,
        name: cfg.name,
        emoji: cfg.emoji,
        role: cfg.role,
        personality: cfg.personality,
        capabilities: cfg.capabilities,
        color: cfg.color,
      })
    );
    if (!workspaceOk) {
      setCreationError('Could not create agent workspace.');
      return;
    }

    // ── Step 3: Research role & skills (soft — enriches downstream steps) ──
    await softStep('research', async () => {
      const res = await fetch('/api/agents/hr/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cfg.name,
          role: cfg.role,
          capabilities: cfg.capabilities,
          personality: cfg.personality,
        }),
      });
      if (!res.ok) throw new Error(`Research failed: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.skills)          && data.skills.length > 0)          researchedSkills = data.skills;
      if (Array.isArray(data.tools)           && data.tools.length > 0)           researchedTools  = data.tools;
      if (Array.isArray(data.specializations) && data.specializations.length > 0) researchedSpecs  = data.specializations;
      if (data.suggestedModel) researchedModel = data.suggestedModel;
      if (data.trustTier)      researchedTier  = data.trustTier;

      // Update step detail to show what was found
      updateStep('research', 'done');
      setCreationSteps(prev => prev.map(s =>
        s.id === 'research'
          ? { ...s, detail: `Found ${researchedSkills.length} skills · ${researchedTools.length} tools · model: ${researchedModel}` }
          : s
      ));
    });

    // ── Step 4: Avatar (soft) ──
    await softStep('avatar', async () => {
      const res = await fetch(`/api/agents/${cfg.id}/avatar/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: cfg.emoji, color: cfg.color, name: cfg.name, role: cfg.role }),
      });
      if (!res.ok) throw new Error(`Avatar gen failed: ${res.status}`);
      const data = await res.json();
      if (data.svg) setGeneratedAvatarSvg(data.svg);
      setCreationSteps(prev => prev.map(s =>
        s.id === 'avatar'
          ? { ...s, detail: data.method === 'dalle3' ? 'DALL-E 3 Pixar-style image generated' : 'Styled SVG avatar created' }
          : s
      ));
    });

    // ── Step 5: Permissions — uses researched tier + model (soft) ──
    await softStep('permissions', async () => {
      const res = await fetch(`/api/agents/${cfg.id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustTier: researchedTier, model: researchedModel }),
      });
      if (!res.ok) throw new Error('Permissions PATCH failed');
      setCreationSteps(prev => prev.map(s =>
        s.id === 'permissions'
          ? { ...s, detail: `Tier: ${researchedTier} · Model: ${researchedModel}` }
          : s
      ));
    });

    // ── Step 6: Skills & tools — uses researched data (soft) ──
    await softStep('skills', async () => {
      // Merge specializations into capabilities for richer context
      const allCapabilities = [...new Set([...cfg.capabilities, ...researchedSpecs])];
      const res = await fetch(`/api/agents/${cfg.id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilities: allCapabilities,
          skills: researchedSkills,
          tools: researchedTools,
        }),
      });
      if (!res.ok) throw new Error('Skills PATCH failed');
      setCreationSteps(prev => prev.map(s =>
        s.id === 'skills'
          ? { ...s, detail: researchedSkills.slice(0, 3).join(', ') + (researchedSkills.length > 3 ? ` +${researchedSkills.length - 3} more` : '') }
          : s
      ));
    });

    // ── Step 7: Onboarding task (soft) ──
    await softStep('training', async () => {
      const skillsList = researchedSkills.slice(0, 6).map(s => `- ${s}`).join('\n');
      const specsList  = researchedSpecs.length > 0 ? `\n\n**Specializations discovered:**\n${researchedSpecs.map(s => `- ${s}`).join('\n')}` : '';
      const taskRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${cfg.emoji} ${cfg.name} — First Day Onboarding`,
          description: `Welcome to the team! Complete these orientation steps to get up to speed.\n\n**Role:** ${cfg.role}\n**Personality:** ${cfg.personality}\n**Model:** ${researchedModel} · **Trust tier:** ${researchedTier}\n\n**Key skills to leverage:**\n${skillsList}${specsList}\n\n**Plan:** Work through each subtask in order. Start with your identity files, then introduce yourself, then begin your first assignment.`,
          assignedTo: cfg.id,
          priority: 'p2',
          status: 'todo',
          tags: JSON.stringify(['onboarding', 'orientation']),
        }),
      });
      if (!taskRes.ok) throw new Error('Task creation failed');
      const task = await taskRes.json();
      const taskId = task.id;


      // Seed subtasks
      const subtasks = [
        { title: `Read identity files`, description: `Read your SOUL.md at ~/mission-control/agents/${cfg.id}/SOUL.md and your CLAUDE.md for platform instructions.` },
        { title: `Introduce yourself`, description: `Post an introduction in the mission-control chat room using the chat_post MCP tool. Mention your role, personality, and what you are here to do.` },
        { title: `Review skills and tools`, description: `Open the Manage modal in the Agents panel and confirm your assigned skills, tools, and trust tier are correct.` },
        { title: `Complete first assignment`, description: `Ask for your first task in the mission-control chat room or check the task board for a todo item assigned to you.` },
      ];
      for (const sub of subtasks) {
        await fetch(`/api/tasks/${taskId}/subtasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sub, assignedTo: cfg.id }),
        });
      }
    });

    useStore.getState().fetchAgents();
    onAgentCreated?.(cfg);
    showToast(`${cfg.emoji} ${cfg.name} is on the team!`, 'success');
    setCreationDone(true);
  };

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => { if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current); };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(onClose, 200);
  };

  const doneCount = creationSteps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const totalSteps = creationSteps.length;
  const progressPct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default" onClick={handleClose} type="button" aria-label="Close" />
      <div className={`relative w-full max-w-lg bg-mission-control-bg border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col max-h-[85vh] ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}>

        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400">
            <GraduationCap size={22} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-mission-control-text">HR — Agent Creator</h2>
            <p className="text-xs text-teal-400">
              {stage === 'creating'
                ? creationDone ? 'Onboarding complete!' : creationError ? 'Onboarding failed' : 'Launching new agent...'
                : 'Building your next team member'}
            </p>
          </div>
          <button onClick={handleClose} className="p-1 text-mission-control-text-dim hover:text-mission-control-text rounded-lg hover:bg-mission-control-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Creating stage */}
        {stage === 'creating' && pendingConfig && (
          <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
            {/* Agent card */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-teal-500/40 flex items-center justify-center bg-teal-500/20 flex-shrink-0">
                <span className="text-2xl">{pendingConfig.emoji}</span>
              </div>
              <div>
                <div className="font-semibold text-mission-control-text">{pendingConfig.name}</div>
                <div className="text-xs text-mission-control-text-dim">{pendingConfig.role}</div>
              </div>
              {!creationDone && !creationError && <Loader2 size={16} className="ml-auto text-teal-400 animate-spin" />}
              {creationDone && <Sparkles size={18} className="ml-auto text-teal-400" />}
            </div>

            {/* Progress bar */}
            {totalSteps > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-mission-control-text-dim mb-1">
                  <span>{doneCount}/{totalSteps} steps</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${creationError ? 'bg-error' : 'bg-teal-400'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Steps list */}
            <div className="space-y-2">
              {creationSteps.map((step) => (
                <div key={step.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                  step.status === 'running'  ? 'bg-teal-500/5 border-teal-500/30' :
                  step.status === 'done'     ? 'bg-success-subtle border-success-border' :
                  step.status === 'skipped'  ? 'bg-mission-control-surface/30 border-mission-control-border opacity-60' :
                  step.status === 'error'    ? 'bg-error-subtle border-error-border' :
                  'bg-mission-control-surface/50 border-mission-control-border'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {step.status === 'running'  && <Loader2 size={16} className="text-teal-400 animate-spin" />}
                    {step.status === 'done'     && <CheckCircle size={16} className="text-success" />}
                    {step.status === 'skipped'  && <Circle size={16} className="text-mission-control-text-dim" />}
                    {step.status === 'error'    && <XCircle size={16} className="text-error" />}
                    {step.status === 'pending'  && <Circle size={16} className="text-mission-control-border" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      step.status === 'done'    ? 'text-success' :
                      step.status === 'error'   ? 'text-error' :
                      step.status === 'running' ? 'text-teal-400' :
                      step.status === 'skipped' ? 'text-mission-control-text-dim' :
                      'text-mission-control-text-dim'
                    }`}>{step.label}</div>
                    <div className="text-xs text-mission-control-text-dim mt-0.5">
                      {step.errorMsg || (step.status === 'skipped' ? 'Skipped — not critical' : step.detail)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Done card */}
            {creationDone && (
              <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl text-center">
                <div className="text-2xl mb-1">{pendingConfig.emoji}</div>
                <div className="font-semibold text-teal-400">{pendingConfig.name} is live!</div>
                <div className="text-xs text-mission-control-text-dim mt-1">
                  Find them in the Agents panel · Onboarding task created
                </div>
              </div>
            )}

            {/* Error banner */}
            {creationError && (
              <div className="mt-4 p-3 bg-error-subtle border border-error-border rounded-xl">
                <div className="text-sm text-error font-medium">Onboarding failed</div>
                <div className="text-xs text-mission-control-text-dim mt-1">{creationError}</div>
              </div>
            )}
            <div ref={stepsEndRef} />
          </div>
        )}

        {/* Chat stage */}
        {stage === 'chat' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'hr' && (
                  <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5 text-teal-400">
                    <GraduationCap size={14} />
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-info-subtle text-info rounded-br-md'
                    : 'bg-mission-control-surface text-mission-control-text rounded-bl-md'
                }`}>
                  {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
                      : <span key={j}>{part}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Pending config — confirm/edit prompt */}
            {pendingConfig && !isTyping && (
              <div className="mt-2 p-3 bg-teal-500/10 border border-teal-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{pendingConfig.emoji}</span>
                  <span className="font-semibold text-teal-400">{pendingConfig.name}</span>
                  <span className="text-xs text-mission-control-text-dim">· {pendingConfig.role}</span>
                </div>
                <div className="text-xs text-mission-control-text-dim space-y-0.5">
                  <div>Skills: {pendingConfig.capabilities.slice(0, 4).join(', ')}{pendingConfig.capabilities.length > 4 ? '...' : ''}</div>
                  <div>Trust tier: {inferTrustTier(pendingConfig.role)}</div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => startCreation(pendingConfig)}
                    className="flex-1 py-2 bg-teal-500 text-white text-sm rounded-xl hover:bg-teal-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} /> Create agent
                  </button>
                  <button
                    onClick={() => { setPendingConfig(null); addUserMessage('wait, let me change something'); askHR('wait, let me change something'); }}
                    className="px-3 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim text-sm rounded-xl hover:bg-mission-control-border transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center mr-2 text-teal-400">
                  <GraduationCap size={14} />
                </div>
                <div className="bg-mission-control-surface px-4 py-3 rounded-xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-teal-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input / action bar */}
        <div className="p-3 border-t border-mission-control-border">
          {stage === 'creating' && creationDone ? (
            <button onClick={handleClose} className="w-full py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition-colors flex items-center justify-center gap-2">
              <Check size={16} /> Done — View Agents
            </button>
          ) : stage === 'creating' && creationError ? (
            <div className="flex gap-2">
              <button onClick={() => { setStage('chat'); setCreationSteps([]); setCreationError(null); }} className="flex-1 py-2.5 bg-mission-control-surface border border-mission-control-border text-mission-control-text rounded-xl hover:bg-mission-control-border transition-colors text-sm">Back</button>
              <button onClick={() => pendingConfig && startCreation(pendingConfig)} className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors text-sm">Retry</button>
            </div>
          ) : stage === 'creating' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-mission-control-text-dim">
              <Loader2 size={14} className="animate-spin text-teal-400" />
              Launching {pendingConfig?.name}...
            </div>
          ) : pendingConfig ? null : (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
                placeholder={isTyping ? 'HR is thinking...' : 'Type your response...'}
                className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-xl px-3 py-2 text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-teal-500/50 disabled:opacity-50"
                autoFocus
              />
              <button onClick={handleSend} disabled={!input.trim() || isTyping} className="p-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function inferTools(role: string, capabilities: string[]): string[] {
  const lower = (role + ' ' + capabilities.join(' ')).toLowerCase();
  const tools: string[] = [];
  if (/code|dev|engineer|program|build|debug/.test(lower)) tools.push('Bash', 'Read', 'Edit', 'Write');
  if (/search|research|web|browse/.test(lower)) tools.push('WebSearch', 'WebFetch');
  if (/git|version|branch|commit/.test(lower)) tools.push('Bash');
  if (/file|doc|write|content/.test(lower)) tools.push('Read', 'Write', 'Edit');
  if (/data|analytic|sql|database/.test(lower)) tools.push('Bash', 'Read');
  return [...new Set(tools)];
}

function pickEmoji(role: string): string {
  const map: Record<string, string> = {
    devops: '🔧', qa: '🧪', test: '🧪', design: '🎨', data: '📊',
    security: '🔒', ml: '🧠', ai: '🧠', mobile: '📱', cloud: '☁️',
    frontend: '🖥️', backend: '⚙️', database: '🗄️', support: '🎧',
    writer: '✍️', writing: '✍️', author: '📚', book: '📚', illustrat: '🎨',
    children: '🧒', story: '📖', creative: '🎭', publish: '📰',
    market: '📣', social: '📱', finance: '💰', legal: '⚖️', research: '🔬',
    analytic: '📊', video: '🎬', audio: '🎵', photo: '📷',
    reply: '💬', community: '🌐', crypto: '🪙', onchain: '⛓️',
    intern: '🎓', hr: '🤝', ops: '⚙️', growth: '📈',
  };
  const lower = role.toLowerCase();
  return Object.entries(map).find(([k]) => lower.includes(k))?.[1] || '🤖';
}
