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
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = agents.find(a => a.id === agentId);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  useEffect(() => {
    initChat();
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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
    <div 
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`} 
      onClick={handleClose}
    >
      <div 
        className={`glass-modal rounded-xl max-w-3xl w-full h-[80vh] flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`} 
        onClick={(e) => e.stopPropagation()}
      >
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
            onClick={handleClose}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={16} />
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
          {messages.map((msg, i) => {
            const showAvatar = i === 0 || messages[i - 1]?.role !== msg.role;
            const isLastInGroup = i === messages.length - 1 || messages[i + 1]?.role !== msg.role;
            
            return (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${
                  showAvatar ? 'mt-6' : 'mt-1.5'
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 ${!showAvatar ? 'invisible' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ring-2 ring-white/20 ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white' 
                      : msg.role === 'assistant' 
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white' 
                        : 'bg-gradient-to-br from-gray-400 to-slate-500 text-white'
                  }`}>
                    {msg.role === 'user' ? (
                      <User size={16} />
                    ) : msg.role === 'assistant' ? (
                      <Bot size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                  </div>
                </div>

                {/* Message content column */}
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[70%] min-w-[120px]`}>
                  {/* Sender name */}
                  {showAvatar && (
                    <div className={`text-xs font-medium mb-1 px-1 ${
                      msg.role === 'user' 
                        ? 'text-blue-400' 
                        : msg.role === 'assistant' 
                          ? 'text-emerald-500' 
                          : 'text-gray-400'
                    }`}>
                      {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? agent?.name : 'System'}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`px-4 py-3 transition-all ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md' 
                      : msg.role === 'assistant' 
                        ? 'bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border/60 shadow-sm hover:shadow-md' 
                        : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                  } ${
                    msg.role === 'user'
                      ? showAvatar 
                        ? 'rounded-2xl rounded-tr-sm' 
                        : isLastInGroup 
                          ? 'rounded-2xl rounded-tr-sm' 
                          : 'rounded-2xl rounded-tr-md'
                      : showAvatar 
                        ? 'rounded-2xl rounded-tl-sm' 
                        : isLastInGroup 
                          ? 'rounded-2xl rounded-tl-sm' 
                          : 'rounded-2xl rounded-tl-md'
                  }`}>
                    <p className={`whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'system' ? 'text-sm' : ''
                    }`}>
                      {msg.content}
                    </p>
                  </div>

                  {/* Timestamp */}
                  {isLastInGroup && (
                    <div className={`flex items-center gap-2 mt-1.5 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] text-clawd-text-dim/80 font-medium">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {sending && (
            <div className="flex gap-3 mt-6">
              <div className="flex-shrink-0 w-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center shadow-md ring-2 ring-white/20">
                  <Bot size={16} />
                </div>
              </div>
              <div className="flex flex-col items-start">
                <div className="text-xs font-medium mb-1 px-1 text-emerald-500">
                  {agent?.name}
                </div>
                <div className="bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-clawd-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-clawd-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-clawd-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-clawd-text-dim">Thinking...</span>
                  </div>
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
              <Send size={16} />
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
