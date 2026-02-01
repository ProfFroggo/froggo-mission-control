import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, ArrowLeft, Users, Trash2, AtSign, UsersRound, Mic } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import MarkdownMessage from './MarkdownMessage';
import TeamVoiceMeeting from './TeamVoiceMeeting';
import { gateway } from '../lib/gateway';
import { AGENTS } from '../lib/agents';
import { getAgentTheme } from '../utils/agentThemes';
import { useChatRoomStore, type RoomMessage } from '../store/chatRoomStore';
// import { showToast } from './Toast';

interface ChatRoomViewProps {
  roomId: string;
  onBack: () => void;
}

export default function ChatRoomView({ roomId, onBack }: ChatRoomViewProps) {
  const { rooms, addMessage, updateMessage, setSessionKey } = useChatRoomStore();
  const room = rooms.find(r => r.id === roomId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set());
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingAgentRef = useRef<string | null>(null);
  const pendingMsgIdRef = useRef<string | null>(null);
  const pendingContentRef = useRef<string>('');

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Listen for streaming events from spawned agents
  useEffect(() => {
    const handleDelta = (data: any) => {
      if (pendingMsgIdRef.current && data.delta) {
        pendingContentRef.current += data.delta;
        updateMessage(roomId, pendingMsgIdRef.current, { content: pendingContentRef.current });
      }
    };

    const handleChat = (data: any) => {
      if (!pendingMsgIdRef.current) return;
      const content = data.message?.content?.[0]?.text || data.content || '';
      if (content && (data.state === 'final' || content.length > pendingContentRef.current.length)) {
        pendingContentRef.current = content;
        updateMessage(roomId, pendingMsgIdRef.current, { content });
      }
      if (data.state === 'final') {
        finishAgentResponse(pendingContentRef.current);
      }
    };

    const handleEnd = () => {
      if (pendingMsgIdRef.current) {
        finishAgentResponse(pendingContentRef.current);
      }
    };

    const handleError = (data: any) => {
      if (pendingMsgIdRef.current) {
        updateMessage(roomId, pendingMsgIdRef.current, {
          content: `Error: ${data.message || data.error || 'Unknown error'}`,
          streaming: false,
        });
        clearPending();
      }
    };

    const u1 = gateway.on('chat.delta', handleDelta);
    const u2 = gateway.on('chat', handleChat);
    const u3 = gateway.on('chat.end', handleEnd);
    const u4 = gateway.on('chat.error', handleError);
    return () => { u1(); u2(); u3(); u4(); };
  }, [roomId]);

  const clearPending = () => {
    if (pendingAgentRef.current) {
      setTypingAgents(prev => {
        const n = new Set(prev);
        n.delete(pendingAgentRef.current!);
        return n;
      });
    }
    pendingAgentRef.current = null;
    pendingMsgIdRef.current = null;
    pendingContentRef.current = '';
    setLoading(false);
  };

  const finishAgentResponse = (content: string) => {
    if (pendingMsgIdRef.current) {
      updateMessage(roomId, pendingMsgIdRef.current, { streaming: false, content });
    }
    const respondedAgent = pendingAgentRef.current;
    clearPending();

    // Check for @mentions in the response to trigger agent-to-agent chat
    if (content && room) {
      const mentions = extractMentions(content, room.agents);
      if (mentions.length > 0 && respondedAgent) {
        // Delay slightly for natural feel
        setTimeout(() => {
          routeToAgents(mentions, content, respondedAgent);
        }, 1500);
      }
    }
  };

  /** Extract @AgentName mentions from text */
  const extractMentions = (text: string, agentIds: string[]): string[] => {
    const mentioned: string[] = [];
    for (const id of agentIds) {
      const agent = AGENTS[id];
      if (!agent) continue;
      const pattern = new RegExp(`@${agent.name}\\b`, 'i');
      if (pattern.test(text)) {
        mentioned.push(id);
      }
    }
    return mentioned;
  };

  /** Build context from recent room messages for an agent */
  const buildContext = (forAgent: string, triggerContent: string, fromAgent?: string): string => {
    if (!room) return triggerContent;
    // Include last 15 messages as context
    const recent = room.messages.slice(-15);
    const lines = recent.map(m => {
      const sender = m.role === 'user' ? 'Kevin' : (AGENTS[m.agentId || '']?.name || 'Unknown');
      return `[${sender}]: ${m.content}`;
    });
    const fromName = fromAgent ? (AGENTS[fromAgent]?.name || fromAgent) : 'Kevin';
    lines.push(`[${fromName}]: ${triggerContent}`);

    const agentConfig = AGENTS[forAgent];
    const otherAgents = room.agents.filter(a => a !== forAgent).map(a => AGENTS[a]?.name || a);

    return `You are ${agentConfig?.name || forAgent} in a multi-agent chat room called "${room.name}".
Other participants: Kevin (human), ${otherAgents.join(', ')}.
You can address others with @Name. Keep responses focused and conversational.
If someone addressed you directly, respond to their point. Be concise.

## Conversation so far:
${lines.join('\n')}

Respond as ${agentConfig?.name || forAgent}:`;
  };

  /** Send a message to a specific agent */
  const sendToAgent = async (agentId: string, prompt: string): Promise<void> => {
    const msgId = `rm-${Date.now()}-${agentId}`;
    pendingAgentRef.current = agentId;
    pendingMsgIdRef.current = msgId;
    pendingContentRef.current = '';

    setTypingAgents(prev => new Set(prev).add(agentId));

    // Add placeholder message
    addMessage(roomId, {
      id: msgId,
      role: 'agent',
      agentId,
      content: '',
      timestamp: Date.now(),
      streaming: true,
    });

    try {
      // Use the gateway's chat.send with a specific session key for this agent in this room
      const sessionKey = `room:${roomId}:${agentId}`;
      const idempotencyKey = `room-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await gateway.request('chat.send', {
        message: prompt,
        sessionKey,
        idempotencyKey,
      });

      // Store session key for future use
      setSessionKey(roomId, agentId, sessionKey);
    } catch (e: any) {
      updateMessage(roomId, msgId, {
        content: `Error: ${e.message || 'Failed to reach agent'}`,
        streaming: false,
      });
      clearPending();
    }
  };

  /** Route message to specified agents */
  const routeToAgents = async (agentIds: string[], content: string, fromAgent?: string) => {
    for (const agentId of agentIds) {
      if (loading) {
        // Queue — wait for current to finish
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (!pendingMsgIdRef.current) {
              clearInterval(check);
              resolve(true);
            }
          }, 500);
        });
      }
      const prompt = buildContext(agentId, content, fromAgent);
      setLoading(true);
      await sendToAgent(agentId, prompt);
      // Wait for this agent to finish before sending to next
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (!pendingMsgIdRef.current) {
            clearInterval(check);
            resolve();
          }
        }, 500);
      });
    }
  };

  /** Handle user sending a message */
  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    if (!room) return;

    // Add user message
    const userMsg: RoomMessage = {
      id: `rm-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(roomId, userMsg);
    setInput('');

    // Determine which agents to address
    const mentioned = extractMentions(text, room.agents);
    const targets = mentioned.length > 0 ? mentioned : room.agents; // If no mentions, all agents respond

    setLoading(true);
    await routeToAgents(targets, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Handle @ mention autocomplete
    if (e.key === '@' || (showMentions && e.key === 'Escape')) {
      if (e.key === 'Escape') {
        setShowMentions(false);
        setMentionFilter('');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // Check for @ trigger
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(' ')) {
        setShowMentions(true);
        setMentionFilter(after.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
    setMentionFilter('');
  };

  const insertMention = (agentId: string) => {
    const agent = AGENTS[agentId];
    if (!agent) return;
    const lastAt = input.lastIndexOf('@');
    const before = input.slice(0, lastAt);
    setInput(`${before}@${agent.name} `);
    setShowMentions(false);
    setMentionFilter('');
    inputRef.current?.focus();
  };

  if (!room) {
    return (
      <div className="h-full flex items-center justify-center text-clawd-text-dim">
        <p>Room not found</p>
      </div>
    );
  }

  const filteredAgents = room.agents.filter(id => {
    const agent = AGENTS[id];
    return agent && agent.name.toLowerCase().includes(mentionFilter);
  });

  const { deleteRoom } = useChatRoomStore();

  // Detect if this is a team meeting (has all or nearly all agents)
  const totalAgents = Object.keys(AGENTS).length;
  const isTeamMeeting = room.agents.length >= totalAgents - 1 || room.name.toLowerCase().includes('team meeting');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`p-4 border-b flex items-center gap-3 ${
        isTeamMeeting
          ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30'
          : 'bg-clawd-surface border-clawd-border'
      }`}>
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-clawd-border transition-colors"
          title="Back to chat"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          {isTeamMeeting ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
              <UsersRound size={20} className="text-white" />
            </div>
          ) : (
            <div className="flex -space-x-2">
              {room.agents.slice(0, 4).map(id => (
                <AgentAvatar key={id} agentId={id} size="sm" ring />
              ))}
            </div>
          )}
          <div>
            <h2 className={`font-semibold text-sm ${isTeamMeeting ? 'text-amber-500' : ''}`}>
              {isTeamMeeting && '🏢 '}{room.name}
            </h2>
            <p className="text-xs text-clawd-text-dim">
              {isTeamMeeting
                ? `All ${room.agents.length} agents present`
                : `You + ${room.agents.map(id => AGENTS[id]?.name || id).join(', ')}`
              }
            </p>
          </div>
        </div>

        {/* Agent presence indicators for team meetings */}
        {isTeamMeeting && (
          <div className="hidden md:flex items-center gap-1 ml-2">
            {room.agents.map(id => (
              <div key={id} className="relative group">
                <AgentAvatar agentId={id} size="xs" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-white" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {AGENTS[id]?.name || id}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Voice meeting toggle */}
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            className={`p-2 rounded-lg transition-colors ${
              voiceMode
                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50'
                : 'text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border'
            }`}
            title={voiceMode ? 'Switch to text chat' : 'Start voice meeting'}
          >
            <Mic size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm(isTeamMeeting ? 'End this meeting?' : 'Delete this room?')) {
                deleteRoom(room.id);
                onBack();
              }
            }}
            className={`p-2 rounded-lg transition-colors ${
              isTeamMeeting
                ? 'text-amber-400 hover:text-red-400 hover:bg-red-500/10'
                : 'text-clawd-text-dim hover:text-red-400 hover:bg-red-500/10'
            }`}
            title={isTeamMeeting ? 'End meeting' : 'Delete room'}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Voice Meeting Mode */}
      {voiceMode ? (
        <TeamVoiceMeeting roomId={roomId} onEndVoice={() => setVoiceMode(false)} />
      ) : (
      <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {room.messages.length === 0 ? (
          <div className="text-center py-16 text-clawd-text-dim">
            {isTeamMeeting ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <UsersRound size={40} className="text-amber-500" />
                </div>
                <p className="text-lg font-medium mb-2 text-amber-500">Team Meeting Started 🏢</p>
                <p className="text-sm mb-4">
                  All {room.agents.length} agents are present and ready.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md mx-auto">
                  {room.agents.map(id => (
                    <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-clawd-surface border border-clawd-border rounded-full text-xs">
                      <AgentAvatar agentId={id} size="xs" />
                      <span>{AGENTS[id]?.name || id}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    </div>
                  ))}
                </div>
                <p className="text-xs mb-4">
                  Address everyone at once, or use <span className="font-mono bg-clawd-bg px-1.5 py-0.5 rounded">@AgentName</span> for specific agents.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                  {["Everyone, let's discuss the sprint plan", "Team status update please", "@Chief What are the priorities?"].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="px-3 py-1.5 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg hover:border-amber-500 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Users size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">Room Created!</p>
                <p className="text-sm mb-4">
                  Start a conversation with {room.agents.map(id => AGENTS[id]?.name || id).join(' and ')}.
                </p>
                <p className="text-xs">
                  Use <span className="font-mono bg-clawd-bg px-1.5 py-0.5 rounded">@AgentName</span> to address specific agents,
                  or just type to talk to everyone.
                </p>
              </>
            )}
          </div>
        ) : (
          room.messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const agentConfig = msg.agentId ? AGENTS[msg.agentId] : null;
            const theme = msg.agentId ? getAgentTheme(msg.agentId) : null;
            const showAvatar = idx === 0 || room.messages[idx - 1]?.agentId !== msg.agentId || room.messages[idx - 1]?.role !== msg.role;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-4' : 'mt-1'}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 ${!showAvatar ? 'invisible' : ''}`}>
                  {isUser ? (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-clawd-accent to-purple-500 flex items-center justify-center text-white text-sm font-semibold shadow-md">
                      K
                    </div>
                  ) : msg.agentId ? (
                    <AgentAvatar agentId={msg.agentId} size="md" ring />
                  ) : null}
                </div>

                {/* Content */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] min-w-[100px]`}>
                  {showAvatar && (
                    <div className={`text-xs font-medium mb-1 px-1 ${
                      isUser ? 'text-clawd-accent' : (theme?.text || 'text-clawd-text-dim')
                    }`}>
                      {isUser ? 'Kevin' : (agentConfig?.name || 'Agent')}
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      isUser
                        ? 'bg-gradient-to-br from-clawd-accent to-purple-500 text-white rounded-tr-md shadow-md'
                        : `bg-clawd-surface border ${theme?.border || 'border-clawd-border'} rounded-tl-md shadow-sm`
                    }`}
                  >
                    {msg.streaming && !msg.content ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-clawd-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-clawd-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-clawd-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-clawd-text-dim">
                          {agentConfig?.name || 'Agent'} is thinking...
                        </span>
                      </div>
                    ) : !isUser ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    )}
                    {msg.streaming && msg.content && (
                      <div className="flex items-center gap-1.5 mt-2 opacity-60">
                        <div className="w-1.5 h-1.5 rounded-full bg-clawd-accent animate-pulse" />
                        <span className="text-xs text-clawd-text-dim">typing...</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-clawd-text-dim mt-1 px-1">{time}</span>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicators for agents */}
        {typingAgents.size > 0 && !room.messages.some(m => m.streaming) && (
          <div className="flex items-center gap-2 text-sm text-clawd-text-dim pl-12">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-clawd-accent animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-clawd-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-clawd-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            {[...typingAgents].map(id => AGENTS[id]?.name || id).join(', ')} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-clawd-border bg-clawd-surface relative">
        {/* @ Mention autocomplete */}
        {showMentions && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-clawd-surface border border-clawd-border rounded-xl shadow-xl overflow-hidden">
            {filteredAgents.map(id => {
              const agent = AGENTS[id];
              const theme = getAgentTheme(id);
              return (
                <button
                  key={id}
                  onClick={() => insertMention(id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-clawd-bg transition-colors"
                >
                  <AgentAvatar agentId={id} size="sm" />
                  <span className={`font-medium text-sm ${theme.text}`}>{agent?.name}</span>
                  <span className="text-xs text-clawd-text-dim">{agent?.description}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-end gap-3">
          <button
            onClick={() => setShowMentions(!showMentions)}
            className={`p-3 rounded-xl transition-all ${
              showMentions ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title="Mention an agent"
          >
            <AtSign size={20} />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Message the room... (use @name to mention)`}
              rows={1}
              className="w-full bg-clawd-bg border border-clawd-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:border-clawd-accent"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
