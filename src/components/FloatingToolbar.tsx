import { useState, useEffect, useRef } from 'react';
import {
  Phone, X, GripVertical, Search, Plus,
  Sparkles, MessageSquare, ChevronRight, ExternalLink,
  ListTodo, Send, Loader2, RotateCcw, ChevronLeft,
} from 'lucide-react';

type Panel = null | 'context-chat' | 'task-shortcuts' | 'agent-chat' | 'call';

interface Agent {
  id: string;
  name: string;
  emoji?: string;
  role?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to?: string;
}

const w = window as any;
const PILL_H = 60;
const PANEL_H = 340;

export default function FloatingToolbar() {
  const [panel, setPanel] = useState<Panel>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chatAgent, setChatAgent] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const [contextMsg, setContextMsg] = useState('');
  const [contextAgent, setContextAgent] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [contextResponse, setContextResponse] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);
  const ctxInputRef = useRef<HTMLTextAreaElement>(null);

  // Load agents on mount
  useEffect(() => {
    w.clawdbot?.agents?.list?.().then((data: any) => {
      if (Array.isArray(data?.agents)) {
        const excluded = new Set(['main', 'froggo', 'clara', 'voice', 'inbox']);
        const filtered = data.agents.filter((a: Agent) => !excluded.has(a.id));
        setAgents(filtered);
        if (filtered.length > 0) {
          setChatAgent(filtered[0].id);
          setContextAgent(filtered[0].id);
        }
      }
    });
  }, []);

  // Load tasks when task-shortcuts panel opens
  useEffect(() => {
    if (panel === 'task-shortcuts') {
      w.clawdbot?.tasks?.list?.('in-progress').then((data: any) => {
        if (Array.isArray(data?.tasks)) setTasks(data.tasks.slice(0, 8));
        else if (Array.isArray(data)) setTasks(data.slice(0, 8));
      });
    }
  }, [panel]);

  // Resize window when panel opens/closes
  useEffect(() => {
    const height = panel === null ? PILL_H : PANEL_H;
    w.clawdbot?.toolbar?.resize?.(height);
  }, [panel]);

  // Focus inputs when panels open
  useEffect(() => {
    if (panel === 'agent-chat') setTimeout(() => chatInputRef.current?.focus(), 100);
    if (panel === 'context-chat') setTimeout(() => ctxInputRef.current?.focus(), 100);
  }, [panel]);

  const closeAllPanels = () => setPanel(null);
  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p);

  // ── Chat ──────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatAgent || !chatMsg.trim() || chatLoading) return;
    const msg = chatMsg.trim();
    setChatLoading(true);
    setChatResponse('');
    setChatMsg('');
    try {
      const sr = await w.clawdbot?.agents?.spawnChat?.(chatAgent);
      if (sr?.sessionKey) {
        const r = await w.clawdbot?.agents?.chat?.(sr.sessionKey, msg);
        setChatResponse(r?.response || '✓ Sent');
      } else {
        setChatResponse('✓ Sent');
      }
    } catch {
      setChatResponse('⚠️ Failed');
    } finally {
      setChatLoading(false);
    }
  };

  // ── Context chat ──────────────────────────────────────
  const handleSendContext = async () => {
    if (!contextAgent || !contextMsg.trim() || contextLoading) return;
    const msg = contextMsg.trim();
    setContextLoading(true);
    setContextResponse('');
    setContextMsg('');
    try {
      const sr = await w.clawdbot?.agents?.spawnChat?.(contextAgent);
      if (sr?.sessionKey) {
        const r = await w.clawdbot?.agents?.chat?.(sr.sessionKey, msg);
        setContextResponse(r?.response || '✓ Sent');
      } else {
        setContextResponse('✓ Sent');
      }
    } catch {
      setContextResponse('⚠️ Failed');
    } finally {
      setContextLoading(false);
    }
  };

  // ── Call ──────────────────────────────────────────────
  const handleCallAgent = (agentId: string) => {
    w.clawdbot?.toolbar?.action?.(`call:${agentId}`);
    setPanel(null);
  };

  const handlePopIn = () => w.clawdbot?.toolbar?.popIn?.();
  const sendAction = (action: string) => w.clawdbot?.toolbar?.action?.(action);

  // CSS for WebkitAppRegion (Tailwind can't set this)
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
  const drag   = { WebkitAppRegion: 'drag'   } as React.CSSProperties;

  const btn    = 'p-2.5 rounded-full hover:bg-clawd-border transition-colors focus:outline-none';
  const btnSm  = 'p-2   rounded-full hover:bg-clawd-border transition-colors focus:outline-none';
  const active = 'bg-clawd-accent text-white';

  return (
    <div className="w-full flex flex-col items-center bg-transparent" style={{ paddingTop: '6px' }}>

      {/* ── Pill ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 bg-clawd-surface border border-clawd-border rounded-full shadow-none px-1.5 py-1"
        style={noDrag}
      >
        {/* Drag handle */}
        <div
          className="drag-handle p-2 cursor-grab active:cursor-grabbing hover:bg-clawd-border rounded-full transition-colors select-none"
          style={drag}
          title="Drag to reposition"
        >
          <GripVertical size={16} className="text-clawd-text-dim pointer-events-none" />
        </div>

        {isCollapsed ? (
          /* ── Collapsed ─────────────────────────────────── */
          <>
            <button
              onClick={() => { closeAllPanels(); togglePanel('call'); }}
              className={`p-2.5 rounded-full transition-colors bg-clawd-accent text-white hover:bg-clawd-accent/90`}
              style={noDrag}
              title="Call Agent"
            >
              <Phone size={16} />
            </button>
            <button onClick={handlePopIn} className={btnSm} style={noDrag} title="Dock toolbar">
              <ExternalLink size={14} className="text-clawd-text-dim" />
            </button>
            <button onClick={() => setIsCollapsed(false)} className={btnSm} style={noDrag} title="Expand">
              <ChevronLeft size={16} className="text-clawd-text-dim" />
            </button>
          </>
        ) : (
          /* ── Expanded ───────────────────────────────────── */
          <>
            <button onClick={() => sendAction('search')} className={btn} style={noDrag} title="Search (⌘/)">
              <Search size={16} className="text-clawd-text-dim" />
            </button>

            <button onClick={() => sendAction('new-task')} className={btn} style={noDrag} title="New Task">
              <Plus size={16} className="text-clawd-text-dim" />
            </button>

            {/* Context Chat */}
            <button
              onClick={() => togglePanel('context-chat')}
              className={`${btn} ${panel === 'context-chat' ? active : 'hover:bg-clawd-border'}`}
              style={noDrag}
              title="Context Chat"
            >
              <Sparkles size={16} className={panel === 'context-chat' ? '' : 'text-clawd-text-dim'} />
            </button>

            <div className="w-px h-6 bg-clawd-border mx-0.5" style={noDrag} />

            {/* Agent Chat */}
            <button
              onClick={() => togglePanel('agent-chat')}
              className={`${btn} ${panel === 'agent-chat' ? active : 'hover:bg-clawd-border'}`}
              style={noDrag}
              title="Chat with Agent"
            >
              <MessageSquare size={16} className={panel === 'agent-chat' ? '' : 'text-clawd-text-dim'} />
            </button>

            {/* Call — always accent */}
            <button
              onClick={() => togglePanel('call')}
              className={`p-2.5 rounded-full transition-colors ${
                panel === 'call'
                  ? 'bg-clawd-accent/80 text-white'
                  : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
              }`}
              style={noDrag}
              title="Call Agent"
            >
              <Phone size={16} />
            </button>

            <div className="w-px h-6 bg-clawd-border mx-0.5" style={noDrag} />

            <button onClick={handlePopIn} className={btnSm} style={noDrag} title="Dock toolbar">
              <ExternalLink size={14} className="text-clawd-text-dim" />
            </button>
            <button onClick={() => setIsCollapsed(true)} className={btnSm} style={noDrag} title="Collapse">
              <ChevronRight size={16} className="text-clawd-text-dim" />
            </button>
            <button onClick={() => { setPanel(null); w.clawdbot?.toolbar?.popIn?.(); }} className={btnSm} style={noDrag} title="Close">
              <RotateCcw size={14} className="text-clawd-text-dim" />
            </button>
          </>
        )}
      </div>

      {/* ── Context Chat Panel ────────────────────────────── */}
      {panel === 'context-chat' && (
        <div className="mt-2 w-[540px] bg-clawd-surface border border-clawd-border rounded-xl shadow-none p-4" style={noDrag}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles size={14} className="text-clawd-accent" />
              Context Chat
            </h3>
            <button onClick={closeAllPanels} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
          </div>

          <div className="mb-3 p-2 bg-clawd-accent/10 border border-clawd-accent/20 rounded-lg">
            <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider mb-1">Ask an agent</div>
            <select
              value={contextAgent}
              onChange={e => setContextAgent(e.target.value)}
              className="w-full text-xs bg-transparent text-clawd-accent font-medium outline-none"
            >
              {agents.map(a => <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ` : ''}{a.name || a.id}</option>)}
            </select>
          </div>

          {contextResponse && (
            <div className="text-xs text-clawd-text bg-clawd-bg rounded-lg p-2 mb-3 max-h-24 overflow-y-auto border border-clawd-border">
              {contextResponse}
            </div>
          )}

          <textarea
            ref={ctxInputRef}
            value={contextMsg}
            onChange={e => setContextMsg(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSendContext(); }}
            placeholder="Ask about anything…"
            rows={3}
            disabled={contextLoading}
            className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-clawd-accent disabled:opacity-50"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-clawd-text-dim">⌘+Enter to send</span>
            <button
              onClick={handleSendContext}
              disabled={contextLoading || !contextMsg.trim()}
              className="flex items-center gap-2 px-3 py-1.5 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 disabled:opacity-50 text-sm"
            >
              {contextLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send
            </button>
          </div>
        </div>
      )}

      {/* ── Task Shortcuts Panel ──────────────────────────── */}
      {panel === 'task-shortcuts' && (
        <div className="mt-2 w-[320px] bg-clawd-surface border border-clawd-border rounded-xl shadow-none p-3" style={noDrag}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <ListTodo size={14} className="text-clawd-accent" />
              Active Tasks
            </h3>
            <button onClick={closeAllPanels} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-4 text-xs text-clawd-text-dim">No active tasks</div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map(t => (
                <div key={t.id} className="p-2 bg-clawd-bg rounded-lg">
                  <div className="text-xs font-medium truncate">{t.title}</div>
                  {t.assigned_to && (
                    <div className="text-[10px] text-clawd-text-dim mt-0.5">{t.assigned_to}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => sendAction('new-task')}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-clawd-border hover:bg-clawd-border/80 rounded-lg text-xs transition-colors"
          >
            <Plus size={12} />New Task
          </button>
        </div>
      )}

      {/* ── Agent Chat Panel ──────────────────────────────── */}
      {panel === 'agent-chat' && (
        <div className="mt-2 w-[400px] bg-clawd-surface border border-clawd-border rounded-xl shadow-none p-3" style={noDrag}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare size={14} className="text-clawd-accent" />
              Chat with Agent
            </h3>
            <button onClick={closeAllPanels} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
          </div>

          <select
            value={chatAgent}
            onChange={e => { setChatAgent(e.target.value); setChatResponse(''); }}
            className="w-full text-xs bg-clawd-bg border border-clawd-border rounded-lg px-2 py-1.5 text-clawd-text mb-2 outline-none focus:ring-1 focus:ring-clawd-accent"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ` : ''}{a.name || a.id}</option>
            ))}
          </select>

          {chatResponse && (
            <div className="text-xs text-clawd-text bg-clawd-bg rounded-lg p-2 mb-2 max-h-24 overflow-y-auto border border-clawd-border">
              {chatResponse}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <input
              ref={chatInputRef}
              type="text"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
              placeholder={`Message ${chatAgent || 'agent'}…`}
              disabled={chatLoading}
              className="flex-1 text-xs bg-clawd-bg border border-clawd-border rounded-lg px-2.5 py-1.5 text-clawd-text placeholder:text-clawd-text-dim outline-none focus:ring-1 focus:ring-clawd-accent disabled:opacity-50"
            />
            <button
              onClick={handleSendChat}
              disabled={chatLoading || !chatMsg.trim()}
              className="p-1.5 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent/90 disabled:opacity-40 transition-colors"
            >
              {chatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Call Panel ────────────────────────────────────── */}
      {panel === 'call' && (
        <div className="mt-2 w-[320px] bg-clawd-surface border border-clawd-border rounded-xl shadow-none p-3" style={noDrag}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Phone size={14} className="text-clawd-accent" />
              Call an Agent
            </h3>
            <button onClick={closeAllPanels} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
          </div>
          {agents.length === 0 ? (
            <div className="text-xs text-clawd-text-dim text-center py-3">Loading…</div>
          ) : (
            <div className="space-y-1">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleCallAgent(agent.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors text-sm hover:bg-clawd-border"
                >
                  <span className="text-base">{agent.emoji || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs">{agent.name || agent.id}</div>
                    {agent.role && <div className="text-[10px] text-clawd-text-dim truncate">{agent.role}</div>}
                  </div>
                  <Phone size={14} className="text-clawd-accent flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
