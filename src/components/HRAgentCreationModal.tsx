import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, Check, CheckCircle, XCircle, Circle, Sparkles } from 'lucide-react';
import { showToast } from './Toast';
import { useStore } from '../store/store';

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
  role: 'hr' | 'user' | 'system';
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

// HR agent creation conversation stages
type Stage = 'greeting' | 'name' | 'role' | 'style' | 'skills' | 'personality' | 'review' | 'creating' | 'done';

const STAGE_PROMPTS: Record<Stage, string> = {
  greeting: '',
  name: "What should we call this new team member?",
  role: "What will they specialize in? (e.g., DevOps, QA Tester, Designer, Data Analyst...)",
  style: "How should they work? Meticulous and thorough? Fast and pragmatic? Creative and exploratory?",
  skills: "What specific skills do they need? (list a few, e.g., Docker, Kubernetes, CI/CD)",
  personality: "Any personality traits? (e.g., patient, direct, witty, formal) — or I can suggest some based on the role!",
  review: '',
  creating: '',
  done: '',
};

function hrAck(type: 'name' | 'role' | 'style' | 'skills' | 'personality_auto', value: string): string {
  switch (type) {
    case 'name': {
      const picks = [
        `Love it — **${value}** is a great name for an agent.`,
        `**${value}** — nice. That'll stick.`,
        `Perfect. **${value}** has a good ring to it.`,
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }
    case 'role': {
      const picks = [
        `${value} — that's exactly the kind of specialty we need on the team.`,
        `Great focus. A dedicated ${value} will fill a real gap here.`,
        `Solid. ${value} is a high-value role. Let's build them right.`,
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }
    case 'style': {
      const picks = [
        `"${value}" — got it. I'll wire that into how they think and work.`,
        `Perfect framing. That work style will shape everything about them.`,
        `Makes sense. I'll make sure "${value}" comes through in their approach.`,
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }
    case 'skills': {
      const list = value.split(',').map(s => s.trim()).filter(Boolean);
      const preview = list.slice(0, 2).join(', ') + (list.length > 2 ? ` and ${list.length - 2} more` : '');
      const picks = [
        `${preview} — solid core competencies. They'll be sharp.`,
        `Good picks. I'll make sure they're genuinely proficient in all of those.`,
        `${preview} — exactly what this role needs. Locked in.`,
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }
    case 'personality_auto': {
      const picks = [
        `Leave it to me — I'll craft something that fits the role and style perfectly.`,
        `I'll design a personality that makes them feel like a real team member.`,
        `On it. I know exactly what'll work here.`,
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    }
  }
}

const AGENT_COLORS = [
  '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#3F51B5',
  '#009688', '#CDDC39', '#795548', '#607D8B', '#673AB7',
];

function buildSteps(agentId: string, name: string): CreationStep[] {
  return [
    { id: 'workspace',  label: 'Create workspace',         detail: `~/agent-${agentId}/`,                            status: 'pending' },
    { id: 'config_dir', label: 'Set up config directory',  detail: `~/.openclaw/agents/${agentId}/`,                 status: 'pending' },
    { id: 'auth',       label: 'Copy auth profiles',       detail: 'From coder template',                            status: 'pending' },
    { id: 'models',     label: 'Copy model config',        detail: 'Claude + MiniMax fallback',                      status: 'pending' },
    { id: 'db',         label: 'Register in agent database', detail: 'froggo.db agent_registry',                     status: 'pending' },
    { id: 'identity',   label: 'Generate identity files',  detail: 'SOUL.md · IDENTITY.md · MEMORY.md',              status: 'pending' },
    { id: 'openclaw',   label: 'Register in OpenClaw',     detail: 'Add to openclaw.json agents list',               status: 'pending' },
    { id: 'gateway',    label: 'Restart gateway',          detail: 'Apply configuration',                            status: 'pending' },
    { id: 'task',       label: 'Create onboarding task',   detail: `Assign to HR with checklist`,                    status: 'pending' },
  ];
}

export default function HRAgentCreationModal({ onClose, onAgentCreated }: HRAgentCreationModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>('greeting');
  const [isClosing, setIsClosing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [creationSteps, setCreationSteps] = useState<CreationStep[]>([]);
  const [creationDone, setCreationDone] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const [agentData, setAgentData] = useState({
    name: '',
    role: '',
    style: '',
    skills: [] as string[],
    personality: '',
    emoji: '🤖',
    color: AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)],
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollStepsToBottom = useCallback(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { scrollStepsToBottom(); }, [creationSteps, scrollStepsToBottom]);

  useEffect(() => {
    const greetings = [
      "Hey! 🎓 Ready to add someone new to the team? Let's build them together.",
      "I'll walk you through creating a new agent. It'll just take a minute!",
    ];
    const timer = setTimeout(() => {
      addHRMessage(greetings[Math.floor(Math.random() * greetings.length)]);
      setTimeout(() => {
        addHRMessage(STAGE_PROMPTS.name);
        setStage('name');
      }, 800);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const addHRMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'hr', content, timestamp: Date.now() }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
  };

  const simulateTyping = (callback: () => void, delay = 600) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      callback();
    }, delay);
  };

  const handleSend = () => {
    if (!input.trim() || stage === 'creating' || stage === 'done') return;
    const text = input.trim();
    setInput('');
    addUserMessage(text);

    switch (stage) {
      case 'name':       handleName(text);        break;
      case 'role':       handleRole(text);        break;
      case 'style':      handleStyle(text);       break;
      case 'skills':     handleSkills(text);      break;
      case 'personality': handlePersonality(text); break;
      case 'review':     handleReview(text);      break;
    }
  };

  const handleName = (text: string) => {
    const name = text.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    setAgentData(prev => ({ ...prev, name }));
    simulateTyping(() => {
      addHRMessage(hrAck('name', name));
      setTimeout(() => { addHRMessage(STAGE_PROMPTS.role); setStage('role'); }, 500);
    });
  };

  const EMOJI_MAP: Record<string, string> = {
    devops: '🔧', qa: '🧪', test: '🧪', design: '🎨', data: '📊',
    security: '🔒', ml: '🧠', ai: '🧠', mobile: '📱', cloud: '☁️',
    frontend: '🖥️', backend: '⚙️', database: '🗄️', support: '🎧',
    writer: '✍️', writing: '✍️', author: '📚', book: '📚', illustrat: '🎨',
    children: '🧒', story: '📖', creative: '🎭', publish: '📰',
    market: '📣', social: '📱', finance: '💰', legal: '⚖️', research: '🔬',
    analytic: '📊', video: '🎬', audio: '🎵', photo: '📷',
  };

  const emojiForRole = (role: string): string => {
    const lower = role.toLowerCase();
    return Object.entries(EMOJI_MAP).find(([k]) => lower.includes(k))?.[1] || '🤖';
  };

  const handleRole = (text: string) => {
    const emoji = emojiForRole(text);
    setAgentData(prev => ({ ...prev, role: text, emoji }));
    simulateTyping(() => {
      addHRMessage(hrAck('role', text));
      setTimeout(() => { addHRMessage(STAGE_PROMPTS.style); setStage('style'); }, 500);
    });
  };

  const handleStyle = (text: string) => {
    setAgentData(prev => ({ ...prev, style: text }));
    simulateTyping(() => {
      addHRMessage(hrAck('style', text));
      setTimeout(() => { addHRMessage(STAGE_PROMPTS.skills); setStage('skills'); }, 500);
    });
  };

  const handleSkills = (text: string) => {
    const skills = text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    setAgentData(prev => ({ ...prev, skills }));
    simulateTyping(() => {
      addHRMessage(hrAck('skills', text));
      setTimeout(() => { addHRMessage(STAGE_PROMPTS.personality); setStage('personality'); }, 500);
    });
  };

  const handlePersonality = (text: string) => {
    const isAuto = text.toLowerCase().includes('suggest') || text.toLowerCase().includes('you choose') || text.toLowerCase().includes('auto') || text.trim() === '';
    if (isAuto) {
      const personality = `${agentData.style}. Specializes in ${agentData.role}. Reliable and focused.`;
      setAgentData(prev => ({ ...prev, personality }));
      simulateTyping(() => { addHRMessage(hrAck('personality_auto', '')); showReview(); }, 400);
    } else {
      setAgentData(prev => ({ ...prev, personality: text }));
      simulateTyping(() => { addHRMessage("Love it — personality locked in."); showReview(); }, 400);
    }
  };

  const showReview = (data?: typeof agentData) => {
    const d = data || agentData;
    setTimeout(() => {
      setStage('review');
      const reviewText =
        `Here's what I've got:\n\n` +
        `**${d.emoji} ${d.name}**\n` +
        `**Role:** ${d.role}\n` +
        `**Style:** ${d.style}\n` +
        `**Skills:** ${d.skills.join(', ')}\n` +
        `**Personality:** ${d.personality || 'Auto-generated'}\n\n` +
        `Look good? Say **"create"** to bring them to life, or tell me what to change.`;
      addHRMessage(reviewText);
    }, 600);
  };

  const handleReview = (text: string) => {
    const lower = text.toLowerCase();

    // Confirm → create
    if (lower.includes('create') || lower.includes('yes') || lower.includes('go') || lower.includes('looks good') || lower.includes('ship') || lower.includes('do it') || lower.includes('perfect') || lower.includes('good')) {
      createAgent();
      return;
    }

    // Parse "field: new value" format — e.g. "role: Children's book author"
    const fieldMatch = text.match(/^(name|role|style|skills|personality)\s*:\s*(.+)/i);
    if (fieldMatch) {
      const field = fieldMatch[1].toLowerCase();
      const value = fieldMatch[2].trim();
      setAgentData(prev => {
        const updated = { ...prev };
        if (field === 'name')        updated.name = value.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
        if (field === 'role')        { updated.role = value; updated.emoji = emojiForRole(value); }
        if (field === 'style')       updated.style = value;
        if (field === 'skills')      updated.skills = value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        if (field === 'personality') updated.personality = value;
        simulateTyping(() => {
          addHRMessage(`Updated ${field}. Here's the revised summary:`);
          showReview(updated);
        }, 300);
        return updated;
      });
      return;
    }

    // Natural language field detection
    const updates: Partial<typeof agentData> = {};
    if (lower.includes('role') || lower.includes('speciali') || lower.includes('job')) {
      // Extract what comes after role-related words
      const val = text.replace(/.*?(role|speciali[a-z]+|job)[:\s]+/i, '').trim();
      if (val) { updates.role = val; updates.emoji = emojiForRole(val); }
    }
    if (lower.includes('name') || lower.includes('call')) {
      const val = text.replace(/.*?(name|call\s+(?:them|her|him|it))[:\s]+/i, '').trim().replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
      if (val) updates.name = val;
    }
    if (lower.includes('skill') || lower.includes('capabilit')) {
      const val = text.replace(/.*?(skills?|capabilit[a-z]*)[:\s]+/i, '').trim();
      if (val) updates.skills = val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }
    if (lower.includes('personalit') || lower.includes('trait')) {
      const val = text.replace(/.*?(personalit[a-z]*|traits?)[:\s]+/i, '').trim();
      if (val) updates.personality = val;
    }
    if (lower.includes('style') || lower.includes('work') || lower.includes('approach')) {
      const val = text.replace(/.*?(style|work\s+style|approach)[:\s]+/i, '').trim();
      if (val) updates.style = val;
    }

    if (Object.keys(updates).length > 0) {
      setAgentData(prev => {
        const updated = { ...prev, ...updates };
        simulateTyping(() => {
          const fields = Object.keys(updates).join(', ');
          addHRMessage(`Got it — updated ${fields}. Here's the revised summary:`);
          showReview(updated);
        }, 300);
        return updated;
      });
    } else {
      addHRMessage("What would you like to change? You can say something like \"role: Children's Book Author\" or just tell me which field to update.");
    }
  };

  // Update a single step's status
  const updateStep = (id: string, status: CreationStep['status'], errorMsg?: string) => {
    setCreationSteps(prev => prev.map(s => s.id === id ? { ...s, status, errorMsg } : s));
  };

  const runStep = async (id: string, cmd: string): Promise<boolean> => {
    updateStep(id, 'running');
    try {
      const result = await window.clawdbot.exec.run(cmd);
      if (result && typeof result === 'string' && result.toLowerCase().includes('error')) {
        updateStep(id, 'error', result.slice(0, 80));
        return false;
      }
      updateStep(id, 'done');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep(id, 'error', msg.slice(0, 80));
      return false;
    }
  };

  const createAgent = async () => {
    const agentId = agentData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const personality = agentData.personality || `${agentData.style}. Specializes in ${agentData.role}. Focused and reliable.`;
    const steps = buildSteps(agentId, agentData.name);
    setCreationSteps(steps);
    setStage('creating');
    setCreationDone(false);
    setCreationError(null);

    const home = '/Users/worker';
    const agentDir = `${home}/agent-${agentId}`;
    const ocDir = `${home}/.openclaw/agents/${agentId}`;
    const templateDir = `${home}/.openclaw/agents/coder/agent`;

    const soulContent = `# ${agentData.emoji} ${agentData.name} — SOUL

## Identity
You are ${agentData.name}, a ${agentData.role} agent on the Froggo team.

## Work Style
${agentData.style}

## Skills
${agentData.skills.map(s => `- ${s}`).join('\n')}

## Personality
${personality}

## Core Rules
- Always deliver quality work
- Communicate blockers immediately
- Update task status when done
`;

    const identityContent = `# ${agentData.emoji} ${agentData.name}

**Role:** ${agentData.role}
**Agent ID:** ${agentId}
**Status:** Active
`;

    const memoryContent = `# ${agentData.name} Memory

## Key Lessons

## Important Context

## Common Patterns
`;

    const steps_cmds: Array<{ id: string; cmd: string }> = [
      {
        id: 'workspace',
        cmd: `mkdir -p "${agentDir}"`,
      },
      {
        id: 'config_dir',
        cmd: `mkdir -p "${ocDir}/agent" "${ocDir}/sessions"`,
      },
      {
        id: 'auth',
        cmd: `cp "${templateDir}/auth-profiles.json" "${ocDir}/agent/auth-profiles.json"`,
      },
      {
        id: 'models',
        cmd: `cp "${templateDir}/models.json" "${ocDir}/agent/models.json"`,
      },
      {
        id: 'db',
        cmd: `/opt/homebrew/bin/froggo-db agent-onboard --name "${agentId}" --role "${agentData.role}" --emoji "${agentData.emoji}" --capabilities "${agentData.skills.join(',')}"`,
      },
      {
        id: 'identity',
        cmd: [
          `cat > "${agentDir}/SOUL.md" << 'HEREDOC'\n${soulContent}\nHEREDOC`,
          `cat > "${agentDir}/IDENTITY.md" << 'HEREDOC'\n${identityContent}\nHEREDOC`,
          `cat > "${agentDir}/MEMORY.md" << 'HEREDOC'\n${memoryContent}\nHEREDOC`,
        ].join(' && '),
      },
      {
        id: 'openclaw',
        cmd: `python3 -c "
import json
path = '${home}/.openclaw/openclaw.json'
with open(path) as f: cfg = json.load(f)
if not any(a['id'] == '${agentId}' for a in cfg['agents']['list']):
    cfg['agents']['list'].append({'id': '${agentId}', 'workspace': '${agentDir}'})
    with open(path, 'w') as f: json.dump(cfg, f, indent=2)
print('ok')
"`,
      },
      {
        id: 'gateway',
        cmd: `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway && sleep 1`,
      },
      {
        id: 'task',
        cmd: `/opt/homebrew/bin/froggo-db task-add "Onboard ${agentData.name}" --assign hr --status todo --description "Complete onboarding for new agent: ${agentData.name} (${agentData.role})"`,
      },
    ];

    let failed = false;
    for (const { id, cmd } of steps_cmds) {
      const ok = await runStep(id, cmd);
      if (!ok) {
        failed = true;
        // Mark remaining steps as pending (leave them gray)
        break;
      }
    }

    if (failed) {
      setCreationError('One or more steps failed. Check the steps above for details.');
    } else {
      // Refresh agent list
      useStore.getState().fetchAgents();
      onAgentCreated?.({
        id: agentId,
        name: agentData.name,
        emoji: agentData.emoji,
        role: agentData.role,
        color: agentData.color,
        capabilities: agentData.skills,
        personality,
      });
      showToast(`${agentData.emoji} ${agentData.name} created!`, 'success');
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const doneCount = creationSteps.filter(s => s.status === 'done').length;
  const totalSteps = creationSteps.length;
  const progressPct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default"
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        type="button"
        aria-label="Close agent creation"
      />
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
          {/* Stage dots (questionnaire only) */}
          {stage !== 'creating' && stage !== 'done' && (
            <div className="flex gap-1">
              {(['name', 'role', 'style', 'skills', 'personality', 'review'] as Stage[]).map((s, i) => (
                <div key={s} className={`w-2 h-2 rounded-full transition-colors ${
                  stage === s ? 'bg-teal-400' :
                  (['name', 'role', 'style', 'skills', 'personality', 'review'].indexOf(stage) > i)
                    ? 'bg-teal-400/40' : 'bg-clawd-border'
                }`} title={s} />
              ))}
            </div>
          )}
          <button onClick={handleClose} className="p-1 text-clawd-text-dim hover:text-clawd-text rounded-lg hover:bg-clawd-surface transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Creating stage — step progress view */}
        {stage === 'creating' && (
          <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">

            {/* Agent being created */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl">
                {agentData.emoji}
              </div>
              <div>
                <div className="font-semibold text-clawd-text">{agentData.name}</div>
                <div className="text-xs text-clawd-text-dim">{agentData.role}</div>
              </div>
              {!creationDone && !creationError && (
                <Loader2 size={16} className="ml-auto text-teal-400 animate-spin" />
              )}
              {creationDone && (
                <Sparkles size={18} className="ml-auto text-teal-400" />
              )}
            </div>

            {/* Progress bar */}
            {totalSteps > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-clawd-text-dim mb-1">
                  <span>{doneCount}/{totalSteps} steps</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-clawd-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${creationError ? 'bg-error' : 'bg-teal-400'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="space-y-2">
              {creationSteps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                    step.status === 'running' ? 'bg-teal-500/5 border-teal-500/30' :
                    step.status === 'done'    ? 'bg-success-subtle border-success-border' :
                    step.status === 'error'   ? 'bg-error-subtle border-error-border' :
                    'bg-clawd-surface/50 border-clawd-border'
                  }`}
                >
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
                    }`}>
                      {step.label}
                    </div>
                    {step.errorMsg ? (
                      <div className="text-xs text-error mt-0.5 font-mono truncate">{step.errorMsg}</div>
                    ) : (
                      <div className="text-xs text-clawd-text-dim mt-0.5">{step.detail}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Done banner */}
            {creationDone && (
              <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl text-center">
                <div className="text-2xl mb-1">{agentData.emoji}</div>
                <div className="font-semibold text-teal-400">{agentData.name} is live!</div>
                <div className="text-xs text-clawd-text-dim mt-1">Find them in the Agents panel</div>
              </div>
            )}

            {/* Error banner */}
            {creationError && (
              <div className="mt-4 p-3 bg-error-subtle border border-error-border rounded-xl">
                <div className="text-sm text-error font-medium">Onboarding failed</div>
                <div className="text-xs text-clawd-text-dim mt-1">{creationError}</div>
              </div>
            )}

            <div ref={stepsEndRef} />
          </div>
        )}

        {/* Chat view (questionnaire stages) */}
        {stage !== 'creating' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'hr' && (
                  <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-0.5">🎓</div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-info-subtle text-info rounded-br-md'
                    : msg.role === 'system'
                      ? 'bg-clawd-surface text-clawd-text-dim italic text-xs'
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
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-sm mr-2">🎓</div>
                <div className="bg-clawd-surface px-4 py-2 rounded-xl">
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
          {(stage === 'creating' && creationDone) ? (
            <button
              onClick={handleClose}
              className="w-full py-2.5 bg-teal-500 text-white font-medium rounded-xl hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} /> Done — View Agents
            </button>
          ) : (stage === 'creating' && creationError) ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setStage('review'); setCreationSteps([]); setCreationError(null); }}
                className="flex-1 py-2.5 bg-clawd-surface border border-clawd-border text-clawd-text rounded-xl hover:bg-clawd-border transition-colors text-sm"
              >
                Back to Review
              </button>
              <button
                onClick={createAgent}
                className="flex-1 py-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors text-sm"
              >
                Retry
              </button>
            </div>
          ) : stage === 'creating' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-clawd-text-dim">
              <Loader2 size={14} className="animate-spin text-teal-400" />
              Launching {agentData.name}...
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                className="flex-1 bg-clawd-surface border border-clawd-border rounded-xl px-3 py-2 text-sm text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:border-teal-500/50"
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
