import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Trash2, RefreshCw, WifiOff, Paperclip, X, FileText, Image, File, Search, Sparkles, Star, Copy, Users, MessageSquarePlus, Phone, PhoneOff } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { CHAT_AGENTS, ChatAgent } from './AgentSelector';
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

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

export default function ChatPanel() {
  const { addActivity } = useStore();
  const { rooms, activeRoomId, setActiveRoom, createRoom } = useChatRoomStore();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent>(CHAT_AGENTS[0]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  
  // Cache messages per agent so switching is instant
  const messageCacheRef = useRef<Map<string, Message[]>>(new Map());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentResponseRef = useRef<string>('');
  const currentMsgIdRef = useRef<string>('');

  const connected = connectionState === 'connected';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agent switching handler
  const handleAgentSwitch = useCallback(async (agent: ChatAgent) => {
    if (agent.id === selectedAgent.id) return;
    
    // Save current messages to cache
    messageCacheRef.current.set(selectedAgent.id, messages);
    
    // Update gateway session key
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
      const result = await window.clawdbot.chat.loadMessages(50, agent.dbSessionKey);
      if (result?.success && result.messages?.length > 0) {
        setMessages(result.messages);
        messageCacheRef.current.set(agent.id, result.messages);
      }
    }
  }, [selectedAgent, messages]);

  // Load starred message IDs
  useEffect(() => {
    const loadStarredIds = async () => {
      if (window.clawdbot?.starred?.list) {
        const result = await window.clawdbot.starred.list({ sessionKey: selectedAgent.dbSessionKey, limit: 1000 });
        if (result?.success && result.starred) {
          const ids = new Set(result.starred.map((s: any) => s.message_id.toString()));
          setStarredMessageIds(ids);
        }
      }
    };
    loadStarredIds();
  }, [messages.length, selectedAgent.id]);

  // Toggle star on a message
  const handleToggleStar = async (msg: Message, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.clawdbot?.starred) {
      showToast('Starred messages not available', 'error');
      return;
    }

    const messageId = parseInt(msg.id);
    const isStarred = starredMessageIds.has(msg.id);

    try {
      if (isStarred) {
        // Unstar
        const result = await window.clawdbot.starred.unstar(messageId);
        if (result?.success) {
          setStarredMessageIds(prev => {
            const next = new Set(prev);
            next.delete(msg.id);
            return next;
          });
          showToast('Message unstarred', 'success');
        } else {
          showToast('Failed to unstar message', 'error');
        }
      } else {
        // Star
        const result = await window.clawdbot.starred.star(messageId);
        if (result?.success) {
          setStarredMessageIds(prev => new Set(prev).add(msg.id));
          showToast('Message starred', 'success');
        } else {
          showToast('Failed to star message', 'error');
        }
      }
    } catch (error: any) {
      console.error('Toggle star error:', error);
      showToast('Error toggling star', 'error');
    }
  };

  // Load messages from database on mount (and when agent changes) - this is the source of truth
  useEffect(() => {
    const loadFromDb = async () => {
      console.log('[Chat] Loading from froggo.db for agent:', selectedAgent.id);
      // Mark as loaded IMMEDIATELY to prevent gateway history from loading while DB query runs
      setHistoryLoaded(true);
      
      if (window.clawdbot?.chat?.loadMessages) {
        const result = await window.clawdbot.chat.loadMessages(50, selectedAgent.dbSessionKey);
        console.log('[Chat] DB load result:', result.success, result.messages?.length, 'messages');
        if (result.success && result.messages?.length > 0) {
          setMessages(result.messages);
          messageCacheRef.current.set(selectedAgent.id, result.messages);
          console.log('[Chat] Loaded', result.messages.length, 'messages from DB');
        } else {
          console.log('[Chat] No messages in DB');
        }
      }
    };
    loadFromDb();
  }, []); // Only on mount - agent switching handled by handleAgentSwitch

  // Save message to database helper
  const saveMessageToDb = async (role: string, content: string) => {
    if (window.clawdbot?.chat?.saveMessage) {
      try {
        const result = await window.clawdbot.chat.saveMessage({ role, content, timestamp: Date.now(), sessionKey: selectedAgent.dbSessionKey });
        if (result?.success) {
          console.log(`[Chat] ${role} message saved to DB`);
        } else {
          console.error(`[Chat] Failed to save ${role} message:`, result);
        }
      } catch (err) {
        console.error(`[Chat] Error saving ${role} message:`, err);
      }
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
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.toLowerCase();
    return messages.filter(msg => 
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

  // Load chat history when connected (only if DB didn't have messages)
  // DB is the source of truth - gateway history is fallback only
  useEffect(() => {
    if (connected && !historyLoaded) {
      loadHistory();
    }
  }, [connected, historyLoaded]);

  const loadHistory = async () => {
    // If we already have messages (from DB), don't overwrite with gateway history
    if (messages.length > 0) {
      console.log('[Chat] Already have', messages.length, 'messages from DB, skipping gateway history');
      setHistoryLoaded(true);
      return;
    }
    
    try {
      console.log('[Chat] No DB messages, trying gateway history...');
      const res = await gateway.getChatHistory(30);
      if (res?.messages && Array.isArray(res.messages)) {
        const history: Message[] = res.messages
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
          console.log('[Chat] Loaded', history.length, 'messages from gateway');
        }
      }
      setHistoryLoaded(true);
    } catch (e) {
      console.error('[Chat] Failed to load history:', e);
      setHistoryLoaded(true); // Don't retry
    }
  };

  // Setup streaming listeners
  useEffect(() => {
    const handleDelta = (data: any) => {
      if (data.delta && currentMsgIdRef.current) {
        currentResponseRef.current += data.delta;
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, content: currentResponseRef.current } 
            : m
        ));
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
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, streaming: false } 
            : m
        ));
        
        // Save assistant message to database
        if (finalContent && window.clawdbot?.chat?.saveMessage) {
          window.clawdbot.chat.saveMessage({ 
            role: 'assistant', 
            content: finalContent, 
            timestamp: Date.now(),
            sessionKey: selectedAgent.dbSessionKey,
          }).then((result: any) => {
            if (result?.success) {
              console.log('[Chat] Assistant message saved to DB (handleEnd)');
            }
          }).catch((err: any) => {
            console.error('[Chat] Error saving assistant message (handleEnd):', err);
          });
        }
        
        if (speakResponses && finalContent) {
          speak(finalContent);
        }
        
        // Check for @Brain: routing - forward to main session
        const brainMatch = finalContent.match(/@Brain:\s*([\s\S]*?)(?:$|(?=\n\n))/i);
        if (brainMatch) {
          const brainMessage = brainMatch[1].trim();
          console.log('[Chat] Routing to Brain:', brainMessage.slice(0, 100));
          // Send to main session via gateway WebSocket
          gateway.sendToMain(`[From Chat Agent]\n${brainMessage}`)
            .then(() => console.log('[Chat] Successfully routed to Brain'))
            .catch((err: any) => console.error('[Chat] Brain routing error:', err));
        }
        
        setLoading(false);
        currentMsgIdRef.current = '';
        currentResponseRef.current = '';
      }
    };

    const handleChatEvent = (data: any) => {
      // Handle generic 'chat' event with state field
      console.log('[Chat] handleChatEvent:', { state: data.state, hasMsgId: !!currentMsgIdRef.current, content: data.message?.content?.[0]?.text?.slice(0, 50) });
      
      if (!currentMsgIdRef.current) {
        console.log('[Chat] No current message ID, ignoring chat event');
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
        console.log('[Chat] Got final state, clearing loading. Content length:', currentResponseRef.current.length);
        const finalContent = currentResponseRef.current;
        
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, streaming: false } 
            : m
        ));
        
        // Save assistant message to database
        if (finalContent && window.clawdbot?.chat?.saveMessage) {
          window.clawdbot.chat.saveMessage({ 
            role: 'assistant', 
            content: finalContent, 
            timestamp: Date.now(),
            sessionKey: selectedAgent.dbSessionKey,
          }).then((result: any) => {
            if (result?.success) {
              console.log('[Chat] Assistant message saved to DB');
            } else {
              console.error('[Chat] Failed to save assistant message:', result?.error);
            }
          }).catch((err: any) => {
            console.error('[Chat] Error saving assistant message:', err);
          });
        }
        
        if (speakResponses && finalContent) {
          speak(finalContent);
        }
        
        // Check for @Brain: routing - forward to main session (Brain/Froggo)
        const brainMatch = finalContent.match(/@Brain:\s*([\s\S]*?)(?:$|(?=\n\n))/i);
        if (brainMatch) {
          const brainMessage = brainMatch[1].trim();
          console.log('[Chat] Routing to Brain:', brainMessage.slice(0, 100));
          // Send to main session via gateway WebSocket (sends to Discord #get_shit_done)
          gateway.sendToMain(`[From Chat Agent]\n${brainMessage}`)
            .then(() => {
              console.log('[Chat] Successfully routed to Brain');
              showToast('success', 'Routed to Brain', 'Message sent to main session');
            })
            .catch((err: any) => {
              console.error('[Chat] Brain routing error:', err);
              showToast('error', 'Brain routing failed', err.message);
            });
        }
        
        setLoading(false);
        currentMsgIdRef.current = '';
        currentResponseRef.current = '';
      }
    };

    const handleError = (data: any) => {
      console.error('[Chat] Error:', data);
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
        currentMsgIdRef.current = '';
      }
    };

    const unsub1 = gateway.on('chat.delta', handleDelta);
    const unsub2 = gateway.on('chat.message', handleMessage);
    const unsub3 = gateway.on('chat.end', handleEnd);
    const unsub4 = gateway.on('chat.error', handleError);
    const unsub5 = gateway.on('chat', handleChatEvent);

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [speakResponses, selectedAgent.dbSessionKey]);

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

  const speak = useCallback((text: string) => {
    if (!text) return;
    
    // Skip short filler acks - annoying when spoken
    const skipPhrases = /^(on it|got it|sure|ok|okay|yes|yep|done|noted|ack|👍|✅|🐸)\s*[.!]?\s*$/i;
    if (skipPhrases.test(text.trim())) {
      console.log('[TTS] Skipping filler ack:', text);
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

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const generateSuggestions = async () => {
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
        const result = await window.clawdbot.chat.suggestReplies(context);
        
        if (result.success && result.suggestions?.length > 0) {
          setSuggestedReplies(result.suggestions);
          showToast('success', 'Suggestions ready', `${result.suggestions.length} options generated`);
        } else {
          showToast('error', 'No suggestions', result.error || 'Could not generate suggestions');
        }
      } else {
        showToast('error', 'Not available', 'Suggestion feature not available');
      }
    } catch (error: any) {
      console.error('[Chat] Suggestion error:', error);
      showToast('error', 'Failed to generate', error.message || 'Unknown error');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const useSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setSuggestedReplies([]);
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || !connected || loading) return;
    
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
          } catch (e) {
            fileContents.push(`\n\n[Attached text file: ${att.name} - could not decode]`);
          }
        } else if (att.type.startsWith('image/')) {
          // Image: Save to temp file and tell AI to use vision
          try {
            const tempPath = `/tmp/dashboard-upload-${Date.now()}-${att.name}`;
            await (window as any).clawdbot?.fs?.writeBase64(tempPath, att.dataUrl.split(',')[1]);
            savedFiles.push(tempPath);
            fileContents.push(`\n\n📷 IMAGE ATTACHED: ${att.name}\nSaved to: ${tempPath}\nPlease use the image tool or Read tool to analyze this image.`);
          } catch (e) {
            // Fallback: include base64 hint
            fileContents.push(`\n\n📷 IMAGE: ${att.name} (${(att.size / 1024).toFixed(1)}KB)\n[Image data included - use vision to analyze]`);
          }
        } else if (att.type === 'application/pdf') {
          // PDF: Save and suggest extraction
          try {
            const tempPath = `/tmp/dashboard-upload-${Date.now()}-${att.name}`;
            await (window as any).clawdbot?.fs?.writeBase64(tempPath, att.dataUrl.split(',')[1]);
            savedFiles.push(tempPath);
            fileContents.push(`\n\n📄 PDF ATTACHED: ${att.name}\nSaved to: ${tempPath}\nPlease extract text or analyze this PDF.`);
          } catch (e) {
            fileContents.push(`\n\n[PDF attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB)]`);
          }
        } else if (att.type.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac'].some(ext => att.name.toLowerCase().endsWith(ext))) {
          // Audio file: Transcribe with Whisper
          try {
            showToast('info', 'Transcribing audio...', att.name);
            const base64 = att.dataUrl.split(',')[1];
            const audioBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
            const result = await (window as any).clawdbot?.whisper?.transcribe(audioBuffer);
            
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
          // Other files: include metadata
          fileContents.push(`\n\n📎 Attached: ${att.name} (${(att.size / 1024).toFixed(1)}KB, type: ${att.type})`);
        }
      }
    }
    
    if (fileContents.length > 0) {
      content = text + fileContents.join('');
    }

    const userMsg: Message = {
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
      await gateway.sendChatStreaming(content);
      
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
          currentMsgIdRef.current = '';
        }
      }, 120000);
      
    } catch (e: any) {
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
      currentMsgIdRef.current = '';
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
    setMessages([]);
    messageCacheRef.current.delete(selectedAgent.id);
    window.speechSynthesis.cancel();
    // Also clear from database
    if (window.clawdbot?.chat?.clearMessages) {
      await window.clawdbot.chat.clearMessages(selectedAgent.dbSessionKey);
      console.log('[Chat] Cleared messages from DB for', selectedAgent.id);
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
      case 'connected': return 'bg-green-400';
      case 'connecting':
      case 'authenticating': return 'bg-yellow-400 animate-pulse';
      case 'disconnected': return 'bg-red-400';
    }
  };

  const handleCreateRoom = (name: string, agents: string[]) => {
    createRoom(name, agents);
    setShowRoomList(false);
    showToast(`Room "${name}" created!`, 'success');
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

  return (
    <div 
      className={`h-full flex flex-col relative ${isDragging ? 'ring-2 ring-clawd-accent ring-inset' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
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
        <div className="flex items-center gap-1">
          <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />
          <div className="flex items-center gap-2 text-xs ml-2">
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
              isVoiceMode ? 'bg-purple-500/20 text-purple-400' : 'bg-clawd-border text-clawd-text-dim hover:text-purple-400'
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
            className="p-2 rounded-lg bg-gradient-to-r from-clawd-accent to-purple-500 text-white hover:opacity-90 transition-opacity"
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full bg-clawd-surface border border-clawd-border rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-clawd-accent"
              autoFocus
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
            <p className="text-lg font-medium mb-2">Hey! I'm {selectedAgent.name}</p>
            <p className="text-sm">{selectedAgent.role}. Ask me anything!</p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {['Check my calendar', 'Draft a tweet', 'What tasks are pending?', 'Check my emails'].map((q, i) => (
                <button
                  key={i}
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
            const isStarred = starredMessageIds.has(msg.id);
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${
                  showAvatar ? 'mt-6' : 'mt-2'
                }`}
              >
                {/* Avatar column - consistent width */}
                <div className={`flex-shrink-0 w-10 ${!showAvatar ? 'invisible' : ''}`}>
                  {isUser ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-clawd-accent to-purple-500 flex items-center justify-center text-white text-sm font-semibold shadow-md ring-2 ring-white/20">
                      K
                    </div>
                  ) : (
                    <AgentAvatar agentId={selectedAgent.id} size="lg" ring />
                  )}
                </div>

                {/* Message content column */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] sm:max-w-[70%] lg:max-w-[65%] min-w-[120px]`}>
                  {/* Sender name (only on first message in group) */}
                  {showAvatar && (
                    <div className={`text-xs font-medium mb-1 px-1 ${
                      isUser ? 'text-clawd-accent' : 'text-emerald-600'
                    }`}>
                      {isUser ? 'You' : selectedAgent.name}
                    </div>
                  )}

                  {/* Message bubble with actions */}
                  <div className="relative group w-full">
                    {/* Message actions bar (appears on hover) */}
                    {!msg.streaming && (
                      <div className={`absolute ${isUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} top-0 flex items-center gap-1 ${isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-all duration-100`}>
                        <button
                          onClick={(e) => handleToggleStar(msg, e)}
                          className={`p-1.5 rounded-lg transition-all duration-100 ${
                            isStarred
                              ? 'bg-yellow-100 text-yellow-600 shadow-sm'
                              : 'bg-clawd-surface/90 backdrop-blur-sm text-clawd-text-dim hover:text-yellow-600 hover:bg-yellow-50 border border-clawd-border'
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

                    {/* Message bubble */}
                    <div
                      className={`px-4 py-3 transition-all duration-150 ${
                        isUser
                          ? 'bg-gradient-to-br from-clawd-accent to-purple-500 text-white shadow-md'
                          : 'bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border/60 shadow-sm hover:shadow-md'
                      } ${
                        isUser
                          ? showAvatar 
                            ? 'rounded-2xl rounded-tr-md' 
                            : isLastInGroup 
                              ? 'rounded-2xl rounded-tr-md' 
                              : 'rounded-2xl rounded-tr-lg'
                          : showAvatar 
                            ? 'rounded-2xl rounded-tl-md' 
                            : isLastInGroup 
                              ? 'rounded-2xl rounded-tl-md' 
                              : 'rounded-2xl rounded-tl-lg'
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
                      <Star size={10} className="text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Connection banner */}
      {!isVoiceMode && connectionState === 'disconnected' && (
        <div className="px-4 py-2 bg-red-500/20 border-t border-red-500/30 flex items-center justify-center gap-2 text-sm">
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
                  title="Click to preview"
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
                  onClick={() => useSuggestion(suggestion)}
                  className="px-3 py-2 bg-gradient-to-r from-clawd-accent/10 to-purple-500/10 border border-clawd-accent/30 rounded-lg text-sm hover:border-clawd-accent hover:bg-clawd-accent/20 transition-all text-left"
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? `Message ${selectedAgent.name}...` : "Waiting for connection..."}
              disabled={!connected || loading}
              rows={1}
              className="w-full bg-clawd-bg border border-clawd-border rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:border-clawd-accent disabled:opacity-50"
            />
          </div>
          
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && attachments.length === 0) || !connected || loading}
            className="p-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
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
