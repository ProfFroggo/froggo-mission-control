import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Loader2, 
  Trash2, MessageSquare, Monitor, MonitorOff, Video, VideoOff
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { CHAT_AGENTS, ChatAgent } from './AgentSelector';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { synthesizeSpeech, playAudio, speakBrowser, stopSpeaking } from '../lib/googleTTS';
import { getUserFriendlyError } from '../utils/errorMessages';

interface VoiceChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface VoiceChatPanelProps {
  /** When embedded in ChatPanel, the agent to voice-chat with */
  agentId?: string;
  /** Optional session key for an already-spawned chat session */
  sessionKey?: string;
  /** Callback to switch back to text mode (embedded) */
  onSwitchToText?: () => void;
  /** Whether this panel is embedded inside ChatPanel */
  embedded?: boolean;
}

// Storage key per agent for persistent voice history
const storageKey = (agentId: string) => `voice-chat-history:${agentId}`;

function loadHistory(agentId: string): VoiceChatMessage[] {
  try {
    const saved = localStorage.getItem(storageKey(agentId));
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveHistory(agentId: string, msgs: VoiceChatMessage[]) {
  try {
    localStorage.setItem(storageKey(agentId), JSON.stringify(msgs.slice(-100)));
  } catch {}
}

export default function VoiceChatPanel({ agentId, sessionKey: _externalSessionKey, onSwitchToText, embedded }: VoiceChatPanelProps) {
  const { addActivity } = useStore();
  
  // Agent selection
  const initialAgent = agentId 
    ? CHAT_AGENTS.find(a => a.id === agentId) || CHAT_AGENTS[0]
    : CHAT_AGENTS[0];
  const [selectedAgent, setSelectedAgent] = useState<ChatAgent>(initialAgent);
  
  // Call / voice state
  const [callActive, setCallActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  
  // Screen share & video
  const [screenSharing, setScreenSharing] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Audio visualization levels (0-1)
  const [micLevel, setMicLevel] = useState(0);
  const [speakLevel, setSpeakLevel] = useState(0);
  
  // Messages & transcript
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  
  // Connection
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const connected = connectionState === 'connected';
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callActiveRef = useRef(false);
  const listeningRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);
  const currentResponseRef = useRef('');
  const currentMsgIdRef = useRef('');
  const speakAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakAnimRef = useRef<number>(0);
  
  // Sync agentId prop changes (embedded mode)
  useEffect(() => {
    if (agentId) {
      const agent = CHAT_AGENTS.find(a => a.id === agentId);
      if (agent && agent.id !== selectedAgent.id) {
        setSelectedAgent(agent);
      }
    }
  }, [agentId]);
  
  // Gateway connection tracking
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);
  
  // Load persisted history when agent changes
  useEffect(() => {
    setMessages(loadHistory(selectedAgent.id));
  }, [selectedAgent.id]);
  
  // Persist messages
  useEffect(() => {
    if (messages.length > 0) saveHistory(selectedAgent.id, messages);
  }, [messages, selectedAgent.id]);
  
  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partialTranscript]);
  
  // ── Mic level visualization ──
  useEffect(() => {
    if (!listening) { setMicLevel(0); return; }
    
    let running = true;
    
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const ctx = new AudioContext();
        micCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!running) return;
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
          setMicLevel(avg / 255);
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    })();
    
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micCtxRef.current?.close().catch(() => {});
    };
  }, [listening]);
  
  // ── Web Speech API (STT) setup ──
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setPartialTranscript(interim);
      if (final) {
        setPartialTranscript('');
        handleUserSpeech(final.trim());
      }
    };
    
    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        console.warn('[VoiceChat] STT error:', e.error);
      }
    };
    
    recognition.onend = () => {
      // Auto-restart if still in call
      if (callActiveRef.current && listeningRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setListening(false);
        listeningRef.current = false;
      }
    };
    
    recognitionRef.current = recognition;
    return () => { try { recognition.abort(); } catch {} };
  }, []);
  
  // ── Streaming response listeners ──
  useEffect(() => {
    const handleDelta = (data: any) => {
      if (data.delta && currentMsgIdRef.current) {
        currentResponseRef.current += data.delta;
        setMessages(prev => prev.map(m =>
          m.id === currentMsgIdRef.current ? { ...m, content: currentResponseRef.current } : m
        ));
      }
    };
    
    const handleChat = (data: any) => {
      if (!currentMsgIdRef.current) return;
      const content = data.message?.content?.[0]?.text || data.content || '';
      if (content && (data.state === 'final' || content.length > currentResponseRef.current.length)) {
        currentResponseRef.current = content;
        setMessages(prev => prev.map(m =>
          m.id === currentMsgIdRef.current ? { ...m, content } : m
        ));
      }
      if (data.state === 'final') {
        finishResponse();
      }
    };
    
    const handleEnd = () => { if (currentMsgIdRef.current) finishResponse(); };
    
    const handleError = (data: any) => {
      if (currentMsgIdRef.current) {
        const err = getUserFriendlyError(data, { action: 'get voice response' });
        setMessages(prev => prev.map(m =>
          m.id === currentMsgIdRef.current ? { ...m, content: err, role: 'system' } : m
        ));
        setProcessing(false);
        currentMsgIdRef.current = '';
        currentResponseRef.current = '';
        if (callActiveRef.current && autoListen) startListening();
      }
    };
    
    const u1 = gateway.on('chat.delta', handleDelta);
    const u2 = gateway.on('chat.message', handleEnd);
    const u3 = gateway.on('chat.end', handleEnd);
    const u4 = gateway.on('chat.error', handleError);
    const u5 = gateway.on('chat', handleChat);
    
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [autoListen, muted, selectedAgent.id]);
  
  // ── Finish a streaming response ──
  const finishResponse = useCallback(async () => {
    const text = currentResponseRef.current;
    setMessages(prev => prev.map(m =>
      m.id === currentMsgIdRef.current ? { ...m, content: text } : m
    ));
    setProcessing(false);
    currentMsgIdRef.current = '';
    currentResponseRef.current = '';
    
    // Save to DB
    if (text && window.clawdbot?.chat?.saveMessage) {
      window.clawdbot.chat.saveMessage({
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
        sessionKey: selectedAgent.dbSessionKey,
      }).catch(() => {});
    }
    
    // Speak the response
    if (!muted && text) {
      await speakResponseText(text);
    }
    
    // Resume listening
    if (callActiveRef.current && autoListen) {
      startListening();
    }
  }, [muted, autoListen, selectedAgent]);
  
  // ── Speak response with Google TTS ──
  const speakResponseText = async (text: string) => {
    setSpeaking(true);
    try {
      const audioData = await synthesizeSpeech(text, selectedAgent.id);
      if (audioData) {
        await playAudio(audioData, (analyser) => {
          speakAnalyserRef.current = analyser;
          const buf = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!speakAnalyserRef.current) return;
            analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            setSpeakLevel(avg / 255);
            speakAnimRef.current = requestAnimationFrame(tick);
          };
          tick();
        });
      } else {
        await speakBrowser(text);
      }
    } catch {
      await speakBrowser(text);
    }
    setSpeaking(false);
    setSpeakLevel(0);
    speakAnalyserRef.current = null;
    cancelAnimationFrame(speakAnimRef.current);
  };
  
  // ── Start/stop listening ──
  const startListening = () => {
    if (!recognitionRef.current || listeningRef.current) return;
    // Stop any ongoing speech first
    stopSpeaking();
    window.speechSynthesis.cancel();
    try {
      recognitionRef.current.start();
      setListening(true);
      listeningRef.current = true;
    } catch {}
  };
  
  const stopListeningFn = () => {
    listeningRef.current = false;
    setListening(false);
    try { recognitionRef.current?.abort(); } catch {}
  };
  
  // ── Handle user speech → send to agent ──
  const handleUserSpeech = useCallback(async (text: string) => {
    if (!text || !connected) return;
    
    // Pause listening while we process
    stopListeningFn();
    
    // Add user message
    const userMsg: VoiceChatMessage = {
      id: `vc-${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    
    // Placeholder for assistant
    const assistantId = `vc-${Date.now()}-a`;
    currentMsgIdRef.current = assistantId;
    currentResponseRef.current = '';
    
    setMessages(prev => [...prev, userMsg, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }]);
    setProcessing(true);
    
    // Save user message to DB
    if (window.clawdbot?.chat?.saveMessage) {
      window.clawdbot.chat.saveMessage({
        role: 'user',
        content: text,
        timestamp: Date.now(),
        sessionKey: selectedAgent.dbSessionKey,
      }).catch(() => {});
    }
    
    addActivity({ type: 'chat', message: `🎤 You: ${text.slice(0, 50)}...`, timestamp: Date.now() });
    
    try {
      // Set the correct session key for this agent
      gateway.setSessionKey(selectedAgent.sessionKey);
      await gateway.sendChatStreaming(text);
      
      // Timeout fallback
      setTimeout(() => {
        if (currentMsgIdRef.current === assistantId) {
          finishResponse();
        }
      }, 120000);
    } catch (e: any) {
      const err = getUserFriendlyError(e, { action: 'send voice message' });
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: err, role: 'system' } : m
      ));
      setProcessing(false);
      currentMsgIdRef.current = '';
      if (callActiveRef.current && autoListen) startListening();
    }
  }, [connected, selectedAgent, autoListen]);
  
  // ── Call controls ──
  const startCall = () => {
    gateway.setSessionKey(selectedAgent.sessionKey);
    setCallActive(true);
    callActiveRef.current = true;
    addSystemMessage(`Voice call started with ${selectedAgent.name}`);
    startListening();
  };
  
  const endCall = () => {
    stopListeningFn();
    stopSpeaking();
    window.speechSynthesis.cancel();
    setCallActive(false);
    callActiveRef.current = false;
    setSpeaking(false);
    setProcessing(false);
    setMicLevel(0);
    setSpeakLevel(0);
    addSystemMessage('Voice call ended');
  };
  
  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: `vc-${Date.now()}-s`,
      role: 'system',
      content,
      timestamp: Date.now(),
    }]);
  };
  
  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(storageKey(selectedAgent.id));
  };
  
  // ── Screen share ──
  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => {
        screenStreamRef.current = null;
        setScreenSharing(false);
      };
      setScreenSharing(true);
      // Attach to preview (defer to let React render the element)
      requestAnimationFrame(() => {
        if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
      });
    } catch (e) {
      console.warn('[VoiceChat] Screen share failed:', e);
    }
  };

  // ── Camera video ──
  const toggleVideo = async () => {
    if (videoActive) {
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
      setVideoActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoStreamRef.current = stream;
      setVideoActive(true);
      requestAnimationFrame(() => {
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      });
    } catch (e) {
      console.warn('[VoiceChat] Camera failed:', e);
    }
  };

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleAgentSwitch = (agent: ChatAgent) => {
    if (callActive) endCall();
    setSelectedAgent(agent);
  };

  // ── Waveform visualization ──
  const Waveform = ({ level, color, bars = 8, height = 32 }: { level: number; color: string; bars?: number; height?: number }) => (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = Math.max(0.12, level * (0.5 + Math.sin((Date.now() / 100) + i * 0.8) * 0.5));
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: 3,
              height: `${Math.max(15, h * 100)}%`,
              backgroundColor: color,
              opacity: 0.6 + h * 0.4,
            }}
          />
        );
      })}
    </div>
  );

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-clawd-border">
        <div className="flex items-center gap-3">
          {/* Agent picker (standalone mode) or label (embedded) */}
          {embedded ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <AgentAvatar agentId={selectedAgent.id} size="sm" />
                {speaking && (
                  <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-40" />
                )}
              </div>
              <div>
                <span className="text-sm font-medium text-clawd-text">{selectedAgent.name}</span>
                <span className="text-xs text-clawd-text-dim ml-2">Voice</span>
              </div>
            </div>
          ) : (
            <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />
          )}
          
          {/* Call status indicator */}
          {callActive && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">Active</span>
              {speaking && <Waveform level={speakLevel} color="#4ade80" bars={5} height={20} />}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Switch to text (embedded) */}
          {onSwitchToText && (
            <button
              onClick={onSwitchToText}
              className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors"
              title="Switch to text chat"
            >
              <MessageSquare size={16} />
            </button>
          )}
          
          {/* Screen share toggle */}
          <button
            onClick={toggleScreenShare}
            className={`p-2 rounded-lg transition-colors ${
              screenSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={screenSharing ? 'Stop screen share' : 'Share screen'}
          >
            {screenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
          </button>
          
          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-lg transition-colors ${
              videoActive ? 'bg-purple-500/20 text-purple-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={videoActive ? 'Stop camera' : 'Start camera'}
          >
            {videoActive ? <VideoOff size={16} /> : <Video size={16} />}
          </button>
          
          {/* Mute agent voice */}
          <button
            onClick={() => { setMuted(!muted); if (!muted) { stopSpeaking(); window.speechSynthesis.cancel(); } }}
            className={`p-2 rounded-lg transition-colors ${
              muted ? 'bg-red-500/20 text-red-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={muted ? 'Unmute agent voice' : 'Mute agent voice'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          
          {/* Clear history */}
          <button
            onClick={clearHistory}
            className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-red-400 transition-colors"
            title="Clear voice history"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {/* ── Video previews ── */}
      {(screenSharing || videoActive) && (
        <div className="flex gap-2 px-4 pt-3">
          {screenSharing && (
            <div className="relative flex-1 max-h-48 rounded-lg overflow-hidden bg-black border border-clawd-border">
              <video
                ref={screenVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
              />
              <span className="absolute top-1 left-2 text-[10px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded">Screen</span>
            </div>
          )}
          {videoActive && (
            <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-black border border-clawd-border flex-shrink-0">
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
                style={{ transform: 'scaleX(-1)' }}
              />
              <span className="absolute top-1 left-2 text-[10px] bg-purple-500/80 text-white px-1.5 py-0.5 rounded">Camera</span>
            </div>
          )}
        </div>
      )}
      
      {/* ── Message history ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
            <div className="relative mb-4">
              <AgentAvatar agentId={selectedAgent.id} size="2xl" />
            </div>
            <p className="text-lg font-medium text-clawd-text mb-1">
              Voice Chat with {selectedAgent.name}
            </p>
            <p className="text-sm text-center max-w-xs">
              Press the call button to start a voice conversation. 
              {selectedAgent.role && <span className="block mt-1 text-xs opacity-70">{selectedAgent.role}</span>}
            </p>
          </div>
        )}
        
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="relative flex-shrink-0 mt-1">
                <AgentAvatar agentId={selectedAgent.id} size="xs" />
                {/* Speaking animation on latest assistant message */}
                {speaking && msg.id === messages.filter(m => m.role === 'assistant').pop()?.id && (
                  <div className="absolute -inset-1 rounded-full border-2 border-green-400/50 animate-pulse" />
                )}
              </div>
            )}
            
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-clawd-accent text-white'
                : msg.role === 'system'
                ? 'bg-clawd-border/50 text-clawd-text-dim text-xs italic px-3 py-1.5'
                : 'bg-clawd-card text-clawd-text border border-clawd-border'
            }`}>
              {msg.role === 'assistant' && msg.content ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                <p className="text-sm">{msg.content || (msg.role === 'assistant' ? '...' : msg.content)}</p>
              )}
              <div className="text-[10px] opacity-40 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-clawd-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Mic size={12} className="text-clawd-accent" />
              </div>
            )}
          </div>
        ))}
        
        {/* Partial (interim) transcript */}
        {partialTranscript && (
          <div className="flex gap-2 justify-end">
            <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-clawd-accent/40 text-white/70">
              <p className="text-sm italic">{partialTranscript}…</p>
            </div>
          </div>
        )}
        
        {/* Thinking dots */}
        {processing && (
          <div className="flex gap-2">
            <AgentAvatar agentId={selectedAgent.id} size="xs" />
            <div className="bg-clawd-card border border-clawd-border rounded-2xl px-4 py-3 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-clawd-text-dim animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-clawd-text-dim animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-clawd-text-dim animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* ── Call controls ── */}
      <div className="border-t border-clawd-border p-4">
        {/* Status / waveform area */}
        {callActive && (
          <div className="flex items-center justify-center mb-3 h-12">
            {listening && !speaking && !processing && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-indigo-400">Listening…</span>
                <Waveform level={micLevel} color="#818cf8" bars={12} height={40} />
              </div>
            )}
            {speaking && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400">{selectedAgent.name} speaking</span>
                <Waveform level={speakLevel} color="#4ade80" bars={12} height={40} />
              </div>
            )}
            {processing && !speaking && (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-clawd-accent" />
                <span className="text-xs text-clawd-text-dim">Thinking…</span>
              </div>
            )}
            {!listening && !speaking && !processing && (
              <span className="text-xs text-clawd-text-dim">Tap the mic to speak</span>
            )}
          </div>
        )}
        
        {/* Buttons */}
        <div className="flex items-center justify-center gap-4">
          {/* Mic toggle */}
          {callActive && (
            <button
              onClick={() => listening ? stopListeningFn() : startListening()}
              disabled={speaking || processing}
              className={`p-4 rounded-full transition-all ${
                listening
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110'
                  : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'
              } disabled:opacity-40`}
              title={listening ? 'Pause microphone' : 'Resume microphone'}
            >
              {listening ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
          )}
          
          {/* Call button */}
          <button
            onClick={() => callActive ? endCall() : startCall()}
            disabled={!connected}
            className={`p-5 rounded-full transition-all ${
              callActive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={callActive ? 'End call' : 'Start voice call'}
          >
            {callActive ? <PhoneOff size={26} /> : <Phone size={26} />}
          </button>
          
          {/* Screen share during call */}
          {callActive && (
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full transition-all ${
                screenSharing
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'
              }`}
              title={screenSharing ? 'Stop screen share' : 'Share screen'}
            >
              {screenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
            </button>
          )}
          
          {/* Video during call */}
          {callActive && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all ${
                videoActive
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'
              }`}
              title={videoActive ? 'Stop camera' : 'Start camera'}
            >
              {videoActive ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
          
          {/* Auto-listen toggle */}
          {callActive && (
            <button
              onClick={() => setAutoListen(!autoListen)}
              className={`px-3 py-2 rounded-full text-xs font-medium transition-all ${
                autoListen
                  ? 'bg-clawd-accent/20 text-clawd-accent border border-clawd-accent/30'
                  : 'bg-clawd-border text-clawd-text-dim'
              }`}
              title={autoListen ? 'Auto-listen: ON — mic resumes after agent speaks' : 'Push-to-talk mode'}
            >
              {autoListen ? 'AUTO' : 'PTT'}
            </button>
          )}
        </div>
        
        {!connected && (
          <p className="text-center text-xs text-red-400 mt-2">Not connected to gateway</p>
        )}
      </div>
    </div>
  );
}
