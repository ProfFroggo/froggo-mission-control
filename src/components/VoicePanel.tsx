import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, Volume2, VolumeX, Phone, PhoneOff, Loader2, 
  MessageSquare, WifiOff, Zap, Brain, ListTodo
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ActionItem {
  type: 'schedule' | 'message' | 'email' | 'task' | 'general';
  text: string;
  confidence: number;
}

// Action item detection patterns
const ACTION_PATTERNS = {
  schedule: /\b(schedule|meeting|calendar|appointment|at \d|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  message: /\b(message|text|send|tell|notify|ping|slack|whatsapp|telegram|discord)\b/i,
  email: /\b(email|mail|send.*to|write.*to)\b/i,
  task: /\b(todo|task|remind|reminder|don't forget|remember to|need to|have to|should)\b/i,
};

export default function VoicePanel() {
  console.log('[Voice] VoicePanel component rendering');
  
  // Core state
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  
  // Vosk state
  const [voskAvailable, setVoskAvailable] = useState<boolean | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  // Mode state
  const [conversationMode, setConversationMode] = useState(false); // Two-way continuous
  const [meetingMode, setMeetingMode] = useState(false); // Eavesdrop mode
  
  // Conversation history
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Meeting mode state
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [meetingActionItems, setMeetingActionItems] = useState<ActionItem[]>([]);
  
  // Audio state
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<number | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);
  
  const { addActivity } = useStore();
  
  // Settings
  const SAMPLE_RATE = 16000;
  const SILENCE_THRESHOLD = 0.02; // Lower = more sensitive
  const SILENCE_DURATION = 1200; // ms of silence before end of utterance
  const MIN_SPEECH_LENGTH = 500; // ms minimum speech before accepting

  const connected = connectionState === 'connected';

  // Check Vosk availability on mount
  useEffect(() => {
    const checkVosk = async () => {
      if (window.clawdbot?.vosk) {
        const result = await window.clawdbot.vosk.check();
        console.log('[Voice] Vosk check:', result);
        setVoskAvailable(result.available && result.modelExists);
      } else {
        console.log('[Voice] Vosk not available (not in Electron)');
        setVoskAvailable(false);
      }
    };
    checkVosk();
  }, []);

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
  }, [messages, meetingTranscript]);

  // Speak text using Web Speech API
  const speak = useCallback((text: string, onEnd?: () => void) => {
    console.log('[Voice] speak() called, voiceEnabled:', voiceEnabled, 'text length:', text?.length);
    if (!voiceEnabled || !text) {
      onEnd?.();
      return;
    }
    
    window.speechSynthesis.cancel();
    console.log('[Voice] Starting TTS...');
    
    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[<>]/g, '')
      .slice(0, 800);
    
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.1;
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
    utterance.onend = () => {
      setSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      onEnd?.();
    };
    
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  // Detect action items in text
  const detectActionItems = useCallback((text: string): ActionItem[] => {
    const items: ActionItem[] = [];
    
    for (const [type, pattern] of Object.entries(ACTION_PATTERNS)) {
      if (pattern.test(text)) {
        items.push({
          type: type as ActionItem['type'],
          text: text,
          confidence: 0.8,
        });
      }
    }
    
    return items;
  }, []);

  // Send command to gateway and get response
  const sendCommand = useCallback(async (command: string): Promise<string | null> => {
    console.log('[Voice] sendCommand called:', command, 'connected:', connected);
    if (!connected || !command.trim()) {
      console.log('[Voice] Skipping - not connected or empty command');
      return null;
    }
    
    setProcessing(true);
    
    const userMsg: Message = { role: 'user', content: command, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    addActivity({ type: 'chat', message: `🎤 ${command}`, timestamp: Date.now() });
    
    try {
      console.log('[Voice] Sending to gateway...');
      const result = await gateway.sendChat(`[VOICE] ${command}`);
      console.log('[Voice] Gateway response:', result);
      
      if (result?.content && result.content !== 'NO_REPLY') {
        const assistantMsg: Message = { 
          role: 'assistant', 
          content: result.content, 
          timestamp: Date.now() 
        };
        setMessages(prev => [...prev, assistantMsg]);
        return result.content;
      }
      return null;
    } catch (e: any) {
      console.error('[Voice] Command error:', e);
      const errorMsg: Message = {
        role: 'assistant',
        content: `Sorry, something went wrong: ${e.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      return null;
    } finally {
      setProcessing(false);
    }
  }, [connected, addActivity]);

  // Start Vosk streaming recognition
  const startListening = useCallback(async () => {
    if (!voskAvailable || listening) return;
    
    console.log('[Voice] Starting Vosk streaming...');
    setStatusMessage('Initializing...');
    
    try {
      // Start Vosk session
      const startResult = await window.clawdbot!.vosk.start(SAMPLE_RATE);
      if (startResult.error) {
        throw new Error(startResult.error);
      }
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        } 
      });
      streamRef.current = stream;
      
      // Create audio context and processor
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Analyser for audio level display
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Script processor for getting raw audio data
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      
      let hasSpoken = false;
      let speechStartTime = 0;
      
      processorRef.current.onaudioprocess = async (e) => {
        if (!listeningRef.current) return;
        
        // Get audio level for visualization
        const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
        analyserRef.current!.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const level = avg / 255;
        setAudioLevel(level);
        
        // Convert Float32Array to Int16 PCM
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 32768)));
        }
        
        // Send to Vosk
        const result = await window.clawdbot!.vosk.audio(pcm.buffer);
        
        if (result.error) {
          console.error('[Voice] Vosk audio error:', result.error);
          return;
        }
        
        // Handle speech detection
        if (level > SILENCE_THRESHOLD) {
          if (!hasSpoken) {
            speechStartTime = Date.now();
            hasSpoken = true;
          }
          lastSpeechTimeRef.current = Date.now();
          
          // Clear any silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        }
        
        if (result.final && result.text) {
          // Got a complete phrase from Vosk
          console.log('[Voice] Final:', result.text);
          setCurrentTranscript(result.text);
          setPartialTranscript('');
          
          if (meetingMode) {
            // In meeting mode, accumulate transcript
            setMeetingTranscript(prev => [...prev, result.text!]);
            const actions = detectActionItems(result.text!);
            if (actions.length > 0) {
              setMeetingActionItems(prev => [...prev, ...actions]);
            }
          } else if (conversationMode) {
            // In conversation mode, send and respond
            await handleUtterance(result.text);
          }
          
          hasSpoken = false;
        } else if (result.partial) {
          // Live partial transcript
          setPartialTranscript(result.partial);
          
          // Start silence detection if we have content
          if (result.partial && hasSpoken && !silenceTimerRef.current) {
            const speechDuration = Date.now() - speechStartTime;
            if (speechDuration > MIN_SPEECH_LENGTH) {
              silenceTimerRef.current = window.setTimeout(async () => {
                if (listeningRef.current && hasSpoken) {
                  // Force finalize
                  const finalResult = await window.clawdbot!.vosk.final(true);
                  if (finalResult.text) {
                    console.log('[Voice] Forced final:', finalResult.text);
                    setCurrentTranscript(finalResult.text);
                    setPartialTranscript('');
                    
                    if (meetingMode) {
                      setMeetingTranscript(prev => [...prev, finalResult.text!]);
                      const actions = detectActionItems(finalResult.text!);
                      if (actions.length > 0) {
                        setMeetingActionItems(prev => [...prev, ...actions]);
                      }
                    } else if (conversationMode) {
                      await handleUtterance(finalResult.text);
                    }
                  }
                  hasSpoken = false;
                }
              }, SILENCE_DURATION);
            }
          }
        }
      };
      
      setListening(true);
      listeningRef.current = true;
      setStatusMessage(meetingMode ? 'Meeting mode active...' : 'Listening...');
      console.log('[Voice] Vosk streaming started');
      
    } catch (err: any) {
      console.error('[Voice] Failed to start:', err);
      setStatusMessage(`Error: ${err.message}`);
      await stopListening();
    }
  }, [voskAvailable, listening, meetingMode, conversationMode, detectActionItems]);

  // Handle completed utterance
  const handleUtterance = useCallback(async (text: string) => {
    if (!text.trim() || processing) return;
    
    setStatusMessage('Processing...');
    
    // Stop listening while processing
    if (conversationMode && listeningRef.current) {
      // Pause audio processing but keep stream alive
    }
    
    const response = await sendCommand(text);
    
    if (response && conversationMode) {
      // Speak response, then restart listening
      speak(response, () => {
        if (conversationMode && listeningRef.current) {
          setStatusMessage('Listening...');
          // Reset Vosk for next utterance
          window.clawdbot?.vosk.final(true);
        }
      });
    } else if (conversationMode) {
      setStatusMessage('Listening...');
    }
  }, [conversationMode, sendCommand, speak, processing]);

  // Stop listening
  const stopListening = useCallback(async () => {
    console.log('[Voice] Stopping...');
    listeningRef.current = false;
    
    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    // Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop Vosk
    const result = await window.clawdbot?.vosk.stop();
    if (result?.text) {
      setCurrentTranscript(result.text);
    }
    
    setListening(false);
    setAudioLevel(0);
    setPartialTranscript('');
    setStatusMessage('');
  }, []);

  // Toggle conversation mode
  const toggleConversation = useCallback(async () => {
    if (listening || conversationMode) {
      // Stop
      setConversationMode(false);
      await stopListening();
      window.speechSynthesis.cancel();
      setStatusMessage('Stopped');
    } else {
      // Start conversation mode
      setConversationMode(true);
      setMeetingMode(false);
      await startListening();
    }
  }, [listening, conversationMode, startListening, stopListening]);

  // Toggle meeting mode
  const toggleMeeting = useCallback(async () => {
    if (meetingMode) {
      // End meeting - show summary
      await stopListening();
      setMeetingMode(false);
      setConversationMode(false);
      
      // If there are action items, offer to send summary
      if (meetingActionItems.length > 0 || meetingTranscript.length > 0) {
        setStatusMessage('Meeting ended. Review action items below.');
      }
    } else {
      // Start meeting mode
      setMeetingMode(true);
      setConversationMode(false);
      setMeetingTranscript([]);
      setMeetingActionItems([]);
      await startListening();
    }
  }, [meetingMode, meetingActionItems.length, meetingTranscript.length, startListening, stopListening]);

  // Send meeting summary to Froggo
  const sendMeetingSummary = useCallback(async () => {
    const summary = [
      '**Meeting Summary:**',
      '',
      '**Transcript:**',
      meetingTranscript.join(' '),
      '',
      meetingActionItems.length > 0 ? '**Detected Action Items:**' : '',
      ...meetingActionItems.map(a => `- [${a.type}] ${a.text}`),
      '',
      'Please organize these notes and confirm any action items I should follow up on.',
    ].filter(Boolean).join('\n');
    
    const response = await sendCommand(summary);
    if (response) {
      speak(response);
    }
    
    // Clear meeting data
    setMeetingTranscript([]);
    setMeetingActionItems([]);
  }, [meetingTranscript, meetingActionItems, sendCommand, speak]);

  const reconnect = () => {
    gateway['reconnectNow']();
  };

  const quickCommands = [
    "What time is it?",
    "Check my calendar",
    "Any new messages?",
    "What's on my todo list?",
  ];

  const getOrbColor = () => {
    if (processing) return 'bg-yellow-500/20 border-yellow-500';
    if (speaking) return 'bg-green-500/20 border-green-500';
    if (meetingMode) return 'bg-orange-500/20 border-orange-500';
    if (listening) return 'bg-clawd-accent/20 border-clawd-accent';
    return 'bg-clawd-surface border-clawd-border hover:border-clawd-accent';
  };

  const getOrbIcon = () => {
    if (processing) return <Loader2 size={48} className="animate-spin text-yellow-500" />;
    if (speaking) return <span className="animate-pulse text-5xl">🗣️</span>;
    if (meetingMode) return <span className="text-5xl">👂</span>;
    if (listening) return <span style={{ transform: `scale(${1 + audioLevel * 0.3})` }} className="text-5xl">🎤</span>;
    return <span className="text-5xl">🐸</span>;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              Voice Assistant
              {voskAvailable && <span title="Real-time Vosk"><Zap size={20} className="text-green-400" /></span>}
            </h1>
            <p className="text-clawd-text-dim text-sm flex items-center gap-2">
              {voskAvailable === false ? (
                <span className="text-yellow-400">Vosk not available</span>
              ) : voskAvailable === null ? (
                <span>Checking Vosk...</span>
              ) : (
                <span className="text-green-400">⚡ Real-time Vosk transcription</span>
              )}
              {connectionState !== 'connected' && (
                <span className="text-yellow-400 ml-2">
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
              title={voiceEnabled ? 'Voice responses on' : 'Voice responses off'}
            >
              {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              onClick={toggleMeeting}
              className={`p-3 rounded-xl transition-all ${
                meetingMode ? 'bg-orange-500 text-white' : 'bg-clawd-border text-clawd-text-dim'
              }`}
              title={meetingMode ? 'End meeting mode' : 'Start meeting eavesdrop mode'}
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
                  meetingMode ? 'bg-orange-500/20 scale-125' :
                  listening ? 'bg-clawd-accent/20' : 'bg-transparent'
                }`}
                style={{ transform: listening && !meetingMode ? `scale(${1 + audioLevel * 0.5})` : undefined }}
              />
              
              {/* Main orb */}
              <button
                onClick={toggleConversation}
                disabled={processing || voskAvailable === false || meetingMode}
                className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 border-4 ${getOrbColor()} ${voskAvailable === false || meetingMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {getOrbIcon()}
              </button>
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center mb-6">
            <div className="text-lg font-medium mb-1">
              {processing ? 'Processing...' : 
               speaking ? 'Speaking...' : 
               meetingMode ? 'Meeting Mode' :
               listening ? 'Listening...' : 
               'Tap to start conversation'}
            </div>
            {statusMessage && (
              <div className="text-sm text-clawd-text-dim">{statusMessage}</div>
            )}
            {/* Live partial transcript */}
            {partialTranscript && (
              <div className="text-sm text-clawd-accent mt-2 italic animate-pulse">
                "{partialTranscript}..."
              </div>
            )}
            {/* Final transcript */}
            {currentTranscript && !partialTranscript && (
              <div className="text-sm text-green-400 mt-2">
                ✓ "{currentTranscript}"
              </div>
            )}
            {conversationMode && !processing && (
              <div className="text-xs text-clawd-accent mt-2 flex items-center justify-center gap-1">
                <Zap size={12} />
                Conversation mode — tap to stop
              </div>
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
          <div className="space-y-2">
            <p className="text-xs text-clawd-text-dim uppercase tracking-wide mb-2">Quick Commands</p>
            {quickCommands.map((cmd, i) => (
              <button
                key={i}
                onClick={async () => {
                  const response = await sendCommand(cmd);
                  if (response) speak(response);
                }}
                disabled={!connected || processing}
                className="w-full text-left px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:border-clawd-accent transition-colors disabled:opacity-50"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation / Meeting Panel */}
        <div className="flex-1 flex flex-col">
          {meetingMode ? (
            /* Meeting Mode View */
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain size={20} className="text-orange-400" />
                  <span className="font-medium">Meeting Eavesdrop Mode</span>
                  {listening && (
                    <span className="animate-pulse text-orange-400 text-sm">● Recording</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {(meetingTranscript.length > 0 || meetingActionItems.length > 0) && (
                    <button
                      onClick={sendMeetingSummary}
                      className="px-4 py-2 bg-clawd-accent rounded-lg text-sm flex items-center gap-2 hover:bg-clawd-accent/80"
                    >
                      <MessageSquare size={14} />
                      Send Summary
                    </button>
                  )}
                </div>
              </div>
              
              {/* Detected Action Items */}
              {meetingActionItems.length > 0 && (
                <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ListTodo size={16} className="text-orange-400" />
                    <span className="font-medium text-orange-400">Detected Action Items</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {meetingActionItems.map((item, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 bg-orange-500/20 rounded text-orange-300">
                          {item.type}
                        </span>
                        <span className="text-clawd-text-dim truncate">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Meeting Transcript */}
              <div className="flex-1 overflow-y-auto bg-clawd-bg rounded-lg p-4">
                {meetingTranscript.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-clawd-text-dim">
                    <div className="text-center">
                      <Brain size={48} className="mx-auto mb-4 opacity-30" />
                      <p>Meeting transcript will appear here...</p>
                      <p className="text-sm mt-2">Action items will be detected automatically</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {meetingTranscript.map((line, i) => (
                      <p key={i} className="text-clawd-text">{line}</p>
                    ))}
                    {partialTranscript && (
                      <p className="text-clawd-text-dim italic animate-pulse">{partialTranscript}...</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Conversation View */
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-clawd-text-dim">
                  <div className="text-center">
                    <Mic size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Click the frog and start speaking</p>
                    <p className="text-sm mt-2">Real-time transcription with Vosk</p>
                    <p className="text-xs mt-4 text-clawd-text-dim">
                      💡 Tip: Your words appear as you speak!
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-clawd-accent text-white rounded-br-md'
                          : 'bg-clawd-surface border border-clawd-border rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <MarkdownMessage content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Mic size={14} className="opacity-70" />
                          {msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
