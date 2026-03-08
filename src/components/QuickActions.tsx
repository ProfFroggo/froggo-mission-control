import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Plus, MessageSquare, CheckCircle, Search, Send, X,
  ChevronLeft, ChevronRight, GripVertical, RotateCcw, Mic, MicOff, Phone, PhoneOff, ListTodo, Play, Sparkles, Monitor, Camera, CameraOff,
  ExternalLink,
} from 'lucide-react';
import { showToast } from './Toast';
import { useStore } from '../store/store';
import { chatApi, settingsApi } from '../lib/api';
import { createLogger } from '../utils/logger';

const logger = createLogger('QuickActions');
import AgentAvatar from './AgentAvatar';
import { ChatAgent, fetchAgentList } from './AgentSelector';
import { GeminiLiveService, VideoMode, getGeminiVoiceForAgent, GeminiToolCall } from '../lib/geminiLiveService';
import { loadAgentContext, invalidateAgentContext } from '../lib/agentContext';
import { buildSystemInstruction, buildAgentTools, executeToolCall, loadRecentChatHistory, type AgentContext } from '../lib/voiceCallShared';
import ScreenSourcePicker, { ScreenSource } from './ScreenSourcePicker';

// ─── Ring tone generator ─────────────────────────────────────────────────────

function playRingTone(audioCtx: AudioContext): { stop: () => void } {
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.15;
  gainNode.connect(audioCtx.destination);
  let stopped = false;
  let ringTimeout: ReturnType<typeof setTimeout> | null = null;

  const ring = () => {
    if (stopped) return;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const merge = audioCtx.createGain();
    merge.gain.value = 0.5;
    osc1.frequency.value = 440;
    osc2.frequency.value = 480;
    osc1.connect(merge);
    osc2.connect(merge);
    merge.connect(gainNode);
    osc1.start();
    osc2.start();
    setTimeout(() => { osc1.stop(); osc2.stop(); if (!stopped) ringTimeout = setTimeout(ring, 2000); }, 1000);
  };
  ring();
  return { stop: () => { stopped = true; if (ringTimeout) clearTimeout(ringTimeout); gainNode.disconnect(); } };
}

// Singleton Gemini Live service for calls
const geminiLive = new GeminiLiveService();

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  onNewTask: () => void;
  onSearch: () => void;
  onApproveAll: () => void;
  onAddContact?: () => void;
  onAddSkill?: () => void;
  onNavigate?: (view: string) => void;
  currentView?: string;
  isFloating?: boolean;
}

export interface QuickActionsRef {
  openQuickMessage: () => void;
  openCall: () => void;
  openContextChat: () => void;
  openAgentChat: () => void;
}

type SnapEdge = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface ToolbarState {
  isCollapsed: boolean;
  snapEdge: SnapEdge;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'quickActionsState';
const CALL_STATE_KEY = 'quickActions_activeCall';
const EDGE_MARGIN = 24;

const DEFAULT_STATE: ToolbarState = {
  isCollapsed: false,
  snapEdge: 'bottom-right',
};

// Context-aware agent suggestions based on current view
const VIEW_AGENT_SUGGESTIONS: Record<string, string[]> = {
  analytics: ['coder', 'researcher', 'chief'],
  kanban: ['chief', 'coder', 'clara'],
  agents: ['hr', 'chief', 'coder'],
  dashboard: ['mission-control', 'chief', 'coder'],
  settings: ['coder', 'chief', 'mission-control'],
  twitter: ['social-manager', 'growth-director', 'writer'],
  inbox: ['mission-control', 'chief', 'writer'],
  meetings: ['mission-control', 'voice', 'chief'],
  voicechat: ['voice', 'mission-control', 'chief'],
  accounts: ['mission-control', 'chief', 'hr'],
  approvals: ['clara', 'chief', 'hr'],
  library: ['researcher', 'writer', 'coder'],
  context: ['coder', 'chief', 'researcher'],
};

// Task quick-status options
const TASK_STATUSES = [
  { label: 'To Do', value: 'todo', icon: ListTodo, color: 'text-mission-control-text-dim' },
  { label: 'In Progress', value: 'in-progress', icon: Play, color: 'text-info' },
  { label: 'Review', value: 'review', icon: Search, color: 'text-warning' },
  { label: 'Done', value: 'done', icon: CheckCircle, color: 'text-success' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadState(): ToolbarState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_STATE;
}

function getSnapPosition(edge: SnapEdge): { top?: string; bottom?: string; left?: string; right?: string } {
  const m = `${EDGE_MARGIN}px`;
  switch (edge) {
    case 'bottom-right': return { bottom: m, right: m };
    case 'bottom-left': return { bottom: m, left: m };
    case 'top-right': return { top: m, right: m };
    case 'top-left': return { top: m, left: m };
  }
}

function nearestSnapEdge(x: number, y: number): SnapEdge {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const isRight = x >= cx;
  const isBottom = y >= cy;
  if (isRight && isBottom) return 'bottom-right';
  if (!isRight && isBottom) return 'bottom-left';
  if (isRight && !isBottom) return 'top-right';
  return 'top-left';
}

function loadActiveCall(): { agentId: string; agentName: string } | null {
  try {
    const saved = localStorage.getItem(CALL_STATE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function saveActiveCall(call: { agentId: string; agentName: string } | null) {
  if (call) {
    localStorage.setItem(CALL_STATE_KEY, JSON.stringify(call));
  } else {
    localStorage.removeItem(CALL_STATE_KEY);
  }
}

function getViewLabel(view: string): string {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard', kanban: 'Tasks', agents: 'Agents', analytics: 'Analytics',
    twitter: 'Social Media', inbox: 'Inbox', meetings: 'Meetings', voicechat: 'Voice Chat',
    accounts: 'Accounts', approvals: 'Approvals', library: 'Library', context: 'Context',
    settings: 'Settings', contacts: 'Contacts', calendar: 'Calendar',
  };
  return labels[view] || view.charAt(0).toUpperCase() + view.slice(1);
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** FEATURE 2: Agent selection modal for voice calls */
function AgentCallModal({ isOpen, onClose, onSelect, activeCall, panelPos }: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (agent: ChatAgent) => void;
  activeCall: { agentId: string; agentName: string } | null;
  panelPos: string;
}) {
  if (!isOpen) return null;

  return (
    <div className={`${panelPos} w-72 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-3 max-h-80 overflow-y-auto`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Phone size={14} className="text-mission-control-accent" />
          {activeCall ? 'Active Call' : 'Call Agent'}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-mission-control-border rounded"><X size={14} /></button>
      </div>
      {activeCall && (
        <div className="mb-2 p-2 bg-error-subtle border border-error-border rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-error">In call with {activeCall.agentName}</span>
        </div>
      )}
      <div className="space-y-1">
        {fetchAgentList().filter(a => a.id !== 'voice').map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors text-sm ${
              activeCall?.agentId === agent.id
                ? 'bg-error-subtle border border-error-border'
                : 'hover:bg-mission-control-border'
            }`}
          >
            <AgentAvatar agentId={agent.id} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs">{agent.name}</div>
              <div className="text-[10px] text-mission-control-text-dim truncate">{agent.role}</div>
            </div>
            {activeCall?.agentId === agent.id && (
              <PhoneOff size={14} className="text-error" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** FEATURE 3: Context-aware agent chat modal */
function ContextChatModal({ isOpen, onClose, currentView, onStartChat, panelPos }: {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onStartChat: (agent: ChatAgent, context: string) => void;
  panelPos: string;
}) {
  const [message, setMessage] = useState('');
  const suggestedAgentIds = VIEW_AGENT_SUGGESTIONS[currentView] || ['mission-control', 'chief', 'coder'];
  const suggestedAgents = suggestedAgentIds
    .map(id => fetchAgentList().find(a => a.id === id))
    .filter(Boolean) as ChatAgent[];
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent>(suggestedAgents[0]);
  const [showAllAgents, setShowAllAgents] = useState(false);

  if (!isOpen) return null;

  const viewLabel = getViewLabel(currentView);

  return (
    <div className={`${panelPos} w-80 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles size={14} className="text-mission-control-accent" />
          Context Chat
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-mission-control-border rounded"><X size={14} /></button>
      </div>

      {/* Context indicator */}
      <div className="mb-3 p-2 bg-mission-control-accent/10 border border-mission-control-accent/20 rounded-lg">
        <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider">Current Context</div>
        <div className="text-xs font-medium text-mission-control-accent">{viewLabel}</div>
      </div>

      {/* Suggested agents */}
      <div className="mb-3">
        <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider mb-1.5">
          Suggested for {viewLabel}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {suggestedAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
                selectedAgent.id === agent.id
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-border hover:bg-mission-control-border/80'
              }`}
            >
              <AgentAvatar agentId={agent.id} size="xs" />
              {agent.name}
            </button>
          ))}
          <button
            onClick={() => setShowAllAgents(!showAllAgents)}
            className="px-2 py-1 rounded-full text-xs bg-mission-control-border hover:bg-mission-control-border/80 transition-colors"
          >
            {showAllAgents ? 'Less' : 'More...'}
          </button>
        </div>
        {showAllAgents && (
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {fetchAgentList().filter(a => !suggestedAgentIds.includes(a.id)).map(agent => (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setShowAllAgents(false); }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
                  selectedAgent.id === agent.id
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border hover:bg-mission-control-border/80'
                }`}
              >
                <AgentAvatar agentId={agent.id} size="xs" />
                {agent.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message */}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={`Ask ${selectedAgent.name} about ${viewLabel}...`}
        className="w-full h-20 bg-mission-control-bg border border-mission-control-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-mission-control-accent"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && message.trim()) {
            onStartChat(selectedAgent, message);
            setMessage('');
            onClose();
          }
        }}
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-mission-control-text-dim">⌘+Enter to send</span>
        <button
          onClick={() => {
            if (message.trim()) {
              onStartChat(selectedAgent, message);
              setMessage('');
              onClose();
            }
          }}
          disabled={!message.trim()}
          className="flex items-center gap-2 px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 disabled:opacity-50 text-sm"
        >
          <Send size={12} />
          Chat with {selectedAgent.name}
        </button>
      </div>
    </div>
  );
}

/** FEATURE 4: Task status shortcuts modal */
function TaskShortcutsModal({ isOpen, onClose, panelPos }: {
  isOpen: boolean;
  onClose: () => void;
  panelPos: string;
}) {
  const [recentTasks, setRecentTasks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // Fetch recent tasks from mission-control-db via gateway
    fetch('/api/tasks?limit=5&status=in-progress')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRecentTasks(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setRecentTasks([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast('success', 'Updated', `Task moved to ${newStatus}`);
        setRecentTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      } else {
        showToast('error', 'Failed', 'Could not update task status');
      }
    } catch {
      showToast('error', 'Error', 'Network error updating task');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`${panelPos} w-72 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-3 max-h-80 overflow-y-auto`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ListTodo size={14} className="text-mission-control-accent" />
          Task Shortcuts
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-mission-control-border rounded"><X size={14} /></button>
      </div>

      {/* Quick status filters */}
      <div className="flex gap-1 mb-2">
        {TASK_STATUSES.map(s => (
          <button
            key={s.value}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-mission-control-border hover:bg-mission-control-border/80 transition-colors"
            title={`View ${s.label} tasks`}
          >
            <s.icon size={10} className={s.color} />
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-4 text-xs text-mission-control-text-dim">Loading tasks...</div>
      ) : recentTasks.length === 0 ? (
        <div className="text-center py-4 text-xs text-mission-control-text-dim">No active tasks</div>
      ) : (
        <div className="space-y-1.5">
          {recentTasks.map(task => (
            <div key={task.id} className="p-2 bg-mission-control-bg rounded-lg">
              <div className="text-xs font-medium truncate mb-1">{task.title}</div>
              <div className="flex gap-1">
                {TASK_STATUSES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => updateTaskStatus(task.id, s.value)}
                    className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                      task.status === s.value
                        ? 'bg-mission-control-accent text-white'
                        : 'bg-mission-control-border hover:bg-mission-control-border/80 text-mission-control-text-dim'
                    }`}
                    title={`Set to ${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const QuickActions = forwardRef<QuickActionsRef, QuickActionsProps>(({
  onNewTask, onSearch, onApproveAll: _onApproveAll, onAddContact: _onAddContact, onAddSkill: _onAddSkill, onNavigate: _onNavigate, currentView = 'dashboard', isFloating = false,
}, ref) => {
  const { isMuted: _isMuted, toggleMuted: _toggleMuted, isMeetingActive, toggleMeeting } = useStore();

  // Toolbar state — floating always starts expanded, never persists collapse
  const [state, setState] = useState<ToolbarState>(() => {
    const s = loadState();
    return isFloating ? { ...s, isCollapsed: false } : s;
  });
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; elX: number; elY: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [agentCallModalOpen, setAgentCallModalOpen] = useState(false);
  const [contextChatOpen, setContextChatOpen] = useState(false);
  const [taskShortcutsOpen, setTaskShortcutsOpen] = useState(false);

  // FEATURE 2: Call persistence + real voice state
  const [activeCall, setActiveCall] = useState<{ agentId: string; agentName: string } | null>(loadActiveCall);
  const [callRinging, setCallRinging] = useState(false);
  const [callConnected, setCallConnected] = useState(false);
  const [callTranscript, setCallTranscript] = useState<Array<{ role: 'user' | 'assistant' | 'system'; text: string }>>([]);
  const [callVideoMode, setCallVideoMode] = useState<VideoMode>('none');
  const [callMuted, setCallMuted] = useState(false);
  const [callListening, setCallListening] = useState(false);
  const [callSpeaking, setCallSpeaking] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const ringRef = useRef<{ stop: () => void } | null>(null);
  const ringCtxRef = useRef<AudioContext | null>(null);
  const callTranscriptRef = useRef<HTMLDivElement>(null);
  const callVideoRef = useRef<HTMLVideoElement>(null);
  const [callScreenPickerOpen, setCallScreenPickerOpen] = useState(false);

  // Agent chat state
  const [agentChatModalOpen, setAgentChatModalOpen] = useState(false);
  const [agentChatOpen, setAgentChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState<{ id: string; name: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Close all modals helper
  const closeAllModals = () => {
    setQuickMessageOpen(false);
    setAgentCallModalOpen(false);
    setContextChatOpen(false);
    setTaskShortcutsOpen(false);
    setAgentChatModalOpen(false);
  };

  // Persist toolbar state (not in floating mode — don't clobber in-app state)
  useEffect(() => {
    if (!isFloating) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, isFloating]);


  useImperativeHandle(ref, () => ({
    openQuickMessage: () => { closeAllModals(); setQuickMessageOpen(true); },
    openCall: () => { closeAllModals(); setAgentCallModalOpen(true); },
    openContextChat: () => { closeAllModals(); setContextChatOpen(true); },
    openAgentChat: () => { closeAllModals(); setAgentChatModalOpen(true); },
  }));

  useEffect(() => {
    if (quickMessageOpen) {
      const textarea = document.querySelector('textarea[placeholder*="Mission Control"]') as HTMLTextAreaElement;
      textarea?.focus();
    }
  }, [quickMessageOpen]);

  // Agent context for voice calls
  const agentContextRef = useRef<AgentContext | null>(null);
  const activeCallAgentRef = useRef<{ id: string; name: string; role?: string } | null>(null);

  // ─── Gemini Live event wiring ───
  useEffect(() => {
    const addTx = (role: 'user' | 'assistant' | 'system', text: string) => {
      setCallTranscript(prev => [...prev.slice(-80), { role, text }]);
    };

    // Log transcripts to gateway session
    const logToGateway = async (_role: string, _text: string) => {
      // Voice transcript logging not available in web mode
      // Gateway doesn't expose a raw send method for chat.inject
    };

    const unsubs = [
      geminiLive.on('connected', () => { setCallConnected(true); setCallRinging(false); }),
      geminiLive.on('disconnected', () => { setCallConnected(false); setCallListening(false); setCallSpeaking(false); }),
      geminiLive.on('reconnecting', ({ attempt }: any) => { addTx('system', `🔄 Reconnecting (attempt ${attempt})...`); }),
      geminiLive.on('listening-start', () => setCallListening(true)),
      geminiLive.on('listening-end', () => setCallListening(false)),
      geminiLive.on('speaking-start', () => setCallSpeaking(true)),
      geminiLive.on('speaking-end', () => setCallSpeaking(false)),
      geminiLive.on('error', ({ message }: any) => addTx('system', `⚠️ ${message}`)),
      geminiLive.on('transcript', ({ text, role }: any) => {
        if (!text?.trim()) return;
        const r = role === 'model' ? 'assistant' : 'user';
        addTx(r, text.trim());
        logToGateway(r, text.trim());
      }),
      geminiLive.on('tool-call', async (toolCall: GeminiToolCall) => {
        try {
          logger.debug('[QuickActions] Tool call received:', toolCall);
          if (!toolCall?.functionCalls?.length) {
            logger.warn('No function calls in tool-call event');
            return;
          }
          const agent = activeCallAgentRef.current;
          const responses: Array<{ id: string; name: string; response: any }> = [];
          for (const fc of toolCall.functionCalls) {
            addTx('system', `🔧 ${fc.name}(${JSON.stringify(fc.args || {}).slice(0, 100)})`);
            logger.debug(`[QuickActions] Executing tool: ${fc.name}`);
            let result: any;
            try {
              result = await executeToolCall(fc.name, fc.args || {}, agent || { id: 'mission-control', name: 'Mission Control' });
              logger.debug(`[QuickActions] Tool ${fc.name} result:`, result);
            } catch (err: unknown) {
              // `[QuickActions] Tool ${fc.name} error:`, err;
              result = { error: (err as Error).message || 'Tool execution failed' };
              addTx('system', `⚠️ ${fc.name} failed: ${(err as Error).message}`);
            }
            responses.push({ id: fc.id, name: fc.name, response: result });
          }
          logger.debug('[QuickActions] Sending tool responses:', responses.length);
          await geminiLive.sendToolResponse(responses);
          logger.debug('[QuickActions] Tool responses sent');
        } catch (err: unknown) {
          // '[QuickActions] Tool handler error:', err;
          addTx('system', `⚠️ Tool error: ${(err as Error).message}`);
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (callTranscriptRef.current) callTranscriptRef.current.scrollTop = callTranscriptRef.current.scrollHeight;
  }, [callTranscript]);

  const stopRinging = () => {
    ringRef.current?.stop(); ringRef.current = null;
    if (ringCtxRef.current) { ringCtxRef.current.close().catch((err: Error) => { logger.error('Failed to close ring context:', err); }); ringCtxRef.current = null; }
    setCallRinging(false);
  };

  const getGeminiApiKey = async (): Promise<string> => {
    try {
      const result = await settingsApi.get('gemini_api_key');
      if (result?.value) return result.value;
    } catch { /* ignore */ }
    return '';
  };

  // ─── FEATURE 2: Agent call handling (real Gemini Live) ───
  const handleAgentCall = async (agent: ChatAgent) => {
    if (activeCall?.agentId === agent.id) {
      // End call
      stopRinging();
      await geminiLive.disconnect();
      setActiveCall(null);
      saveActiveCall(null);
      setCallConnected(false);
      setCallMuted(false);
      setCallVideoMode('none');
      setCallDialogOpen(false);
      setCallTranscript(prev => [...prev, { role: 'system', text: '📵 Call ended' }]);
      if (isMeetingActive) toggleMeeting();
      showToast('success', 'Call Ended', `Disconnected from ${agent.name}`);
    } else {
      // Start call
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        showToast('error', 'No API Key', 'Set Gemini API key in Settings');
        return;
      }

      const call = { agentId: agent.id, agentName: agent.name };
      setActiveCall(call);
      saveActiveCall(call);
      activeCallAgentRef.current = { id: agent.id, name: agent.name, role: agent.role };
      setCallRinging(true);
      setCallTranscript([{ role: 'system', text: `📞 Calling ${agent.name}...` }]);
      setCallDialogOpen(true);
      setAgentCallModalOpen(false);

      // Play ring tone
      try {
        const ctx = new AudioContext();
        ringCtxRef.current = ctx;
        ringRef.current = playRingTone(ctx);
      } catch { /* ignore */ }

      try {
        // Load full agent context (SOUL.md, memory, tasks, etc.) + chat history
        invalidateAgentContext(agent.id);
        const [agentCtx, chatHistory] = await Promise.all([
          loadAgentContext(agent.id).catch((err: Error) => { logger.error('Failed to load agent context:', err); return null; }),
          loadRecentChatHistory(agent.id, 25),
        ]);
        agentContextRef.current = agentCtx;

        const sysInstruction = buildSystemInstruction(
          { id: agent.id, name: agent.name, role: agent.role },
          agentCtx,
          undefined,
          chatHistory
        ) + '\n\nYou just answered a phone call. Greet the caller naturally and casually — like picking up a phone. Keep it brief.';

        await geminiLive.connect({
          apiKey,
          voice: getGeminiVoiceForAgent(agent.id),
          systemInstruction: sysInstruction,
          tools: buildAgentTools(),
        });
        stopRinging();
        // Trigger the agent to "answer" the call with a greeting
        await geminiLive.sendText('Hey, you just picked up the phone. Greet me!');
        await geminiLive.startMic();
        if (!isMeetingActive) toggleMeeting();
      } catch (err: unknown) {
        stopRinging();
        setCallTranscript(prev => [...prev, { role: 'system', text: `⚠️ ${(err as Error).message}` }]);
        setActiveCall(null);
        saveActiveCall(null);
      }
    }
  };

  const endActiveCall = async () => {
    if (!activeCall) return;
    stopRinging();
    await geminiLive.disconnect();
    setActiveCall(null);
    saveActiveCall(null);
    setCallConnected(false);
    setCallMuted(false);
    setCallVideoMode('none');
    setCallDialogOpen(false);
    setCallTranscript(prev => [...prev, { role: 'system', text: '📵 Call ended' }]);
    if (isMeetingActive) toggleMeeting();
  };

  const toggleCallMute = () => {
    if (callMuted) { geminiLive.startMic(); } else { geminiLive.stopMic(); }
    setCallMuted(!callMuted);
  };

  const attachVideoStream = (retryCount = 0) => {
    const maxRetries = 5;
    if (callVideoRef.current) {
      const stream = geminiLive.getVideoStream();
      logger.debug('[QuickActions] Attaching video stream, stream exists:', !!stream, 'retry:', retryCount);
      if (stream) {
        callVideoRef.current.srcObject = stream;
        // Verify attachment worked
        if (!callVideoRef.current.srcObject && retryCount < maxRetries) {
          logger.warn('[QuickActions] Stream attachment failed, retrying...', retryCount + 1);
          setTimeout(() => attachVideoStream(retryCount + 1), 200);
        }
      } else if (retryCount < maxRetries) {
        // Stream not ready yet, retry
        logger.warn('[QuickActions] No video stream yet, retrying...', retryCount + 1);
        setTimeout(() => attachVideoStream(retryCount + 1), 200);
      } else {
        logger.error('[QuickActions] Max retries reached, no video stream available');
      }
    } else {
      logger.warn('[QuickActions] Video element ref not available');
    }
  };

  const toggleCallScreen = async () => {
    if (callVideoMode === 'screen') {
      geminiLive.stopVideo();
      setCallVideoMode('none');
      if (callVideoRef.current) callVideoRef.current.srcObject = null;
    } else {
      setCallScreenPickerOpen(true);
    }
  };

  const handleCallScreenSourceSelected = async (source: ScreenSource) => {
    setCallScreenPickerOpen(false);
    try {
      const sourceId = source.id === '__browser_picker__' ? undefined : source.id;
      logger.debug('[QuickActions] Starting screen share, sourceId:', sourceId);
      
      // Start screen share
      await geminiLive.startVideo('screen', sourceId);
      setCallVideoMode('screen');
      
      // Attach stream with retry mechanism
      attachVideoStream();
      
      // Additional attachment attempt after a delay
      setTimeout(() => attachVideoStream(), 500);
      
      setCallTranscript(prev => [...prev, { role: 'system', text: `🖥️ Sharing: ${source.name}` }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('[QuickActions] Screen share failed:', errMsg);
      setCallTranscript(prev => [...prev, { role: 'system', text: `⚠️ Screen share failed: ${errMsg}` }]);
    }
  };

  const toggleCallCamera = async () => {
    if (callVideoMode === 'camera') {
      geminiLive.stopVideo();
      setCallVideoMode('none');
      if (callVideoRef.current) callVideoRef.current.srcObject = null;
    } else {
      try {
        await geminiLive.startVideo('camera');
        setCallVideoMode('camera');
        attachVideoStream();
        setTimeout(() => attachVideoStream(), 500);
      } catch (_err) { setCallTranscript(prev => [...prev, { role: 'system', text: `⚠️ Camera failed` }]); }
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  // ─── Agent Chat handling ───
  const handleStartAgentChat = async (agent: ChatAgent) => {
    setChatAgent({ id: agent.id, name: agent.name });
    setAgentChatModalOpen(false);
    setAgentChatOpen(true);
    setChatMessages([]);
    setChatLoading(true);

    // Load persisted chat history for this agent
    try {
      const sessionKey = `toolbar:chat:${agent.id}`;
      const result = await chatApi.getMessages(sessionKey);
      if (Array.isArray(result) && result.length > 0) {
        setChatMessages(result.slice(-30).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })));
      }
    } catch (_e) {
      // ignore load errors — start fresh
    }

    // Ensure agent session exists via REST
    try {
      await chatApi.createSession(agent.id);
    } catch (_e) {
      // Session may already exist, ignore
    }
    setChatLoading(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatAgent) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);

    // Persist user message via REST
    const sessionKey = `toolbar:chat:${chatAgent.id}`;
    chatApi.saveMessage(sessionKey, {
      role: 'user', content: msg, timestamp: Date.now(),
    }).catch(() => {});

    setChatLoading(true);
    try {
      // Use streamMessage or direct REST call
      const { streamMessage } = await import('../lib/api');
      let reply = '';
      await new Promise<void>((resolve, reject) => {
        streamMessage(
          chatAgent.id,
          msg,
          (chunk: any) => { reply += chunk.delta || chunk.content || ''; },
          () => resolve(),
          (err: Error) => reject(err),
        );
      });
      if (reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        chatApi.saveMessage(sessionKey, {
          role: 'assistant', content: reply, timestamp: Date.now(),
        }).catch(() => {});
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ No response from agent' }]);
      }
    } catch (_err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Failed to get response' }]);
    }
    setChatLoading(false);
  };

  // ─── FEATURE 3: Context-aware chat ───
  const handleContextChat = async (agent: ChatAgent, message: string) => {
    const contextPrefix = `[Context: viewing ${getViewLabel(currentView)}] `;
    const fullMessage = contextPrefix + message;
    try {
      const response = await fetch(`/api/chat/sessions/${encodeURIComponent(agent.sessionKey)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: fullMessage }),
      });
      if (response.ok) {
        showToast('success', 'Sent to ' + agent.name, 'Check chat for response');
      }
    } catch (e) {
      showToast('error', 'Failed to send', String(e));
    }
  };

  // ─── Drag handlers ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const el = toolbarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, elX: rect.left, elY: rect.top };
    setDragging(true);
    setDragPos({ x: rect.left, y: rect.top });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      setDragPos({ x: start.elX + (e.clientX - start.mouseX), y: start.elY + (e.clientY - start.mouseY) });
    };
    const handleMouseUp = (e: MouseEvent) => {
      setDragging(false);
      const start = dragStartRef.current;
      if (!start) { setDragPos(null); return; }
      const finalX = start.elX + (e.clientX - start.mouseX);
      const finalY = start.elY + (e.clientY - start.mouseY);
      const el = toolbarRef.current;
      const w = el?.offsetWidth ?? 0;
      const h = el?.offsetHeight ?? 0;
      const edge = nearestSnapEdge(finalX + w / 2, finalY + h / 2);
      setState(prev => ({ ...prev, snapEdge: edge }));
      setDragPos(null);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const toggleCollapse = () => setState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  
  const handlePopOut = async () => {
    try {
      // Toolbar pop-out not available in web mode (Electron only)
      showToast('info', 'Pop-out not available', 'Floating toolbar requires the desktop app');
    } catch (error) {
      // 'Pop-out error:', error;
      showToast('error', 'Pop-out Failed', 'An error occurred');
    }
  };
  
  const resetPosition = () => {
    setState(DEFAULT_STATE);
    showToast('success', 'Position Reset', 'Toolbar moved to default position');
  };

  const handleQuickMessage = async () => {
    if (!quickMessage.trim()) return;
    setSending(true);
    try {
      const response = await fetch('/api/chat/sessions/web:dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: quickMessage }),
      });
      if (response.ok) {
        showToast('success', 'Message sent', 'Mission Control will respond in chat');
        setQuickMessage('');
        setQuickMessageOpen(false);
      }
    } catch (e) {
      showToast('error', 'Failed to send', String(e));
    } finally {
      setSending(false);
    }
  };

  const isTop = state.snapEdge.startsWith('top');
  const isLeft = state.snapEdge.endsWith('left');

  const snapStyle = dragging && dragPos
    ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' }
    : getSnapPosition(state.snapEdge);

  // For floating mode: CSS drag styles
  const noDrag = isFloating ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : {};
  const dragStyle = isFloating ? { WebkitAppRegion: 'drag' } as React.CSSProperties : {};

  // Panel position classes — for floating mode use snap edge so popups never overflow
  const panelPos = `absolute ${isTop ? 'top-full mt-2' : 'bottom-full mb-2'} ${isLeft ? 'left-0' : 'right-0'}`;

  const pillContent = (
    <>
      {/* ─── Modals ─── */}

      {/* Quick Message Modal */}
      {quickMessageOpen && !state.isCollapsed && (
        <div className={`${panelPos} w-80 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <MessageSquare size={16} className="text-mission-control-accent" />
              Quick Message
            </h3>
            <button onClick={() => setQuickMessageOpen(false)} className="p-1 hover:bg-mission-control-border rounded">
              <X size={16} />
            </button>
          </div>
          <textarea
            value={quickMessage}
            onChange={e => setQuickMessage(e.target.value)}
            placeholder="Ask Mission Control something quick..."
            className="w-full h-24 bg-mission-control-bg border border-mission-control-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-mission-control-accent"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuickMessage();
            }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleQuickMessage}
              disabled={!quickMessage.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* FEATURE 2: Agent Call Modal */}
      {agentCallModalOpen && !state.isCollapsed && (
        <AgentCallModal
          isOpen={agentCallModalOpen}
          onClose={() => setAgentCallModalOpen(false)}
          onSelect={handleAgentCall}
          activeCall={activeCall}
          panelPos={panelPos}
        />
      )}

      {/* FEATURE 2b: Active Call Window (agent image / video + transcript + controls) */}
      {callDialogOpen && activeCall && (
        <div className={`${panelPos} w-[320px] bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden`}>

          {/* Agent image / / Screen share area */}
          <div className="relative w-full aspect-square bg-black overflow-hidden">
            {/* element (camera or screen share) — hidden until active */}
            <video
              ref={callVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${callVideoMode !== 'none' ? 'block' : 'hidden'}`}
            />

            {/* Agent profile pic — shown when no video */}
            {callVideoMode === 'none' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={`/api/agents/${activeCall.agentId}/avatar`}
                  alt={activeCall.agentName}
                  className={`w-32 h-32 rounded-full object-cover border-4 transition-all duration-300 ${
                    callRinging ? 'border-yellow-500 animate-pulse scale-95'
                    : callSpeaking ? 'border-green-500 scale-110 shadow-lg shadow-green-500/30'
                    : callListening ? 'border-blue-500 scale-105 shadow-lg shadow-blue-500/20'
                    : 'border-mission-control-border'
                  }`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* Status overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{activeCall.agentName}</div>
                  <div className="text-[11px] text-white/70">
                    {callRinging ? '📞 Ringing...' : callSpeaking ? '🔊 Speaking' : callListening ? '🎤 Listening' : callConnected ? '✅ Connected' : '⏳ Connecting...'}
                  </div>
                </div>
                {callVideoMode !== 'none' && (
                  <span className="text-[10px] bg-success-subtle text-white px-2 py-0.5 rounded-full">
                    {callVideoMode === 'screen' ? '🖥 Screen' : '📷 Camera'}
                  </span>
                )}
              </div>
            </div>

            {/* Close button */}
            <button onClick={() => setCallDialogOpen(false)} className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors">
              <X size={12} />
            </button>
          </div>

          {/* Transcript */}
          <div ref={callTranscriptRef} className="h-[140px] overflow-y-auto px-3 py-2 space-y-1.5 text-xs border-t border-mission-control-border">
            {callTranscript.length === 0 && (
              <div className="flex items-center justify-center h-full text-mission-control-text-dim">
                {callRinging ? 'Ringing...' : 'Waiting for response...'}
              </div>
            )}
            {callTranscript.map((entry, i) => (
              <div key={i} className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg ${
                  entry.role === 'user' ? 'bg-mission-control-accent/50 text-white'
                  : entry.role === 'system' ? 'bg-mission-control-bg text-mission-control-text-dim italic text-[10px]'
                  : 'bg-mission-control-border/50 text-mission-control-text'
                }`}>
                  {entry.text}
                </div>
              </div>
            ))}
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-center gap-3 px-3 py-3 border-t border-mission-control-border bg-mission-control-bg/50">
            <button onClick={toggleCallMute} disabled={!callConnected}
              className={`p-2.5 rounded-full transition-colors ${callMuted ? 'bg-error-subtle text-error' : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/80'} disabled:opacity-30`}
              title={callMuted ? 'Unmute' : 'Mute'}>
              {callMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button onClick={toggleCallScreen} disabled={!callConnected}
              className={`p-2.5 rounded-full transition-colors ${callVideoMode === 'screen' ? 'bg-success-subtle text-success' : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/80'} disabled:opacity-30`}
              title="Share Screen">
              <Monitor size={16} />
            </button>
            <button onClick={toggleCallCamera} disabled={!callConnected}
              className={`p-2.5 rounded-full transition-colors ${callVideoMode === 'camera' ? 'bg-success-subtle text-success' : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/80'} disabled:opacity-30`}
              title="Camera">
              {callVideoMode === 'camera' ? <CameraOff size={16} /> : <Camera size={16} />}
            </button>
            <button onClick={endActiveCall}
              className="p-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="End Call">
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Screen Source Picker for Call */}
      {callScreenPickerOpen && (
        <ScreenSourcePicker
          onSelect={handleCallScreenSourceSelected}
          onCancel={() => setCallScreenPickerOpen(false)}
        />
      )}

      {/* Agent Chat Picker */}
      {agentChatModalOpen && !state.isCollapsed && (
        <div className={`${panelPos} w-72 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-3 max-h-80 overflow-y-auto`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare size={14} className="text-mission-control-accent" />
              Chat with Agent
            </h3>
            <button onClick={() => setAgentChatModalOpen(false)} className="p-1 hover:bg-mission-control-border rounded"><X size={14} /></button>
          </div>
          <div className="space-y-1">
            {fetchAgentList().filter(a => a.id !== 'voice').map(agent => (
              <button
                key={agent.id}
                onClick={() => handleStartAgentChat(agent)}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors text-sm hover:bg-mission-control-border"
              >
                <AgentAvatar agentId={agent.id} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs">{agent.name}</div>
                  <div className="text-[10px] text-mission-control-text-dim truncate">{agent.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Agent Chat Interface */}
      {agentChatOpen && chatAgent && (
        <div className={`${panelPos} w-[320px] bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-mission-control-bg/50 border-b border-mission-control-border">
            <div className="flex items-center gap-2">
              <AgentAvatar agentId={chatAgent.id} size="sm" />
              <div>
                <div className="text-xs font-semibold">{chatAgent.name}</div>
                <div className="text-[10px] text-mission-control-text-dim">{chatLoading ? 'Typing...' : 'Online'}</div>
              </div>
            </div>
            <button onClick={() => setAgentChatOpen(false)} className="p-1 hover:bg-mission-control-border rounded">
              <X size={12} />
            </button>
          </div>

          {/* Messages */}
          <div ref={chatScrollRef} className="h-[320px] overflow-y-auto px-3 py-2 space-y-2 text-xs">
            {chatMessages.length === 0 && !chatLoading && (
              <div className="flex items-center justify-center h-full text-mission-control-text-dim">
                Start a conversation with {chatAgent.name}
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-mission-control-accent/50 text-white'
                    : 'bg-mission-control-border/50 text-mission-control-text'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && chatMessages.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-mission-control-border/50 px-3 py-2 rounded-xl text-mission-control-text-dim">
                  <span className="animate-pulse">●●●</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-mission-control-border bg-mission-control-surface flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder={`Message ${chatAgent.name}...`}
              className="flex-1 bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-mission-control-accent"
            />
            <button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || chatLoading}
              className="p-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 disabled:opacity-40 transition-colors"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}

      {/* FEATURE 3: Context Chat Modal */}
      {contextChatOpen && !state.isCollapsed && (
        <ContextChatModal
          isOpen={contextChatOpen}
          onClose={() => setContextChatOpen(false)}
          currentView={currentView}
          onStartChat={handleContextChat}
          panelPos={panelPos}
        />
      )}

      {/* FEATURE 4: Task Shortcuts Modal */}
      {taskShortcutsOpen && !state.isCollapsed && (
        <TaskShortcutsModal
          isOpen={taskShortcutsOpen}
          onClose={() => setTaskShortcutsOpen(false)}
          panelPos={panelPos}
        />
      )}

      {/* ─── Toolbar Pill ─── */}
      <div
        className={`flex items-center gap-1 bg-mission-control-surface border border-mission-control-border rounded-full transition-all duration-300 px-1.5 py-1 ${
          isFloating ? 'shadow-none' : 'shadow-lg'
        } ${dragging ? 'cursor-grabbing shadow-2xl scale-105 opacity-90' : ''}`}
        style={isFloating ? noDrag : {}}
      >
        {/* Drag Handle */}
        <div
          className="drag-handle p-2 cursor-grab active:cursor-grabbing hover:bg-mission-control-border rounded-full transition-colors select-none"
          title="Drag to reposition"
          onMouseDown={isFloating ? undefined : handleMouseDown}
          style={isFloating ? dragStyle : {}}
        >
          <GripVertical size={16} className="text-mission-control-text-dim pointer-events-none" />
        </div>

        {state.isCollapsed ? (
          <>
            {/* Primary: Call button (collapsed) */}
            <button
              onClick={() => {
                closeAllModals();
                if (activeCall) { setCallDialogOpen(!callDialogOpen); }
                else { setAgentCallModalOpen(!agentCallModalOpen); }
              }}
              className={`p-2.5 rounded-full transition-colors ${
                callRinging ? 'bg-yellow-500 text-white animate-pulse'
                : activeCall ? 'bg-red-500 text-white' : 'bg-mission-control-accent text-white hover:bg-mission-control-accent/90'
              }`}
              title={activeCall ? activeCall.agentName : 'Call Agent'}
              style={isFloating ? noDrag : {}}
            >
              {activeCall ? <PhoneOff size={16} /> : <Phone size={16} />}
            </button>
            {activeCall && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-error" style={isFloating ? noDrag : {}}>
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {activeCall.agentName}
              </span>
            )}
            <button
              onClick={isFloating ? () => showToast('info', 'Pop-in not available in web mode') : handlePopOut}
              className="p-2 rounded-full hover:bg-mission-control-border transition-colors"
              title={isFloating ? 'Dock toolbar' : 'Pop out as floating window'}
              style={isFloating ? noDrag : {}}
            >
              <ExternalLink size={14} className="text-mission-control-text-dim" />
            </button>
            <button onClick={toggleCollapse} className="p-2 rounded-full hover:bg-mission-control-border transition-colors" title="Expand toolbar" style={isFloating ? noDrag : {}}>
              <ChevronLeft size={16} className="text-mission-control-text-dim" />
            </button>
          </>
        ) : (
          <>
            {/* Standard actions */}
            <button onClick={onSearch} className="p-2.5 rounded-full hover:bg-mission-control-border transition-colors" title="Search (⌘/)" style={isFloating ? noDrag : {}}>
              <Search size={16} className="text-mission-control-text-dim" />
            </button>
            <button onClick={onNewTask} className="p-2.5 rounded-full hover:bg-mission-control-border transition-colors" title="New Task" style={isFloating ? noDrag : {}}>
              <Plus size={16} className="text-mission-control-text-dim" />
            </button>
            {/* Context Chat */}
            <button
              onClick={() => { closeAllModals(); setContextChatOpen(!contextChatOpen); }}
              className={`p-2.5 rounded-full transition-colors ${contextChatOpen ? 'bg-mission-control-accent text-white' : 'hover:bg-mission-control-border'}`}
              title={`Chat about ${getViewLabel(currentView)}`}
              style={isFloating ? noDrag : {}}
            >
              <Sparkles size={16} className={contextChatOpen ? '' : 'text-mission-control-text-dim'} />
            </button>

            <div className="w-px h-6 bg-mission-control-border mx-0.5" style={isFloating ? noDrag : {}} />

            {/* Agent Chat button */}
            <button
              onClick={() => {
                closeAllModals();
                if (agentChatOpen) { setAgentChatOpen(false); }
                else { setAgentChatModalOpen(!agentChatModalOpen); }
              }}
              className={`p-2.5 rounded-full transition-colors ${
                agentChatOpen || agentChatModalOpen ? 'bg-mission-control-accent text-white' : 'hover:bg-mission-control-border'
              }`}
              title="Chat with Agent"
              style={isFloating ? noDrag : {}}
            >
              <MessageSquare size={16} className={agentChatOpen || agentChatModalOpen ? '' : 'text-mission-control-text-dim'} />
            </button>

            {/* Primary: Call button (was where meeting button was) */}
            <button
              onClick={() => {
                closeAllModals();
                if (activeCall) { setCallDialogOpen(!callDialogOpen); }
                else { setAgentCallModalOpen(!agentCallModalOpen); }
              }}
              className={`p-2.5 rounded-full transition-colors ${
                callRinging ? 'bg-yellow-500 text-white animate-pulse'
                : activeCall ? 'bg-red-500 text-white hover:bg-red-600'
                : agentCallModalOpen ? 'bg-mission-control-accent text-white'
                : 'bg-mission-control-accent text-white hover:bg-mission-control-accent/90'
              }`}
              title={activeCall ? `In call with ${activeCall.agentName}` : 'Call Agent'}
              style={isFloating ? noDrag : {}}
            >
              {activeCall ? <PhoneOff size={16} /> : <Phone size={16} />}
            </button>

            <div className="w-px h-6 bg-mission-control-border mx-0.5" style={isFloating ? noDrag : {}} />
            <button
              onClick={isFloating ? () => showToast('info', 'Pop-in not available in web mode') : handlePopOut}
              className="p-2 rounded-full hover:bg-mission-control-border transition-colors"
              title={isFloating ? 'Dock toolbar' : 'Pop out as floating window'}
              style={isFloating ? noDrag : {}}
            >
              <ExternalLink size={14} className="text-mission-control-text-dim" />
            </button>
            <button onClick={toggleCollapse} className="p-2 rounded-full hover:bg-mission-control-border transition-colors" title="Collapse toolbar" style={isFloating ? noDrag : {}}>
              <ChevronRight size={16} className="text-mission-control-text-dim" />
            </button>
            {!isFloating && (
              <button onClick={resetPosition} className="p-2 rounded-full hover:bg-mission-control-border transition-colors" title="Reset position">
                <RotateCcw size={14} className="text-mission-control-text-dim" />
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  if (isFloating) {
    return (
      <div className="relative w-full h-full pointer-events-none">
        <div
          ref={toolbarRef}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 relative pointer-events-auto"
          role="presentation"
          onMouseEnter={() => undefined}
          onMouseLeave={() => undefined}
        >
          {pillContent}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={toolbarRef}
      className={`fixed z-40 ${dragging ? '' : 'transition-all duration-300 ease-out'}`}
      style={{ ...snapStyle, position: 'fixed' }}
    >
      {pillContent}
    </div>
  );
});

QuickActions.displayName = 'QuickActions';
export default QuickActions;
