import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Trash2, RefreshCw, WifiOff, Paperclip, X, FileText, Image, File } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { showToast } from './Toast';
import { getUserFriendlyError, getErrorTitle } from '../utils/errorMessages';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakResponses, setSpeakResponses] = useState(false);
  const [listening, setListening] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentResponseRef = useRef<string>('');
  const currentMsgIdRef = useRef<string>('');

  const connected = connectionState === 'connected';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages from database on mount - this is the source of truth
  useEffect(() => {
    const loadFromDb = async () => {
      console.log('[Chat] Loading from froggo.db...');
      if (window.clawdbot?.chat?.loadMessages) {
        const result = await window.clawdbot.chat.loadMessages(50);
        console.log('[Chat] DB load result:', result.success, result.messages?.length, 'messages');
        if (result.success && result.messages?.length > 0) {
          setMessages(result.messages);
          setHistoryLoaded(true); // Mark as loaded so we don't overwrite with gateway history
        }
      }
    };
    loadFromDb();
  }, []);

  // Save message to database helper
  const saveMessageToDb = async (role: string, content: string) => {
    if (window.clawdbot?.chat?.saveMessage) {
      await window.clawdbot.chat.saveMessage({ role, content, timestamp: Date.now() });
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
            timestamp: Date.now() 
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
  }, [speakResponses]);

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

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || !connected || loading) return;

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
    window.speechSynthesis.cancel();
    // Also clear from database
    if (window.clawdbot?.chat?.clearMessages) {
      await window.clawdbot.chat.clearMessages();
      console.log('[Chat] Cleared messages from DB');
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-clawd-accent/20 flex items-center justify-center text-xl">
            🐸
          </div>
          <div>
            <h2 className="font-semibold">Froggo</h2>
            <div className="flex items-center gap-2 text-xs">
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
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSpeakResponses(!speakResponses)}
            className={`p-2 rounded-lg transition-colors ${
              speakResponses ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim'
            }`}
            title={speakResponses ? 'Voice on' : 'Voice off'}
          >
            {speakResponses ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors"
            title="Clear chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-clawd-text-dim">
            <div className="text-6xl mb-4">🐸</div>
            <p className="text-lg font-medium mb-2">Hey! I'm Froggo</p>
            <p className="text-sm">Your AI assistant. Ask me anything!</p>
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
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const showAvatar = idx === 0 || messages[idx - 1]?.role !== msg.role;
            const isLastInGroup = idx === messages.length - 1 || messages[idx + 1]?.role !== msg.role;
            const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${!showAvatar ? 'mt-1' : 'mt-4'}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 ${!showAvatar ? 'invisible' : ''}`}>
                  {isUser ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-clawd-accent to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                      K
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-lg">
                      🐸
                    </div>
                  )}
                </div>

                {/* Message bubble */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <div
                    className={`relative px-4 py-2.5 ${
                      isUser
                        ? 'bg-gradient-to-br from-clawd-accent to-purple-500 text-white'
                        : 'bg-clawd-surface/80 backdrop-blur-sm border border-clawd-border/50'
                    } ${
                      isUser
                        ? showAvatar ? 'rounded-2xl rounded-tr-md' : isLastInGroup ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl'
                        : showAvatar ? 'rounded-2xl rounded-tl-md' : isLastInGroup ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl'
                    } shadow-sm`}
                  >
                    {msg.streaming && !msg.content ? (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-clawd-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-clawd-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-clawd-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-clawd-text-dim">Thinking...</span>
                      </div>
                    ) : msg.role === 'assistant' ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {msg.streaming && msg.content && (
                      <div className="flex items-center gap-1 mt-2 opacity-60">
                        <div className="w-1.5 h-1.5 bg-clawd-accent rounded-full animate-pulse" />
                        <span className="text-xs">typing...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  {isLastInGroup && (
                    <span className={`text-[10px] text-clawd-text-dim mt-1 ${isUser ? 'mr-1' : 'ml-1'}`}>
                      {time}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Connection banner */}
      {connectionState === 'disconnected' && (
        <div className="px-4 py-2 bg-red-500/20 border-t border-red-500/30 flex items-center justify-center gap-2 text-sm">
          <WifiOff size={14} />
          <span>Disconnected from gateway</span>
          <button onClick={reconnect} className="text-clawd-accent hover:underline">
            Reconnect
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-clawd-border bg-clawd-surface">
        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((att) => {
              const Icon = getFileIcon(att.type);
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg"
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
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? "Message Froggo..." : "Waiting for connection..."}
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
    </div>
  );
}
