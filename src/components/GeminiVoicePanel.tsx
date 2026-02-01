/**
 * GeminiVoicePanel - NEW Voice Chat using Gemini Live API
 * 
 * Features:
 * - Real-time bidirectional audio streaming
 * - Camera OR screen capture video input
 * - Text input alongside voice
 * - Interruption support
 * - Native audio understanding
 * 
 * Based on: https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_LiveAPI.py
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Camera,
  CameraOff,
  Monitor,
  MonitorOff,
  Send,
  Trash2,
  Settings,
  Volume2,
  VolumeX,
  Loader2,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { geminiLive, VideoMode, GeminiVoice } from '../lib/geminiLiveService';

const API_KEY = 'AIzaSyCziHu8LUZ6RXmt-4lu_NzgEfczM0DC1RE';
const DEFAULT_VOICE: GeminiVoice = 'Zephyr';
const DEFAULT_VIDEO_MODE: VideoMode = 'none';

interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
}

export default function GeminiVoicePanel() {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speakerLevel, setSpeakerLevel] = useState(0);

  // Video state
  const [videoMode, setVideoMode] = useState<VideoMode>(DEFAULT_VIDEO_MODE);
  const [videoActive, setVideoActive] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Settings
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoice>(DEFAULT_VOICE);
  const [showSettings, setShowSettings] = useState(false);

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);

  // Internal state
  const activeCallRef = useRef(false);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup Gemini Live event listeners
  useEffect(() => {
    const unsubscribers = [
      geminiLive.on('connected', () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        addMessage('system', '🔗 Connected to Gemini Live');
      }),

      geminiLive.on('disconnected', () => {
        setConnected(false);
        setListening(false);
        setSpeaking(false);
        setVideoActive(false);
        activeCallRef.current = false;
        addMessage('system', '📞 Disconnected from Gemini Live');
      }),

      geminiLive.on('listening-start', () => {
        setListening(true);
      }),

      geminiLive.on('listening-end', () => {
        setListening(false);
      }),

      geminiLive.on('speaking-start', () => {
        setSpeaking(true);
      }),

      geminiLive.on('speaking-end', () => {
        setSpeaking(false);
      }),

      geminiLive.on('audio-level', ({ level }: { level: number }) => {
        setMicLevel(level);
      }),

      geminiLive.on('model-audio-level', ({ level }: { level: number }) => {
        setSpeakerLevel(level);
      }),

      geminiLive.on('transcript', ({ text, role }: { text: string; role: string }) => {
        if (text?.trim()) {
          addMessage(role === 'model' ? 'model' : 'user', text.trim());
        }
      }),

      geminiLive.on('model-thinking', ({ text }: { text: string }) => {
        // Internal reasoning - optionally display in debug mode
        console.log('[Gemini Thinking]:', text.slice(0, 100));
      }),

      geminiLive.on('error', ({ message }: { message: string }) => {
        setError(message);
        addMessage('system', `⚠️ ${message}`);
      }),

      geminiLive.on('interrupted', () => {
        addMessage('system', '🔄 Interrupted - starting fresh');
      }),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connected) {
        geminiLive.disconnect();
      }
    };
  }, [connected]);

  // Helper to add messages
  const addMessage = useCallback((role: 'user' | 'model' | 'system', text: string) => {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      // Merge consecutive messages from same role within 3 seconds
      if (lastMsg?.role === role && Date.now() - lastMsg.timestamp < 3000) {
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, text: m.text + ' ' + text } : m
        );
      }
      return [
        ...prev,
        {
          id: `msg-${++msgCounter.current}`,
          role,
          text,
          timestamp: Date.now(),
        },
      ];
    });
  }, []);

  // Connect to Gemini Live
  const handleConnect = async () => {
    if (connected || connecting) return;

    setConnecting(true);
    setError(null);

    try {
      await geminiLive.connect({
        apiKey: API_KEY,
        voice: selectedVoice,
        videoMode,
        systemInstruction: `You are a helpful AI assistant. Respond conversationally and concisely. Your responses will be spoken aloud, so keep them natural and brief unless asked for detail.`,
      });

      activeCallRef.current = true;

      // Auto-start mic after connection
      await geminiLive.startMic();

      // Auto-start video if mode selected
      if (videoMode !== 'none') {
        await handleStartVideo();
      }
    } catch (err: any) {
      console.error('[GeminiVoice] Connection error:', err);
      setError(err.message || 'Failed to connect');
      setConnecting(false);
      activeCallRef.current = false;
    }
  };

  // Disconnect from Gemini Live
  const handleDisconnect = async () => {
    activeCallRef.current = false;
    await geminiLive.disconnect();
    setVideoActive(false);
  };

  // Toggle microphone
  const handleToggleMic = async () => {
    if (!connected) return;

    if (listening) {
      geminiLive.stopMic();
    } else {
      await geminiLive.startMic();
    }
  };

  // Start video capture
  const handleStartVideo = async () => {
    if (!connected || videoMode === 'none') return;

    try {
      await geminiLive.startVideo(videoMode);
      const stream = geminiLive.getVideoStream();
      if (stream && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setVideoActive(true);
      addMessage('system', videoMode === 'camera' ? '📹 Camera active' : '🖥️ Screen sharing active');
    } catch (err: any) {
      setError(`Video failed: ${err.message}`);
    }
  };

  // Stop video capture
  const handleStopVideo = () => {
    geminiLive.stopVideo();
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setVideoActive(false);
    addMessage('system', 'Video stopped');
  };

  // Send text message
  const handleSendText = async () => {
    if (!textInput.trim() || !connected) return;

    const text = textInput.trim();
    setTextInput('');
    addMessage('user', text);

    try {
      await geminiLive.sendText(text);
    } catch (err: any) {
      setError(`Send failed: ${err.message}`);
    }
  };

  // Clear conversation history
  const handleClearHistory = () => {
    setMessages([]);
    msgCounter.current = 0;
  };

  // Waveform visualizer component
  const Waveform = ({ level, color }: { level: number; color: string }) => {
    const bars = 8;
    const height = 40;
    return (
      <div className="flex items-center gap-[2px]" style={{ height }}>
        {Array.from({ length: bars }).map((_, i) => {
          const h = Math.max(0.15, level * (0.5 + Math.sin((Date.now() / 100) + i * 0.8) * 0.5));
          return (
            <div
              key={i}
              className="rounded-full transition-all duration-75"
              style={{
                width: 3,
                height: `${Math.max(20, h * 100)}%`,
                backgroundColor: color,
                opacity: 0.6 + h * 0.4,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-clawd-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <MessageSquare className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-clawd-text">Gemini Live Voice Chat</h1>
            <p className="text-xs text-clawd-text-dim">
              {connected ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Connected - {selectedVoice} voice
                </span>
              ) : (
                'Not connected'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-red-400 transition-colors"
            title="Clear history"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-clawd-border bg-clawd-surface">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-clawd-text-dim mb-1 block">Voice</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value as GeminiVoice)}
                disabled={connected}
                className="w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm disabled:opacity-50"
              >
                <option value="Zephyr">Zephyr</option>
                <option value="Puck">Puck</option>
                <option value="Charon">Charon</option>
                <option value="Kore">Kore</option>
                <option value="Fenrir">Fenrir</option>
                <option value="Aoede">Aoede</option>
                <option value="Leda">Leda</option>
                <option value="Orus">Orus</option>
                <option value="Perseus">Perseus</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-clawd-text-dim mb-1 block">Video Mode</label>
              <select
                value={videoMode}
                onChange={(e) => setVideoMode(e.target.value as VideoMode)}
                disabled={connected}
                className="w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm disabled:opacity-50"
              >
                <option value="none">🎙️ Audio only</option>
                <option value="camera">📹 Camera</option>
                <option value="screen">🖥️ Screen share</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-clawd-text-dim mt-2">
            💡 Settings can only be changed before connecting
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Video Preview */}
      {videoActive && (
        <div className="mx-4 mt-3 rounded-lg overflow-hidden bg-black border border-clawd-border">
          <video
            ref={videoPreviewRef}
            autoPlay
            muted
            playsInline
            className="w-full max-h-64 object-contain"
            style={videoMode === 'camera' ? { transform: 'scaleX(-1)' } : {}}
          />
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
            {videoMode === 'camera' ? '📹 Camera' : '🖥️ Screen'}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-clawd-text-dim">
            <div className="w-24 h-24 mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <MessageSquare size={40} className="text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-clawd-text mb-2">Gemini Live Voice Chat</h2>
            <p className="text-sm max-w-md mb-4">
              Real-time bidirectional audio streaming with native audio understanding.
              Talk naturally and interrupt anytime.
            </p>
            <div className="text-xs space-y-1">
              <p>✅ Real-time audio I/O</p>
              <p>✅ Camera or screen video input</p>
              <p>✅ Text input alongside voice</p>
              <p>✅ Interruption support</p>
              <p>✅ Native audio understanding</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 mt-1">
                <MessageSquare size={16} className="text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-clawd-accent text-white'
                  : msg.role === 'system'
                  ? 'bg-clawd-border/50 text-clawd-text-dim text-xs italic'
                  : 'bg-clawd-card text-clawd-text border border-clawd-border'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className="text-[10px] opacity-50 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-clawd-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Mic size={14} className="text-clawd-accent" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Audio Visualizer */}
      {connected && (
        <div className="px-4 py-3 border-t border-clawd-border bg-clawd-surface/50">
          <div className="flex items-center justify-center h-12">
            {listening && !speaking && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-indigo-400 font-medium">Listening…</span>
                <Waveform level={micLevel} color="#818cf8" />
              </div>
            )}
            {speaking && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400 font-medium">Gemini speaking</span>
                <Waveform level={speakerLevel} color="#4ade80" />
              </div>
            )}
            {!listening && !speaking && connected && (
              <span className="text-xs text-clawd-text-dim">Tap mic to speak</span>
            )}
          </div>
        </div>
      )}

      {/* Text Input Bar */}
      {connected && (
        <div className="px-4 py-3 border-t border-clawd-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Type a message (optional)…"
              className="flex-1 px-4 py-2 rounded-lg bg-clawd-card border border-clawd-border text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-accent"
            />
            <button
              onClick={handleSendText}
              disabled={!textInput.trim()}
              className="p-2 rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send text message"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Call Controls */}
      <div className="px-4 py-4 border-t border-clawd-border">
        <div className="flex items-center justify-center gap-4">
          {/* Mic Toggle */}
          {connected && (
            <button
              onClick={handleToggleMic}
              disabled={speaking}
              className={`p-4 rounded-full transition-all ${
                listening
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-110'
                  : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'
              } disabled:opacity-40`}
              title={listening ? 'Pause microphone' : 'Resume microphone'}
            >
              {listening ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
          )}

          {/* Connect/Disconnect Button */}
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            disabled={connecting}
            className={`p-5 rounded-full transition-all ${
              connected
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={connected ? 'End call' : 'Start call'}
          >
            {connecting ? (
              <Loader2 size={28} className="animate-spin" />
            ) : connected ? (
              <PhoneOff size={28} />
            ) : (
              <Phone size={28} />
            )}
          </button>

          {/* Video Toggle */}
          {connected && videoMode !== 'none' && (
            <button
              onClick={videoActive ? handleStopVideo : handleStartVideo}
              className={`p-4 rounded-full transition-all ${
                videoActive
                  ? videoMode === 'camera'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-card hover:text-clawd-text'
              }`}
              title={videoActive ? 'Stop video' : 'Start video'}
            >
              {videoMode === 'camera' ? (
                videoActive ? <CameraOff size={24} /> : <Camera size={24} />
              ) : (
                videoActive ? <MonitorOff size={24} /> : <Monitor size={24} />
              )}
            </button>
          )}
        </div>

        {!connected && (
          <p className="text-center text-xs text-clawd-text-dim mt-3">
            Press call to connect to Gemini Live
          </p>
        )}
      </div>
    </div>
  );
}
