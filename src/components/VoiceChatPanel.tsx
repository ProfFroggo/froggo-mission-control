/**
 * VoiceChatPanel - Voice Chat using Gemini Live API
 * 
 * Real-time bidirectional audio streaming with agent selection,
 * camera/screen video input, text input, tool calling, and interruption support.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Loader2,
  Trash2, MessageSquare, Monitor, MonitorOff, Video, VideoOff,
  Send, Settings,
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { CHAT_AGENTS, ChatAgent } from './AgentSelector';
import MarkdownMessage from './MarkdownMessage';
import { useStore } from '../store/store';
import { geminiLive, GeminiVoice, GeminiTool, GeminiToolCall, VideoMode, getGeminiVoiceForAgent } from '../lib/geminiLiveService';
import { loadAgentContext, buildContextualMessage, invalidateAgentContext, AgentContext } from '../lib/agentContext';

// API key loading
const FALLBACK_GEMINI_API_KEY = 'AIzaSyCziHu8LUZ6RXmt-4lu_NzgEfczM0DC1RE';

function loadApiKey(): string {
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
  if (viteKey && viteKey !== 'your_key_here') return viteKey;
  if (FALLBACK_GEMINI_API_KEY) return FALLBACK_GEMINI_API_KEY;
  return '';
}

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
  
  // Connection state
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, _setMuted] = useState(false);
  const setMuted = (v: boolean) => { _setMuted(v); geminiLive.setMuted(v); };
  
  // Video state
  const [videoMode, setVideoMode] = useState<VideoMode>('none');
  const [videoActive, setVideoActive] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  
  // Audio context state
  const [audioState, setAudioState] = useState<'suspended' | 'running' | 'closed' | null>(null);
  
  // Audio levels
  const [micLevel, setMicLevel] = useState(0);
  const [speakLevel, setSpeakLevel] = useState(0);
  
  // Messages
  const msgCounter = useRef(0);
  const nextId = (suffix: string) => `vc-${Date.now()}-${++msgCounter.current}-${suffix}`;
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  
  // Refs
  const callActiveRef = useRef(false);
  const apiKey = useRef(loadApiKey());
  
  // Agent context
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);
  const agentContextRef = useRef<AgentContext | null>(null);
  
  // Sync agentId prop
  useEffect(() => {
    if (agentId) {
      const agent = CHAT_AGENTS.find(a => a.id === agentId);
      if (agent && agent.id !== selectedAgent.id) setSelectedAgent(agent);
    }
  }, [agentId]);
  
  // Load agent context
  useEffect(() => {
    let cancelled = false;
    loadAgentContext(selectedAgent.id).then(ctx => {
      if (!cancelled) {
        setAgentContext(ctx);
        agentContextRef.current = ctx;
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedAgent.id]);
  
  // Load/save history
  useEffect(() => { setMessages(loadHistory(selectedAgent.id)); }, [selectedAgent.id]);
  useEffect(() => { if (messages.length > 0) saveHistory(selectedAgent.id, messages); }, [messages, selectedAgent.id]);
  
  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  
  // ── Track playback AudioContext state ──
  useEffect(() => {
    if (!callActive) { setAudioState(null); return; }
    const interval = setInterval(() => {
      const ctx = geminiLive.playbackAudioContext;
      setAudioState(ctx ? ctx.state as 'suspended' | 'running' | 'closed' : null);
    }, 500);
    return () => clearInterval(interval);
  }, [callActive]);
  
  const handleEnableAudio = async () => {
    const ctx = geminiLive.playbackAudioContext;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        setAudioState('running');
        addSystemMessage('🔊 Audio enabled');
      } catch (e: any) {
        addSystemMessage(`⚠️ Audio resume failed: ${e.message}`);
      }
    }
  };
  
  // ── Gemini Live event listeners ──
  useEffect(() => {
    const unsubs = [
      geminiLive.on('connected', () => {
        setCallActive(true);
        setConnecting(false);
        addSystemMessage('🔗 Connected — speak naturally');
      }),
      geminiLive.on('disconnected', () => {
        setCallActive(false);
        setConnecting(false);
        setListening(false);
        setSpeaking(false);
        setVideoActive(false);
        callActiveRef.current = false;
      }),
      geminiLive.on('listening-start', () => setListening(true)),
      geminiLive.on('listening-end', () => setListening(false)),
      geminiLive.on('speaking-start', () => { setSpeaking(true); setSpeakLevel(0.5); }),
      geminiLive.on('speaking-end', () => { setSpeaking(false); setSpeakLevel(0); }),
      geminiLive.on('audio-level', ({ level }: { level: number }) => setMicLevel(level)),
      geminiLive.on('model-audio-level', ({ level }: { level: number }) => setSpeakLevel(level)),
      geminiLive.on('error', ({ message }: { message: string }) => {
        console.error('[VoiceChat] Gemini error:', message);
        addSystemMessage(`⚠️ ${message}`);
      }),
      geminiLive.on('transcript', (data: { text: string; role: string }) => {
        if (!data.text?.trim()) return;
        const role = data.role === 'model' ? 'assistant' : 'user';
        const text = data.text.trim();
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === role && Date.now() - last.timestamp < 3000) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + ' ' + text } : m);
          }
          return [...prev, { id: nextId(role === 'assistant' ? 'a' : 'u'), role, content: text, timestamp: Date.now() }];
        });
      }),
      geminiLive.on('model-thinking', ({ text }: { text: string }) => {
        console.log('[VoiceChat] Thinking:', text.slice(0, 100));
      }),
      geminiLive.on('interrupted', () => {
        addSystemMessage('🔄 Interrupted');
      }),
      geminiLive.on('tool-call', async (toolCall: GeminiToolCall) => {
        if (!toolCall?.functionCalls?.length) return;
        const responses: Array<{ id: string; name: string; response: any }> = [];
        for (const fc of toolCall.functionCalls) {
          console.log(`[VoiceChat] Tool: ${fc.name}`, fc.args);
          addSystemMessage(`🔧 ${fc.name}(${Object.values(fc.args || {}).join(', ')})`);
          const result = await executeToolCall(fc.name, fc.args || {}, selectedAgent);
          responses.push({ id: fc.id, name: fc.name, response: result });
          if (['create_task', 'update_task', 'spawn_agent'].includes(fc.name)) {
            invalidateAgentContext();
            loadAgentContext(selectedAgent.id).then(ctx => { agentContextRef.current = ctx; setAgentContext(ctx); }).catch(() => {});
          }
        }
        await geminiLive.sendToolResponse(responses);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [selectedAgent.id]);
  
  // Cleanup on unmount
  useEffect(() => { return () => { if (geminiLive.connected) geminiLive.disconnect(); }; }, []);
  
  // ── Helpers ──
  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, { id: nextId('s'), role: 'system', content, timestamp: Date.now() }]);
  };
  
  // ── Call controls ──
  const startCall = async () => {
    if (!apiKey.current) {
      addSystemMessage('⚠️ No Gemini API key. Set VITE_GEMINI_API_KEY in .env');
      return;
    }
    
    setConnecting(true);
    callActiveRef.current = true;
    
    // Refresh agent context
    invalidateAgentContext(selectedAgent.id);
    loadAgentContext(selectedAgent.id).then(ctx => {
      agentContextRef.current = ctx;
      setAgentContext(ctx);
    }).catch(() => {});
    
    try {
      const voice = getGeminiVoiceForAgent(selectedAgent.id);
      await geminiLive.connect({
        apiKey: apiKey.current,
        voice,
        videoMode,
        systemInstruction: buildSystemInstruction(selectedAgent, agentContextRef.current),
        tools: buildAgentTools(),
      });
      
      addActivity({ type: 'chat', message: `🎙️ Voice call with ${selectedAgent.name}`, timestamp: Date.now() });
      await geminiLive.startMic();
      
      // Auto-start video if selected
      if (videoMode !== 'none') {
        try {
          await geminiLive.startVideo(videoMode);
          const stream = geminiLive.getVideoStream();
          setVideoActive(true);
          requestAnimationFrame(() => {
            if (videoPreviewRef.current && stream) videoPreviewRef.current.srcObject = stream;
          });
          addSystemMessage(videoMode === 'camera' ? '📹 Camera active' : '🖥️ Screen sharing active');
        } catch (e: any) {
          console.warn('[VoiceChat] Video start failed:', e);
        }
      }
    } catch (err: any) {
      console.error('[VoiceChat] Connect failed:', err);
      addSystemMessage(`⚠️ Connection failed: ${err.message}`);
      setConnecting(false);
      callActiveRef.current = false;
    }
  };
  
  const endCall = async () => {
    callActiveRef.current = false;
    setMicLevel(0);
    setSpeakLevel(0);
    await geminiLive.disconnect();
    addSystemMessage('📞 Call ended');
  };
  
  const toggleMic = async () => {
    if (!callActive) return;
    if (listening) geminiLive.stopMic();
    else await geminiLive.startMic();
  };
  
  const toggleVideo = async () => {
    if (!callActive) return;
    if (videoActive) {
      geminiLive.stopVideo();
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
      setVideoActive(false);
      addSystemMessage('Video stopped');
    } else {
      try {
        const mode = videoMode !== 'none' ? videoMode : 'camera';
        await geminiLive.startVideo(mode);
        const stream = geminiLive.getVideoStream();
        setVideoActive(true);
        requestAnimationFrame(() => {
          if (videoPreviewRef.current && stream) videoPreviewRef.current.srcObject = stream;
        });
        addSystemMessage(mode === 'camera' ? '📹 Camera active' : '🖥️ Screen sharing active');
      } catch (e: any) {
        addSystemMessage(`⚠️ Video failed: ${e.message}`);
      }
    }
  };
  
  const toggleScreenShare = async () => {
    if (!callActive) return;
    if (videoActive && geminiLive.videoMode === 'screen') {
      geminiLive.stopVideo();
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
      setVideoActive(false);
    } else {
      try {
        if (videoActive) geminiLive.stopVideo();
        await geminiLive.startVideo('screen');
        const stream = geminiLive.getVideoStream();
        setVideoActive(true);
        requestAnimationFrame(() => {
          if (videoPreviewRef.current && stream) videoPreviewRef.current.srcObject = stream;
        });
        addSystemMessage('🖥️ Screen sharing active');
      } catch (e: any) {
        addSystemMessage(`⚠️ Screen share failed: ${e.message}`);
      }
    }
  };
  
  const handleSendText = async () => {
    if (!textInput.trim() || !callActive) return;
    const text = textInput.trim();
    setTextInput('');
    setMessages(prev => [...prev, { id: nextId('u'), role: 'user', content: text, timestamp: Date.now() }]);
    try {
      await geminiLive.sendText(text);
    } catch (e: any) {
      addSystemMessage(`⚠️ Send failed: ${e.message}`);
    }
  };
  
  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(storageKey(selectedAgent.id));
  };
  
  const handleAgentSwitch = async (agent: ChatAgent) => {
    if (callActive) await endCall();
    setSelectedAgent(agent);
  };
  
  // ── Waveform ──
  const Waveform = ({ level, color, bars = 8, height = 32 }: { level: number; color: string; bars?: number; height?: number }) => (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = Math.max(0.12, level * (0.5 + Math.sin((Date.now() / 100) + i * 0.8) * 0.5));
        return (
          <div key={i} className="rounded-full transition-all duration-75"
            style={{ width: 3, height: `${Math.max(15, h * 100)}%`, backgroundColor: color, opacity: 0.6 + h * 0.4 }} />
        );
      })}
    </div>
  );
  
  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* API Key Warning */}
      {!apiKey.current && (
        <div className="bg-red-500/20 border-b border-red-500/50 px-4 py-2 text-center">
          <p className="text-red-400 text-sm font-medium">⚠️ No Gemini API key found</p>
          <p className="text-red-300 text-xs mt-1">Set VITE_GEMINI_API_KEY in .env file</p>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-clawd-border">
        <div className="flex items-center gap-3">
          {embedded ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <AgentAvatar agentId={selectedAgent.id} size="sm" />
                {speaking && <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-40" />}
              </div>
              <div>
                <span className="text-sm font-medium text-clawd-text">{selectedAgent.name}</span>
                <span className="text-xs text-clawd-text-dim ml-2">⚡ Gemini Live</span>
              </div>
            </div>
          ) : (
            <AgentSelector selectedAgent={selectedAgent} onSelect={handleAgentSwitch} />
          )}
          
          {callActive && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">Gemini Live</span>
              {agentContext && agentContext.tasks.length > 0 && (
                <span className="text-[10px] text-clawd-text-dim bg-clawd-border/50 px-1.5 py-0.5 rounded-full" title={`${agentContext.tasks.length} tasks`}>
                  🧠 {agentContext.tasks.length}
                </span>
              )}
              {speaking && <Waveform level={speakLevel} color="#4ade80" bars={5} height={20} />}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onSwitchToText && (
            <button onClick={onSwitchToText} className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors" title="Switch to text chat">
              <MessageSquare size={16} />
            </button>
          )}
          
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors" title="Settings">
            <Settings size={16} />
          </button>
          
          <button onClick={() => setMuted(!muted)} className={`p-2 rounded-lg transition-colors ${muted ? 'bg-red-500/20 text-red-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'}`} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          
          <button onClick={clearHistory} className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-red-400 transition-colors" title="Clear history">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {/* Settings panel */}
      {showSettings && !callActive && (
        <div className="px-4 py-3 border-b border-clawd-border bg-clawd-surface">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-clawd-text-dim mb-1 block">Video Mode</label>
              <select value={videoMode} onChange={(e) => setVideoMode(e.target.value as VideoMode)}
                className="w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm">
                <option value="none">🎙️ Audio only</option>
                <option value="camera">📹 Camera</option>
                <option value="screen">🖥️ Screen share</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-clawd-text-dim mt-2">💡 Video mode is set before connecting. Camera/screen can also be toggled during call.</p>
        </div>
      )}
      
      {/* Video preview */}
      {videoActive && (
        <div className="mx-4 mt-3 relative rounded-lg overflow-hidden bg-black border border-clawd-border max-h-48">
          <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-contain"
            style={geminiLive.videoMode === 'camera' ? { transform: 'scaleX(-1)' } : {}} />
          <span className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
            {geminiLive.videoMode === 'camera' ? '📹 Camera' : '🖥️ Screen'}
          </span>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
            <div className="relative mb-4">
              <AgentAvatar agentId={selectedAgent.id} size="2xl" />
            </div>
            <p className="text-lg font-medium text-clawd-text mb-1">Voice Chat with {selectedAgent.name}</p>
            <p className="text-sm text-center max-w-xs">
              Press call to connect via <span className="text-yellow-400">Gemini Live</span>. Real-time audio streaming with {selectedAgent.name}.
              {selectedAgent.role && <span className="block mt-1 text-xs opacity-70">{selectedAgent.role}</span>}
              {agentContext && (
                <span className="block mt-2 text-xs opacity-60">
                  🧠 {agentContext.tasks.length} task{agentContext.tasks.length !== 1 ? 's' : ''}
                  {agentContext.sessions.length > 0 && ` · ${agentContext.sessions.length} session${agentContext.sessions.length !== 1 ? 's' : ''}`}
                </span>
              )}
            </p>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="relative flex-shrink-0 mt-1">
                <AgentAvatar agentId={selectedAgent.id} size="xs" />
                {speaking && msg.id === messages.filter(m => m.role === 'assistant').pop()?.id && (
                  <div className="absolute -inset-1 rounded-full border-2 border-green-400/50 animate-pulse" />
                )}
              </div>
            )}
            
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
              msg.role === 'user' ? 'bg-clawd-accent text-white'
                : msg.role === 'system' ? 'bg-clawd-border/50 text-clawd-text-dim text-xs italic px-3 py-1.5'
                : 'bg-clawd-card text-clawd-text border border-clawd-border'
            }`}>
              {msg.role === 'assistant' && msg.content ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                <p className="text-sm">{msg.content || '...'}</p>
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
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Enable Audio button - shown when AudioContext is suspended */}
      {callActive && audioState === 'suspended' && (
        <div className="px-4 py-2 border-t border-yellow-500/30 bg-yellow-500/10">
          <button onClick={handleEnableAudio}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-medium transition-colors">
            <Volume2 size={18} />
            Enable Audio
          </button>
          <p className="text-center text-[10px] text-yellow-400/70 mt-1">Browser requires a click to play audio</p>
        </div>
      )}
      
      {/* Audio visualizer */}
      {callActive && (
        <div className="px-4 py-3 border-t border-clawd-border bg-clawd-surface/50">
          <div className="flex items-center justify-center h-12">
            {listening && !speaking && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-indigo-400 font-medium">⚡ Listening…</span>
                <Waveform level={micLevel} color="#818cf8" bars={12} height={40} />
              </div>
            )}
            {speaking && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400 font-medium">{selectedAgent.name} speaking</span>
                <Waveform level={speakLevel} color="#4ade80" bars={12} height={40} />
              </div>
            )}
            {!listening && !speaking && <span className="text-xs text-clawd-text-dim">Tap mic to speak</span>}
          </div>
        </div>
      )}
      
      {/* Text input (during call) */}
      {callActive && (
        <div className="px-4 py-3 border-t border-clawd-border">
          <div className="flex gap-2">
            <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Type a message (optional)…"
              className="flex-1 px-4 py-2 rounded-lg bg-clawd-card border border-clawd-border text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-accent" />
            <button onClick={handleSendText} disabled={!textInput.trim()}
              className="p-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-40" title="Send text">
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
      
      {/* Call controls */}
      <div className="border-t border-clawd-border p-4">
        <div className="flex items-center justify-center gap-4">
          {callActive && (
            <button onClick={toggleMic} disabled={speaking}
              className={`p-4 rounded-full transition-all ${listening ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110' : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'} disabled:opacity-40`}
              title={listening ? 'Pause mic' : 'Resume mic'}>
              {listening ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
          )}
          
          <button onClick={() => callActive ? endCall() : startCall()} disabled={connecting}
            className={`p-5 rounded-full transition-all ${callActive ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'} disabled:opacity-40`}
            title={callActive ? 'End call' : 'Start call'}>
            {connecting ? <Loader2 size={26} className="animate-spin" /> : callActive ? <PhoneOff size={26} /> : <Phone size={26} />}
          </button>
          
          {callActive && (
            <>
              <button onClick={toggleScreenShare}
                className={`p-4 rounded-full transition-all ${videoActive && geminiLive.videoMode === 'screen' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'}`}
                title="Screen share">
                {videoActive && geminiLive.videoMode === 'screen' ? <MonitorOff size={22} /> : <Monitor size={22} />}
              </button>
              <button onClick={toggleVideo}
                className={`p-4 rounded-full transition-all ${videoActive && geminiLive.videoMode === 'camera' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'}`}
                title="Camera">
                {videoActive && geminiLive.videoMode === 'camera' ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
            </>
          )}
        </div>
        
        {!callActive && !connecting && (
          <p className="text-center text-xs text-clawd-text-dim mt-3">Press call to connect via Gemini Live</p>
        )}
      </div>
    </div>
  );
}

// ── Tool definitions for Gemini Live function calling ──
function buildAgentTools(): GeminiTool[] {
  return [
    {
      name: 'create_task',
      description: 'Create a new task in the task board.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the task' },
          description: { type: 'string', description: 'Detailed description' },
          priority: { type: 'string', description: 'Priority', enum: ['low', 'medium', 'high', 'critical'] },
          assigned_to: { type: 'string', description: 'Agent ID to assign to' },
          status: { type: 'string', description: 'Initial status', enum: ['todo', 'in-progress'] },
        },
        required: ['title'],
      },
    },
    {
      name: 'update_task',
      description: 'Update an existing task.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'Task ID' },
          status: { type: 'string', description: 'New status', enum: ['todo', 'in-progress', 'done', 'blocked'] },
          priority: { type: 'string', description: 'New priority', enum: ['low', 'medium', 'high', 'critical'] },
          assigned_to: { type: 'string', description: 'New assignee' },
        },
        required: ['task_id'],
      },
    },
    {
      name: 'list_tasks',
      description: 'List current tasks, optionally filtered.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Filter by agent' },
          status: { type: 'string', description: 'Filter by status', enum: ['todo', 'in-progress', 'done', 'blocked', 'all'] },
        },
      },
    },
    {
      name: 'spawn_agent',
      description: 'Spawn another agent to perform a task.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent to spawn' },
          message: { type: 'string', description: 'Instruction to send' },
          task_title: { type: 'string', description: 'Optional task title' },
        },
        required: ['agent_id', 'message'],
      },
    },
    {
      name: 'get_agent_status',
      description: 'Get current status of an agent.',
      parameters: {
        type: 'object',
        properties: {
          agent_id: { type: 'string', description: 'Agent ID to check' },
        },
        required: ['agent_id'],
      },
    },
  ];
}

// ── Tool call executor ──
async function executeToolCall(fnName: string, args: Record<string, any>, currentAgent: ChatAgent): Promise<any> {
  const exec = (window as any).clawdbot?.exec?.run;
  if (!exec) return { error: 'Exec not available' };

  try {
    switch (fnName) {
      case 'create_task': {
        const title = args.title || 'Untitled task';
        const assignee = args.assigned_to || currentAgent.id;
        const priority = args.priority || 'medium';
        const status = args.status || 'todo';
        const desc = args.description || '';
        const r = await exec(`froggo-db task-add "${title.replace(/"/g, '\\"')}" --priority ${priority} --assign ${assignee} --status ${status} ${desc ? `--desc "${desc.replace(/"/g, '\\"')}"` : ''} 2>&1`);
        invalidateAgentContext(assignee);
        return { success: r.success, output: r.stdout?.trim() || r.stderr?.trim(), task_created: title };
      }
      case 'update_task': {
        const parts = [`froggo-db task-update ${args.task_id}`];
        if (args.status) parts.push(`--status ${args.status}`);
        if (args.priority) parts.push(`--priority ${args.priority}`);
        if (args.assigned_to) parts.push(`--assign ${args.assigned_to}`);
        const r = await exec(parts.join(' ') + ' 2>&1');
        invalidateAgentContext();
        return { success: r.success, output: r.stdout?.trim() || r.stderr?.trim() };
      }
      case 'list_tasks': {
        const where = [];
        if (args.agent_id) where.push(`assigned_to='${args.agent_id}'`);
        if (args.status && args.status !== 'all') where.push(`status='${args.status}'`);
        const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const r = await exec(`froggo-db query "SELECT id, title, status, priority, assigned_to FROM tasks ${whereClause} ORDER BY created_at DESC LIMIT 15" --json 2>&1`);
        try { return { tasks: JSON.parse(r.stdout) }; } catch { return { tasks: [], raw: r.stdout?.trim() }; }
      }
      case 'spawn_agent': {
        if (args.task_title) {
          await exec(`froggo-db task-add "${args.task_title.replace(/"/g, '\\"')}" --assign ${args.agent_id} --priority high --status todo 2>&1`);
        }
        const r = await exec(`clawdbot gateway sessions-send --target "agent:${args.agent_id}:main" --message "${args.message.replace(/"/g, '\\"')}" 2>&1`);
        invalidateAgentContext(args.agent_id);
        return { success: r.success, output: r.stdout?.trim(), agent_spawned: args.agent_id };
      }
      case 'get_agent_status': {
        const ctx = await loadAgentContext(args.agent_id);
        return {
          agent: args.agent_id,
          personality: ctx.personality ? `${ctx.personality.emoji} ${ctx.personality.name} - ${ctx.personality.role}` : 'Unknown',
          tasks: ctx.tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
          active_sessions: ctx.sessions.filter(s => s.state === 'running' || s.state === 'active').length,
        };
      }
      default:
        return { error: `Unknown tool: ${fnName}` };
    }
  } catch (err: any) {
    return { error: err.message };
  }
}

// ── System instruction builder ──
function buildSystemInstruction(agent: ChatAgent, context?: AgentContext | null): string {
  const parts: string[] = [];

  if (context?.personality) {
    const p = context.personality;
    parts.push(`You are ${p.name} (${p.emoji}), ${p.role}. ${p.personality}. ${p.vibe}`);
    if (p.bio) parts.push(`Bio: ${p.bio}`);
  } else {
    parts.push(`You are ${agent.name}, ${agent.role || 'an AI assistant'}.`);
  }

  parts.push(`
You are speaking to your human via voice chat. Be conversational, concise, and natural.
Keep responses to 1-3 sentences unless asked for detail.
You have tools to manage tasks, spawn agents, and check status. Use them when asked.
Don't narrate tool usage — just do it and report the result naturally.`);

  if (context?.tasks?.length) {
    parts.push(`\nYour current tasks:`);
    for (const t of context.tasks.slice(0, 10)) {
      parts.push(`- [${t.status}] ${t.title} (${t.priority})`);
    }
  }

  if (context?.memory) {
    parts.push(`\nRecent memory: ${context.memory.slice(0, 500)}`);
  }

  return parts.join('\n');
}
