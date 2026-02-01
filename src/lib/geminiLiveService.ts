/**
 * GeminiLiveService - Real-time bidirectional audio/video streaming via Gemini Live API
 * 
 * Uses WebSocket for low-latency streaming instead of REST-based TTS/STT.
 * Supports: real-time audio, camera/screen video, text input, interruptions.
 */

// Audio constants matching Gemini Live API requirements
const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;
const CHANNELS = 1;
const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export type VideoMode = 'camera' | 'screen' | 'none';
export type GeminiVoice = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | 'Leda' | 'Orus' | 'Perseus';

export type GeminiLiveEvent = 
  | 'connected' | 'disconnected' | 'error'
  | 'speaking-start' | 'speaking-end'
  | 'listening-start' | 'listening-end'
  | 'audio-level' | 'model-audio-level'
  | 'transcript' | 'interrupted' | 'model-thinking'
  | 'video-frame' | 'tool-call';

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

  get connected() { return this._connected; }
  get listening() { return this._listening; }
  get speaking() { return this._speaking; }
  get videoMode() { return this._videoMode; }

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
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this._connected = false;

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
            // Enable transcription of user speech and model speech
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
        this.emit('disconnected', { code: e.code, reason: e.reason });
        if (!wasConnected && this.pendingSetup) {
          this.pendingSetup.reject(new Error(`Connection closed: ${e.reason || e.code}`));
          this.pendingSetup = null;
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

      // Setup complete response
      if (msg.setupComplete) {
        this._connected = true;
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
            if (part.inlineData?.mimeType === 'audio/pcm' && part.inlineData.data) {
              const pcmData = this.base64ToArrayBuffer(part.inlineData.data);
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
        }

        // Output transcription (what the model actually spoke)
        if (sc.outputTranscription?.text) {
          this.emit('transcript', { text: sc.outputTranscription.text, role: 'model' });
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
        console.log('[GeminiLive] Tool call:', JSON.stringify(msg.toolCall));
        this.emit('tool-call', msg.toolCall as GeminiToolCall);
      }
    } catch (err) {
      console.error('[GeminiLive] Parse error:', err);
    }
  }

  async disconnect(): Promise<void> {
    this.stopMic();
    this.stopVideo();
    this.clearPlayback();
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this._connected = false;
    this._listening = false;
    this._speaking = false;
  }

  // ── Audio Input (Microphone) ──

  async startMic(): Promise<void> {
    if (this._listening || !this._connected) return;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SEND_SAMPLE_RATE,
          channelCount: CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: SEND_SAMPLE_RATE });
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);

      // Analyser for mic level visualization
      this.micAnalyser = this.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micSource.connect(this.micAnalyser);

      // AudioWorklet for raw PCM data capture (replaces deprecated ScriptProcessorNode)
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
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
      source.connect(this.playbackCtx.destination);

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
    this.scheduledTime = 0;
  }

  // ── Video Input ──

  async startVideo(mode: VideoMode): Promise<void> {
    if (mode === 'none') return;
    this._videoMode = mode;

    try {
      if (mode === 'camera') {
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
      } else if (mode === 'screen') {
        this.videoStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
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

  // ── Tool Response ──

  async sendToolResponse(functionResponses: Array<{ id: string; name: string; response: any }>): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit('error', { message: 'Not connected' });
      return;
    }

    this.ws.send(JSON.stringify({
      toolResponse: {
        functionResponses: functionResponses.map(r => ({
          id: r.id,
          name: r.name,
          response: r.response,
        })),
      },
    }));
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
