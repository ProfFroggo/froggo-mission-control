import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Trash2, RefreshCw, WifiOff, Paperclip, X, FileText, Image, File, Search, Sparkles, Star, Copy, Users, MessageSquarePlus, Phone, PhoneOff, UsersRound } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { ChatAgent, fetchAgentList } from './AgentSelector';
import MarkdownMessage from './MarkdownMessage';
import VoiceChatPanel from './VoiceChatPanel';
import FilePreviewModal from './FilePreviewModal';
import CreateRoomModal from './CreateRoomModal';
import ChatRoomView from './ChatRoomView';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { useChatRoomStore } from '../store/chatRoomStore';
import { showToast } from './Toast';
import { getUserFriendlyError } from '../utils/errorMessages';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChatPanel');

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

export default function ChatPanel() {
  const { addActivity } = useStore();
  const { rooms, activeRoomId, setActiveRoom, createRoom } = useChatRoomStore();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const agents = useStore(s => s.agents);
  const chatAgents = fetchAgentList();
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent | null>(chatAgents.length > 0 ? chatAgents[0] : null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // Update selectedAgent when agents load if not set
  useEffect(() => {
    if (!selectedAgent && chatAgents.length > 0) {
      setSelectedAgent(chatAgents[0]);
    }
  }, [chatAgents, chatAgents.length, selectedAgent]);
  
  // Cache messages per agent so switching is instant
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentResponseRef = useRef<string>('');
  const currentMsgIdRef = useRef<string>('');
  const currentRunIdRef = useRef<string>('');

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
    if (window.clawdbot?.chat?.loadMessages) {
      const result = await window.clawdbot?.chat.loadMessages(50, agent.dbSessionKey);
      if (result?.success && result.messages?.length > 0) {
        setMessages(result.messages);
        messageCacheRef.current.set(agent.id, result.messages);
      }
    }
  }, [selectedAgent, messages]);

  // Load starred message IDs
  useEffect(() => {
    const loadStarredIds = async () => {
      if (!selectedAgent || !window.clawdbot?.starred?.list) return;
      const result = await window.clawdbot?.starred.list({ sessionKey: selectedAgent.dbSessionKey, limit: 1000 });
      if (result?.success && result.starred) {
        const ids = new Set(result.starred.map((s: any) => s.message_id.toString()));
        setStarredMessageIds(ids);
      }
    };
    loadStarredIds();
  }, [selectedAgent]);

  // Toggle star on a message
  const handleToggleStar = async (msg: ChatMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.clawdbot?.starred) {
      showToast('Starred messages not available', 'error');
      return;
    }

    const messageId = parseInt(msg.id ?? '0');
    const isStarred = starredMessageIds.has(msg.id ?? '');

    try {
      if (isStarred) {
        // Unstar
        const result = await window.clawdbot?.starred.unstar(messageId);
        if (result?.success) {
          setStarredMessageIds(prev => {
            const next = new Set(prev);
            next.delete(msg.id ?? '');
            return next;
          });
          showToast('ChatMessage unstarred', 'success');
        } else {
          showToast('Failed to unstar message', 'error');
        }
      } else {
        // Star
        const result = await window.clawdbot?.starred.star(messageId);
        if (result?.success) {
          setStarredMessageIds(prev => new Set(prev).add(msg.id ?? ''));
          showToast('ChatMessage starred', 'success');
        } else {
          showToast('Failed to star message', 'error');
        }
      }
    } catch (error: unknown) {
      // 'Toggle star error:', error;
      showToast('Error toggling star', 'error');
    }
  };

  // Load messages from database on mount (and when agent changes) - this is the source of truth
  useEffect(() => {
    const loadFromDb = async () => {
      if (!selectedAgent) return;
      // Mark as loaded IMMEDIATELY to prevent gateway history from loading while DB query runs
      setHistoryLoaded(true);

      if (window.clawdbot?.chat?.loadMessages) {
        const result = await window.clawdbot?.chat.loadMessages(50, selectedAgent.dbSessionKey);
        if (result.success && result.messages?.length > 0) {
          setMessages(result.messages);
          messageCacheRef.current.set(selectedAgent.id, result.messages);
        }
      }
    };
    loadFromDb();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Only on mount - agent switching handled by handleAgentSwitch

  // Save message to database helper
  const saveMessageToDb = async (role: string, content: string) => {
    if (!selectedAgent || !window.clawdbot?.chat?.saveMessage) return;
    try {
      await window.clawdbot?.chat.saveMessage({ role, content, timestamp: Date.now(), sessionKey: selectedAgent.dbSessionKey });
    } catch (err) {
      // `[Chat] Error saving ${role} message:`, err;
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
    const visible = messages.filter(msg =>
      !isSystemReply(msg.content) &&
      (msg.streaming || (msg.content && msg.content.trim().length > 0))
    );
    if (!searchQuery.trim()) return visible;
    const query = searchQuery.toLowerCase();
    return visible.filter(msg => 
      msg.content.toLowerCase().includes(query) ||
      msg.role.toLowerCase().includes(query)
    );
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
      const res = await gateway.getChatHistory(30);
      if (res?.messages && Array.isArray(res.messages)) {
        const history: ChatMessage[] = res.messages
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any, i: number) => {
            // Extract text from content (handle both string and array formats)
            let content = '';
            if (typeof m.content === 'string') {
              content = m.content;
            } else if (Array.isArray(m.content)) {
              content = m.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
            }
            
            return {
              id: `hist-${i}-${Date.now()}`,
              role: m.role as 'user' | 'assistant',
              content: content || '',
              timestamp: m.timestamp || Date.now() - (res.messages.length - i) * 1000,
            };
          })
          .reverse(); // Most recent last
        
        if (history.length > 0) {
          setMessages(history);
        }
      }
      setHistoryLoaded(true);
    } catch (e) {
      // '[Chat] Failed to load history:', e;
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
    let deltaRafScheduled = false;
    const handleDelta = (data: any) => {
      if (data.delta && currentMsgIdRef.current) {
        currentResponseRef.current += data.delta;
        // Rate-limit re-renders to once per animation frame
        if (!deltaRafScheduled) {
          deltaRafScheduled = true;
          requestAnimationFrame(() => {
            deltaRafScheduled = false;
            setMessages(prev => prev.map(m =>
              m.id === currentMsgIdRef.current
                ? { ...m, content: currentResponseRef.current }
                : m
            ));
          });
        }
        // Re-enable input on first delta (streaming has started)
        if (loading) {
          setLoading(false);
        }
      }
    };

    const handleMessage = (data: any) => {
      if (data.content && currentMsgIdRef.current) {
        currentResponseRef.current = data.content;
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, content: data.content, streaming: false } 
            : m
        ));
      }
    };

    const handleEnd = () => {
      if (currentMsgIdRef.current) {
        const finalContent = currentResponseRef.current;

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
        if (runId) { gateway.clearRunId(runId); currentRunIdRef.current = ''; }

        // Fire-and-forget: DB save, speech, routing — all parallel, non-blocking
        if (finalContent && selectedAgent && window.clawdbot?.chat?.saveMessage) {
          window.clawdbot.chat.saveMessage({
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
            sessionKey: selectedAgent.dbSessionKey,
          }).catch((err: any) => logger.error('Error saving assistant message:', err));
        }

        if (speakResponses && finalContent) {
          requestIdleCallback(() => speak(finalContent), { timeout: 5000 });
        }

        const brainMatch = finalContent.match(/@Brain:\s*([\s\S]*?)(?:$|(?=\n\n))/i);
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

      // Extract content from message structure
      const content = data.message?.content?.[0]?.text || data.content || '';
      if (content) {
        // Only update if this is the final/complete content, not partial
        // Partial deltas are handled by handleDelta
        if (data.state === 'final' || content.length > currentResponseRef.current.length) {
          currentResponseRef.current = content;
          setMessages(prev => prev.map(m => 
            m.id === currentMsgIdRef.current 
              ? { ...m, content } 
              : m
          ));
        }
      }

      // Check if final
      if (data.state === 'final') {
        const finalContent = currentResponseRef.current;
        
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, streaming: false } 
            : m
        ));
        
        // Save assistant message to database
        if (finalContent && selectedAgent && window.clawdbot?.chat?.saveMessage) {
          window.clawdbot?.chat.saveMessage({
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
            sessionKey: selectedAgent.dbSessionKey,
          }).catch((err: any) => {
            logger.error('Error saving assistant message:', err);
          });
        }
        
        if (speakResponses && finalContent) {
          speak(finalContent);
        }
        
        // Check for @Brain: routing - forward to main session (Brain/Froggo)
        const brainMatch = finalContent.match(/@Brain:\s*([\s\S]*?)(?:$|(?=\n\n))/i);
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
        currentMsgIdRef.current = ''; if (currentRunIdRef.current) { gateway.clearRunId(currentRunIdRef.current); currentRunIdRef.current = ''; }
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
        content: msg.content
      }));
      
      if (window.clawdbot?.chat?.suggestReplies) {
        const result = await window.clawdbot?.chat.suggestReplies(context);
        
        if (result.success && result.suggestions?.length > 0) {
          setSuggestedReplies(result.suggestions);
          showToast('success', 'Suggestions ready', `${result.suggestions.length} options generated`);
        } else {
          showToast('error', 'No suggestions', result.error || 'Could not generate suggestions');
        }
      } else {
        showToast('error', 'Not available', 'Suggestion feature not available');
      }
    } catch (error: unknown) {
      // '[Chat] Suggestion error:', error;
      showToast('error', 'Failed to generate', error.message || 'Unknown error');
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
    if ((!text && attachments.length === 0) || !connected) return;
    
    // Clear suggestions when sending
    setSuggestedReplies([]);

    // Build message content with actual file contents
    let content = text;
    const fileContents: string[] = [];
    const savedFiles: string[] = [];
    
    for (const att of attachments) {
      if (att.dataUrl) {
        // Text-based files: decode and include content inline
        const textExtensions = ['.txt', '.md', '.json', '.csv', '.js', '.ts', '.py', '.jsx', '.tsx', '.html', '.css', '.yml', '.yaml', '.xml', '.sh', '.bash', '.sql', '.r', '.rb', '.go', '.rs', '.swift', '.kt'];
        const isTextFile = att.type.startsWith('text/') || textExtensions.some(ext => att.name.toLowerCase().endsWith(ext));
        
        if (isTextFile) {
          // Text file: decode and include content
          try {
            const base64 = att.dataUrl.split(',')[1];
            const decoded = atob(base64);
            fileContents.push(`\n\n--- FILE: ${att.name} ---\n\`\`\`\n${decoded}\n\`\`\`\n--- END FILE ---`);
          } catch (_e) {
            fileContents.push(`\n\n[Attached text file: ${att.name} - could not decode]`);
          }
        } else if (att.type.startsWith('image/')) {
          // Image: Save to shared uploads folder and tell AI to use vision
          try {
            const uploadDir = '/Users/worker/froggo/uploads';
            const tempPath = `${uploadDir}/dashboard-upload-${Date.now()}-${att.name}`;
            await window.clawdbot?.fs?.writeBase64(tempPath, att.dataUrl.split(',')[1]);
            savedFiles.push(tempPath);
            fileContents.push(`\n\n📷 IMAGE ATTACHED: ${att.name}\nSaved to: ${tempPath}\nPlease use the image tool or Read tool to analyze this image.`);
          } catch (_e) {
            // Fallback: include base64 data URL so agent can still see the image
            fileContents.push(`\n\n📷 IMAGE: ${att.name} (${(att.size / 1024).toFixed(1)}KB)\nBase64 data URL: ${att.dataUrl}`);
          }
        } else if (att.type === 'application/pdf') {
          // PDF: Save to shared uploads folder and suggest extraction
          try {
            const uploadDir = '/Users/worker/froggo/uploads';
            const tempPath = `${uploadDir}/dashboard-upload-${Date.now()}-${att.name}`;
            await window.clawdbot?.fs?.writeBase64(tempPath, att.dataUrl.split(',')[1]);
            savedFiles.push(tempPath);
            fileContents.push(`\n\n📄 PDF ATTACHED: ${att.name}\nSaved to: ${tempPath}\nPlease extract text or analyze this PDF.`);
          } catch (_e) {
            fileContents.push(`\n\n[PDF attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB)]`);
          }
        } else if (att.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac'].some(ext => att.name.toLowerCase().endsWith(ext))) {
          // Audio file: Transcribe with Whisper
          try {
            showToast('info', 'Transcribing audio...', att.name);
            const base64 = att.dataUrl.split(',')[1];
            const audioBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
            const result = await window.clawdbot?.whisper?.transcribe(audioBuffer);
            
            if (result?.transcript) {
              fileContents.push(`\n\n🎤 AUDIO TRANSCRIPTION: ${att.name}\n\`\`\`\n${result.transcript}\n\`\`\``);
              showToast('success', 'Audio transcribed', `${result.transcript.split(' ').length} words`);
            } else {
              fileContents.push(`\n\n🎤 AUDIO: ${att.name} (${(att.size / 1024).toFixed(1)}KB)\n[Transcription failed: ${result?.error || 'unknown error'}]`);
            }
          } catch (e) {
            fileContents.push(`\n\n🎤 AUDIO: ${att.name} (${(att.size / 1024).toFixed(1)}KB)\n[Could not transcribe: ${e}]`);
          }
        } else {
          // Other files: save to shared uploads folder and include path
          try {
            const uploadDir = '/Users/worker/froggo/uploads';
            const tempPath = `${uploadDir}/dashboard-upload-${Date.now()}-${att.name}`;
            await window.clawdbot?.fs?.writeBase64(tempPath, att.dataUrl.split(',')[1]);
            savedFiles.push(tempPath);
            fileContents.push(`\n\n📎 FILE ATTACHED: ${att.name} (${(att.size / 1024).toFixed(1)}KB)\nSaved to: ${tempPath}`);
          } catch (_e) {
            fileContents.push(`\n\n📎 Attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB, type: ${att.type})`);
          }
        }
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
      // Use streaming send - events will update the message
      // Send full content including file contents
      // Gateway routes to the session set via setSessionKey()
      const runId = await gateway.sendChatStreaming(content);
      if (runId) currentRunIdRef.current = runId;
      
      // Timeout fallback
      setTimeout(() => {
        if (loading && currentMsgIdRef.current === assistantId) {
          const current = currentResponseRef.current;
          setMessages(prev => prev.map(m => 
            m.id === assistantId && m.streaming
              ? { ...m, content: current || 'No response received', streaming: false } 
              : m
          ));
          setLoading(false);
          currentMsgIdRef.current = ''; if (currentRunIdRef.current) { gateway.clearRunId(currentRunIdRef.current); currentRunIdRef.current = ''; }
        }
      }, 120000);
      
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
      currentMsgIdRef.current = ''; if (currentRunIdRef.current) { gateway.clearRunId(currentRunIdRef.current); currentRunIdRef.current = ''; }
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
    // Also clear from database
    if (window.clawdbot?.chat?.clearMessages) {
      await window.clawdbot?.chat.clearMessages(selectedAgent.dbSessionKey);
    }
  };

  const reconnect = () => {
    setHistoryLoaded(false);
    gateway['reconnectNow']();
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
    const allAgentIds = agents.map(a => a.id);
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
        <div className="text-center">
          <Loader2 size={48} className="mx-auto mb-4 animate-spin text-clawd-accent" />
          <p className="text-lg font-medium">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full flex flex-col relative ${isDragging ? 'ring-2 ring-clawd-accent ring-inset' : ''}`}
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
        <div className="absolute inset-0 bg-clawd-accent/10 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-center">
            <Paperclip size={48} className="mx-auto mb-2 text-clawd-accent" />
            <p className="text-lg font-medium">Drop files to attach</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="p-4 border-b border-clawd-border flex items-center justify-between bg-clawd-surface">
        <div className="flex items-center gap-3 min-w-0">
          <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-clawd-text-dim">{getStatusText()}</span>
            {connectionState === 'disconnected' && (
              <button
                onClick={reconnect}
                className="text-clawd-accent hover:underline flex items-center gap-1"
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
              isVoiceMode ? 'bg-review-subtle text-review' : 'bg-clawd-border text-clawd-text-dim hover:text-review'
            }`}
            title={isVoiceMode ? 'Switch to text chat' : 'Switch to voice chat'}
          >
            {isVoiceMode ? <PhoneOff size={16} /> : <Phone size={16} />}
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors ${
              showSearch ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={showSearch ? 'Hide search' : 'Search messages'}
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => setSpeakResponses(!speakResponses)}
            className={`p-2 rounded-lg transition-colors ${
              speakResponses ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim'
            }`}
            title={speakResponses ? 'Voice on' : 'Voice off'}
          >
            {speakResponses ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors"
            title="Clear chat"
          >
            <Trash2 size={16} />
          </button>
          <div className="w-px h-5 bg-clawd-border mx-1" />
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
              showRoomList ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title="Chat Rooms"
          >
            <Users size={16} />
            {rooms.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-clawd-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {rooms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowCreateRoom(true)}
            className="p-2 rounded-lg bg-clawd-accent text-white hover:opacity-90 transition-opacity"
            title="Create Chat Room"
          >
            <MessageSquarePlus size={16} />
          </button>
        </div>
      </div>

      {/* Room List Dropdown */}
      {showRoomList && (
        <div className="border-b border-clawd-border bg-clawd-surface/95 backdrop-blur-sm">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-clawd-text-dim uppercase tracking-wide">Chat Rooms</span>
              <button
                onClick={() => { setShowCreateRoom(true); setShowRoomList(false); }}
                className="text-xs text-clawd-accent hover:underline flex items-center gap-1"
              >
                <MessageSquarePlus size={12} /> New Room
              </button>
            </div>
            {rooms.length === 0 ? (
              <p className="text-sm text-clawd-text-dim py-3 text-center">
                No rooms yet. Create one to start a multi-agent discussion!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { setActiveRoom(room.id); setShowRoomList(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-clawd-bg border border-transparent hover:border-clawd-border transition-all text-left"
                  >
                    <div className="flex -space-x-1.5">
                      {room.agents.slice(0, 3).map(id => (
                        <AgentAvatar key={id} agentId={id} size="xs" />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{room.name}</div>
                      <div className="text-xs text-clawd-text-dim">
                        {room.messages.length} messages · {new Date(room.updatedAt).toLocaleDateString()}
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
          agentId={selectedAgent.id === 'froggo' ? 'froggo' : selectedAgent.id}
          onSwitchToText={() => setIsVoiceMode(false)}
          embedded={true}
        />
      )}

      {/* Search Bar */}
      {!isVoiceMode && showSearch && (
        <div className="px-4 py-3 border-b border-clawd-border bg-clawd-bg/50">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              aria-label="Search messages input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full bg-clawd-surface border border-clawd-border rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-clawd-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-clawd-text-dim hover:text-clawd-text"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-2 text-xs text-clawd-text-dim">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isVoiceMode ? 'hidden' : ''}`}>
        {messages.length === 0 ? (
          <div className="text-center py-16 text-clawd-text-dim">
            <AgentAvatar agentId={selectedAgent.id} size="2xl" className="mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Hey! I&apos;m {selectedAgent.name}</p>
            <p className="text-sm">{selectedAgent.role}. Ask me anything!</p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {['Check my calendar', 'Draft a tweet', 'What tasks are pending?', 'Check my emails'].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="px-3 py-1.5 text-sm bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : searchQuery && filteredMessages.length === 0 ? (
          <div className="text-center py-16 text-clawd-text-dim">
            <Search size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No results found</p>
            <p className="text-sm">Try a different search term</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Clear search
            </button>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const showAvatar = idx === 0 || filteredMessages[idx - 1]?.role !== msg.role;
            const isLastInGroup = idx === filteredMessages.length - 1 || filteredMessages[idx + 1]?.role !== msg.role;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

      {/* Connection banner */}
      {!isVoiceMode && connectionState === 'disconnected' && (
        <div className="px-4 py-2 bg-error-subtle border-t border-error-border flex items-center justify-center gap-2 text-sm">
          <WifiOff size={14} />
          <span>Disconnected from gateway</span>
          <button onClick={reconnect} className="text-clawd-accent hover:underline">
            Reconnect
          </button>
        </div>
      )}

      {/* Input */}
      <div className={`p-4 border-t border-clawd-border bg-clawd-surface ${isVoiceMode ? 'hidden' : ''}`}>
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors cursor-pointer"
                  onClick={() => setPreviewFile(att)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreviewFile(att); } }}
                  title="Click to preview"
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview attachment ${att.name}`}
                >
                  <Icon size={16} className="text-clawd-accent" />
                  <span className="text-sm truncate max-w-32">{att.name}</span>
                  <span className="text-xs text-clawd-text-dim">
                    {(att.size / 1024).toFixed(1)}KB
                  </span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 hover:bg-clawd-border rounded"
                  >
                    <X size={14} className="text-clawd-text-dim" />
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
              <Sparkles size={14} className="text-clawd-accent" />
              <span className="text-xs text-clawd-text-dim">Suggested replies</span>
              <button
                onClick={() => setSuggestedReplies([])}
                className="ml-auto text-xs text-clawd-text-dim hover:text-clawd-text"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedReplies.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => applySuggestion(suggestion)}
                  className="px-3 py-2 bg-clawd-accent/10 border border-clawd-accent/30 rounded-lg text-sm hover:border-clawd-accent hover:bg-clawd-accent/20 transition-all text-left"
                  title="Click to use this reply"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-3">
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
            disabled={!connected}
            className="p-3 rounded-xl bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-all"
            title="Attach files"
          >
            <Paperclip size={20} />
          </button>

          <button
            onClick={toggleVoice}
            disabled={!connected}
            className={`p-3 rounded-xl transition-all ${
              listening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Suggest Replies button */}
          <button
            onClick={generateSuggestions}
            disabled={!connected || messages.length === 0 || loadingSuggestions}
            className={`p-3 rounded-xl transition-all ${
              loadingSuggestions
                ? 'bg-clawd-accent text-white animate-pulse'
                : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-accent hover:bg-clawd-accent/10'
            }`}
            title="AI suggested replies"
          >
            {loadingSuggestions ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              aria-label={`ChatMessage input for ${selectedAgent.name}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? `ChatMessage ${selectedAgent.name}...` : "Waiting for connection..."}
              disabled={!connected}
              rows={1}
              className="w-full bg-clawd-surface border border-clawd-border rounded-xl px-4 py-3 text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:border-clawd-accent resize-none transition-colors disabled:opacity-50"
            />
          </div>
          
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || !connected}
            className="p-3 bg-clawd-accent text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
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
    </div>
  );
}

// ============================================
// Memoized ChatMessage Item Component
// ============================================

interface MessageItemProps {
  msg: ChatMessage;
  isUser: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  time: string;
  isStarred: boolean;
  selectedAgent: ChatAgent;
  onToggleStar: (msg: ChatMessage, e: React.MouseEvent) => void;
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
          <div className="w-10 h-10 rounded-full bg-clawd-accent flex items-center justify-center text-white text-sm font-semibold ring-2 ring-white/10 dark:ring-white/20">
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
            isUser ? 'text-clawd-accent' : 'text-emerald-600'
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
                    : 'bg-clawd-surface/90 backdrop-blur-sm text-clawd-text-dim hover:text-warning hover:bg-yellow-50 border border-clawd-border'
                }`}
                title={isStarred ? 'Unstar message' : 'Star message'}
              >
                <Star 
                  size={14} 
                  className={isStarred ? 'fill-yellow-500' : ''}
                />
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(msg.content);
                  showToast('Copied to clipboard', 'success');
                }}
                className="p-1.5 rounded-lg bg-clawd-surface/90 backdrop-blur-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border border border-clawd-border transition-all"
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
                ? 'bg-clawd-accent/50 text-white rounded-tr-sm'
                : 'bg-clawd-surface text-clawd-text border border-clawd-border rounded-tl-sm'
            }`}
          >
            {msg.streaming && !msg.content ? (
              <div className="flex items-center gap-2 py-1">
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-white/70' : 'bg-clawd-accent'}`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-white/70' : 'bg-clawd-accent'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isUser ? 'bg-white/70' : 'bg-clawd-accent'}`} style={{ animationDelay: '300ms' }} />
                </div>
                <span className={`text-sm ${isUser ? 'text-white/80' : 'text-clawd-text-dim'}`}>
                  Thinking...
                </span>
              </div>
            ) : msg.role === 'assistant' ? (
              <MarkdownMessage content={msg.content} />
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
            )}
            {msg.streaming && msg.content && (
              <div className={`flex items-center gap-1.5 mt-2 ${isUser ? 'opacity-70' : 'opacity-60'}`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isUser ? 'bg-white' : 'bg-clawd-accent'}`} />
                <span className={`text-xs ${isUser ? 'text-white/90' : 'text-clawd-text-dim'}`}>
                  typing...
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Timestamp and status */}
        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : ''} ${isLastInGroup ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-100`}>
          <span className="text-xs text-clawd-text-dim font-medium">
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

