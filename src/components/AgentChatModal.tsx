import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Bot, User, Lightbulb, Code, FileText, Sparkles, Loader2, Mic, MessageSquare } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import VoiceChatPanel from './VoiceChatPanel';
import { useStore } from '../store/store';
import { gateway } from '../lib/gateway';
import { getAgentTheme } from '../utils/agentThemes';

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
  const [spawning, setSpawning] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  const agent = agents.find(a => a.id === agentId);

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const historyPollRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts and listeners on unmount
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.();
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      if (historyPollRef.current) {
        clearInterval(historyPollRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    // Clean up stream listener
    streamCleanupRef.current?.();
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  useEffect(() => {
    initChat();
    return () => {
      streamCleanupRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // initChat re-initializes state, adding it to deps causes unnecessary re-runs
  }, [agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

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
  }, [handleClose]);

  const initChat = async () => {
    setSpawning(true);
    setMessages([{
      role: 'system',
      content: `Connecting to ${agent?.name || agentId}...`,
      timestamp: Date.now(),
    }]);

    try {
      // Spawn a real agent session via IPC
      const ipc = window.clawdbot?.agents;
      if (!ipc?.spawnChat) {
        throw new Error('Agent chat IPC not available — are you running in the Electron app?');
      }

      const result = await ipc.spawnChat(agentId);
      // Handle both formats: string key (legacy) or { success, sessionKey } (new)
      const key = typeof result === 'string' ? result : result?.sessionKey;
      if (key) {
        setSessionKey(key);
        setMessages([{
          role: 'system',
          content: `✅ Connected to ${agent?.name || agentId}. Session active — you're chatting with a real LLM.`,
          timestamp: Date.now(),
        }]);
      } else {
        throw new Error(result?.error || 'No session key returned');
      }
    } catch (e: unknown) {
      // '[AgentChat] Failed to spawn chat session:', e;
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setMessages([{
        role: 'system',
        content: `❌ Failed to connect: ${errMsg}. The gateway may not support agent spawning, or the session limit was reached.`,
        timestamp: Date.now(),
      }]);
    }
    setSpawning(false);
  };

  // Poll session history for real-time updates
  const fetchHistory = useCallback(async () => {
    if (!sessionKey) return;
    
    try {
      const historyResult = await gateway.request('sessions.history', {
        sessionKey,
        limit: 100,
      });

      if (historyResult?.messages && Array.isArray(historyResult.messages)) {
        const formattedMessages: Message[] = historyResult.messages
          .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg: any) => {
            // Extract text from content (handle both string and array formats)
            let content = '';
            if (typeof msg.content === 'string') {
              content = msg.content;
            } else if (Array.isArray(msg.content)) {
              // Filter for text blocks only - skip tool calls, thinking, etc.
              content = msg.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
            }
            
            return {
              role: msg.role,
              content: content || '',
              timestamp: msg.timestamp || Date.now(),
            };
          })
          .filter((msg: Message) => msg.content.trim().length > 0); // Skip empty messages

        // Only update if we have new messages (avoid flicker)
        setMessages(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(formattedMessages)) {
            return formattedMessages;
          }
          return prev;
        });
      }
    } catch (e) {
      // Silently fail - don't spam errors during polling
    }
  }, [sessionKey]);

  // Set up history polling when sessionKey is available
  useEffect(() => {
    if (!sessionKey) return;

    // Fetch immediately on session start
    fetchHistory();

    // Poll every 2 seconds for updates
    historyPollRef.current = setInterval(fetchHistory, 2000);

    return () => {
      if (historyPollRef.current) {
        clearInterval(historyPollRef.current);
        historyPollRef.current = null;
      }
    };
  }, [sessionKey, fetchHistory]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionKey || sending) return;

    const userText = input.trim();
    const userMessage: Message = {
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);
    setStreamingContent('');

    try {
      // Listen for streaming chunks
      let fullResponse = '';
      streamCleanupRef.current?.();

      const unsub = gateway.on('chat', (data: any) => {
        // STRICT session matching - only accept events for THIS session
        // Prevents bleed between multiple open chat modals
        if (!data.sessionKey || data.sessionKey !== sessionKey) return;

        if (data.state === 'streaming' && data.chunk) {
          fullResponse += data.chunk;
          setStreamingContent(fullResponse);
        }
        if (data.state === 'done' || data.state === 'complete') {
          const finalContent = data.content || data.response || fullResponse;
          if (finalContent) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: finalContent,
              timestamp: Date.now(),
            }]);
          }
          setStreamingContent('');
          setSending(false);
          unsub();
          streamCleanupRef.current = null;
        }
        if (data.state === 'error') {
          setMessages(prev => [...prev, {
            role: 'system',
            content: `⚠️ Error: ${data.error || 'Unknown error'}`,
            timestamp: Date.now(),
          }]);
          setStreamingContent('');
          setSending(false);
          unsub();
          streamCleanupRef.current = null;
        }
      });
      streamCleanupRef.current = unsub;

      // Send the message to the real session via IPC
      const ipc = window.clawdbot?.agents;
      const result = ipc?.chat
        ? await ipc.chat(sessionKey, userText)
        : await gateway.sendToSession(sessionKey, userText);

      // If we get a direct response (non-streaming), use it
      const responseText = typeof result === 'string' ? result : (result as any)?.response;
      if (responseText) {
        // Clean up stream listener since we got a direct response
        unsub();
        streamCleanupRef.current = null;
        setStreamingContent('');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: responseText,
          timestamp: Date.now(),
        }]);
        setSending(false);
      } else if (result && !(result as any).success && (result as any).error) {
        // Handle error response
        unsub();
        streamCleanupRef.current = null;
        setStreamingContent('');
        setMessages(prev => [...prev, {
          role: 'system',
          content: `⚠️ Error: ${(result as any).error}`,
          timestamp: Date.now(),
        }]);
        setSending(false);
      }

      // Set a timeout in case streaming never completes
      const responseTimeoutRef = setTimeout(() => {
        if (sending) {
          // If still sending after 2 minutes, finalize what we have
          if (fullResponse) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: fullResponse,
              timestamp: Date.now(),
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: 'system',
              content: '⏱️ Response timed out. The agent may still be processing.',
              timestamp: Date.now(),
            }]);
          }
          setStreamingContent('');
          setSending(false);
          unsub();
          streamCleanupRef.current = null;
        }
      }, 120000);

      // Cleanup timeout if component unmounts during request
      const cleanupTimeout = () => clearTimeout(responseTimeoutRef);
      window.addEventListener('beforeunload', cleanupTimeout);
      
      // Store cleanup for useEffect return
      streamCleanupRef.current = () => {
        unsub();
        clearTimeout(responseTimeoutRef);
        window.removeEventListener('beforeunload', cleanupTimeout);
      };

    } catch (e: unknown) {
      // 'Failed to send message:', e;
      setStreamingContent('');
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Failed to send: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
      setSending(false);
    }
  }, [input, sessionKey, sending]);

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

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    handleClose();
  };

  // Handle inner click with keyboard support
  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <div 
      className={`fixed inset-0 modal-backdrop backdrop-blur-md flex items-center justify-center z-50 p-4 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`} 
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropClick}
      aria-label="Close modal backdrop"
    >
      <div 
        className={`glass-modal rounded-xl max-w-3xl w-full h-[80vh] flex flex-col ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`} 
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(() => {
              const theme = getAgentTheme(agent.id);
              return theme.pic ? (
                <div className={`relative flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden ring-2 ${theme.ring} bg-clawd-bg`}>
                  <img src={`./agent-profiles/${theme.pic}`} alt={agent.name} className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).classList.remove('hidden');
                      }
                    }} />
                  <span className="hidden absolute inset-0 flex items-center justify-center text-2xl">{agent.avatar}</span>
                </div>
              ) : (
                <span className="text-3xl">{agent.avatar}</span>
              );
            })()}
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Chat with {agent.name}
                {sessionKey ? (
                  <span className="text-sm px-2 py-0.5 bg-success-subtle text-success rounded">
                    🟢 Live LLM
                  </span>
                ) : spawning ? (
                  <span className="text-sm px-2 py-0.5 bg-warning-subtle text-warning rounded flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> Connecting...
                  </span>
                ) : (
                  <span className="text-sm px-2 py-0.5 bg-error-subtle text-error rounded">
                    Disconnected
                  </span>
                )}
              </h2>
              <p className="text-xs text-clawd-text-dim">
                {sessionKey ? 'Real-time conversation with agent LLM' : 'Establishing connection...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sessionKey && (
              <button
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                className={`p-2 rounded-lg transition-colors ${
                  isVoiceMode
                    ? 'bg-review-subtle text-review hover:bg-review-subtle'
                    : 'hover:bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
                }`}
                title={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
              >
                {isVoiceMode ? <MessageSquare size={16} /> : <Mic size={16} />}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Voice Mode */}
        {isVoiceMode && sessionKey && (
          <VoiceChatPanel
            agentId={agentId}
            sessionKey={sessionKey}
            onSwitchToText={() => setIsVoiceMode(false)}
            embedded={true}
          />
        )}

        {/* Quick Prompts */}
        {!isVoiceMode && messages.length <= 1 && !spawning && sessionKey && (
          <div className="p-4 border-b border-clawd-border">
            <h3 className="text-xs font-semibold text-clawd-text-dim uppercase mb-2">
              Quick Prompts
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((item) => (
                <button
                  key={item.text}
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
        <div className={`flex-1 overflow-auto p-4 space-y-4 ${isVoiceMode ? 'hidden' : ''}`}>
          {messages.filter(msg => {
            const t = msg.content?.trim();
            return t !== 'NO_REPLY' && t !== 'HEARTBEAT_OK' && t !== 'NO' && t !== 'NO_RE' && t !== 'NO_';
          }).map((msg, i, arr) => {
            const showAvatar = i === 0 || arr[i - 1]?.role !== msg.role;
            const isLastInGroup = i === arr.length - 1 || arr[i + 1]?.role !== msg.role;
            
            return (
              <div
                key={`${msg.role}-${msg.timestamp}-${i}`}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} ${
                  showAvatar ? 'mt-6' : 'mt-1.5'
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 ${!showAvatar ? 'invisible' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ring-2 ring-white/10 dark:ring-white/20 ${
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
                        ? 'text-info' 
                        : msg.role === 'assistant' 
                          ? 'text-emerald-500' 
                          : 'text-clawd-text-dim'
                    }`}>
                      {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? agent?.name : 'System'}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`px-4 py-3 transition-all ${
                    msg.role === 'user' 
                      ? 'bg-clawd-accent/50 text-white'
                      : msg.role === 'assistant' 
                        ? 'bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border shadow-sm' 
                        : 'bg-warning-subtle border border-warning-border text-warning'
                  } ${
                    msg.role === 'user'
                      ? 'rounded-2xl rounded-tr-sm'
                      : msg.role === 'assistant'
                        ? 'rounded-2xl rounded-tl-sm'
                        : 'rounded-2xl'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <MarkdownMessage content={msg.content} />
                    )}
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

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex gap-3 mt-6">
              <div className="flex-shrink-0 w-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center shadow-md ring-2 ring-white/10 dark:ring-white/20">
                  <Bot size={16} />
                </div>
              </div>
              <div className="flex flex-col items-start max-w-[70%] min-w-[120px]">
                <div className="text-xs font-medium mb-1 px-1 text-emerald-500">
                  {agent?.name}
                </div>
                <div className="bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}<span className="animate-pulse">▊</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Thinking indicator (when sending but no streaming content yet) */}
          {sending && !streamingContent && (
            <div className="flex gap-3 mt-6">
              <div className="flex-shrink-0 w-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center shadow-md ring-2 ring-white/10 dark:ring-white/20">
                  <Bot size={16} />
                </div>
              </div>
              <div className="flex flex-col items-start">
                <div className="text-xs font-medium mb-1 px-1 text-emerald-500">
                  {agent?.name}
                </div>
                <div className="bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
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
        <div className={`p-4 border-t border-clawd-border ${isVoiceMode ? 'hidden' : ''}`}>
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionKey ? "Type your message... (Shift+Enter for new line)" : "Waiting for connection..."}
              className="flex-1 bg-clawd-surface border border-clawd-border rounded-xl px-4 py-3 text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:border-clawd-accent resize-none transition-colors"
              rows={2}
              disabled={sending || !sessionKey}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending || !sessionKey}
              className="p-3 bg-clawd-accent text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-clawd-text-dim">
              💡 You&apos;re talking to a real LLM — ask anything relevant to this agent&apos;s role
            </span>
            {!sessionKey && !spawning && (
              <button
                onClick={initChat}
                className="text-xs text-clawd-accent hover:underline"
              >
                Retry connection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
