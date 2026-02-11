/**
 * VoiceAssistantPanel - Voice assistant with agent selection
 * 
 * Modes:
 * 1. Gemini Live - Direct real-time voice via Gemini (bidirectional audio)
 * 2. Agent Mode - Speak → STT → send to agent via gateway → TTS response
 * 
 * Each agent has its own Google TTS voice (from AGENT_VOICES)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX,
  Camera, Monitor, VideoOff, Send, Settings, Zap,
  MessageSquare, Trash2, AlertCircle, Wifi, WifiOff,
  Loader2,
} from 'lucide-react';
import { geminiLive, type VideoMode, type GeminiVoice } from '../lib/geminiLiveService';
import { synthesizeSpeech, playAudio, speakBrowser, stopSpeaking, AGENT_VOICES } from '../lib/googleTTS';
import { gateway } from '../lib/gateway';
import { AGENTS } from '../lib/agents';

// ── Types ──

interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  agentId?: string;
}

interface VoiceAssistantPanelProps {
  onSwitchToText?: () => void;
  embedded?: boolean;
}

type VoiceMode = 'gemini' | 'agent';

interface AgentOption {
  id: string;
  name: string;
  emoji: string;
  sessionKey: string;
}

const AGENT_OPTIONS: AgentOption[] = [
  { id: 'froggo', name: 'Froggo', emoji: '🐸', sessionKey: 'chat-agent' },
  { id: 'coder', name: 'Coder', emoji: '💻', sessionKey: 'agent:coder' },
  { id: 'researcher', name: 'Researcher', emoji: '🔍', sessionKey: 'agent:researcher' },
  { id: 'writer', name: 'Writer', emoji: '✍️', sessionKey: 'agent:writer' },
  { id: 'chief', name: 'Chief', emoji: '👨‍💻', sessionKey: 'agent:chief' },
];

const VOICE_OPTIONS: { value: GeminiVoice; label: string }[] = [
  { value: 'Zephyr', label: 'Zephyr (warm)' },
  { value: 'Puck', label: 'Puck (playful)' },
  { value: 'Charon', label: 'Charon (deep)' },
  { value: 'Kore', label: 'Kore (clear)' },
  { value: 'Fenrir', label: 'Fenrir (bold)' },
  { value: 'Aoede', label: 'Aoede (melodic)' },
  { value: 'Leda', label: 'Leda (gentle)' },
  { value: 'Orus', label: 'Orus (neutral)' },
  { value: 'Perseus', label: 'Perseus (strong)' },
];

const STORAGE_KEY = 'gemini-live-history';
const SETTINGS_KEY = 'gemini-live-settings';

function loadHistory(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}
function saveHistory(msgs: ChatMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-200))); } catch {}
}

function loadSettings(): { voice: GeminiVoice; systemInstruction: string; voiceMode: VoiceMode; selectedAgent: string } {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      voice: s.voice || 'Zephyr',
      systemInstruction: s.systemInstruction || 'You are a helpful voice assistant. Keep responses concise and conversational.',
      voiceMode: s.voiceMode || 'agent',
      selectedAgent: s.selectedAgent || 'froggo',
    };
  } catch {
    return { voice: 'Zephyr', systemInstruction: 'You are a helpful voice assistant.', voiceMode: 'agent', selectedAgent: 'froggo' };
  }
}
function saveSettings(s: any) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

export default function VoiceAssistantPanel({ onSwitchToText }: VoiceAssistantPanelProps) {
  // State
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [videoMode, setVideoMode] = useState<VideoMode>('none');
  const [micLevel, setMicLevel] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState(false);
  const [agentThinking, setAgentThinking] = useState(false);

  // Settings
  const [settings, setSettings] = useState(loadSettings);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const apiKeyRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const abortRef = useRef(false);

  const isAgentMode = settings.voiceMode === 'agent';
  const currentAgent = AGENT_OPTIONS.find(a => a.id === settings.selectedAgent) || AGENT_OPTIONS[0];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  // Load API key
  useEffect(() => {
    (async () => {
      try {
        if ((window as any).clawdbot?.exec?.run) {
          const r = await (window as any).clawdbot.exec.run('echo $GEMINI_API_KEY 2>/dev/null || echo $GOOGLE_API_KEY 2>/dev/null');
          if (r.success && r.stdout.trim()) {
            apiKeyRef.current = r.stdout.trim().split('\n')[0];
            return;
          }
        }
        if ((window as any).clawdbot?.settings?.get) {
          const r = await (window as any).clawdbot.settings.get();
          if (r?.success && (r.settings?.geminiApiKey || r.settings?.googleApiKey)) {
            apiKeyRef.current = r.settings.geminiApiKey || r.settings.googleApiKey;
          }
        }
      } catch {}
    })();
  }, []);

  // ── Gemini Live event listeners (only active in Gemini mode) ──
  useEffect(() => {
    if (isAgentMode) return;

    const unsubs = [
      geminiLive.on('connected', () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        addSystemMsg('Connected to Gemini Live');
      }),
      geminiLive.on('disconnected', () => {
        setConnected(false);
        setListening(false);
        setSpeaking(false);
        setVideoMode('none');
      }),
      geminiLive.on('error', (d) => {
        setError(d?.message || 'Unknown error');
        setConnecting(false);
      }),
      geminiLive.on('listening-start', () => setListening(true)),
      geminiLive.on('listening-end', () => setListening(false)),
      geminiLive.on('speaking-start', () => setSpeaking(true)),
      geminiLive.on('speaking-end', () => setSpeaking(false)),
      geminiLive.on('audio-level', (d) => setMicLevel(d?.level ?? 0)),
      geminiLive.on('transcript', (d) => {
        if (d?.text) {
          const role = d.role === 'model' ? 'model' : 'user';
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === role && Date.now() - last.timestamp < 3000) {
              return [...prev.slice(0, -1), { ...last, content: last.content + ' ' + d.text }];
            }
            return [...prev, {
              id: `${role[0]}-${Date.now()}`,
              role,
              content: d.text,
              timestamp: Date.now(),
            }];
          });
        }
      }),
      geminiLive.on('interrupted', () => {
        addSystemMsg('⚡ Interrupted');
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [isAgentMode]);

  // Update video preview
  useEffect(() => {
    if (videoPreviewRef.current && videoMode !== 'none') {
      const stream = geminiLive.getVideoStream();
      if (stream) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }
    }
  }, [videoMode]);

  // Connect to gateway when in agent mode
  useEffect(() => {
    if (isAgentMode && !gateway.connected) {
      gateway.connect();
    }
  }, [isAgentMode]);

  // Track gateway connection state
  useEffect(() => {
    if (!isAgentMode) return;
    
    const checkConnection = () => {
      setConnected(gateway.connected);
    };
    
    checkConnection();
    const unsub1 = gateway.on('connected', () => setConnected(true));
    const unsub2 = gateway.on('disconnected', () => setConnected(false));
    
    return () => { unsub1(); unsub2(); };
  }, [isAgentMode]);

  // ── Helpers ──

  const addSystemMsg = (content: string) => {
    setMessages(prev => [...prev, {
      id: `s-${Date.now()}`,
      role: 'system',
      content,
      timestamp: Date.now(),
    }]);
  };

  const updateSettings = (update: Partial<typeof settings>) => {
    const next = { ...settings, ...update };
    setSettings(next);
    saveSettings(next);
  };

  // ── Agent Mode: Send message and get TTS response ──

  const sendToAgent = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    const agent = AGENT_OPTIONS.find(a => a.id === settings.selectedAgent) || AGENT_OPTIONS[0];
    
    // Add user message
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);

    setAgentThinking(true);
    abortRef.current = false;

    try {
      // Save current session key and switch to agent's session
      const originalSessionKey = gateway.getSessionKey();
      gateway.setSessionKey(agent.sessionKey);
      
      let response: { content: string };
      try {
        response = await gateway.sendChat(text);
      } finally {
        // Restore original session key
        gateway.setSessionKey(originalSessionKey);
      }

      if (abortRef.current) return;

      const content = response.content || '(no response)';
      
      // Add agent message
      setMessages(prev => [...prev, {
        id: `m-${Date.now()}`,
        role: 'model',
        content,
        timestamp: Date.now(),
        agentId: agent.id,
      }]);

      setAgentThinking(false);

      // TTS: Speak the response
      if (!muted) {
        setSpeaking(true);
        try {
          const audio = await synthesizeSpeech(content, agent.id);
          if (audio && !abortRef.current) {
            await playAudio(audio);
          } else if (!abortRef.current) {
            await speakBrowser(content);
          }
        } catch (e) {
          console.error('[Voice] TTS error:', e);
          // Fallback to browser TTS
          try { await speakBrowser(content); } catch {}
        }
        setSpeaking(false);
      }
    } catch (err: any) {
      setAgentThinking(false);
      console.error('[Voice] Agent error:', err);
      setError(err.message || 'Failed to get agent response');
      addSystemMsg(`Error: ${err.message || 'Unknown error'}`);
    }
  }, [settings.selectedAgent, muted]);

  // ── Speech Recognition (Agent mode) ──

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event: any) => {
      let interim = '';
      finalTranscript = '';
      
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // Reset silence timer on new speech
      if (silenceTimer) clearTimeout(silenceTimer);
      
      // After 1.5s of silence with final transcript, send it
      if (finalTranscript.trim()) {
        silenceTimer = setTimeout(() => {
          if (finalTranscript.trim() && isListeningRef.current) {
            recognition.stop();
            sendToAgent(finalTranscript.trim());
          }
        }, 1500);
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setListening(false);
      recognitionRef.current = null;
      
      // Auto-restart after agent finishes speaking (for continuous conversation)
      // User can manually stop by pressing mic button
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.error('[Voice] Recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
      }
      isListeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setListening(true);
    recognition.start();
  }, [sendToAgent]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    isListeningRef.current = false;
    setListening(false);
  }, []);

  // ── Gemini Mode Actions ──

  const handleConnect = async () => {
    if (isAgentMode) {
      // Agent mode: toggle listening
      if (listening) {
        stopListening();
      } else {
        startListening();
      }
      return;
    }

    // Gemini mode
    if (connected) {
      await geminiLive.disconnect();
      addSystemMsg('Disconnected');
      return;
    }

    if (!apiKeyRef.current) {
      setError('No API key found. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      await geminiLive.connect({
        apiKey: apiKeyRef.current,
        voice: settings.voice,
        systemInstruction: settings.systemInstruction,
      });
    } catch (err: any) {
      setError(err.message || 'Connection failed');
      setConnecting(false);
    }
  };

  const toggleMic = async () => {
    if (isAgentMode) {
      if (listening) {
        stopListening();
      } else {
        startListening();
      }
      return;
    }

    // Gemini mode
    if (listening) {
      geminiLive.stopMic();
    } else {
      await geminiLive.startMic();
    }
  };

  const toggleVideo = async (mode: VideoMode) => {
    if (isAgentMode) return; // No video in agent mode
    if (videoMode === mode) {
      geminiLive.stopVideo();
      setVideoMode('none');
    } else {
      if (videoMode !== 'none') geminiLive.stopVideo();
      await geminiLive.startVideo(mode);
      setVideoMode(mode);
    }
  };

  const handleSendText = async () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');

    if (isAgentMode) {
      await sendToAgent(text);
    } else {
      if (!connected) return;
      setMessages(prev => [...prev, {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }]);
      await geminiLive.sendText(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleStopSpeaking = () => {
    abortRef.current = true;
    stopSpeaking();
    setSpeaking(false);
    setAgentThinking(false);
  };

  // ── Waveform ──
  const Waveform = ({ level, color, bars = 7 }: { level: number; color: string; bars?: number }) => (
    <div className="flex items-center gap-[2px] h-6">
      {Array.from({ length: bars }).map((_, i) => {
        const h = Math.max(0.15, level * (0.5 + Math.sin((Date.now() / 80) + i * 0.9) * 0.5));
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-75"
            style={{
              width: 3,
              height: `${Math.max(15, h * 100)}%`,
              backgroundColor: color,
              opacity: 0.5 + h * 0.5,
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
          {/* Agent/Mode selector */}
          <div className="flex items-center gap-2">
            {isAgentMode ? (
              <div className="flex items-center gap-1.5">
                <span className="text-base">{currentAgent.emoji}</span>
                <select
                  value={settings.selectedAgent}
                  onChange={e => updateSettings({ selectedAgent: e.target.value })}
                  className="text-sm font-semibold text-clawd-text bg-transparent border-none focus:outline-none cursor-pointer pr-4"
                  style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
                >
                  {AGENT_OPTIONS.map(a => (
                    <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-yellow-400" />
                <span className="text-sm font-semibold text-clawd-text">Gemini Live</span>
              </div>
            )}
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {connected ? (
              <>
                <Wifi size={14} className="text-green-400" />
                <span className="text-xs text-green-400">{isAgentMode ? 'Gateway' : 'Connected'}</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-clawd-text-dim" />
                <span className="text-xs text-clawd-text-dim">Offline</span>
              </>
            )}
          </div>

          {/* Active indicators */}
          {listening && <Waveform level={isAgentMode ? 0.5 : micLevel} color="#60a5fa" />}
          {speaking && <Waveform level={0.6} color="#4ade80" />}
          {agentThinking && (
            <div className="flex items-center gap-1">
              <Loader2 size={14} className="text-yellow-400 animate-spin" />
              <span className="text-[10px] text-yellow-400">Thinking...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode toggle */}
          <button
            onClick={() => {
              const newMode = isAgentMode ? 'gemini' : 'agent';
              // Disconnect from current mode
              if (!isAgentMode && connected) geminiLive.disconnect();
              if (listening) stopListening();
              updateSettings({ voiceMode: newMode });
            }}
            className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              isAgentMode
                ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
            }`}
            title={`Switch to ${isAgentMode ? 'Gemini Live' : 'Agent'} mode`}
          >
            {isAgentMode ? '🤖 Agent' : '⚡ Gemini'}
          </button>

          {onSwitchToText && (
            <button onClick={onSwitchToText} className="p-1.5 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text" title="Text chat">
              <MessageSquare size={15} />
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-blue-500/20 text-blue-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'}`} title="Settings">
            <Settings size={15} />
          </button>
          <button onClick={clearHistory} className="p-1.5 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-red-400" title="Clear history">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-clawd-border bg-clawd-bg-alt space-y-3">
          {isAgentMode ? (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs text-clawd-text-dim w-14">Agent</label>
                <select
                  value={settings.selectedAgent}
                  onChange={e => updateSettings({ selectedAgent: e.target.value })}
                  className="flex-1 text-xs bg-clawd-bg border border-clawd-border rounded px-2 py-1 text-clawd-text"
                >
                  {AGENT_OPTIONS.map(a => (
                    <option key={a.id} value={a.id}>{a.emoji} {a.name} — {AGENTS[a.id]?.description || 'Agent'}</option>
                  ))}
                </select>
              </div>
              <div className="text-[10px] text-clawd-text-dim">
                Voice: {AGENT_VOICES[settings.selectedAgent]?.name || 'Default'} • 
                Session: {currentAgent.sessionKey}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs text-clawd-text-dim w-14">Voice</label>
                <select
                  value={settings.voice}
                  onChange={e => updateSettings({ voice: e.target.value as GeminiVoice })}
                  className="flex-1 text-xs bg-clawd-bg border border-clawd-border rounded px-2 py-1 text-clawd-text"
                >
                  {VOICE_OPTIONS.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-start gap-3">
                <label className="text-xs text-clawd-text-dim w-14 pt-1">System</label>
                <textarea
                  value={settings.systemInstruction}
                  onChange={e => updateSettings({ systemInstruction: e.target.value })}
                  className="flex-1 text-xs bg-clawd-bg border border-clawd-border rounded px-2 py-1 text-clawd-text resize-none"
                  rows={2}
                  placeholder="System instruction..."
                />
              </div>
            </>
          )}
          <p className="text-[10px] text-clawd-text-dim">
            {isAgentMode ? 'Speak or type to talk to your agent. Response spoken via Google TTS.' : 'Changes apply on next connection.'}
          </p>
        </div>
      )}

      {/* ── Video preview (Gemini mode only) ── */}
      {!isAgentMode && videoMode !== 'none' && (
        <div className="relative mx-4 mt-3 rounded-lg overflow-hidden bg-black" style={{ maxHeight: 200 }}>
          <video
            ref={videoPreviewRef}
            muted
            playsInline
            className="w-full h-full object-contain"
            style={{ maxHeight: 200, transform: videoMode === 'camera' ? 'scaleX(-1)' : undefined }}
          />
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5">
            {videoMode === 'camera' ? <Camera size={12} className="text-red-400" /> : <Monitor size={12} className="text-blue-400" />}
            <span className="text-[10px] text-white">{videoMode === 'camera' ? 'Camera' : 'Screen'} • 1fps</span>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim text-center">
            {isAgentMode ? (
              <>
                <span className="text-4xl mb-3">{currentAgent.emoji}</span>
                <p className="text-sm font-medium mb-1">Talk to {currentAgent.name}</p>
                <p className="text-xs opacity-70 max-w-xs">
                  Press the mic button and speak, or type a message.
                  {currentAgent.name} will respond with voice.
                </p>
              </>
            ) : (
              <>
                <Zap size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium mb-1">Gemini Live Voice Assistant</p>
                <p className="text-xs opacity-70 max-w-xs">
                  Real-time voice conversation with video context. 
                  Connect, enable your mic, and optionally share camera or screen.
                </p>
              </>
            )}
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
          >
            {msg.role === 'system' ? (
              <span className="text-[10px] text-clawd-text-dim bg-clawd-border/50 rounded-full px-3 py-1">
                {msg.content}
              </span>
            ) : (
              <div className="flex items-start gap-2 max-w-[85%]">
                {msg.role === 'model' && msg.agentId && (
                  <span className="text-base mt-1 flex-shrink-0">
                    {AGENT_OPTIONS.find(a => a.id === msg.agentId)?.emoji || '🤖'}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-clawd-border text-clawd-text rounded-bl-md'
                  }`}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Thinking indicator */}
        {agentThinking && (
          <div className="flex items-start gap-2">
            <span className="text-base mt-1">{currentAgent.emoji}</span>
            <div className="rounded-2xl px-3.5 py-2 bg-clawd-border rounded-bl-md">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-clawd-text-dim animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-clawd-text-dim animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-clawd-text-dim animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* ── Controls ── */}
      <div className="border-t border-clawd-border px-4 py-3 space-y-3">
        {/* Text input row */}
        {(isAgentMode || connected) && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAgentMode ? `Ask ${currentAgent.name}...` : 'Type a message...'}
              className="flex-1 bg-clawd-bg-alt border border-clawd-border rounded-lg px-3 py-2 text-sm text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-blue-500/50"
              disabled={agentThinking}
            />
            <button
              onClick={handleSendText}
              disabled={!textInput.trim() || agentThinking}
              className="p-2 rounded-lg bg-blue-600 text-white disabled:opacity-30 hover:bg-blue-500 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          {/* Camera toggle (Gemini only) */}
          {!isAgentMode && (
            <button
              onClick={() => toggleVideo('camera')}
              disabled={!connected}
              className={`p-2.5 rounded-full transition-all ${
                videoMode === 'camera'
                  ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text disabled:opacity-30'
              }`}
              title={videoMode === 'camera' ? 'Stop camera' : 'Start camera'}
            >
              {videoMode === 'camera' ? <VideoOff size={18} /> : <Camera size={18} />}
            </button>
          )}

          {/* Screen share toggle (Gemini only) */}
          {!isAgentMode && (
            <button
              onClick={() => toggleVideo('screen')}
              disabled={!connected}
              className={`p-2.5 rounded-full transition-all ${
                videoMode === 'screen'
                  ? 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/30'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text disabled:opacity-30'
              }`}
              title={videoMode === 'screen' ? 'Stop screen share' : 'Share screen'}
            >
              <Monitor size={18} />
            </button>
          )}

          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            disabled={!isAgentMode && !connected}
            className={`p-3.5 rounded-full transition-all ${
              listening
                ? 'bg-blue-500 text-white ring-4 ring-blue-500/30 shadow-lg shadow-blue-500/20'
                : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text disabled:opacity-30'
            }`}
            title={listening ? 'Stop listening' : 'Start listening'}
          >
            {listening ? <Mic size={22} /> : <MicOff size={22} />}
          </button>

          {/* Connect/Disconnect (Gemini mode) or Stop (Agent mode) */}
          {isAgentMode ? (
            // In agent mode: stop speaking button when speaking/thinking
            (speaking || agentThinking) ? (
              <button
                onClick={handleStopSpeaking}
                className="p-3.5 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all"
                title="Stop"
              >
                <PhoneOff size={22} />
              </button>
            ) : (
              <button
                onClick={toggleMic}
                className={`p-3.5 rounded-full transition-all ${
                  listening
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                    : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20'
                }`}
                title={listening ? 'Stop conversation' : 'Start conversation'}
              >
                {listening ? <PhoneOff size={22} /> : <Phone size={22} />}
              </button>
            )
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className={`p-3.5 rounded-full transition-all ${
                connected
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                  : connecting
                    ? 'bg-yellow-500/20 text-yellow-400 animate-pulse'
                    : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20'
              }`}
              title={connected ? 'Disconnect' : 'Connect'}
            >
              {connected ? <PhoneOff size={22} /> : <Phone size={22} />}
            </button>
          )}

          {/* Mute output */}
          <button
            onClick={() => {
              setMuted(!muted);
              if (!muted) stopSpeaking();
            }}
            className={`p-2.5 rounded-full transition-all ${
              muted ? 'bg-red-500/20 text-red-400' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
            }`}
            title={muted ? 'Unmute output' : 'Mute output'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Status text */}
        <div className="text-center">
          <span className="text-[10px] text-clawd-text-dim">
            {isAgentMode ? (
              agentThinking ? `${currentAgent.emoji} ${currentAgent.name} is thinking...` :
              speaking ? `🔊 ${currentAgent.name} is speaking... (click stop to interrupt)` :
              listening ? `🎙️ Listening... (speak to ${currentAgent.name})` :
              `Press mic to talk to ${currentAgent.name}`
            ) : (
              connecting ? 'Connecting...' : 
              !connected ? 'Press the green button to connect' :
              listening && speaking ? '🎙️ Listening • 🔊 Speaking (interrupt anytime)' :
              listening ? '🎙️ Listening...' :
              speaking ? '🔊 Speaking... (speak to interrupt)' :
              'Connected — press mic to start talking'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
