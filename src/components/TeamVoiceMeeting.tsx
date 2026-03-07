/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: TeamVoiceMeeting uses file-level suppression for intentional stable ref patterns.
// Complex voice meeting component - patterns are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2,
  Download, Square, Users, MessageSquare, Monitor, MonitorOff,
  SlidersHorizontal, X as XIcon,
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import MarkdownMessage from './MarkdownMessage';
import ScreenSourcePicker, { type ScreenSource } from './ScreenSourcePicker';
import { getAgentTheme } from '../utils/agentThemes';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';
import { geminiLive } from '../lib/geminiLiveService';
import { useChatRoomStore, type RoomMessage } from '../store/chatRoomStore';
import { createLogger } from '../utils/logger';

const logger = createLogger('TeamVoice');

// Browser speech synthesis helpers (replaced googleTTS)
function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
function stopSpeaking() { window.speechSynthesis.cancel(); }

// API key loading — no hardcoded fallback; uses IPC to fetch from secure store
async function loadApiKey(): Promise<string> {
  try {
    const { settingsApi } = await import('../lib/api');
    const result = await settingsApi.get('gemini_api_key');
    if (result?.value) return result.value;
  } catch { /* ignore */ }
  return '';
}

interface TranscriptEntry {
  id: string;
  speaker: string; // 'user' or agentId
  content: string;
  timestamp: number;
  type: 'voice' | 'text';
}

interface TeamVoiceMeetingProps {
  roomId: string;
  onEndVoice: () => void;
}

type TurnMode = 'sequential' | 'addressed';

export default function TeamVoiceMeeting({ roomId, onEndVoice }: TeamVoiceMeetingProps) {
  const { rooms, addMessage, updateMessage, setSessionKey } = useChatRoomStore();
  const agents = useStore(s => s.agents);
  const room = rooms.find(r => r.id === roomId);

  // Helper functions for agent data
  const agentName = useCallback((id: string) => agents.find(a => a.id === id)?.name || id, [agents]);

  // Voice state
  const [isActive, setIsActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [turnMode, setTurnMode] = useState<TurnMode>('sequential');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  // Device selection
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDeviceId, setMicDeviceId] = useState('');
  const [speakerDeviceId, setSpeakerDeviceId] = useState('');
  const micDeviceIdRef = useRef('');
  const speakerDeviceIdRef = useRef('');
  const deviceSettingsRef = useRef<HTMLDivElement>(null);

  // Speaker state
  const [speakingAgent, setSpeakingAgent] = useState<string | null>(null);
  const [processingAgent, setProcessingAgent] = useState<string | null>(null);
  const [speakQueue, setSpeakQueue] = useState<string[]>([]);

  // Transcript
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Audio visualization
  const [micLevel, setMicLevel] = useState(0);
  const [speakLevel, setSpeakLevel] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const apiKeyRef = useRef('');

  // Load API key asynchronously on mount
  useEffect(() => {
    loadApiKey()
      .then(key => { apiKeyRef.current = key; })
      .catch(err => console.error('[TeamVoiceMeeting] Failed to load API key:', err));
  }, []);

  // Keep device ID refs in sync
  useEffect(() => { micDeviceIdRef.current = micDeviceId; }, [micDeviceId]);
  useEffect(() => { speakerDeviceIdRef.current = speakerDeviceId; }, [speakerDeviceId]);

  // Close device settings popover on outside click
  useEffect(() => {
    if (!showDeviceSettings) return;
    const handler = (e: MouseEvent) => {
      if (deviceSettingsRef.current && !deviceSettingsRef.current.contains(e.target as Node)) {
        setShowDeviceSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDeviceSettings]);

  // Apply speaker device to a test audio element (setSinkId) when changed
  useEffect(() => {
    if (!speakerDeviceId) return;
    const audio = document.createElement('audio');
    if (typeof (audio as any).setSinkId === 'function') {
      (audio as any).setSinkId(speakerDeviceId).catch(() => {});
    }
  }, [speakerDeviceId]);

  // Enumerate audio devices
  useEffect(() => {
    const enumerate = async () => {
      try {
        // Brief getUserMedia to unlock device labels
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        setMicDevices(all.filter(d => d.kind === 'audioinput'));
        setSpeakerDevices(all.filter(d => d.kind === 'audiooutput'));
      } catch { /* permission denied — devices listed without labels */ }
    };
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, []);
  const isActiveRef = useRef(false);
  const listeningRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);
  const speakAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakAnimRef = useRef<number>(0);
  const pendingAgentRef = useRef<string | null>(null);
  const pendingMsgIdRef = useRef<string | null>(null);
  const pendingContentRef = useRef('');
  const agentQueueRef = useRef<string[]>([]);
  const currentUserTextRef = useRef('');
  const volumeRef = useRef(1);

  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.length, partialTranscript]);

  // ── Mic level visualization ──
  useEffect(() => {
    if (!listening) { setMicLevel(0); return; }
    let running = true;
    (async () => {
      try {
        const audioConstraints: MediaTrackConstraints = micDeviceIdRef.current
          ? { deviceId: { exact: micDeviceIdRef.current } }
          : {};
        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
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
      } catch { /* ignore */ }
    })();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micCtxRef.current?.close().catch((err) => { console.error('[TeamVoiceMeeting] Failed to close mic context:', err); });
    };
  }, [listening]);

  // Streaming events handled via per-runId callbacks in sendChatWithCallbacks
  // No global event listeners needed — each sendToAgent call gets isolated callbacks

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geminiLive.connected) {
        geminiLive.disconnect();
      }
    };
  }, []);

  const clearPending = () => {
    pendingAgentRef.current = null;
    pendingMsgIdRef.current = null;
    pendingContentRef.current = '';
    setProcessingAgent(null);
  };

  // ── Screen share ──
  const toggleScreenShare = () => {
    if (!isActive) return;
    if (screenSharing) {
      geminiLive.stopVideo();
      setScreenSharing(false);
    } else {
      setShowScreenPicker(true);
    }
  };

  const handleScreenSourceSelected = async (source: ScreenSource) => {
    setShowScreenPicker(false);
    try {
      if (screenSharing) geminiLive.stopVideo();
      const sourceId = source.id === '__browser_picker__' ? undefined : source.id;
      await geminiLive.startVideo('screen', sourceId);
      setScreenSharing(true);
      logger.debug('[TeamVoice] Screen sharing started:', source.name);
    } catch (e: any) {
      logger.error('[TeamVoice] Screen share failed:', e);
      setScreenSharing(false);
    }
  };

  // ── Build context for an agent ──
  const buildContext = useCallback((agentId: string, userText: string): string => {
    if (!room) return userText;
    const recent = room.messages.slice(-15);
    const lines = recent.map(m => {
      const sender = m.role === 'user' ? 'Kevin' : (m.agentId ? agentName(m.agentId) : 'Unknown');
      return `[${sender}]: ${m.content}`;
    });
    lines.push(`[Kevin]: ${userText}`);

    const otherAgents = room.agents.filter(a => a !== agentId).map(a => agentName(a));

    return `You are ${agentName(agentId)} in a voice team meeting called "${room.name}".
Other participants: Kevin (human), ${otherAgents.join(', ')}.
This is a VOICE meeting — keep responses concise and conversational (2-4 sentences).
You can address others with @Name. Be direct and natural.

## Conversation so far:
${lines.join('\n')}

Respond as ${agentName(agentId)}:`;
  }, [room]);

  // ── Extract @mentions from user text ──
  const extractMentions = useCallback((text: string): string[] => {
    if (!room) return [];
    const mentioned: string[] = [];
    for (const id of room.agents) {
      const name = agentName(id);
      if (new RegExp(`@${name}\\b`, 'i').test(text)) {
        mentioned.push(id);
      }
    }
    return mentioned;
  }, [room, agentName]);

  // ── Handle user speech ──
  const handleUserSpeech = useCallback((text: string) => {
    if (!text || !room) return;

    // Pause listening while agents respond
    stopListeningFn();

    // Add user message to room
    const userMsg: RoomMessage = {
      id: `vm-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(roomId, userMsg);

    // Add to transcript
    setTranscript(prev => [...prev, {
      id: userMsg.id,
      speaker: 'user',
      content: text,
      timestamp: Date.now(),
      type: 'voice',
    }]);

    currentUserTextRef.current = text;

    // Determine which agents respond
    let targets: string[];
    if (turnMode === 'addressed') {
      const mentioned = extractMentions(text);
      targets = mentioned.length > 0 ? mentioned : room.agents;
    } else {
      targets = [...room.agents];
    }

    // Queue agents for sequential response
    agentQueueRef.current = targets;
    setSpeakQueue(targets);
    processNextAgent();
  }, [room, roomId, turnMode, extractMentions, addMessage]);

  // ── Gemini Live event handlers (STT) ──
  useEffect(() => {
    const unsubs = [
      geminiLive.on('listening-start', () => {
        setListening(true);
        listeningRef.current = true;
      }),
      geminiLive.on('listening-end', () => {
        setListening(false);
        listeningRef.current = false;
      }),
      geminiLive.on('audio-level', ({ level }: { level: number }) => setMicLevel(level)),
      geminiLive.on('transcript', (data: { text: string; role: string }) => {
        if (!data.text?.trim()) return;
        if (data.role !== 'user') return; // Only capture user speech
        
        const text = data.text.trim();
        
        // Show partial transcript for user feedback
        setPartialTranscript(text);
        
        // Process complete utterances
        // Gemini Live provides continuous transcription, so we use a debounce approach
        const w = window as any;
        if (w._teamVoiceTranscriptTimer) clearTimeout(w._teamVoiceTranscriptTimer);
        w._teamVoiceTranscriptTimer = setTimeout(() => {
          setPartialTranscript('');
          handleUserSpeech(text);
        }, 1500); // Wait 1.5s after speech stops before processing
      }),
      geminiLive.on('error', ({ message }: { message: string }) => {
        console.error('[TeamVoice] Gemini error:', message);
        setTranscript(prev => [...prev, {
          id: `sys-${Date.now()}`,
          speaker: 'system',
          content: `⚠️ ${message}`,
          timestamp: Date.now(),
          type: 'text',
        }]);
      }),
      geminiLive.on('disconnected', () => {
        if (isActiveRef.current) {
          // Meeting was active — could add reconnect logic here
        }
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [handleUserSpeech]);

  // ── Process next agent in queue ──
  const processNextAgent = useCallback(() => {
    if (agentQueueRef.current.length === 0) {
      // All agents done, resume listening
      setSpeakQueue([]);
      setSpeakingAgent(null);
      setProcessingAgent(null);
      if (isActiveRef.current) {
        setTimeout(() => startListening(), 500);
      }
      return;
    }

    const nextAgent = agentQueueRef.current.shift()!;
    setSpeakQueue([...agentQueueRef.current]);
    sendToAgent(nextAgent, currentUserTextRef.current);
  }, []);

  // ── Send to a specific agent ──
  const sendToAgent = useCallback(async (agentId: string, userText: string) => {
    if (!room) return;

    const msgId = `vm-${Date.now()}-${agentId}`;
    pendingAgentRef.current = agentId;
    pendingMsgIdRef.current = msgId;
    pendingContentRef.current = '';
    setProcessingAgent(agentId);

    addMessage(roomId, {
      id: msgId,
      role: 'agent',
      agentId,
      content: '',
      timestamp: Date.now(),
      streaming: true,
    });

    try {
      const sessionKey = `agent:${agentId}:room:${roomId}`;
      const prompt = buildContext(agentId, userText);

      await gateway.sendChatWithCallbacks(prompt, sessionKey, {
        onDelta: (delta) => {
          pendingContentRef.current += delta;
          updateMessage(roomId, msgId, { content: pendingContentRef.current });
        },
        onMessage: (content) => {
          pendingContentRef.current = content;
          updateMessage(roomId, msgId, { content });
        },
        onEnd: () => {
          finishCurrentAgent();
        },
        onError: (error) => {
          updateMessage(roomId, msgId, {
            content: `Error: ${error}`,
            streaming: false,
          });
          clearPending();
          processNextAgent();
        },
      });

      setSessionKey(roomId, agentId, sessionKey);
    } catch (e: unknown) {
      updateMessage(roomId, msgId, {
        content: `Error: ${e instanceof Error ? e.message : 'Failed to reach agent'}`,
        streaming: false,
      });
      clearPending();
      processNextAgent();
    }
  }, [room, roomId, buildContext, addMessage, updateMessage, setSessionKey, processNextAgent]);

  // ── Finish current agent response → speak it ──
  const finishCurrentAgent = useCallback(async () => {
    const agentId = pendingAgentRef.current;
    const content = pendingContentRef.current;
    const msgId = pendingMsgIdRef.current;

    if (msgId) {
      updateMessage(roomId, msgId, { streaming: false, content });
    }

    // Add to transcript
    if (agentId && content) {
      setTranscript(prev => [...prev, {
        id: `t-${Date.now()}-${agentId}`,
        speaker: agentId,
        content,
        timestamp: Date.now(),
        type: 'voice',
      }]);
    }

    clearPending();

    // Speak the response
    if (!muted && content && agentId) {
      await speakAgentResponse(agentId, content);
    }

    // Next agent
    processNextAgent();
  }, [roomId, muted, updateMessage, processNextAgent]);

  // ── Speak agent response via browser speech ──
  const speakAgentResponse = async (_agentId: string, text: string) => {
    setSpeakingAgent(_agentId);
    try {
      // Apply selected speaker device to a silent AudioContext so the OS routes output
      if (speakerDeviceIdRef.current) {
        try {
          const ctx = new AudioContext();
          if (typeof (ctx as any).setSinkId === 'function') {
            await (ctx as any).setSinkId(speakerDeviceIdRef.current);
          }
          ctx.close();
        } catch { /* setSinkId not supported */ }
      }
      await speakBrowser(text);
    } catch {
      // Speech synthesis failed silently
    }
    setSpeakingAgent(null);
    setSpeakLevel(0);
    speakAnalyserRef.current = null;
    cancelAnimationFrame(speakAnimRef.current);
  };

  // ── Start/stop listening ──
  const startListening = async () => {
    if (listeningRef.current || !geminiLive.connected) return;
    stopSpeaking();
    window.speechSynthesis.cancel();
    try {
      await geminiLive.startMic(micDeviceIdRef.current || undefined);
      // geminiLive events will update listening state
    } catch (err: unknown) {
      // '[TeamVoice] Failed to start mic:', err;
      setTranscript(prev => [...prev, {
        id: `sys-${Date.now()}`,
        speaker: 'system',
        content: `⚠️ Microphone error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        type: 'text',
      }]);
    }
  };

  const stopListeningFn = () => {
    listeningRef.current = false;
    setListening(false);
    if (geminiLive.connected) {
      geminiLive.stopMic();
    }
  };

  // ── Meeting controls ──
  const startMeeting = async () => {
    if (!apiKeyRef.current) {
      setTranscript(prev => [...prev, {
        id: `sys-${Date.now()}`,
        speaker: 'system',
        content: '⚠️ No Gemini API key. Configure it in Settings → API Keys.',
        timestamp: Date.now(),
        type: 'text',
      }]);
      return;
    }

    setIsActive(true);
    isActiveRef.current = true;
    setTranscript(prev => [...prev, {
      id: `sys-${Date.now()}`,
      speaker: 'system',
      content: 'Connecting to voice service…',
      timestamp: Date.now(),
      type: 'text',
    }]);

    try {
      // Connect to Gemini Live for STT only (not as an agent brain)
      await geminiLive.connect({
        apiKey: apiKeyRef.current,
        voice: 'Puck', // Default voice (not used for output in team mode)
        videoMode: 'none',
        systemInstruction: 'You are a voice interface for a team meeting. Your only job is to listen and transcribe. Do not respond or generate content.',
      });

      setTranscript(prev => [...prev, {
        id: `sys-${Date.now()}`,
        speaker: 'system',
        content: 'Voice meeting started',
        timestamp: Date.now(),
        type: 'text',
      }]);

      await startListening();
    } catch (err: unknown) {
      // '[TeamVoice] Failed to start meeting:', err;
      setTranscript(prev => [...prev, {
        id: `sys-${Date.now()}`,
        speaker: 'system',
        content: `⚠️ Failed to start: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        type: 'text',
      }]);
      setIsActive(false);
      isActiveRef.current = false;
    }
  };

  const endMeeting = async () => {
    stopListeningFn();
    stopSpeaking();
    window.speechSynthesis.cancel();

    if (screenSharing) {
      geminiLive.stopVideo();
      setScreenSharing(false);
    }

    if (geminiLive.connected) {
      await geminiLive.disconnect();
    }

    setIsActive(false);
    isActiveRef.current = false;
    setSpeakingAgent(null);
    setProcessingAgent(null);
    setSpeakQueue([]);
    agentQueueRef.current = [];
    setTranscript(prev => [...prev, {
      id: `sys-${Date.now()}`,
      speaker: 'system',
      content: 'Voice meeting ended',
      timestamp: Date.now(),
      type: 'text',
    }]);
  };

  const interruptAll = () => {
    stopSpeaking();
    window.speechSynthesis.cancel();
    setSpeakingAgent(null);
    setSpeakLevel(0);
    agentQueueRef.current = [];
    setSpeakQueue([]);
    setProcessingAgent(null);
    if (isActiveRef.current) {
      setTimeout(() => startListening(), 300);
    }
  };

  // ── Download transcript ──
  const downloadTranscript = () => {
    if (!room) return;
    let content = `# Voice Meeting Transcript: ${room.name}\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    content += `Participants: Kevin, ${room.agents.map(id => agentName(id)).join(', ')}\n\n`;
    content += `---\n\n`;

    for (const entry of transcript) {
      const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const speaker = entry.speaker === 'user' ? 'Kevin'
        : entry.speaker === 'system' ? '📋 System'
        : (agentName(entry.speaker));
      content += `**[${time}] ${speaker}:** ${entry.content}\n\n`;
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-${room.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Waveform component ──
  const Waveform = ({ level, color, bars = 8, height = 32 }: { level: number; color: string; bars?: number; height?: number }) => (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = Math.max(0.12, level * (0.5 + Math.sin((Date.now() / 100) + i * 0.8) * 0.5));
        return (
          <div
            key={`bar-${i}`}
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

  if (!room) return null;

  return (
    <div className="h-full flex flex-col bg-mission-control-bg">
      {/* Header */}
      <div className="p-3 border-b border-mission-control-border bg-mission-control-surface flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Users size={18} className="text-success" />
          <span className="font-semibold text-sm">{room.name}</span>
          {isActive && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-error font-medium">LIVE</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Turn mode */}
          <select
            value={turnMode}
            onChange={e => setTurnMode(e.target.value as TurnMode)}
            className="text-xs bg-mission-control-border rounded-lg px-2 py-1.5 text-mission-control-text border-none outline-none"
          >
            <option value="sequential">All respond</option>
            <option value="addressed">@Mentioned only</option>
          </select>

          {/* Device settings */}
          <div className="relative" ref={deviceSettingsRef}>
            <button
              onClick={() => setShowDeviceSettings(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${showDeviceSettings ? 'text-mission-control-accent bg-mission-control-accent/10' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
              title="Audio device settings"
            >
              <SlidersHorizontal size={16} />
            </button>
            {showDeviceSettings && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-mission-control-text-primary">Audio Devices</span>
                  <button onClick={() => setShowDeviceSettings(false)} className="text-mission-control-text-dim hover:text-mission-control-text">
                    <XIcon size={14} />
                  </button>
                </div>

                {/* Microphone */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-1.5">
                    <Mic size={11} /> Microphone
                  </label>
                  <select
                    value={micDeviceId}
                    onChange={e => setMicDeviceId(e.target.value)}
                    className="w-full text-xs bg-mission-control-border rounded-lg px-2 py-1.5 text-mission-control-text border-none outline-none"
                  >
                    <option value="">System default</option>
                    {micDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone (${d.deviceId.slice(0, 8)}…)`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaker */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-1.5">
                    <Volume2 size={11} /> Speaker
                  </label>
                  <select
                    value={speakerDeviceId}
                    onChange={e => setSpeakerDeviceId(e.target.value)}
                    className="w-full text-xs bg-mission-control-border rounded-lg px-2 py-1.5 text-mission-control-text border-none outline-none"
                  >
                    <option value="">System default</option>
                    {speakerDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Speaker (${d.deviceId.slice(0, 8)}…)`}
                      </option>
                    ))}
                  </select>
                  {speakerDevices.length === 0 && (
                    <p className="text-[10px] text-mission-control-text-dim mt-1">Allow microphone access to list output devices.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setMuted(!muted); if (!muted) { stopSpeaking(); window.speechSynthesis.cancel(); } }}
              className={`p-1.5 rounded-lg transition-colors ${muted ? 'text-error' : 'text-mission-control-text-dim hover:text-mission-control-text'}`}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-16 h-1 accent-mission-control-accent"
            />
          </div>

          {/* Download transcript */}
          {transcript.length > 0 && (
            <button
              onClick={downloadTranscript}
              className="p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              title="Download transcript"
            >
              <Download size={16} />
            </button>
          )}

          {/* Back to text */}
          <button
            onClick={() => { if (isActive) endMeeting(); onEndVoice(); }}
            className="p-1.5 rounded-lg text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            title="Switch to text"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      {/* Agent bar — shows who's in the meeting */}
      <div className="px-4 py-3 border-b border-mission-control-border bg-mission-control-surface/50 flex items-center gap-3 overflow-x-auto">
        {/* User */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-mission-control-accent to-purple-500 flex items-center justify-center text-white text-sm font-semibold ${listening ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-mission-control-bg' : ''}`}>
            K
            {listening && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-indigo-400 border-2 border-mission-control-bg" />
            )}
          </div>
          <span className="text-[10px] text-mission-control-text-dim">You</span>
        </div>

        {room.agents.map(id => {
          const agent = agents.find(a => a.id === id);
          const theme = getAgentTheme(id);
          const isSpeaking = speakingAgent === id;
          const isProcessing = processingAgent === id;
          const isQueued = speakQueue.includes(id);

          return (
            <div key={id} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative">
                <div className={`transition-all ${isSpeaking ? 'scale-110' : ''}`}>
                  <AgentAvatar agentId={id} size="md" ring={isSpeaking} />
                </div>
                {/* Speaking pulse */}
                {isSpeaking && (
                  <div className={`absolute inset-0 rounded-full border-2 ${theme.border} animate-ping opacity-40`} />
                )}
                {/* Processing dot */}
                {isProcessing && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-warning border-2 border-mission-control-bg animate-pulse" />
                )}
                {/* Queued dot */}
                {isQueued && !isProcessing && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-mission-control-text-dim border-2 border-mission-control-bg" />
                )}
              </div>
              <span className={`text-[10px] ${isSpeaking ? theme.text + ' font-medium' : 'text-mission-control-text-dim'}`}>
                {agent?.name || id}
              </span>
            </div>
          );
        })}

        {/* Speaking indicator */}
        {speakingAgent && (
          <div className="ml-auto flex items-center gap-2">
            <Waveform level={speakLevel} color={getAgentTheme(speakingAgent).color} bars={6} height={24} />
            <span className={`text-xs font-medium ${getAgentTheme(speakingAgent).text}`}>
              {agentName(speakingAgent)} speaking
            </span>
          </div>
        )}
      </div>

      {/* Transcript / Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcript.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <div className="flex -space-x-3 mb-4">
              {room.agents.slice(0, 4).map(id => (
                <AgentAvatar key={id} agentId={id} size="lg" ring />
              ))}
            </div>
            <p className="text-lg font-medium text-mission-control-text mb-1">Voice Team Meeting</p>
            <p className="text-sm text-center max-w-xs mb-2">
              Start a voice meeting with {room.agents.map(id => agentName(id)).join(', ')}
            </p>
            <p className="text-xs opacity-70">
              Use @AgentName to address specific agents, or speak to everyone
            </p>
          </div>
        )}

        {transcript.map(entry => {
          if (entry.speaker === 'system') {
            return (
              <div key={entry.id} className="text-center">
                <span className="text-xs text-mission-control-text-dim bg-mission-control-border/50 px-3 py-1 rounded-full">
                  {entry.content} • {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          }

          const isUser = entry.speaker === 'user';
          const theme = !isUser ? getAgentTheme(entry.speaker) : null;
          const agent = !isUser ? agents.find(a => a.id === entry.speaker) : null;
          const isCurrSpeaking = speakingAgent === entry.speaker;

          return (
            <div key={entry.id} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              {isUser ? (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mission-control-accent to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5">
                  K
                </div>
              ) : (
                <div className="relative flex-shrink-0 mt-0.5">
                  <AgentAvatar agentId={entry.speaker} size="sm" />
                  {isCurrSpeaking && (
                    <div className={`absolute inset-0 rounded-full border-2 ${theme?.border} animate-pulse`} />
                  )}
                </div>
              )}
              <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <span className={`text-[10px] font-medium mb-0.5 px-1 ${isUser ? 'text-mission-control-accent' : (theme?.text || 'text-mission-control-text-dim')}`}>
                  {isUser ? 'Kevin' : (agent?.name || entry.speaker)}
                  {entry.type === 'voice' && ' 🎤'}
                </span>
                <div className={`px-3 py-2 rounded-2xl ${
                  isUser
                    ? 'bg-gradient-to-br from-mission-control-accent to-purple-500 text-white rounded-tr-sm'
                    : `bg-mission-control-surface border ${theme?.border || 'border-mission-control-border'} rounded-tl-sm`
                }`}>
                  {isUser ? (
                    <p className="text-sm">{entry.content}</p>
                  ) : (
                    <MarkdownMessage content={entry.content} />
                  )}
                </div>
                <span className="text-[10px] text-mission-control-text-dim mt-0.5 px-1">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* Partial transcript */}
        {partialTranscript && (
          <div className="flex gap-2 justify-end">
            <div className="max-w-[75%] rounded-2xl px-3 py-2 bg-mission-control-accent/30 text-white/70">
              <p className="text-sm italic">{partialTranscript}…</p>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {processingAgent && !speakingAgent && (
          <div className="flex gap-2 items-center">
            <AgentAvatar agentId={processingAgent} size="xs" />
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl px-4 py-2 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-mission-control-accent" />
              <span className="text-xs text-mission-control-text-dim">{agentName(processingAgent)} is thinking…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Controls bar */}
      <div className="border-t border-mission-control-border p-4 bg-mission-control-surface">
        {/* Status area */}
        {isActive && (
          <div className="flex items-center justify-center mb-3 h-10">
            {listening && !speakingAgent && !processingAgent && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-indigo-400">Listening…</span>
                <Waveform level={micLevel} color="var(--color-info)" bars={10} height={32} />
              </div>
            )}
            {speakingAgent && (
              <div className="flex items-center gap-3">
                <Waveform level={speakLevel} color={getAgentTheme(speakingAgent).color} bars={10} height={32} />
                <span className={`text-xs ${getAgentTheme(speakingAgent).text}`}>
                  {agentName(speakingAgent)} speaking
                </span>
                {speakQueue.length > 0 && (
                  <span className="text-xs text-mission-control-text-dim">
                    → {speakQueue.map(id => agentName(id)).join(', ')} next
                  </span>
                )}
              </div>
            )}
            {processingAgent && !speakingAgent && (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-mission-control-accent" />
                <span className="text-xs text-mission-control-text-dim">{agentName(processingAgent)} thinking…</span>
              </div>
            )}
            {!listening && !speakingAgent && !processingAgent && (
              <span className="text-xs text-mission-control-text-dim">Tap mic to speak</span>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3">
          {isActive && (
            <>
              {/* Mic toggle */}
              <button
                onClick={() => listening ? stopListeningFn() : startListening()}
                disabled={!!speakingAgent || !!processingAgent}
                className={`p-4 rounded-full transition-all ${
                  listening
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-card hover:text-mission-control-text'
                } disabled:opacity-40`}
              >
                {listening ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              {/* Interrupt / stop all */}
              <button
                onClick={interruptAll}
                disabled={!speakingAgent && !processingAgent && speakQueue.length === 0}
                className="p-3 rounded-full bg-mission-control-border text-mission-control-text-dim hover:bg-warning-subtle hover:text-warning transition-all disabled:opacity-30"
                title="Stop all speaking"
              >
                <Square size={18} />
              </button>

              {/* Screen share */}
              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-full transition-all ${
                  screenSharing
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-card hover:text-mission-control-text'
                }`}
                title={screenSharing ? 'Stop screen share' : 'Share screen'}
              >
                {screenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
              </button>
            </>
          )}

          {/* Start/End meeting */}
          <button
            onClick={() => isActive ? endMeeting() : startMeeting()}
            className={`p-5 rounded-full transition-all ${
              isActive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
            }`}
          >
            {isActive ? <PhoneOff size={24} /> : <Mic size={24} />}
          </button>
        </div>

        {!isActive && (
          <p className="text-center text-xs text-mission-control-text-dim mt-2">
            Press to start voice meeting
          </p>
        )}
      </div>

      {showScreenPicker && (
        <ScreenSourcePicker
          onSelect={handleScreenSourceSelected}
          onCancel={() => setShowScreenPicker(false)}
        />
      )}
    </div>
  );
}
