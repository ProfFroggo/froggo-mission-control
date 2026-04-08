import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, IconButton, TextField, TextArea, Flex } from '@radix-ui/themes';
import { Send, ArrowLeft, Users, Trash2, AtSign, UsersRound, Phone, Square, UserPlus, Paperclip, X, FileText, FileCode2, Image, File, Search, Settings, Pin, Reply, ChevronDown, MessageCircle, PanelRight, Network, Database, Mic, MicOff } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import MarkdownMessage from './MarkdownMessage';
import MentionText from './MentionText';
import TeamVoiceMeeting from './TeamVoiceMeeting';
import ArtifactPanel from './ArtifactPanel';
import { getAgentTheme } from '../utils/agentThemes';
import { GeminiStt } from '../lib/globalStt';
import { useChatRoomStore, type RoomMessage } from '../store/chatRoomStore';
import { useStore } from '../store/store';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { useArtifactExtraction } from '../hooks/useArtifactExtraction';
import { useArtifactOpen } from '../hooks/useArtifactOpen';
import { useArtifactStore } from '../store/artifactStore';
import ToolPermissionCard, { type ToolPermissionRequest } from './ToolPermissionCard';
import MessageReactions from './MessageReactions';
import RoomSettingsPanel, { useRoomNotifSetting } from './RoomSettingsPanel';
import {
  MissionControlComposer,
  ensureCSS,
  parseMessageContent,
  groupParsedItems,
  ThinkingBlock,
  ToolGroupBlock,
} from './chat/ThreadStyles';

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
  hideDelete?: boolean;
  hideHeader?: boolean;
}

const MAX_AGENT_RESPONSES_PER_TURN = 15;

// Relative timestamp helper
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Convert tool names like mcp__mission-control_db__task_update → "task_update"
function formatToolName(name: string): string {
  const parts = name.split('__');
  const last = parts[parts.length - 1] || name;
  return last.replace(/_/g, ' ');
}

/** Extract plain text from JSON-serialized content blocks so artifact detection sees real newlines */
function extractTextForArtifacts(content: string): string {
  try {
    if (content.startsWith('[')) {
      const blocks = JSON.parse(content);
      if (Array.isArray(blocks) && blocks[0]?.type) {
        return blocks
          .filter((b: any) => b.type === 'text' && b.text)
          .map((b: any) => b.text)
          .join('\n');
      }
    }
  } catch { /* not JSON, use as-is */ }
  return content;
}

/** Renders structured agent messages with collapsible thinking/tool blocks — same as main chat */
function RoomStructuredMessage({ content, streaming, onArtifactOpen }: { content: string; streaming: boolean; onArtifactOpen?: (lang: string, code: string) => void }) {
  ensureCSS();
  const { items, isParsed } = parseMessageContent(content);

  if (!isParsed) {
    return <MarkdownMessage content={content} onArtifactOpen={onArtifactOpen} />;
  }

  const grouped = groupParsedItems(items, streaming);
  return (
    <div className="flex flex-col gap-1">
      {grouped.map((g, i) => {
        if (g.kind === 'thinking') return <ThinkingBlock key={i} text={g.text} />;
        if (g.kind === 'tools') return <ToolGroupBlock key={i} tools={g.tools} hasRunning={g.hasRunning} />;
        return <MarkdownMessage key={i} content={g.text} onArtifactOpen={onArtifactOpen} />;
      })}
    </div>
  );
}

const ARTIFACT_TYPE_ICONS: Record<string, typeof FileText> = {
  file: FileCode2, text: FileText, diagram: Network, image: Image, data: Database, code: FileCode2,
};

/** Shows extracted artifact cards below a room message — matches main chat design */
function RoomMessageArtifactCards({ messageId }: { messageId: string }) {
  const allArtifacts = useArtifactStore(s => s.artifacts);
  const { selectArtifact, setCollapsed } = useArtifactStore();
  const messageArtifacts = useMemo(
    () => allArtifacts.filter(a => a.messageId === messageId),
    [allArtifacts, messageId]
  );

  if (messageArtifacts.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1">
      {messageArtifacts.map(artifact => {
        const Icon = ARTIFACT_TYPE_ICONS[artifact.type] ?? FileText;
        const lang = artifact.metadata?.language?.toUpperCase();
        const typeLabel = [artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1), lang].filter(Boolean).join(' \u00b7 ');
        return (
          <div
            key={artifact.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30 transition-colors cursor-pointer select-none"
            onClick={() => { setCollapsed(false); selectArtifact(artifact.id); }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setCollapsed(false); selectArtifact(artifact.id); } }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border border-mission-control-border bg-mission-control-bg">
              <Icon size={16} className="text-mission-control-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold leading-snug truncate text-mission-control-text">{artifact.title}</div>
              <div className="text-[11px] text-mission-control-text-dim">{typeLabel}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCollapsed(false); selectArtifact(artifact.id); }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/20 hover:bg-mission-control-accent/20 transition-colors flex-shrink-0"
            >
              Open
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function ChatRoomView({ roomId, onBack, hideDelete = false, hideHeader = false }: ChatRoomViewProps) {
  ensureCSS();
  const { rooms, addMessage, updateMessage, updateRoomAgents, updateRoom, deleteRoom, loadMessages } = useChatRoomStore();
  const agents = useStore(s => s.agents);
  const room = rooms.find(r => r.id === roomId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const { open, config, onConfirm, showConfirm, closeConfirm } = useConfirmDialog();
  // Auto-extract artifacts from messages — pre-process JSON blocks so code fences have real newlines
  const projectId = roomId.startsWith('project-') ? roomId.slice('project-'.length) : undefined;
  useArtifactExtraction(
    room?.messages.map(m => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: extractTextForArtifacts(m.content),
      timestamp: m.timestamp,
      streaming: m.streaming,
    })) || [],
    roomId,
    {
      autoExtract: true,
      extractFromAssistant: true,
      extractFromUser: false,
      projectId,
    }
  );

  // Artifact store — for wiring "Open Preview" cards in messages
  const handleArtifactOpen = useArtifactOpen();
  const { toggleCollapse, isCollapsed, setFilterBySession } = useArtifactStore();

  // Filter artifacts to this room's session
  useEffect(() => { setFilterBySession(roomId); return () => setFilterBySession(null); }, [roomId, setFilterBySession]);

  // Helper to get agent name from store
  const agentName = useCallback((id: string) => agents.find(a => a.id === id)?.name || id, [agents]);
  const [typingAgents, setTypingAgents] = useState<Set<string>>(new Set());
  const [showMentions, setShowMentions] = useState(false);
  // Track in-progress task status per agent (agentId -> { taskId, title, lastAgentUpdate })
  const [agentTaskStatus, setAgentTaskStatus] = useState<Record<string, { id: string; title: string; lastAgentUpdate: string | null }>>({});
  // Track current tool call + thinking excerpt per streaming message (msgId -> label)
  const [streamingStatus, setStreamingStatus] = useState<Record<string, string>>({});;
  const [mentionFilter, setMentionFilter] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [listening, setListening] = useState(false);
  const sttRef = useRef<GeminiStt | null>(null);
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
  // Pending tool permission requests — keyed by approvalId
  const [pendingPermissions, setPendingPermissions] = useState<Map<string, ToolPermissionRequest & { msgId: string }>>(new Map());

  // --- Chat Rooms v2 features ---
  const [presenceUsers, setPresenceUsers] = useState<Array<{ id: string; name: string; avatar?: string; joinedAt: number }>>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchMatchIdsRef = useRef<string[]>([]);
  const [replyToMsg, setReplyToMsg] = useState<RoomMessage | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [,] = useRoomNotifSetting(roomId);

  // Load message history from DB when opening a room (only if empty)
  useEffect(() => {
    if (room && room.messages.length === 0) {
      loadMessages(roomId);
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presence: join on mount, leave on unmount
  useEffect(() => {
    fetch('/api/chat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', roomId, userId: 'user', name: 'You' }),
    }).then(r => r.json()).then(d => setPresenceUsers(d.users ?? [])).catch(err => console.warn('[ChatRoomView] Non-critical:', err));
    return () => {
      fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave', roomId, userId: 'user' }),
      }).catch(err => console.warn('[ChatRoomView] Non-critical:', err));
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search: focus input on show
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // Keyboard: Cmd+F → toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch]);

  // Scroll to current search match
  useEffect(() => {
    const ids = searchMatchIdsRef.current;
    if (!ids.length) return;
    const msgId = ids[searchMatchIdx];
    if (!msgId) return;
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchMatchIdx]); // eslint-disable-line react-hooks/exhaustive-deps

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
      } catch (err) { console.warn('[ChatRoomView] Non-critical:', err); }
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
      } catch (err) { console.warn('[ChatRoomView] Non-critical: ignore parse errors:', err); }
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
        } catch (err) {
          console.warn('[ChatRoomView] Non-critical:', err);
          parts.push(`\n\n[Attached text file: ${att.name} - could not decode]`);
        }
      } else if (att.type.startsWith('image/')) {
        parts.push(`\n\n[IMAGE ATTACHED: ${att.name}]\nPlease use the image tool or Read tool to analyze this image.`);
      } else if (att.type === 'application/pdf') {
        parts.push(`\n\n[PDF ATTACHED: ${att.name} (${(att.size / 1024).toFixed(1)}KB)]`);
      } else {
        parts.push(`\n\n[FILE ATTACHED: ${att.name} (${(att.size / 1024).toFixed(1)}KB)]`);
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
    const freshRoom = useChatRoomStore.getState().rooms.find(r => r.id === roomId);
    if (!freshRoom) return;
    const lastUserMsg = [...freshRoom.messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setStopped(false);
    setLoading(true);
    const mentioned = extractMentions(lastUserMsg.content, freshRoom.agents);
    const targets = mentioned.length > 0 ? mentioned : (freshRoom.agents.includes('mission-control') ? ['mission-control'] : freshRoom.agents);
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

  /** Build context from recent room messages for an agent.
   *  CRITICAL: reads live store state, NOT the stale `room` closure — ensures
   *  the second agent in a sequential queue sees the first agent's response. */
  const buildContext = (forAgent: string, triggerContent: string, fromAgent?: string): string => {
    // Read fresh room state from store — the closure-captured `room` is stale during async routeToAgents
    const currentRoom = useChatRoomStore.getState().rooms.find(r => r.id === roomId);
    if (!currentRoom) return triggerContent;
    // Include last 15 messages as context
    const recent = currentRoom.messages.slice(-15);
    const lines = recent.map(m => {
      const sender = m.role === 'user' ? 'Kevin' : (m.agentId ? agentName(m.agentId) : 'Unknown');
      // Extract readable text from structured JSON blocks
      const text = extractTextForArtifacts(m.content);
      return `[${sender}]: ${text}`;
    });
    const fromName = fromAgent ? (agentName(fromAgent)) : 'Kevin';
    lines.push(`[${fromName}]: ${triggerContent}`);

    const otherAgents = currentRoom.agents.filter(a => a !== forAgent).map(a => agentName(a));

    // All agents can use tools in group chats
    const allowTools = true;

    const toolRule = allowTools
      ? "1. You can use tools when needed, but keep explanations brief (1-3 sentences)."
      : "1. Respond with a SHORT text message only (1-3 sentences). No tools, no files, no commands.";

    const coordinatorRule = forAgent === 'mission-control'
      ? `\n7. You are the COORDINATOR. You can @tag any agent to pull them into conversation or assign work.
8. To END a conversation thread, respond WITHOUT any @tags — this signals the discussion is done.
9. If agents are going back and forth unproductively, rein them in with a final statement (no @tags).`
      : '';

    return `You are ${agentName(forAgent)} in a multi-agent chat room called "${currentRoom.name}".
Other participants: Kevin (human), ${otherAgents.join(', ')}.

IMPORTANT RULES:
${toolRule}
2. Do NOT repeat, echo, or paraphrase what other agents said. Add YOUR OWN unique perspective only.
3. If you have nothing new to add, just say so briefly.
4. Do NOT copy another agent's message structure or content.
5. BEFORE building anything, check the conversation history above. If another agent has ALREADY built or is building the same thing, do NOT duplicate their work. Instead, review their output and offer improvements, critique, or complementary work.
6. Only @tag another agent if you have a QUESTION for them. Do NOT @tag when making statements or acknowledgments — untagged responses end the thread.
7. ARTIFACTS: For any code, files, scripts, or structured data — wrap them in fenced code blocks (\`\`\`language ... \`\`\`). They will be automatically extracted to the Artifact Canvas for the user to view, copy, and download. Use \`\`\`mermaid for diagrams and \`\`\`json for data.
8. SAVE DELIVERABLES: When you produce a substantial deliverable (HTML page, script, document, etc.), ALSO save it to the library using the Write tool: \`~/mission-control/library/{descriptive-name}.{ext}\`. This ensures the work is persisted and accessible later. Always save first, then share the content in your message.${coordinatorRule}

## Conversation so far:
${lines.join('\n')}

Respond as ${agentName(forAgent)}${allowTools ? '' : ' (text only, no tools)'}:`;
  };

  /** Send a message to a specific agent using per-runId callbacks.
   *  Returns a promise that resolves only when the agent finishes (onEnd/onError/timeout).
   *  Accumulates structured content blocks (thinking, tool_use, text) for rich rendering. */
  const sendToAgent = (agentId: string, prompt: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      const msgId = `rm-${Date.now()}-${agentId}-${Math.random().toString(36).slice(2, 6)}`;
      let textContent = '';
      const blocks: any[] = [];
      let settled = false;

      const serializeBlocks = () => JSON.stringify(blocks);

      const settle = () => {
        if (settled) return;
        settled = true;
        setTypingAgents(prev => { const n = new Set(prev); n.delete(agentId); return n; });
        setStreamingStatus(prev => { const n = { ...prev }; delete n[msgId]; return n; });
        if (pendingAgentRef.current === agentId) {
          pendingAgentRef.current = null;
          pendingMsgIdRef.current = null;
          pendingContentRef.current = '';
        }
        resolve(textContent);
      };

      pendingAgentRef.current = agentId;
      pendingMsgIdRef.current = msgId;
      pendingContentRef.current = '';

      setTypingAgents(prev => new Set(prev).add(agentId));

      addMessage(roomId, {
        id: msgId,
        role: 'agent',
        agentId,
        content: '',
        timestamp: Date.now(),
        streaming: true,
      });

      const timer = setTimeout(() => {
        if (!settled) {
          updateMessage(roomId, msgId, { content: blocks.length > 0 ? serializeBlocks() : textContent || '', streaming: false });
          settle();
        }
      }, 30000);

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
                      textContent += block.text;
                      blocks.push({ type: 'text', text: block.text });
                      pendingContentRef.current = textContent;
                      updateMessage(roomId, msgId, { content: serializeBlocks() });
                      setStreamingStatus(prev => { const n = { ...prev }; delete n[msgId]; return n; });
                    } else if (block.type === 'tool_use' && block.name) {
                      blocks.push({ type: 'tool_use', name: block.name, input: block.input, id: block.id });
                      const toolLabel = formatToolName(block.name as string);
                      setStreamingStatus(prev => ({ ...prev, [msgId]: toolLabel }));
                      updateMessage(roomId, msgId, { content: serializeBlocks() });
                    } else if (block.type === 'tool_result') {
                      blocks.push({ type: 'tool_result', tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error });
                      updateMessage(roomId, msgId, { content: serializeBlocks() });
                    } else if (block.type === 'thinking' && block.thinking) {
                      blocks.push({ type: 'thinking', thinking: block.thinking });
                      const excerpt = (block.thinking as string).slice(0, 120).replace(/\n+/g, ' ').trim();
                      setStreamingStatus(prev => ({ ...prev, [msgId]: excerpt + (block.thinking.length > 120 ? '…' : '') }));
                      updateMessage(roomId, msgId, { content: serializeBlocks() });
                    }
                  }
                } else if (evt.type === 'result' && evt.result) {
                  textContent = evt.result;
                  pendingContentRef.current = textContent;
                  // Result might be structured JSON or plain text
                  updateMessage(roomId, msgId, { content: evt.result });
                } else if (evt.type === 'error' && evt.text) {
                  textContent = evt.text;
                  pendingContentRef.current = textContent;
                } else if (evt.type === 'tool_permission_request' && evt.toolName && evt.approvalId) {
                  const req: ToolPermissionRequest & { msgId: string } = {
                    approvalId: evt.approvalId as string,
                    toolName: evt.toolName as string,
                    reason: (evt.reason as string) ?? '',
                    agentId: (evt.agentId as string) ?? agentId,
                    sessionKey: `${roomId}-${agentId}`,
                    msgId,
                  };
                  setPendingPermissions(prev => new Map(prev).set(req.approvalId, req));
                } else if (evt.type === 'timeout') {
                  textContent = 'Response timed out — please try again.';
                  pendingContentRef.current = textContent;
                } else if (evt.type === 'done') {
                  clearTimeout(timer);
                  const finalContent = blocks.length > 0 ? serializeBlocks() : (textContent || '*(no response)*');
                  updateMessage(roomId, msgId, { content: finalContent, streaming: false });
                  settle();
                  return;
                }
              } catch (err) { console.warn('[ChatRoomView] Non-critical: ignore parse errors:', err); }
            }
          }
          clearTimeout(timer);
          const finalContent = blocks.length > 0 ? serializeBlocks() : (textContent || '*(no response)*');
          updateMessage(roomId, msgId, { content: finalContent, streaming: false });
          settle();
        } catch (e: unknown) {
          clearTimeout(timer);
          if (e instanceof DOMException && e.name === 'AbortError') {
            const finalContent = blocks.length > 0 ? serializeBlocks() : (textContent || '*(stopped)*');
            updateMessage(roomId, msgId, { content: finalContent, streaming: false });
            settle();
            return;
          }
          updateMessage(roomId, msgId, {
            content: `Error: ${e instanceof Error ? e.message : 'Failed to reach agent'}`,
            streaming: false,
          });
          settle();
        }
      })();
    });
  };

  /** Route message to specified agents, then forward @mentions between agents.
   *  Agents respond SEQUENTIALLY — each sees the previous agent's response in context
   *  (buildContext reads fresh store state). */
  const routeToAgents = async (initialTargets: string[], content: string, fromAgent?: string) => {
    // Read fresh room state for agent list (closure `room` may be stale)
    const currentRoom = useChatRoomStore.getState().rooms.find(r => r.id === roomId);
    if (!currentRoom) return;
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
        const freshRoom = useChatRoomStore.getState().rooms.find(r => r.id === roomId);
        const roomAgents = freshRoom?.agents ?? currentRoom.agents;
        const mentioned = extractMentions(responseContent, roomAgents);
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

  /** Handle user sending a message — queues if agents are currently responding */
  const handleSend = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (!room) return;

    // If agents are currently streaming, queue this message for after they finish
    if (loading) {
      setQueuedMessage(text);
      setInput('');
      return;
    }

    const fileContent = attachments.length > 0 ? await processAttachments() : '';
    const fullContent = text + fileContent;

    const displayContent = text + (attachments.length > 0 ? `\n\n[Attached: ${attachments.map(a => a.name).join(', ')}]` : '');

    const userMsg: RoomMessage = {
      id: `rm-${Date.now()}-user`,
      role: 'user',
      content: displayContent,
      timestamp: Date.now(),
      parentId: replyToMsg?.id,
    };
    addMessage(roomId, userMsg);
    setInput('');
    setAttachments([]);
    setReplyToMsg(null);

    const mentioned = extractMentions(text, room.agents);
    const targets = mentioned.length > 0 ? mentioned : (room.agents.includes('mission-control') ? ['mission-control'] : room.agents);

    setStopped(false);
    setLoading(true);
    turnResponseCountRef.current = 0;
    await routeToAgents(targets, fullContent);
  };

  // Process queued message after agents finish responding
  useEffect(() => {
    if (!loading && queuedMessage) {
      const queued = queuedMessage;
      setQueuedMessage(null);
      setInput(queued);
      // Small delay so state settles, then auto-send
      const timer = setTimeout(() => {
        setInput('');
        // Re-run handleSend logic inline since we can't call async in effect cleanly
        if (!room) return;
        const mentioned = extractMentions(queued, room.agents);
        const targets = mentioned.length > 0 ? mentioned : (room.agents.includes('mission-control') ? ['mission-control'] : room.agents);
        const userMsg: RoomMessage = {
          id: `rm-${Date.now()}-user`,
          role: 'user',
          content: queued,
          timestamp: Date.now(),
        };
        addMessage(roomId, userMsg);
        setStopped(false);
        setLoading(true);
        turnResponseCountRef.current = 0;
        routeToAgents(targets, queued);
      }, 150);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, queuedMessage]);

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

  // Cleanup STT on unmount
  useEffect(() => {
    return () => { sttRef.current?.stop(); };
  }, []);

  const toggleVoice = () => {
    if (listening && sttRef.current) {
      sttRef.current.stop();
      setListening(false);
      return;
    }
    const stt = new GeminiStt({
      continuous: false,
      chunkDurationMs: 10000,
      onTranscript: (text) => { setInput(prev => prev ? `${prev} ${text}` : text); },
      onError: (err) => { console.warn('[ChatRoomView STT]', err); },
      onEnd: () => { setListening(false); },
    });
    sttRef.current = stt;
    stt.start();
    setListening(true);
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
      <div className="h-full flex-1 flex items-center justify-center text-mission-control-text-dim" style={{ minWidth: 0 }}>
        <p>Room not found</p>
      </div>
    );
  }

  // Compute search match IDs (plain array — not a hook, safe after early return)
  const searchMatchIds = (() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return room.messages
      .filter(m => m.content?.toLowerCase().includes(q))
      .map(m => m.id);
  })();
  searchMatchIdsRef.current = searchMatchIds;

  // Pinned message reference
  const pinnedMessage = room.pinnedMessageId
    ? room.messages.find(m => m.id === room.pinnedMessageId) ?? null
    : null;

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
    <Flex height="100%" flexGrow="1" style={{ minWidth: 0 }}>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {!hideHeader && <div className={`flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0 gap-3 ${
          isTeamMeeting
            ? 'bg-warning/10 border-warning/30'
            : 'bg-mission-control-surface'
        }`}>
        <button
          onClick={onBack}
          title="Back to chat"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <Flex align="center" gap="2">
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
            <h2 className={`font-semibold text-sm ${isTeamMeeting ? 'text-warning' : ''}`}>
              {room.name}
            </h2>
            <p className="text-xs text-mission-control-text-dim">
              {isTeamMeeting
                ? `All ${room.agents.length} agents present`
                : `You + ${room.agents.map(id => agentName(id)).join(', ')}`
              }
            </p>
          </div>
        </Flex>

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

        {/* Presence avatar stack */}
        {presenceUsers.length > 0 && (
          <div className="hidden sm:flex items-center ml-2">
            <div className="flex -space-x-2">
              {presenceUsers.slice(0, 3).map(u => (
                <div
                  key={u.id}
                  title={u.name}
                  className="w-6 h-6 rounded-full bg-success flex items-center justify-center text-white text-xs font-semibold border-2 border-mission-control-surface ring-0"
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {presenceUsers.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-mission-control-border flex items-center justify-center text-xs font-semibold border-2 border-mission-control-surface text-mission-control-text-dim">
                  +{presenceUsers.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Search toggle */}
          <button
            onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
            title="Search messages (Cmd+F)"
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              showSearch
                ? 'bg-mission-control-accent/10 border border-mission-control-accent/30 text-mission-control-accent'
                : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Search size={16} />
          </button>
          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            title="Room settings"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <Settings size={16} />
          </button>
          {/* Stop / Resume toggle */}
          {(loading || typingAgents.size > 0 || room.messages.some(m => m.streaming)) ? (
            <IconButton
              onClick={stopAll}
              size="2"
              variant="outline"
              color="red"
             
              title="Stop all agents"
            >
              <Square size={14} fill="currentColor" />
            </IconButton>
          ) : stopped ? (
            <IconButton
              onClick={resumeAgents}
              size="2"
              variant="solid"
              color="red"
             
              title="Resume agents"
            >
              <Square size={12} fill="white" />
            </IconButton>
          ) : null}
          {/* Manage members */}
          <button
            onClick={() => setShowManageMembers(true)}
            title="Manage members"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <UserPlus size={18} />
          </button>
          {/* Voice meeting toggle */}
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            title={voiceMode ? 'Switch to text chat' : 'Start voice meeting'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              voiceMode
                ? 'bg-mission-control-accent/10 border border-mission-control-accent/30 text-mission-control-accent'
                : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Phone size={16} />
          </button>
          {/* Artifact panel toggle */}
          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Open artifacts' : 'Close artifacts'}
            aria-label={isCollapsed ? 'Open artifact panel' : 'Close artifact panel'}
            aria-pressed={!isCollapsed}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
              !isCollapsed
                ? 'bg-mission-control-accent/10 text-mission-control-accent'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg'
            }`}
          >
            <PanelRight size={15} />
          </button>
          {!hideDelete && (
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
            title={isTeamMeeting ? 'End meeting' : 'Delete room'}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-error/70 hover:text-error hover:bg-mission-control-surface transition-colors"
          >
            <Trash2 size={16} />
          </button>
          )}
        </div>
      </div>}

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-mission-control-border bg-mission-control-surface flex items-center gap-2">
          <Search size={14} className="text-mission-control-text-dim shrink-0" />
          <TextField.Root
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
            placeholder="Search messages..."
            size="2"
            className="flex-1"
          />
          {searchMatchIds.length > 0 && (
            <>
              <span className="text-xs text-mission-control-text-dim shrink-0">
                {searchMatchIdx + 1}/{searchMatchIds.length}
              </span>
              <button
                onClick={() => setSearchMatchIdx(i => (i - 1 + searchMatchIds.length) % searchMatchIds.length)}
                title="Previous match"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <ChevronDown size={14} className="rotate-180" />
              </button>
              <button
                onClick={() => setSearchMatchIdx(i => (i + 1) % searchMatchIds.length)}
                title="Next match"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <ChevronDown size={14} />
              </button>
            </>
          )}
          {searchQuery && searchMatchIds.length === 0 && (
            <span className="text-xs text-mission-control-text-dim shrink-0">No results</span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            title="Close search"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pinned message banner */}
      {pinnedMessage && (
        <div className="px-4 py-2 border-b border-mission-control-border bg-mission-control-surface flex items-center gap-2 text-xs">
          <Pin size={12} className="text-mission-control-accent shrink-0" />
          <span className="text-mission-control-text-dim truncate flex-1">{pinnedMessage.content.slice(0, 120)}</span>
          <button
            onClick={() => {
              const el = document.getElementById(`msg-${pinnedMessage.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            Jump
          </button>
        </div>
      )}

      {/* Voice Meeting Mode */}
      {voiceMode ? (
        <TeamVoiceMeeting roomId={roomId} onEndVoice={() => setVoiceMode(false)} />
      ) : (
      <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {room.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-mission-control-text-dim">
            {isTeamMeeting ? (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
                  <UsersRound size={40} className="text-warning" />
                </div>
                <p className="text-lg font-medium mb-2 text-warning">Team Meeting Started</p>
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
                    <Button
                      key={i}
                      onClick={() => setInput(q)}
                      size="1"
                      variant="soft"
                      color="amber"
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-mission-control-accent/10 flex items-center justify-center mb-3">
                  <MessageCircle size={20} className="text-mission-control-accent" />
                </div>
                <p className="text-sm font-medium text-mission-control-text-dim">Start the conversation</p>
                <p className="text-xs text-mission-control-text-dim max-w-[240px] text-center mt-1">
                  Send a message to {room.agents.map(id => agentName(id)).join(' and ')}.
                </p>
                <p className="text-xs text-mission-control-text-dim text-center mt-3">
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
            const time = relativeTime(msg.timestamp);

            // Collect any pending permission requests for this message
            const msgPermissions = [...pendingPermissions.values()].filter(p => p.msgId === msg.id);

            const isSearchMatch = searchQuery.trim() && searchMatchIds.includes(msg.id);
            const isCurrentMatch = isSearchMatch && searchMatchIds[searchMatchIdx] === msg.id;
            const parentMsg = msg.parentId ? room.messages.find(m => m.id === msg.parentId) : null;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`group ${msg.parentId ? 'ml-8 border-l-2 border-mission-control-border pl-3' : ''} ${isCurrentMatch ? 'ring-1 ring-mission-control-accent/50 rounded-lg' : ''}`}
              >
              {/* Thread parent reference */}
              {parentMsg && (
                <div className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1 opacity-70">
                  <Reply size={11} className="rotate-180" />
                  <span className="truncate max-w-xs">{parentMsg.content.slice(0, 60)}</span>
                </div>
              )}
              <div
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${showAvatar ? 'mt-4' : 'mt-1'}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 ${!showAvatar ? 'invisible' : ''}`}>
                  {isUser ? (
                    <div className="w-8 h-8 rounded-full bg-mission-control-accent flex items-center justify-center text-white text-sm font-semibold">
                      K
                    </div>
                  ) : msg.agentId ? (
                    <AgentAvatar agentId={msg.agentId} size="sm" ring />
                  ) : null}
                </div>

                {/* Content */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%] min-w-[100px]`}>
                  {showAvatar && (
                    <div className={`mb-1 px-1 text-xs font-medium ${
                      isUser
                        ? 'text-mission-control-accent'
                        : 'text-success'
                    }`}>
                      {isUser ? 'Kevin' : (msg.agentId ? agentName(msg.agentId) : 'Agent')}
                    </div>
                  )}
                  <div
                    className={`break-words text-sm leading-relaxed ${
                      isUser
                        ? 'text-mission-control-text rounded-[18px_18px_4px_18px] px-4 py-2.5'
                        : `bg-transparent text-mission-control-text px-0 py-0`
                    }`}
                    style={isUser ? { background: 'color-mix(in srgb, var(--mission-control-accent) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent)' } : undefined}
                  >
                    {msg.streaming && !msg.content ? (
                      <Flex align="start" gap="2" className="py-1 max-w-xs">
                        <div className="flex gap-1 mt-1 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-mission-control-text-dim leading-snug">
                          {streamingStatus[msg.id]
                            ? streamingStatus[msg.id]
                            : 'thinking...'}
                        </span>
                      </Flex>
                    ) : isUser ? (
                      <MentionText
                        text={msg.content}
                        agentIds={room.agents}
                        agentNames={Object.fromEntries(room.agents.map(id => [id, agentName(id)]))}
                      />
                    ) : (
                      <RoomStructuredMessage content={msg.content} streaming={!!msg.streaming} onArtifactOpen={handleArtifactOpen} />
                    )}
                    {msg.streaming && msg.content && (
                      <div className="flex items-center gap-1.5 mt-2 opacity-60">
                        <div className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-pulse" />
                        <span className="text-xs text-mission-control-text-dim">typing...</span>
                      </div>
                    )}
                  </div>
                  {/* Artifact cards below message — matches main chat pattern */}
                  {!isUser && !msg.streaming && <RoomMessageArtifactCards messageId={msg.id} />}
                  <span className="text-[11px] tabular-nums text-mission-control-text-dim/70 mt-1 px-1">{time}</span>
                  {/* Hover action buttons */}
                  <Flex align="center" gap="1" className={`mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <button
                      type="button"
                      onClick={() => setReplyToMsg(msg)}
                      title="Reply in thread"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    >
                      <Reply size={13} />
                    </button>
                    <button
                      onClick={() => updateRoom(roomId, {
                        pinnedMessageId: room.pinnedMessageId === msg.id ? undefined : msg.id,
                      })}
                      title={room.pinnedMessageId === msg.id ? 'Unpin' : 'Pin message'}
                      className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
                        room.pinnedMessageId === msg.id
                          ? 'bg-mission-control-accent/10 border border-mission-control-accent/30 text-mission-control-accent'
                          : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                      }`}
                    >
                      <Pin size={13} />
                    </button>
                  </Flex>
                  {/* Reactions */}
                  <MessageReactions messageId={msg.id} isUser={isUser} />
                </div>
              </div>
              {/* Tool permission cards for this message */}
              {msgPermissions.length > 0 && (
                <div className="mt-2 ml-12 space-y-2">
                  {msgPermissions.map(perm => (
                    <ToolPermissionCard
                      key={perm.approvalId}
                      request={perm}
                      onResolved={(approvalId, _granted) => {
                        // Keep the card visible in resolved state (handled internally)
                        // Remove from pending after a delay so user sees the resolved state
                        setTimeout(() => {
                          setPendingPermissions(prev => {
                            const next = new Map(prev);
                            next.delete(approvalId);
                            return next;
                          });
                        }, 4000);
                      }}
                    />
                  ))}
                </div>
              )}
              </div>
            );
          });
          })()
        )}

        {/* Typing indicators for agents */}
        {typingAgents.size > 0 && !room.messages.some(m => m.streaming) && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mission-control-text-dim animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-mission-control-text-dim animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-mission-control-text-dim animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-mission-control-text-dim">
              {[...typingAgents].map(id => agentName(id)).join(', ')} {typingAgents.size === 1 ? 'is' : 'are'} responding...
            </span>
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
        className="flex items-end gap-2 px-4 py-3 border-t border-mission-control-border flex-shrink-0 bg-mission-control-bg relative transition-colors"
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
                    <Flex align="center" gap="2" className="px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg">
                      <Icon size={16} className="text-mission-control-accent" />
                      <span className="text-sm truncate max-w-32">{att.name}</span>
                      <span className="text-xs text-mission-control-text-dim">{(att.size / 1024).toFixed(1)}KB</span>
                    </Flex>
                  )}
                  <IconButton
                    onClick={() => removeAttachment(att.id)}
                    size="1"
                    variant="solid"
                    color="red"
                    radius="full"
                    style={{ position: 'absolute', top: '-6px', right: '-6px', opacity: 0 }}
                    className="group-hover:opacity-100 transition-colors duration-150"
                  >
                    <X size={12} />
                  </IconButton>
                </div>
              );
            })}
          </div>
        )}

        {/* Reply-to banner */}
        {replyToMsg && (
          <div className="mb-2 px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg flex items-center gap-2 text-xs">
            <Reply size={12} className="text-mission-control-accent shrink-0" />
            <span className="text-mission-control-text-dim truncate flex-1">
              Replying to: {replyToMsg.content.slice(0, 80)}
            </span>
            <button
              onClick={() => setReplyToMsg(null)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* @ Mention autocomplete */}
        {showMentions && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-xl overflow-hidden">
            {filteredAgents.map(id => {
              // Special case for @all
              if (id === 'all') {
                return (
                  <button
                    type="button"
                    key="all"
                    onClick={() => insertMention('all')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors border-b border-mission-control-border text-left"
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
                  type="button"
                  key={id}
                  onClick={() => insertMention(id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-mission-control-bg transition-colors text-left"
                >
                  <AgentAvatar agentId={id} size="sm" />
                  <span className={`font-medium text-sm ${theme.text}`}>{agent?.name || id}</span>
                  <span className="text-xs text-mission-control-text-dim">{agent?.description}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className={`aui-composer-root ${listening ? 'aui-listening' : ''}`}>
          {listening && (
            <div className="aui-listening-bar">
              <span className="aui-listening-dot" />
              Recording — speak now, click mic to stop
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={listening ? "Listening… speak or click mic to stop" : loading ? "Type to queue next message…" : "Message the room… (@name to mention)"}
            rows={1}
            className="aui-composer-input min-h-[22px] max-h-[160px] overflow-auto"
            style={{ resize: 'none' }}
          />
          <div className="aui-composer-footer">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="aui-composer-icon-btn"
              >
                <Paperclip size={15} />
              </button>
              <button
                type="button"
                onClick={() => setShowMentions(!showMentions)}
                title="Mention an agent"
                className={`aui-composer-icon-btn ${showMentions ? 'aui-composer-icon-btn-active' : ''}`}
              >
                <AtSign size={15} />
              </button>
              <button
                type="button"
                onClick={toggleVoice}
                title={listening ? "Stop voice input" : "Start voice input"}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                aria-pressed={listening}
                className={`aui-composer-icon-btn ${listening ? 'aui-composer-icon-btn-active' : ''}`}
              >
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              {loading ? (
                <button
                  type="button"
                  onClick={stopAll}
                  aria-label="Stop generation"
                  title="Stop (Escape)"
                  className="aui-stop-btn"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  aria-label="Send message"
                  title="Send (Enter)"
                  className="aui-send-btn"
                >
                  <Send size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
      {/* Manage Members Modal */}
      {showManageMembers && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
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
              <button type="button" onClick={() => setShowManageMembers(false)} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-1">
              {agents.map((agent) => {
                const inRoom = room.agents.includes(agent.id);
                const theme = getAgentTheme(agent.id);
                return (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => {
                      const updated = inRoom
                        ? room.agents.filter(a => a !== agent.id)
                        : [...room.agents, agent.id];
                      if (updated.length > 0) updateRoomAgents(roomId, updated);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      inRoom ? 'bg-mission-control-accent/10 ring-1 ring-mission-control-accent/30' : 'hover:bg-mission-control-bg'
                    }`}
                  >
                    <AgentAvatar agentId={agent.id} size="sm" />
                    <div className="flex-1 text-left">
                      <span className={`text-sm font-medium ${inRoom ? theme.text : 'text-mission-control-text-dim'}`}>{agent.name}</span>
                      <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inRoom ? 'bg-success/10 text-success' : 'bg-mission-control-bg text-mission-control-text-dim'}`}>
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

      {/* Room Settings Panel */}
      {showSettings && (
        <RoomSettingsPanel
          room={room}
          onClose={() => setShowSettings(false)}
          onLeave={() => {
            setShowSettings(false);
            deleteRoom(room.id);
            onBack();
          }}
          onSave={async (updates) => {
            await updateRoom(roomId, updates);
          }}
          onUnpin={() => updateRoom(roomId, { pinnedMessageId: undefined })}
        />
      )}
      </div>

      {/* Artifact Panel */}
      <ArtifactPanel sessionId={roomId} />
    </Flex>
  );
}
