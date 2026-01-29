import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, MessageSquare, CheckCircle, Search, Zap, Send, X, UserPlus, Brain, ChevronLeft, ChevronRight, GripVertical, RotateCcw } from 'lucide-react';
import { showToast } from './Toast';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

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

type SnapEdge = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'right' | 'left' | 'top' | 'bottom';

interface ToolbarState {
  isCollapsed: boolean;
  position: { x: number; y: number };
  snapEdge: SnapEdge;
}

const SNAP_THRESHOLD = 100; // pixels from edge to snap
const DEFAULT_STATE: ToolbarState = {
  isCollapsed: false,
  position: { x: 0, y: 0 },
  snapEdge: 'bottom-right',
};

const QuickActions = forwardRef<QuickActionsRef, QuickActionsProps>(({ onNewTask, onSearch, onApproveAll, onAddContact, onAddSkill }, ref) => {
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [toolbarState, setToolbarState] = useState<ToolbarState>(() => {
    const saved = localStorage.getItem('quickActionsState');
    return saved ? JSON.parse(saved) : DEFAULT_STATE;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('quickActionsState', JSON.stringify(toolbarState));
  }, [toolbarState]);

  // Expose openQuickMessage via ref
  useImperativeHandle(ref, () => ({
    openQuickMessage: () => setQuickMessageOpen(true),
  }));

  // Focus input when opened
  useEffect(() => {
    if (quickMessageOpen) {
      const textarea = document.querySelector('textarea[placeholder*="Froggo"]') as HTMLTextAreaElement;
      textarea?.focus();
    }
  }, [quickMessageOpen]);

  // Determine snap edge based on position
  const determineSnapEdge = (x: number, y: number): SnapEdge => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const distanceToRight = windowWidth - x;
    const distanceToLeft = x;
    const distanceToBottom = windowHeight - y;
    const distanceToTop = y;

    if (distanceToRight < SNAP_THRESHOLD && distanceToBottom < SNAP_THRESHOLD) return 'bottom-right';
    if (distanceToLeft < SNAP_THRESHOLD && distanceToBottom < SNAP_THRESHOLD) return 'bottom-left';
    if (distanceToRight < SNAP_THRESHOLD && distanceToTop < SNAP_THRESHOLD) return 'top-right';
    if (distanceToLeft < SNAP_THRESHOLD && distanceToTop < SNAP_THRESHOLD) return 'top-left';
    if (distanceToRight < SNAP_THRESHOLD) return 'right';
    if (distanceToLeft < SNAP_THRESHOLD) return 'left';
    if (distanceToTop < SNAP_THRESHOLD) return 'top';
    if (distanceToBottom < SNAP_THRESHOLD) return 'bottom';
    
    return 'bottom-right'; // default
  };

  // Handle drag stop - snap to edges
  const handleDragStop = (_e: DraggableEvent, data: DraggableData) => {
    setIsDragging(false);
    const snapEdge = determineSnapEdge(data.x, data.y);
    
    setToolbarState(prev => ({
      ...prev,
      position: { x: data.x, y: data.y },
      snapEdge,
    }));
  };

  const toggleCollapse = () => {
    setToolbarState(prev => ({
      ...prev,
      isCollapsed: !prev.isCollapsed,
    }));
  };

  const resetPosition = () => {
    setToolbarState(DEFAULT_STATE);
    showToast('success', 'Position Reset', 'Toolbar moved to default position');
  };

  const handleQuickMessage = async () => {
    if (!quickMessage.trim()) return;
    
    setSending(true);
    try {
      // Send via gateway
      const response = await fetch('http://localhost:18789/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: quickMessage,
          sessionKey: 'web:dashboard',
        }),
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

  // Get positioning classes based on snap edge
  const getPositionClasses = () => {
    if (isDragging) return '';
    
    switch (toolbarState.snapEdge) {
      case 'bottom-right': return 'bottom-6 right-6';
      case 'bottom-left': return 'bottom-6 left-6';
      case 'top-right': return 'top-6 right-6';
      case 'top-left': return 'top-6 left-6';
      case 'right': return 'top-1/2 -translate-y-1/2 right-6';
      case 'left': return 'top-1/2 -translate-y-1/2 left-6';
      case 'top': return 'top-6 left-1/2 -translate-x-1/2';
      case 'bottom': return 'bottom-6 left-1/2 -translate-x-1/2';
      default: return 'bottom-6 right-6';
    }
  };

  return (
    <Draggable
      position={toolbarState.position}
      onStop={handleDragStop}
      onStart={() => setIsDragging(true)}
      handle=".drag-handle"
    >
      <div 
        className={`fixed z-40 transition-all duration-300 ${!isDragging ? getPositionClasses() : ''}`}
        style={isDragging ? undefined : { position: 'fixed' }}
      >
        {/* Quick Message Modal */}
        {quickMessageOpen && !toolbarState.isCollapsed && (
          <div className="absolute bottom-full mb-2 right-0 w-80 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-4">
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
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleQuickMessage();
                }
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
          className={`flex items-center gap-2 bg-clawd-surface border border-clawd-border rounded-full shadow-lg transition-all duration-300 ${
            toolbarState.isCollapsed ? 'px-2 py-1.5' : 'px-2 py-1.5'
          } ${isDragging ? 'cursor-grabbing shadow-2xl' : ''}`}
        >
          {/* Drag Handle */}
          <div 
            className="drag-handle p-2 cursor-grab hover:bg-clawd-border rounded-full transition-colors"
            title="Drag to reposition"
          >
            <GripVertical size={16} className="text-clawd-text-dim" />
          </div>

          {/* Collapsed State - Just the lightning icon */}
          {toolbarState.isCollapsed ? (
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
              {/* Expanded State - All icons */}
              <button
                onClick={onSearch}
                className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
                title="Search (⌘/)"
              >
                <Search size={16} className="text-clawd-text-dim" />
              </button>
              
              <button
                onClick={onNewTask}
                className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
                title="New Task"
              >
                <Plus size={16} className="text-clawd-text-dim" />
              </button>

              {onAddContact && (
                <button
                  onClick={onAddContact}
                  className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
                  title="Add Contact (⌘⇧N)"
                >
                  <UserPlus size={16} className="text-clawd-text-dim" />
                </button>
              )}

              {onAddSkill && (
                <button
                  onClick={onAddSkill}
                  className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
                  title="Add Skill (⌘⇧K)"
                >
                  <Brain size={16} className="text-clawd-text-dim" />
                </button>
              )}
              
              <button
                onClick={() => setQuickMessageOpen(!quickMessageOpen)}
                className={`p-2.5 rounded-full transition-colors ${
                  quickMessageOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'
                }`}
                title="Quick Message"
              >
                <MessageSquare size={16} className={quickMessageOpen ? '' : 'text-clawd-text-dim'} />
              </button>
              
              <button
                onClick={onApproveAll}
                className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
                title="Approve All Pending"
              >
                <CheckCircle size={16} className="text-clawd-text-dim" />
              </button>
              
              <div className="w-px h-6 bg-clawd-border mx-1" />
              
              <button
                className="p-2.5 rounded-full bg-clawd-accent text-white hover:bg-clawd-accent/90 transition-colors"
                title="Froggo"
              >
                <Zap size={16} />
              </button>

              <div className="w-px h-6 bg-clawd-border mx-1" />

              {/* Collapse button */}
              <button
                onClick={toggleCollapse}
                className="p-2 rounded-full hover:bg-clawd-border transition-colors"
                title="Collapse toolbar"
              >
                <ChevronRight size={16} className="text-clawd-text-dim" />
              </button>

              {/* Reset position button */}
              <button
                onClick={resetPosition}
                className="p-2 rounded-full hover:bg-clawd-border transition-colors"
                title="Reset position"
              >
                <RotateCcw size={16} className="text-clawd-text-dim" />
              </button>
            </>
          )}
        </div>
      </div>
    </Draggable>
  );
});

QuickActions.displayName = 'QuickActions';
export default QuickActions;
