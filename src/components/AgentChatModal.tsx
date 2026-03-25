import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Bot, User, Lightbulb, Code, FileText, Sparkles, Mic, MessageSquare, AlertTriangle, XCircle } from 'lucide-react';
import { Button, IconButton, TextArea, Spinner, Box, Flex } from '@radix-ui/themes';
import MarkdownMessage from './MarkdownMessage';
import SessionStatsBar from './SessionStatsBar';
import StreamingText from './StreamingText';
import VoiceChatPanel from './VoiceChatPanel';
import { useStore } from '../store/store';
import { chatApi } from '../lib/api';
import { getAgentTheme } from '../utils/agentThemes';

interface AgentChatModalProps {
  agentId: string;
  onClose: () => void;
  existingSessionKey?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export default function AgentChatModal({ agentId, onClose, existingSessionKey }: AgentChatModalProps) {
  const { agents } = useStore();
  const [isClosing, setIsClosing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const agent = agents.find(a => a.id === agentId);
  // Each agent gets its own persistent modal session — isolated from toolbar or room sessions
  const sessionKey = existingSessionKey ?? `modal:${agentId}`;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  // Load persisted history on open
  useEffect(() => {
    chatApi.getMessages(sessionKey).then((rows: any) => {
      if (Array.isArray(rows) && rows.length > 0) {
        setMessages(rows.slice(-60).map((m: any) => ({
          role: m.role as Message['role'],
          content: m.content,
          timestamp: m.timestamp ?? Date.now(),
        })));
      }
    }).catch(() => {});
  }, [sessionKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [handleClose]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const userText = (overrideText ?? input).trim();
    if (!userText || sending) return;

    if (!overrideText) setInput('');
    setSending(true);
    setStreamingContent('');

    const userMsg: Message = { role: 'user', content: userText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    chatApi.saveMessage(sessionKey, { role: 'user', content: userText, timestamp: Date.now() }).catch(() => {});

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let reply = '';
    try {
      // Use SDK chat route for true character-by-character streaming
      // /stream is reserved for background task dispatch; /chat is for interactive use
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, sessionKey }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        if (res.status === 429) {
          setMessages(prev => [...prev, { role: 'system', content: 'Agent is busy — please wait a moment and try again.', timestamp: Date.now() }]);
          return;
        }
        throw new Error(`Stream error: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            const chunk = JSON.parse(raw);
            if (chunk.type === 'text_delta' && typeof chunk.text === 'string') {
              // SDK chat route: true character-by-character text_delta events
              reply += chunk.text;
              setStreamingContent(reply);
            } else if (chunk.type === 'error') {
              // Surface error in message
              const errText = chunk.error || 'An error occurred';
              setStreamingContent('');
              setMessages(prev => [...prev, { role: 'system', content: errText, timestamp: Date.now() }]);
              return;
            } else if (chunk.type === 'done') {
              // Stream complete — handled below after loop
            }
          } catch { /* non-JSON line, ignore */ }
        }
      }

      const finalReply = reply.trim();
      setStreamingContent('');
      if (finalReply) {
        setMessages(prev => [...prev, { role: 'assistant', content: finalReply, timestamp: Date.now() }]);
        // Note: chat route already persists; this is a local fallback for non-SDK-chat sessions
        chatApi.saveMessage(sessionKey, { role: 'assistant', content: finalReply, timestamp: Date.now() }).catch(() => {});
      } else {
        setMessages(prev => [...prev, { role: 'system', content: 'No response from agent', timestamp: Date.now() }]);
      }
    } catch (e: unknown) {
      setStreamingContent('');
      if (e instanceof Error && e.name === 'AbortError') return; // closed by user
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Failed to send: ${e instanceof Error ? e.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, agentId, sessionKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const quickPrompts = [
    { icon: Lightbulb, text: "How can we improve your performance?", prompt: "How can we improve your performance on tasks? What challenges do you face?" },
    { icon: Code, text: "What skills should you learn?", prompt: "What new skills or capabilities would help you complete tasks more effectively?" },
    { icon: FileText, text: "Review your recent work", prompt: "Can you reflect on your recent tasks? What went well and what could be improved?" },
    { icon: Sparkles, text: "Optimize your workflow", prompt: "How can we optimize your workflow and task execution process?" },
  ];

  if (!agent) return null;

  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    handleClose();
  };

  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <Flex
      align="center"
      justify="center"
      p="4"
      className={`fixed inset-0 modal-backdrop backdrop-blur-md z-50 ${
        isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
      }`}
      onClick={handleBackdropClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleBackdropClick}
      aria-label="Close modal backdrop"
    >
      <Flex
        direction="column"
        className={`glass-modal rounded-xl max-w-3xl w-full h-[80vh] max-h-[85vh] ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <Flex align="center" justify="between" px="5" py="4" className="border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="3">
            {(() => {
              const theme = getAgentTheme(agent.id);
              return theme.pic ? (
                <div className={`relative flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden ring-2 ${theme.ring} bg-mission-control-bg`}>
                  <img src={`/api/agents/${agent.id}/avatar`} alt={agent.name} className="w-full h-full object-cover"
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
              <h2 className="text-base font-semibold text-mission-control-text flex items-center gap-2">
                Chat with {agent.name}
                <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded-lg">
                  Live LLM
                </span>
              </h2>
              <p className="text-xs text-mission-control-text-dim">
                Persistent session — history restored on reconnect
              </p>
              <SessionStatsBar sessionKey={sessionKey} onCompact={() => sendMessage('/compact')} className="mt-1" />
            </div>
          </Flex>
          <Flex align="center" gap="2">
            <IconButton
              onClick={() => setIsVoiceMode(!isVoiceMode)}
              variant="ghost"
              color="gray"
              size="2"
              title={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
            >
              {isVoiceMode ? <MessageSquare size={16} /> : <Mic size={16} />}
            </IconButton>
            <IconButton
              onClick={handleClose}
              variant="ghost"
              color="gray"
              size="2"
              aria-label="Close modal"
            >
              <X size={16} />
            </IconButton>
          </Flex>
        </Flex>

        {/* Voice Mode */}
        {isVoiceMode && (
          <VoiceChatPanel
            agentId={agentId}
            sessionKey={sessionKey}
            onSwitchToText={() => setIsVoiceMode(false)}
            embedded={true}
          />
        )}

        {/* Quick Prompts */}
        {!isVoiceMode && messages.length === 0 && (
          <div className="px-6 py-4 border-b border-mission-control-border flex-shrink-0">
            <h3 className="text-xs font-semibold text-mission-control-text-dim uppercase mb-2">
              Quick Prompts
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((item) => (
                <Button
                  key={item.text}
                  onClick={() => setInput(item.prompt)}
                  size="2"
                  variant="ghost"
                  style={{ justifyContent: 'flex-start' }}
                >
                  <item.icon size={14} className="flex-shrink-0" />
                  <span>{item.text}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {!isVoiceMode && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <Flex key={i} gap="3" className={msg.role === 'user' ? 'justify-end' : 'justify-start'}>
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-mission-control-border flex items-center justify-center flex-shrink-0">
                    {msg.role === 'system' ? <Sparkles size={14} /> : <Bot size={14} />}
                  </div>
                )}
                <div className="flex flex-col">
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-mission-control-accent text-white rounded-tr-sm'
                      : msg.role === 'system'
                      ? 'bg-warning-subtle text-warning border border-warning-border rounded-tl-sm'
                      : 'bg-mission-control-surface border border-mission-control-border rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <MarkdownMessage content={msg.content} />
                    ) : msg.role === 'system' ? (
                      <span className="flex items-center gap-1.5">
                        {msg.content.startsWith('Failed') ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                        {msg.content}
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <span className={`text-xs text-mission-control-text-dim mt-1 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-mission-control-accent flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-white" />
                  </div>
                )}
              </Flex>
            ))}
            {streamingContent && (
              <Flex gap="3" justify="start">
                <div className="w-8 h-8 rounded-full bg-mission-control-border flex items-center justify-center flex-shrink-0">
                  <Bot size={14} />
                </div>
                <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-mission-control-surface border border-mission-control-border">
                  <StreamingText
                    content={streamingContent}
                    streaming={true}
                  />
                </div>
              </Flex>
            )}
            {sending && !streamingContent && (
              <Flex gap="3" justify="start">
                <div className="w-8 h-8 rounded-full bg-mission-control-border flex items-center justify-center flex-shrink-0">
                  <Bot size={14} />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm bg-mission-control-surface border border-mission-control-border">
                  <Spinner size="1" />
                </div>
              </Flex>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        {!isVoiceMode && (
          <div className="px-6 py-4 border-t border-mission-control-border flex-shrink-0">
            <Flex gap="2">
              <TextArea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent.name}...`}
                rows={2}
                disabled={sending}
                variant="soft"
                className="flex-1 resize-none"
              />
              <IconButton
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                variant="solid"
                color="grass"
                size="3"
              >
                {sending ? <Spinner size="1" /> : <Send size={16} />}
              </IconButton>
            </Flex>
          </div>
        )}
      </Flex>
    </Flex>
  );
}
