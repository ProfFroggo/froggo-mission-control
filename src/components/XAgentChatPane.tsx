import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Users } from 'lucide-react';
import type { XTab } from './XTwitterPage';

interface XAgentChatPaneProps {
  tab: XTab;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  agentName?: string;
  content: string;
  timestamp: number;
}

const AGENT_ROUTING: Record<XTab, string[]> = {
  research: ['Researcher', 'Social Manager'],
  plan: ['Writer', 'Social Manager'],
  drafts: ['Writer', 'Social Manager'],
  calendar: ['Writer', 'Social Manager'],
  mentions: ['Social Manager'],
  'reply-guy': ['Writer', 'Social Manager'],
  automations: ['Social Manager'],
};

export default function XAgentChatPane({ tab }: XAgentChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agents = AGENT_ROUTING[tab];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Reset messages when tab changes
    setMessages([]);
  }, [tab]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // FUTURE: Implement agent communication via IPC to backend agent system
      // Currently using placeholder response until agent messaging API is ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const agentMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        agentName: agents[0],
        content: `[${agents[0]}] Received your message. Functionality coming soon.`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error('[XAgentChat] Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-clawd-surface">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-info" />
          <h3 className="text-sm font-semibold text-clawd-text">Agent Chat</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <span
              key={agent}
              className="px-2 py-1 text-xs bg-info-subtle text-info rounded-full"
            >
              {agent}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-clawd-text-dim">
            <Users className="w-12 h-12 text-clawd-text-dim mb-3" />
            <p className="font-medium text-clawd-text">Start a conversation</p>
            <p className="text-sm mt-1 text-clawd-text">Chat with {agents.join(' and ')}</p>
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
                      ? 'bg-info-subtle text-info'
                      : 'bg-clawd-bg-alt text-clawd-text'}`}
                >
                  {msg.role === 'agent' && msg.agentName && (
                    <div className="text-xs text-clawd-text-dim mb-1">{msg.agentName}</div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-clawd-text-dim' : 'text-clawd-text-dim'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-clawd-bg-alt text-clawd-text">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{agents[0]} is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-clawd-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Chat with ${agents[0]}...`}
            className="flex-1 bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary p-2 rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-clawd-text-dim mt-2">Press Enter to send • Shift+Enter for new line</p>
      </div>
    </div>
  );
}
