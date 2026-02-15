import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Minimize2, X } from 'lucide-react';
import { showToast } from './Toast';

export default function FloatingToolbar() {
  const [activeCall, setActiveCall] = useState<{agentName: string} | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [agentCallModalOpen, setAgentCallModalOpen] = useState(false);
  
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
  
  const handleCall = () => {
    if (activeCall) {
      setCallDialogOpen(!callDialogOpen);
    } else {
      setAgentCallModalOpen(!agentCallModalOpen);
    }
  };
  
  return (
    <div className="h-full w-full bg-clawd-bg/95 backdrop-blur-sm border border-clawd-border rounded-lg shadow-2xl flex flex-col">
      {/* Header with pop-in button */}
      <div className="flex items-center justify-between p-2 border-b border-clawd-border bg-clawd-surface/50">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-clawd-text-dim">Toolbar</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePopIn}
            className="p-1.5 rounded hover:bg-clawd-border transition-colors"
            title="Dock toolbar back"
          >
            <Minimize2 size={14} className="text-clawd-text-dim" />
          </button>
          <button
            onClick={handlePopIn}
            className="p-1.5 rounded hover:bg-clawd-border transition-colors"
            title="Close floating toolbar"
          >
            <X size={14} className="text-clawd-text-dim" />
          </button>
        </div>
      </div>
      
      {/* Main toolbar content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
        {/* Call button */}
        <button
          onClick={handleCall}
          className={`p-4 rounded-full transition-colors ${
            activeCall 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
          }`}
          title={activeCall ? `In call with ${activeCall.agentName}` : 'Call Agent'}
        >
          {activeCall ? <PhoneOff size={24} /> : <Phone size={24} />}
        </button>
        
        {activeCall && (
          <div className="text-center">
            <div className="text-xs text-clawd-text-dim">In call with</div>
            <div className="text-sm font-medium text-clawd-text">{activeCall.agentName}</div>
          </div>
        )}
        
        {/* Quick actions */}
        <div className="text-center mt-4">
          <div className="text-[10px] text-clawd-text-dim">
            Always on top
          </div>
          <div className="text-[10px] text-clawd-text-dim mt-1">
            Press Minimize to dock back
          </div>
        </div>
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
