// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Global STT — real-time speech-to-text via ElevenLabs Scribe.
// Manual mic capture → PCM16 → base64 → WebSocket (bypasses SDK AudioWorklet).
// Falls back to Gemini batch transcription if ElevenLabs is unavailable.

import {
  Scribe,
  AudioFormat,
  CommitStrategy,
  RealtimeEvents,
  type RealtimeConnection,
} from '@elevenlabs/client';

export { RealtimeEvents };

let authHeadersFn: (() => Record<string, string>) | null = null;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!authHeadersFn) {
    try {
      const { authHeaders } = await import('./api');
      authHeadersFn = authHeaders;
    } catch (err) {
      console.warn('[globalStt] Non-critical:', err);
      return {};
    }
  }
  return authHeadersFn();
}

export interface GeminiSttOptions {
  /** Audio input device ID — pass from MicSelector */
  deviceId?: string;
  /** Language hint (default 'en') */
  lang?: string;
  /** Continuous mode: keep streaming until stop() is called (default false = single-shot) */
  continuous?: boolean;
  /** Chunk duration in ms — used as safety-net timeout (default 8000) */
  chunkDurationMs?: number;
  /** Called with final transcript text for each committed segment */
  onTranscript?: (text: string) => void;
  /** Called with interim partial transcript text (real-time, before commit) */
  onPartialTranscript?: (text: string) => void;
  /** Called with interim status messages (e.g. "Listening...", "Transcribing...") */
  onStatus?: (status: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Called when recording stops (cleanup complete) */
  onEnd?: () => void;
}

export class GeminiStt {
  private connection: RealtimeConnection | null = null;
  private stopped = true;
  private options: GeminiSttOptions;
  private singleShotTimer: ReturnType<typeof setTimeout> | null = null;
  // Manual mic capture state
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  // Gemini fallback state
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private usingFallback = false;

  constructor(options: GeminiSttOptions = {}) {
    this.options = {
      lang: 'en',
      continuous: false,
      chunkDurationMs: 8000,
      ...options,
    };
  }

  /** Update the mic device (can call while stopped or running) */
  setDeviceId(deviceId: string): void {
    this.options.deviceId = deviceId;
  }

  /** Start recording and transcribing */
  async start(): Promise<void> {
    if (!this.stopped) return;
    this.stopped = false;

    try {
      // Try ElevenLabs real-time first
      const headers = await getAuthHeaders();
      const tokenRes = await fetch('/api/stt/token', { headers });

      if (!tokenRes.ok) {
        throw new Error(`Token fetch failed: ${tokenRes.status}`);
      }

      const tokenData = await tokenRes.json();
      const token = tokenData.token;

      if (!token) {
        throw new Error('No token in response');
      }

      this.usingFallback = false;

      // Connect to ElevenLabs with manual audio mode (no SDK mic handling)
      this.connection = Scribe.connect({
        token,
        modelId: 'scribe_v2_realtime',
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: 0.5,
        languageCode: this.options.lang?.split('-')[0] || 'en',
        audioFormat: AudioFormat.PCM_16000,
        sampleRate: 16000,
      });

      this.connection.on(RealtimeEvents.SESSION_STARTED, () => {
        this.options.onStatus?.('Listening...');
      });

      this.connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data) => {
        if (data.text) {
          this.options.onPartialTranscript?.(data.text);
          this.options.onStatus?.('Listening...');
        }
      });

      this.connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        if (data.text) {
          this.options.onTranscript?.(data.text);
        }
        if (!this.options.continuous && !this.stopped) {
          this.stop();
        }
      });

      this.connection.on(RealtimeEvents.ERROR, (error) => {
        console.error('[globalStt] Scribe error:', error);
        this.options.onError?.('Transcription error');
      });

      this.connection.on(RealtimeEvents.CLOSE, () => {
        if (!this.stopped) {
          this.cleanup();
        }
      });

      // Wait for WebSocket to open, then start manual mic capture
      this.connection.on(RealtimeEvents.OPEN, async () => {
        try {
          await this.startManualMicCapture();
        } catch (err) {
          console.error('[globalStt] Mic capture failed:', err);
          this.options.onError?.('Microphone error');
          this.cleanup();
        }
      });

      // Single-shot: auto-stop after chunkDuration as a safety net
      if (!this.options.continuous) {
        this.singleShotTimer = setTimeout(() => {
          if (!this.stopped) this.stop();
        }, this.options.chunkDurationMs ?? 8000);
      }
    } catch (err) {
      console.warn('[globalStt] ElevenLabs unavailable, falling back to Gemini:', err instanceof Error ? err.message : err);
      this.usingFallback = true;
      await this.startGeminiFallback();
    }
  }

  /** Manually capture mic audio and send as PCM16 base64 chunks */
  private async startManualMicCapture(): Promise<void> {
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: this.options.deviceId ? { exact: this.options.deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    };

    this.micStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Create AudioContext at default rate (48kHz on Mac) — forcing 16kHz
    // causes createMediaStreamSource to output silence on Chrome/macOS
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.micStream);

    // Use ScriptProcessorNode (deprecated but universally supported, no CSP issues)
    const bufferSize = 4096;
    this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    const actualRate = this.audioContext.sampleRate;
    const targetRate = 16000;
    const needsResample = Math.abs(actualRate - targetRate) > 100;

    console.log(`[globalStt] AudioContext rate: ${actualRate}, target: ${targetRate}, resample: ${needsResample}`);

    this.scriptNode.onaudioprocess = (e) => {
      if (this.stopped || !this.connection) return;

      const rawData = e.inputBuffer.getChannelData(0);

      // Resample if needed, otherwise use raw data
      const channelData = needsResample
        ? this.resample(rawData, actualRate, targetRate)
        : rawData;

      // Convert Float32 [-1,1] → Int16 [-32768, 32767]
      const pcm16 = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        pcm16[i] = s < 0 ? s * 32768 : s * 32767;
      }

      // Base64 encode
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      try {
        this.connection!.send({ audioBase64: base64 });
      } catch {
        // WebSocket closed
      }
    };

    source.connect(this.scriptNode);
    this.scriptNode.connect(this.audioContext.destination);

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.options.onStatus?.('Listening...');
  }

  /** Simple linear interpolation resampler */
  private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = fromRate / toRate;
    const outputLen = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLen);
    for (let i = 0; i < outputLen; i++) {
      const srcIdx = i * ratio;
      const low = Math.floor(srcIdx);
      const high = Math.min(low + 1, input.length - 1);
      const frac = srcIdx - low;
      output[i] = input[low] + (input[high] - input[low]) * frac;
    }
    return output;
  }

  /** Stop recording and transcribe remaining audio */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.singleShotTimer) {
      clearTimeout(this.singleShotTimer);
      this.singleShotTimer = null;
    }

    if (this.usingFallback) {
      this.stopGeminiFallback();
      return;
    }

    // Clean up manual mic capture
    this.stopManualMicCapture();

    if (this.connection) {
      try { this.connection.close(); } catch { /* already closed */ }
      this.connection = null;
    }

    this.options.onEnd?.();
  }

  private stopManualMicCapture(): void {
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
  }

  /** Check if currently recording */
  get isRecording(): boolean {
    return !this.stopped;
  }

  private cleanup(): void {
    this.stopped = true;
    if (this.singleShotTimer) {
      clearTimeout(this.singleShotTimer);
      this.singleShotTimer = null;
    }
    this.stopManualMicCapture();
    if (this.connection) {
      try { this.connection.close(); } catch { /* already closed */ }
      this.connection = null;
    }
    // Gemini fallback cleanup
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer as unknown as number);
      clearInterval(this.chunkTimer as unknown as number);
      this.chunkTimer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.recorder = null;
    this.chunks = [];
    this.options.onEnd?.();
  }

  // ─── Gemini Fallback (batch transcription) ─────────────────────────
  // Used when ElevenLabs key is not configured or token fetch fails.

  private async startGeminiFallback(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: this.options.deviceId
          ? { deviceId: { exact: this.options.deviceId } }
          : true,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      this.recorder = new MediaRecorder(this.stream, { mimeType });
      this.chunks = [];

      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.onstop = async () => {
        if (this.chunks.length === 0) {
          if (!this.options.continuous || this.stopped) this.cleanup();
          return;
        }

        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType ?? 'audio/webm' });
        this.chunks = [];

        this.options.onStatus?.('Transcribing...');
        const transcript = await this.transcribeGemini(blob);

        if (transcript) this.options.onTranscript?.(transcript);

        if (this.options.continuous && !this.stopped) {
          this.startGeminiRecording();
        } else if (!this.options.continuous || this.stopped) {
          this.cleanup();
        }
      };

      this.options.onStatus?.('Recording...');
      this.startGeminiRecording();

      if (!this.options.continuous) {
        this.chunkTimer = setTimeout(() => {
          this.stopGeminiRecording();
        }, this.options.chunkDurationMs);
      } else {
        this.chunkTimer = setInterval(() => {
          if (this.recorder?.state === 'recording') {
            this.recorder.stop();
          }
        }, this.options.chunkDurationMs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.options.onError?.(msg.includes('Permission') || msg.includes('NotAllowed')
        ? 'Microphone permission denied. Please allow mic access.'
        : `Mic error: ${msg}`);
      this.cleanup();
    }
  }

  private startGeminiRecording(): void {
    if (this.recorder && this.stream && !this.stopped) {
      try { this.recorder.start(1000); } catch (err) { console.warn('[globalStt] Non-critical:', err); }
    }
  }

  private stopGeminiRecording(): void {
    if (this.recorder?.state === 'recording') {
      try { this.recorder.stop(); } catch (err) { console.warn('[globalStt] Non-critical:', err); }
    } else if (!this.options.continuous || this.stopped) {
      this.cleanup();
    }
  }

  private stopGeminiFallback(): void {
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer as unknown as number);
      clearInterval(this.chunkTimer as unknown as number);
      this.chunkTimer = null;
    }
    this.stopGeminiRecording();
  }

  private async transcribeGemini(blob: Blob): Promise<string> {
    if (blob.size < 1024) return '';

    try {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('mimeType', blob.type || 'audio/webm');

      const res = await fetch('/api/gemini/transcribe', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        this.options.onError?.(body.error || `Transcription failed: ${res.status}`);
        return '';
      }

      const data = await res.json();
      const text = (data.transcript || '').trim();
      if (!text || /^\s*$/.test(text)) return '';
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.options.onError?.(`Transcription error: ${msg}`);
      return '';
    }
  }
}

/** List available audio input devices */
export async function listMicDevices(): Promise<MediaDeviceInfo[]> {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  } catch (err) {
    console.warn('[globalStt] Non-critical:', err);
    return [];
  }
}
