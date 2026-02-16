/**
 * GeminiLiveService - Real-time bidirectional audio/video streaming via Gemini Live API
 * 
 * Uses WebSocket for low-latency streaming instead of REST-based TTS/STT.
 * Supports: real-time audio, camera/screen video, text input, interruptions.
 */

import { getVoiceProfile } from '../config/agent-voices';

// Audio constants matching Gemini Live API requirements
const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;
const CHANNELS = 1;
const MODEL = 'models/gemini-2.5-flash-native-audio-latest'; // ONLY native-audio models support bidiGenerateContent
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export type VideoMode = 'camera' | 'screen' | 'none';
export type GeminiVoice = 
  // Chirp 3 HD voices (30 total) - used by gemini-2.5-flash-native-audio
  // Female voices
  | 'Achernar' | 'Aoede' | 'Autonoe' | 'Callirrhoe' | 'Despina' | 'Erinome'
  | 'Gacrux' | 'Kore' | 'Laomedeia' | 'Leda' | 'Pulcherrima' | 'Sulafat'
  | 'Vindemiatrix' | 'Zephyr'
  // Male voices
  | 'Achird' | 'Algenib' | 'Algieba' | 'Alnilam' | 'Charon' | 'Enceladus'
  | 'Fenrir' | 'Iapetus' | 'Orus' | 'Puck' | 'Rasalgethi' | 'Sadachbia'
  | 'Sadaltager' | 'Schedar' | 'Umbriel' | 'Zubenelgenubi';

/**
 * Map agent voice profiles to Gemini Live voices (Chirp 3 HD)
 * 
 * All 30 Chirp 3 HD voices available for gemini-2.5-flash-native-audio:
 * 
 * Female voices:
 *   Achernar, Aoede, Autonoe, Callirrhoe, Despina, Erinome, Gacrux,
 *   Kore, Laomedeia, Leda, Pulcherrima, Sulafat, Vindemiatrix, Zephyr
 * 
 * Male voices:
 *   Achird, Algenib, Algieba, Alnilam, Charon, Enceladus, Fenrir,
 *   Iapetus, Orus, Puck, Rasalgethi, Sadachbia, Sadaltager, Schedar,
 *   Umbriel, Zubenelgenubi
 * 
 * Voice characteristics:
 * - Puck: Conversational, friendly, upbeat
 * - Charon: Deep, authoritative, informative
 * - Kore: Neutral, firm, professional
 * - Fenrir: Warm, approachable, excitable
 * - Zephyr: Bright, energetic
 * - Leda: Youthful, friendly
 * - Orus: Firm, professional
 * - Aoede: Breezy, conversational
 * - Vindemiatrix: Gentle, calm, mature
 * - Callirrhoe: Easy-going, accessible
 * - Despina: Smooth, warm
 * - Zubenelgenubi: Deep, resonant, serious
 */
/**
 * Direct agent → voice mapping.
 * 
 * Production / Execution:
 *   Writer (f)          → Zephyr   — Bright, energetic, articulate
 *   Researcher (f)      → Kore     — Neutral, firm, professional
 *   Designer (f)        → Leda     — Youthful, energetic
 *   Coder (m)           → Puck     — Conversational, friendly, eager
 * 
 * Support / Ops:
 *   HR (f)              → Despina  — Smooth, warm, approachable
 *   Clara (f)           → Callirrhoe — Easy-going, accessible
 *   Finance Manager (m) → Orus     — Firm, analytical, professional
 * 
 * External / Comms:
 *   Social Manager (m)  → Fenrir   — Excitable, warm, human
 *   Voice / mascot (f)  → Aoede    — Breezy, light, interface-level
 * 
 * Others:
 *   Froggo              → Puck     — Conversational, friendly
 *   Chief               → Charon   — Deep, authoritative
 *   Growth Director     → Fenrir   — Warm, energetic
 *   Ox                  → Zubenelgenubi — Deep, resonant
 */
const AGENT_VOICE_MAP: Record<string, GeminiVoice> = {
  writer:           'Zephyr',
  researcher:       'Kore',
  designer:         'Leda',
  'senior-coder':   'Charon',  // Deep, authoritative - lead engineer
  coder:            'Puck',    // Conversational, friendly, eager
  hr:               'Despina',
  clara:            'Callirrhoe',
  'finance-manager': 'Orus',    // Firm, analytical, professional CFO
  'social-manager': 'Fenrir',
  voice:            'Aoede',
  jess:             'Leda',  // Same as Designer - youthful, friendly
  froggo:           'Puck',
  main:             'Puck',
  chief:            'Charon',
  'growth-director':'Fenrir',
  'degen-frog':     'Fenrir',
  ox:               'Zubenelgenubi',
};

export function getGeminiVoiceForAgent(agentId: string): GeminiVoice {
  return AGENT_VOICE_MAP[agentId] || 'Puck';
}

export type GeminiLiveEvent = 
  | 'connected' | 'disconnected' | 'error'
  | 'speaking-start' | 'speaking-end'
  | 'listening-start' | 'listening-end'
  | 'audio-level' | 'model-audio-level'
  | 'transcript' | 'interrupted' | 'model-thinking'
  | 'video-frame' | 'tool-call' | 'reconnecting';

/** Tool declaration for Gemini Live function calling */
export interface GeminiTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

/** Tool call from Gemini */
export interface GeminiToolCall {
  functionCalls: Array<{
    id: string;
    name: string;
    args: Record<string, any>;
  }>;
}

type EventListener = (data?: any) => void;

export interface GeminiLiveConfig {
  apiKey: string;
  voice?: GeminiVoice;
  videoMode?: VideoMode;
  systemInstruction?: string;
  model?: string;
  tools?: GeminiTool[];
}

interface PendingSetup {
  resolve: () => void;
  reject: (err: Error) => void;
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private listeners = new Map<GeminiLiveEvent, Set<EventListener>>();
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private videoStream: MediaStream | null = null;
  private micProcessor: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  // Playback state
  private playbackCtx: AudioContext | null = null;
  private playbackQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private playbackSourceNode: AudioBufferSourceNode | null = null;
  private playbackGain: GainNode | null = null;
  private scheduledTime = 0;

  // Video capture
  private videoCanvas: HTMLCanvasElement | null = null;
  private videoCtx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private videoInterval: ReturnType<typeof setInterval> | null = null;

  // State
  private _connected = false;
  private _listening = false;
  private _speaking = false;
  private _videoMode: VideoMode = 'none';
  private pendingSetup: PendingSetup | null = null;

  // Mic level analysis
  private micAnalyser: AnalyserNode | null = null;
  private micLevelAnimFrame: number | null = null;

  // Auto-reconnect
  private lastConfig: GeminiLiveConfig | null = null;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Tool call keepalive — send silent audio frames while tools are executing
  private toolCallKeepaliveTimer: ReturnType<typeof setInterval> | null = null;

  // Session resumption — allows reconnecting without losing context
  private sessionHandle: string | null = null;
  
  // Context replay buffer - store recent conversation for reconnect
  private conversationHistory: Array<{role: 'user' | 'model', text: string}> = [];
  private maxHistoryItems = 10;

  // Diagnostics
  private connectTime: number = 0;
  private messageCount: number = 0;
  private lastMessageTime: number = 0;
  private toolCallPending: boolean = false;

  get connected() { return this._connected; }
  get listening() { return this._listening; }
  get speaking() { return this._speaking; }
  get videoMode() { return this._videoMode; }
  get playbackAudioContext() { return this.playbackCtx; }

  /** Mute/unmute audio playback */
  setMuted(muted: boolean) {
    if (this.playbackGain) {
      this.playbackGain.gain.value = muted ? 0 : 1;
    }
  }

  // ── Event system ──

  on(event: GeminiLiveEvent, fn: EventListener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => { this.listeners.get(event)?.delete(fn); };
  }

  private emit(event: GeminiLiveEvent, data?: any) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }

  // ── Connection ──

  async connect(config: GeminiLiveConfig): Promise<void> {
    // Kill any existing WS (even mid-handshake)
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try { this.ws.close(); } catch { /* ignore close errors */ }
      this.ws = null;
    }
    this._connected = false;
    this.intentionalDisconnect = false;
    this.lastConfig = config;

    const { apiKey, voice = 'Zephyr', videoMode = 'none', systemInstruction, model, tools } = config;
    this._videoMode = videoMode;

    const url = `${WS_URL}?key=${apiKey}`;
    console.log('[GeminiLive] Connecting to:', url.replace(/key=.*/, 'key=***'));
    
    return new Promise((resolve, reject) => {
      console.log('[GeminiLive] Creating WebSocket...');
      const ws = new WebSocket(url);
      this.ws = ws;
      console.log('[GeminiLive] WebSocket created, readyState:', ws.readyState);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
        ws.close();
      }, 15000);

      ws.onopen = () => {
        console.log('[GeminiLive] WebSocket OPEN');
        clearTimeout(timeout);
        // Setup message - trying Python SDK field format
        const setupMsg: any = {
          setup: {
            model: model || MODEL,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voice,
                  },
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        };
        
        // Add system instruction if provided
        if (systemInstruction) {
          setupMsg.setup.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }
        
        // Add tools if provided
        if (tools && tools.length > 0) {
          setupMsg.setup.tools = [{
            functionDeclarations: tools.map(t => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          }];
        }
        
        // Session resumption — only send if we already have a handle from a previous session
        // Note: not all models support this (e.g. preview models return 1008)
        // TODO: re-enable when using gemini-live-2.5-flash-native-audio (GA model)
        
        console.log('[GeminiLive] Sending setup:', JSON.stringify(setupMsg, null, 2));
        ws.send(JSON.stringify(setupMsg));
        this.pendingSetup = { resolve, reject };
      };

      ws.onmessage = (event) => this.handleMessage(event);

      ws.onerror = (e) => {
        clearTimeout(timeout);
        console.error('[GeminiLive] WS error:', e);
        this.emit('error', { message: 'WebSocket error' });
        if (!this._connected) reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (e) => {
        clearTimeout(timeout);
        const wasConnected = this._connected;
        this._connected = false;
        this.stopMic();
        this.stopVideo();
        this.clearPlayback();
        const sessionDurationMs = this.connectTime ? Date.now() - this.connectTime : 0;
        const msSinceLastMsg = this.lastMessageTime ? Date.now() - this.lastMessageTime : 0;
        console.warn(`[GeminiLive] WS closed: code=${e.code} reason="${e.reason}" wasClean=${e.wasClean} sessionDuration=${(sessionDurationMs/1000).toFixed(1)}s msgs=${this.messageCount} msSinceLastMsg=${msSinceLastMsg} toolCallPending=${this.toolCallPending} keepaliveActive=${!!this.toolCallKeepaliveTimer}`);
        this.emit('disconnected', { code: e.code, reason: e.reason });
        if (!wasConnected && this.pendingSetup) {
          this.pendingSetup.reject(new Error(`Connection closed: ${e.reason || e.code}`));
          this.pendingSetup = null;
        }
        // Auto-reconnect on unexpected disconnects
        if (wasConnected && !this.intentionalDisconnect && this.lastConfig) {
          this.scheduleReconnect();
        }
      };
    });
  }

  private async handleMessage(event: MessageEvent) {
    try {
      let raw = event.data;
      if (raw instanceof Blob) {
        raw = await raw.text();
      }
      const msg = JSON.parse(raw);

      // Track message stats
      this.messageCount++;
      this.lastMessageTime = Date.now();
      
      // Log ALL message types for debugging disconnects
      const msgKeys = Object.keys(msg).join(', ');
      if (!msg.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData)) {
        // Log everything except raw audio chunks (too noisy)
        console.log(`[GeminiLive] MSG keys=[${msgKeys}]`, 
          msg.toolCall ? `toolCall: ${JSON.stringify(msg.toolCall).slice(0, 200)}` :
          msg.toolCallCancellation ? `CANCELLATION: ${JSON.stringify(msg.toolCallCancellation)}` :
          msg.goAway ? `GO_AWAY: ${JSON.stringify(msg.goAway)}` :
          msg.usageMetadata ? `usage: ${JSON.stringify(msg.usageMetadata)}` :
          msg.serverContent?.turnComplete ? 'turnComplete' :
          msg.serverContent?.interrupted ? 'INTERRUPTED' :
          msg.serverContent?.inputTranscription ? `userSaid: "${msg.serverContent.inputTranscription.text}"` :
          msg.serverContent?.outputTranscription ? `modelSaid: "${msg.serverContent.outputTranscription.text}"` :
          msg.setupComplete ? 'SETUP_OK' :
          msg.sessionResumptionUpdate ? `resumption: ${JSON.stringify(msg.sessionResumptionUpdate)}` :
          ''
        );
      }

      // Setup complete response
      if (msg.setupComplete) {
        this._connected = true;
        
        // Create playback AudioContext early so UI can detect 'suspended' state
        if (!this.playbackCtx) {
          this.playbackCtx = new AudioContext({ sampleRate: RECEIVE_SAMPLE_RATE });
          this.scheduledTime = this.playbackCtx.currentTime;
          console.log('[GeminiLive] Playback AudioContext created, state:', this.playbackCtx.state);
        }
        
        this.connectTime = Date.now();
        this.messageCount = 0;
        this.toolCallPending = false;
        this.emit('connected');
        if (this.pendingSetup) {
          this.pendingSetup.resolve();
          this.pendingSetup = null;
        }
        return;
      }

      // Server content (audio response)
      if (msg.serverContent) {
        const sc = msg.serverContent;
        
        // Model turn - contains audio parts
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/pcm') && part.inlineData.data) {
              const pcmData = this.base64ToArrayBuffer(part.inlineData.data);
              console.log('[GeminiLive] Audio chunk received:', pcmData.byteLength, 'bytes');
              this.enqueueAudio(pcmData);
              if (!this._speaking) {
                this._speaking = true;
                this.emit('speaking-start');
              }
            }
            if (part.text) {
              // Native audio models return text as internal thinking/reasoning.
              // The actual spoken response is in the audio data.
              // Emit as 'model-thinking' so UI can optionally show/hide it.
              this.emit('model-thinking', { text: part.text });
            }
          }
        }

        // Input transcription (what the user said)
        if (sc.inputTranscription?.text) {
          this.emit('transcript', { text: sc.inputTranscription.text, role: 'user' });
          // Store in history for context replay
          this.conversationHistory.push({ role: 'user', text: sc.inputTranscription.text });
          if (this.conversationHistory.length > this.maxHistoryItems) {
            this.conversationHistory.shift();
          }
        }

        // Output transcription (what the model actually spoke)
        if (sc.outputTranscription?.text) {
          this.emit('transcript', { text: sc.outputTranscription.text, role: 'model' });
          // Store in history for context replay
          this.conversationHistory.push({ role: 'model', text: sc.outputTranscription.text });
          if (this.conversationHistory.length > this.maxHistoryItems) {
            this.conversationHistory.shift();
          }
        }

        // Turn complete - model finished speaking
        if (sc.turnComplete) {
          this._speaking = false;
          this.emit('speaking-end');
        }

        // Interrupted - clear playback queue
        if (sc.interrupted) {
          this.clearPlayback();
          this._speaking = false;
          this.emit('interrupted');
          this.emit('speaking-end');
        }
      }

      // Tool calls - emit for external handling
      if (msg.toolCall) {
        this.toolCallPending = true;
        console.log('[GeminiLive] Tool call received, marking pending:', JSON.stringify(msg.toolCall).slice(0, 300));
        this.emit('tool-call', msg.toolCall as GeminiToolCall);
      }

      // Tool call cancellation
      if (msg.toolCallCancellation) {
        this.toolCallPending = false;
        console.warn('[GeminiLive] Tool call CANCELLED by server:', JSON.stringify(msg.toolCallCancellation));
      }

      // Session resumption updates — store handle for reconnect
      if (msg.sessionResumptionUpdate) {
        const update = msg.sessionResumptionUpdate;
        if (update.resumable && update.newHandle) {
          this.sessionHandle = update.newHandle;
          console.log('[GeminiLive] Session resumption handle updated');
        }
      }

      // GoAway — server is about to close, proactively reconnect
      if (msg.goAway) {
        console.log('[GeminiLive] GoAway received, time left:', msg.goAway.timeLeft);
        // Let the auto-reconnect handle this via onclose
      }
    } catch (err) {
      console.error('[GeminiLive] Parse error:', err);
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopMic();
    this.stopVideo();
    this.clearPlayback();
    this.stopToolCallKeepalive();
    this.sessionHandle = null; // Clear handle on intentional disconnect
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this._connected = false;
    this._listening = false;
    this._speaking = false;
    this.lastConfig = null;
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[GeminiLive] Max reconnect attempts reached');
      this.emit('error', { message: 'Auto-reconnect failed after multiple attempts. Press call to reconnect.' });
      this.reconnectAttempts = 0;
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    console.log(`[GeminiLive] Auto-reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delayMs: delay });
    this.reconnectTimer = setTimeout(async () => {
      if (this.intentionalDisconnect || !this.lastConfig) return;
      try {
        await this.connect(this.lastConfig);
        
        // Replay conversation context to restore state
        if (this.conversationHistory.length > 0) {
          console.log(`[GeminiLive] Replaying ${this.conversationHistory.length} conversation items`);
          const contextSummary = this.conversationHistory.map(item => 
            `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.text}`
          ).join('\n');
          
          // Send context as a system message
          this.ws.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{
                  text: `[Reconnected - Recent context]\n${contextSummary}\n\n[Continue from where we left off]`
                }]
              }],
              turnComplete: true
            }
          }));
        }
        
        // Restore mic if it was active
        await this.startMic();
        this.reconnectAttempts = 0;
        console.log('[GeminiLive] Auto-reconnected successfully with context replay');
      } catch (err) {
        console.error('[GeminiLive] Reconnect failed:', err);
        if (!this.intentionalDisconnect) this.scheduleReconnect();
      }
    }, delay);
  }

  // ── Audio Input (Microphone) ──

  async startMic(): Promise<void> {
    if (this._listening || !this._connected) return;

    try {
      console.log('[GeminiLive] startMic: requesting getUserMedia...');
      // Use simple constraints like MeetingsPanel (which works in production)
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: SEND_SAMPLE_RATE,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: SEND_SAMPLE_RATE });
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);

      // Analyser for mic level visualization
      this.micAnalyser = this.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micSource.connect(this.micAnalyser);

      // AudioWorklet for raw PCM data capture (replaces deprecated ScriptProcessorNode)
      // Use inline Blob URL — file:// protocol breaks addModule in packaged Electron builds
      const workletCode = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0 && input[0].length > 0) {
      const channelData = new Float32Array(input[0]);
      this.port.postMessage({ audio: channelData }, [channelData.buffer]);
    }
    return true;
  }
}
registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      console.log('[GeminiLive] Loading audio processor from blob URL');
      try {
        await this.audioContext.audioWorklet.addModule(workletUrl);
      } finally {
        URL.revokeObjectURL(workletUrl);
      }
      this.micProcessor = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
      this.micSource.connect(this.micProcessor);
      // Connect to a silent sink to keep the processor running.
      // IMPORTANT: Do NOT connect to audioContext.destination — that plays mic audio
      // through speakers, causing feedback where model TTS gets re-captured as "user speech".
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0;
      silentGain.connect(this.audioContext.destination);
      this.micProcessor.connect(silentGain);

      this.micProcessor.port.onmessage = (e) => {
        if (!this._listening || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const float32 = e.data.audio as Float32Array;
        
        // Suppress mic input while model is speaking to prevent echo/feedback.
        // Without this, the model's TTS output gets picked up by the mic and
        // re-sent to the API, causing "internal messages" to appear as user speech.
        if (this._speaking) {
          // Send silence instead of actual mic data to maintain the stream
          // but prevent the model's own speech from being transcribed as user input.
          const silence = new Int16Array(float32.length);
          const base64 = this.arrayBufferToBase64(silence.buffer as ArrayBuffer);
          this.ws.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: 'audio/pcm',
                data: base64,
              }],
            },
          }));
          return;
        }
        
        const int16 = this.float32ToInt16(float32);
        const base64 = this.arrayBufferToBase64(int16.buffer as ArrayBuffer);

        this.ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm',
              data: base64,
            }],
          },
        }));
      };

      this._listening = true;
      this.emit('listening-start');
      this.startMicLevelMonitor();

    } catch (err: any) {
      console.error('[GeminiLive] Mic error:', err);
      this.emit('error', { message: `Microphone failed: ${err.message}` });
    }
  }

  stopMic(): void {
    this._listening = false;
    
    if (this.micLevelAnimFrame) {
      cancelAnimationFrame(this.micLevelAnimFrame);
      this.micLevelAnimFrame = null;
    }

    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.micAnalyser = null;
    this.emit('listening-end');
    this.emit('audio-level', { level: 0 });
  }

  private startMicLevelMonitor() {
    if (!this.micAnalyser) return;
    const buf = new Uint8Array(this.micAnalyser.frequencyBinCount);
    const tick = () => {
      if (!this._listening || !this.micAnalyser) return;
      this.micAnalyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      this.emit('audio-level', { level: avg / 255 });
      this.micLevelAnimFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  // ── Audio Output (Playback) ──

  private async enqueueAudio(pcmData: ArrayBuffer) {
    this.playbackQueue.push(pcmData);
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.drainPlaybackQueue();
    }
  }

  private async drainPlaybackQueue() {
    if (!this.playbackCtx) {
      this.playbackCtx = new AudioContext({ sampleRate: RECEIVE_SAMPLE_RATE });
      this.scheduledTime = this.playbackCtx.currentTime;
    }

    // AudioContext starts suspended in browsers — must resume after user gesture
    if (this.playbackCtx.state === 'suspended') {
      try {
        await this.playbackCtx.resume();
        console.log('[GeminiLive] Playback AudioContext resumed');
      } catch (err) {
        console.error('[GeminiLive] Failed to resume playback AudioContext:', err);
        return;
      }
    }

    while (this.playbackQueue.length > 0) {
      const pcm = this.playbackQueue.shift()!;
      const int16 = new Int16Array(pcm);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = this.playbackCtx.createBuffer(1, float32.length, RECEIVE_SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.playbackCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Gain node for mute control
      if (!this.playbackGain) {
        this.playbackGain = this.playbackCtx.createGain();
        this.playbackGain.connect(this.playbackCtx.destination);
      }
      source.connect(this.playbackGain);

      // Emit model audio level based on PCM amplitude
      const rms = Math.sqrt(float32.reduce((sum, v) => sum + v * v, 0) / float32.length);
      this.emit('model-audio-level', { level: Math.min(1, rms * 3) });

      const now = this.playbackCtx.currentTime;
      const startTime = Math.max(now, this.scheduledTime);
      source.start(startTime);
      this.scheduledTime = startTime + audioBuffer.duration;

      this.playbackSourceNode = source;
    }

    // Wait for last scheduled audio to finish, then check for more
    const remaining = this.scheduledTime - (this.playbackCtx?.currentTime ?? 0);
    if (remaining > 0) {
      setTimeout(() => {
        if (this.playbackQueue.length > 0) {
          this.drainPlaybackQueue();
        } else {
          this.isPlaying = false;
        }
      }, remaining * 1000 + 50);
    } else {
      this.isPlaying = false;
    }
  }

  private clearPlayback() {
    this.playbackQueue = [];
    this.isPlaying = false;
    if (this.playbackCtx) {
      this.playbackCtx.close().catch(() => {});
      this.playbackCtx = null;
    }
    this.playbackSourceNode = null;
    this.playbackGain = null;
    this.scheduledTime = 0;
  }

  // ── Video Input ──

  async startVideo(mode: VideoMode, sourceId?: string): Promise<void> {
    if (mode === 'none') return;
    this._videoMode = mode;

    try {
      if (mode === 'camera') {
        // Request camera permission via Electron IPC first
        if ((window as any).clawdbot?.media?.request) {
          const granted = await (window as any).clawdbot.media.request('camera');
          if (!granted) {
            throw new Error('Camera permission denied');
          }
        }
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
      } else if (mode === 'screen') {
        if (sourceId) {
          // Electron: use specific source from desktopCapturer
          this.videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                maxWidth: 1280,
                maxHeight: 720,
              },
            } as any,
          });
        } else {
          // Browser fallback: use getDisplayMedia (shows browser picker)
          this.videoStream = await (navigator.mediaDevices as any).getDisplayMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        }
      }

      if (!this.videoStream) return;

      // Create offscreen video element
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.videoStream;
      this.videoElement.muted = true;
      await this.videoElement.play();

      // Canvas for frame capture
      this.videoCanvas = document.createElement('canvas');
      this.videoCtx = this.videoCanvas.getContext('2d');

      // Send frames every 1 second
      this.videoInterval = setInterval(() => this.captureAndSendFrame(), 1000);

    } catch (err: any) {
      console.error('[GeminiLive] Video error:', err);
      this.emit('error', { message: `Video capture failed: ${err.message}` });
    }
  }

  private captureAndSendFrame() {
    if (!this.videoElement || !this.videoCanvas || !this.videoCtx || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const vw = this.videoElement.videoWidth;
    const vh = this.videoElement.videoHeight;
    if (!vw || !vh) return;

    // Scale down to max 1024px
    const scale = Math.min(1, 1024 / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    this.videoCanvas.width = w;
    this.videoCanvas.height = h;
    this.videoCtx.drawImage(this.videoElement, 0, 0, w, h);

    const dataUrl = this.videoCanvas.toDataURL('image/jpeg', 0.7);
    const base64 = dataUrl.split(',')[1];

    this.ws.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'image/jpeg',
          data: base64,
        }],
      },
    }));

    this.emit('video-frame', { width: w, height: h });
  }

  stopVideo(): void {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(t => t.stop());
      this.videoStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.videoCanvas = null;
    this.videoCtx = null;
    this._videoMode = 'none';
  }

  /** Get the video stream for preview rendering */
  getVideoStream(): MediaStream | null {
    return this.videoStream;
  }

  // ── Tool Call Keepalive ──
  // Send silent audio frames to prevent Gemini from closing the WebSocket during tool execution

  startToolCallKeepalive(): void {
    this.stopToolCallKeepalive();
    console.log('[GeminiLive] Starting tool call keepalive (every 2s)');
    let keepaliveCount = 0;
    this.toolCallKeepaliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        keepaliveCount++;
        if (keepaliveCount % 5 === 1) console.log(`[GeminiLive] Keepalive #${keepaliveCount} sent`);
        // Send a small silent PCM frame (160 samples = 10ms at 16kHz)
        const silence = new Int16Array(160);
        const base64 = this.arrayBufferToBase64(silence.buffer as ArrayBuffer);
        this.ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm',
              data: base64,
            }],
          },
        }));
      }
    }, 2000); // Every 2 seconds
  }

  stopToolCallKeepalive(): void {
    if (this.toolCallKeepaliveTimer) {
      clearInterval(this.toolCallKeepaliveTimer);
      this.toolCallKeepaliveTimer = null;
      console.log('[GeminiLive] Stopped tool call keepalive');
    }
  }

  // ── Tool Response ──

  async sendToolResponse(functionResponses: Array<{ id: string; name: string; response: any }>): Promise<void> {
    this.stopToolCallKeepalive();
    this.toolCallPending = false;
    console.log(`[GeminiLive] Sending tool response for: ${functionResponses.map(r => r.name).join(', ')} wsState=${this.ws?.readyState}`);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('error', { message: 'Not connected' });
      return;
    }

    try {
      // Gemini Live API expects functionResponses with 'response' as a Struct (plain object).
      // Ensure all values are JSON-serializable and not circular/undefined.
      const sanitized = functionResponses.map(r => {
        let resp = r.response;
        // Ensure response is a plain object - stringify and re-parse to strip non-serializable values
        try {
          resp = JSON.parse(JSON.stringify(resp ?? { result: 'ok' }));
        } catch {
          resp = { result: String(resp) };
        }
        return {
          id: r.id,
          name: r.name,
          response: resp,
        };
      });

      const msg = JSON.stringify({
        toolResponse: {
          functionResponses: sanitized,
        },
      });
      console.log('[GeminiLive] Sending tool response:', msg.slice(0, 500));
      this.ws.send(msg);
    } catch (err: any) {
      console.error('[GeminiLive] Failed to send tool response:', err);
      this.emit('error', { message: `Tool response failed: ${err.message}` });
    }
  }

  // ── Text Input ──

  async sendText(text: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('error', { message: 'Not connected' });
      return;
    }

    this.ws.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }],
        }],
        turnComplete: true,
      },
    }));
  }

  // ── Utility ──

  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  destroy() {
    this.disconnect();
    this.listeners.clear();
  }
}

// Singleton instance
export const geminiLive = new GeminiLiveService();
