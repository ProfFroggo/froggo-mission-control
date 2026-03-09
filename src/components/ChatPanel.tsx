import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Trash2, RefreshCw, WifiOff, Paperclip, X, FileText, Image, File, Search, Sparkles, Star, Copy, Users, MessageSquarePlus, Phone, PhoneOff, UsersRound } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { ChatAgent, useAgentList } from './AgentSelector';
import MarkdownMessage from './MarkdownMessage';
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
import ArtifactPanel from './ArtifactPanel';
import { useArtifactExtraction } from '../hooks/useArtifactExtraction';
import { Spinner } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';

const logger = createLogger('ChatPanel');

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
}

export default function ChatPanel() {
  const { addActivity } = useStore();
  const { rooms, activeRoomId, setActiveRoom, createRoom, loadRooms } = useChatRoomStore();
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
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const { agents: chatAgents } = useAgentList();
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent | null>(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // Auto-extract artifacts from 1-1 chat messages
  useArtifactExtraction(
    messages.map(m => ({
      id: m.id ?? '',
      role: m.role === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      timestamp: m.timestamp,
    })),
    selectedAgent?.sessionKey ?? selectedAgent?.id ?? ''
  );

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
          setMessages(normalized);
          messageCacheRef.current.set(selectedAgent.id, normalized);
        }
      } catch (_err) {
        // DB load failed — start with empty messages
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

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            ? { ...m, content: friendlyError, streaming: false }
            : m
        ));
        setLoading(false);
        currentResponseRef.current = '';
        currentContentRef.current = '';
        currentMsgIdRef.current = ''; if (currentRunIdRef.current) { gateway.clearRunId(currentRunIdRef.current); currentRunIdRef.current = ''; }
        showToast('error', 'Message failed', data.message || data.error || 'Could not send message');
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

  const generateSuggestions = useCallback(async () => {
    if (messages.length === 0 || loadingSuggestions) return;
    
    setLoadingSuggestions(true);
    setSuggestedReplies([]);
    
    try {
      // Extract last 10 messages for context
      const context = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string'
          ? msg.content
          : msg.content.filter(b => b.type === 'text').map(b => b.text ?? '').join(''),
      }));
      
      // TODO Phase 4: migrate — [web-not-available] not available in web
      showToast('error', 'Not available', 'Suggestion feature not available in web version');
    } catch (error: unknown) {
      // '[Chat] Suggestion error:', error;
      showToast('error', 'Failed to generate', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingSuggestions(false);
    }
  }, [messages, loadingSuggestions]);

  const applySuggestion = (suggestion: string) => {
    setInput(suggestion);
    setSuggestedReplies([]);
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (!selectedAgent) return;
    
    // Clear suggestions when sending
    setSuggestedReplies([]);

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
    
    setInput('');
    setLoading(true);
    addActivity({ type: 'chat', message: `You: ${text.slice(0, 50)}...`, timestamp: Date.now() });

    try {
      // Stream from REST API — no gateway needed
      const response = await fetch(`/api/agents/${selectedAgent.id}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, model: 'claude-sonnet-4-6', sessionKey: selectedAgent.dbSessionKey }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let structuredContent: ContentBlock[] | null = null;

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

            if (evt.type === 'assistant' && Array.isArray(evt.message?.content)) {
              const blocks: any[] = evt.message.content;
              const thinking = blocks.find((b: any) => b.type === 'thinking');
              const toolUse  = blocks.find((b: any) => b.type === 'tool_use');
              const text     = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text ?? '').join('');

              if (text) {
                // Text turn — accumulate and show, keep streaming:true until done
                accumulated += text;
                structuredContent = null;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated, status: undefined } : m
                ));
              } else if (toolUse) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, status: `Using: ${toolUse.name}` } : m
                ));
              } else if (thinking) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, status: 'Thinking...' } : m
                ));
              }
              // Never set streaming:false here — wait for done/result
            } else if (evt.type === 'result' && typeof evt.result === 'string') {
              // Definitive final text from Claude CLI — always authoritative
              if (evt.result) {
                accumulated = evt.result;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: accumulated, status: undefined } : m
                ));
              }
            } else if (evt.type === 'text' && typeof evt.text === 'string') {
              // Fallback: non-JSON lines from stderr/stdout
              accumulated += evt.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ));
            } else if (evt.type === 'error' && typeof evt.text === 'string') {
              // Server-side error (e.g. agent busy, spawn failure) — surface it
              accumulated = evt.text;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated, status: undefined } : m
              ));
            } else if (evt.type === 'timeout') {
              accumulated = 'Response timed out — the agent took too long. Please try again.';
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated, status: undefined } : m
              ));
            } else if (evt.type === 'done') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, streaming: false, status: undefined } : m
              ));
              setLoading(false);
            }

            // Re-enable input once agent starts doing something
            if (evt.type === 'assistant' || evt.type === 'text' || evt.type === 'result' || evt.type === 'error' || evt.type === 'timeout') {
              setLoading(false);
            }
          } catch { /* skip malformed */ }
        }
      }

      // Finalize — if stream completed with no content, show error instead of disappearing
      if (!accumulated) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'No response received. The session may have expired — please try again.', streaming: false }
            : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, streaming: false } : m
        ));
      }
      setLoading(false);
      currentMsgIdRef.current = '';
      currentResponseRef.current = accumulated;
      currentContentRef.current = structuredContent ?? accumulated;

      // Save to DB — always save plain text (not ContentBlock[] JSON)
      if (accumulated && selectedAgent) {
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
          ? { ...m, content: friendlyError, streaming: false }
          : m
      ));
      setLoading(false);
      currentResponseRef.current = '';
      currentContentRef.current = '';
      currentMsgIdRef.current = '';
      showToast('error', 'Message failed', e instanceof Error ? e.message : 'Could not send message');
    }
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
    // TODO Phase 4: migrate — clearMessages endpoint not yet in API; session delete as fallback
    try {
      await chatApi.deleteSession(selectedAgent.dbSessionKey);
    } catch (_err) {
      // Non-fatal — UI already cleared
    }
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
      case 'connected': return 'bg-success';
      case 'connecting':
      case 'authenticating': return 'bg-warning animate-pulse';
      case 'disconnected': return 'bg-error';
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
    showToast('🏢 Team Meeting started! All agents are here.', 'success');
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
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={32} />
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
    <div
      className={`h-full flex flex-col relative ${isDragging ? 'ring-2 ring-mission-control-accent ring-inset' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      aria-label="Chat panel - drop files here"
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-mission-control-accent/10 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-center">
            <Paperclip size={48} className="mx-auto mb-2 text-mission-control-accent" />
            <p className="text-lg font-medium">Drop files to attach</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border flex items-center justify-between bg-mission-control-surface">
        <div className="flex items-center gap-3 min-w-0">
          <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-mission-control-text-dim">{getStatusText()}</span>
            {connectionState === 'disconnected' && (
              <button
                onClick={reconnect}
                className="text-mission-control-accent hover:underline flex items-center gap-1"
              >
                <RefreshCw size={10} /> Reconnect
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={`p-2 rounded-lg transition-colors ${
              isVoiceMode ? 'bg-review-subtle text-review' : 'bg-mission-control-border text-mission-control-text-dim hover:text-review'
            }`}
            title={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
          >
            {isVoiceMode ? <PhoneOff size={16} /> : <Phone size={16} />}
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors ${
              showSearch ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
            title={showSearch ? 'Hide search' : 'Search messages'}
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => setSpeakResponses(!speakResponses)}
            className={`p-2 rounded-lg transition-colors ${
              speakResponses ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim'
            }`}
            title={speakResponses ? 'Voice on' : 'Voice off'}
          >
            {speakResponses ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            title="Clear chat"
          >
            <Trash2 size={16} />
          </button>
          <div className="w-px h-5 bg-mission-control-border mx-1" />
          <button
            onClick={startTeamMeeting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-warning text-white hover:bg-amber-600 transition-all shadow-sm hover:shadow-md text-xs font-semibold"
            title="Start Team Meeting — All agents join"
          >
            <UsersRound size={15} />
            <span className="hidden sm:inline">Team Meeting</span>
          </button>
          <button
            onClick={() => setShowRoomList(!showRoomList)}
            className={`p-2 rounded-lg transition-colors relative ${
              showRoomList ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
            title="Chat Rooms"
          >
            <Users size={16} />
            {rooms.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-mission-control-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {rooms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="p-2 rounded-lg bg-mission-control-accent text-white hover:opacity-90 transition-opacity"
            title="Create Chat Room"
          >
            <MessageSquarePlus size={16} />
          </button>
        </div>
      </div>

      {/* Body — below header: chat left, artifact panel right */}
      <div className="flex-1 flex min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

      {/* Room List Dropdown */}
      {showRoomList && (
        <div className="border-b border-mission-control-border bg-mission-control-surface/95 backdrop-blur-sm">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide">Chat Rooms</span>
              <button
                onClick={() => { setShowCreateRoom(true); setShowRoomList(false); }}
                className="text-xs text-mission-control-accent hover:underline flex items-center gap-1"
              >
                <MessageSquarePlus size={12} /> New Room
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="text-sm text-mission-control-text-dim py-3 text-center">
                No rooms yet. Create one to start a multi-agent discussion!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { setActiveRoom(room.id); setShowRoomList(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-mission-control-bg border border-transparent hover:border-mission-control-border transition-all text-left"
                  >
                    <div className="flex -space-x-1.5">
                      {room.agents.slice(0, 3).map(id => (
                        <AgentAvatar key={id} agentId={id} size="xs" />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{room.name}</div>
                      <div className="text-xs text-mission-control-text-dim">
                        {room.messageCount ?? room.messages.length} messages · {new Date(room.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
        <div className="px-4 py-3 border-b border-mission-control-border bg-mission-control-bg/50">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              aria-label="Search messages input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim hover:text-mission-control-text"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-xs text-mission-control-text-dim">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isVoiceMode ? 'hidden' : ''}`}>
        {messages.length === 0 ? (
          <div className="text-center py-16 text-mission-control-text-dim">
            <AgentAvatar agentId={selectedAgent.id} size="2xl" className="mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Hey! I&apos;m {selectedAgent.name}</p>
            <p className="text-sm">{selectedAgent.role}. Ask me anything!</p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {['Check my calendar', 'Draft a tweet', 'What tasks are pending?', 'Check my emails'].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : searchQuery && filteredMessages.length === 0 ? (
          <EmptyState
            type="search"
            action={{ label: 'Clear search', onClick: () => setSearchQuery('') }}
          />
        ) : (
          filteredMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const showAvatar = idx === 0 || filteredMessages[idx - 1]?.role !== msg.role;
            const isLastInGroup = idx === filteredMessages.length - 1 || filteredMessages[idx + 1]?.role !== msg.role;
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const isStarred = starredMessageIds.has(msg.id ?? '');
            
            return (
              <MessageItem
                key={msg.id}
                msg={msg}
                isUser={isUser}
                showAvatar={showAvatar}
                isLastInGroup={isLastInGroup}
                time={time}
                isStarred={isStarred}
                selectedAgent={selectedAgent}
                onToggleStar={handleToggleStar}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Connection banner removed — chat uses REST API, gateway is optional */}

      {/* Input */}
      <div className={`p-4 border-t border-mission-control-border bg-mission-control-surface ${isVoiceMode ? 'hidden' : ''}`}>
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors cursor-pointer"
                  onClick={() => setPreviewFile(att)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreviewFile(att); } }}
                  title="Click to preview"
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview attachment ${att.name}`}
                >
                  <Icon size={16} className="text-mission-control-accent" />
                  <span className="text-sm truncate max-w-32">{att.name}</span>
                  <span className="text-xs text-mission-control-text-dim">
                    {(att.size / 1024).toFixed(1)}KB
                  </span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 hover:bg-mission-control-border rounded"
                  >
                    <X size={14} className="text-mission-control-text-dim" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Suggested Replies */}
        {suggestedReplies.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-mission-control-accent" />
              <span className="text-xs text-mission-control-text-dim">Suggested replies</span>
              <button
                onClick={() => setSuggestedReplies([])}
                className="ml-auto text-xs text-mission-control-text-dim hover:text-mission-control-text"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedReplies.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => applySuggestion(suggestion)}
                  className="px-3 py-2 bg-mission-control-accent/10 border border-mission-control-accent/30 rounded-lg text-sm hover:border-mission-control-accent hover:bg-mission-control-accent/20 transition-all text-left"
                  title="Click to use this reply"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          />
          
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-all"
            title="Attach files"
          >
            <Paperclip size={20} />
          </button>

          <button
            onClick={toggleVoice}
            className={`p-3 rounded-xl transition-all ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Suggest Replies button */}
          <button
            onClick={generateSuggestions}
            disabled={messages.length === 0 || loadingSuggestions}
            className={`p-3 rounded-xl transition-all ${
              loadingSuggestions
                ? 'bg-mission-control-accent text-white animate-pulse'
                : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-accent hover:bg-mission-control-accent/10'
            }`}
            title="AI suggested replies"
          >
            {loadingSuggestions ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              aria-label={`Message ${selectedAgent.name}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedAgent.name}...`}
              rows={1}
              className="w-full bg-mission-control-surface border border-mission-control-border rounded-xl px-4 py-3 text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none transition-colors"
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || loading || messages.some(m => !!m.streaming)}
            className="p-3 bg-mission-control-accent text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
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
      <ArtifactPanel sessionId={selectedAgent?.sessionKey ?? selectedAgent?.id ?? ''} />
      </div>{/* end body row */}
    </div>
  );
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
}: MessageItemProps) {
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
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[70%] lg:max-w-[65%] min-w-[120px]`}>
        {/* Sender name (only on first message in group) */}
        {showAvatar && (
          <div className={`text-xs font-medium mb-1 px-1 ${
            isUser ? 'text-mission-control-accent' : 'text-emerald-600'
          }`}>
            {isUser ? 'You' : selectedAgent.name}
          </div>
        )}

        {/* ChatMessage bubble with actions */}
        <div className="relative group w-full">
          {/* ChatMessage actions bar (appears on hover) */}
          {!msg.streaming && (
            <div className={`absolute ${isUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} top-0 flex items-center gap-1 ${isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all duration-100`}>
              <button
                onClick={(e) => onToggleStar(msg, e)}
                className={`p-1.5 rounded-lg transition-all duration-100 ${
                  isStarred
                    ? 'bg-yellow-100 text-warning shadow-sm'
                    : 'bg-mission-control-surface/90 backdrop-blur-sm text-mission-control-text-dim hover:text-warning hover:bg-yellow-50 border border-mission-control-border'
                }`}
                title={isStarred ? 'Unstar message' : 'Star message'}
              >
                <Star 
                  size={14} 
                  className={isStarred ? 'fill-yellow-500' : ''}
                />
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
                className="p-1.5 rounded-lg bg-mission-control-surface/90 backdrop-blur-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border border border-mission-control-border transition-all"
                title="Copy message"
              >
                <Copy size={14} />
              </button>
            </div>
          )}

          {/* ChatMessage bubble */}
          <div
            className={`relative px-4 py-3 rounded-2xl shadow-sm ${
              isUser
                ? 'bg-mission-control-accent text-white rounded-tr-sm'
                : 'bg-mission-control-surface text-mission-control-text border border-mission-control-border rounded-tl-sm'
            }`}
          >
            {!!msg.streaming && !msg.content && !msg.status ? (
              <div className="flex items-center gap-2 py-1">
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-mission-control-text/70' : 'bg-mission-control-accent'}`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-mission-control-text/70' : 'bg-mission-control-accent'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-mission-control-text/70' : 'bg-mission-control-accent'}`} style={{ animationDelay: '300ms' }} />
                </div>
                <span className={`text-sm ${isUser ? 'text-white/80' : 'text-mission-control-text-dim'}`}>
                  Waiting...
                </span>
              </div>
            ) : msg.role === 'assistant' ? (
              Array.isArray(msg.content) ? (
                <div className="space-y-1">
                  {msg.content.map((block, idx) => (
                    <ContentBlock key={idx} block={block} index={idx} />
                  ))}
                </div>
              ) : (
                <MarkdownMessage content={msg.content as string} />
              )
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">
                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
              </div>
            )}
            {!!msg.streaming && msg.status && (
              <div className="flex items-center gap-2 mt-2 text-xs text-mission-control-text-dim">
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>{msg.status}</span>
              </div>
            )}
            {!!msg.streaming && !!msg.content && !msg.status && (
              <div className={`flex items-center gap-1.5 mt-2 ${isUser ? 'opacity-70' : 'opacity-60'}`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isUser ? 'bg-mission-control-text' : 'bg-mission-control-accent'}`} />
                <span className={`text-xs ${isUser ? 'text-white/90' : 'text-mission-control-text-dim'}`}>
                  typing...
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Timestamp and status */}
        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : ''} ${isLastInGroup ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-100`}>
          <span className="text-xs text-mission-control-text-dim font-medium">
            {time}
          </span>
          {isStarred && (
            <Star size={10} className="text-warning fill-yellow-500" />
          )}
        </div>
      </div>
    </div>
  );
});

