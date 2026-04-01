// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Global STT — unified Gemini speech-to-text for all components.
// Replaces Web Speech API SpeechRecognition with MediaRecorder + Gemini transcribe API.
// Supports mic device selection, continuous and single-shot modes.

let authHeadersFn: (() => Record<string, string>) | null = null;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!authHeadersFn) {
    try {
      const { authHeaders } = await import('./api');
      authHeadersFn = authHeaders;
    } catch {
      return {};
    }
  }
  return authHeadersFn();
}

export interface GeminiSttOptions {
  /** Audio input device ID — pass from MicSelector */
  deviceId?: string;
  /** Language hint (default 'en-US') */
  lang?: string;
  /** Continuous mode: keep recording chunks until stop() is called (default false = single-shot) */
  continuous?: boolean;
  /** Chunk duration in ms for continuous mode (default 8000) */
  chunkDurationMs?: number;
  /** Called with final transcript text for each chunk */
  onTranscript?: (text: string) => void;
  /** Called with interim status messages (e.g. "Recording...", "Transcribing...") */
  onStatus?: (status: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Called when recording stops (cleanup complete) */
  onEnd?: () => void;
}

export class GeminiStt {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = true;
  private options: GeminiSttOptions;

  constructor(options: GeminiSttOptions = {}) {
    this.options = {
      lang: 'en-US',
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
      const constraints: MediaStreamConstraints = {
        audio: this.options.deviceId
          ? { deviceId: { exact: this.options.deviceId } }
          : true,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Pick a supported MIME type
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
          if (!this.options.continuous || this.stopped) {
            this.cleanup();
          }
          return;
        }

        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType ?? 'audio/webm' });
        this.chunks = [];

        this.options.onStatus?.('Transcribing...');
        const transcript = await this.transcribe(blob);

        if (transcript) {
          this.options.onTranscript?.(transcript);
        }

        // In continuous mode, restart recording if not stopped
        if (this.options.continuous && !this.stopped) {
          this.startRecording();
        } else if (!this.options.continuous || this.stopped) {
          this.cleanup();
        }
      };

      this.options.onStatus?.('Recording...');
      this.startRecording();

      // In single-shot (non-continuous) mode, set a timer to stop after chunk duration
      if (!this.options.continuous) {
        this.chunkTimer = setTimeout(() => {
          this.stopRecording();
        }, this.options.chunkDurationMs);
      } else {
        // In continuous mode, cycle chunks on interval
        this.chunkTimer = setInterval(() => {
          if (this.recorder?.state === 'recording') {
            this.recorder.stop(); // triggers onstop → transcribe → restart
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

  /** Stop recording and transcribe remaining audio */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer as unknown as number);
      clearInterval(this.chunkTimer as unknown as number);
      this.chunkTimer = null;
    }

    this.stopRecording();
  }

  /** Check if currently recording */
  get isRecording(): boolean {
    return !this.stopped;
  }

  private startRecording(): void {
    if (this.recorder && this.stream && !this.stopped) {
      try {
        // Use timeslice to get ondataavailable events every 1s (ensures data is captured)
        this.recorder.start(1000);
      } catch {
        // Already recording or stream ended
      }
    }
  }

  private stopRecording(): void {
    if (this.recorder?.state === 'recording') {
      try { this.recorder.stop(); } catch { /* already stopped */ }
    } else {
      // No active recording — just clean up
      if (!this.options.continuous || this.stopped) {
        this.cleanup();
      }
    }
  }

  private cleanup(): void {
    this.stopped = true;
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

  /** Send audio blob to Gemini transcribe API */
  private async transcribe(blob: Blob): Promise<string> {
    // Skip tiny blobs (< 1KB) — likely silence or recording artifacts
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

      // Filter out non-transcription responses
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
    // Request permission first (needed to get labels)
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  } catch {
    return [];
  }
}
