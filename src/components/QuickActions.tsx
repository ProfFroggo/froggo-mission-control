import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, MessageSquare, CheckCircle, Search, Zap, Send, X, UserPlus, Brain, ChevronLeft, ChevronRight, GripVertical, RotateCcw } from 'lucide-react';
import { showToast } from './Toast';

interface QuickActionsProps {
  onNewTask: () => void;
  onSearch: () => void;
  onApproveAll: () => void;
  onAddContact?: () => void;
  onAddSkill?: () => void;
}

export interface QuickActionsRef {
  openQuickMessage: () => void;
}

type SnapEdge = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface ToolbarState {
  isCollapsed: boolean;
  snapEdge: SnapEdge;
}

const STORAGE_KEY = 'quickActionsState';
const EDGE_MARGIN = 24; // px from edge

const DEFAULT_STATE: ToolbarState = {
  isCollapsed: false,
  snapEdge: 'bottom-right',
};

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

const QuickActions = forwardRef<QuickActionsRef, QuickActionsProps>(({ onNewTask, onSearch, onApproveAll, onAddContact, onAddSkill }, ref) => {
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<ToolbarState>(loadState);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; elX: number; elY: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useImperativeHandle(ref, () => ({
    openQuickMessage: () => setQuickMessageOpen(true),
  }));

  useEffect(() => {
    if (quickMessageOpen) {
      const textarea = document.querySelector('textarea[placeholder*="Froggo"]') as HTMLTextAreaElement;
      textarea?.focus();
    }
  }, [quickMessageOpen]);

  // Drag handlers
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
      const dx = e.clientX - start.mouseX;
      const dy = e.clientY - start.mouseY;
      setDragPos({ x: start.elX + dx, y: start.elY + dy });
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
      const centerX = finalX + w / 2;
      const centerY = finalY + h / 2;
      const edge = nearestSnapEdge(centerX, centerY);
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

  // Compute the popover position relative to snap edge
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
      {/* Quick Message Modal */}
      {quickMessageOpen && !state.isCollapsed && (
        <div
          className={`absolute w-80 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-4 ${
            isTop ? 'top-full mt-2' : 'bottom-full mb-2'
          } ${isLeft ? 'left-0' : 'right-0'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium flex items-center gap-2">
              <MessageSquare size={16} className="text-clawd-accent" />
              Quick Message
            </h3>
            <button
              onClick={() => setQuickMessageOpen(false)}
              className="p-1 hover:bg-clawd-border rounded"
            >
              <X size={16} />
            </button>
          </div>
          <textarea
            value={quickMessage}
            onChange={(e) => setQuickMessage(e.target.value)}
            placeholder="Ask Froggo something quick..."
            className="w-full h-24 bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-clawd-accent"
            onKeyDown={(e) => {
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

      {/* Toolbar */}
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
            <button
              className="p-2.5 rounded-full bg-clawd-accent text-white hover:bg-clawd-accent/90 transition-colors"
              title="Froggo"
            >
              <Zap size={16} />
            </button>
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
            <button
              onClick={() => setQuickMessageOpen(!quickMessageOpen)}
              className={`p-2.5 rounded-full transition-colors ${quickMessageOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'}`}
              title="Quick Message"
            >
              <MessageSquare size={16} className={quickMessageOpen ? '' : 'text-clawd-text-dim'} />
            </button>
            <button onClick={onApproveAll} className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" title="Approve All Pending">
              <CheckCircle size={16} className="text-clawd-text-dim" />
            </button>
            <div className="w-px h-6 bg-clawd-border mx-0.5" />
            <button className="p-2.5 rounded-full bg-clawd-accent text-white hover:bg-clawd-accent/90 transition-colors" title="Froggo">
              <Zap size={16} />
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
