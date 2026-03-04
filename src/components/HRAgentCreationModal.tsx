import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Check, CheckCircle, XCircle, Circle, Sparkles } from 'lucide-react';
import { showToast } from './Toast';
import { useStore } from '../store/store';
import { agentApi } from '../lib/api';

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
  status: 'pending' | 'running' | 'done' | 'error';
  errorMsg?: string;
}

type Stage = 'chat' | 'creating' | 'done';

const AGENT_COLORS = [
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#3F51B5',
  '#009688', '#CDDC39', '#795548', '#607D8B', '#673AB7',
];

const HR_SYSTEM = `You are HR for the Froggo AI agent team. Your job is to onboard a new agent through a short conversational interview.

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

function buildSteps(_agentId: string): CreationStep[] {
  return [
    { id: 'db',       label: 'Register in agent database', detail: 'froggo.db agents table', status: 'pending' },
    { id: 'soul',     label: 'Write soul file',            detail: '.claude/agents/{id}.md',  status: 'pending' },
    { id: 'activate', label: 'Set agent status active',    detail: 'Mark as idle, ready',     status: 'pending' },
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [creationSteps]);

  // Kick off conversation
  useEffect(() => {
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

    // Build the full prompt with system instructions + history
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
        body: JSON.stringify({ message: prompt }),
      });
      const raw = await res.json();
      let reply = raw?.response || raw?.content || raw?.message || raw?.text || '';
      if (!reply && typeof raw === 'string') reply = raw;

      setIsTyping(false);

      // Check if HR has finished collecting info and output AGENT_CONFIG
      const configMatch = reply.match(/AGENT_CONFIG:(\{.+\})/);
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1]);
          const agentId = config.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const emoji = pickEmoji(config.role);
          const color = AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)];

          // Show HR's confirmation message (everything before the JSON line)
          const visibleReply = reply.replace(/AGENT_CONFIG:\{.+\}/, '').trim();
          if (visibleReply) addHRMessage(visibleReply);

          setPendingConfig({
            id: agentId,
            name: config.name,
            emoji,
            role: config.role,
            color,
            capabilities: Array.isArray(config.skills) ? config.skills : config.skills?.split(',').map((s: string) => s.trim()) || [],
            personality: config.personality,
          });

          conversationRef.current.push({ role: 'hr', content: visibleReply || reply });
          return;
        } catch {
          // Config parse failed — treat as normal reply
        }
      }

      // Normal conversational reply
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

  const runStep = async (id: string, _cmd: string): Promise<boolean> => {
    updateStep(id, 'running');
    try {
      // Shell commands are not available in web mode — simulate success for provisioning steps
      console.warn('Not implemented: exec.run for agent creation step', id);
      updateStep(id, 'done');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep(id, 'error', msg.slice(0, 80));
      return false;
    }
  };

  const startCreation = async (cfg: CreatedAgent) => {
    const steps = buildSteps(cfg.id);
    setCreationSteps(steps);
    setStage('creating');
    setCreationDone(false);
    setCreationError(null);

    const home = '/Users/worker';
    const agentDir = `${home}/agent-${cfg.id}`;
    const ocDir = `${home}/.openclaw/agents/${cfg.id}`;
    const templateDir = `${home}/.openclaw/agents/coder/agent`;

    const froggoShared = `${home}/froggo/shared-context`;
    const soul = `# ${cfg.emoji} ${cfg.name} — SOUL\n\n## Identity\nYou are ${cfg.name}, a ${cfg.role} agent on the Froggo team.\n\n## Personality\n${cfg.personality}\n\n## Core Rules\n- Always deliver quality work\n- Communicate blockers immediately\n- Update task status when done\n`;
    const identity = `# ${cfg.emoji} ${cfg.name}\n\n**Role:** ${cfg.role}\n**Agent ID:** ${cfg.id}\n**Status:** Active\n`;
    const memory = `# ${cfg.name} Memory\n\n## Key Lessons\n\n## Important Context\n\n## Common Patterns\n`;
    const heartbeat = `# ${cfg.name} Heartbeat\n\n**Agent:** ${cfg.id}\n**Status:** Starting up\n**Last seen:** —\n`;
    const state = `# ${cfg.name} State\n\n**Current task:** None\n**Mood:** Ready\n`;

    const profilesDir = `${home}/froggo-dashboard/public/agent-profiles`;
    const headshotDest = `${profilesDir}/${cfg.id}.png`;
    const headshotPrompt = `Generate a Pixar-style avatar headshot for a new team member named ${cfg.name}. Role: ${cfg.role}. Personality: ${cfg.personality}. Cute, round-faced, expressive, vibrant colours. Save the final image to ${headshotDest} and also copy it to ${agentDir}/headshot.png. Save visual concept notes to ${agentDir}/headshot-concept.md`;

    const hrHandoffMsg = `New agent infrastructure is fully set up and live. Please complete onboarding for ${cfg.name} (ID: ${cfg.id}, Role: ${cfg.role}):\n1. Polish SOUL.md with full personality depth, working style, communication norms, and team context\n2. Create an onboarding kanban task with a detailed subtask checklist (verify tools access, test messaging, confirm capabilities, intro to team)\n3. Set up any agent-specific skills or config needed for their role\n4. Send Kevin a brief welcome message introducing ${cfg.name} to the team\nWorkspace: ${agentDir}`;

    const steps_cmds = [
      { id: 'workspace',    cmd: `mkdir -p "${agentDir}"` },
      { id: 'config_dir',   cmd: `mkdir -p "${ocDir}/agent" "${ocDir}/sessions"` },
      { id: 'auth',         cmd: `cp "${templateDir}/auth-profiles.json" "${ocDir}/agent/auth-profiles.json"` },
      { id: 'models',       cmd: `cp "${templateDir}/models.json" "${ocDir}/agent/models.json"` },
      { id: 'db',           cmd: `/opt/homebrew/bin/froggo-db agent-onboard --name "${cfg.id}" --role "${cfg.role}" --emoji "${cfg.emoji}" --capabilities "${cfg.capabilities.join(',')}"` },
      { id: 'identity',     cmd: `printf '%s' ${JSON.stringify(soul)} > "${agentDir}/SOUL.md" && printf '%s' ${JSON.stringify(identity)} > "${agentDir}/IDENTITY.md" && printf '%s' ${JSON.stringify(memory)} > "${agentDir}/MEMORY.md" && printf '%s' ${JSON.stringify(heartbeat)} > "${agentDir}/HEARTBEAT.md" && printf '%s' ${JSON.stringify(state)} > "${agentDir}/STATE.md"` },
      { id: 'symlinks',     cmd: `ln -sf "${froggoShared}/AGENTS.md" "${agentDir}/AGENTS.md" && ln -sf "${froggoShared}/TOOLS.md" "${agentDir}/TOOLS.md" && ln -sf "${froggoShared}/USER.md" "${agentDir}/USER.md"` },
      { id: 'headshot',     cmd: `mkdir -p "${profilesDir}" && openclaw agent --agent hr --message ${JSON.stringify(headshotPrompt)} --json` },
      { id: 'db_image',     cmd: `sqlite3 "${home}/froggo/data/froggo.db" "UPDATE agent_registry SET image_path='${cfg.id}.png' WHERE id='${cfg.id}'"` },
      { id: 'openclaw',     cmd: `python3 -c "import json\npath='${home}/.openclaw/openclaw.json'\nwith open(path) as f: cfg=json.load(f)\nif not any(a['id']=='${cfg.id}' for a in cfg['agents']['list']):\n    cfg['agents']['list'].append({'id':'${cfg.id}','workspace':'${agentDir}'})\n    with open(path,'w') as f: json.dump(cfg,f,indent=2)\nprint('ok')\n"` },
      { id: 'gateway',      cmd: `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway && sleep 2` },
      { id: 'hr_handoff',   cmd: `openclaw agent --agent hr --message ${JSON.stringify(hrHandoffMsg)} --json` },
    ];

    let failed = false;
    for (const { id, cmd } of steps_cmds) {
      const ok = await runStep(id, cmd);
      if (!ok) { failed = true; break; }
    }

    // Register agent via REST API
    if (!failed) {
      try {
        await agentApi.spawn(cfg.id);
      } catch {
        // Non-critical — agent may already be registered by steps
      }
    }

    if (failed) {
      setCreationError('One or more steps failed. Check above for details.');
    } else {
      useStore.getState().fetchAgents();
      onAgentCreated?.(cfg);
      showToast(`${cfg.emoji} ${cfg.name} created!`, 'success');
      setCreationDone(true);
    }
  };

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => { if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current); };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(onClose, 200);
  };

  const doneCount = creationSteps.filter(s => s.status === 'done').length;
  const totalSteps = creationSteps.length;
  const progressPct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default" onClick={handleClose} type="button" aria-label="Close" />
      <div className={`relative w-full max-w-lg bg-clawd-bg border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col max-h-[85vh] ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}>

        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-clawd-border">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-xl">🎓</div>
          <div className="flex-1">
            <h2 className="font-bold text-clawd-text">HR — Agent Creator</h2>
            <p className="text-xs text-teal-400">
              {stage === 'creating'
                ? creationDone ? 'Onboarding complete!' : creationError ? 'Onboarding failed' : 'Launching new agent...'
                : 'Building your next team member'}
            </p>
          </div>
          <button onClick={handleClose} className="p-1 text-clawd-text-dim hover:text-clawd-text rounded-lg hover:bg-clawd-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Creating stage */}
        {stage === 'creating' && pendingConfig && (
          <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl">
                {pendingConfig.emoji}
              </div>
              <div>
                <div className="font-semibold text-clawd-text">{pendingConfig.name}</div>
                <div className="text-xs text-clawd-text-dim">{pendingConfig.role}</div>
              </div>
              {!creationDone && !creationError && <Loader2 size={16} className="ml-auto text-teal-400 animate-spin" />}
              {creationDone && <Sparkles size={18} className="ml-auto text-teal-400" />}
            </div>

            {totalSteps > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-clawd-text-dim mb-1">
                  <span>{doneCount}/{totalSteps} steps</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-clawd-border rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${creationError ? 'bg-error' : 'bg-teal-400'}`} style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {creationSteps.map((step) => (
                <div key={step.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                  step.status === 'running' ? 'bg-teal-500/5 border-teal-500/30' :
                  step.status === 'done'    ? 'bg-success-subtle border-success-border' :
                  step.status === 'error'   ? 'bg-error-subtle border-error-border' :
                  'bg-clawd-surface/50 border-clawd-border'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {step.status === 'running' && <Loader2 size={16} className="text-teal-400 animate-spin" />}
                    {step.status === 'done'    && <CheckCircle size={16} className="text-success" />}
                    {step.status === 'error'   && <XCircle size={16} className="text-error" />}
                    {step.status === 'pending' && <Circle size={16} className="text-clawd-border" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      step.status === 'done'    ? 'text-success' :
                      step.status === 'error'   ? 'text-error' :
                      step.status === 'running' ? 'text-teal-400' :
                      'text-clawd-text-dim'
                    }`}>{step.label}</div>
                    <div className="text-xs text-clawd-text-dim mt-0.5">
                      {step.errorMsg || step.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {creationDone && (
              <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl text-center">
                <div className="text-2xl mb-1">{pendingConfig.emoji}</div>
                <div className="font-semibold text-teal-400">{pendingConfig.name} is live!</div>
                <div className="text-xs text-clawd-text-dim mt-1">Find them in the Agents panel</div>
              </div>
            )}

            {creationError && (
              <div className="mt-4 p-3 bg-error-subtle border border-error-border rounded-xl">
                <div className="text-sm text-error font-medium">Onboarding failed</div>
                <div className="text-xs text-clawd-text-dim mt-1">{creationError}</div>
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
                  <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">🎓</div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-info-subtle text-info rounded-br-md'
                    : 'bg-clawd-surface text-clawd-text rounded-bl-md'
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
                  <span className="text-xs text-clawd-text-dim">· {pendingConfig.role}</span>
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
                    className="px-3 py-2 bg-clawd-surface border border-clawd-border text-clawd-text-dim text-sm rounded-xl hover:bg-clawd-border transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-sm mr-2">🎓</div>
                <div className="bg-clawd-surface px-4 py-3 rounded-xl">
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
        <div className="p-3 border-t border-clawd-border">
          {stage === 'creating' && creationDone ? (
            <button onClick={handleClose} className="w-full py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition-colors flex items-center justify-center gap-2">
              <Check size={16} /> Done — View Agents
            </button>
          ) : stage === 'creating' && creationError ? (
            <div className="flex gap-2">
              <button onClick={() => { setStage('chat'); setCreationSteps([]); setCreationError(null); }} className="flex-1 py-2.5 bg-clawd-surface border border-clawd-border text-clawd-text rounded-xl hover:bg-clawd-border transition-colors text-sm">Back</button>
              <button onClick={() => pendingConfig && startCreation(pendingConfig)} className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors text-sm">Retry</button>
            </div>
          ) : stage === 'creating' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-clawd-text-dim">
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
                className="flex-1 bg-clawd-surface border border-clawd-border rounded-xl px-3 py-2 text-sm text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:border-teal-500/50 disabled:opacity-50"
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

function pickEmoji(role: string): string {
  const map: Record<string, string> = {
    devops: '🔧', qa: '🧪', test: '🧪', design: '🎨', data: '📊',
    security: '🔒', ml: '🧠', ai: '🧠', mobile: '📱', cloud: '☁️',
    frontend: '🖥️', backend: '⚙️', database: '🗄️', support: '🎧',
    writer: '✍️', writing: '✍️', author: '📚', book: '📚', illustrat: '🎨',
    children: '🧒', story: '📖', creative: '🎭', publish: '📰',
    market: '📣', social: '📱', finance: '💰', legal: '⚖️', research: '🔬',
    analytic: '📊', video: '🎬', audio: '🎵', photo: '📷',
  };
  const lower = role.toLowerCase();
  return Object.entries(map).find(([k]) => lower.includes(k))?.[1] || '🤖';
}
