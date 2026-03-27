import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Bot, Lightbulb, Code, FileText, Sparkles, Mic, MessageSquare, AlertTriangle, XCircle } from 'lucide-react';
import { Spinner, Flex } from '@radix-ui/themes';
import MarkdownMessage from './MarkdownMessage';
import SessionStatsBar from './SessionStatsBar';
import StreamingText from './StreamingText';
import VoiceChatPanel from './VoiceChatPanel';
import { useStore } from '../store/store';
import { chatApi } from '../lib/api';
import { getAgentTheme } from '../utils/agentThemes';
import { extractAllArtifacts, generateArtifactTitle } from '../utils/artifactExtractor';
import { useArtifactStore } from '../store/artifactStore';

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
        const msgTs = Date.now();
        const msgId = `modal-${agentId}-${msgTs}`;
        setMessages(prev => [...prev, { role: 'assistant', content: finalReply, timestamp: msgTs }]);
        chatApi.saveMessage(sessionKey, { role: 'assistant', content: finalReply, timestamp: msgTs }).catch(() => {});
        // Extract and store artifacts from this response
        extractAllArtifacts(finalReply).forEach(a => {
          useArtifactStore.getState().addArtifact({
            type: a.type,
            title: generateArtifactTitle(a),
            content: a.content,
            messageId: msgId,
            sessionId: sessionKey,
            timestamp: msgTs,
            metadata: a.metadata,
          });
        });
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
      className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 ${
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
        className={`bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl max-w-3xl w-full h-[80vh] max-h-[85vh] ${
          isClosing ? 'modal-content-exit' : 'modal-content-enter'
        }`}
        onClick={handleInnerClick}
        role="presentation"
        onKeyDown={handleInnerClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
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
                <span className="text-3xl flex-shrink-0">{agent.avatar}</span>
              );
            })()}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-mission-control-text flex items-center gap-2">
                Chat with {agent.name}
                <span className="text-xs px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-lg">
                  Live LLM
                </span>
              </h2>
              <p className="text-xs text-mission-control-text-dim mt-0.5">
                Persistent session — history restored on reconnect
              </p>
              <SessionStatsBar sessionKey={sessionKey} onCompact={() => sendMessage('/compact')} className="mt-1" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsVoiceMode(!isVoiceMode)}
              title={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              {isVoiceMode ? <MessageSquare size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close modal"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

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
            <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-2">
              Quick Prompts
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((item) => (
                <button
                  key={item.text}
                  type="button"
                  onClick={() => setInput(item.prompt)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors text-left"
                >
                  <item.icon size={14} className="flex-shrink-0" />
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {!isVoiceMode && (
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const isNewSpeaker = !prev || prev.role !== msg.role;
              if (msg.role === 'system') {
                return (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 bg-[var(--color-warning)]/8 border border-[var(--color-warning)]/20 rounded-lg text-sm text-[var(--color-warning)] my-2">
                    {msg.content.startsWith('Failed') ? <XCircle size={14} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
                    <span>{msg.content}</span>
                  </div>
                );
              }
              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isNewSpeaker ? 'mt-6' : 'mt-2'}`}>
                  {msg.role !== 'user' && (
                    <div className={`flex-shrink-0 mr-2 ${isNewSpeaker ? '' : 'invisible'}`}>
                      <div className="w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center">
                        <Bot size={14} className="text-mission-control-text-dim" />
                      </div>
                    </div>
                  )}
                  <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {isNewSpeaker && msg.role !== 'user' && (
                      <span className="text-xs font-medium text-[var(--color-success)] mb-1 px-1">{agent.name}</span>
                    )}
                    {isNewSpeaker && msg.role === 'user' && (
                      <span className="text-xs font-medium text-mission-control-accent mb-1 px-1">You</span>
                    )}
                    {msg.role === 'user' ? (
                      <div
                        className="text-sm px-4 py-2.5 rounded-[18px_18px_4px_18px] text-mission-control-text"
                        style={{ background: 'color-mix(in srgb, var(--mission-control-accent) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent)' }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div className="text-sm text-mission-control-text">
                        <MarkdownMessage content={msg.content} />
                      </div>
                    )}
                    <span className={`text-[11px] tabular-nums text-mission-control-text-dim/70 mt-1 px-1`}>
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            {streamingContent && (
              <div className="flex justify-start mt-2">
                <div className="mr-2 w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center flex-shrink-0 invisible" />
                <div className="max-w-[80%] text-sm text-mission-control-text">
                  <StreamingText
                    content={streamingContent}
                    streaming={true}
                  />
                </div>
              </div>
            )}
            {sending && !streamingContent && (
              <div className="flex justify-start mt-6">
                <div className="mr-2 w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center flex-shrink-0">
                  <Bot size={14} className="text-mission-control-text-dim" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-[var(--color-success)] mb-1 px-1">{agent.name}</span>
                  <div className="text-sm text-mission-control-text">
                    <Flex gap="1" align="center" className="py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-xs text-mission-control-text-dim ml-1">thinking...</span>
                    </Flex>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        {!isVoiceMode && (
          <div className="border-t border-mission-control-border bg-mission-control-bg px-4 py-3 flex-shrink-0">
            <Flex gap="2" align="end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent.name}...`}
                rows={2}
                disabled={sending}
                className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-[14px] px-4 py-3 text-sm resize-none text-mission-control-text placeholder:text-mission-control-text-dim outline-none focus:border-[var(--mission-control-accent)] focus:ring-2 focus:ring-[var(--mission-control-accent)]/20 transition-colors"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="w-8 h-8 rounded-lg bg-[var(--mission-control-accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 flex-shrink-0"
                aria-label="Send message"
              >
                {sending ? <Spinner size="1" /> : <Send size={16} />}
              </button>
            </Flex>
          </div>
        )}
      </Flex>
    </Flex>
  );
}
