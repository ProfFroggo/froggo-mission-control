import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Users, Trash2, AtSign, UsersRound, Phone, Square, UserPlus, Paperclip, X, FileText, Image, File } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import MarkdownMessage from './MarkdownMessage';
import MentionText from './MentionText';
import TeamVoiceMeeting from './TeamVoiceMeeting';
import ArtifactPanel from './ArtifactPanel';
import { getAgentTheme } from '../utils/agentThemes';
import { useChatRoomStore, type RoomMessage } from '../store/chatRoomStore';
import { useStore } from '../store/store';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { useArtifactExtraction } from '../hooks/useArtifactExtraction';
import { useArtifactStore } from '../store/artifactStore';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface ChatRoomViewProps {
  roomId: string;
  onBack: () => void;
}

const MAX_AGENT_RESPONSES_PER_TURN = 15;

export default function ChatRoomView({ roomId, onBack }: ChatRoomViewProps) {
  const { rooms, addMessage, updateMessage, updateRoomAgents, deleteRoom, loadMessages } = useChatRoomStore();
  const agents = useStore(s => s.agents);
  const room = rooms.find(r => r.id === roomId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();
  // Auto-extract artifacts from messages
  useArtifactExtraction(
    room?.messages.map(m => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    })) || [],
    roomId,
    {
      autoExtract: true,
      extractFromAssistant: true,
      extractFromUser: false,
    }
  );

  // Artifact store — for wiring "Open Preview" cards in messages
  const { artifacts, selectArtifact, isCollapsed: artifactPanelCollapsed, setCollapsed: setArtifactCollapsed } = useArtifactStore();
  const handleArtifactOpen = useCallback((lang: string, code: string) => {
    const match = artifacts.find(a => a.content.trim() === code.trim());
    if (match) {
      selectArtifact(match.id);
      if (artifactPanelCollapsed) setArtifactCollapsed(false);
    }
  }, [artifacts, selectArtifact, artifactPanelCollapsed, setArtifactCollapsed]);

  // Helper to get agent name from store
  const agentName = useCallback((id: string) => agents.find(a => a.id === id)?.name || id, [agents]);
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set());
  const [showMentions, setShowMentions] = useState(false);
  // Track in-progress task status per agent (agentId -> { taskId, title, lastAgentUpdate })
  const [agentTaskStatus, setAgentTaskStatus] = useState<Record<string, { id: string; title: string; lastAgentUpdate: string | null }>>({});
  const [mentionFilter, setMentionFilter] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingAgentRef = useRef<string | null>(null);
  const pendingMsgIdRef = useRef<string | null>(null);
  const pendingContentRef = useRef<string>('');
  const abortRef = useRef(false);
  const [stopped, setStopped] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnResponseCountRef = useRef(0);

  // Load message history from DB when opening a room (only if empty)
  useEffect(() => {
    if (room && room.messages.length === 0) {
      loadMessages(roomId);
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch in-progress task status for room agents
  useEffect(() => {
    if (!room?.agents?.length) return;

    const fetchStatuses = async () => {
      try {
        const res = await fetch(`/api/tasks?status=in-progress&limit=50`);
        if (!res.ok) return;
        const data = await res.json();
        const tasks: { id: string; title: string; assignedTo: string | null; lastAgentUpdate: string | null }[] = Array.isArray(data) ? data : (data.tasks || []);
        const map: Record<string, { id: string; title: string; lastAgentUpdate: string | null }> = {};
        for (const t of tasks) {
          if (t.assignedTo && room.agents.includes(t.assignedTo)) {
            map[t.assignedTo] = { id: t.id, title: t.title, lastAgentUpdate: t.lastAgentUpdate };
          }
        }
        setAgentTaskStatus(map);
      } catch { /* non-critical */ }
    };

    fetchStatuses();

    // Subscribe to SSE task.updated events
    const es = new EventSource('/api/sse');
    es.addEventListener('task.updated', (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        if (!d.assignedTo || !room.agents.includes(d.assignedTo)) return;
        if (d.status === 'in-progress') {
          setAgentTaskStatus(prev => ({
            ...prev,
            [d.assignedTo]: { id: d.id, title: prev[d.assignedTo]?.title || '', lastAgentUpdate: d.lastAgentUpdate ?? null },
          }));
        } else {
          setAgentTaskStatus(prev => {
            const next = { ...prev };
            delete next[d.assignedTo];
            return next;
          });
        }
      } catch { /* ignore parse errors */ }
    });
    return () => es.close();
  }, [roomId, room?.agents?.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // File handling
  const handleFiles = (files: File[]) => {
    const newAttachments: AttachedFile[] = [];
    let loaded = 0;
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) return; // 10MB limit
      const reader = new FileReader();
      reader.onload = () => {
        newAttachments.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result as string,
        });
        loaded++;
        if (loaded === files.length) {
          setAttachments(prev => [...prev, ...newAttachments]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('pdf') || type.includes('document')) return FileText;
    return File;
  };

  /** Process attachments into text content for the agent prompt */
  const processAttachments = async (): Promise<string> => {
    const parts: string[] = [];
    for (const att of attachments) {
      if (!att.dataUrl) continue;
      const textExtensions = ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.py', '.jsx', '.tsx', '.html', '.css', '.yml', '.yaml', '.xml', '.sh', '.sql'];
      const isTextFile = att.type.startsWith('text/') || textExtensions.some(ext => att.name.toLowerCase().endsWith(ext));

      if (isTextFile) {
        try {
          const base64 = att.dataUrl.split(',')[1];
          const decoded = atob(base64);
          parts.push(`\n\n--- FILE: ${att.name} ---\n\`\`\`\n${decoded}\n\`\`\`\n--- END FILE ---`);
        } catch {
          parts.push(`\n\n[Attached text file: ${att.name} - could not decode]`);
        }
      } else if (att.type.startsWith('image/')) {
        parts.push(`\n\n📷 IMAGE ATTACHED: ${att.name}\nPlease use the image tool or Read tool to analyze this image.`);
      } else if (att.type === 'application/pdf') {
        parts.push(`\n\n📄 PDF ATTACHED: ${att.name} (${(att.size / 1024).toFixed(1)}KB)`);
      } else {
        parts.push(`\n\n📎 FILE ATTACHED: ${att.name} (${(att.size / 1024).toFixed(1)}KB)`);
      }
    }
    return parts.join('');
  };

  // Streaming events are now handled via per-runId callbacks in sendChatWithCallbacks
  // No global event listeners needed — each sendToAgent call gets its own isolated callbacks

  const stopAll = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    // Clean up any streaming messages
    if (pendingMsgIdRef.current && room) {
      const content = pendingContentRef.current || '*(stopped)*';
      updateMessage(roomId, pendingMsgIdRef.current, { streaming: false, content });
    }
    setTypingAgents(new Set());
    pendingAgentRef.current = null;
    pendingMsgIdRef.current = null;
    pendingContentRef.current = '';
    setLoading(false);
    setStopped(true);
  }, [roomId, room, updateMessage]);

  /** Resume agents — re-send the last user message to all room agents */
  const resumeAgents = async () => {
    if (!room) return;
    const lastUserMsg = [...room.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setStopped(false);
    setLoading(true);
    const mentioned = extractMentions(lastUserMsg.content, room.agents);
    const targets = mentioned.length > 0 ? mentioned : (room.agents.includes('mission-control') ? ['mission-control'] : room.agents);
    await routeToAgents(targets, lastUserMsg.content);
  };

  /** Extract @AgentName or @agent-id mentions from text */
  const extractMentions = (text: string, agentIds: string[]): string[] => {
    // Strip markdown formatting that might wrap mentions
    // Remove: **text**, __text__, *text*, _text_, `text`, [text](url)
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
      .replace(/__([^_]+)__/g, '$1')      // bold alt
      .replace(/\*([^*]+)\*/g, '$1')      // italic
      .replace(/_([^_]+)_/g, '$1')        // italic alt
      .replace(/`([^`]+)`/g, '$1')        // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links
    
    // Check for @all first - expands to all agents in room
    if (/@all\b/i.test(cleanText)) {
      return [...agentIds]; // Return all agents
    }
    
    const mentioned: string[] = [];
    for (const id of agentIds) {
      const name = agentName(id);
      const namePattern = new RegExp(`@${name}\\b`, 'i');
      const idPattern = new RegExp(`@${id}\\b`, 'i');
      if (namePattern.test(cleanText) || idPattern.test(cleanText)) {
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
      const sender = m.role === 'user' ? 'Kevin' : (m.agentId ? agentName(m.agentId) : 'Unknown');
      return `[${sender}]: ${m.content}`;
    });
    const fromName = fromAgent ? (agentName(fromAgent)) : 'Kevin';
    lines.push(`[${fromName}]: ${triggerContent}`);

    const otherAgents = room.agents.filter(a => a !== forAgent).map(a => agentName(a));

    // All agents can use tools in group chats
    const allowTools = true;

    const toolRule = allowTools
      ? "1. You can use tools when needed, but keep explanations brief (1-3 sentences)."
      : "1. Respond with a SHORT text message only (1-3 sentences). No tools, no files, no commands.";

    const coordinatorRule = forAgent === 'mission-control'
      ? `\n6. You are the COORDINATOR. You can @tag any agent to pull them into conversation or assign work.
7. To END a conversation thread, respond WITHOUT any @tags — this signals the discussion is done.
8. If agents are going back and forth unproductively, rein them in with a final statement (no @tags).`
      : '';

    return `You are ${agentName(forAgent)} in a multi-agent chat room called "${room.name}".
Other participants: Kevin (human), ${otherAgents.join(', ')}.

IMPORTANT RULES:
${toolRule}
2. Do NOT repeat, echo, or paraphrase what other agents said. Add YOUR OWN unique perspective only.
3. If you have nothing new to add, just say so briefly.
4. Do NOT copy another agent's message structure or content.
5. Only @tag another agent if you have a QUESTION for them. Do NOT @tag when making statements or acknowledgments — untagged responses end the thread.
6. ARTIFACTS: For any code, files, scripts, or structured data — wrap them in fenced code blocks (\`\`\`language ... \`\`\`). They will be automatically extracted to the Artifact Canvas for the user to view, copy, and download. Use \`\`\`mermaid for diagrams and \`\`\`json for data.${coordinatorRule}

## Conversation so far:
${lines.join('\n')}

Respond as ${agentName(forAgent)}${allowTools ? '' : ' (text only, no tools)'}:`;
  };

  /** Send a message to a specific agent using per-runId callbacks.
   *  Returns a promise that resolves only when the agent finishes (onEnd/onError/timeout). */
  const sendToAgent = (agentId: string, prompt: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      const msgId = `rm-${Date.now()}-${agentId}-${Math.random().toString(36).slice(2, 6)}`;
      let content = '';
      let settled = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        setTypingAgents(prev => { const n = new Set(prev); n.delete(agentId); return n; });
        // Clear shared refs only if they still belong to this agent
        if (pendingAgentRef.current === agentId) {
          pendingAgentRef.current = null;
          pendingMsgIdRef.current = null;
          pendingContentRef.current = '';
        }
        resolve(content);
      };

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

      // Safety timeout — 30s
      const timer = setTimeout(() => {
        if (!settled) {
          updateMessage(roomId, msgId, { content: content || '', streaming: false });
          settle();
        }
      }, 30000);

      // Use IIFE to avoid async Promise executor
      (async () => {
        try {
          abortControllerRef.current = new AbortController();
          const response = await fetch(`/api/agents/${agentId}/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: prompt, model: 'claude-sonnet-4-6', sessionKey: `${roomId}-${agentId}` }),
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';
            for (const part of parts) {
              if (!part.startsWith('data: ')) continue;
              const raw = part.slice(6).trim();
              if (raw === '[DONE]') { clearTimeout(timer); settle(); return; }
              try {
                const evt = JSON.parse(raw);
                if (evt.type === 'assistant' && evt.message?.content) {
                  for (const block of evt.message.content) {
                    if (block.type === 'text') {
                      content += block.text;
                      pendingContentRef.current = content;
                      updateMessage(roomId, msgId, { content });
                    }
                  }
                } else if (evt.type === 'result' && evt.result) {
                  content = evt.result;
                  pendingContentRef.current = content;
                  updateMessage(roomId, msgId, { content });
                } else if (evt.type === 'error' && evt.text) {
                  content = evt.text;
                  pendingContentRef.current = content;
                } else if (evt.type === 'timeout') {
                  content = 'Response timed out — please try again.';
                  pendingContentRef.current = content;
                } else if (evt.type === 'done') {
                  clearTimeout(timer);
                  updateMessage(roomId, msgId, { content: content || '*(no response)*', streaming: false });
                  settle();
                  return;
                }
              } catch { /* ignore parse errors */ }
            }
          }
          clearTimeout(timer);
          updateMessage(roomId, msgId, { content: content || '*(no response)*', streaming: false });
          settle();
        } catch (e: unknown) {
          clearTimeout(timer);
          updateMessage(roomId, msgId, {
            content: `Error: ${e instanceof Error ? e.message : 'Failed to reach agent'}`,
            streaming: false,
          });
          settle();
        }
      })();
    });
  };

  /** Route message to specified agents, then forward @mentions between agents */
  const routeToAgents = async (initialTargets: string[], content: string, fromAgent?: string) => {
    if (!room) return;
    const queue: Array<{ agentId: string; content: string; fromAgent?: string }> =
      initialTargets.map(id => ({ agentId: id, content, fromAgent }));

    setLoading(true);

    while (queue.length > 0 && turnResponseCountRef.current < MAX_AGENT_RESPONSES_PER_TURN) {
      if (abortRef.current) break;
      const next = queue.shift()!;
      const prompt = buildContext(next.agentId, next.content, next.fromAgent);
      turnResponseCountRef.current++;

      const responseContent = await sendToAgent(next.agentId, prompt);

      // Forward @mentions from agent responses to mentioned agents
      if (responseContent?.trim()) {
        const mentioned = extractMentions(responseContent, room.agents);
        const targets = mentioned.filter(id => id !== next.agentId);
        
        for (const target of targets) {
          queue.push({ agentId: target, content: responseContent, fromAgent: next.agentId });
        }
      }
    }

    if (queue.length > 0 && !abortRef.current) {
      addMessage(roomId, {
        id: `rm-${Date.now()}-limit`,
        role: 'agent',
        content: '\u23f8 Response limit reached \u2014 send a message to continue.',
        timestamp: Date.now(),
      });
    }

    setLoading(false);
  };

  /** Handle user sending a message */
  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    if (!room) return;

    // Process attachments
    const fileContent = attachments.length > 0 ? await processAttachments() : '';
    const fullContent = text + fileContent;

    // Display message (show attachment badges to user)
    const displayContent = text + (attachments.length > 0 ? `\n\n📎 ${attachments.map(a => a.name).join(', ')}` : '');

    const userMsg: RoomMessage = {
      id: `rm-${Date.now()}-user`,
      role: 'user',
      content: displayContent,
      timestamp: Date.now(),
    };
    addMessage(roomId, userMsg);
    setInput('');
    setAttachments([]);

    // Determine which agents to address
    // When no @mention, only route to mission-control (orchestrator) to avoid waking all agents
    const mentioned = extractMentions(text, room.agents);
    const targets = mentioned.length > 0 ? mentioned : (room.agents.includes('mission-control') ? ['mission-control'] : room.agents);

    setStopped(false);
    setLoading(true);
    turnResponseCountRef.current = 0;
    await routeToAgents(targets, fullContent);
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
    const lastAt = input.lastIndexOf('@');
    const before = input.slice(0, lastAt);
    // Special case for @all
    const mentionText = agentId === 'all' ? 'all' : agentName(agentId);
    setInput(`${before}@${mentionText} `);
    setShowMentions(false);
    setMentionFilter('');
    inputRef.current?.focus();
  };

  if (!room) {
    return (
      <div className="h-full flex items-center justify-center text-mission-control-text-dim">
        <p>Room not found</p>
      </div>
    );
  }

  // Build filtered agents list with @all option
  const agentMatches = room.agents.filter(id => {
    const name = agentName(id);
    return name.toLowerCase().includes(mentionFilter);
  });
  
  // Add @all option if it matches the filter and there are multiple agents
  const filteredAgents = [
    ...(room.agents.length > 1 && 'all'.includes(mentionFilter) ? ['all'] : []),
    ...agentMatches
  ];

  // Detect if this is a team meeting (has all or nearly all agents)
  const totalAgents = agents.length;
  const isTeamMeeting = room.agents.length >= totalAgents - 1 || room.name.toLowerCase().includes('team meeting');

  return (
    <div className="h-full flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`p-4 border-b flex items-center gap-3 ${
          isTeamMeeting
            ? 'bg-warning/10 border-amber-500/30'
            : 'bg-mission-control-surface border-mission-control-border'
        }`}>
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-mission-control-border transition-colors"
          title="Back to chat"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          {isTeamMeeting ? (
            <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center shadow-md">
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
            <p className="text-xs text-mission-control-text-dim">
              {isTeamMeeting
                ? `All ${room.agents.length} agents present`
                : `You + ${room.agents.map(id => agentName(id)).join(', ')}`
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
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-white/80 dark:border-white" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-mission-control-surface text-mission-control-text text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {agentName(id)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Stop / Resume toggle */}
          {(loading || typingAgents.size > 0 || room.messages.some(m => m.streaming)) ? (
            <button
              onClick={stopAll}
              className="w-8 h-8 rounded-lg border-2 border-red-500 text-error hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
              title="Stop all agents"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : stopped ? (
            <button
              onClick={resumeAgents}
              className="w-8 h-8 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center"
              title="Resume agents"
            >
              <Square size={12} fill="white" />
            </button>
          ) : null}
          {/* Manage members */}
          <button
            onClick={() => setShowManageMembers(true)}
            className="p-2 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors"
            title="Manage members"
          >
            <UserPlus size={18} />
          </button>
          {/* Voice meeting toggle */}
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            className={`p-2 rounded-lg transition-colors ${
              voiceMode
                ? 'bg-success-subtle text-success ring-1 ring-success/50'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border'
            }`}
            title={voiceMode ? 'Switch to text chat' : 'Start voice meeting'}
          >
            <Phone size={16} />
          </button>
          <button
            onClick={() => {
              showConfirm({
                title: isTeamMeeting ? 'End Meeting' : 'Delete Room',
                message: isTeamMeeting ? 'End this meeting?' : 'Delete this room?',
                confirmLabel: isTeamMeeting ? 'End Meeting' : 'Delete Room',
                type: 'warning',
              }, async () => {
                deleteRoom(room.id);
                onBack();
              });
            }}
            className={`p-2 rounded-lg transition-colors ${
              isTeamMeeting
                ? 'text-amber-400 hover:text-error hover:bg-error-subtle'
                : 'text-mission-control-text-dim hover:text-error hover:bg-error-subtle'
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
          <div className="text-center py-16 text-mission-control-text-dim">
            {isTeamMeeting ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
                  <UsersRound size={40} className="text-amber-500" />
                </div>
                <p className="text-lg font-medium mb-2 text-amber-500">Team Meeting Started 🏢</p>
                <p className="text-sm mb-4">
                  All {room.agents.length} agents are present and ready.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md mx-auto">
                  {room.agents.map(id => (
                    <div key={id} className="flex items-center gap-1.5 px-2.5 py-1 bg-mission-control-surface border border-mission-control-border rounded-full text-xs">
                      <AgentAvatar agentId={id} size="xs" />
                      <span>{agentName(id)}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    </div>
                  ))}
                </div>
                <p className="text-xs mb-4">
                  Use <span className="font-mono bg-mission-control-bg px-1.5 py-0.5 rounded">@all</span> to notify everyone, or <span className="font-mono bg-mission-control-bg px-1.5 py-0.5 rounded">@AgentName</span> for specific agents.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                  {["@all Let's discuss the sprint plan", "@all Team status update", "@Chief What are the priorities?"].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="px-3 py-1.5 text-xs bg-warning/10 border border-amber-500/30 rounded-lg hover:border-amber-500 transition-colors"
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
                  Start a conversation with {room.agents.map(id => agentName(id)).join(' and ')}.
                </p>
                <p className="text-xs">
                  Use <span className="font-mono bg-mission-control-bg px-1.5 py-0.5 rounded">@all</span> to notify everyone,
                  or <span className="font-mono bg-mission-control-bg px-1.5 py-0.5 rounded">@AgentName</span> for specific agents.
                </p>
              </>
            )}
          </div>
        ) : (
          (() => {
            const displayedMessages = room.messages.filter(m => {
              const t = m.content?.trim();
              if (t === 'NO_REPLY' || t === 'HEARTBEAT_OK' || t === 'NO' || t === 'NO_RE' || t === 'NO_') return false;
              return m.streaming || t;
            });
            return displayedMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const theme = msg.agentId ? getAgentTheme(msg.agentId) : null;
            const prev = idx > 0 ? displayedMessages[idx - 1] : null;
            const showAvatar = !prev || prev.agentId !== msg.agentId || prev.role !== msg.role;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-4' : 'mt-1'}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 ${!showAvatar ? 'invisible' : ''}`}>
                  {isUser ? (
                    <div className="w-9 h-9 rounded-full bg-mission-control-accent flex items-center justify-center text-white text-sm font-semibold">
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
                      isUser ? 'text-mission-control-accent' : (theme?.text || 'text-mission-control-text-dim')
                    }`}>
                      {isUser ? 'Kevin' : (msg.agentId ? agentName(msg.agentId) : 'Agent')}
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      isUser
                        ? 'bg-mission-control-accent text-white rounded-tr-sm'
                        : `bg-mission-control-surface/90 backdrop-blur-sm border ${theme?.border || 'border-mission-control-border'} rounded-tl-sm shadow-sm`
                    }`}
                  >
                    {msg.streaming && !msg.content ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-mission-control-text-dim">
                          {msg.agentId ? agentName(msg.agentId) : 'Agent'} is thinking...
                        </span>
                      </div>
                    ) : !isUser ? (
                      <MarkdownMessage
                        content={msg.content}
                        mentions={{ ids: room.agents, names: Object.fromEntries(room.agents.map(id => [id, agentName(id)])) }}
                        onArtifactOpen={handleArtifactOpen}
                      />
                    ) : (
                      <MentionText 
                        text={msg.content} 
                        agentIds={room.agents}
                        agentNames={Object.fromEntries(room.agents.map(id => [id, agentName(id)]))}
                      />
                    )}
                    {msg.streaming && msg.content && (
                      <div className="flex items-center gap-1.5 mt-2 opacity-60">
                        <div className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-pulse" />
                        <span className="text-xs text-mission-control-text-dim">typing...</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-mission-control-text-dim mt-1 px-1">{time}</span>
                </div>
              </div>
            );
          });
          })()
        )}

        {/* Typing indicators for agents */}
        {typingAgents.size > 0 && !room.messages.some(m => m.streaming) && (
          <div className="flex items-center gap-2 text-sm text-mission-control-text-dim pl-12">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            {[...typingAgents].map(id => agentName(id)).join(', ')} typing...
          </div>
        )}

        {/* Agent background task status — shows what dispatched agents are working on */}
        {Object.entries(agentTaskStatus).map(([agentId, task]) => (
          task.lastAgentUpdate ? (
            <div key={agentId} className="mx-4 mb-2 px-3 py-2 rounded-lg bg-mission-control-surface border border-mission-control-border/60 flex items-start gap-2.5 text-xs">
              <AgentAvatar agentId={agentId} size="xs" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-mission-control-text">{agentName(agentId)}</span>
                <span className="text-mission-control-text-dim mx-1.5">•</span>
                <span className="text-mission-control-text-dim">{task.title}</span>
                <p className="mt-0.5 text-mission-control-text-dim truncate">{task.lastAgentUpdate}</p>
              </div>
            </div>
          ) : null
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="p-4 border-t border-mission-control-border bg-mission-control-surface relative"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(Array.from(e.dataTransfer.files)); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          // Only prevent default for drop zone shortcuts when not typing in an input
          const target = e.target as HTMLElement;
          const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
          if (!isInputField && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            // Keyboard drop - could implement if needed
          }
        }}
        aria-label="Chat input - drop files here"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = ''; }}
        />

        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              const isImage = att.type.startsWith('image/');
              return (
                <div key={att.id} className="relative group">
                  {isImage && att.dataUrl ? (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-mission-control-border">
                      <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg">
                      <Icon size={16} className="text-mission-control-accent" />
                      <span className="text-sm truncate max-w-32">{att.name}</span>
                      <span className="text-xs text-mission-control-text-dim">{(att.size / 1024).toFixed(1)}KB</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* @ Mention autocomplete */}
        {showMentions && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl overflow-hidden">
            {filteredAgents.map(id => {
              // Special case for @all
              if (id === 'all') {
                return (
                  <button
                    key="all"
                    onClick={() => insertMention('all')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors border-b border-mission-control-border"
                  >
                    <div className="w-8 h-8 rounded-full bg-mission-control-accent/20 flex items-center justify-center">
                      <UsersRound size={16} className="text-mission-control-accent" />
                    </div>
                    <span className="font-medium text-sm text-mission-control-accent">all</span>
                    <span className="text-xs text-mission-control-text-dim">Notify all {room.agents.length} agents</span>
                  </button>
                );
              }
              
              const agent = agents.find(a => a.id === id);
              const theme = getAgentTheme(id);
              return (
                <button
                  key={id}
                  onClick={() => insertMention(id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors"
                >
                  <AgentAvatar agentId={id} size="sm" />
                  <span className={`font-medium text-sm ${theme.text}`}>{agent?.name || id}</span>
                  <span className="text-xs text-mission-control-text-dim">{agent?.description}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors self-stretch flex items-center"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <button
            onClick={() => setShowMentions(!showMentions)}
            className={`p-3 rounded-xl transition-all self-stretch flex items-center ${
              showMentions ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
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
              className="w-full bg-mission-control-surface border border-mission-control-border rounded-xl px-4 py-3 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none transition-colors"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() && attachments.length === 0}
            className="p-3 bg-mission-control-accent text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 self-stretch flex items-center"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
      </>
      )}
      {/* Manage Members Modal */}
      {showManageMembers && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" 
          onClick={() => setShowManageMembers(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setShowManageMembers(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close member management"
        >
          <div 
            className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl" 
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            role="presentation"
          >
            <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
              <h3 className="font-semibold">Manage Members</h3>
              <button onClick={() => setShowManageMembers(false)} className="text-mission-control-text-dim hover:text-mission-control-text text-lg">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-1">
              {agents.map((agent) => {
                const inRoom = room.agents.includes(agent.id);
                const theme = getAgentTheme(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => {
                      const updated = inRoom
                        ? room.agents.filter(a => a !== agent.id)
                        : [...room.agents, agent.id];
                      if (updated.length > 0) updateRoomAgents(roomId, updated);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      inRoom ? 'bg-mission-control-accent/10 ring-1 ring-mission-control-accent/30' : 'hover:bg-mission-control-bg'
                    }`}
                  >
                    <AgentAvatar agentId={agent.id} size="sm" />
                    <div className="flex-1 text-left">
                      <span className={`text-sm font-medium ${inRoom ? theme.text : 'text-mission-control-text-dim'}`}>{agent.name}</span>
                      <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inRoom ? 'bg-success-subtle text-success' : 'bg-mission-control-bg text-mission-control-text-dim'}`}>
                      {inRoom ? 'In room' : 'Add'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-mission-control-border text-center text-xs text-mission-control-text-dim">
              {room.agents.length} agent{room.agents.length !== 1 ? 's' : ''} in room
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={open}
        onClose={closeConfirm}
        onConfirm={onConfirm}
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        cancelLabel={config.cancelLabel}
        type={config.type}
      />
      </div>
      
      {/* Artifact Panel */}
      <ArtifactPanel sessionId={roomId} />
    </div>
  );
}
