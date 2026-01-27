import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Loader2, Trash2, RefreshCw, WifiOff } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentResponseRef = useRef<string>('');
  const currentMsgIdRef = useRef<string>('');

  const connected = connectionState === 'connected';

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

  // Load chat history when connected
  // Now using webchat-specific session key, so history should be dashboard-only
  useEffect(() => {
    if (connected && !historyLoaded) {
      loadHistory();
      setHistoryLoaded(true);
    }
  }, [connected, historyLoaded]);

  const loadHistory = async () => {
    try {
      console.log('[Chat] Loading history...');
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
        
        setMessages(history);
        console.log('[Chat] Loaded', history.length, 'messages');
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
        currentResponseRef.current = content;
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, content } 
            : m
        ));
      }

      // Check if final
      if (data.state === 'final') {
        console.log('[Chat] Got final state, clearing loading. Content length:', currentResponseRef.current.length);
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, streaming: false } 
            : m
        ));
        
        if (speakResponses && currentResponseRef.current) {
          speak(currentResponseRef.current);
        }
        
        setLoading(false);
        currentMsgIdRef.current = '';
        currentResponseRef.current = '';
      }
    };

    const handleError = (data: any) => {
      console.error('[Chat] Error:', data);
      if (currentMsgIdRef.current) {
        setMessages(prev => prev.map(m => 
          m.id === currentMsgIdRef.current 
            ? { ...m, content: `Error: ${data.message || data.error || 'Something went wrong'}`, streaming: false } 
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
    if (!text || !connected || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

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
      await gateway.sendChatStreaming(text);
      
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
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...m, content: `Error: ${e.message}`, streaming: false } 
          : m
      ));
      setLoading(false);
      currentMsgIdRef.current = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    window.speechSynthesis.cancel();
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
    <div className="h-full flex flex-col">
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
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-clawd-accent text-white rounded-br-md'
                    : 'bg-clawd-surface border border-clawd-border rounded-bl-md'
                }`}
              >
                {msg.streaming && !msg.content ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                ) : msg.role === 'assistant' ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
                {msg.streaming && msg.content && (
                  <Loader2 size={12} className="animate-spin mt-2 opacity-50" />
                )}
              </div>
            </div>
          ))
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
        <div className="flex items-end gap-3">
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
            disabled={!input.trim() || !connected || loading}
            className="p-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
