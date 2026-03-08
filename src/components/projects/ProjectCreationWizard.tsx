'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Check, CheckCircle, XCircle, Circle, Loader2, Bot } from 'lucide-react';
import { projectsApi, agentApi } from '../../lib/api';
import type { Project } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';
import { PROJECT_ICON_OPTIONS, getProjectIcon } from './projectIcons';

const MC_SYSTEM = `You are Mission Control, helping set up a new project in the Mission Control platform.
Keep responses brief and conversational — 1-2 sentences max. Be warm and direct.
You are guiding the user through: project name → goal → identity (icon/colour) → team agents → confirmation.
Do not ask for multiple things at once. Respond naturally to what the user said.`;

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#f43f5e',
];

type Phase = 'name' | 'goal' | 'identity' | 'agents' | 'confirm' | 'creating' | 'done';

interface ChatMsg {
  id: string;
  from: 'mc' | 'user';
  text: string;
  widget?: 'identity' | 'agents' | 'confirm';
}

interface SetupStep {
  id: string;
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'done' | 'error';
  errorMsg?: string;
}

interface Agent { id: string; name: string; emoji?: string; status: string; role?: string }

interface Props { onClose: () => void; onCreated: (project: Project) => void; }

// Mission Control avatar
function MCAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center flex-shrink-0">
      <Bot size={14} className="text-mission-control-accent" />
    </div>
  );
}

export default function ProjectCreationWizard({ onClose, onCreated }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [phase, setPhase] = useState<Phase>('name');
  const [input, setInput] = useState('');
  const [mcTyping, setMcTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Collected fields
  const [projName, setProjName]   = useState('');
  const [projGoal, setProjGoal]   = useState('');
  const [iconId, setIconId]       = useState('folder');
  const [color, setColor]         = useState('#6366f1');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Agents list
  const [agents, setAgents]       = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Creation
  const [steps, setSteps]         = useState<SetupStep[]>([]);
  const [created, setCreated]     = useState<Project | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Conversation history for Mission Control agent
  const conversationRef = useRef<{ role: string; content: string }[]>([]);

  const uid = () => `${Date.now()}-${Math.random()}`;

  const addMsg = (msg: Omit<ChatMsg, 'id'>) =>
    setMsgs(prev => [...prev, { id: uid(), ...msg }]);

  const mcSay = (text: string, widget?: ChatMsg['widget']) =>
    addMsg({ from: 'mc', text, widget });

  // Call the Mission Control agent and show its response.
  // minDelay guarantees the typing dots are always visible for at least 600ms,
  // even if the API responds (or fails) faster than React can commit a render.
  const mcAsk = async (userMessage: string, widget?: ChatMsg['widget'], fallback?: string): Promise<void> => {
    setMcTyping(true);
    const minDelay = new Promise<void>(r => setTimeout(r, 600));
    let reply = fallback || 'Got it.';
    try {
      const history = conversationRef.current.map(m => `${m.role}: ${m.content}`).join('\n');
      const prompt = `${MC_SYSTEM}\n\n${history}${userMessage ? `\nuser: ${userMessage}` : ''}`;

      const [res] = await Promise.all([
        fetch('/api/agents/mission-control/project-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, sessionKey: 'wizard-project-creation' }),
        }),
        minDelay,
      ]);
      const data = await res.json();
      if (data.response) reply = data.response;
    } catch {
      await minDelay;
    }
    conversationRef.current.push({ role: 'assistant', content: reply });
    setMcTyping(false);
    addMsg({ from: 'mc', text: reply, widget });
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, mcTyping]);

  // Kick off conversation — ref guard prevents React Strict Mode double-invoke
  const initCalledRef = useRef(false);
  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    mcAsk('', undefined, "Hey, let's set up your new project. What should we call it?");
  }, []);

  // Load agents when entering agents phase
  useEffect(() => {
    if (phase === 'agents' && agents.length === 0) {
      setLoadingAgents(true);
      agentApi.getAll()
        .then((data: Agent[]) => setAgents(data.filter((a: Agent) => a.status !== 'archived')))
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, [phase]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || mcTyping || (phase !== 'name' && phase !== 'goal')) return;
    setInput('');
    addMsg({ from: 'user', text });
    conversationRef.current.push({ role: 'user', content: text });

    if (phase === 'name') {
      setProjName(text);
      setPhase('goal');
      await mcAsk(text, undefined, `${text} — great name. What's the goal? What does a successful project look like?`);
    } else if (phase === 'goal') {
      setProjGoal(text);
      setPhase('identity');
      await mcAsk(text, 'identity', "Got it. Now pick an icon and colour to make it easy to spot:");
    }
  };

  const handleIdentityConfirm = async () => {
    addMsg({ from: 'user', text: 'Icon and colour selected' });
    conversationRef.current.push({ role: 'user', content: 'I selected an icon and colour.' });
    setPhase('agents');
    await mcAsk('I selected an icon and colour.', 'agents', "Nice. Who's working on this project? Select your team:");
  };

  const handleAgentsConfirm = async () => {
    const names = agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name);
    const userText = names.length > 0 ? `Team: ${names.join(', ')}` : 'No agents yet';
    addMsg({ from: 'user', text: userText });
    conversationRef.current.push({ role: 'user', content: userText });
    setPhase('confirm');
    await mcAsk(userText, 'confirm', "Here's what I'll set up:");
  };

  const handleConfirm = () => {
    setPhase('creating');
    runSetup();
  };

  const updateStep = (id: string, status: SetupStep['status'], errorMsg?: string) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, errorMsg } : s));

  const runStep = async (id: string, fn: () => Promise<void>): Promise<boolean> => {
    updateStep(id, 'running');
    try { await fn(); updateStep(id, 'done'); return true; }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep(id, 'error', msg.slice(0, 80));
      return false;
    }
  };

  const runSetup = async () => {
    const initialSteps: SetupStep[] = [
      { id: 'create',    label: 'Create project',          detail: 'Register in database',            status: 'pending' },
      { id: 'workspace', label: 'Set up workspace files',  detail: '~/mission-control/projects/{id}/', status: 'pending' },
      { id: 'notify',    label: 'Brief Mission Control',   detail: 'Log project to task board',        status: 'pending' },
    ];
    setSteps(initialSteps);
    setCreateError(null);

    let project: Project | null = null;

    const ok1 = await runStep('create', async () => {
      project = await projectsApi.create({
        name: projName,
        goal: projGoal || undefined,
        emoji: iconId,
        color,
        memberAgentIds: selectedAgents,
      });
      setCreated(project);
    });
    if (!ok1 || !project) { setCreateError('Failed to create project.'); return; }

    const ok2 = await runStep('workspace', async () => {
      const id = (project as Project).id;
      const goalMd = `# Goal\n\n${projGoal || projName}\n\n## Definition of Done\n\n_Fill in your success criteria here._\n`;
      const contextMd = `# ${projName}\n\n## Overview\n\n${projGoal || ''}\n\n## Agents\n\n${
        selectedAgents.map(aid => `- ${aid}`).join('\n') || '_No agents assigned yet._'
      }\n\n## Status\n\n🟡 In progress\n`;
      await Promise.all([
        projectsApi.uploadFile(id, 'GOAL.md', goalMd),
        projectsApi.uploadFile(id, 'CONTEXT.md', contextMd),
        projectsApi.uploadFile(id, 'STATUS.md', '# Status\n\n🟡 Project initialised — work not started.\n'),
      ]);
    });
    if (!ok2) { setCreateError('Workspace setup failed.'); return; }

    await runStep('notify', async () => {
      // Post a task for Mission Control to acknowledge the new project
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `New project ready: ${projName}`,
          description: `Project "${projName}" has been created. Goal: ${projGoal || 'N/A'}. Assigned agents: ${selectedAgents.join(', ') || 'none'}.`,
          assigned_to: 'mission-control',
          priority: 'medium',
          status: 'todo',
        }),
      });
    });

    setPhase('done');
  };

  const SelectedIconComp = getProjectIcon(iconId);

  // Identity widget rendered inline in chat
  function IdentityWidget() {
    return (
      <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-border rounded-xl space-y-3">
        {/* Preview */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
            <SelectedIconComp size={20} style={{ color }} />
          </div>
          <span className="font-medium text-sm text-mission-control-text">{projName}</span>
        </div>
        {/* Icon grid */}
        <div>
          <p className="text-xs text-mission-control-text-dim mb-2">Icon</p>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_ICON_OPTIONS.map(({ id, icon: Ic }) => (
              <button key={id} onClick={() => setIconId(id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  iconId === id ? 'ring-2 ring-mission-control-accent bg-mission-control-accent/20' : 'bg-mission-control-bg hover:bg-mission-control-accent/10'
                }`}>
                <Ic size={14} className={iconId === id ? 'text-mission-control-accent' : 'text-mission-control-text-dim'} />
              </button>
            ))}
          </div>
        </div>
        {/* Color swatches */}
        <div>
          <p className="text-xs text-mission-control-text-dim mb-2">Colour</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-mission-control-surface ring-white scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <button onClick={handleIdentityConfirm}
          className="w-full py-2 bg-mission-control-accent text-white text-sm rounded-lg hover:bg-mission-control-accent/90 transition-colors font-medium">
          Looks good →
        </button>
      </div>
    );
  }

  // Agent picker widget
  function AgentsWidget() {
    return (
      <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-border rounded-xl space-y-2">
        {loadingAgents ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-mission-control-text-dim" /></div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {agents.map(agent => {
              const sel = selectedAgents.includes(agent.id);
              return (
                <button key={agent.id} onClick={() => setSelectedAgents(prev => sel ? prev.filter(x => x !== agent.id) : [...prev, agent.id])}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all text-left ${
                    sel ? 'border-mission-control-accent/50 bg-mission-control-accent/10' : 'border-mission-control-border hover:border-mission-control-accent/30'
                  }`}>
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
          </div>
        )}
        <button onClick={handleAgentsConfirm}
          className="w-full py-2 bg-mission-control-accent text-white text-sm rounded-lg hover:bg-mission-control-accent/90 transition-colors font-medium mt-1">
          {selectedAgents.length > 0 ? `Add ${selectedAgents.length} agent${selectedAgents.length !== 1 ? 's' : ''} →` : 'Skip →'}
        </button>
      </div>
    );
  }

  // Summary confirm widget
  function ConfirmWidget() {
    return (
      <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-border rounded-xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
            <SelectedIconComp size={20} style={{ color }} />
          </div>
          <div>
            <div className="font-semibold text-mission-control-text">{projName}</div>
            {projGoal && <div className="text-xs text-mission-control-text-dim mt-0.5 line-clamp-2">{projGoal}</div>}
          </div>
        </div>
        {selectedAgents.length > 0 && (
          <div className="text-xs text-mission-control-text-dim">
            Team: {agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name).join(', ')}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleConfirm}
            className="flex-1 py-2 bg-mission-control-accent text-white text-sm rounded-lg hover:bg-mission-control-accent/90 transition-colors font-medium flex items-center justify-center gap-1.5">
            <Check size={14} /> Create project
          </button>
          <button onClick={() => { setPhase('name'); setMsgs([]); mcSay("Let's start over. What should we call the project?"); }}
            className="px-3 py-2 bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim text-sm rounded-lg hover:bg-mission-control-surface transition-colors">
            Start over
          </button>
        </div>
      </div>
    );
  }

  const showInput = phase === 'name' || phase === 'goal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-mission-control-border">
          <div className="w-8 h-8 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center">
            <Bot size={16} className="text-mission-control-accent" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-mission-control-text">New Project Setup</div>
          </div>
          {phase !== 'creating' && (
            <button onClick={onClose} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Chat area */}
        {phase !== 'creating' && phase !== 'done' && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
            {msgs.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
                {msg.from === 'mc' && <MCAvatar />}
                <div className={`max-w-[82%] ${msg.from === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div className={`px-3 py-2 rounded-xl text-sm ${
                    msg.from === 'user'
                      ? 'bg-mission-control-accent text-white rounded-br-sm'
                      : 'bg-mission-control-surface text-mission-control-text rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  {/* Inline widgets */}
                  {msg.widget === 'identity' && phase === 'identity' && <IdentityWidget />}
                  {msg.widget === 'agents'   && phase === 'agents'   && <AgentsWidget />}
                  {msg.widget === 'confirm'  && phase === 'confirm'  && <ConfirmWidget />}
                </div>
              </div>
            ))}

            {mcTyping && (
              <div className="flex gap-2 items-start">
                <MCAvatar />
                <div className="bg-mission-control-surface px-4 py-3 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Creating stage */}
        {phase === 'creating' && (
          <div className="flex-1 overflow-y-auto p-4 min-h-[280px]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
                <SelectedIconComp size={20} style={{ color }} />
              </div>
              <div>
                <div className="font-semibold text-mission-control-text">{projName}</div>
                <div className="text-xs text-mission-control-text-dim">Setting up your project...</div>
              </div>
              {!createError && <Loader2 size={16} className="ml-auto text-mission-control-accent animate-spin" />}
            </div>

            <div className="space-y-2">
              {steps.map(s => (
                <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  s.status === 'running' ? 'bg-mission-control-accent/5 border-mission-control-accent/30' :
                  s.status === 'done'    ? 'bg-green-500/5 border-green-500/20' :
                  s.status === 'error'   ? 'bg-red-500/5 border-red-500/20' :
                  'bg-mission-control-surface border-mission-control-border'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {s.status === 'running' && <Loader2 size={16} className="text-mission-control-accent animate-spin" />}
                    {s.status === 'done'    && <CheckCircle size={16} className="text-green-400" />}
                    {s.status === 'error'   && <XCircle size={16} className="text-red-400" />}
                    {s.status === 'pending' && <Circle size={16} className="text-mission-control-border" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${
                      s.status === 'done' ? 'text-green-400' : s.status === 'error' ? 'text-red-400' :
                      s.status === 'running' ? 'text-mission-control-accent' : 'text-mission-control-text-dim'
                    }`}>{s.label}</div>
                    <div className="text-xs text-mission-control-text-dim mt-0.5">{s.errorMsg || s.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {createError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="text-sm text-red-400 font-medium">Setup failed</div>
                <div className="text-xs text-mission-control-text-dim mt-1">{createError}</div>
              </div>
            )}
          </div>
        )}

        {/* Done stage */}
        {phase === 'done' && created && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
              <SelectedIconComp size={28} style={{ color }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-mission-control-text">{created.name} is live!</p>
              <p className="text-xs text-mission-control-text-dim mt-1">
                Workspace files created · {selectedAgents.length > 0 ? `${selectedAgents.length} agent${selectedAgents.length !== 1 ? 's' : ''} assigned` : 'Ready to assign agents'}
              </p>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="p-3 border-t border-mission-control-border">
          {phase === 'done' && created ? (
            <div className="flex gap-2">
              <button onClick={() => onCreated(created)}
                className="flex-1 py-2.5 bg-mission-control-accent text-white text-sm font-medium rounded-xl hover:bg-mission-control-accent/90 transition-colors flex items-center justify-center gap-2">
                <Check size={15} /> Open Project
              </button>
              <button onClick={onClose}
                className="px-4 py-2.5 border border-mission-control-border text-mission-control-text-dim text-sm rounded-xl hover:bg-mission-control-surface transition-colors">
                Close
              </button>
            </div>
          ) : phase === 'creating' && createError ? (
            <div className="flex gap-2">
              <button onClick={() => { setPhase('confirm'); setSteps([]); setCreateError(null); setMsgs(prev => [...prev.slice(0, -1)]); mcSay("Let me show the summary again.", 'confirm'); }}
                className="flex-1 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">Retry</button>
            </div>
          ) : phase === 'creating' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-mission-control-text-dim">
              <Loader2 size={14} className="animate-spin text-mission-control-accent" />
              Mission Control is setting up your workspace...
            </div>
          ) : showInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={mcTyping}
                placeholder={phase === 'name' ? 'Project name...' : 'Describe the goal...'}
                className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-xl px-3 py-2 text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 disabled:opacity-50"
                autoFocus
              />
              <button onClick={handleSend} disabled={!input.trim() || mcTyping}
                className="p-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <Send size={18} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

