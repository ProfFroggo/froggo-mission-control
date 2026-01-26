import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Loader2, Sparkles, MessageSquare, RefreshCw, WifiOff } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function VoicePanel() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [meetingMode, setMeetingMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addActivity } = useStore();

  const connected = connectionState === 'connected';

  // Track gateway state
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speak text using Web Speech API
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !text) return;
    
    window.speechSynthesis.cancel();
    
    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .slice(0, 800);
    
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => 
      v.name.includes('Samantha') || 
      v.name.includes('Karen') || 
      v.name.includes('Daniel') ||
      (v.lang === 'en-US' && v.localService)
    );
    if (preferred) utterance.voice = preferred;
    
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Send command and wait for full response
  const sendCommand = useCallback(async (command: string) => {
    if (!connected || !command.trim()) return;
    
    setProcessing(true);
    setWakeWordDetected(false);
    
    const userMsg: Message = { role: 'user', content: command, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    addActivity({ type: 'chat', message: `🎤 ${command}`, timestamp: Date.now() });
    
    try {
      // Use the proper async method that waits for response
      const result = await gateway.sendChat(`[VOICE] ${command}`);
      
      if (result?.content && result.content !== 'NO_REPLY') {
        const assistantMsg: Message = { 
          role: 'assistant', 
          content: result.content, 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, assistantMsg]);
        speak(result.content);
      }
    } catch (e: any) {
      console.error('[Voice] Command error:', e);
      const errorMsg: Message = {
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setProcessing(false);
    }
  }, [connected, addActivity, speak]);

  // Setup audio level monitoring
  const setupAudioMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current || !listening) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg / 255);
        if (listening) requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.error('[Voice] Audio monitoring failed:', e);
    }
  }, [listening]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      setCurrentTranscript(text);
      
      const lower = text.toLowerCase();
      if (lower.includes('froggo') || lower.includes('hey frog')) {
        setWakeWordDetected(true);
      }
      
      if (result.isFinal) {
        setCurrentTranscript('');
        
        // Wake word detection
        if (lower.includes('froggo') || lower.includes('hey frog')) {
          const command = text.replace(/^.*?(hey\s+)?(frog+o|frog)\s*/i, '').trim();
          if (command && command.length > 2) {
            sendCommand(command);
          }
        }
        
        // Meeting mode
        if (meetingMode) {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setMeetingTranscript(prev => [...prev, `[${timestamp}] ${text}`]);
        }
        
        setWakeWordDetected(false);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('[Voice] Recognition error:', e.error);
      }
    };
    
    recognition.onend = () => {
      if (listening && recognitionRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [listening, meetingMode, sendCommand]);

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser');
      return;
    }
    
    if (listening) {
      recognitionRef.current.abort();
      setListening(false);
      setAudioLevel(0);
      audioContextRef.current?.close();
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
        await setupAudioMonitoring();
      } catch (e) {
        console.error('[Voice] Failed to start:', e);
      }
    }
  };

  const reconnect = () => {
    gateway['reconnectNow']();
  };

  const quickCommands = [
    "What time is it?",
    "Check my calendar",
    "Any new messages?",
    "What's the weather?",
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Voice Assistant</h1>
            <p className="text-clawd-text-dim text-sm flex items-center gap-2">
              Say "Hey Froggo" to activate
              {connectionState !== 'connected' && (
                <span className="text-yellow-400">
                  ({connectionState === 'disconnected' ? 'Offline' : 'Connecting...'})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-3 rounded-xl transition-all ${
                voiceEnabled ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim'
              }`}
              title={voiceEnabled ? 'Voice on' : 'Voice off'}
            >
              {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              onClick={() => { setMeetingMode(!meetingMode); setMeetingTranscript([]); }}
              className={`p-3 rounded-xl transition-all ${
                meetingMode ? 'bg-yellow-500 text-white' : 'bg-clawd-border text-clawd-text-dim'
              }`}
              title={meetingMode ? 'End meeting' : 'Meeting mode'}
            >
              {meetingMode ? <PhoneOff size={20} /> : <Phone size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Voice Control Panel */}
        <div className="w-80 border-r border-clawd-border p-6 flex flex-col">
          {/* Status Orb */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              {/* Glow effect */}
              <div 
                className={`absolute inset-0 rounded-full blur-2xl transition-all duration-300 ${
                  processing ? 'bg-yellow-500/30 scale-150' :
                  speaking ? 'bg-green-500/30 scale-150' :
                  wakeWordDetected ? 'bg-clawd-accent/50 scale-125' :
                  listening ? 'bg-clawd-accent/20' : 'bg-transparent'
                }`}
                style={{ transform: listening ? `scale(${1 + audioLevel * 0.5})` : undefined }}
              />
              
              {/* Main orb */}
              <button
                onClick={toggleListening}
                disabled={!connected}
                className={`relative w-40 h-40 rounded-full flex items-center justify-center text-6xl transition-all duration-300 ${
                  processing ? 'bg-yellow-500/20 border-4 border-yellow-500' :
                  speaking ? 'bg-green-500/20 border-4 border-green-500' :
                  listening ? 'bg-clawd-accent/20 border-4 border-clawd-accent' : 
                  'bg-clawd-surface border-4 border-clawd-border hover:border-clawd-accent'
                } ${!connected ? 'opacity-50' : ''}`}
              >
                {processing ? (
                  <Loader2 size={48} className="animate-spin text-yellow-500" />
                ) : speaking ? (
                  <span className="animate-pulse">🗣️</span>
                ) : listening ? (
                  <span style={{ transform: `scale(${1 + audioLevel * 0.3})` }}>🎤</span>
                ) : (
                  '🐸'
                )}
              </button>
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center mb-6">
            <div className="text-lg font-medium mb-1">
              {processing ? 'Processing...' : 
               speaking ? 'Speaking...' : 
               wakeWordDetected ? 'Listening for command...' :
               listening ? 'Listening...' : 
               'Tap to start'}
            </div>
            {currentTranscript && (
              <div className="text-sm text-clawd-text-dim italic">"{currentTranscript}"</div>
            )}
            {!connected && (
              <div className="text-sm text-red-400 mt-2 flex items-center justify-center gap-2">
                <WifiOff size={14} />
                <span>Disconnected</span>
                <button onClick={reconnect} className="text-clawd-accent hover:underline">
                  Reconnect
                </button>
              </div>
            )}
          </div>

          {/* Quick Commands */}
          {!listening && !processing && (
            <div>
              <div className="text-xs text-clawd-text-dim mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Quick commands
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickCommands.map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => sendCommand(cmd)}
                    disabled={!connected || processing}
                    className="text-xs p-2 bg-clawd-surface rounded-lg hover:bg-clawd-border transition-colors text-left disabled:opacity-50"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Conversation / Meeting Transcript */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-clawd-border flex items-center gap-2">
            <MessageSquare size={16} />
            <span className="font-medium">{meetingMode ? 'Meeting Transcript' : 'Conversation'}</span>
            {(messages.length > 0 || meetingTranscript.length > 0) && (
              <button 
                onClick={() => { setMessages([]); setMeetingTranscript([]); }}
                className="ml-auto text-xs text-clawd-accent hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {meetingMode ? (
              meetingTranscript.length === 0 ? (
                <div className="text-center text-clawd-text-dim py-12">
                  <Phone size={32} className="mx-auto mb-3 opacity-50" />
                  <p>Meeting mode active</p>
                  <p className="text-sm">All speech will be transcribed</p>
                </div>
              ) : (
                meetingTranscript.map((line, i) => (
                  <div key={i} className="text-sm p-2 bg-clawd-surface rounded-lg">{line}</div>
                ))
              )
            ) : messages.length === 0 ? (
              <div className="text-center text-clawd-text-dim py-12">
                <div className="text-5xl mb-4">🐸</div>
                <p className="text-lg font-medium mb-2">Hey, I'm Froggo!</p>
                <p className="text-sm mb-4">Click the orb or say "Hey Froggo" to talk to me</p>
                <div className="text-xs space-y-1">
                  <p>Try saying:</p>
                  <p className="text-clawd-accent">"Hey Froggo, what's on my calendar?"</p>
                  <p className="text-clawd-accent">"Hey Froggo, check my messages"</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-clawd-accent text-white rounded-br-md' 
                      : 'bg-clawd-surface border border-clawd-border rounded-bl-md'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="flex gap-2">
                        <span>🐸</span>
                        <MarkdownMessage content={msg.content} />
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
