import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Plus, MessageSquare, CheckCircle, Search, Zap, Send, X, UserPlus, Brain,
  ChevronLeft, ChevronRight, GripVertical, RotateCcw, Mic, MicOff, Phone, PhoneOff,
  Video, Users, ListTodo, Play, Pause, Square, ArrowRight, Sparkles,
} from 'lucide-react';
import { showToast } from './Toast';
import { useStore } from '../store/store';
import AgentAvatar from './AgentAvatar';
import { CHAT_AGENTS, ChatAgent } from './AgentSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  onNewTask: () => void;
  onSearch: () => void;
  onApproveAll: () => void;
  onAddContact?: () => void;
  onAddSkill?: () => void;
  onNavigate?: (view: string) => void;
  currentView?: string;
}

export interface QuickActionsRef {
  openQuickMessage: () => void;
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
  agents: ['hr', 'chief', 'lead-engineer'],
  dashboard: ['froggo', 'chief', 'coder'],
  settings: ['coder', 'lead-engineer', 'froggo'],
  twitter: ['social-manager', 'growth-director', 'writer'],
  inbox: ['froggo', 'chief', 'writer'],
  meetings: ['froggo', 'voice', 'chief'],
  voicechat: ['voice', 'froggo', 'chief'],
  accounts: ['froggo', 'chief', 'hr'],
  approvals: ['clara', 'chief', 'hr'],
  library: ['researcher', 'writer', 'coder'],
  context: ['coder', 'lead-engineer', 'researcher'],
};

// Task quick-status options
const TASK_STATUSES = [
  { label: 'To Do', value: 'todo', icon: ListTodo, color: 'text-gray-400' },
  { label: 'In Progress', value: 'in-progress', icon: Play, color: 'text-blue-400' },
  { label: 'Review', value: 'review', icon: Search, color: 'text-yellow-400' },
  { label: 'Done', value: 'done', icon: CheckCircle, color: 'text-green-400' },
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
    twitter: 'Twitter', inbox: 'Inbox', meetings: 'Meetings', voicechat: 'Voice Chat',
    accounts: 'Accounts', approvals: 'Approvals', library: 'Library', context: 'Context',
    settings: 'Settings', contacts: 'Contacts', calendar: 'Calendar',
  };
  return labels[view] || view.charAt(0).toUpperCase() + view.slice(1);
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

/** FEATURE 2: Agent selection modal for voice calls */
function AgentCallModal({ isOpen, onClose, onSelect, activeCall }: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (agent: ChatAgent) => void;
  activeCall: { agentId: string; agentName: string } | null;
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute w-72 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-3 bottom-full mb-2 right-0 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Phone size={14} className="text-clawd-accent" />
          {activeCall ? 'Active Call' : 'Call Agent'}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
      </div>
      {activeCall && (
        <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400">In call with {activeCall.agentName}</span>
        </div>
      )}
      <div className="space-y-1">
        {CHAT_AGENTS.filter(a => a.id !== 'voice').map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors text-sm ${
              activeCall?.agentId === agent.id
                ? 'bg-red-500/10 border border-red-500/30'
                : 'hover:bg-clawd-border'
            }`}
          >
            <AgentAvatar agentId={agent.id} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs">{agent.name}</div>
              <div className="text-[10px] text-clawd-text-dim truncate">{agent.role}</div>
            </div>
            {activeCall?.agentId === agent.id && (
              <PhoneOff size={14} className="text-red-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** FEATURE 3: Context-aware agent chat modal */
function ContextChatModal({ isOpen, onClose, currentView, onStartChat }: {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onStartChat: (agent: ChatAgent, context: string) => void;
}) {
  const [message, setMessage] = useState('');
  const suggestedAgentIds = VIEW_AGENT_SUGGESTIONS[currentView] || ['froggo', 'chief', 'coder'];
  const suggestedAgents = suggestedAgentIds
    .map(id => CHAT_AGENTS.find(a => a.id === id))
    .filter(Boolean) as ChatAgent[];
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent>(suggestedAgents[0]);
  const [showAllAgents, setShowAllAgents] = useState(false);

  if (!isOpen) return null;

  const viewLabel = getViewLabel(currentView);

  return (
    <div className="absolute w-80 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-4 bottom-full mb-2 right-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles size={14} className="text-clawd-accent" />
          Context Chat
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
      </div>

      {/* Context indicator */}
      <div className="mb-3 p-2 bg-clawd-accent/10 border border-clawd-accent/20 rounded-lg">
        <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider">Current Context</div>
        <div className="text-xs font-medium text-clawd-accent">{viewLabel}</div>
      </div>

      {/* Suggested agents */}
      <div className="mb-3">
        <div className="text-[10px] text-clawd-text-dim uppercase tracking-wider mb-1.5">
          Suggested for {viewLabel}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {suggestedAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
                selectedAgent.id === agent.id
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border hover:bg-clawd-border/80'
              }`}
            >
              <AgentAvatar agentId={agent.id} size="xs" />
              {agent.name}
            </button>
          ))}
          <button
            onClick={() => setShowAllAgents(!showAllAgents)}
            className="px-2 py-1 rounded-full text-xs bg-clawd-border hover:bg-clawd-border/80 transition-colors"
          >
            {showAllAgents ? 'Less' : 'More...'}
          </button>
        </div>
        {showAllAgents && (
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {CHAT_AGENTS.filter(a => !suggestedAgentIds.includes(a.id)).map(agent => (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setShowAllAgents(false); }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${
                  selectedAgent.id === agent.id
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-border hover:bg-clawd-border/80'
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
        className="w-full h-20 bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-clawd-accent"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && message.trim()) {
            onStartChat(selectedAgent, message);
            setMessage('');
            onClose();
          }
        }}
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-clawd-text-dim">⌘+Enter to send</span>
        <button
          onClick={() => {
            if (message.trim()) {
              onStartChat(selectedAgent, message);
              setMessage('');
              onClose();
            }
          }}
          disabled={!message.trim()}
          className="flex items-center gap-2 px-3 py-1.5 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 disabled:opacity-50 text-sm"
        >
          <Send size={12} />
          Chat with {selectedAgent.name}
        </button>
      </div>
    </div>
  );
}

/** FEATURE 4: Task status shortcuts modal */
function TaskShortcutsModal({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [recentTasks, setRecentTasks] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    // Fetch recent tasks from froggo-db via gateway
    fetch('http://localhost:18789/api/tasks?limit=5&status=in-progress')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRecentTasks(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => setRecentTasks([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`http://localhost:18789/api/tasks/${taskId}/status`, {
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
    <div className="absolute w-72 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-3 bottom-full mb-2 right-0 max-h-80 overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ListTodo size={14} className="text-clawd-accent" />
          Task Shortcuts
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-clawd-border rounded"><X size={14} /></button>
      </div>

      {/* Quick status filters */}
      <div className="flex gap-1 mb-2">
        {TASK_STATUSES.map(s => (
          <button
            key={s.value}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-clawd-border hover:bg-clawd-border/80 transition-colors"
            title={`View ${s.label} tasks`}
          >
            <s.icon size={10} className={s.color} />
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-4 text-xs text-clawd-text-dim">Loading tasks...</div>
      ) : recentTasks.length === 0 ? (
        <div className="text-center py-4 text-xs text-clawd-text-dim">No active tasks</div>
      ) : (
        <div className="space-y-1.5">
          {recentTasks.map(task => (
            <div key={task.id} className="p-2 bg-clawd-bg rounded-lg">
              <div className="text-xs font-medium truncate mb-1">{task.title}</div>
              <div className="flex gap-1">
                {TASK_STATUSES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => updateTaskStatus(task.id, s.value)}
                    className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                      task.status === s.value
                        ? 'bg-clawd-accent text-white'
                        : 'bg-clawd-border hover:bg-clawd-border/80 text-clawd-text-dim'
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
  onNewTask, onSearch, onApproveAll, onAddContact, onAddSkill, onNavigate, currentView = 'dashboard',
}, ref) => {
  const { isMuted, toggleMuted, isMeetingActive, toggleMeeting } = useStore();

  // Toolbar state
  const [state, setState] = useState<ToolbarState>(loadState);
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

  // FEATURE 2: Call persistence
  const [activeCall, setActiveCall] = useState<{ agentId: string; agentName: string } | null>(loadActiveCall);

  // Close all modals helper
  const closeAllModals = () => {
    setQuickMessageOpen(false);
    setAgentCallModalOpen(false);
    setContextChatOpen(false);
    setTaskShortcutsOpen(false);
  };

  // Persist toolbar state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useImperativeHandle(ref, () => ({
    openQuickMessage: () => { closeAllModals(); setQuickMessageOpen(true); },
  }));

  useEffect(() => {
    if (quickMessageOpen) {
      const textarea = document.querySelector('textarea[placeholder*="Froggo"]') as HTMLTextAreaElement;
      textarea?.focus();
    }
  }, [quickMessageOpen]);

  // ─── FEATURE 1: Meeting navigation ───
  const handleMeetingClick = () => {
    if (isMeetingActive) {
      // Already in meeting → navigate to meetings tab
      onNavigate?.('meetings');
    } else {
      // Start meeting + navigate
      toggleMeeting();
      onNavigate?.('meetings');
      showToast('success', 'Meeting Started', 'Navigated to meetings');
    }
  };

  // ─── FEATURE 2: Agent call handling ───
  const handleAgentCall = (agent: ChatAgent) => {
    if (activeCall?.agentId === agent.id) {
      // End call with this agent
      setActiveCall(null);
      saveActiveCall(null);
      if (isMeetingActive) toggleMeeting();
      showToast('success', 'Call Ended', `Disconnected from ${agent.name}`);
    } else {
      // Start call with agent
      const call = { agentId: agent.id, agentName: agent.name };
      setActiveCall(call);
      saveActiveCall(call);
      if (!isMeetingActive) toggleMeeting();
      showToast('success', 'Calling...', `Connected to ${agent.name}`);
    }
    setAgentCallModalOpen(false);
  };

  // ─── FEATURE 3: Context-aware chat ───
  const handleContextChat = async (agent: ChatAgent, message: string) => {
    const contextPrefix = `[Context: viewing ${getViewLabel(currentView)}] `;
    const fullMessage = contextPrefix + message;
    try {
      const response = await fetch('http://localhost:18789/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullMessage, sessionKey: agent.sessionKey }),
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
  const resetPosition = () => {
    setState(DEFAULT_STATE);
    showToast('success', 'Position Reset', 'Toolbar moved to default position');
  };

  const handleQuickMessage = async () => {
    if (!quickMessage.trim()) return;
    setSending(true);
    try {
      const response = await fetch('http://localhost:18789/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: quickMessage, sessionKey: 'web:dashboard' }),
      });
      if (response.ok) {
        showToast('success', 'Message sent', 'Froggo will respond in chat');
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

  return (
    <div
      ref={toolbarRef}
      className={`fixed z-40 ${dragging ? '' : 'transition-all duration-300 ease-out'}`}
      style={{ ...snapStyle, position: 'fixed' }}
    >
      {/* ─── Modals (positioned above/below toolbar based on snap edge) ─── */}

      {/* Quick Message Modal */}
      {quickMessageOpen && !state.isCollapsed && (
        <div className={`absolute w-80 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-4 ${
          isTop ? 'top-full mt-2' : 'bottom-full mb-2'
        } ${isLeft ? 'left-0' : 'right-0'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <MessageSquare size={16} className="text-clawd-accent" />
              Quick Message
            </h3>
            <button onClick={() => setQuickMessageOpen(false)} className="p-1 hover:bg-clawd-border rounded">
              <X size={16} />
            </button>
          </div>
          <textarea
            value={quickMessage}
            onChange={e => setQuickMessage(e.target.value)}
            placeholder="Ask Froggo something quick..."
            className="w-full h-24 bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-clawd-accent"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuickMessage();
            }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleQuickMessage}
              disabled={!quickMessage.trim() || sending}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* FEATURE 2: Agent Call Modal */}
      {agentCallModalOpen && !state.isCollapsed && (
        <div className={`absolute ${isTop ? 'top-full mt-2' : 'bottom-full mb-2'} ${isLeft ? 'left-0' : 'right-0'}`}>
          <AgentCallModal
            isOpen={agentCallModalOpen}
            onClose={() => setAgentCallModalOpen(false)}
            onSelect={handleAgentCall}
            activeCall={activeCall}
          />
        </div>
      )}

      {/* FEATURE 3: Context Chat Modal */}
      {contextChatOpen && !state.isCollapsed && (
        <div className={`absolute ${isTop ? 'top-full mt-2' : 'bottom-full mb-2'} ${isLeft ? 'left-0' : 'right-0'}`}>
          <ContextChatModal
            isOpen={contextChatOpen}
            onClose={() => setContextChatOpen(false)}
            currentView={currentView}
            onStartChat={handleContextChat}
          />
        </div>
      )}

      {/* FEATURE 4: Task Shortcuts Modal */}
      {taskShortcutsOpen && !state.isCollapsed && (
        <div className={`absolute ${isTop ? 'top-full mt-2' : 'bottom-full mb-2'} ${isLeft ? 'left-0' : 'right-0'}`}>
          <TaskShortcutsModal
            isOpen={taskShortcutsOpen}
            onClose={() => setTaskShortcutsOpen(false)}
          />
        </div>
      )}

      {/* ─── Toolbar ─── */}
      <div
        className={`flex items-center gap-1 bg-clawd-surface border border-clawd-border rounded-full shadow-lg transition-all duration-300 px-1.5 py-1 ${
          dragging ? 'cursor-grabbing shadow-2xl scale-105 opacity-90' : ''
        }`}
      >
        {/* Drag Handle */}
        <div
          className="drag-handle p-2 cursor-grab active:cursor-grabbing hover:bg-clawd-border rounded-full transition-colors select-none"
          title="Drag to reposition"
          onMouseDown={handleMouseDown}
        >
          <GripVertical size={16} className="text-clawd-text-dim pointer-events-none" />
        </div>

        {state.isCollapsed ? (
          <>
            {/* FEATURE 1: Meeting icon (collapsed) */}
            <button
              onClick={handleMeetingClick}
              className={`p-2.5 rounded-full transition-colors ${
                isMeetingActive ? 'bg-green-500 text-white animate-pulse' : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
              }`}
              title={isMeetingActive ? 'Go to Meeting' : 'Start Meeting'}
            >
              <Video size={16} />
            </button>
            {/* FEATURE 5: Active call indicator (collapsed) */}
            {activeCall && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {activeCall.agentName}
              </span>
            )}
            <button
              onClick={toggleCollapse}
              className="p-2 rounded-full hover:bg-clawd-border transition-colors"
              title="Expand toolbar"
            >
              <ChevronLeft size={16} className="text-clawd-text-dim" />
            </button>
          </>
        ) : (
          <>
            {/* Standard actions */}
            <button onClick={onSearch} className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" title="Search (⌘/)">
              <Search size={16} className="text-clawd-text-dim" />
            </button>
            <button onClick={onNewTask} className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" title="New Task">
              <Plus size={16} className="text-clawd-text-dim" />
            </button>
            {onAddContact && (
              <button onClick={onAddContact} className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" title="Add Contact (⌘⇧N)">
                <UserPlus size={16} className="text-clawd-text-dim" />
              </button>
            )}
            {onAddSkill && (
              <button onClick={onAddSkill} className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" title="Add Skill (⌘⇧K)">
                <Brain size={16} className="text-clawd-text-dim" />
              </button>
            )}

            {/* Quick Message */}
            <button
              onClick={() => { closeAllModals(); setQuickMessageOpen(!quickMessageOpen); }}
              className={`p-2.5 rounded-full transition-colors ${quickMessageOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'}`}
              title="Quick Message"
            >
              <MessageSquare size={16} className={quickMessageOpen ? '' : 'text-clawd-text-dim'} />
            </button>

            {/* FEATURE 3: Context Chat */}
            <button
              onClick={() => { closeAllModals(); setContextChatOpen(!contextChatOpen); }}
              className={`p-2.5 rounded-full transition-colors ${contextChatOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'}`}
              title={`Chat about ${getViewLabel(currentView)}`}
            >
              <Sparkles size={16} className={contextChatOpen ? '' : 'text-clawd-text-dim'} />
            </button>

            {/* FEATURE 4: Task Shortcuts */}
            <button
              onClick={() => { closeAllModals(); setTaskShortcutsOpen(!taskShortcutsOpen); }}
              className={`p-2.5 rounded-full transition-colors ${taskShortcutsOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'}`}
              title="Task Shortcuts"
            >
              <ListTodo size={16} className={taskShortcutsOpen ? '' : 'text-clawd-text-dim'} />
            </button>

            <button onClick={onApproveAll} className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" title="Approve All Pending">
              <CheckCircle size={16} className="text-clawd-text-dim" />
            </button>

            <div className="w-px h-6 bg-clawd-border mx-0.5" />

            {/* ─── Voice & Meeting Section ─── */}

            {/* Active call indicator */}
            {activeCall && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                {activeCall.agentName}
              </span>
            )}

            {/* Live meeting indicator */}
            {isMeetingActive && !activeCall && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Live
              </span>
            )}

            {/* Mute toggle */}
            <button
              onClick={toggleMuted}
              className={`p-2.5 rounded-full transition-colors ${
                isMuted ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-clawd-border'
              }`}
              title={isMuted ? 'Unmute (⌘M)' : 'Mute (⌘M)'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} className="text-clawd-text-dim" />}
            </button>

            {/* FEATURE 2: Agent call button — RED with line-through when active */}
            <button
              onClick={() => { closeAllModals(); setAgentCallModalOpen(!agentCallModalOpen); }}
              className={`p-2.5 rounded-full transition-colors relative ${
                activeCall
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : agentCallModalOpen
                    ? 'bg-clawd-accent text-white'
                    : 'hover:bg-clawd-border'
              }`}
              title={activeCall ? `In call with ${activeCall.agentName} — click to manage` : 'Call an agent'}
            >
              <Phone size={16} className={!activeCall && !agentCallModalOpen ? 'text-clawd-text-dim' : ''} />
              {/* FEATURE 5: Line-through indicator for active calls */}
              {activeCall && (
                <span
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-hidden="true"
                >
                  <span className="w-5 h-0.5 bg-white rounded-full rotate-45" />
                </span>
              )}
            </button>

            {/* FEATURE 1: Meeting icon — replaces old Zap icon */}
            <button
              onClick={handleMeetingClick}
              className={`p-2.5 rounded-full transition-colors ${
                isMeetingActive
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
              }`}
              title={isMeetingActive ? 'Go to Meeting' : 'Start Meeting'}
            >
              <Video size={16} />
            </button>

            <div className="w-px h-6 bg-clawd-border mx-0.5" />
            <button onClick={toggleCollapse} className="p-2 rounded-full hover:bg-clawd-border transition-colors" title="Collapse toolbar">
              <ChevronRight size={16} className="text-clawd-text-dim" />
            </button>
            <button onClick={resetPosition} className="p-2 rounded-full hover:bg-clawd-border transition-colors" title="Reset position">
              <RotateCcw size={14} className="text-clawd-text-dim" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

QuickActions.displayName = 'QuickActions';
export default QuickActions;
