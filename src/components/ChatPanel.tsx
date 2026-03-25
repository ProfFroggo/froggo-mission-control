import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Button, TextField, Flex } from '@radix-ui/themes';
import { Send, Volume2, VolumeX, Loader2, Trash2, RefreshCw, WifiOff, Paperclip, X, FileText, Image, File, Search, Sparkles, Star, Copy, Users, MessageSquare, MessageSquarePlus, Phone, PhoneOff, UsersRound, MessageCircle, AlertTriangle, ThumbsUp, ThumbsDown, UserCheck, PanelRight } from 'lucide-react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useMissionControlRuntime } from './chat/ChatRuntime';
import { MissionControlThread, MissionControlComposer } from './chat/ThreadStyles';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { ChatAgent, useAgentList } from './AgentSelector';
import MarkdownMessage from './MarkdownMessage';
import StreamingText from './StreamingText';
import ContentBlock from './ContentBlock';
import LiveActivity from './LiveActivity';
import VoiceChatPanel from './VoiceChatPanel';
import FilePreviewModal from './FilePreviewModal';
import CreateRoomModal from './CreateRoomModal';
import ChatRoomView from './ChatRoomView';
import { gateway, forceReconnect, ConnectionState } from '../lib/gateway';
import { chatApi } from '@/lib/api';
import { useStore } from '../store/store';
import { useChatRoomStore } from '../store/chatRoomStore';
import { showToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorMessages';
import { createLogger } from '../utils/logger';
import { copyToClipboard } from '../utils/clipboard';
import EmptyState from './EmptyState';
import SessionStatsBar from './SessionStatsBar';
import ArtifactPanel from './ArtifactPanel';
import { useArtifactExtraction } from '../hooks/useArtifactExtraction';
import { useArtifactOpen } from '../hooks/useArtifactOpen';
import { useArtifactStore } from '../store/artifactStore';
import { Spinner } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';
import { formatTimeAgo } from '../utils/formatting';

const logger = createLogger('ChatPanel');

/** Format a Unix timestamp as a human-friendly relative time string */
function formatMessageTime(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);

  if (diffMs < 60_000) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 3) return `${diffHr}h ago`;

  const d = new Date(timestamp);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d >= todayStart) return `Today at ${timeStr}`;
  if (d >= yesterdayStart) return `Yesterday at ${timeStr}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: any;
  id?: string;
  tool_use_id?: string;
  content?: any;
  is_error?: boolean;
}

interface StructuredChatMessage extends Omit<ChatMessage, 'content'> {
  content: string | ContentBlock[];
  status?: string; // live streaming status: 'Thinking...', 'Using: Bash', etc.
  subtle?: boolean; // true for heartbeat/working pulses — rendered with lighter styling
  isError?: boolean; // true when message content is an error string
  isEscalation?: boolean; // true when message requires human attention
}

/** Returns true when message text signals an escalation / approval request */
function isEscalationMessage(content: string | ContentBlock[]): boolean {
  const text =
    typeof content === 'string'
      ? content
      : content
          .filter((b: ContentBlock) => b.type === 'text')
          .map((b: ContentBlock) => b.text ?? '')
          .join('');
  const lower = text.toLowerCase();
  return (
    lower.includes('human-review') ||
    lower.includes('human review') ||
    lower.includes('approval needed') ||
    lower.includes('approval required') ||
    lower.includes('needs approval') ||
    lower.includes('waiting for approval') ||
    lower.includes('waiting for human') ||
    lower.includes('needs your decision') ||
    lower.includes('needs your input') ||
    lower.includes('escalat')
  );
}

export default function ChatPanel() {
  const { addActivity } = useStore();
  const { rooms: allRooms, activeRoomId, setActiveRoom, createRoom, loadRooms } = useChatRoomStore();
  // Project rooms (id: project-*) are managed by the Projects module — exclude from chat panel
  const rooms = useMemo(() => allRooms.filter(r => !r.id.startsWith('project-')), [allRooms]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
  const [messages, setMessages] = useState<StructuredChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakResponses, setSpeakResponses] = useState(false);
  const [listening, setListening] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'agents' | 'rooms'>('agents');
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [dismissedEscalationIds, setDismissedEscalationIds] = useState<Set<string>>(new Set());
  const lastUserMessageRef = useRef<string>('');
  const { agents: chatAgents } = useAgentList();
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);

  const currentSessionId = selectedAgent?.sessionKey ?? selectedAgent?.id ?? '';

  // Build the assistant-ui ExternalStoreRuntime bridging our messages + sendMessage.
  // sendMessage is defined later — use a stable ref to avoid stale closures.
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assistantRuntime = useMissionControlRuntime(
    messages as any[],
    loading,
    useCallback((text: string) => sendMessageRef.current(text), [])
  );

  // Auto-extract artifacts from 1-1 chat messages
  const artifactMessages = useMemo(() => messages.map(m => ({
    id: m.id ?? '',
    role: m.role === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    timestamp: m.timestamp,
  })), [messages]);
  useArtifactExtraction(artifactMessages, currentSessionId);

  // Scope the artifact panel to the current agent's session; clear stale selection
  const { setFilterBySession, getSessionArtifacts, selectArtifact, toggleCollapse, isCollapsed } = useArtifactStore();
  useEffect(() => {
    if (!currentSessionId) return;
    setFilterBySession(currentSessionId);
    // Auto-select most recent artifact for this session, or clear if none
    const sessionArtifacts = getSessionArtifacts(currentSessionId);
    const latest = sessionArtifacts.sort((a, b) => b.timestamp - a.timestamp)[0];
    selectArtifact(latest?.id ?? null);
  }, [currentSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Artifact store — for wiring "Open Preview" cards in messages
  const handleArtifactOpen = useArtifactOpen();

  // Load chat rooms from DB on mount; always open on 1-1 chat (not a room)
  useEffect(() => { loadRooms(); setActiveRoom(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update selectedAgent when agents load if not set
  useEffect(() => {
    if (!selectedAgent && chatAgents.length > 0) {
      setSelectedAgent(chatAgents[0]);
    }
  }, [chatAgents, selectedAgent]);
  
  // Cache messages per agent so switching is instant
  const messageCacheRef = useRef<Map<string, StructuredChatMessage[]>>(new Map());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentResponseRef = useRef<string>('');
  const currentContentRef = useRef<string | ContentBlock[]>(''); // Full structured content
  const currentMsgIdRef = useRef<string>('');
  const currentRunIdRef = useRef<string>('');
  // Phase 80: AbortController for SDK streaming cancellation
  const sdkAbortControllerRef = useRef<AbortController | null>(null);
  // Track active tool name for the status strip shown during streaming
  const [currentTool, setCurrentTool] = useState<string | null>(null);

  const connected = connectionState === 'connected';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent switching handler
  const handleAgentSwitch = useCallback(async (agent: ChatAgent) => {
    if (!selectedAgent || agent.id === selectedAgent.id) return;

    // Save current messages to cache
    messageCacheRef.current.set(selectedAgent.id, messages);
    
    // Switch to the persistent agent session
    gateway.setSessionKey(agent.sessionKey);
    setSelectedAgent(agent);
    setLoading(false);
    setSuggestedReplies([]);
    setSearchQuery('');
    setShowSearch(false);
    
    // Check cache first
    const cached = messageCacheRef.current.get(agent.id);
    if (cached) {
      setMessages(cached);
      setHistoryLoaded(true);
      return;
    }
    
    // Load from DB for this agent
    setMessages([]);
    setHistoryLoaded(true); // prevent gateway fallback race
    setLoadingMessages(true);
    try {
      const result = await chatApi.getMessages(agent.dbSessionKey);
      if (result?.success && result.messages?.length > 0) {
        // Parse JSON content back to structured blocks if needed
        const parsedMessages = result.messages.map((msg: ChatMessage) => {
          if (typeof msg.content === 'string' && msg.content.startsWith('[')) {
            try {
              const parsed = JSON.parse(msg.content);
              // Strip empty thinking blocks that show "0 chars"
              const filtered = Array.isArray(parsed)
                ? parsed.filter((b: any) => !(b.type === 'thinking' && !b.thinking?.trim() && !b.text?.trim()))
                : parsed;
              return { ...msg, content: filtered };
            } catch {
              return msg; // Keep as string if parse fails
            }
          }
          return msg;
        });
        setMessages(parsedMessages);
        messageCacheRef.current.set(agent.id, parsedMessages);
      }
    } catch (_err) {
      // DB load failed — start with empty messages
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedAgent, messages]);

  // Load starred message IDs
  // TODO Phase 4: migrate — [web-not-available] not available in web; no REST equivalent yet
  useEffect(() => {
    // Starred messages not yet supported in web version
  }, [selectedAgent]);

  // Toggle star on a message
  // TODO Phase 4: migrate — [web-not-available] not available in web; no REST equivalent yet
  const handleToggleStar = async (msg: StructuredChatMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    showToast('Starred messages not available', 'error');
  };

  // Load messages from database whenever the selected agent changes (including initial selection)
  useEffect(() => {
    const loadFromDb = async () => {
      if (!selectedAgent) return;
      // Return cached messages immediately (agent switch already loaded them)
      const cached = messageCacheRef.current.get(selectedAgent.id);
      if (cached) {
        setMessages(cached);
        setHistoryLoaded(true);
        return;
      }
      // Mark as loaded IMMEDIATELY to prevent race conditions
      setHistoryLoaded(true);
      setLoadingMessages(true);

      try {
        const result = await chatApi.getMessages(selectedAgent.dbSessionKey);
        if (result?.success && result.messages?.length > 0) {
          // Parse any messages saved as ContentBlock[] JSON — extract plain text
          const normalized = result.messages.map((m: StructuredChatMessage) => {
            if (m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('[')) {
              try {
                const blocks = JSON.parse(m.content as string);
                if (Array.isArray(blocks) && blocks.length > 0 && blocks[0]?.type) {
                  const text = blocks.filter((b: ContentBlock) => b.type === 'text').map((b: ContentBlock) => b.text ?? '').join('');
                  return { ...m, content: text || m.content };
                }
              } catch { /* not JSON, keep as-is */ }
            }
            // Normalize DB integer 0/1 → boolean, and clear any stale streaming state
            return { ...m, streaming: false, status: undefined };
          });
          // Deduplicate by message ID to prevent double-entries from DB + stream
          const seen = new Set<string>();
          const deduped = normalized.filter((m: StructuredChatMessage) => {
            const id = m.id ?? '';
            if (!id || seen.has(id)) return !id; // keep messages without IDs (no dedup possible)
            seen.add(id);
            return true;
          });
          setMessages(deduped);
          messageCacheRef.current.set(selectedAgent.id, deduped);
        }
      } catch (_err) {
        // DB load failed — start with empty messages
      } finally {
        setLoadingMessages(false);
      }
    };
    loadFromDb();
  }, [selectedAgent?.id]); // Re-run when agent first becomes available or changes

  // Save message to database helper
  const saveMessageToDb = async (role: string, content: string) => {
    if (!selectedAgent) return;
    try {
      await chatApi.saveMessage(selectedAgent.dbSessionKey, { role, content, timestamp: Date.now() });
    } catch (err) {
      // [Chat] Error saving message — non-fatal
    }
  };

  // Compact — bypasses sendMessage entirely so /compact never reaches the agent or DB
  const handleCompact = useCallback(async () => {
    if (!selectedAgent) return;
    const assistantId = `msg-${Date.now()}-compact`;
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), streaming: true,
    }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '/compact', model: 'claude-sonnet-4-6', sessionKey: selectedAgent.dbSessionKey }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.startsWith('data: ') ? part.slice(6) : part;
          if (line === '[DONE]') break;
          try {
            const ev = JSON.parse(line);
            if (ev.type === 'text_delta') {
              text += ev.text;
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: text } : m));
            }
          } catch { /* skip */ }
        }
      }
      // Mark done, clear old messages from UI (compact summary is now the only message)
      setMessages([{ id: assistantId, role: 'assistant', content: text || '✓ Context compacted.', timestamp: Date.now(), streaming: false }]);
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Compact failed — try again.', streaming: false } : m));
    } finally {
      setLoading(false);
    }
  }, [selectedAgent]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  // Handle clipboard paste — images and files paste directly into the chat
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const fileItems = items.filter(item => item.kind === 'file');
    if (fileItems.length === 0) return; // Let text paste fall through to textarea
    e.preventDefault();
    const files = fileItems.map(item => item.getAsFile()).filter(Boolean) as File[];
    if (files.length > 0) handleFiles(files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = (files: File[]) => {
    const newAttachments: AttachedFile[] = [];
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'File too large', `${file.name} exceeds 10MB limit`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        newAttachments.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: reader.result as string,
        });
        
        if (newAttachments.length === files.length) {
          setAttachments(prev => [...prev, ...newAttachments]);
          showToast('success', 'File attached', `${files.length} file(s) ready to send`);
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

  // Filter messages based on search query
  // Filter out silent agent replies (NO_REPLY, HEARTBEAT_OK, NO) from display
  const isSystemReply = (content: string) => {
    const trimmed = content?.trim();
    return trimmed === 'NO_REPLY' || trimmed === 'HEARTBEAT_OK' || trimmed === 'NO' || trimmed === 'NO_RE' || trimmed === 'NO_';
  };

  const filteredMessages = useMemo(() => {
    const visible = messages.filter(msg => {
      const textContent = Array.isArray(msg.content)
        ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
        : msg.content;
      // Keep streaming messages always; for done messages, only hide truly empty plain strings
      const isEmpty = !msg.streaming && typeof msg.content === 'string' && textContent.trim().length === 0;
      return !isSystemReply(textContent) && !isEmpty;
    });
    if (!searchQuery.trim()) return visible;
    const query = searchQuery.toLowerCase();
    return visible.filter(msg => {
      const textContent = Array.isArray(msg.content)
        ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
        : msg.content;
      return textContent.toLowerCase().includes(query) ||
        msg.role.toLowerCase().includes(query);
    });
  }, [messages, searchQuery]);

  // Derive active escalation messages — assistant messages that need human attention
  // and have not been dismissed by the user.
  const activeEscalations = useMemo(() => {
    return messages.filter(
      msg =>
        !msg.streaming &&
        msg.role === 'assistant' &&
        isEscalationMessage(msg.content) &&
        !dismissedEscalationIds.has(msg.id ?? '')
    );
  }, [messages, dismissedEscalationIds]);

  // Derive last assistant message for quick-reply detection
  const lastAssistantMessage = useMemo(() => {
    const visible = messages.filter(m => !m.streaming && m.role === 'assistant');
    return visible[visible.length - 1] ?? null;
  }, [messages]);

  const lastAssistantText = useMemo(() => {
    if (!lastAssistantMessage) return '';
    return typeof lastAssistantMessage.content === 'string'
      ? lastAssistantMessage.content
      : (lastAssistantMessage.content as ContentBlock[])
          .filter((b: ContentBlock) => b.type === 'text')
          .map((b: ContentBlock) => b.text ?? '')
          .join('');
  }, [lastAssistantMessage]);

  // Quick replies are now AI-generated via generateSuggestions (auto-called after each message)

  // Scroll to bottom — use a brief timeout so the DOM has settled before scrolling.
  // Without this, scrollIntoView fires before the new message element is fully rendered,
  // which causes it to stop just above the last message.
  useEffect(() => {
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, [messages]);

  // Auto-generate contextual reply suggestions when assistant message completes.
  // Debounced 800ms to avoid triggering during mid-stream updates.
  const suggestionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) {
      // Clear pending suggestions while agent is still responding
      if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
      return;
    }
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== 'assistant') return;

    // Debounce: wait 800ms after stream completes to avoid rapid API calls
    if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    suggestionsTimerRef.current = setTimeout(() => {
      generateSuggestions(true);
    }, 800);
    return () => {
      if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Track gateway connection state
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    // Sync initial state
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);

  // Load chat history helper (wrapped in useCallback to fix stale closure)
  const loadHistory = useCallback(async () => {
    // If we already have messages (from DB), don't overwrite with gateway history
    if (messages.length > 0) {
      setHistoryLoaded(true);
      return;
    }
    
    try {
      const res = await gateway.getChatHistory(30) as { messages?: any[] } | null;
      if (res?.messages && Array.isArray(res.messages)) {
        const history: StructuredChatMessage[] = res.messages
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any, i: number) => {
            // Preserve structured content if available, else extract text
            let content: string | ContentBlock[] = '';
            if (typeof m.content === 'string') {
              content = m.content;
            } else if (Array.isArray(m.content)) {
              // Keep the full array for assistant messages to show tool calls
              // Strip empty thinking blocks that show "0 chars" on load
              if (m.role === 'assistant') {
                content = m.content.filter((c: any) => !(c.type === 'thinking' && !c.thinking?.trim() && !c.text?.trim()));
              } else {
                // For user messages, extract text only
                content = m.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('');
              }
            }

            return {
              id: `hist-${i}-${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: content || '',
              timestamp: m.timestamp || Date.now() - ((res.messages?.length ?? 0) - i) * 1000,
            };
          })
          .reverse(); // Most recent last
        
        if (history.length > 0) {
          setMessages(history);
        }
      }
      setHistoryLoaded(true);
    } catch (e) {
      logger.error('Failed to load history:', e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load chat history');
      setHistoryLoaded(true); // Don't retry
    }
  }, [messages]);

  // Load chat history when connected (only if DB didn't have messages)
  // DB is the source of truth - gateway history is fallback only
  useEffect(() => {
    if (connected && !historyLoaded) {
      loadHistory();
    }
  }, [connected, historyLoaded, loadHistory]);

  // Speak function for text-to-speech (moved outside useEffect for proper scope)
  const speak = useCallback((text: string) => {
    if (!text) return;
    
    // Skip short filler acks - annoying when spoken
    const skipPhrases = /^(on it|got it|sure|ok|okay|yes|yep|done|noted|ack|👍|✅|🐸)\s*[.!]?\s*$/i;
    if (skipPhrases.test(text.trim())) {
      return;
    }
    
    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 500);
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name.includes('Samantha') || v.lang === 'en-US');
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Setup streaming listeners
  useEffect(() => {
    const handleDelta = (data: any) => {
      if (data.delta && currentMsgIdRef.current) {
        currentResponseRef.current += data.delta;
        // Immediate update - no RAF throttling for real-time feel
        // React 18 automatic batching handles performance
        setMessages(prev => prev.map(m =>
          m.id === currentMsgIdRef.current
            ? { ...m, content: currentResponseRef.current }
            : m
        ));
        // Re-enable input on first delta (streaming has started)
        if (loading) {
          setLoading(false);
        }
      }
    };

    const handleMessage = (data: any) => {
      if (currentMsgIdRef.current) {
        // Store the FULL content structure (blocks array or string)
        let content: string | ContentBlock[] = '';

        if (data.message?.content && Array.isArray(data.message.content)) {
          // Keep structured content blocks
          content = data.message.content;
          currentContentRef.current = content; // Store full structure
          // Also extract text for legacy operations
          currentResponseRef.current = data.message.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');
          // Track the most recent tool_use block name for the status strip
          const toolBlock = [...data.message.content].reverse().find((c: any) => c.type === 'tool_use');
          if (toolBlock) setCurrentTool(toolBlock.name ?? null);
        } else if (data.content) {
          content = data.content;
          currentContentRef.current = content;
          currentResponseRef.current = data.content;
        }

        if (content) {
          setMessages(prev => prev.map(m =>
            m.id === currentMsgIdRef.current
              ? { ...m, content, streaming: false }
              : m
          ));
        }
      }
    };

    const handleEnd = () => {
      if (currentMsgIdRef.current) {
        const finalTextContent = currentResponseRef.current;
        const finalFullContent = currentContentRef.current;

        // Update UI immediately — no blocking
        setMessages(prev => prev.map(m =>
          m.id === currentMsgIdRef.current
            ? { ...m, streaming: false }
            : m
        ));
        setLoading(false);
        setCurrentTool(null);
        const runId = currentRunIdRef.current;
        currentMsgIdRef.current = '';
        currentResponseRef.current = '';
        currentContentRef.current = '';
        if (runId) { gateway.clearRunId(runId); currentRunIdRef.current = ''; }

        // Fire-and-forget: DB save, speech, routing — all parallel, non-blocking
        // Save FULL structured content to DB (not just text!)
        // Strip empty thinking blocks before saving — they show "0 chars" on reload
        if (finalFullContent && selectedAgent) {
          const cleaned = Array.isArray(finalFullContent)
            ? finalFullContent.filter((b: any) => !(b.type === 'thinking' && !b.text?.trim()))
            : finalFullContent;
          const contentToSave = typeof cleaned === 'string'
            ? cleaned
            : JSON.stringify(cleaned);

          chatApi.saveMessage(selectedAgent.dbSessionKey, {
            role: 'assistant',
            content: contentToSave,
            timestamp: Date.now(),
          }).catch((err: any) => logger.error('Error saving assistant message:', err));
        }

        if (speakResponses && finalTextContent) {
          requestIdleCallback(() => speak(finalTextContent), { timeout: 5000 });
        }

        const brainMatch = finalTextContent.match(/@Brain:\s*([\s\S]*?)(?:$|(?=\n\n))/i);
        if (brainMatch) {
          gateway.sendToMain(`[From Chat Agent]\n${brainMatch[1].trim()}`)
            .catch((err: any) => logger.error('Brain routing error:', err));
        }
      }
    };

    const handleChatEvent = (data: any) => {
      // Handle generic 'chat' event with state field
      if (!currentMsgIdRef.current) {
        return;
      }

      // Store the FULL content structure (blocks array or string)
      let content: string | ContentBlock[] = '';
      let textContent = '';
      
      if (data.message?.content && Array.isArray(data.message.content)) {
        // Keep structured content blocks
        content = data.message.content;
        currentContentRef.current = content; // Store full structure
        // Extract text for legacy operations (speech)
        textContent = data.message.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
        // Track the most recent tool_use block for the status strip
        const toolBlock = [...data.message.content].reverse().find((c: any) => c.type === 'tool_use');
        if (toolBlock) setCurrentTool(toolBlock.name ?? null);
      } else if (data.content) {
        content = data.content;
        currentContentRef.current = content;
        textContent = data.content;
      }
      
      if (content) {
        // Only update if this is the final/complete content, not partial
        // Partial deltas are handled by handleDelta
        if (data.state === 'final' || (typeof textContent === 'string' && textContent.length > currentResponseRef.current.length)) {
          currentResponseRef.current = textContent;
          setMessages(prev => prev.map(m => 
            m.id === currentMsgIdRef.current 
              ? { ...m, content } 
              : m
          ));
        }
      }

      // Check if final
      if (data.state === 'final') {
        const finalTextContent = currentResponseRef.current;
        const finalFullContent = currentContentRef.current;
        
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, streaming: false } 
            : m
        ));
        
        // Save assistant message to database with full structured content
        // Strip empty thinking blocks before saving
        if (finalFullContent && selectedAgent) {
          const cleaned = Array.isArray(finalFullContent)
            ? finalFullContent.filter((b: any) => !(b.type === 'thinking' && !b.text?.trim()))
            : finalFullContent;
          const contentToSave = typeof cleaned === 'string'
            ? cleaned
            : JSON.stringify(cleaned);

          chatApi.saveMessage(selectedAgent.dbSessionKey, {
            role: 'assistant',
            content: contentToSave,
            timestamp: Date.now(),
          }).catch((err: any) => {
            logger.error('Error saving assistant message:', err);
          });
        }
        
        if (speakResponses && finalTextContent) {
          speak(finalTextContent);
        }
        
        // Check for @Brain: routing - forward to main session (Brain/Mission Control)
        const brainMatch = finalTextContent.match(/@Brain:\s*([\s\S]*?)(?:$|(?=\n\n))/i);
        if (brainMatch) {
          const brainMessage = brainMatch[1].trim();
          // Send to main session via gateway WebSocket (sends to Discord #get_shit_done)
          gateway.sendToMain(`[From Chat Agent]\n${brainMessage}`)
            .then(() => {
              showToast('success', 'Routed to Brain', 'ChatMessage sent to main session');
            })
            .catch((err: any) => {
              logger.error('Brain routing error:', err);
              showToast('error', 'Brain routing failed', err.message);
            });
        }
        
        setLoading(false);
        setCurrentTool(null);
        currentMsgIdRef.current = ''; if (currentRunIdRef.current) { gateway.clearRunId(currentRunIdRef.current); currentRunIdRef.current = ''; }
        currentResponseRef.current = '';
      }
    };

    const handleError = (data: any) => {
      logger.error('Chat error:', data);
      if (currentMsgIdRef.current) {
        const friendlyError = getUserFriendlyError(data, {
          action: 'send your message',
          technical: data.message || data.error
        });
        setMessages(prev => prev.map(m =>
          m.id === currentMsgIdRef.current
            ? { ...m, content: friendlyError, streaming: false, isError: true }
            : m
        ));
        setStreamError(friendlyError);
        setLoading(false);
        setCurrentTool(null);
        currentResponseRef.current = '';
        currentContentRef.current = '';
        currentMsgIdRef.current = ''; if (currentRunIdRef.current) { gateway.clearRunId(currentRunIdRef.current); currentRunIdRef.current = ''; }
        showToast('error', 'Message failed', friendlyError);
      }
    };

    const unsub1 = gateway.on('chat.delta', handleDelta);
    const unsub2 = gateway.on('chat.message', handleMessage);
    const unsub3 = gateway.on('chat.end', handleEnd);
    const unsub4 = gateway.on('chat.error', handleError);
    const unsub5 = gateway.on('chat', handleChatEvent);

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [loading, selectedAgent?.dbSessionKey, speakResponses, selectedAgent, speak]);

  // Setup voice recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const generateSuggestions = useCallback(async (autoTriggered = false) => {
    if (messages.length === 0 || loadingSuggestions) return;

    // Find last assistant message text
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;
    const lastText = typeof lastAssistant.content === 'string'
      ? lastAssistant.content
      : (lastAssistant.content as ContentBlock[]).filter(b => b.type === 'text').map(b => b.text ?? '').join('');
    if (!lastText.trim()) return;

    setLoadingSuggestions(true);
    setSuggestedReplies([]);

    try {
      const res = await fetch('/api/agents/suggest-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastMessage: lastText,
          agentName: selectedAgent?.name ?? 'Agent',
        }),
      });
      if (res.ok) {
        const data = await res.json() as { suggestions?: string[] };
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setSuggestedReplies(data.suggestions);
        }
      }
    } catch (error: unknown) {
      if (!autoTriggered) {
        showToast('error', 'Failed to generate', error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, [messages, loadingSuggestions, selectedAgent]);

  const applySuggestion = (suggestion: string) => {
    setInput(suggestion);
    setSuggestedReplies([]);
    inputRef.current?.focus();
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text && attachments.length === 0) return;
    if (!selectedAgent) return;
    
    // Clear suggestions and prior stream error when sending
    setSuggestedReplies([]);
    setStreamError(null);
    lastUserMessageRef.current = text;

    // Build message content with actual file contents
    let content = text;
    const fileContents: string[] = [];
    const textExtensions = ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.py', '.jsx', '.tsx', '.html', '.css', '.yml', '.yaml', '.xml', '.sh', '.bash', '.sql', '.r', '.rb', '.go', '.rs', '.swift', '.kt'];

    for (const att of attachments) {
      if (!att.dataUrl) continue;

      const isTextFile = att.type.startsWith('text/') || textExtensions.some(ext => att.name.toLowerCase().endsWith(ext));
      const isImage = att.type.startsWith('image/');
      const isPdf = att.type === 'application/pdf';
      const isAudio = att.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac'].some(ext => att.name.toLowerCase().endsWith(ext));

      if (isTextFile) {
        // Text files: decode and include content inline
        try {
          const base64 = att.dataUrl.split(',')[1];
          const decoded = atob(base64);
          fileContents.push(`\n\n--- FILE: ${att.name} ---\n\`\`\`\n${decoded}\n\`\`\`\n--- END FILE ---`);
        } catch {
          fileContents.push(`\n\n[Attached text file: ${att.name} - could not decode]`);
        }
      } else if (isImage || isPdf) {
        // Images and PDFs: upload to server, give agent the file path to read
        try {
          const blob = await fetch(att.dataUrl).then(r => r.blob());
          const form = new FormData();
          form.append('file', blob, att.name);
          const res = await fetch('/api/agents/upload', { method: 'POST', body: form });
          if (res.ok) {
            const { path } = await res.json();
            if (isImage) {
              fileContents.push(`\n\n[Image attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB) — file path: ${path}\nUse the Read tool to view this image.]`);
            } else {
              fileContents.push(`\n\n[PDF attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB) — file path: ${path}\nUse the Read tool to read this PDF.]`);
            }
          } else {
            fileContents.push(`\n\n[${isImage ? 'Image' : 'PDF'} attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB) — upload failed, cannot be read]`);
          }
        } catch {
          fileContents.push(`\n\n[${isImage ? 'Image' : 'PDF'} attached: ${att.name} — could not upload]`);
        }
      } else if (isAudio) {
        fileContents.push(`\n\n[Audio file attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB) — audio transcription not supported]`);
      } else {
        fileContents.push(`\n\n[File attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB, type: ${att.type})]`);
      }
    }

    if (fileContents.length > 0) {
      content = text + fileContents.join('');
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text + (attachments.length > 0 ? `\n\n📎 ${attachments.length} file(s) attached` : ''),
      timestamp: Date.now(),
    };
    
    // Clear attachments after sending
    setAttachments([]);

    // Save user message to database
    saveMessageToDb('user', userMsg.content);

    const assistantId = `msg-${Date.now()}-a`;
    currentMsgIdRef.current = assistantId;
    currentResponseRef.current = '';

    setMessages(prev => [...prev, userMsg, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    }]);
    
    if (!overrideText) setInput('');
    setLoading(true);
    addActivity({ type: 'chat', message: `You: ${text.slice(0, 50)}...`, timestamp: Date.now() });

    try {
      // Stream from SDK chat route — true character-by-character output
      // /stream is reserved for background task dispatch only; /chat is for interactive use
      const response = await fetch(`/api/agents/${selectedAgent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, model: 'claude-sonnet-4-6', sessionKey: selectedAgent.dbSessionKey }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          const rateLimitMsg = 'Rate limited — please wait a moment';
          showToast('error', 'Agent unavailable', rateLimitMsg);
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: rateLimitMsg, streaming: false, isError: true } : m
          ));
          setStreamError(rateLimitMsg);
          setLoading(false);
          return;
        }
        const statusMsg =
          response.status === 503 || response.status === 502 ? 'Agent service temporarily unavailable' :
          response.status === 408 ? 'Connection timed out — the agent may be busy' :
          `Stream error: ${response.status} ${response.statusText}`;
        throw new Error(statusMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let structuredContent: ContentBlock[] | null = null;
      let thinkingContent = ''; // Extended thinking blocks from Claude

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;

          try {
            const evt = JSON.parse(raw);

            if (evt.type === 'heartbeat') {
              // Heartbeat — agent is alive; don't alter message content, let loading state speak
            } else if (evt.type === 'tool_use' || evt.type === 'tool_result') {
              // Tool lifecycle — no visual indicator needed
            } else if (evt.type === 'thinking_block') {
              // Thinking content — not shown in UI
            } else if (evt.type === 'text_delta' && typeof evt.text === 'string') {
              // Text streaming in
              accumulated += evt.text;
              structuredContent = null;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated, status: undefined } : m
              ));
              // Re-enable input once text starts arriving
              setLoading(false);
            } else if (evt.type === 'error') {
              // Server-side error — surface it in the message bubble
              const rawErrText = evt.error || evt.text || 'An error occurred';
              const friendlyErrText = getUserFriendlyError(new Error(rawErrText), { action: 'send your message', resource: 'chat' });
              accumulated = friendlyErrText;
              setCurrentTool(null);
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: friendlyErrText, status: undefined, streaming: false, isError: true } : m
              ));
              setStreamError(friendlyErrText);
              setLoading(false);
              break;
            } else if (evt.type === 'done') {
              setCurrentTool(null);
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, streaming: false, status: undefined } : m
              ));
              setLoading(false);
            }
          } catch { /* skip malformed */ }
        }
      }

      // Finalize — if stream completed with no content, show error instead of disappearing
      if (!accumulated) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'No response received. Please try again.', streaming: false }
            : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, streaming: false } : m
        ));
      }
      setLoading(false);
      setCurrentTool(null);
      currentMsgIdRef.current = '';
      currentResponseRef.current = accumulated;
      currentContentRef.current = structuredContent ?? accumulated;

      // Persist the assistant response to the DB so history survives page reload
      if (accumulated) {
        saveMessageToDb('assistant', accumulated);
      }

      if (speakResponses) speak(accumulated);

    } catch (e: unknown) {
      const friendlyError = getUserFriendlyError(e, {
        action: 'send your message',
        resource: 'chat'
      });
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: friendlyError, streaming: false, isError: true }
          : m
      ));
      setStreamError(friendlyError);
      setLoading(false);
      setCurrentTool(null);
      currentResponseRef.current = '';
      currentContentRef.current = '';
      currentMsgIdRef.current = '';
      showToast('error', 'Message failed', friendlyError);
    }
  };

  // Keep ref in sync so the assistant-ui runtime always calls the latest sendMessage.
  sendMessageRef.current = (text: string) => sendMessage(text);

  const handleRetry = () => {
    if (!lastUserMessageRef.current) return;
    setInput(lastUserMessageRef.current);
    setStreamError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends (without shift for newline)
    // ⌘Enter also sends
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    if (!selectedAgent) return;
    setMessages([]);
    messageCacheRef.current.delete(selectedAgent.id);
    window.speechSynthesis.cancel();
    try {
      // Delete chat message history from messages table
      await chatApi.deleteSession(selectedAgent.dbSessionKey);
    } catch (_err) { /* Non-fatal */ }
    try {
      // Reset Claude CLI session so next message starts fresh (no stale --resume)
      await fetch(`/api/agents/${selectedAgent.id}/session`, { method: 'DELETE' });
    } catch (_err) { /* Non-fatal */ }
  };

  const reconnect = () => {
    setHistoryLoaded(false);
    forceReconnect();
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected': return 'Online';
      case 'connecting': return 'Connecting...';
      case 'authenticating': return 'Authenticating...';
      case 'disconnected': return 'Disconnected';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'bg-[var(--color-success)]';
      case 'connecting':
      case 'authenticating': return 'bg-[var(--color-warning)] animate-pulse';
      case 'disconnected': return 'bg-[var(--color-error)]';
    }
  };

  const handleCreateRoom = (name: string, agents: string[]) => {
    createRoom(name, agents);
    setShowRoomList(false);
    showToast(`Room "${name}" created!`, 'success');
  };

  const startTeamMeeting = () => {
    const allAgentIds = chatAgents.map(a => a.id);
    const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    createRoom(`Team Meeting — ${timestamp}`, allAgentIds);
    setShowRoomList(false);
    showToast('Team Meeting started! All agents are here.', 'success');
  };

  // If viewing a room, render the room view
  if (activeRoomId) {
    return (
      <>
        <ChatRoomView
          roomId={activeRoomId}
          onBack={() => setActiveRoom(null)}
        />
        <CreateRoomModal
          isOpen={showCreateRoom}
          onClose={() => setShowCreateRoom(false)}
          onCreate={handleCreateRoom}
        />
      </>
    );
  }

  // Guard against null selectedAgent (agents still loading)
  if (!selectedAgent) {
    return chatAgents.length === 0 ? (
      <div className="h-full flex items-center justify-center">
        <Spinner size={32} />
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
        <MessageCircle size={40} className="mb-4 opacity-30" />
        <p className="text-sm font-medium">Select an agent to start chatting</p>
        <p className="text-xs mt-1 opacity-70">Choose from the agent panel on the left</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorDisplay
        error={loadError}
        context={{ action: 'load chat', resource: 'messages' }}
        onRetry={() => { setLoadError(null); setHistoryLoaded(false); }}
      />
    );
  }

  return (
    <AssistantRuntimeProvider runtime={assistantRuntime}>
    <div
      className={`relative flex h-full overflow-hidden ${isDragging ? 'ring-2 ring-mission-control-accent ring-inset' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      role="region"
      aria-label="Chat panel"
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-mission-control-accent/10 z-20 flex items-center justify-center">
          <div className="text-center">
            <Paperclip size={44} className="mx-auto mb-3 text-mission-control-accent" />
            <p className="text-base font-medium text-mission-control-text">Drop files to attach</p>
          </div>
        </div>
      )}

      {/* ─── Left sidebar: agent list + rooms ─── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-mission-control-border bg-mission-control-surface overflow-hidden">

        {/* Sidebar header — CONVERSATIONS label + action buttons */}
        <div className="px-4 pt-3 pb-0 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Conversations</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startTeamMeeting}
              title="Start Team Meeting"
              aria-label="Start team meeting"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors"
            >
              <UsersRound size={14} />
            </button>
            {sidebarTab === 'rooms' && (
              <button
                type="button"
                onClick={() => setShowCreateRoom(true)}
                title="New chat room"
                aria-label="Create new chat room"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors"
              >
                <MessageSquarePlus size={14} />
              </button>
            )}
          </div>
        </div>

        {/* AGENTS | ROOMS tab toggle */}
        <div className="flex border-b border-mission-control-border">
          <button
            type="button"
            onClick={() => setSidebarTab('agents')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              sidebarTab === 'agents'
                ? 'border-b-mission-control-accent text-mission-control-accent'
                : 'border-b-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
            aria-pressed={sidebarTab === 'agents'}
          >
            Agents
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('rooms')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              sidebarTab === 'rooms'
                ? 'border-b-mission-control-accent text-mission-control-accent'
                : 'border-b-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
            aria-pressed={sidebarTab === 'rooms'}
          >
            Rooms
            {rooms.length > 0 && (
              <span className={`text-[10px] px-1 rounded tabular-nums ${sidebarTab === 'rooms' ? 'bg-mission-control-accent/15 text-mission-control-accent' : 'bg-mission-control-border text-mission-control-text-dim'}`}>
                {rooms.length}
              </span>
            )}
          </button>
        </div>

        {/* Agent list — direct 1:1 threads */}
        <div className={`flex-1 overflow-y-auto py-2 ${sidebarTab !== 'agents' ? 'hidden' : ''}`}>
          {chatAgents.length > 0 && (
            <div className="px-3 mb-1">
              <span className="sr-only">Agents</span>
            </div>
          )}
          {chatAgents.map((agent) => {
            const isActive = selectedAgent?.id === agent.id;
            const agentMessages = messageCacheRef.current.get(agent.id);
            const lastMsg = agentMessages?.[agentMessages.length - 1];
            const lastMsgText = lastMsg
              ? (typeof lastMsg.content === 'string'
                  ? lastMsg.content
                  : (lastMsg.content as any[]).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(''))
              : null;
            const lastMsgTime = lastMsg?.timestamp
              ? formatTimeAgo(lastMsg.timestamp)
              : null;

            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleAgentSwitch(agent)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg transition-colors text-left group ${
                  isActive
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text hover:bg-mission-control-bg'
                }`}
                style={{ width: 'calc(100% - 8px)' }}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="relative shrink-0">
                  <AgentAvatar agentId={agent.id} agentName={agent.name} size="sm" />
                  {/* Status dot */}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-mission-control-surface ${
                    agent.status === 'active' ? 'bg-[var(--color-success)]' :
                    agent.status === 'paused' ? 'bg-[var(--color-warning)]' :
                    agent.status === 'error' ? 'bg-[var(--color-error)]' :
                    'bg-mission-control-border'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-sm font-medium truncate ${isActive ? 'text-mission-control-accent' : 'text-mission-control-text'}`}>
                      {agent.name}
                    </span>
                    {lastMsgTime && (
                      <span className="text-[10px] text-mission-control-text-dim shrink-0 tabular-nums">{lastMsgTime}</span>
                    )}
                  </div>
                  {lastMsgText ? (
                    <p className="text-xs text-mission-control-text-dim truncate mt-0.5 leading-snug">
                      {lastMsgText.slice(0, 60)}
                    </p>
                  ) : (
                    <p className="text-xs text-mission-control-text-dim/60 mt-0.5">
                      {agent.role || 'AI Agent'}
                    </p>
                  )}
                </div>
              </button>
            );
          })}

        </div>

        {/* Rooms tab */}
        <div className={`flex-1 overflow-y-auto py-2 ${sidebarTab !== 'rooms' ? 'hidden' : ''}`}>
          {rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
              <MessageSquarePlus size={20} className="text-mission-control-text-dim/40" />
              <p className="text-xs text-mission-control-text-dim/60">No rooms yet</p>
              <button
                type="button"
                onClick={() => setShowCreateRoom(true)}
                className="text-xs text-mission-control-accent hover:underline"
              >
                Create a room
              </button>
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoom(room.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-mission-control-text hover:bg-mission-control-bg transition-colors text-left"
                style={{ width: 'calc(100% - 8px)' }}
              >
                <div className="flex -space-x-2 shrink-0">
                  {room.agents.slice(0, 2).map(id => (
                    <AgentAvatar key={id} agentId={id} size="xs" />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{room.name}</div>
                  <div className="text-xs text-mission-control-text-dim">
                    {room.messageCount ?? room.messages.length} messages
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ─── Main chat column ─── */}
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

          {/* Thread header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0 bg-mission-control-surface gap-3">
            {/* Agent identity */}
            <div className="flex items-center gap-3 min-w-0">
              <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />

              {/* Agent status pill */}
              {(() => {
                if (loading) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-mission-control-accent/10 text-mission-control-accent border border-mission-control-accent/20 select-none flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-pulse flex-shrink-0" />
                      Thinking...
                    </span>
                  );
                }
                if (connectionState === 'disconnected') {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/20 select-none flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] flex-shrink-0" />
                      Reconnecting...
                    </span>
                  );
                }
                if (connectionState === 'connected') {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium text-mission-control-text-dim border border-mission-control-border select-none flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] flex-shrink-0" />
                      Ready
                    </span>
                  );
                }
                return null;
              })()}

              {selectedAgent?.dbSessionKey ? (
                <SessionStatsBar
                  sessionKey={selectedAgent.dbSessionKey}
                  statusText={getStatusText()}
                  isDisconnected={connectionState === 'disconnected'}
                  onReconnect={reconnect}
                  onCompact={handleCompact}
                  onReset={() => setMessages([])}
                />
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor()}`} />
                  <span className="text-mission-control-text-dim">{getStatusText()}</span>
                  {connectionState === 'disconnected' && (
                    <button
                      type="button"
                      onClick={reconnect}
                      className="inline-flex items-center gap-1 text-xs text-mission-control-accent hover:underline"
                    >
                      <RefreshCw size={10} /> Reconnect
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                title={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
                aria-label={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
                aria-pressed={isVoiceMode}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  isVoiceMode
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg'
                }`}
              >
                {isVoiceMode ? <PhoneOff size={15} /> : <Phone size={15} />}
              </button>
              <button
                type="button"
                onClick={() => setShowSearch(!showSearch)}
                title={showSearch ? 'Hide search' : 'Search messages'}
                aria-label={showSearch ? 'Hide message search' : 'Search messages'}
                aria-expanded={showSearch}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  showSearch
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg'
                }`}
              >
                <Search size={15} />
              </button>
              <button
                type="button"
                onClick={() => setSpeakResponses(!speakResponses)}
                title={speakResponses ? 'Voice on' : 'Voice off'}
                aria-label={speakResponses ? 'Disable voice responses' : 'Enable voice responses'}
                aria-pressed={speakResponses}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  speakResponses
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg'
                }`}
              >
                {speakResponses ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                type="button"
                onClick={clearChat}
                title="Clear chat history"
                aria-label="Clear chat history"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <Trash2 size={15} />
              </button>
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
            </div>
          </div>

          {/* Voice Mode */}
          {isVoiceMode && (
            <VoiceChatPanel
              agentId={selectedAgent.id === 'mission-control' ? 'mission-control' : selectedAgent.id}
              onSwitchToText={() => setIsVoiceMode(false)}
              embedded={true}
            />
          )}

          {/* Search Bar */}
          {!isVoiceMode && showSearch && (
            <div className="px-5 py-3 border-b border-mission-control-border bg-mission-control-bg">
              <TextField.Root
                aria-label="Search messages input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full"
              >
                <TextField.Slot>
                  <Search size={14} />
                </TextField.Slot>
                {searchQuery && (
                  <TextField.Slot side="right">
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </TextField.Slot>
                )}
              </TextField.Root>
              {searchQuery && (
                <div className="mt-2 text-xs text-mission-control-text-dim">
                  {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} found
                </div>
              )}
            </div>
          )}

          {/* Gateway disconnected banner */}
          {connectionState === 'disconnected' && !isVoiceMode && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-warning)]/8 border-b border-[var(--color-warning)]/20 text-xs text-[var(--color-warning)] flex-shrink-0">
              <AlertTriangle size={12} className="flex-shrink-0" />
              <span>Gateway disconnected — messages will send when reconnected</span>
            </div>
          )}

          {/* Messages */}
          <div className={`flex-1 min-h-0 overflow-hidden ${isVoiceMode ? 'hidden' : ''}`} aria-label="Conversation messages">
            {loadingMessages ? (
              <div className="space-y-6 p-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-mission-control-surface animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2 max-w-lg">
                      <div className={`h-3.5 rounded-full bg-mission-control-surface animate-pulse ${i % 2 === 0 ? 'w-3/4 ml-auto' : 'w-2/3'}`} />
                      <div className={`h-3 rounded-full bg-mission-control-surface animate-pulse ${i % 2 === 0 ? 'w-1/2 ml-auto' : 'w-1/2'}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery && filteredMessages.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  type="search"
                  action={{ label: 'Clear search', onClick: () => setSearchQuery('') }}
                />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-mission-control-accent/10 border border-mission-control-accent/20 flex items-center justify-center mx-auto">
                    <MessageCircle size={20} className="text-mission-control-accent" />
                  </div>
                  <h3 className="text-base font-semibold text-mission-control-text">{selectedAgent?.name ?? 'Agent'}</h3>
                  <p className="text-sm text-mission-control-text-dim/80">How can I help you today?</p>
                </div>
                {/* Suggested prompts — Claude cowork style */}
                <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                  {[
                    "What tasks are in progress?",
                    "Summarize recent activity",
                    "Help me draft a message",
                    "What can you do for me?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-4 py-3 rounded-xl border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/40 hover:bg-mission-control-accent/5 transition-colors text-sm text-mission-control-text-dim hover:text-mission-control-text"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <MissionControlThread />
            )}
            <div ref={messagesEndRef} />
          </div>



          {/* Escalation / human-review banner — shown when agent signals it needs human attention */}
          {!isVoiceMode && activeEscalations.length > 0 && (
            <div className="mx-4 mb-2 flex-shrink-0 space-y-2" aria-live="assertive">
              {activeEscalations.map((msg) => {
                const text =
                  typeof msg.content === 'string'
                    ? msg.content
                    : (msg.content as ContentBlock[])
                        .filter((b: ContentBlock) => b.type === 'text')
                        .map((b: ContentBlock) => b.text ?? '')
                        .join('');
                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3 px-4 py-3 bg-[var(--color-warning)]/8 border border-[var(--color-warning)]/25 rounded-xl"
                    role="alert"
                  >
                    <UserCheck
                      size={16}
                      className="text-[var(--color-warning)] flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--color-warning)] uppercase tracking-wider mb-1">
                        Needs your attention
                      </p>
                      <p className="text-sm text-mission-control-text leading-snug line-clamp-3">{text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedEscalationIds(prev => new Set([...prev, msg.id ?? '']))
                      }
                      aria-label="Dismiss this escalation notice"
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg flex-shrink-0 transition-colors"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Composer area */}
          <div className={`flex flex-col gap-2 px-4 py-3 border-t border-mission-control-border flex-shrink-0 bg-mission-control-bg ${isVoiceMode ? 'hidden' : ''}`}>
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((att) => {
                  const Icon = getFileIcon(att.type);
                  const isImage = att.type.startsWith('image/');
                  return (
                    <div
                      key={att.id}
                      className="relative group/chip flex items-center gap-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors max-w-[140px] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewFile(att)}
                        title="Click to preview"
                        aria-label={`Preview attachment ${att.name}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-mission-control-text hover:text-mission-control-text transition-colors min-w-0 flex-1"
                      >
                        {isImage && att.dataUrl ? (
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="w-8 h-8 rounded object-cover flex-shrink-0 border border-mission-control-border/40"
                          />
                        ) : (
                          <Icon size={14} className="text-mission-control-accent flex-shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate text-xs">{att.name}</span>
                      </button>
                      {/* Remove button — visible on hover */}
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        aria-label={`Remove attachment ${att.name}`}
                        className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/40 transition-colors opacity-0 group-hover/chip:opacity-100"
                      >
                        <X size={10} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stream error banner */}
            {streamError && (
              <div className="flex items-start gap-3 px-4 py-3 mb-3 rounded-xl bg-[var(--color-error)]/8 border border-[var(--color-error)]/20 text-[var(--color-error)] text-sm">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{streamError}</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="shrink-0 text-xs font-semibold text-[var(--color-error)] hover:underline whitespace-nowrap"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading suggestions */}
            {/* AI-generated quick reply pills — auto-appear after each assistant message */}
            {(loadingSuggestions || suggestedReplies.length > 0) && (
              <div className="mb-2">
                {loadingSuggestions ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-mission-control-text-dim px-1 py-1">
                    <Loader2 size={11} className="animate-spin flex-shrink-0" />
                    <span>Generating replies…</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5" aria-label="Quick reply options">
                    {suggestedReplies.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { sendMessage(suggestion); setSuggestedReplies([]); }}
                        title="Send this reply"
                        className="px-3 py-1.5 text-xs rounded-full border border-mission-control-border text-mission-control-text-dim hover:border-mission-control-accent hover:text-mission-control-accent hover:bg-mission-control-accent/5 transition-colors bg-mission-control-surface"
                      >
                        {suggestion}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSuggestedReplies([])}
                      className="px-2 py-1.5 text-xs text-mission-control-text-dim/50 hover:text-mission-control-text-dim transition-colors"
                      title="Dismiss suggestions"
                      aria-label="Dismiss suggestions"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              aria-label="File attachment"
              onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
            />

            {/* Composer — attach + mic integrated inside */}
            <MissionControlComposer
              placeholder={`Message ${selectedAgent.name}…`}
              disabled={loading || messages.some(m => !!m.streaming)}
              loading={loading}
              onAttach={() => fileInputRef.current?.click()}
              isListening={listening}
              onToggleVoice={toggleVoice}
            />
          </div>

          {/* File Preview Modal */}
          <FilePreviewModal
            isOpen={!!previewFile}
            onClose={() => setPreviewFile(null)}
            file={previewFile}
          />

          {/* Create Room Modal */}
          <CreateRoomModal
            isOpen={showCreateRoom}
            onClose={() => setShowCreateRoom(false)}
            onCreate={handleCreateRoom}
          />

          {/* Live Activity Indicator */}
          <LiveActivity sessionKey={selectedAgent?.dbSessionKey} />
        </div>{/* end inner chat col */}

        {/* Artifact Panel — right sidebar */}
        <ArtifactPanel sessionId={currentSessionId} agentName={selectedAgent?.name} />
      </div>{/* end main chat column */}

      {/* Image lightbox */}
      {lightboxSrc && <ImageLightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={() => setLightboxSrc(null)} />}
    </div>
    </AssistantRuntimeProvider>
  );
}

// ============================================
// Image Lightbox Component
// ============================================

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Capture current focus on mount, move focus into overlay; restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    overlayRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Escape → close; Tab/Shift+Tab → trap focus within dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
        'a[href]:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm outline-none"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-w-full max-h-[80vh] rounded-lg object-contain shadow-2xl" />
        <Flex justify="end" gap="2">
          <a
            href={src}
            download
            className="px-4 py-2 rounded-lg bg-mission-control-surface border border-mission-control-border text-sm text-mission-control-text hover:bg-mission-control-border/20"
            onClick={e => e.stopPropagation()}
          >
            Download
          </a>
          <Button
            onClick={onClose}
            variant="outline"
            size="2"
           
          >
            Close
          </Button>
        </Flex>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Message reactions — persisted to localStorage
// ──────────────────────────────────────────
type ReactionType = 'up' | 'down';
interface MessageReaction { up: number; down: number; mine: ReactionType | null }

const REACTIONS_KEY = 'chat-message-reactions';

function loadReactions(): Record<string, MessageReaction> {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveReactions(data: Record<string, MessageReaction>) {
  try {
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

function toggleReaction(msgId: string, reaction: ReactionType): MessageReaction {
  const all = loadReactions();
  const current: MessageReaction = all[msgId] ?? { up: 0, down: 0, mine: null };
  if (current.mine === reaction) {
    all[msgId] = { ...current, [reaction]: Math.max(0, current[reaction] - 1), mine: null };
  } else {
    const prev = current.mine;
    all[msgId] = {
      up: reaction === 'up' ? current.up + 1 : prev === 'up' ? Math.max(0, current.up - 1) : current.up,
      down: reaction === 'down' ? current.down + 1 : prev === 'down' ? Math.max(0, current.down - 1) : current.down,
      mine: reaction,
    };
  }
  saveReactions(all);
  return all[msgId];
}

// ============================================
// Memoized ChatMessage Item Component
// ============================================

interface MessageItemProps {
  msg: StructuredChatMessage;
  isUser: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  time: string;
  isStarred: boolean;
  selectedAgent: ChatAgent;
  onToggleStar: (msg: StructuredChatMessage, e: React.MouseEvent) => void;
  onArtifactOpen?: (lang: string, code: string) => void;
  onImageClick?: (src: string, alt: string) => void;
}

const MessageItem = memo(function MessageItem({
  msg,
  isUser,
  showAvatar,
  isLastInGroup,
  time,
  isStarred,
  selectedAgent,
  onToggleStar,
  onArtifactOpen,
  onImageClick,
}: MessageItemProps) {
  const msgId = msg.id ?? '';
  const [reaction, setReaction] = useState<MessageReaction>(() => {
    if (!msgId) return { up: 0, down: 0, mine: null };
    return loadReactions()[msgId] ?? { up: 0, down: 0, mine: null };
  });

  const handleReaction = (type: ReactionType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!msgId) return;
    setReaction(toggleReaction(msgId, type));
  };

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${
        showAvatar ? 'mt-6' : 'mt-2'
      }`}
    >
      {/* Avatar column - consistent width */}
      <div className={`flex-shrink-0 w-10 ${!showAvatar ? 'invisible' : ''}`}>
        {isUser ? (
          <div className="w-10 h-10 rounded-full bg-mission-control-accent flex items-center justify-center text-white text-sm font-semibold ring-2 ring-white/10 dark:ring-white/20">
            K
          </div>
        ) : (
          <AgentAvatar agentId={selectedAgent.id} size="lg" ring />
        )}
      </div>

      {/* ChatMessage content column */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%] min-w-[120px]`}>
        {/* Sender name (only on first message in group) */}
        {showAvatar && (
          <div className={`text-xs font-medium mb-1 px-1 ${
            isUser ? 'text-mission-control-accent' : 'text-[var(--color-success)]'
          }`}>
            {isUser ? 'You' : selectedAgent.name}
          </div>
        )}

        {/* ChatMessage bubble with actions */}
        <div className="relative group w-full">
          {/* ChatMessage actions bar (appears on hover) */}
          {!msg.streaming && (
            <div className={`absolute ${isUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} top-0 flex items-center gap-1 ${isStarred || reaction.mine ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-colors duration-100`}>
              {/* Thumbs up */}
              <button
                onClick={(e) => handleReaction('up', e)}
                title="Helpful"
                aria-label="Mark as helpful"
                className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded border text-xs font-medium transition-colors ${
                  reaction.mine === 'up'
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
                }`}
              >
                <ThumbsUp size={13} className={reaction.mine === 'up' ? 'fill-current' : ''} />
                {reaction.up > 0 && (
                  <span className="text-xs font-medium leading-none">{reaction.up}</span>
                )}
              </button>
              {/* Thumbs down */}
              <button
                onClick={(e) => handleReaction('down', e)}
                title="Not helpful"
                aria-label="Mark as not helpful"
                className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded border text-xs font-medium transition-colors ${
                  reaction.mine === 'down'
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
                }`}
              >
                <ThumbsDown size={13} className={reaction.mine === 'down' ? 'fill-current' : ''} />
                {reaction.down > 0 && (
                  <span className="text-xs font-medium leading-none">{reaction.down}</span>
                )}
              </button>
              <button
                onClick={(e) => onToggleStar(msg, e)}
                title={isStarred ? 'Unstar message' : 'Star message'}
                aria-label={isStarred ? 'Unstar message' : 'Star message'}
                className={`inline-flex items-center justify-center px-1.5 py-1 rounded border text-xs font-medium transition-colors ${
                  isStarred
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
                }`}
              >
                <Star size={14} className={isStarred ? 'fill-current' : ''} />
              </button>
              <button
                onClick={async () => {
                  const textToCopy = Array.isArray(msg.content)
                    ? msg.content
                        .filter((b: any) => b.type === 'text')
                        .map((b: any) => b.text)
                        .join('')
                    : msg.content;

                  const success = await copyToClipboard(textToCopy);
                  if (success) {
                    showToast('success', 'Copied', 'Message copied to clipboard');
                  } else {
                    showToast('error', 'Copy Failed', 'Unable to copy to clipboard');
                  }
                }}
                title="Copy message"
                aria-label="Copy message"
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <Copy size={14} />
              </button>
            </div>
          )}

          {/* ChatMessage bubble */}
          <div
            className={`relative shadow-sm break-words ${
              isUser
                ? 'bg-mission-control-accent/10 border border-mission-control-accent/20 text-mission-control-text rounded-xl rounded-tr-sm px-4 py-3'
                : msg.subtle
                  ? 'bg-transparent text-mission-control-text-dim border border-mission-control-border/50 rounded-xl rounded-tl-sm px-3 py-1.5 text-sm'
                  : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text rounded-xl rounded-tl-sm px-4 py-3'
            }`}
            onClick={(e) => {
              if (onImageClick && e.target instanceof HTMLImageElement) {
                onImageClick(e.target.src, e.target.alt);
              }
            }}
          >
            {!!msg.streaming && !msg.content && !msg.status ? (
              <Flex align="center" gap="2" className="py-1">
                <Flex gap="1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-mission-control-text/70' : 'bg-mission-control-accent'}`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-mission-control-text/70' : 'bg-mission-control-accent'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-mission-control-text/70' : 'bg-mission-control-accent'}`} style={{ animationDelay: '300ms' }} />
                </Flex>
                <span className={`text-sm ${isUser ? 'text-white/80' : 'text-mission-control-text-dim'}`}>
                  Waiting...
                </span>
              </Flex>
            ) : msg.role === 'assistant' ? (
              Array.isArray(msg.content) ? (
                <div className="space-y-1">
                  {msg.content.map((block, idx) => (
                    <ContentBlock key={idx} block={block} index={idx} streaming={!!msg.streaming} onArtifactOpen={onArtifactOpen} />
                  ))}
                </div>
              ) : (
                <StreamingText
                  content={msg.content as string}
                  streaming={!!msg.streaming}
                  onArtifactOpen={onArtifactOpen}
                />
              )
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">
                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
              </div>
            )}
            {!!msg.streaming && msg.status && !msg.subtle && (
              <Flex align="center" gap="2" className="mt-2 text-xs text-mission-control-text-dim">
                <Flex gap="1">
                  <div className="w-1 h-1 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                </Flex>
                <span>{msg.status}</span>
              </Flex>
            )}
          </div>
        </div>
        
        {/* Timestamp and status — always visible on last in group, hover-revealed otherwise */}
        <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''} opacity-0 group-hover:opacity-100 ${isLastInGroup ? 'opacity-60' : ''} transition-opacity duration-100`}>
          <span className="text-[10px] tabular-nums text-mission-control-text-dim/60">
            {time}
          </span>
          {isStarred && (
            <Star size={10} className="text-[var(--color-warning)] fill-current" />
          )}
        </div>
      </div>
    </div>
  );
});

