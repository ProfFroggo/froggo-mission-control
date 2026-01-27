import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Loader2, 
  MessageSquare, WifiOff, Zap, Brain, ListTodo
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { voiceService } from '../lib/voiceService';
import type { Model, KaldiRecognizer } from 'vosk-browser';

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

// Using voiceService for model loading (handles packaged app correctly)

export default function VoicePanel() {
  console.log('[Voice] VoicePanel component rendering');
  
  // Global state from store
  const { 
    isMuted, 
    toggleMuted,
    isMeetingActive, 
    setMeetingActive,
    addActivity 
  } = useStore();
  
  // Core state
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  
  // Vosk state
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  // Mode state
  const [conversationMode, setConversationMode] = useState(false);
  const conversationModeRef = useRef(false);
  
  // Refs for mute state
  const isMutedRef = useRef(isMuted);
  
  // Conversation history (with localStorage persistence)
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('froggo-voice-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });
  
  // Meeting mode state
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [meetingActionItems, setMeetingActionItems] = useState<ActionItem[]>([]);
  
  // Audio state
  const [audioLevel, setAudioLevel] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Refs
  const modelRef = useRef<Model | null>(null);
  const recognizerRef = useRef<KaldiRecognizer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef<boolean>(false);
  
  // Speech accumulation buffer (to avoid cutting off mid-sentence)
  const speechBufferRef = useRef<string[]>([]);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Keep mute ref in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  // Settings
  const SAMPLE_RATE = 16000;
  const SILENCE_TIMEOUT_MS = 2500; // Wait 2.5s of silence before processing
  const SENTENCE_END_TIMEOUT_MS = 1200; // Shorter timeout after sentence-ending punctuation

  const connected = connectionState === 'connected';

  // Load Vosk model via voiceService (handles packaged app correctly)
  useEffect(() => {
    const unsubscribe = voiceService.subscribe((state, message) => {
      console.log('[VoicePanel] voiceService state:', state, message);
      
      if (state === 'ready') {
        setModelLoaded(true);
        setModelLoading(false);
        setStatusMessage('');
      } else if (state === 'loading') {
        setModelLoading(true);
        setStatusMessage(message || 'Loading...');
      } else if (state === 'error') {
        setModelError(message || 'Failed to load model');
        setModelLoading(false);
      }
    });
    
    // Check if already ready
    if (voiceService.isReady()) {
      setModelLoaded(true);
      setModelLoading(false);
    }
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (recognizerRef.current) {
        try { recognizerRef.current.remove(); } catch {}
        recognizerRef.current = null;
      }
      if (modelRef.current) {
        try { modelRef.current.terminate(); } catch {}
        modelRef.current = null;
      }
    };
  }, []);

  // SAFEGUARD: Cleanup mic/audio on window close/reload to prevent hardware lock
  useEffect(() => {
    const cleanup = () => {
      console.log('[Voice] Window closing - releasing mic/audio...');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[Voice] Stopped track:', track.kind);
        });
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
    
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
    
    // Also cleanup on visibility hidden (app backgrounded)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && listening) {
        console.log('[Voice] App hidden while listening - keeping mic for now');
        // Don't auto-release on hide, but log it
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('unload', cleanup);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup(); // Also cleanup on component unmount
    };
  }, [listening]);

  // Track gateway state
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('froggo-voice-history', JSON.stringify(messages));
    } catch (e) {
      console.error('[Voice] Failed to save history:', e);
    }
  }, [messages]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, meetingTranscript]);

  // Speak text using ElevenLabs TTS (via sag CLI)
  const speak = useCallback(async (text: string): Promise<void> => {
    if (!voiceEnabled || !text) {
      return;
    }
    
    // Skip short filler acks - these are annoying when spoken
    const skipPhrases = /^(on it|got it|sure|ok|okay|yes|yep|done|noted|ack|👍|✅|🐸)\s*[.!]?\s*$/i;
    if (skipPhrases.test(text.trim())) {
      console.log('[TTS] Skipping filler ack:', text);
      return;
    }
    
    // Convert to natural speech format
    console.log('[TTS] Before clean:', text);
    const clean = text
      // Strip code blocks
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      // Strip markdown formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[<>]/g, '')
      // Strip emoji
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
      // Convert times: "10:00" → "ten", "15:30" → "half past three"
      .replace(/(\d{1,2}):00\b/g, (_, h) => {
        const hour = parseInt(h);
        const hours = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return hours[hour % 12] || h;
      })
      .replace(/(\d{1,2}):30\b/g, (_, h) => {
        const hour = parseInt(h);
        const hours = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return `half past ${hours[hour % 12] || h}`;
      })
      .replace(/(\d{1,2}):(\d{2})\b/g, (_, h, m) => {
        const hour = parseInt(h);
        const hours = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
        return `${hours[hour % 12] || h} ${m}`;
      })
      // Clean up bullets and dashes
      .replace(/^\s*[-•]\s*/gm, '')
      .replace(/\s*[—–]\s*/g, ', ')
      // Newlines to natural pauses
      .replace(/\n+/g, '. ')
      // Clean up multiple spaces/punctuation
      .replace(/\s+/g, ' ')
      .replace(/\.\s*\./g, '.')
      .replace(/,\s*,/g, ',')
      .trim()
      .slice(0, 800);
    
    console.log('[TTS] After clean:', clean);
    setSpeaking(true);
    
    try {
      // Use ElevenLabs via IPC if available, fallback to Web Speech
      if (window.clawdbot?.voice?.speak) {
        console.log('[Voice] Using ElevenLabs TTS...');
        // Brian - Deep, Resonant and Comforting (British, soothing)
        const result = await window.clawdbot.voice.speak(clean, 'Brian');
        
        if (result.success && result.path) {
          // Play the generated audio file
          return new Promise<void>((resolve) => {
            const audio = new Audio(`file://${result.path}`);
            audio.onended = () => {
              setSpeaking(false);
              resolve();
            };
            audio.onerror = () => {
              console.error('[Voice] Audio playback error');
              setSpeaking(false);
              resolve();
            };
            audio.play();
          });
        } else {
          console.warn('[Voice] ElevenLabs failed, falling back to Web Speech:', result.error);
        }
      }
      
      // Fallback to Web Speech API
      console.log('[Voice] Using Web Speech API fallback...');
      return new Promise<void>((resolve) => {
        window.speechSynthesis.cancel();
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
        
        utterance.onend = () => {
          setSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setSpeaking(false);
          resolve();
        };
        
        window.speechSynthesis.speak(utterance);
      });
    } catch (err) {
      console.error('[Voice] TTS error:', err);
      setSpeaking(false);
    }
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
    if (!connected || !command.trim()) {
      return null;
    }
    
    setProcessing(true);
    
    const userMsg: Message = { role: 'user', content: command, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    addActivity({ type: 'chat', message: `🎤 ${command}`, timestamp: Date.now() });
    
    try {
      console.log('[Voice] Calling gateway.sendChat...');
      const result = await gateway.sendChat(`[VOICE] ${command}`);
      console.log('[Voice] gateway.sendChat returned:', result);
      
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

  // Handle completed utterance
  const handleUtterance = useCallback(async (text: string) => {
    if (!text.trim() || processing) return;
    
    setStatusMessage('Processing...');
    setCurrentTranscript(text);
    setPartialTranscript('');
    
    if (isMeetingActive) {
      // In meeting mode, accumulate transcript
      setMeetingTranscript(prev => [...prev, text]);
      const actions = detectActionItems(text);
      if (actions.length > 0) {
        setMeetingActionItems(prev => [...prev, ...actions]);
      }
      setStatusMessage('Meeting mode active...');
    } else if (conversationModeRef.current) {
      // In conversation mode, send and respond
      console.log('[Voice] Conversation mode - sending to gateway:', text);
      
      // Stop listening while processing to prevent feedback loop
      listeningRef.current = false;
      setStatusMessage('Thinking...');
      
      // Quick acknowledgment disabled - was too noisy
      // const needsAck = text.length > 20 || /\b(what|how|tell|explain|check|show|list)\b/i.test(text);
      // if (needsAck) {
      //   const acks = ['Let me check', 'One moment', 'Looking into that', 'Checking now'];
      //   const ack = acks[Math.floor(Math.random() * acks.length)];
      //   await speak(ack);
      // }
      
      const response = await sendCommand(text);
      console.log('[Voice] Gateway response:', response);
      
      if (response) {
        setStatusMessage('Speaking...');
        await speak(response);
      }
      
      // Resume listening after speaking
      if (conversationModeRef.current) {
        listeningRef.current = true;
        setStatusMessage('Listening...');
      }
    }
  }, [conversationMode, isMeetingActive, sendCommand, speak, processing, detectActionItems]);

  // Start listening with vosk-browser
  const startListening = useCallback(async () => {
    if (!voiceService.isReady() || listening) return;
    
    console.log('[Voice] Starting vosk-browser streaming...');
    setStatusMessage('Initializing...');
    
    try {
      // Create recognizer via voiceService
      const recognizer = voiceService.createRecognizer(SAMPLE_RATE);
      if (!recognizer) {
        throw new Error('Failed to create recognizer');
      }
      recognizerRef.current = recognizer;
      
      // Set up event handlers
      recognizer.on('partialresult', (message: any) => {
        const partial = message.result?.partial || '';
        if (partial) {
          setPartialTranscript(partial);
        }
      });
      
      recognizer.on('result', (message: any) => {
        const text = message.result?.text || '';
        if (text.trim()) {
          console.log('[Voice] Fragment:', text);
          
          // Accumulate speech fragments
          speechBufferRef.current.push(text);
          const accumulated = speechBufferRef.current.join(' ');
          
          // Update display with accumulated text
          setCurrentTranscript(accumulated);
          
          // Clear any existing silence timeout
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }
          
          // Check if this looks like end of a sentence
          const endsWithPunctuation = /[.?!][\s]*$/.test(accumulated.trim());
          const timeout = endsWithPunctuation ? SENTENCE_END_TIMEOUT_MS : SILENCE_TIMEOUT_MS;
          
          console.log('[Voice] Timeout:', timeout, 'ms (sentence end:', endsWithPunctuation, ')');
          
          // Set new silence timeout - only process after pause
          silenceTimeoutRef.current = setTimeout(() => {
            const fullText = speechBufferRef.current.join(' ').trim();
            if (fullText) {
              console.log('[Voice] Processing after silence:', fullText);
              speechBufferRef.current = [];
              setCurrentTranscript('');
              handleUtterance(fullText);
            }
          }, timeout);
        }
      });
      
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
      
      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Analyser for audio level display
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Use AudioWorkletNode (inline blob to avoid file:// issues in packaged app)
      const workletCode = `
        class VoiceProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 4096;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }
          process(inputs) {
            const input = inputs[0];
            if (input && input[0]) {
              const inputData = input[0];
              for (let i = 0; i < inputData.length; i++) {
                this.buffer[this.bufferIndex++] = inputData[i];
                if (this.bufferIndex >= this.bufferSize) {
                  this.port.postMessage({ type: 'audio', data: this.buffer.slice() });
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('voice-processor', VoiceProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'voice-processor');
      source.connect(workletNode);
      
      workletNode.port.onmessage = (event) => {
        if (!listeningRef.current || !recognizerRef.current) return;
        
        // Skip audio processing when muted
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }
        
        // Get audio level for visualization
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
        }
        
        if (event.data.type === 'audio') {
          try {
            // Wrap Float32Array in AudioBuffer for vosk
            const audioBuffer = audioContextRef.current!.createBuffer(1, event.data.data.length, SAMPLE_RATE);
            audioBuffer.copyToChannel(event.data.data, 0);
            recognizerRef.current.acceptWaveform(audioBuffer);
          } catch (err) {
            console.error('[Voice] acceptWaveform error:', err);
          }
        }
      };
      
      setListening(true);
      listeningRef.current = true;
      setStatusMessage(isMeetingActive ? 'Meeting mode active...' : 'Listening...');
      console.log('[Voice] Vosk-browser streaming started');
      
    } catch (err: any) {
      console.error('[Voice] Failed to start:', err);
      setStatusMessage(`Error: ${err.message}`);
      await stopListening();
    }
  }, [modelLoaded, listening, isMeetingActive, handleUtterance]);

  // Stop listening
  const stopListening = useCallback(async () => {
    console.log('[Voice] Stopping...');
    listeningRef.current = false;
    
    // Clear silence timeout and speech buffer
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    speechBufferRef.current = [];
    
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
    
    // Remove recognizer
    if (recognizerRef.current) {
      try { recognizerRef.current.remove(); } catch {}
      recognizerRef.current = null;
    }
    
    setListening(false);
    setAudioLevel(0);
    setPartialTranscript('');
    setCurrentTranscript('');
    setStatusMessage('');
  }, []);

  // Toggle conversation mode
  const toggleConversation = useCallback(async () => {
    console.log('[Voice] toggleConversation called:', { listening, conversationMode });
    if (listening || conversationMode) {
      console.log('[Voice] Stopping conversation mode');
      conversationModeRef.current = false;
      setConversationMode(false);
      await stopListening();
      window.speechSynthesis.cancel();
      setStatusMessage('Stopped');
    } else {
      console.log('[Voice] Starting conversation mode');
      conversationModeRef.current = true;
      setConversationMode(true);
      setMeetingActive(false);
      await startListening();
      console.log('[Voice] startListening returned');
    }
  }, [listening, conversationMode, startListening, stopListening, setMeetingActive]);

  // Toggle meeting mode - syncs with global state
  const toggleMeeting = useCallback(async () => {
    if (isMeetingActive) {
      await stopListening();
      setMeetingActive(false);
      setConversationMode(false);
      
      if (meetingActionItems.length > 0 || meetingTranscript.length > 0) {
        setStatusMessage('Meeting ended. Review action items below.');
      }
    } else {
      setMeetingActive(true);
      setConversationMode(false);
      setMeetingTranscript([]);
      setMeetingActionItems([]);
      await startListening();
    }
  }, [isMeetingActive, meetingActionItems.length, meetingTranscript.length, startListening, stopListening, setMeetingActive]);
  
  // Sync with global meeting state (for TopBar call button)
  // Only affects meeting mode, NOT conversation mode
  const prevMeetingActive = useRef(isMeetingActive);
  // Store stable references to avoid triggering effect when listening state changes
  const startListeningRef = useRef(startListening);
  const stopListeningRef = useRef(stopListening);
  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;
  
  useEffect(() => {
    const startMeetingFromGlobal = async () => {
      console.log('[Voice] Meeting sync effect:', { 
        isMeetingActive, 
        prevMeetingActive: prevMeetingActive.current, 
        modelLoaded,
        conversationMode: conversationModeRef.current 
      });
      
      // Start meeting mode when toggled ON
      if (isMeetingActive && !prevMeetingActive.current && modelLoaded) {
        console.log('[Voice] Starting meeting mode from global state');
        setConversationMode(false);
        setMeetingTranscript([]);
        setMeetingActionItems([]);
        await startListeningRef.current();
      }
      // Stop ONLY when meeting mode is toggled OFF (not for conversation mode)
      else if (!isMeetingActive && prevMeetingActive.current) {
        console.log('[Voice] Stopping meeting mode from global state');
        await stopListeningRef.current();
      }
      prevMeetingActive.current = isMeetingActive;
    };
    startMeetingFromGlobal();
  }, [isMeetingActive, modelLoaded]); // Removed startListening/stopListening from deps - using refs instead

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
      await speak(response);
    }
    
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
    if (isMuted) return 'bg-red-500/20 border-red-500';
    if (modelLoading) return 'bg-blue-500/20 border-blue-500';
    if (processing) return 'bg-yellow-500/20 border-yellow-500';
    if (speaking) return 'bg-green-500/20 border-green-500';
    if (isMeetingActive) return 'bg-orange-500/20 border-orange-500';
    if (listening) return 'bg-clawd-accent/20 border-clawd-accent';
    return 'bg-clawd-surface border-clawd-border hover:border-clawd-accent';
  };

  const getOrbIcon = () => {
    if (isMuted) return <MicOff size={48} className="text-red-500" />;
    if (modelLoading) return <Loader2 size={48} className="animate-spin text-blue-500" />;
    if (processing) return <Loader2 size={48} className="animate-spin text-yellow-500" />;
    if (speaking) return <span className="animate-pulse text-5xl">🗣️</span>;
    if (isMeetingActive) return <span className="text-5xl">👂</span>;
    if (listening) return <span style={{ transform: `scale(${1 + audioLevel * 0.3})` }} className="text-5xl">🎤</span>;
    return <span className="text-5xl">🐸</span>;
  };

  const canStart = modelLoaded && !modelError && !modelLoading;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              Voice Assistant
              {modelLoaded && <span title="Real-time Vosk WASM"><Zap size={20} className="text-green-400" /></span>}
            </h1>
            <p className="text-clawd-text-dim text-sm flex items-center gap-2">
              {modelError ? (
                <span className="text-red-400">{modelError}</span>
              ) : modelLoading ? (
                <span className="text-blue-400">Loading speech model...</span>
              ) : modelLoaded ? (
                <span className="text-green-400">⚡ Real-time Vosk WASM transcription</span>
              ) : (
                <span>Initializing...</span>
              )}
              {connectionState !== 'connected' && (
                <span className="text-yellow-400 ml-2">
                  ({connectionState === 'disconnected' ? 'Offline' : 'Connecting...'})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Mute button */}
            <button
              onClick={toggleMuted}
              className={`p-3 rounded-xl transition-all ${
                isMuted ? 'bg-red-500 text-white' : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-border/80'
              }`}
              title={isMuted ? 'Unmute (⌘M)' : 'Mute (⌘M)'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
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
              disabled={!canStart}
              className={`p-3 rounded-xl transition-all ${
                isMeetingActive ? 'bg-orange-500 text-white' : 'bg-clawd-border text-clawd-text-dim'
              } ${!canStart ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isMeetingActive ? 'End meeting mode' : 'Start meeting eavesdrop mode'}
            >
              {isMeetingActive ? <PhoneOff size={20} /> : <Phone size={20} />}
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
                  isMuted ? 'bg-red-500/20 scale-110' :
                  modelLoading ? 'bg-blue-500/20 scale-125' :
                  processing ? 'bg-yellow-500/30 scale-150' :
                  speaking ? 'bg-green-500/30 scale-150' :
                  isMeetingActive ? 'bg-orange-500/20 scale-125' :
                  listening ? 'bg-clawd-accent/20' : 'bg-transparent'
                }`}
                style={{ transform: listening && !isMeetingActive && !isMuted ? `scale(${1 + audioLevel * 0.5})` : undefined }}
              />
              
              {/* Main orb */}
              <button
                onClick={toggleConversation}
                disabled={!canStart || processing || isMeetingActive || isMuted}
                className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 border-4 ${getOrbColor()} ${listening && !isMuted ? 'voice-orb-pulse' : ''} ${!canStart || isMeetingActive || isMuted ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {getOrbIcon()}
              </button>
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center mb-6">
            <div className="text-lg font-medium mb-1">
              {isMuted ? '🔇 Muted' :
               modelLoading ? 'Loading model...' :
               processing ? 'Processing...' : 
               speaking ? 'Speaking...' : 
               isMeetingActive ? 'Meeting Mode' :
               listening ? 'Listening...' : 
               canStart ? 'Tap to start conversation' :
               'Model not ready'}
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
                  if (response) await speak(response);
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
          {isMeetingActive ? (
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
                    <p className="text-sm mt-2">Real-time transcription with Vosk WASM</p>
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
