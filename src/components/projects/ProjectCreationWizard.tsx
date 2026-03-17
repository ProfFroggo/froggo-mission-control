'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Check, CheckCircle, XCircle, Circle, Loader2, Bot, LayoutTemplate, Upload, Trash2, Sparkles, GitBranch, Zap, Paperclip, ExternalLink, Image as ImageIcon, FileText as FileTextIcon } from 'lucide-react';
import { projectsApi, agentApi } from '../../lib/api';
import type { Project } from '../../types/projects';
import AgentAvatar from '../AgentAvatar';
import { PROJECT_ICON_OPTIONS, getProjectIcon } from './projectIcons';
import { PROJECT_TEMPLATES } from '../../lib/projectTemplates';

const MC_SYSTEM = `You are Mission Control, helping set up a new project in the Mission Control platform.
Keep responses brief and conversational — 1-2 sentences max. Be warm and direct.
You are guiding the user through: project name → goal → identity (icon/colour) → team agents → confirmation.
Do not ask for multiple things at once. Respond naturally to what the user said.`;

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#f43f5e',
];

type Phase = 'discovery' | 'template' | 'name' | 'goal' | 'identity' | 'agents' | 'context-files' | 'confirm' | 'creating' | 'done';

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

// GSD inline choice widget
interface ChoiceWidgetData { q?: string; options: string[] }
function ChoicesWidget({ data, onChoose, disabled }: { data: ChoiceWidgetData; onChoose: (text: string) => void; disabled?: boolean }) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const isOtherOption = (opt: string) => /^(other|tell me|explain|custom|something else|different|describe)/i.test(opt.trim());

  if (customMode) {
    return (
      <div className="flex gap-2 mt-2 pl-9">
        <input
          autoFocus
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && customText.trim() && !disabled) { onChoose(customText.trim()); setCustomMode(false); setCustomText(''); } }}
          placeholder="Type your answer..."
          disabled={disabled}
          className="flex-1 px-3 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-1 focus:ring-mission-control-accent disabled:opacity-50"
        />
        <button
          onClick={() => { if (customText.trim() && !disabled) { onChoose(customText.trim()); setCustomMode(false); setCustomText(''); } }}
          disabled={!customText.trim() || disabled}
          className="px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-sm hover:bg-mission-control-accent/90 disabled:opacity-40 flex-shrink-0 transition-colors"
        >
          <Send size={13} />
        </button>
        <button onClick={() => { setCustomMode(false); setCustomText(''); }} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text transition-colors">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 pl-9 space-y-2">
      {data.q && <p className="text-xs text-mission-control-text-dim font-medium">{data.q}</p>}
      <div className="flex flex-wrap gap-2">
        {data.options.map((opt, i) => {
          const isOther = isOtherOption(opt);
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => isOther ? setCustomMode(true) : onChoose(opt)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-all disabled:opacity-40 ${
                isOther
                  ? 'border-mission-control-border text-mission-control-text-dim hover:border-mission-control-text/50 hover:text-mission-control-text'
                  : 'border-mission-control-accent/40 bg-mission-control-accent/10 text-mission-control-text hover:bg-mission-control-accent/20 hover:border-mission-control-accent font-medium'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [phase, setPhase] = useState<Phase>('discovery');
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

  // Discovery phase state (AI wizard chat)
  interface DiscoveryMsg { role: 'user' | 'model'; text: string; widget?: string; widgetData?: ChoiceWidgetData; }
  const [discoveryMsgs, setDiscoveryMsgs] = useState<DiscoveryMsg[]>([]);
  const [discoveryInput, setDiscoveryInput] = useState('');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const [discoveryStructuredData, setDiscoveryStructuredData] = useState<{ name?: string; goal?: string; description?: string } | null>(null);
  const discoveryScrollRef = useRef<HTMLDivElement>(null);
  const discoveryInitRef = useRef(false);

  // GSD mode
  const [gsdMode, setGsdMode] = useState(false);
  interface GsdDocs { projectMd: string; requirementsMd: string; roadmapMd: string; }
  const [gsdDocs, setGsdDocs] = useState<GsdDocs | null>(null);

  // Discovery context refs (files + URLs to inform the plan)
  interface DiscoveryRef { type: 'file' | 'url'; name: string; file?: File; url?: string; }
  const [discoveryRefs, setDiscoveryRefs] = useState<DiscoveryRef[]>([]);
  const [refUrlInput, setRefUrlInput] = useState('');
  const [showRefUrlInput, setShowRefUrlInput] = useState(false);
  const [refsDragging, setRefsDragging] = useState(false);
  const discoveryFileInputRef = useRef<HTMLInputElement>(null);
  const mentionedRefsRef = useRef<Set<string>>(new Set());

  // Context files (staged for upload after project creation)
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [contextFilesDragging, setContextFilesDragging] = useState(false);
  const contextFilesInputRef = useRef<HTMLInputElement>(null);

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

  // Kick off conversation when we enter the 'name' phase (after template selection)
  const initCalledRef = useRef(false);
  useEffect(() => {
    if (phase !== 'name') return;
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    mcAsk('', undefined, projName
      ? `Great — using the "${projName}" template. You can keep that name or change it below:`
      : "Let's set up your new project. What should we call it?");
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (newGsd: boolean) => {
    setGsdMode(newGsd);
    setDiscoveryReady(false);
    setDiscoveryStructuredData(null);
    setGsdDocs(null);
    setDiscoveryInput('');
    mentionedRefsRef.current = new Set();
    const openingMsg = newGsd
      ? "Let's plan this properly. Tell me about the project — what are you trying to build and why does it need to exist?"
      : "Tell me about this project. What are you building or trying to achieve?";
    setDiscoveryMsgs([{ role: 'model', text: openingMsg }]);
  };

  // Discovery phase: send initial AI message + preload agents on mount
  useEffect(() => {
    if (discoveryInitRef.current) return;
    discoveryInitRef.current = true;
    setDiscoveryMsgs([{ role: 'model', text: "Tell me about this project. What are you building or trying to achieve?" }]);
    // Preload agents so the widget is ready when AI asks about team
    if (agents.length === 0) {
      setLoadingAgents(true);
      agentApi.getAll()
        .then((data: unknown[]) => setAgents((data as Agent[]).filter(a => a.status !== 'archived')))
        .catch(() => {})
        .finally(() => setLoadingAgents(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll discovery chat to bottom
  useEffect(() => {
    discoveryScrollRef.current?.scrollTo({ top: discoveryScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [discoveryMsgs, discoveryLoading]);

  const sendDiscoveryMessage = async (text: string, baseOverride?: DiscoveryMsg[], modeOverride?: boolean) => {
    const base = baseOverride ?? discoveryMsgs;
    const isGsd = modeOverride !== undefined ? modeOverride : gsdMode;

    // Append unmentioned context refs to this message
    const unmentioned = discoveryRefs.filter(r => !mentionedRefsRef.current.has(r.name));
    let fullText = text;
    if (unmentioned.length > 0) {
      const refLines = unmentioned.map(r => r.type === 'url' ? `URL: ${r.url}` : `File: ${r.name}`).join(', ');
      fullText = `${text}\n\n[Reference context provided: ${refLines}]`;
      unmentioned.forEach(r => mentionedRefsRef.current.add(r.name));
    }

    const newUserMsg: DiscoveryMsg = { role: 'user', text };
    const newMsgs = [...base, newUserMsg];
    setDiscoveryMsgs(newMsgs);
    setDiscoveryLoading(true);
    try {
      // Send full text (with refs) to API but display clean text in UI
      const apiMsgs = [...base.map(m => ({ role: m.role, text: m.text })), { role: 'user' as const, text: fullText }];
      const res = await fetch('/api/projects/wizard-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMsgs, mode: isGsd ? 'gsd' : 'quick' }),
      });
      const data = await res.json();
      const aiMsg: DiscoveryMsg = {
        role: 'model',
        text: data.text || '',
        widget: data.widget,
        widgetData: data.widgetData as ChoiceWidgetData | undefined,
      };
      setDiscoveryMsgs(prev => [...prev, aiMsg]);
      if (data.ready && data.isGsd && data.gsdData) {
        setDiscoveryReady(true);
        setGsdDocs({ projectMd: data.gsdData.projectMd || '', requirementsMd: data.gsdData.requirementsMd || '', roadmapMd: data.gsdData.roadmapMd || '' });
        setDiscoveryStructuredData({ name: data.gsdData.name, goal: data.gsdData.goal, description: data.gsdData.description });
      } else if (data.ready && data.structuredData) {
        setDiscoveryReady(true);
        setDiscoveryStructuredData(data.structuredData);
      }
    } catch { /* non-critical */ }
    finally { setDiscoveryLoading(false); }
  };

  const handleDiscoverySend = async () => {
    const text = discoveryInput.trim();
    if (!text || discoveryLoading) return;
    setDiscoveryInput('');
    await sendDiscoveryMessage(text);
  };

  const handleDiscoveryConfirm = () => {
    if (discoveryStructuredData?.name) setProjName(discoveryStructuredData.name);
    if (discoveryStructuredData?.goal) setProjGoal(discoveryStructuredData.goal);
    // GSD mode: skip template/name/goal — we already have everything — go straight to identity
    setPhase(gsdMode ? 'identity' : 'template');
  };

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
    setPhase('context-files');
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
    const hasContextFiles = stagedFiles.length > 0;
    const hasGsdDocs = gsdDocs !== null;
    const initialSteps: SetupStep[] = [
      { id: 'create',    label: 'Create project',          detail: 'Register in database',            status: 'pending' },
      { id: 'workspace', label: 'Set up workspace files',  detail: '~/mission-control/projects/{id}/', status: 'pending' },
      ...(hasGsdDocs ? [{ id: 'gsd-plan', label: 'Save GSD plan', detail: 'PROJECT.md + REQUIREMENTS.md + ROADMAP.md', status: 'pending' as const }] : []),
      ...(hasContextFiles ? [{ id: 'context', label: 'Upload context files', detail: `${stagedFiles.length} file(s)`, status: 'pending' as const }] : []),
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
      }\n\n## Status\n\nProject initialised — work not started.\n`;
      await Promise.all([
        projectsApi.uploadFile(id, 'GOAL.md', goalMd),
        projectsApi.uploadFile(id, 'CONTEXT.md', contextMd),
        projectsApi.uploadFile(id, 'STATUS.md', '# Status\n\nProject initialised — work not started.\n'),
      ]);
    });
    if (!ok2) { setCreateError('Workspace setup failed.'); return; }

    // Save GSD planning docs if generated
    if (hasGsdDocs && gsdDocs && project) {
      await runStep('gsd-plan', async () => {
        const projectId = (project as Project).id;
        const saveDoc = async (filename: string, content: string) => {
          const blob = new Blob([content], { type: 'text/markdown' });
          const file = new File([blob], filename, { type: 'text/markdown' });
          const formData = new FormData();
          formData.append('file', file);
          formData.append('entityType', 'project');
          formData.append('entityId', projectId);
          await fetch('/api/context-files/upload', { method: 'POST', body: formData });
        };
        await saveDoc('GSD-PROJECT.md', gsdDocs.projectMd);
        await saveDoc('GSD-REQUIREMENTS.md', gsdDocs.requirementsMd);
        await saveDoc('GSD-ROADMAP.md', gsdDocs.roadmapMd);
        // Agent guide — auto-injected into every agent session for this project
        const agentGuide = `# GSD Agent Guide — ${projName}\n\nThis project uses GSD (Get Shit Done) structured planning.\n\n## Planning Files\n- **GSD-PROJECT.md** — Project context, core value, requirements, constraints. Read first.\n- **GSD-REQUIREMENTS.md** — Scoped v1 requirements.\n- **GSD-ROADMAP.md** — Phase execution plan. Your primary navigation tool.\n\n## Workflow\n1. Call \`context_files_get\` at session start to read all GSD files\n2. Find the next unchecked phase in GSD-ROADMAP.md: \`- [ ] Phase N: Name\`\n3. Read the phase Goal and Success Criteria before starting\n4. Work through the phase; mark tasks done: \`- [x] task\`\n5. When all criteria are met, mark phase complete: \`- [x] Phase N: Name\`\n6. Add new requirements to GSD-REQUIREMENTS.md as you discover them\n\n## Rules\n- One phase at a time — complete before moving forward\n- Success Criteria are verifiable — only mark done when truly met\n- Keep planning files current — they must reflect reality\n- Core Value in PROJECT.md drives all trade-off decisions\n- Urgent mid-phase work → insert as decimal phase (e.g. Phase 2.1)\n\n## Project Summary\n${gsdDocs.projectMd.slice(0, 600)}\n`;
        await saveDoc('GSD-AGENT-GUIDE.md', agentGuide);
        // Also upload any reference files collected during discovery
        for (const ref of discoveryRefs) {
          if (ref.type === 'file' && ref.file) {
            const formData = new FormData();
            formData.append('file', ref.file);
            formData.append('entityType', 'project');
            formData.append('entityId', projectId);
            await fetch('/api/context-files/upload', { method: 'POST', body: formData });
          }
        }
      });
    }

    // Upload context files if any were staged
    if (hasContextFiles && project) {
      await runStep('context', async () => {
        const projectId = (project as Project).id;
        for (const file of stagedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('entityType', 'project');
          formData.append('entityId', projectId);
          await fetch('/api/context-files/upload', { method: 'POST', body: formData });
        }
      });
    }

    await runStep('notify', async () => {
      // no-op — project creation no longer auto-creates a task
    });

    setPhase('done');
  };

  const SelectedIconComp = getProjectIcon(iconId);

  // Identity widget rendered inline in chat
  function IdentityWidget() {
    return (
      <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-border rounded-lg space-y-3">
        {/* Preview */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
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
      <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-border rounded-lg space-y-2">
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
      <div className="mt-2 p-3 bg-mission-control-surface border border-mission-control-border rounded-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
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

  // ── Discovery phase (AI conversation) ─────────────────────────────────────
  if (phase === 'discovery') {
    const activeWidget = (() => {
      if (discoveryLoading || discoveryReady) return null;
      const last = discoveryMsgs[discoveryMsgs.length - 1];
      return (last?.role === 'model' && last.widget) ? last.widget : null;
    })();
    const activeWidgetData = (() => {
      if (discoveryLoading || discoveryReady) return null;
      const last = discoveryMsgs[discoveryMsgs.length - 1];
      return (last?.role === 'model' && last.widgetData) ? last.widgetData : null;
    })();

    const addRefUrl = () => {
      const url = refUrlInput.trim();
      if (!url) return;
      const label = url.replace(/^https?:\/\//, '').split('/')[0];
      setDiscoveryRefs(prev => [...prev, { type: 'url', name: label, url }]);
      setRefUrlInput('');
      setShowRefUrlInput(false);
    };

    const addRefFiles = (files: FileList | null) => {
      if (!files) return;
      const newRefs: DiscoveryRef[] = Array.from(files).map(f => ({ type: 'file', name: f.name, file: f }));
      setDiscoveryRefs(prev => [...prev, ...newRefs]);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div
          className={`w-full max-w-2xl bg-mission-control-bg border rounded-2xl shadow-2xl flex flex-col transition-colors ${refsDragging ? 'border-mission-control-accent' : 'border-mission-control-border'}`}
          style={{ maxHeight: '90vh' }}
          onDragOver={e => { e.preventDefault(); setRefsDragging(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRefsDragging(false); }}
          onDrop={e => { e.preventDefault(); setRefsDragging(false); addRefFiles(e.dataTransfer.files); }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-mission-control-border flex-shrink-0">
            <div className="flex items-center gap-3">
              {gsdMode
                ? <GitBranch size={15} className="text-mission-control-accent" />
                : <Sparkles size={15} className="text-mission-control-accent" />}
              <span className="text-sm font-semibold text-mission-control-text">New Project</span>
              {gsdMode && (
                <span className="text-xs px-2 py-0.5 bg-mission-control-accent/15 text-mission-control-accent rounded-full font-medium">
                  GSD Planning
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex items-center rounded-lg border border-mission-control-border overflow-hidden text-xs">
                <button
                  onClick={() => !gsdMode || switchMode(false)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${!gsdMode ? 'bg-mission-control-surface text-mission-control-text font-medium' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
                >
                  <Zap size={11} /> Quick
                </button>
                <button
                  onClick={() => gsdMode || switchMode(true)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${gsdMode ? 'bg-mission-control-accent text-white font-medium' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
                >
                  <GitBranch size={11} /> GSD Plan
                </button>
              </div>
              <button
                onClick={() => setPhase('template')}
                className="text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors px-1"
              >
                Skip
              </button>
              <button onClick={onClose} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* GSD mode description bar */}
          {gsdMode && discoveryMsgs.length <= 1 && (
            <div className="px-5 py-2.5 bg-mission-control-accent/8 border-b border-mission-control-accent/20 flex-shrink-0">
              <p className="text-xs text-mission-control-text-dim">
                GSD asks deep questions to generate <span className="text-mission-control-text font-medium">PROJECT.md · REQUIREMENTS.md · ROADMAP.md</span> — saved automatically to your project. Drop files or add URLs below as reference.
              </p>
            </div>
          )}

          {/* Chat */}
          <div ref={discoveryScrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0" style={{ minHeight: '300px' }}>
            {discoveryMsgs.map((msg, i) => {
              const isLastModel = msg.role === 'model' && i === discoveryMsgs.length - 1;
              return (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2.5'} w-full`}>
                    {msg.role === 'model' && (
                      <div className="w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {gsdMode ? <GitBranch size={13} className="text-mission-control-accent" /> : <Bot size={14} className="text-mission-control-accent" />}
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-mission-control-accent text-white rounded-br-sm'
                        : 'bg-mission-control-surface text-mission-control-text rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>

                  {/* Choices widget — below last model message */}
                  {isLastModel && activeWidget === 'choices' && activeWidgetData && (
                    <ChoicesWidget
                      data={activeWidgetData}
                      disabled={discoveryLoading}
                      onChoose={choice => {
                        setDiscoveryInput('');
                        sendDiscoveryMessage(choice);
                      }}
                    />
                  )}

                  {/* Agents widget — below last model message */}
                  {isLastModel && activeWidget === 'agents' && (
                    <div className="pl-9 w-full mt-2 space-y-2">
                      {loadingAgents ? (
                        <div className="flex items-center gap-2 text-xs text-mission-control-text-dim py-2">
                          <Loader2 size={13} className="animate-spin" /> Loading agents...
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-w-sm">
                          {agents.map(agent => {
                            const sel = selectedAgents.includes(agent.id);
                            return (
                              <button key={agent.id} onClick={() => setSelectedAgents(prev => sel ? prev.filter(id => id !== agent.id) : [...prev, agent.id])}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left ${sel ? 'border-mission-control-accent/50 bg-mission-control-accent/10' : 'border-mission-control-border hover:border-mission-control-accent/30'}`}
                              >
                                <AgentAvatar agentId={agent.id} size="sm" fallbackEmoji={agent.emoji} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-mission-control-text">{agent.name}</div>
                                  {agent.role && <div className="text-xs text-mission-control-text-dim truncate">{agent.role}</div>}
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-mission-control-accent bg-mission-control-accent' : 'border-mission-control-border'}`}>
                                  {sel && <Check size={9} className="text-white" />}
                                </div>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => {
                              const names = agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name);
                              sendDiscoveryMessage(names.length > 0 ? `Team: ${names.join(', ')}` : 'No specific agents assigned yet');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium hover:bg-mission-control-accent/90 transition-colors"
                          >
                            <Check size={12} /> {selectedAgents.length > 0 ? `Assign ${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''}` : 'Continue without agents'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing indicator */}
            {discoveryLoading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-mission-control-accent/20 border border-mission-control-accent/30 flex items-center justify-center flex-shrink-0">
                  {gsdMode ? <GitBranch size={13} className="text-mission-control-accent" /> : <Bot size={14} className="text-mission-control-accent" />}
                </div>
                <div className="bg-mission-control-surface px-4 py-3 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-mission-control-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* GSD/Ready confirmation card */}
            {discoveryReady && discoveryStructuredData && (
              <div className="mt-3 p-4 bg-mission-control-surface border border-mission-control-accent/30 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  {gsdDocs
                    ? <GitBranch size={14} className="text-mission-control-accent" />
                    : <CheckCircle size={14} className="text-green-400" />}
                  <p className="text-xs font-semibold text-mission-control-text uppercase tracking-wide">
                    {gsdDocs ? 'GSD Plan Generated' : 'Ready to Create'}
                  </p>
                </div>
                <div>
                  <p className="text-base font-bold text-mission-control-text">{discoveryStructuredData.name}</p>
                  {discoveryStructuredData.goal && (
                    <p className="text-sm text-mission-control-text-dim mt-1 leading-relaxed">{discoveryStructuredData.goal}</p>
                  )}
                </div>
                {gsdDocs && (
                  <div className="flex flex-wrap gap-1.5">
                    {['GSD-PROJECT.md', 'GSD-REQUIREMENTS.md', 'GSD-ROADMAP.md'].map(doc => (
                      <span key={doc} className="text-xs px-2 py-0.5 bg-mission-control-accent/15 text-mission-control-accent rounded-full font-medium">{doc}</span>
                    ))}
                  </div>
                )}
                {discoveryRefs.length > 0 && (
                  <div className="text-xs text-mission-control-text-dim">
                    + {discoveryRefs.length} reference{discoveryRefs.length > 1 ? 's' : ''} will be uploaded as context files
                  </div>
                )}
                <button
                  onClick={handleDiscoveryConfirm}
                  className="w-full py-2.5 bg-mission-control-accent text-white text-sm rounded-lg hover:bg-mission-control-accent/90 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  {gsdDocs ? <><GitBranch size={14} /> Build this project</> : <><Check size={14} /> Create project</>}
                </button>
              </div>
            )}
          </div>

          {/* Context references panel */}
          <div
            className={`border-t border-mission-control-border px-5 py-3 flex-shrink-0 transition-colors ${refsDragging ? 'bg-mission-control-accent/5' : ''}`}
          >
            <input
              ref={discoveryFileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => addRefFiles(e.target.files)}
            />
            {/* Chips row */}
            {discoveryRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {discoveryRefs.map((ref, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-mission-control-surface border border-mission-control-border rounded-lg text-xs group">
                    {ref.type === 'url'
                      ? <ExternalLink size={11} className="text-mission-control-accent flex-shrink-0" />
                      : ref.file?.type.startsWith('image/')
                        ? <ImageIcon size={11} className="text-mission-control-text-dim flex-shrink-0" />
                        : <FileTextIcon size={11} className="text-mission-control-text-dim flex-shrink-0" />}
                    <span className="text-mission-control-text max-w-[140px] truncate">{ref.name}</span>
                    <button
                      onClick={() => setDiscoveryRefs(prev => prev.filter((_, j) => j !== i))}
                      className="text-mission-control-text-dim hover:text-red-400 ml-0.5 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* URL input (expandable) */}
            {showRefUrlInput && (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  value={refUrlInput}
                  onChange={e => setRefUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addRefUrl(); if (e.key === 'Escape') { setShowRefUrlInput(false); setRefUrlInput(''); } }}
                  placeholder="https://figma.com/... or any reference URL"
                  className="flex-1 px-3 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-xs text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-1 focus:ring-mission-control-accent"
                />
                <button onClick={addRefUrl} disabled={!refUrlInput.trim()} className="px-3 py-1.5 bg-mission-control-accent text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors">
                  Add
                </button>
                <button onClick={() => { setShowRefUrlInput(false); setRefUrlInput(''); }} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text transition-colors">
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Add buttons row */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => discoveryFileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              >
                <Paperclip size={12} /> Add files
              </button>
              <button
                onClick={() => setShowRefUrlInput(v => !v)}
                className={`flex items-center gap-1.5 text-xs transition-colors ${showRefUrlInput ? 'text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
              >
                <ExternalLink size={12} /> Add URL
              </button>
              {discoveryRefs.length === 0 && (
                <span className="text-xs text-mission-control-text-dim ml-auto">
                  {refsDragging ? 'Drop files here' : 'Drop files or add URLs as reference context'}
                </span>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="px-5 py-3.5 border-t border-mission-control-border flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={discoveryInput}
                onChange={e => setDiscoveryInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleDiscoverySend()}
                placeholder={discoveryLoading ? '' : gsdMode ? 'Describe your idea or pick an option above...' : 'Tell me about your project...'}
                disabled={discoveryLoading || discoveryReady}
                className="flex-1 px-3.5 py-2.5 bg-mission-control-surface border border-mission-control-border rounded-xl text-sm text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-1 focus:ring-mission-control-accent disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleDiscoverySend}
                disabled={!discoveryInput.trim() || discoveryLoading || discoveryReady}
                className="px-3.5 py-2.5 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Context files phase ────────────────────────────────────────────────────
  if (phase === 'context-files') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-mission-control-border">
            <div>
              <div className="text-sm font-semibold text-mission-control-text">Add Context Files</div>
              <div className="text-xs text-mission-control-text-dim">Optional — upload files Gemini should use as context</div>
            </div>
            <button onClick={onClose} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setContextFilesDragging(true); }}
              onDragLeave={() => setContextFilesDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setContextFilesDragging(false);
                if (e.dataTransfer.files) {
                  setStagedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                }
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
                onChange={e => {
                  if (e.target.files) setStagedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
              <Upload size={20} className="mx-auto text-mission-control-text-dim mb-2" />
              <p className="text-sm text-mission-control-text-dim">Drop files here or click to upload</p>
              <p className="text-xs text-mission-control-text-dim mt-1">Docs, images, PDFs, briefs — any file</p>
            </div>

            {/* Staged files list */}
            {stagedFiles.length > 0 && (
              <div className="space-y-1.5">
                {stagedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg">
                    <span className="flex-1 text-sm text-mission-control-text truncate">{f.name}</span>
                    <span className="text-xs text-mission-control-text-dim">{(f.size / 1024).toFixed(0)}KB</span>
                    <button
                      onClick={() => setStagedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1 text-mission-control-text-dim hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-mission-control-border flex gap-2">
            <button
              onClick={async () => {
                setPhase('confirm');
                const names = agents.filter(a => selectedAgents.includes(a.id)).map(a => a.name);
                const userText = names.length > 0 ? `Team: ${names.join(', ')}` : 'No agents yet';
                await mcAsk(userText, 'confirm', "Here's what I'll set up:");
              }}
              className="flex-1 py-2 bg-mission-control-accent text-white text-sm rounded-lg hover:bg-mission-control-accent/90 transition-colors font-medium"
            >
              {stagedFiles.length > 0 ? `Continue with ${stagedFiles.length} file${stagedFiles.length !== 1 ? 's' : ''}` : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Template picker (shown before chat starts) ────────────────────────────
  if (phase === 'template') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-mission-control-border">
            <div className="flex items-center gap-2">
              <LayoutTemplate size={16} className="text-mission-control-accent" />
              <span className="text-sm font-semibold text-mission-control-text">New Project</span>
            </div>
            <button onClick={onClose} className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-sm text-mission-control-text-dim mb-4">Start from a template or build from scratch.</p>
            {/* Blank */}
            <button
              onClick={() => setPhase('name')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-mission-control-bg border border-mission-control-border flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-mission-control-text-dim" />
              </div>
              <div>
                <div className="text-sm font-medium text-mission-control-text">Blank project</div>
                <div className="text-xs text-mission-control-text-dim">Start with a clean slate.</div>
              </div>
            </button>
            {/* Templates */}
            {PROJECT_TEMPLATES.map(tmpl => {
              const TmplIcon = getProjectIcon(tmpl.iconId);
              return (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    setProjName(tmpl.name);
                    setProjGoal(tmpl.goal);
                    setIconId(tmpl.iconId);
                    setColor(tmpl.color);
                    setPhase('name');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40 transition-all text-left"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${tmpl.color}20`, border: `1px solid ${tmpl.color}40` }}
                  >
                    <TmplIcon size={16} style={{ color: tmpl.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-mission-control-text">{tmpl.name}</div>
                    <div className="text-xs text-mission-control-text-dim truncate">{tmpl.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

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
                  <div className={`px-3 py-2 rounded-lg text-sm ${
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
                <div className="bg-mission-control-surface px-4 py-3 rounded-lg rounded-bl-sm">
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `2px solid ${color}60` }}>
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
                <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
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
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
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
                className="flex-1 py-2.5 bg-mission-control-accent text-white text-sm font-medium rounded-lg hover:bg-mission-control-accent/90 transition-colors flex items-center justify-center gap-2">
                <Check size={15} /> Open Project
              </button>
              <button onClick={onClose}
                className="px-4 py-2.5 border border-mission-control-border text-mission-control-text-dim text-sm rounded-lg hover:bg-mission-control-surface transition-colors">
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
                className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent/50 disabled:opacity-50"
                autoFocus
              />
              <button onClick={handleSend} disabled={!input.trim() || mcTyping}
                className="p-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <Send size={18} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

