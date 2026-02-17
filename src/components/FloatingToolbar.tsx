import { useState, useEffect, useRef } from 'react';
import {
  Phone, X, GripVertical, Search, Plus,
  MessageSquare, ChevronRight, Send, Loader2
} from 'lucide-react';

type Panel = null | 'call' | 'chat';

interface Agent {
  id: string;
  name: string;
  emoji?: string;
}

const w = window as any;
const PILL_HEIGHT = 60;
const PANEL_HEIGHT = 280;

export default function FloatingToolbar() {
  const [panel, setPanel] = useState<Panel>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [chatAgent, setChatAgent] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResponse, setChatResponse] = useState('');
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Load agents on mount
  useEffect(() => {
    w.clawdbot?.agents?.list?.().then((data: any) => {
      if (Array.isArray(data?.agents)) {
        const excluded = new Set(['main', 'froggo', 'clara', 'voice', 'inbox']);
        const filtered = data.agents.filter((a: Agent) => !excluded.has(a.id));
        setAgents(filtered);
        if (filtered.length > 0) setChatAgent(filtered[0].id);
      }
    });
  }, []);

  // Resize window when panel opens/closes
  useEffect(() => {
    const height = panel === null ? PILL_HEIGHT : PANEL_HEIGHT;
    w.clawdbot?.toolbar?.resize?.(height);
  }, [panel]);

  // Focus chat input when panel opens
  useEffect(() => {
    if (panel === 'chat') {
      setTimeout(() => chatInputRef.current?.focus(), 120);
    }
  }, [panel]);

  const togglePanel = (p: Panel) => setPanel(prev => prev === p ? null : p);
  const closePanel = () => setPanel(null);

  const handleCallAgent = (agentId: string) => {
    // Open main app focused on call UI for this agent
    w.clawdbot?.toolbar?.action?.(`call:${agentId}`);
    setPanel(null);
  };

  const handleSendChat = async () => {
    if (!chatAgent || !chatMsg.trim() || chatLoading) return;
    const msgToSend = chatMsg.trim();
    setChatLoading(true);
    setChatResponse('');
    setChatMsg('');
    try {
      const spawnResult = await w.clawdbot?.agents?.spawnChat?.(chatAgent);
      if (spawnResult?.sessionKey) {
        const result = await w.clawdbot?.agents?.chat?.(spawnResult.sessionKey, msgToSend);
        setChatResponse(result?.response || '✓ Message sent');
      } else {
        setChatResponse('✓ Message sent');
      }
    } catch {
      setChatResponse('⚠️ Failed to send');
    } finally {
      setChatLoading(false);
    }
  };

  const handlePopIn = () => w.clawdbot?.toolbar?.popIn?.();
  const sendAction = (action: string) => w.clawdbot?.toolbar?.action?.(action);

  // CSS helpers — WebkitAppRegion needs to be inline (Tailwind can't set it)
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
  const drag   = { WebkitAppRegion: 'drag' }   as React.CSSProperties;

  const btn   = "p-2.5 rounded-full hover:bg-clawd-border transition-colors focus:outline-none";
  const btnSm = "p-2   rounded-full hover:bg-clawd-border transition-colors focus:outline-none";

  return (
    <div className="w-full flex flex-col items-center bg-transparent" style={{ paddingTop: '6px' }}>

      {/* ── Pill toolbar ───────────────────────────────────── */}
      <div
        className="flex items-center gap-1 bg-clawd-surface border border-clawd-border rounded-full shadow-2xl px-1.5 py-1"
        style={noDrag}
      >
        {/* Drag handle — uses native CSS drag region */}
        <div
          className="p-2 rounded-full select-none cursor-grab active:cursor-grabbing hover:bg-clawd-border transition-colors"
          style={drag}
          title="Drag to reposition"
        >
          <GripVertical size={16} className="text-clawd-text-dim pointer-events-none" />
        </div>

        {/* Search → main app */}
        <button onClick={() => sendAction('search')} className={btn} style={noDrag} title="Search">
          <Search size={16} className="text-clawd-text-dim" />
        </button>

        {/* New Task → main app */}
        <button onClick={() => sendAction('new-task')} className={btn} style={noDrag} title="New Task">
          <Plus size={16} className="text-clawd-text-dim" />
        </button>

        {/* Chat → inline panel */}
        <button
          onClick={() => togglePanel('chat')}
          className={`${btn} ${panel === 'chat' ? 'bg-clawd-accent/20' : ''}`}
          style={noDrag}
          title="Chat with Agent"
        >
          <MessageSquare size={16} className={panel === 'chat' ? 'text-clawd-accent' : 'text-clawd-text-dim'} />
        </button>

        {/* Call → inline agent picker */}
        <button
          onClick={() => togglePanel('call')}
          className={`${btn} ${panel === 'call' ? 'bg-success-subtle' : ''}`}
          style={noDrag}
          title="Call Agent"
        >
          <Phone size={16} className={panel === 'call' ? 'text-green-400' : 'text-clawd-text-dim'} />
        </button>

        <div className="w-px h-6 bg-clawd-border mx-0.5" style={noDrag} />

        {/* Dock / close */}
        <button onClick={handlePopIn} className={btnSm} style={noDrag} title="Dock toolbar">
          <ChevronRight size={16} className="text-clawd-text-dim" />
        </button>
        <button onClick={handlePopIn} className={btnSm} style={noDrag} title="Close">
          <X size={14} className="text-clawd-text-dim" />
        </button>
      </div>

      {/* ── Call panel ─────────────────────────────────────── */}
      {panel === 'call' && (
        <div
          className="mt-2 w-[580px] bg-clawd-surface border border-clawd-border rounded-2xl shadow-2xl p-3"
          style={noDrag}
        >
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-xs font-semibold text-clawd-text">Call an agent</span>
            <button onClick={closePanel} className="text-clawd-text-dim hover:text-clawd-text">
              <X size={12} />
            </button>
          </div>
          {agents.length === 0 ? (
            <div className="text-xs text-clawd-text-dim text-center py-3">Loading agents…</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleCallAgent(agent.id)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-clawd-border transition-colors"
                >
                  <span className="text-xl">{agent.emoji || '🤖'}</span>
                  <span className="text-[10px] text-clawd-text-dim truncate w-full text-center leading-tight">
                    {agent.name || agent.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chat panel ─────────────────────────────────────── */}
      {panel === 'chat' && (
        <div
          className="mt-2 w-[580px] bg-clawd-surface border border-clawd-border rounded-2xl shadow-2xl p-3"
          style={noDrag}
        >
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-xs font-semibold text-clawd-text">Message an agent</span>
            <button onClick={closePanel} className="text-clawd-text-dim hover:text-clawd-text">
              <X size={12} />
            </button>
          </div>

          {/* Agent selector */}
          <select
            value={chatAgent}
            onChange={e => { setChatAgent(e.target.value); setChatResponse(''); }}
            className="w-full text-xs bg-clawd-bg border border-clawd-border rounded-lg px-2 py-1.5 text-clawd-text mb-2 outline-none focus:ring-1 focus:ring-clawd-accent"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.emoji ? `${a.emoji} ` : ''}{a.name || a.id}
              </option>
            ))}
          </select>

          {/* Response display */}
          {chatResponse && (
            <div className="text-xs text-clawd-text bg-clawd-bg rounded-lg p-2 mb-2 max-h-20 overflow-y-auto border border-clawd-border">
              {chatResponse}
            </div>
          )}

          {/* Message input */}
          <div className="flex items-center gap-1.5">
            <input
              ref={chatInputRef}
              type="text"
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSendChat(); }}
              placeholder={`Message ${chatAgent || 'agent'}…`}
              disabled={chatLoading}
              className="flex-1 text-xs bg-clawd-bg border border-clawd-border rounded-lg px-2.5 py-1.5 text-clawd-text placeholder:text-clawd-text-dim outline-none focus:ring-1 focus:ring-clawd-accent disabled:opacity-50"
            />
            <button
              onClick={handleSendChat}
              disabled={chatLoading || !chatMsg.trim()}
              className="p-1.5 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent/90 disabled:opacity-40 transition-colors flex-shrink-0"
              title="Send"
            >
              {chatLoading
                ? <Loader2 size={14} className="animate-spin" />
                : <Send size={14} />
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
