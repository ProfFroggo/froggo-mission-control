// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Meeting Transcription Service
 * Uses Gemini AI Transcribe API for real-time meeting transcription with speaker labels
 * Adapted for Mission Control Dashboard (uses in-memory storage in web mode)
 */

// @ts-expect-error - @google/genai types not yet available
import { GoogleGenAI } from '@google/genai';

export interface Meeting {
  id: string;
  title: string;
  started_at: number;
  ended_at: number | null;
  participants: string[];
  status: 'active' | 'ended';
}

export interface MeetingTranscript {
  id?: number;
  meeting_id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

export interface TranscriptionSegment {
  speaker: string;
  text: string;
  timestamp: number;
}

export class MeetingTranscriber {
  private ai: GoogleGenAI;
  private activeStream: any = null;
  private onTranscriptCallback: ((segment: TranscriptionSegment) => void) | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Set callback for real-time transcript updates
   */
  onTranscript(callback: (segment: TranscriptionSegment) => void): void {
    this.onTranscriptCallback = callback;
  }

  // In-memory storage for meetings since DB IPC is not available in web mode
  private meetingsStore: Meeting[] = [];
  private transcriptsStore: MeetingTranscript[] = [];
  private transcriptIdCounter = 0;

  /**
   * Execute SQL — stubbed for web mode (uses in-memory storage)
   */
  private async dbExec(_sql: string, _params: any[] = []): Promise<void> {
    console.warn('Not implemented: db.exec (using in-memory storage)');
  }

  /**
   * Query SQL — stubbed for web mode (uses in-memory storage)
   */
  private async dbQuery(_sql: string, _params: any[] = []): Promise<any[]> {
    console.warn('Not implemented: db.query (using in-memory storage)');
    return [];
  }

  /**
   * Ensure storage is ready (no-op for in-memory)
   */
  async ensureTables(): Promise<void> {
    // In-memory storage is always ready
  }

  /**
   * Start a new meeting and begin transcription
   */
  async startMeeting(title: string, participants: string[] = []): Promise<Meeting> {
    await this.ensureTables();

    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const meeting: Meeting = {
      id: meetingId,
      title,
      started_at: Date.now(),
      ended_at: null,
      participants,
      status: 'active'
    };

    this.meetingsStore.push(meeting);

    return meeting;
  }

  /**
   * Start real-time audio transcription
   */
  async startTranscription(meetingId: string, audioStream: MediaStream): Promise<void> {
    if (!meetingId) throw new Error('No active meeting');


    this.activeStream = await this.ai.live.connect({
        model: 'gemini-live-2.5-flash-preview',
        callbacks: {
          onopen: () => {
            // Connection established — no action needed
          },
          onmessage: (message: any) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (!text?.trim()) return;

              const speaker = this.detectSpeaker(text);
              const segment: TranscriptionSegment = { speaker, text, timestamp: Date.now() };

              this.saveTranscript(meetingId, speaker, text);

              if (this.onTranscriptCallback) {
                this.onTranscriptCallback(segment);
              }
            }

            if (message.serverContent?.outputTranscription) {
              // AI output transcription available — not currently displayed
            }
          },
          onerror: (error: any) => {
            console.error('[MeetingTranscriber] Stream error:', error);
          },
          onclose: () => {
            this.activeStream = null;
          }
        },
        config: {
          responseModalities: [],
          systemInstruction: `You are a meeting transcription assistant. 
Your job is to accurately transcribe spoken audio with speaker identification.
Do not respond or engage - only transcribe what you hear.`,
          inputAudioTranscription: {
            model: 'gemini-live-2.5-flash-preview'
          }
        }
      });

      await this.streamAudioToTranscription(audioStream);
  }

  /**
   * Stream audio data to the transcription service
   */
  private async streamAudioToTranscription(audioStream: MediaStream): Promise<void> {
    if (!this.activeStream) return;

    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(audioStream);
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (e) => {
      if (!this.activeStream) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createPCMBlob(inputData);
      this.activeStream.sendRealtimeInput({ media: pcmBlob });
    };

    source.connect(scriptProcessor);
    // Connect to a silent sink to keep the processor running.
    // IMPORTANT: Do NOT connect to audioContext.destination — that plays mic audio
    // through speakers, causing feedback where system audio gets transcribed instead of speech.
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    silentGain.connect(audioContext.destination);
    scriptProcessor.connect(silentGain);
  }

  /**
   * Convert Float32Array audio to base64 PCM
   */
  private createPCMBlob(data: Float32Array): { data: string; mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }

    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return {
      data: btoa(binary),
      mimeType: 'audio/pcm;rate=16000'
    };
  }

  /**
   * Detect speaker from text (placeholder for voice fingerprinting)
   */
  private detectSpeaker(_text: string): string {
    return 'Speaker';
  }

  /**
   * Save a transcript segment to the database
   */
  async saveTranscript(meetingId: string, speaker: string, text: string): Promise<void> {
    this.transcriptsStore.push({
      id: ++this.transcriptIdCounter,
      meeting_id: meetingId,
      speaker,
      text,
      timestamp: Date.now(),
    });
  }

  /**
   * End a meeting
   */
  async endMeeting(meetingId: string): Promise<void> {
    if (!meetingId) throw new Error('No meeting ID provided');

    if (this.activeStream) {
      this.activeStream.close();
      this.activeStream = null;
    }

    const meeting = this.meetingsStore.find(m => m.id === meetingId);
    if (meeting) {
      meeting.ended_at = Date.now();
      meeting.status = 'ended';
    }

  }

  /**
   * Get all transcripts for a meeting
   */
  async getMeetingTranscripts(meetingId: string): Promise<MeetingTranscript[]> {
    return this.transcriptsStore
      .filter(t => t.meeting_id === meetingId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get all meetings
   */
  async getAllMeetings(): Promise<Meeting[]> {
    return [...this.meetingsStore].sort((a, b) => b.started_at - a.started_at);
  }

  /**
   * Get active meeting
   */
  async getActiveMeeting(): Promise<Meeting | null> {
    return this.meetingsStore.find(m => m.status === 'active') || null;
  }

  /**
   * Delete a meeting and all its transcripts
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    this.transcriptsStore = this.transcriptsStore.filter(t => t.meeting_id !== meetingId);
    this.meetingsStore = this.meetingsStore.filter(m => m.id !== meetingId);
  }

  /**
   * Export meeting transcript as text
   */
  async exportTranscript(meetingId: string): Promise<string> {
    const meeting = this.meetingsStore.find(m => m.id === meetingId);
    if (!meeting) throw new Error('Meeting not found');

    const transcripts = await this.getMeetingTranscripts(meetingId);

    let output = `Meeting: ${meeting.title}\n`;
    output += `Started: ${new Date(meeting.started_at).toLocaleString()}\n`;
    if (meeting.ended_at) {
      output += `Ended: ${new Date(meeting.ended_at).toLocaleString()}\n`;
      const duration = meeting.ended_at - meeting.started_at;
      output += `Duration: ${Math.floor(duration / 60000)} minutes\n`;
    }
    output += `Participants: ${meeting.participants.join(', ')}\n\n`;
    output += '--- Transcript ---\n\n';

    for (const transcript of transcripts) {
      const time = new Date(transcript.timestamp).toLocaleTimeString();
      output += `[${time}] ${transcript.speaker}: ${transcript.text}\n`;
    }

    return output;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.activeStream) {
      this.activeStream.close();
      this.activeStream = null;
    }
  }
}
