import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, MessageSquare, Trash2, AlertCircle } from 'lucide-react';
import { showToast } from './Toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  context?: any;
}

interface FinanceAgentChatProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function FinanceAgentChat({ isOpen = true, onClose }: FinanceAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      setInitializing(true);
      const result = await (window as any).clawdbot?.financeAgent?.getChatHistory();
      
      if (result?.success) {
        setMessages(result.messages || []);
      } else {
        console.error('[FinanceChat] Error loading history:', result?.error);
      }
    } catch (error) {
      // '[FinanceChat] Load history error:', error;
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async () => {
    const message = inputMessage.trim();
    if (!message || loading) return;

    try {
      setLoading(true);
      setError(null);
      
      // Add user message immediately for UX
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // Send to agent
      const result = await (window as any).clawdbot?.financeAgent?.sendMessage(message);
      
      if (result?.success && result.message) {
        // Add agent response
        const agentMessage: ChatMessage = {
          id: `msg-${Date.now()}-agent`,
          role: 'agent',
          content: result.message,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, agentMessage]);
      } else {
        throw new Error(result?.error || 'Failed to get response from Finance Manager');
      }
    } catch (error: any) {
      // '[FinanceChat] Send message error:', error;
      setError(error.message || 'Failed to send message');
      showToast('error', 'Failed to send message to Finance Manager');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;

    try {
      const result = await (window as any).clawdbot?.financeAgent?.clearHistory();
      if (result?.success) {
        setMessages([]);
        showToast('success', 'Chat history cleared');
      } else {
        throw new Error(result?.error || 'Failed to clear history');
      }
    } catch (error: any) {
      // '[FinanceChat] Clear history error:', error;
      showToast('error', 'Failed to clear chat history');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-clawd-surface border-l border-clawd-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-success" />
          <h3 className="text-lg font-semibold text-clawd-text">Finance Manager</h3>
          <span className="px-2 py-0.5 text-xs bg-success-subtle text-success rounded-full">AI</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 hover:bg-clawd-bg-alt rounded-lg transition-colors"
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <Trash2 className="w-4 h-4 text-clawd-text-dim" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-clawd-bg-alt rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4 text-clawd-text-dim" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {initializing ? (
          <div className="flex items-center justify-center h-full text-clawd-text-dim">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-clawd-text-dim space-y-3">
            <MessageSquare className="w-12 h-12 text-clawd-text-dim" />
            <div>
              <p className="font-medium text-clawd-text">Start a conversation</p>
              <p className="text-sm mt-1">Ask the Finance Manager about your finances</p>
            </div>
            <div className="mt-4 p-3 bg-clawd-bg-alt rounded-lg text-xs text-left space-y-1 max-w-xs">
              <p className="text-clawd-text font-medium">Try asking:</p>
              <p className="text-clawd-text-dim">&quot;How much did I spend this month?&quot;</p>
              <p className="text-clawd-text-dim">&quot;Show me my biggest expenses&quot;</p>
              <p className="text-clawd-text-dim">&quot;Am I on track with my budget?&quot;</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-clawd-bg-alt text-clawd-text'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-info' : 'text-clawd-text-dim'
                    }`}
                  >
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-clawd-bg-alt text-clawd-text">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finance Manager is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-error-subtle border border-error-border rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-error">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-error hover:text-error mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-clawd-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your finances..."
            className="flex-1 bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
            disabled={loading || initializing}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || loading || initializing}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-clawd-bg-alt disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            aria-label={loading ? "Sending message" : "Send message"}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-clawd-text-dim mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
