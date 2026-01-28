import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, MessageSquare, CheckCircle, Search, Zap, Send, X, UserPlus, Brain } from 'lucide-react';
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

const QuickActions = forwardRef<QuickActionsRef, QuickActionsProps>(({ onNewTask, onSearch, onApproveAll, onAddContact, onAddSkill }, ref) => {
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [sending, setSending] = useState(false);

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

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Quick Message Modal */}
      {quickMessageOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-clawd-surface border border-clawd-border rounded-xl shadow-2xl p-4">
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

      {/* Action Buttons */}
      <div className="flex items-center gap-2 bg-clawd-surface border border-clawd-border rounded-full px-2 py-1.5 shadow-lg">
        <button
          onClick={onSearch}
          className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
          title="Search (⌘/)"
        >
          <Search size={18} className="text-clawd-text-dim" />
        </button>
        
        <button
          onClick={onNewTask}
          className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
          title="New Task"
        >
          <Plus size={18} className="text-clawd-text-dim" />
        </button>

        {onAddContact && (
          <button
            onClick={onAddContact}
            className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
            title="Add Contact (⌘⇧N)"
          >
            <UserPlus size={18} className="text-clawd-text-dim" />
          </button>
        )}

        {onAddSkill && (
          <button
            onClick={onAddSkill}
            className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
            title="Add Skill (⌘⇧K)"
          >
            <Brain size={18} className="text-clawd-text-dim" />
          </button>
        )}
        
        <button
          onClick={() => setQuickMessageOpen(!quickMessageOpen)}
          className={`p-2.5 rounded-full transition-colors ${
            quickMessageOpen ? 'bg-clawd-accent text-white' : 'hover:bg-clawd-border'
          }`}
          title="Quick Message"
        >
          <MessageSquare size={18} className={quickMessageOpen ? '' : 'text-clawd-text-dim'} />
        </button>
        
        <button
          onClick={onApproveAll}
          className="p-2.5 rounded-full hover:bg-clawd-border transition-colors"
          title="Approve All Pending"
        >
          <CheckCircle size={18} className="text-clawd-text-dim" />
        </button>
        
        <div className="w-px h-6 bg-clawd-border mx-1" />
        
        <button
          className="p-2.5 rounded-full bg-clawd-accent text-white hover:bg-clawd-accent/90 transition-colors"
          title="Froggo"
        >
          <Zap size={18} />
        </button>
      </div>
    </div>
  );
});

QuickActions.displayName = 'QuickActions';
export default QuickActions;
