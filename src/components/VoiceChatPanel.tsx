import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Loader2, 
  Trash2, MessageSquare, Monitor, MonitorOff, Video, VideoOff,
  Zap, ZapOff
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { CHAT_AGENTS, ChatAgent } from './AgentSelector';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { geminiLive, GeminiVoice } from '../lib/geminiLiveService';
import { getUserFriendlyError } from '../utils/errorMessages';
import { loadAgentContext, buildContextualMessage, invalidateAgentContext, AgentContext } from '../lib/agentContext';

// Voice mapping per agent for personality
const AGENT_VOICES: Record<string, GeminiVoice> = {
  froggo: 'Puck',
  coder: 'Fenrir',
  researcher: 'Charon',
  writer: 'Aoede',
  chief: 'Orus',
  hr: 'Kore',
  clara: 'Leda',
  social_media_manager: 'Zephyr',
  designer: 'Perseus',
};

interface VoiceChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface VoiceChatPanelProps {
  agentId?: string;
  sessionKey?: string;
  onSwitchToText?: () => void;
  embedded?: boolean;
}

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
  const [geminiConnected, setGeminiConnected] = useState(false);
  const [geminiMode, setGeminiMode] = useState(true); // true = Gemini Live, false = fallback Web Speech
  
  // Screen share & video
  const [screenSharing, setScreenSharing] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callActiveRef = useRef(false);
  const apiKeyRef = useRef<string | null>(null);
  const currentResponseRef = useRef('');
  const currentMsgIdRef = useRef('');
  const pendingUserTextRef = useRef('');
  
  // Agent context
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const agentContextRef = useRef<AgentContext | null>(null);
  
  // Web Speech fallback refs
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  
  // Sync agentId prop changes
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
  
  // Load API key for Gemini
  useEffect(() => {
    (async () => {
      try {
        // Try env var first
        if ((window as any).clawdbot?.exec?.run) {
          const r = await (window as any).clawdbot.exec.run('echo $GEMINI_API_KEY 2>/dev/null || echo $GOOGLE_API_KEY 2>/dev/null');
          if (r.success && r.stdout.trim()) {
            apiKeyRef.current = r.stdout.trim().split('\n')[0];
            return;
          }
        }
        // Try settings
        if ((window as any).clawdbot?.settings?.get) {
          const r = await (window as any).clawdbot.settings.get();
          if (r?.success && (r.settings?.geminiApiKey || r.settings?.googleApiKey)) {
            apiKeyRef.current = r.settings.geminiApiKey || r.settings.googleApiKey;
          }
        }
      } catch {}
    })();
  }, []);
  
  // Load agent context when agent changes
  useEffect(() => {
    let cancelled = false;
    setContextLoading(true);
    loadAgentContext(selectedAgent.id).then(ctx => {
      if (!cancelled) {
        setAgentContext(ctx);
        agentContextRef.current = ctx;
        setContextLoading(false);
        console.log(`[VoiceChat] Agent context loaded for ${selectedAgent.id}:`, {
          tasks: ctx.tasks.length,
          sessions: ctx.sessions.length,
          hasPersonality: !!ctx.personality,
        });
      }
    }).catch(() => {
      if (!cancelled) setContextLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedAgent.id]);
  
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
  
  // ── Gemini Live event listeners ──
  useEffect(() => {
    if (!geminiMode) return;
    
    const unsubs = [
      geminiLive.on('connected', () => {
        setGeminiConnected(true);
        addSystemMessage('🔗 Gemini Live connected — voice engine ready');
      }),
      geminiLive.on('disconnected', () => {
        setGeminiConnected(false);
        setListening(false);
        setSpeaking(false);
      }),
      geminiLive.on('listening-start', () => setListening(true)),
      geminiLive.on('listening-end', () => setListening(false)),
      geminiLive.on('speaking-start', () => {
        setSpeaking(true);
        setSpeakLevel(0.5);
      }),
      geminiLive.on('speaking-end', () => {
        setSpeaking(false);
        setSpeakLevel(0);
      }),
      geminiLive.on('audio-level', ({ level }: { level: number }) => setMicLevel(level)),
      geminiLive.on('model-audio-level', ({ level }: { level: number }) => setSpeakLevel(level)),
      geminiLive.on('error', ({ message }: { message: string }) => {
        console.error('[VoiceChat] Gemini error:', message);
        addSystemMessage(`⚠️ ${message}`);
      }),
      // Transcript from Gemini Live - this is the user's speech transcribed
      geminiLive.on('transcript', ({ text, role }: { text: string; role: string }) => {
        if (role === 'user') {
          // User speech transcribed - but Gemini Live doesn't emit user transcripts
          // We handle this via the model's relay behavior
        } else if (role === 'model') {
          // Model response - this is Gemini relaying the user's speech as text
          // Check if it looks like a transcription relay
          handleGeminiTranscript(text);
        }
      }),
    ];
    
    return () => unsubs.forEach(u => u());
  }, [geminiMode, selectedAgent]);
  
  // ── Handle transcript from Gemini (acting as relay) ──
  // Gemini is instructed to transcribe user speech. When it outputs text,
  // we check if it's a relay of user speech or a spoken agent response.
  const handleGeminiTranscript = useCallback((text: string) => {
    if (!text?.trim()) return;
    
    // If we're currently processing an agent response (we sent text to speak),
    // this transcript is Gemini speaking the agent's response - ignore it
    if (currentMsgIdRef.current && currentResponseRef.current) return;
    
    // This is user speech transcribed by Gemini
    // Clean up any relay prefixes Gemini might add
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^(User said|Transcription|The user said)[:\s]*/i, '');
    if (cleaned) {
      setPartialTranscript('');
      handleUserSpeech(cleaned);
    }
  }, []);
  
  // ── Streaming response listeners from gateway ──
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
        // Resume listening
        if (callActiveRef.current && geminiMode && geminiConnected) {
          geminiLive.startMic();
        }
      }
    };
    
    const u1 = gateway.on('chat.delta', handleDelta);
    const u2 = gateway.on('chat.message', handleEnd);
    const u3 = gateway.on('chat.end', handleEnd);
    const u4 = gateway.on('chat.error', handleError);
    const u5 = gateway.on('chat', handleChat);
    
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [geminiMode, geminiConnected, muted, selectedAgent.id]);
  
  // ── Finish a streaming response → speak via Gemini Live ──
  const finishResponse = useCallback(async () => {
    const text = currentResponseRef.current;
    setMessages(prev => prev.map(m =>
      m.id === currentMsgIdRef.current ? { ...m, content: text } : m
    ));
    setProcessing(false);
    const msgId = currentMsgIdRef.current;
    currentMsgIdRef.current = '';
    currentResponseRef.current = '';
    
    // Invalidate context cache if response suggests mutations (task created, status changed, etc.)
    if (text && /(?:task[-_]|created|spawned|updated|assigned|completed|done)/i.test(text)) {
      invalidateAgentContext(selectedAgent.id);
    }
    
    // Save to DB
    if (text && (window as any).clawdbot?.chat?.saveMessage) {
      (window as any).clawdbot.chat.saveMessage({
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
        sessionKey: selectedAgent.dbSessionKey,
      }).catch(() => {});
    }
    
    // Speak the response via Gemini Live TTS
    if (!muted && text && callActiveRef.current) {
      if (geminiMode && geminiLive.connected) {
        // Stop mic while agent speaks to prevent feedback
        geminiLive.stopMic();
        // Send agent response to Gemini Live for TTS
        // Strip markdown for cleaner speech
        const spokenText = text
          .replace(/```[\s\S]*?```/g, '(code block)')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/#{1,6}\s+/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/\n{2,}/g, '. ')
          .trim();
        
        await geminiLive.sendText(`[SPEAK] ${spokenText}`);
        
        // Wait for Gemini to finish speaking, then resume mic
        const waitForSpeechEnd = () => new Promise<void>(resolve => {
          if (!geminiLive.speaking) {
            // Give a small buffer for audio to complete
            setTimeout(resolve, 500);
            return;
          }
          const unsub = geminiLive.on('speaking-end', () => {
            unsub();
            setTimeout(resolve, 300);
          });
          // Timeout safety
          setTimeout(() => { unsub(); resolve(); }, 30000);
        });
        
        await waitForSpeechEnd();
        
        // Resume listening
        if (callActiveRef.current) {
          geminiLive.startMic();
        }
      } else {
        // Fallback: browser speech synthesis
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          setSpeaking(false);
          if (callActiveRef.current) startListeningFallback();
        };
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }
    } else {
      // Not speaking - just resume listening
      if (callActiveRef.current) {
        if (geminiMode && geminiLive.connected) {
          geminiLive.startMic();
        } else {
          startListeningFallback();
        }
      }
    }
  }, [muted, geminiMode, selectedAgent]);
  
  // ── Handle user speech → send to real agent via gateway ──
  const handleUserSpeech = useCallback(async (text: string) => {
    if (!text || !connected) return;
    
    // Pause mic while processing
    if (geminiMode && geminiLive.connected) {
      geminiLive.stopMic();
    }
    
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
    if ((window as any).clawdbot?.chat?.saveMessage) {
      (window as any).clawdbot.chat.saveMessage({
        role: 'user',
        content: text,
        timestamp: Date.now(),
        sessionKey: selectedAgent.dbSessionKey,
      }).catch(() => {});
    }
    
    addActivity({ type: 'chat', message: `🎤 You → ${selectedAgent.name}: ${text.slice(0, 50)}...`, timestamp: Date.now() });
    
    try {
      // Route to the real agent via gateway with full context
      gateway.setSessionKey(selectedAgent.sessionKey);
      
      // Build context-enriched message
      const ctx = agentContextRef.current;
      const enrichedMessage = ctx 
        ? buildContextualMessage(text, ctx, selectedAgent.name)
        : `[VOICE CHAT] Respond conversationally and concisely — your response will be spoken aloud.\n\n${text}`;
      
      await gateway.sendChatStreaming(enrichedMessage);
      
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
      // Resume listening
      if (callActiveRef.current) {
        if (geminiMode && geminiLive.connected) geminiLive.startMic();
        else startListeningFallback();
      }
    }
  }, [connected, selectedAgent, geminiMode, finishResponse]);
  
  // ── Web Speech API fallback ──
  useEffect(() => {
    if (geminiMode) return; // Don't set up fallback if using Gemini
    
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
      if (callActiveRef.current && listeningRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setListening(false);
        listeningRef.current = false;
      }
    };
    
    recognitionRef.current = recognition;
    return () => { try { recognition.abort(); } catch {} };
  }, [geminiMode]);
  
  const startListeningFallback = () => {
    if (!recognitionRef.current || listeningRef.current) return;
    window.speechSynthesis.cancel();
    try {
      recognitionRef.current.start();
      setListening(true);
      listeningRef.current = true;
    } catch {}
  };
  
  const stopListeningFallback = () => {
    listeningRef.current = false;
    setListening(false);
    try { recognitionRef.current?.abort(); } catch {}
  };
  
  // ── Call controls ──
  const startCall = async () => {
    gateway.setSessionKey(selectedAgent.sessionKey);
    setCallActive(true);
    callActiveRef.current = true;
    
    if (geminiMode) {
      // Connect to Gemini Live as voice I/O engine
      const apiKey = apiKeyRef.current;
      if (!apiKey) {
        addSystemMessage('⚠️ No Gemini API key found. Set GEMINI_API_KEY. Falling back to browser speech.');
        setGeminiMode(false);
        addSystemMessage(`📞 Voice call started with ${selectedAgent.name} (browser mode)`);
        startListeningFallback();
        return;
      }
      
      try {
        addSystemMessage(`📞 Connecting to ${selectedAgent.name}...`);
        
        const voice = AGENT_VOICES[selectedAgent.id] || 'Zephyr';
        await geminiLive.connect({
          apiKey,
          voice,
          systemInstruction: buildRelayInstruction(selectedAgent),
        });
        
        addSystemMessage(`🎙️ Voice call active with ${selectedAgent.name} — speak naturally`);
        
        // Start mic
        await geminiLive.startMic();
      } catch (err: any) {
        console.error('[VoiceChat] Gemini connect failed:', err);
        addSystemMessage(`⚠️ Gemini Live failed: ${err.message}. Using browser speech.`);
        setGeminiMode(false);
        startListeningFallback();
      }
    } else {
      addSystemMessage(`📞 Voice call started with ${selectedAgent.name}`);
      startListeningFallback();
    }
  };
  
  const endCall = async () => {
    callActiveRef.current = false;
    setCallActive(false);
    setSpeaking(false);
    setProcessing(false);
    setMicLevel(0);
    setSpeakLevel(0);
    
    if (geminiMode && geminiLive.connected) {
      await geminiLive.disconnect();
      setGeminiConnected(false);
    }
    
    stopListeningFallback();
    window.speechSynthesis.cancel();
    addSystemMessage('📞 Voice call ended');
  };
  
  const toggleMic = async () => {
    if (geminiMode && geminiLive.connected) {
      if (listening) {
        geminiLive.stopMic();
      } else {
        await geminiLive.startMic();
      }
    } else {
      if (listening) stopListeningFallback();
      else startListeningFallback();
    }
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
  
  // ── Screen share via Gemini Live ──
  const toggleScreenShare = async () => {
    if (screenSharing) {
      if (geminiMode && geminiLive.connected) {
        geminiLive.stopVideo();
      }
      setScreenSharing(false);
      return;
    }
    try {
      if (geminiMode && geminiLive.connected) {
        await geminiLive.startVideo('screen');
        const stream = geminiLive.getVideoStream();
        setScreenSharing(true);
        requestAnimationFrame(() => {
          if (screenVideoRef.current && stream) screenVideoRef.current.srcObject = stream;
        });
        addSystemMessage('🖥️ Screen sharing active — agent can see your screen');
      } else {
        // Fallback screen share (preview only, no agent vision)
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        stream.getVideoTracks()[0].onended = () => setScreenSharing(false);
        setScreenSharing(true);
        requestAnimationFrame(() => {
          if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
        });
      }
    } catch (e) {
      console.warn('[VoiceChat] Screen share failed:', e);
    }
  };

  const toggleVideo = async () => {
    if (videoActive) {
      if (geminiMode && geminiLive.connected) {
        geminiLive.stopVideo();
      }
      setVideoActive(false);
      return;
    }
    try {
      if (geminiMode && geminiLive.connected) {
        await geminiLive.startVideo('camera');
        const stream = geminiLive.getVideoStream();
        setVideoActive(true);
        requestAnimationFrame(() => {
          if (cameraVideoRef.current && stream) cameraVideoRef.current.srcObject = stream;
        });
        addSystemMessage('📹 Camera active — agent can see you');
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setVideoActive(true);
        requestAnimationFrame(() => {
          if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
        });
      }
    } catch (e) {
      console.warn('[VoiceChat] Camera failed:', e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geminiLive.connected) geminiLive.disconnect();
    };
  }, []);

  const handleAgentSwitch = async (agent: ChatAgent) => {
    if (callActive) await endCall();
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
                <span className="text-xs text-clawd-text-dim ml-2">
                  {geminiMode ? '⚡ Gemini Live' : 'Voice'}
                </span>
              </div>
            </div>
          ) : (
            <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />
          )}
          
          {callActive && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">
                {geminiConnected ? 'Gemini Live' : 'Active'}
              </span>
              {speaking && <Waveform level={speakLevel} color="#4ade80" bars={5} height={20} />}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onSwitchToText && (
            <button
              onClick={onSwitchToText}
              className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors"
              title="Switch to text chat"
            >
              <MessageSquare size={16} />
            </button>
          )}
          
          {/* Gemini Live toggle */}
          <button
            onClick={() => {
              if (callActive) return; // Can't switch during call
              setGeminiMode(!geminiMode);
            }}
            disabled={callActive}
            className={`p-2 rounded-lg transition-colors ${
              geminiMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            } disabled:opacity-40`}
            title={geminiMode ? 'Gemini Live mode (real-time audio)' : 'Browser speech mode'}
          >
            {geminiMode ? <Zap size={16} /> : <ZapOff size={16} />}
          </button>
          
          <button
            onClick={toggleScreenShare}
            className={`p-2 rounded-lg transition-colors ${
              screenSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={screenSharing ? 'Stop screen share' : 'Share screen'}
          >
            {screenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
          </button>
          
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-lg transition-colors ${
              videoActive ? 'bg-purple-500/20 text-purple-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={videoActive ? 'Stop camera' : 'Start camera'}
          >
            {videoActive ? <VideoOff size={16} /> : <Video size={16} />}
          </button>
          
          <button
            onClick={() => setMuted(!muted)}
            className={`p-2 rounded-lg transition-colors ${
              muted ? 'bg-red-500/20 text-red-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={muted ? 'Unmute agent voice' : 'Mute agent voice'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          
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
              <video ref={screenVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
              <span className="absolute top-1 left-2 text-[10px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded">Screen</span>
            </div>
          )}
          {videoActive && (
            <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-black border border-clawd-border flex-shrink-0">
              <video ref={cameraVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
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
              {geminiMode ? (
                <>Press call to connect via <span className="text-yellow-400">Gemini Live</span>. Real-time audio streaming with {selectedAgent.name}'s full brain.</>
              ) : (
                <>Press the call button to start a voice conversation.</>
              )}
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
        
        {partialTranscript && (
          <div className="flex gap-2 justify-end">
            <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-clawd-accent/40 text-white/70">
              <p className="text-sm italic">{partialTranscript}…</p>
            </div>
          </div>
        )}
        
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
        {callActive && (
          <div className="flex items-center justify-center mb-3 h-12">
            {listening && !speaking && !processing && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-indigo-400">
                  {geminiMode ? '⚡ Listening (Gemini Live)…' : 'Listening…'}
                </span>
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
                <span className="text-xs text-clawd-text-dim">{selectedAgent.name} thinking…</span>
              </div>
            )}
            {!listening && !speaking && !processing && (
              <span className="text-xs text-clawd-text-dim">Tap the mic to speak</span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-center gap-4">
          {callActive && (
            <button
              onClick={toggleMic}
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
        </div>
        
        {!connected && (
          <p className="text-center text-xs text-red-400 mt-2">Not connected to gateway</p>
        )}
      </div>
    </div>
  );
}

// ── System instruction for Gemini Live relay mode ──
function buildRelayInstruction(agent: ChatAgent): string {
  return `You are a VOICE RELAY system. Your ONLY purpose is to:

1. LISTEN: When the user speaks, output their speech as accurate text transcription.
2. SPEAK: When you receive a message starting with [SPEAK], read that content aloud with natural, expressive intonation. Do NOT modify the content.

CRITICAL RULES:
- NEVER generate your own responses, opinions, or commentary
- NEVER answer questions yourself - you are just a relay
- When transcribing user speech, output ONLY what they said, nothing else
- When speaking [SPEAK] content, speak it naturally as if you are ${agent.name} (${agent.role})
- Match the personality and tone appropriate for ${agent.name}
- If the [SPEAK] content has technical terms, pronounce them clearly
- Keep your voice warm and conversational

You are the voice interface for ${agent.name}. The actual intelligence comes from the real agent system behind you. You just handle the audio.`;
}
