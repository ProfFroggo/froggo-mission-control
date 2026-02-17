import { useState, useEffect } from 'react';
import {
  Phone, PhoneOff, X, GripVertical, Search, Plus, UserPlus, Brain,
  Sparkles, ListTodo, MessageSquare, ChevronLeft, ChevronRight, ExternalLink
} from 'lucide-react';
import { showToast } from './Toast';

type ToolbarMode = 'collapsed' | 'expanded';

export default function FloatingToolbar() {
  const [activeCall] = useState<{agentName: string} | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [agentCallModalOpen, setAgentCallModalOpen] = useState(false);
  const [mode, setMode] = useState<ToolbarMode>('expanded');
  const [agentChatOpen, setAgentChatOpen] = useState(false);
  const [agentChatModalOpen, setAgentChatModalOpen] = useState(false);
  const [contextChatOpen, setContextChatOpen] = useState(false);
  const [taskShortcutsOpen, setTaskShortcutsOpen] = useState(false);
  const [callRinging] = useState(false);
  
  useEffect(() => {
    // Listen for toolbar closed event
    const cleanup = window.clawdbot?.toolbar?.onClosed(() => {
      // Floating window was closed from outside
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);
  
  const handlePopIn = async () => {
    try {
      if (!window.clawdbot?.toolbar) {
        showToast('error', 'Pop-in Failed', 'Toolbar API not available');
        return;
      }

      const result = await window.clawdbot.toolbar.popIn();

      if (result.success) {
        // Window will close automatically
      } else {
        showToast('error', 'Pop-in Failed', result.error || 'Could not dock toolbar');
      }
    } catch (error) {
      console.error('Pop-in error:', error);
      showToast('error', 'Pop-in Failed', 'An error occurred');
    }
  };
  
  const handleClose = async () => {
    try {
      // Use popIn to dock back, then close; fallback to window.close()
      if (window.clawdbot?.toolbar) {
        await window.clawdbot.toolbar.popIn();
      } else {
        window.close();
      }
    } catch (error) {
      console.error('Close error:', error);
      window.close();
    }
  };
  
  const toggleMode = () => {
    setMode(prev => prev === 'collapsed' ? 'expanded' : 'collapsed');
  };
  
  const closeAllModals = () => {
    setCallDialogOpen(false);
    setAgentCallModalOpen(false);
    setAgentChatOpen(false);
    setAgentChatModalOpen(false);
    setContextChatOpen(false);
    setTaskShortcutsOpen(false);
  };
  
  const handleCall = () => {
    closeAllModals();
    if (activeCall) {
      setCallDialogOpen(!callDialogOpen);
    } else {
      setAgentCallModalOpen(!agentCallModalOpen);
    }
  };
  
  // Mock handlers for toolbar actions (these would communicate with main window)
  const handleSearch = () => {
    showToast('info', 'Search', 'Search would open in main window');
  };
  
  const handleNewTask = () => {
    showToast('info', 'New Task', 'New task would open in main window');
  };
  
  const handleContextChat = () => {
    closeAllModals();
    setContextChatOpen(!contextChatOpen);
  };
  
  const handleTaskShortcuts = () => {
    closeAllModals();
    setTaskShortcutsOpen(!taskShortcutsOpen);
  };
  
  const handleAgentChat = () => {
    closeAllModals();
    if (agentChatOpen) {
      setAgentChatOpen(false);
    } else {
      setAgentChatModalOpen(!agentChatModalOpen);
    }
  };
  
  return (
    <div className="h-full w-full flex items-center justify-center bg-transparent p-4">
      {/* Main Toolbar - matches in-app toolbar styling exactly */}
      <div
        className={`flex items-center gap-1 bg-clawd-surface border border-clawd-border rounded-full shadow-2xl transition-all duration-300 px-1.5 py-1`}
      >
        {/* Drag Handle */}
        <div
          className="p-2 cursor-grab active:cursor-grabbing hover:bg-clawd-border rounded-full transition-colors select-none"
          title="Drag to reposition"
        >
          <GripVertical size={16} className="text-clawd-text-dim pointer-events-none" />
        </div>

        {mode === 'collapsed' ? (
          <>
            {/* Primary: Call button (collapsed) */}
            <button
              onClick={handleCall}
              className={`p-2.5 rounded-full transition-colors ${
                callRinging ? 'bg-yellow-500 text-white animate-pulse'
                : activeCall ? 'bg-red-500 text-white' : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
              }`}
              title={activeCall ? activeCall.agentName : 'Call Agent'}
            >
              {activeCall ? <PhoneOff size={16} /> : <Phone size={16} />}
            </button>
            {activeCall && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-error">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {activeCall.agentName}
              </span>
            )}
            <button 
              onClick={handlePopIn} 
              className="p-2 rounded-full hover:bg-clawd-border transition-colors" 
              title="Dock toolbar back"
            >
              <ExternalLink size={14} className="text-clawd-text-dim" />
            </button>
            <button 
              onClick={toggleMode} 
              className="p-2 rounded-full hover:bg-clawd-border transition-colors" 
              title="Expand toolbar"
            >
              <ChevronLeft size={16} className="text-clawd-text-dim" />
            </button>
          </>
        ) : (
          <>
            {/* Standard actions */}
            <button 
              onClick={handleSearch} 
              className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" 
              title="Search"
            >
              <Search size={16} className="text-clawd-text-dim" />
            </button>
            <button 
              onClick={handleNewTask} 
              className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" 
              title="New Task"
            >
              <Plus size={16} className="text-clawd-text-dim" />
            </button>
            <button 
              className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" 
              title="Add Contact"
            >
              <UserPlus size={16} className="text-clawd-text-dim" />
            </button>
            <button 
              className="p-2.5 rounded-full hover:bg-clawd-border transition-colors" 
              title="Add Skill"
            >
              <Brain size={16} className="text-clawd-text-dim" />
            </button>

            {/* Context Chat */}
            <button
              onClick={handleContextChat}
              className={`p-2.5 rounded-full transition-colors ${contextChatOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'}`}
              title="Context Chat"
            >
              <Sparkles size={16} className={contextChatOpen ? '' : 'text-clawd-text-dim'} />
            </button>

            {/* Task Shortcuts */}
            <button
              onClick={handleTaskShortcuts}
              className={`p-2.5 rounded-full transition-colors ${taskShortcutsOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'}`}
              title="Task Shortcuts"
            >
              <ListTodo size={16} className={taskShortcutsOpen ? '' : 'text-clawd-text-dim'} />
            </button>

            <div className="w-px h-6 bg-clawd-border mx-0.5" />

            {/* Agent Chat button */}
            <button
              onClick={handleAgentChat}
              className={`p-2.5 rounded-full transition-colors ${
                agentChatOpen || agentChatModalOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'
              }`}
              title="Chat with Agent"
            >
              <MessageSquare size={16} className={agentChatOpen || agentChatModalOpen ? '' : 'text-clawd-text-dim'} />
            </button>

            {/* Primary: Call button */}
            <button
              onClick={handleCall}
              className={`p-2.5 rounded-full transition-colors ${
                callRinging ? 'bg-yellow-500 text-white animate-pulse'
                : activeCall ? 'bg-red-500 text-white hover:bg-red-600'
                : agentCallModalOpen ? 'bg-clawd-accent text-white'
                : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
              }`}
              title={activeCall ? `In call with ${activeCall.agentName}` : 'Call Agent'}
            >
              {activeCall ? <PhoneOff size={16} /> : <Phone size={16} />}
            </button>

            <div className="w-px h-6 bg-clawd-border mx-0.5" />
            <button 
              onClick={handlePopIn} 
              className="p-2 rounded-full hover:bg-clawd-border transition-colors" 
              title="Dock toolbar back"
            >
              <ExternalLink size={14} className="text-clawd-text-dim" />
            </button>
            <button 
              onClick={toggleMode} 
              className="p-2 rounded-full hover:bg-clawd-border transition-colors" 
              title="Collapse toolbar"
            >
              <ChevronRight size={16} className="text-clawd-text-dim" />
            </button>
            <button 
              onClick={handleClose} 
              className="p-2 rounded-full hover:bg-clawd-border transition-colors" 
              title="Close toolbar"
            >
              <X size={14} className="text-clawd-text-dim" />
            </button>
          </>
        )}
      </div>
      
      {/* Agent call modal placeholder */}
      {agentCallModalOpen && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-clawd-surface rounded-lg p-4 max-w-sm">
            <div className="text-sm font-medium text-clawd-text mb-3">Call Agent</div>
            <div className="text-xs text-clawd-text-dim mb-4">
              Full agent selection UI will be available here.
              For now, use the main dashboard to initiate calls.
            </div>
            <button
              onClick={() => setAgentCallModalOpen(false)}
              className="w-full px-3 py-2 bg-clawd-accent text-white rounded hover:bg-clawd-accent/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Call dialog placeholder */}
      {callDialogOpen && activeCall && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-clawd-surface rounded-lg p-4 max-w-sm">
            <div className="text-sm font-medium text-clawd-text mb-3">
              Call with {activeCall.agentName}
            </div>
            <div className="text-xs text-clawd-text-dim mb-4">
              Call controls will be available here.
            </div>
            <button
              onClick={() => setCallDialogOpen(false)}
              className="w-full px-3 py-2 bg-clawd-accent text-white rounded hover:bg-clawd-accent/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
