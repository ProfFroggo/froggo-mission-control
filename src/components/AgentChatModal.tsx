import { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Lightbulb, Code, FileText, Sparkles } from 'lucide-react';
import { useStore } from '../store/store';

interface AgentChatModalProps {
  agentId: string;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export default function AgentChatModal({ agentId, onClose }: AgentChatModalProps) {
  const { agents } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = agents.find(a => a.id === agentId);

  useEffect(() => {
    initChat();
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    // Add system message
    setMessages([{
      role: 'system',
      content: `You're now chatting with ${agent?.name}. This is a collaborative session to improve the agent's performance, skills, and understanding.`,
      timestamp: Date.now(),
    }]);

    // Spawn agent session for chat
    try {
      const data = await (window as any).clawdbot.agents.spawnChat(agentId);
      setSessionKey(data.sessionKey);
    } catch (e) {
      console.error('Failed to spawn chat session:', e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionKey || sending) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const data = await (window as any).clawdbot.agents.chat(sessionKey, input);
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      console.error('Failed to send message:', e);
      const errorMessage: Message = {
        role: 'system',
        content: 'Failed to send message. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    { icon: Lightbulb, text: "How can we improve your performance?", prompt: "How can we improve your performance on tasks? What challenges do you face?" },
    { icon: Code, text: "What skills should you learn?", prompt: "What new skills or capabilities would help you complete tasks more effectively?" },
    { icon: FileText, text: "Review your recent work", prompt: "Can you reflect on your recent tasks? What went well and what could be improved?" },
    { icon: Sparkles, text: "Optimize your workflow", prompt: "How can we optimize your workflow and task execution process?" },
  ];

  if (!agent) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-clawd-surface rounded-xl border border-clawd-border shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{agent.avatar}</span>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Chat with {agent.name}
                <span className="text-sm px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  Collaborative Mode
                </span>
              </h2>
              <p className="text-xs text-clawd-text-dim">
                Improve performance through conversation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="p-4 border-b border-clawd-border">
            <h3 className="text-xs font-semibold text-clawd-text-dim uppercase mb-2">
              Quick Prompts
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(item.prompt);
                  }}
                  className="flex items-center gap-2 p-2 text-sm bg-clawd-bg border border-clawd-border rounded-lg hover:bg-clawd-border transition-colors text-left"
                >
                  <item.icon size={14} className="text-clawd-accent flex-shrink-0" />
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' :
                msg.role === 'assistant' ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              {/* Message Bubble */}
              <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block rounded-lg p-3 ${
                  msg.role === 'user' ? 'bg-blue-500/20 text-blue-100' :
                  msg.role === 'assistant' ? 'bg-clawd-bg' :
                  'bg-yellow-500/10 text-yellow-400 text-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="text-xs text-clawd-text-dim mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="bg-clawd-bg rounded-lg p-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-clawd-text-dim rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-clawd-text-dim rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-clawd-text-dim rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-clawd-border">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="flex-1 px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-clawd-accent resize-none"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 text-xs text-clawd-text-dim">
            💡 Ask about performance, suggest improvements, add skills, or discuss task strategies
          </div>
        </div>
      </div>
    </div>
  );
}
