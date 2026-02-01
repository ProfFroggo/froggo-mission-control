// Google Cloud Voice Service - TTS & STT integration
// Uses Google Cloud Speech-to-Text and Text-to-Speech APIs

// Per-agent voice configuration
export interface AgentVoiceConfig {
  languageCode: string;
  name: string;         // Google voice name
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  pitch?: number;       // -20.0 to 20.0
  speakingRate?: number; // 0.25 to 4.0
}

// Default voice configs per agent
export const AGENT_VOICES: Record<string, AgentVoiceConfig> = {
  main: {
    languageCode: 'en-US',
    name: 'en-US-Journey-F',
    ssmlGender: 'FEMALE',
    pitch: 0,
    speakingRate: 1.05,
  },
  froggo: {
    languageCode: 'en-US',
    name: 'en-US-Journey-F',
    ssmlGender: 'FEMALE',
    pitch: 0,
    speakingRate: 1.05,
  },
  coder: {
    languageCode: 'en-US',
    name: 'en-US-Journey-D',
    ssmlGender: 'MALE',
    pitch: -2,
    speakingRate: 1.0,
  },
  researcher: {
    languageCode: 'en-GB',
    name: 'en-GB-Journey-D',
    ssmlGender: 'MALE',
    pitch: 0,
    speakingRate: 0.95,
  },
  writer: {
    languageCode: 'en-US',
    name: 'en-US-Journey-F',
    ssmlGender: 'FEMALE',
    pitch: 2,
    speakingRate: 1.0,
  },
  chief: {
    languageCode: 'en-US',
    name: 'en-US-Journey-D',
    ssmlGender: 'MALE',
    pitch: -3,
    speakingRate: 0.95,
  },
};

const DEFAULT_VOICE: AgentVoiceConfig = {
  languageCode: 'en-US',
  name: 'en-US-Journey-F',
  ssmlGender: 'FEMALE',
  pitch: 0,
  speakingRate: 1.0,
};

type VoiceEventType = 'speaking-start' | 'speaking-end' | 'listening-start' | 'listening-end' | 'transcript' | 'partial-transcript' | 'error' | 'audio-level';

type VoiceEventListener = (data: any) => void;

class GoogleVoiceService {
  private apiKey: string = '';
  private listeners: Map<VoiceEventType, Set<VoiceEventListener>> = new Map();
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;
  private isSpeaking = false;
  private currentAudio: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private volume = 1.0;
  private gainNode: GainNode | null = null;

  // Streaming STT state
  private streamingInterval: NodeJS.Timeout | null = null;
  private streamingChunkMs = 3000; // Send audio every 3 seconds for near-real-time

  constructor() {
    // Try to load API key from settings or environment
    this.loadApiKey();
  }

  private async loadApiKey() {
    try {
      // Check settings first
      if (window.clawdbot?.settings?.get) {
        const result = await window.clawdbot.settings.get();
        if (result?.success && result.settings?.googleApiKey) {
          this.apiKey = result.settings.googleApiKey;
          console.log('[GoogleVoice] API key loaded from settings');
          return;
        }
      }
      // Try exec to read from config
      if (window.clawdbot?.exec?.run) {
        const result = await window.clawdbot.exec.run('cat ~/.clawdbot/google-api-key 2>/dev/null || echo ""');
        if (result.success && result.stdout.trim()) {
          this.apiKey = result.stdout.trim();
          console.log('[GoogleVoice] API key loaded from file');
          return;
        }
        // Try environment variable
        const envResult = await window.clawdbot.exec.run('echo $GOOGLE_API_KEY');
        if (envResult.success && envResult.stdout.trim()) {
          this.apiKey = envResult.stdout.trim();
          console.log('[GoogleVoice] API key loaded from env');
          return;
        }
      }
      console.warn('[GoogleVoice] No API key found. Set GOOGLE_API_KEY or save to ~/.clawdbot/google-api-key');
    } catch (err) {
      console.error('[GoogleVoice] Error loading API key:', err);
    }
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  on(event: VoiceEventType, listener: VoiceEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: VoiceEventType, data?: any) {
    this.listeners.get(event)?.forEach(l => l(data));
  }

  // ===== TEXT-TO-SPEECH =====

  async speak(text: string, agentId: string = 'froggo'): Promise<void> {
    if (!text?.trim() || !this.apiKey) {
      if (!this.apiKey) {
        this.emit('error', { message: 'Google API key not configured' });
      }
      return;
    }

    // Skip filler
    if (/^(on it|got it|sure|ok|okay|yes|yep|done|noted|ack|👍|✅|🐸)\s*[.!]?\s*$/i.test(text.trim())) {
      return;
    }

    // Clean text for speech
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[<>]/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/^\s*[-•]\s*/gm, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000); // Google TTS limit is 5000 chars

    if (!clean) return;

    const voiceConfig = AGENT_VOICES[agentId] || DEFAULT_VOICE;

    this.emit('speaking-start', { agentId });
    this.isSpeaking = true;

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: clean },
            voice: {
              languageCode: voiceConfig.languageCode,
              name: voiceConfig.name,
              ssmlGender: voiceConfig.ssmlGender,
            },
            audioConfig: {
              audioEncoding: 'MP3',
              pitch: voiceConfig.pitch || 0,
              speakingRate: voiceConfig.speakingRate || 1.0,
              volumeGainDb: 0,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.audioContent) throw new Error('No audio content in response');

      // Decode base64 audio and play
      const audioBytes = atob(data.audioContent);
      const arrayBuffer = new ArrayBuffer(audioBytes.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioBytes.length; i++) {
        view[i] = audioBytes.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);

      return new Promise<void>((resolve) => {
        // Stop any currently playing audio
        this.stopSpeaking();

        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        audio.volume = this.volume;

        audio.onended = () => {
          this.isSpeaking = false;
          this.currentAudio = null;
          URL.revokeObjectURL(audioUrl);
          this.emit('speaking-end', { agentId });
          resolve();
        };

        audio.onerror = (e) => {
          console.error('[GoogleVoice] Playback error:', e);
          this.isSpeaking = false;
          this.currentAudio = null;
          URL.revokeObjectURL(audioUrl);
          this.emit('speaking-end', { agentId });
          this.emit('error', { message: 'Audio playback failed' });
          resolve();
        };

        audio.play().catch(err => {
          console.error('[GoogleVoice] Play failed:', err);
          this.isSpeaking = false;
          this.emit('speaking-end', { agentId });
          resolve();
        });
      });
    } catch (err: any) {
      console.error('[GoogleVoice] TTS error:', err);
      this.isSpeaking = false;
      this.emit('speaking-end', { agentId });
      this.emit('error', { message: err.message || 'TTS failed' });
    }
  }

  stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isSpeaking = false;
    this.emit('speaking-end', {});
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  // ===== SPEECH-TO-TEXT =====

  async startListening(): Promise<void> {
    if (this.isListening) return;
    if (!this.apiKey) {
      this.emit('error', { message: 'Google API key not configured' });
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      // Set up audio analyser for level monitoring
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Start monitoring audio levels
      this.monitorAudioLevel();

      // Set up MediaRecorder for chunked recording
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect in 1s chunks
      this.isListening = true;
      this.emit('listening-start', {});

      // Set up streaming interval - send chunks periodically
      this.streamingInterval = setInterval(async () => {
        if (!this.isListening || this.audioChunks.length === 0) return;

        const chunks = [...this.audioChunks];
        this.audioChunks = [];

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (audioBlob.size < 500) return; // Skip tiny chunks

        try {
          const transcript = await this.transcribeAudio(audioBlob);
          if (transcript?.trim()) {
            this.emit('transcript', { text: transcript, isFinal: true });
          }
        } catch (err) {
          console.error('[GoogleVoice] STT chunk error:', err);
        }
      }, this.streamingChunkMs);

    } catch (err: any) {
      console.error('[GoogleVoice] Mic error:', err);
      this.emit('error', { message: `Microphone access failed: ${err.message}` });
    }
  }

  async stopListening(): Promise<string> {
    if (!this.isListening) return '';

    this.isListening = false;
    
    // Stop streaming interval
    if (this.streamingInterval) {
      clearInterval(this.streamingInterval);
      this.streamingInterval = null;
    }

    // Stop audio level monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Get final audio
    let finalTranscript = '';

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      const mimeType = this.mediaRecorder.mimeType;

      finalTranscript = await new Promise<string>((resolve) => {
        this.mediaRecorder!.onstop = async () => {
          const chunks = [...this.audioChunks];
          this.audioChunks = [];

          if (chunks.length > 0) {
            const audioBlob = new Blob(chunks, { type: mimeType });
            if (audioBlob.size > 500) {
              try {
                const text = await this.transcribeAudio(audioBlob);
                resolve(text || '');
                return;
              } catch (err) {
                console.error('[GoogleVoice] Final STT error:', err);
              }
            }
          }
          resolve('');
        };
        this.mediaRecorder!.stop();
      });
    }

    // Clean up
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;

    this.emit('listening-end', {});
    this.emit('audio-level', { level: 0 });
    return finalTranscript;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  private monitorAudioLevel() {
    if (!this.analyser || !this.isListening) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
    this.emit('audio-level', { level: avg / 255 });

    this.animationFrameId = requestAnimationFrame(() => this.monitorAudioLevel());
  }

  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableAutomaticPunctuation: true,
            model: 'latest_long',
            useEnhanced: true,
            speechContexts: [{
              phrases: [
                'Froggo', 'Clawdbot', 'Bitso', 'Kanban', 'perps', 'perpetual futures',
                'onchain', 'Solana', 'crypto', 'dashboard', 'Claude', 'Opus', 'Sonnet',
              ],
              boost: 20,
            }],
          },
          audio: {
            content: base64,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`STT API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const transcript = data.results
      ?.map((r: any) => r.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ');

    return transcript || '';
  }

  // ===== PUSH-TO-TALK =====

  async pushToTalkStart(): Promise<void> {
    if (this.isListening) return;
    await this.startListening();
  }

  async pushToTalkEnd(): Promise<string> {
    return this.stopListening();
  }

  // ===== CLEANUP =====

  destroy() {
    this.stopSpeaking();
    this.stopListening();
    this.listeners.clear();
  }
}

// Singleton
export const googleVoiceService = new GoogleVoiceService();
