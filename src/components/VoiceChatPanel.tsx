/**
 * VoiceChatPanel - Voice Chat using Gemini Live API
 * 
 * Real-time bidirectional audio streaming with agent selection,
 * camera/screen video input, text input, tool calling, and interruption support.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Loader2,
  Trash2, MessageSquare, Monitor, MonitorOff, Video, VideoOff,
  Send, Settings, Zap, Brain, Volume1,
} from 'lucide-react';
import { Button, Select, Box, Flex } from '@radix-ui/themes';
import AgentAvatar from './AgentAvatar';
import AgentSelector, { ChatAgent, fetchAgentList } from './AgentSelector';
import ScreenSourcePicker, { ScreenSource } from './ScreenSourcePicker';
import DraggableVideoWindow from './DraggableVideoWindow';
import MarkdownMessage from './MarkdownMessage';
import { useStore } from '../store/store';
import { useUserSettings } from '../store/userSettings';
import { gateway } from '../lib/gateway';
import { geminiLive, GeminiTool, GeminiToolCall, VideoMode, getGeminiVoiceForAgent } from '../lib/geminiLiveService';
import { loadAgentContext, invalidateAgentContext, AgentContext } from '../lib/agentContext';
import { createLogger } from '../utils/logger';
import { Spinner } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';
import EmptyState from './EmptyState';

const logger = createLogger('VoiceChat');

// API key loading — fetches from authenticated server endpoint, never from client settings
async function loadApiKey(): Promise<string> {
  try {
    const { authHeaders } = await import('../lib/api');
    const res = await fetch('/api/gemini/live-token', { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      return data.apiKey || '';
    }
  } catch { /* ignore */ }
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

async function loadVoiceHistory(agentId: string): Promise<VoiceChatMessage[]> {
  try {
    const { chatApi } = await import('../lib/api');
    const messages = await chatApi.getMessages(`voice:${agentId}`);
    if (!Array.isArray(messages)) return [];
    return messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        id: m.id || `db-${m.timestamp}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }));
  } catch {
    return [];
  }
}

function saveVoiceMessage(agentId: string, msg: VoiceChatMessage) {
  if (msg.role === 'system') return;
  import('../lib/api').then(({ chatApi }) => {
    chatApi.saveMessage(`voice:${agentId}`, {
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || Date.now(),
      channel: 'voice',
    });
  }).catch(() => { /* non-critical */ });
}

export default function VoiceChatPanel({ agentId, sessionKey: _externalSessionKey, onSwitchToText, embedded }: VoiceChatPanelProps) {
  const { addActivity } = useStore();

  const chatAgents = fetchAgentList();
  const initialAgent = agentId
    ? chatAgents.find(a => a.id === agentId) || chatAgents[0]
    : chatAgents[0];
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
  
  // Screen picker state
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [_activeSourceId, setActiveSourceId] = useState<string | null>(null);
  
  // Audio context state
  const [audioState, setAudioState] = useState<'suspended' | 'running' | 'closed' | null>(null);
  
  // Audio levels
  const [micLevel, setMicLevel] = useState(0);
  const [speakLevel, setSpeakLevel] = useState(0);
  
  // Messages
  const msgCounter = useRef(0);
  const nextId = (suffix: string) => `vc-${Date.now()}-${++msgCounter.current}-${suffix}`;
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [audioInputs, setAudioInputs]   = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic]       = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  
  // Refs
  const callActiveRef = useRef(false);
  const apiKey = useRef('');

  // Load API key asynchronously on mount
  useEffect(() => {
    loadApiKey()
      .then(key => { apiKey.current = key; })
      .catch(err => logger.error('Failed to load API key:', err));
  }, []);
  
  // Agent context
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);
  const agentContextRef = useRef<AgentContext | null>(null);
  
  // Enumerate audio devices when settings panel opens
  // Must request mic permission first — otherwise labels/deviceIds are blank
  useEffect(() => {
    if (!showSettings) return;
    const enumerate = () =>
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
      });

    // Try enumerating — if labels are blank, request permission then re-enumerate
    enumerate().then(() => {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const hasLabels = devices.some(d => d.kind === 'audioinput' && d.label);
        if (!hasLabels) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              stream.getTracks().forEach(t => t.stop());
              enumerate();
            })
            .catch(() => {});
        }
      });
    }).catch(() => {});
  }, [showSettings]);

  // Sync agentId prop
  useEffect(() => {
    if (agentId) {
      const agent = chatAgents.find(a => a.id === agentId);
      if (agent && agent.id !== selectedAgent?.id) setSelectedAgent(agent);
    }
  }, [agentId, chatAgents, selectedAgent]);
  
  // Load agent context
  useEffect(() => {
    let cancelled = false;
    loadAgentContext(selectedAgent.id).then(ctx => {
      if (!cancelled) {
        setAgentContext(ctx);
        agentContextRef.current = ctx;
      }
    }).catch((err) => { logger.error('Failed to load agent context:', err); });
    return () => { cancelled = true; };
  }, [selectedAgent.id]);
  
  // Load history from SQLite on agent switch
  useEffect(() => {
    setHistoryLoaded(false);
    setLoadError(null);
    loadVoiceHistory(selectedAgent.id).then(msgs => {
      setMessages(msgs);
      setHistoryLoaded(true);
    }).catch((err) => {
      logger.error('Failed to load voice history:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load voice history');
      setMessages([]);
      setHistoryLoaded(true);
    });
  }, [selectedAgent.id]);
  
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
        addSystemMessage('Audio enabled');
      } catch (e: unknown) {
        addSystemMessage(`Audio resume failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  
  // ── Gemini Live event listeners ──
  useEffect(() => {
    const unsubs = [
      geminiLive.on('connected', () => {
        setCallActive(true);
        setConnecting(false);
        addSystemMessage('Connected — speak naturally');
      }),
      geminiLive.on('disconnected', ({ code }: { code?: number; reason?: string } = {}) => {
        const wasActive = callActiveRef.current;
        setConnecting(false);
        setListening(false);
        setSpeaking(false);
        setVideoActive(false);
        // Don't clear callActive/ref yet — auto-reconnect may restore it
        if (wasActive) {
          // Auto-reconnect will handle it; only show message if user manually disconnected
          if (code === 1000) {
            setCallActive(false);
            callActiveRef.current = false;
          }
        } else {
          setCallActive(false);
          callActiveRef.current = false;
        }
      }),
      geminiLive.on('reconnecting', ({ attempt }: { attempt: number; delayMs: number }) => {
        setConnecting(true);
        addSystemMessage(`Reconnecting... (attempt ${attempt})`);
      }),
      geminiLive.on('listening-start', () => setListening(true)),
      geminiLive.on('listening-end', () => setListening(false)),
      geminiLive.on('speaking-start', () => { setSpeaking(true); setSpeakLevel(0.5); }),
      geminiLive.on('speaking-end', () => { setSpeaking(false); setSpeakLevel(0); }),
      geminiLive.on('audio-level', ({ level }: { level: number }) => setMicLevel(level)),
      geminiLive.on('model-audio-level', ({ level }: { level: number }) => setSpeakLevel(level)),
      geminiLive.on('error', ({ message }: { message: string }) => {
        logger.error('Gemini error:', message);
        addSystemMessage(`${message}`);
      }),
      geminiLive.on('transcript', (data: { text: string; role: string }) => {
        if (!data.text?.trim()) return;
        const role = data.role === 'model' ? 'assistant' : 'user';
        const text = data.text.trim();
        
        // Debounced gateway logging — batch transcript fragments into complete messages
        const bufKey = role === 'user' ? '_userTranscriptBuf' : '_modelTranscriptBuf';
        const timerKey = role === 'user' ? '_userTranscriptTimer' : '_modelTranscriptTimer';
        const w = window as any;
        w[bufKey] = (w[bufKey] || '') + ' ' + text;
        if (w[timerKey]) clearTimeout(w[timerKey]);
        w[timerKey] = setTimeout(() => {
          const batch = (w[bufKey] || '').trim();
          w[bufKey] = '';
          const sessionKey = gateway.getSessionKey();
          if (batch && sessionKey) {
            gateway.request('chat.inject', {
              sessionKey,
              message: role === 'user' ? `[user] ${batch}` : batch,
            }).catch(() => { /* session may not exist — voice transcripts are optional */ });
          }
          // Persist the final debounced transcript batch to SQLite
          if (batch) {
            saveVoiceMessage(selectedAgent.id, {
              id: `vc-${Date.now()}-debounced`,
              role: role as 'user' | 'assistant',
              content: batch,
              timestamp: Date.now(),
            });
          }
        }, 2000); // Wait 2s of silence before flushing
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === role && Date.now() - last.timestamp < 3000) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: m.content + ' ' + text } : m);
          }
          return [...prev, { id: nextId(role === 'assistant' ? 'a' : 'u'), role, content: text, timestamp: Date.now() }];
        });
      }),
      geminiLive.on('model-thinking', (_evt: { text: string }) => {
        // Voice thinking update
      }),
      geminiLive.on('interrupted', () => {
        addSystemMessage('Interrupted');
      }),
      geminiLive.on('tool-call', async (toolCall: GeminiToolCall) => {
        try {
          if (!toolCall?.functionCalls?.length) return;
          // Keep WebSocket alive while executing tools
          geminiLive.startToolCallKeepalive();
          const responses: Array<{ id: string; name: string; response: any }> = [];
          for (const fc of toolCall.functionCalls) {
            // Tool call executed
            addSystemMessage(`${fc.name}(${Object.values(fc.args || {}).join(', ')})`);
            let result: any;
            try {
              result = await executeToolCall(fc.name, fc.args || {}, selectedAgent);
            } catch (toolErr: any) {
              // `[VoiceChat] Tool execution error for ${fc.name}:`, toolErr;
              result = { error: toolErr.message || 'Tool execution failed' };
              addSystemMessage(`${fc.name} failed: ${toolErr.message}`);
            }
            responses.push({ id: fc.id, name: fc.name, response: result });
            if (['create_task', 'update_task', 'spawn_agent'].includes(fc.name)) {
              invalidateAgentContext();
              loadAgentContext(selectedAgent.id).then(ctx => { agentContextRef.current = ctx; setAgentContext(ctx); }).catch((err) => { logger.error('Failed to reload agent context:', err); });
            }
          }
          try {
            await geminiLive.sendToolResponse(responses);
          } catch (sendErr: any) {
            // '[VoiceChat] Failed to send tool response:', sendErr;
            addSystemMessage(`Tool response send failed: ${sendErr.message}`);
          }
        } catch (outerErr: any) {
          geminiLive.stopToolCallKeepalive();
          // '[VoiceChat] Unexpected error in tool-call handler:', outerErr;
          addSystemMessage(`Tool call error: ${outerErr.message}`);
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [selectedAgent.id]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geminiLive.connected) geminiLive.disconnect();
      // Clear debounce timers stored on window to prevent post-unmount state updates
      const w = window as any;
      if (w._userTranscriptTimer) { clearTimeout(w._userTranscriptTimer); w._userTranscriptTimer = null; }
      if (w._modelTranscriptTimer) { clearTimeout(w._modelTranscriptTimer); w._modelTranscriptTimer = null; }
    };
  }, []);
  
  // ── Helpers ──
  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, { id: nextId('s'), role: 'system', content, timestamp: Date.now() }]);
  };
  
  // ── Call controls ──
  const startCall = async () => {
    if (!apiKey.current) {
      addSystemMessage('Gemini API key not configured. Add it in Settings \u2192 API Keys.');
      return;
    }
    
    setConnecting(true);
    callActiveRef.current = true;

    // Ensure gateway session exists for transcript logging
    gateway.setSessionKey(selectedAgent.sessionKey);
    gateway.request('chat.send', {
      message: `[Voice call started with ${selectedAgent.name}]`,
      sessionKey: selectedAgent.sessionKey,
      idempotencyKey: `voice-init-${Date.now()}`,
    }).catch((err) => { logger.error('Failed to send voice init message:', err); }); // Session creation is best-effort

    // Refresh agent context
    invalidateAgentContext(selectedAgent.id);
    loadAgentContext(selectedAgent.id).then(ctx => {
      agentContextRef.current = ctx;
      setAgentContext(ctx);
    }).catch((err) => { logger.error('Failed to refresh agent context:', err); });
    
    try {
      const voice = getGeminiVoiceForAgent(selectedAgent.id);
      await geminiLive.connect({
        apiKey: apiKey.current,
        voice,
        videoMode,
        systemInstruction: buildSystemInstruction(selectedAgent, agentContextRef.current, videoMode),
        tools: buildAgentTools(),
      });
      
      addActivity({ type: 'chat', message: `Voice call with ${selectedAgent.name}`, timestamp: Date.now() });
      await geminiLive.startMic(selectedMic || undefined);
      
      // Auto-start video if selected
      if (videoMode === 'camera') {
        try {
          await geminiLive.startVideo('camera');
          setVideoActive(true);
          addSystemMessage('Camera active');
          geminiLive.sendText('[SYSTEM: Camera is now active. You can see the user\'s face.]');
        } catch (_e) {
          // Camera activation failed silently — video mode already reset by state
        }
      } else if (videoMode === 'screen') {
        // Show picker instead of auto-sharing
        setShowScreenPicker(true);
      }
    } catch (err: unknown) {
      // '[VoiceChat] Connect failed:', err;
      addSystemMessage(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
      setConnecting(false);
      callActiveRef.current = false;
    }
  };
  
  const endCall = async () => {
    callActiveRef.current = false;
    setMicLevel(0);
    setSpeakLevel(0);
    await geminiLive.disconnect();
    addSystemMessage('Call ended');
  };
  
  const toggleMic = async () => {
    if (!callActive) return;
    if (listening) geminiLive.stopMic();
    else await geminiLive.startMic();
  };
  
  const stopVideo = () => {
    geminiLive.stopVideo();
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    setVideoActive(false);
    addSystemMessage('Video stopped');
    geminiLive.sendText('[SYSTEM: Camera/screen sharing has stopped. You can no longer see the user.]');
  };

  const toggleVideo = async () => {
    if (!callActive) return;
    if (videoActive) {
      stopVideo();
    } else {
      try {
        const mode = videoMode !== 'none' ? videoMode : 'camera';
        await geminiLive.startVideo(mode);
        setVideoActive(true);
        addSystemMessage(mode === 'camera' ? 'Camera active' : 'Screen sharing active');
        if (mode === 'screen') {
          geminiLive.sendText('[SYSTEM: Screen sharing is now active. You can see the user\'s screen.]');
        } else {
          geminiLive.sendText('[SYSTEM: Camera is now active. You can see the user\'s face.]');
        }
      } catch (e: unknown) {
        addSystemMessage(`Video failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  
  const toggleScreenShare = async () => {
    if (!callActive) return;
    if (videoActive && geminiLive.videoMode === 'screen') {
      geminiLive.stopVideo();
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
      setVideoActive(false);
      setActiveSourceId(null);
      geminiLive.sendText('[SYSTEM: Screen sharing has stopped. You can no longer see the screen.]');
    } else {
      // Show picker dialog
      setShowScreenPicker(true);
    }
  };
  
  const handleScreenSourceSelected = async (source: ScreenSource) => {
    setShowScreenPicker(false);
    try {
      if (videoActive) geminiLive.stopVideo();
      const sourceId = source.id === '__browser_picker__' ? undefined : source.id;
      await geminiLive.startVideo('screen', sourceId);
      setVideoActive(true);
      setActiveSourceId(source.id);
      addSystemMessage(`Sharing: ${source.name}`);
      geminiLive.sendText(`[SYSTEM: Screen sharing is now active. Sharing: ${source.name}. You can see the user's screen.]`);
    } catch (e: unknown) {
      addSystemMessage(`Screen share failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  
  const switchScreenSource = () => {
    if (callActive && videoActive && geminiLive.videoMode === 'screen') {
      setShowScreenPicker(true);
    }
  };
  
  const handleSendText = async () => {
    if (!textInput.trim() || !callActive) return;
    const text = textInput.trim();
    setTextInput('');
    const userMsg: VoiceChatMessage = { id: nextId('u'), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    // Persist text message to SQLite
    saveVoiceMessage(selectedAgent.id, userMsg);
    try {
      await geminiLive.sendText(text);
    } catch (e: unknown) {
      addSystemMessage(`Send failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  
  const clearHistory = () => {
    setMessages([]);
    import('../lib/api').then(({ chatApi }) => chatApi.deleteSession(`voice:${selectedAgent.id}`)).catch(() => {});
  };
  
  const handleAgentSwitch = async (agent: ChatAgent) => {
    if (callActive) await endCall();
    setSelectedAgent(agent);
    
    // Update gateway session for persistence
    gateway.setSessionKey(agent.sessionKey);
  };
  
  // ── Waveform ──
  const Waveform = ({ level, color, bars = 8, height = 32 }: { level: number; color: string; bars?: number; height?: number }) => (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = Math.max(0.12, level * (0.5 + Math.sin((Date.now() / 100) + i * 0.8) * 0.5));
        return (
          <div key={i} className="rounded-full transition-colors duration-75"
            style={{ width: 3, height: `${Math.max(15, h * 100)}%`, backgroundColor: color, opacity: 0.6 + h * 0.4 }} />
        );
      })}
    </div>
  );
  
  // ── Render ──
  if (!historyLoaded) {
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
        context={{ action: 'load voice chat', resource: 'messages' }}
        onRetry={() => { setLoadError(null); setHistoryLoaded(false); }}
      />
    );
  }

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* API Key Warning */}
      {!apiKey.current && (
        <div className="bg-error/10 border-b border-error/20 px-4 py-3 text-center">
          <p className="text-error text-sm font-medium">Gemini API key not configured</p>
          <p className="text-error/80 text-xs mt-1">Add it in Settings &rarr; API Keys</p>
        </div>
      )}
      
      {/* Header */}
      <Flex align="center" justify="between" className="px-6 py-4 bg-mission-control-surface border-b border-mission-control-border">
        <Flex align="center" gap="3">
          {embedded ? (
            <Flex align="center" gap="3">
              <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0 relative">
                <AgentAvatar agentId={selectedAgent.id} size="sm" />
                {speaking && <div className="absolute inset-0 rounded-full border-2 border-success animate-ping opacity-40" />}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-mission-control-text">{selectedAgent.name}</h1>
                <p className="text-sm text-mission-control-text-dim">Gemini Live voice chat</p>
              </div>
            </Flex>
          ) : (
            <Flex align="center" gap="3">
              <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0">
                <Mic size={24} className="text-mission-control-accent" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-mission-control-text">Voice Chat</h1>
                <p className="text-sm text-mission-control-text-dim">Real-time voice with Gemini Live</p>
              </div>
            </Flex>
          )}

          {callActive && (
            <Flex align="center" gap="2" className="ml-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success">Gemini Live</span>
              {agentContext && agentContext.tasks.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs tabular-nums text-mission-control-text-dim bg-mission-control-border/50 px-1.5 py-0.5 rounded-full" title={`${agentContext.tasks.length} tasks`}>
                  <Brain size={10} aria-hidden="true" />
                  {agentContext.tasks.length}
                </span>
              )}
              {speaking && <Waveform level={speakLevel} color="var(--color-success)" bars={5} height={20} />}
            </Flex>
          )}
        </Flex>

        <Flex align="center" gap="2">
          {onSwitchToText && (
            <button
              type="button"
              onClick={onSwitchToText}
              title="Switch to text chat"
              aria-label="Switch to text chat"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <MessageSquare size={16} />
            </button>
          )}

          <button
            type="button"
            data-voice-settings
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <Settings size={16} />
          </button>

          <button
            type="button"
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              muted
                ? 'bg-error/10 border border-error/30 text-error'
                : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            type="button"
            onClick={clearHistory}
            title="Clear history"
            aria-label="Clear history"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </Flex>
      </Flex>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-mission-control-border bg-mission-control-surface space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Microphone */}
            <div>
              <label htmlFor="mic-select" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Microphone</label>
              <Select.Root value={selectedMic || '__default__'} onValueChange={val => setSelectedMic(val === '__default__' ? '' : val)} disabled={callActive} size="1">
                <Select.Trigger id="mic-select" className="w-full" />
                <Select.Content>
                  <Select.Item value="__default__">System default</Select.Item>
                  {audioInputs.map(d => (
                    <Select.Item key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            {/* Speaker */}
            <div>
              <label htmlFor="speaker-select" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Speaker</label>
              <Select.Root value={selectedSpeaker || '__default__'} onValueChange={val => setSelectedSpeaker(val === '__default__' ? '' : val)} size="1">
                <Select.Trigger id="speaker-select" className="w-full" />
                <Select.Content>
                  <Select.Item value="__default__">System default</Select.Item>
                  {audioOutputs.map(d => (
                    <Select.Item key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 6)}`}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
          </div>
          {callActive && <p className="text-xs text-mission-control-text-dim">Mic selection takes effect on next call.</p>}
        </div>
      )}
      
      {/* Screen Source Picker Modal */}
      {showScreenPicker && (
        <ScreenSourcePicker
          onSelect={handleScreenSourceSelected}
          onCancel={() => setShowScreenPicker(false)}
        />
      )}
      
      {/* Draggable Video Window */}
      {videoActive && (
        <DraggableVideoWindow
          videoRef={videoPreviewRef}
          videoStream={geminiLive.getVideoStream()}
          videoMode={geminiLive.videoMode as 'camera' | 'screen'}
          onClose={stopVideo}
          onSwitchSource={geminiLive.videoMode === 'screen' ? switchScreenSource : undefined}
        />
      )}
      
      {/* Messages */}
      <div data-voice-transcript className="flex-1 overflow-y-auto p-4">
        {!historyLoaded && (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <Flex gap="1" className="mb-2">
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </Flex>
            <p className="text-xs text-mission-control-text-dim">Loading history...</p>
          </div>
        )}
        {historyLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative mb-4">
              <AgentAvatar agentId={selectedAgent.id} size="2xl" />
            </div>
            <EmptyState
              type="generic"
              description={`Press call to connect via Gemini Live. Real-time audio streaming with ${selectedAgent.name}.`}
              compact
            />
          </div>
        )}

        {historyLoaded && messages.map((msg, idx) => {
          if (msg.role === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="text-xs text-mission-control-text-dim bg-mission-control-border/50 px-3 py-1 rounded-full italic">
                  {msg.content}
                </span>
              </div>
            );
          }
          const prev = idx > 0 ? messages[idx - 1] : null;
          const isNewSpeaker = !prev || prev.role !== msg.role;
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isNewSpeaker ? 'mt-6' : 'mt-2'}`}>
              {msg.role === 'assistant' && (
                <div className={`flex-shrink-0 mr-2 ${isNewSpeaker ? '' : 'invisible'}`}>
                  <div className="relative">
                    <AgentAvatar agentId={selectedAgent.id} size="xs" />
                    {speaking && msg.id === messages.filter(m => m.role === 'assistant').pop()?.id && (
                      <div className="absolute -inset-1 rounded-full border-2 border-success animate-pulse" />
                    )}
                  </div>
                </div>
              )}
              <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {isNewSpeaker && msg.role === 'assistant' && (
                  <span className="text-xs font-medium text-success mb-1 px-1">{selectedAgent.name}</span>
                )}
                {isNewSpeaker && msg.role === 'user' && (
                  <span className="text-xs font-medium text-mission-control-accent mb-1 px-1">You</span>
                )}
                {msg.role === 'user' ? (
                  <div
                    className="text-sm px-4 py-2.5 rounded-[18px_18px_4px_18px] text-mission-control-text"
                    style={{ background: 'color-mix(in srgb, var(--mission-control-accent) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent)' }}
                  >
                    <p>{msg.content || '...'}</p>
                  </div>
                ) : (
                  <div className="text-sm text-mission-control-text">
                    {msg.content ? <MarkdownMessage content={msg.content} /> : <span className="text-mission-control-text-dim">...</span>}
                  </div>
                )}
                <div className="text-[11px] tabular-nums text-mission-control-text-dim/70 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Enable Audio button - shown when AudioContext is suspended */}
      {callActive && audioState === 'suspended' && (
        <div className="px-4 py-2 border-t border-warning/30 bg-warning/10">
          <Button
            variant="solid"
            color="amber"
            size="2"
            onClick={handleEnableAudio}
            className="w-full justify-center"
          >
            <Volume2 size={18} />
            Enable Audio
          </Button>
          <p className="text-center text-xs text-warning/70 mt-1">Browser requires a click to play audio</p>
        </div>
      )}
      
      {/* Audio visualizer */}
      {callActive && (
        <div className="px-4 py-3 border-t border-mission-control-border bg-mission-control-surface">
          <div className="flex items-center justify-center h-12">
            {listening && !speaking && (
              <Flex align="center" gap="3">
                {/* Listening pill badge */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 text-error text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                  Listening
                </span>
                <Waveform level={micLevel} color="var(--color-info)" bars={12} height={40} />
              </Flex>
            )}
            {speaking && (
              <Flex align="center" gap="3">
                {/* Speaking pill badge */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                  <Volume1 size={12} aria-hidden="true" />
                  {selectedAgent.name} speaking
                </span>
                <Waveform level={speakLevel} color="var(--color-success)" bars={12} height={40} />
              </Flex>
            )}
            {connecting && !listening && !speaking && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                Processing
              </span>
            )}
            {!listening && !speaking && !connecting && <span className="text-xs text-mission-control-text-dim">Tap mic to speak</span>}
          </div>
        </div>
      )}
      
      {/* Text input (during call) */}
      {callActive && (
        <div className="border-t border-mission-control-border bg-mission-control-bg px-4 py-3">
          <Flex gap="2" align="center">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSendText()}
              placeholder="Type a message (optional)…"
              className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-[14px] px-4 py-3 text-sm text-mission-control-text placeholder:text-mission-control-text-dim outline-none focus:border-[var(--mission-control-accent)] focus:ring-2 focus:ring-[var(--mission-control-accent)]/20 transition-colors"
            />
            <button
              type="button"
              onClick={handleSendText}
              disabled={!textInput.trim()}
              title="Send text"
              aria-label="Send text"
              className="w-8 h-8 rounded-lg bg-[var(--mission-control-accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </Flex>
        </div>
      )}
      
      {/* Call controls */}
      <div className="border-t border-mission-control-border p-4">
        <Flex align="center" justify="center" gap="4">
          {callActive && (
            <button
              type="button"
              data-voice-meeting
              onClick={toggleMic}
              disabled={speaking}
              title={listening ? 'Pause mic' : 'Resume mic'}
              aria-label={listening ? 'Pause mic' : 'Resume mic'}
              className={`inline-flex items-center justify-center w-14 h-14 rounded-full p-4 transition-colors ${
                listening
                  ? 'bg-error/10 border border-error/30 text-error ring-2 ring-[var(--color-error)]/50 ring-offset-2 ring-offset-mission-control-bg animate-pulse'
                  : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface/50'
              }`}
            >
              {listening ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
          )}

          <button
            type="button"
            data-voice-orb
            onClick={() => callActive ? endCall() : startCall()}
            disabled={connecting}
            title={callActive ? 'End call' : 'Start call'}
            aria-label={callActive ? 'End call' : 'Start call'}
            className={`rounded-full p-5 flex items-center justify-center transition-colors ${
              callActive
                ? 'bg-error hover:bg-error/90 text-white'
                : 'bg-success hover:bg-success/90 text-white'
            } disabled:opacity-50`}
          >
            {connecting ? <Loader2 size={26} className="animate-spin" /> : callActive ? <PhoneOff size={26} /> : <Phone size={26} />}
          </button>

          {callActive && (
            <>
              <button
                type="button"
                onClick={toggleScreenShare}
                title="Screen share"
                aria-label="Screen share"
                className={`inline-flex items-center justify-center w-14 h-14 rounded-full p-4 transition-colors ${
                  videoActive && geminiLive.videoMode === 'screen'
                    ? 'bg-mission-control-accent/10 border border-mission-control-accent/30 text-mission-control-accent'
                    : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface/50'
                }`}
              >
                {videoActive && geminiLive.videoMode === 'screen' ? <MonitorOff size={22} /> : <Monitor size={22} />}
              </button>
              <button
                type="button"
                onClick={toggleVideo}
                title="Camera"
                aria-label="Camera"
                className={`inline-flex items-center justify-center w-14 h-14 rounded-full p-4 transition-colors ${
                  videoActive && geminiLive.videoMode === 'camera'
                    ? 'bg-mission-control-accent/10 border border-mission-control-accent/30 text-mission-control-accent'
                    : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface/50'
                }`}
              >
                {videoActive && geminiLive.videoMode === 'camera' ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
            </>
          )}
        </Flex>

        {!callActive && !connecting && (
          <p className="text-center text-xs text-mission-control-text-dim mt-3">Press call to connect via Gemini Live</p>
        )}
      </div>
    </Flex>
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
          status: { type: 'string', description: 'New status', enum: ['todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done'] },
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
          status: { type: 'string', description: 'Filter by status', enum: ['todo', 'internal-review', 'in-progress', 'review', 'human-review', 'done', 'all'] },
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
    {
      name: 'read_file',
      description: 'Read a file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (e.g., ~/mission-control/SOUL.md)' },
          max_lines: { type: 'number', description: 'Max lines to read (default 100)' },
        },
        required: ['path'],
      },
    },
    {
      name: 'run_command',
      description: 'Execute a shell command (allowlist: cat, head, tail, ls, find, grep, git, date, echo, wc, which, node, npx, python3, curl, df, uptime, ps, who).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to run' },
        },
        required: ['command'],
      },
    },
    {
      name: 'send_message',
      description: 'Send a message to a Discord channel.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name (e.g., homebase)' },
          message: { type: 'string', description: 'Message text' },
        },
        required: ['channel', 'message'],
      },
    },
    {
      name: 'search_workspace',
      description: 'Search for text in workspace files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
        },
        required: ['query'],
      },
    },
    {
      name: 'web_search',
      description: 'Search the web for information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
    {
      name: 'check_calendar',
      description: 'Check upcoming calendar events.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days ahead to check (default 1)' },
        },
      },
    },
    {
      name: 'memory_search',
      description: 'Search through agent memory files for context.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for in memory' },
          agent_id: { type: 'string', description: 'Agent whose memory to search (default: mission-control)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'write_memory',
      description: 'Write a note to today\'s memory file.',
      parameters: {
        type: 'object',
        properties: {
          note: { type: 'string', description: 'Note to save' },
          agent_id: { type: 'string', description: 'Agent whose memory to write to (default: voice)' },
        },
        required: ['note'],
      },
    },
    {
      name: 'send_whatsapp',
      description: 'Send a WhatsApp message via the gateway.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient (phone number or name)' },
          message: { type: 'string', description: 'Message text' },
        },
        required: ['to', 'message'],
      },
    },
    {
      name: 'check_email',
      description: 'Check recent emails.',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of recent emails to check (default 5)' },
        },
      },
    },
  ];
}

// ── Input sanitization helpers ──
function shellSafe(input: unknown): string {
  return String(input ?? '').replace(/[^a-zA-Z0-9 _.,@:/#=+\-\n]/g, '');
}

function isCleanId(id: unknown): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// ── Tool call executor ──
async function executeToolCall(fnName: string, args: Record<string, any>, currentAgent: ChatAgent): Promise<any> {
  try {
    switch (fnName) {
      case 'create_task': {
        const title = args.title || 'Untitled task';
        const assignee = isCleanId(args.assigned_to) ? args.assigned_to : currentAgent.id;
        const r = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, assigned_to: assignee, priority: args.priority || 'medium', status: args.status || 'todo', description: args.description }),
        }).then(res => res.json());
        invalidateAgentContext(assignee);
        return { success: true, task_created: title, id: r.id };
      }
      case 'update_task': {
        if (!isCleanId(args.task_id)) return { error: 'Invalid task ID' };
        const updates: Record<string, unknown> = {};
        if (args.status && isCleanId(args.status)) updates.status = args.status;
        if (args.priority && isCleanId(args.priority)) updates.priority = args.priority;
        if (args.assigned_to && isCleanId(args.assigned_to)) updates.assigned_to = args.assigned_to;
        await fetch(`/api/tasks/${args.task_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        invalidateAgentContext();
        return { success: true };
      }
      case 'list_tasks': {
        const params = new URLSearchParams();
        if (args.agent_id && isCleanId(args.agent_id)) params.set('assigned_to', args.agent_id);
        if (args.status && args.status !== 'all' && isCleanId(args.status)) params.set('status', args.status);
        params.set('limit', '15');
        const tasks = await fetch(`/api/tasks?${params}`).then(r => r.json()).catch(() => []);
        return { tasks: Array.isArray(tasks) ? tasks : [] };
      }
      case 'spawn_agent': {
        if (!isCleanId(args.agent_id)) return { error: 'Invalid agent ID' };
        if (args.task_title) {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: args.task_title, assigned_to: args.agent_id, priority: 'high', status: 'todo' }),
          });
        }
        await fetch(`/api/agents/${args.agent_id}/spawn`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: args.message }),
        }).catch(() => {});
        invalidateAgentContext(args.agent_id);
        return { success: true, agent_spawned: args.agent_id };
      }
      case 'get_agent_status': {
        if (!isCleanId(args.agent_id)) return { error: 'Invalid agent ID' };
        const ctx = await loadAgentContext(args.agent_id);
        return {
          agent: args.agent_id,
          personality: ctx.personality ? `${ctx.personality.emoji} ${ctx.personality.name} - ${ctx.personality.role}` : 'Unknown',
          tasks: ctx.tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority })),
          active_sessions: ctx.sessions.filter(s => s.state === 'running' || s.state === 'active').length,
        };
      }
      case 'read_file': {
        // File reading not available in web mode
        return { error: 'read_file not available in web mode — use memory_search instead' };
      }
      case 'run_command': {
        // Shell execution not available in web mode
        return { error: 'run_command not available in web mode' };
      }
      case 'send_message': {
        // Inter-agent messaging via chat rooms API
        const r = await fetch('/api/chat-rooms/general/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: currentAgent.id, content: args.message }),
        }).then(res => res.json()).catch(() => ({ success: false }));
        return { success: !!r, message_sent: args.message };
      }
      case 'search_workspace': {
        const results = await fetch(`/api/library/files?q=${encodeURIComponent(args.query || '')}`)
          .then(r => r.json()).catch(() => []);
        return { files: Array.isArray(results) ? results.map((f: any) => f.path || f.name) : [] };
      }
      case 'web_search': {
        const query = args.query || '';
        const encodedQuery = encodeURIComponent(query);

        try {
          const r = await fetch(`https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1`)
            .then(res => res.json()).then(data => ({ stdout: JSON.stringify(data) })).catch(() => ({ stdout: '' }));
          
          if (!r.stdout) {
            return { output: 'Search failed - no response from DuckDuckGo' };
          }
          
          // Parse JSON response
          let data;
          try {
            data = JSON.parse(r.stdout);
          } catch {
            return { output: 'Search failed - invalid response format' };
          }
          
          // Build voice-friendly output
          let output = '';
          
          // Check for Abstract (direct answer)
          if (data.AbstractText) {
            output = `${data.AbstractText}\n\nSource: ${data.AbstractSource || 'DuckDuckGo'}`;
            if (data.AbstractURL) {
              output += `\nMore info: ${data.AbstractURL}`;
            }
          }
          // Check for Answer (instant answer)
          else if (data.Answer) {
            output = data.Answer;
          }
          // Check for RelatedTopics (search results)
          else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            output = 'Top results:\n\n';
            const topics = data.RelatedTopics.slice(0, 5);
            topics.forEach((topic: any, idx: number) => {
              if (topic.Text) {
                // Remove HTML tags from text
                const cleanText = topic.Text.replace(/<[^>]*>/g, '');
                output += `${idx + 1}. ${cleanText}\n`;
                if (topic.FirstURL) {
                  output += `   ${topic.FirstURL}\n`;
                }
                output += '\n';
              }
            });
          }
          // No results found
          else {
            output = `No direct results found for "${query}". Try rephrasing your search.`;
          }
          
          // Limit length for voice (2000 chars)
          return { output: output.slice(0, 2000) };
          
        } catch (error) {
          return { output: `Search error: ${error instanceof Error ? error.message : 'Unknown error'}` };
        }
      }
      case 'check_calendar': {
        // Calendar integration not available in web mode
        return { output: 'Calendar not available in web mode' };
      }
      case 'memory_search': {
        const results = await fetch(`/api/library/files?q=${encodeURIComponent(args.query || '')}`)
          .then(r => r.json()).catch(() => []);
        return { results: Array.isArray(results) ? results.slice(0, 10).map((f: any) => f.name || f.path).join('\n') : 'No matches found' };
      }
      case 'write_memory': {
        const today = new Date().toISOString().split('T')[0];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        await fetch('/api/library/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `memory-${today}.md`, content: `\n## ${time}\n${args.note || ''}`, agentId: args.agent_id || 'voice' }),
        }).catch(() => {});
        return { success: true, message: `Note saved` };
      }
      case 'send_whatsapp': {
        // WhatsApp not available in web mode
        return { success: false, error: 'WhatsApp sending not available in web mode' };
      }
      case 'check_email': {
        // Email integration not available in web mode
        return { output: 'Email not available in web mode' };
      }
      default:
        return { error: `Unknown tool: ${fnName}` };
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ── System instruction builder ──
function buildSystemInstruction(agent: ChatAgent, context?: AgentContext | null, currentVideoMode?: VideoMode): string {
  const parts: string[] = [];

  // VOICE-OPTIMIZED: Minimal core identity only (~200 tokens)
  if (context?.personality) {
    const p = context.personality;
    parts.push(`You are ${p.name} (${p.emoji}), ${p.role}. ${p.personality}.`);
  } else {
    parts.push(`You are ${agent.name}, ${agent.role || 'an AI assistant'}.`);
  }

  // Essential facts only
  parts.push(`Current date: ${new Date().toLocaleString()}`);
  const userName = useUserSettings.getState().name;
  if (userName) {
    parts.push(`Your human: ${userName}.`);
  }
  
  // Team roster (one-liners only, ~150 tokens)
  parts.push(`Your team: Coder (code/builds), Writer (content), Researcher (analysis), Chief (complex projects), Clara (quality review), Designer (UI/UX), HR (agent management), Jess (psychology/therapy).`);

  // Voice behavior (~100 tokens)
  parts.push(`\nVoice chat mode: Be conversational and concise (1-3 sentences). Natural speech, no markdown. Use tools proactively — don't ask permission, just do it.`);

  // Tool awareness with memory/database emphasis (~400 tokens)
  parts.push(`\n## Your Tools
Use these proactively when needed:

**Memory & Database:**
- memory_search — Search your memory files for context, past work, decisions
- read_file — Read SOUL.md, AGENTS.md, MEMORY.md, or any workspace file
- run_command — Execute shell commands (git, grep, ls, etc.)

**Task Management:**
- create_task, update_task, list_tasks — Manage Kanban tasks
- spawn_agent, get_agent_status — Work with other agents

**Communication:**
- send_message — Discord messages
- send_whatsapp — WhatsApp messages

**System:**
- search_workspace — Find files in workspace
- check_calendar, check_email — Check schedule/inbox
- web_search — Search internet
- write_memory — Save notes for later

**CRITICAL:** When you don't know something (agent details, past work, workflow rules), USE TOOLS to look it up:
- memory_search for "what did I do with [topic]"
- read_file ~/mission-control/SOUL.md for your full personality
- read_file ~/mission-control/AGENTS.md for workflow rules
- list_tasks to see current work
- read_file ~/mission-control/agents/{agent}/SOUL.md for other agents' details

Don't say "I don't have access to that info" — use tools to GET the info.`);

  // Video/screen awareness
  if (currentVideoMode && currentVideoMode !== 'none') {
    parts.push(`\n## Visual Context
You can currently SEE ${currentVideoMode === 'camera' ? "the user's camera feed" : "the user's screen"}.
Frames are sent every second. Reference what you see when relevant.
If they ask "what do you see?" — describe what's visible.`);
  }

  if (context?.tasks?.length) {
    parts.push(`\nYour current tasks:`);
    for (const t of context.tasks.slice(0, 10)) {
      parts.push(`- [${t.status}] ${t.title} (${t.priority})`);
    }
  }

  return parts.join('\n');
}
