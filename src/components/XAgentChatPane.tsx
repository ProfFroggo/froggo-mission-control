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
      // TODO: Implement actual agent communication via IPC
      // For now, placeholder response
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
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Agent Chat</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <span
              key={agent}
              className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full"
            >
              {agent}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <Users className="w-12 h-12 text-gray-600 mb-3" />
            <p className="font-medium text-gray-300">Start a conversation</p>
            <p className="text-sm mt-1">Chat with {agents.join(' and ')}</p>
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
                      : 'bg-gray-800 text-gray-100'
                  }`}
                >
                  {msg.role === 'agent' && msg.agentName && (
                    <div className="text-xs text-gray-400 mb-1">{msg.agentName}</div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'
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
                <div className="max-w-[80%] rounded-lg p-3 bg-gray-800 text-gray-100">
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
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Chat with ${agents[0]}...`}
            className="flex-1 bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Press Enter to send • Shift+Enter for new line</p>
      </div>
    </div>
  );
}
