// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Meeting Transcription Service
 * Uses Gemini STT for real-time transcription (via MediaRecorder + /api/gemini/transcribe).
 * Uses Gemini REST API (not Live) to summarise + extract action items on meeting end.
 */

import { GeminiStt } from './globalStt';

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

export interface MeetingSummary {
  summary: string;
  actionItems: string[];
  decisions: string[];
  keyTopics: string[];
}

export class MeetingTranscriber {
  private stt: GeminiStt | null = null;
  private onTranscriptCallback: ((segment: TranscriptionSegment) => void) | null = null;

  // In-memory storage
  private meetingsStore: Meeting[] = [];
  private transcriptsStore: MeetingTranscript[] = [];
  private transcriptIdCounter = 0;

  /** Set callback for real-time transcript updates */
  onTranscript(callback: (segment: TranscriptionSegment) => void): void {
    this.onTranscriptCallback = callback;
  }

  async ensureTables(): Promise<void> {
    // In-memory — always ready
  }

  /** Start a new meeting */
  async startMeeting(title: string, participants: string[] = []): Promise<Meeting> {
    const meeting: Meeting = {
      id: `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      started_at: Date.now(),
      ended_at: null,
      participants,
      status: 'active',
    };
    this.meetingsStore.push(meeting);
    return meeting;
  }

  /**
   * Start real-time transcription using Gemini STT (MediaRecorder + server-side Gemini API).
   * Replaces the previous Web Speech API implementation for better accuracy and consistency.
   *
   * @param meetingId Active meeting ID
   * @param _audioStream Unused (kept for API compat) — GeminiStt acquires its own stream
   * @param deviceId Optional mic device ID for device selection
   */
  async startTranscription(meetingId: string, _audioStream?: MediaStream, deviceId?: string): Promise<void> {
    if (!meetingId) throw new Error('No active meeting');

    const stt = new GeminiStt({
      deviceId: deviceId || undefined,
      continuous: true,
      chunkDurationMs: 10000,
      onTranscript: (text) => {
        if (!text.trim()) return;
        const segment: TranscriptionSegment = {
          speaker: 'You',
          text,
          timestamp: Date.now(),
        };
        this.saveTranscript(meetingId, segment.speaker, segment.text);
        if (this.onTranscriptCallback) this.onTranscriptCallback(segment);
      },
      onStatus: (status) => {
        // Emit interim status as a preview
        if (this.onTranscriptCallback && status !== 'Recording...' && status !== 'Transcribing...') {
          this.onTranscriptCallback({
            speaker: 'You',
            text: `${status}...`,
            timestamp: Date.now(),
          });
        }
      },
      onError: (err) => {
        console.error('[MeetingTranscriber] STT error:', err);
      },
      onEnd: () => {
        // Auto-restart if meeting is still active
        const meeting = this.meetingsStore.find(m => m.id === meetingId);
        if (meeting?.status === 'active' && this.stt) {
          this.stt.start();
        }
      },
    });

    this.stt = stt;
    await stt.start();
  }

  /** End a meeting and stop transcription */
  async endMeeting(meetingId: string): Promise<void> {
    if (!meetingId) throw new Error('No meeting ID provided');

    if (this.stt) {
      this.stt.stop();
      this.stt = null;
    }

    const meeting = this.meetingsStore.find(m => m.id === meetingId);
    if (meeting) {
      meeting.ended_at = Date.now();
      meeting.status = 'ended';
    }
  }

  /**
   * Summarise a completed meeting via the server-side /api/gemini/summarize proxy.
   * Called after endMeeting() — returns structured notes.
   * API key stays on the server (F-02 fix).
   */
  async summariseMeeting(meetingId: string): Promise<MeetingSummary | null> {
    const transcripts = await this.getMeetingTranscripts(meetingId);
    if (transcripts.length === 0) return null;

    const meeting = this.meetingsStore.find(m => m.id === meetingId);
    const transcriptText = transcripts
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker}: ${t.text}`)
      .join('\n');

    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { authHeaders } = await import('./api');
        headers = { ...headers, ...authHeaders() };
      } catch (err) {
        console.warn('[meetingTranscribe] Non-critical: auth module unavailable:', err);
      }

      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transcript: transcriptText,
          meetingTitle: meeting?.title ?? 'Untitled',
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return {
        summary: data.summary || '',
        actionItems: data.actionItems || [],
        decisions: data.decisions || data.keyDecisions || [],
        keyTopics: data.keyTopics || [],
      };
    } catch (err) {
      console.error('[MeetingTranscriber] Summarisation failed:', err);
      return null;
    }
  }

  async saveTranscript(meetingId: string, speaker: string, text: string): Promise<void> {
    this.transcriptsStore.push({
      id: ++this.transcriptIdCounter,
      meeting_id: meetingId,
      speaker,
      text,
      timestamp: Date.now(),
    });
  }

  async getMeetingTranscripts(meetingId: string): Promise<MeetingTranscript[]> {
    return this.transcriptsStore
      .filter(t => t.meeting_id === meetingId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getAllMeetings(): Promise<Meeting[]> {
    return [...this.meetingsStore].sort((a, b) => b.started_at - a.started_at);
  }

  async getActiveMeeting(): Promise<Meeting | null> {
    return this.meetingsStore.find(m => m.status === 'active') || null;
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    this.transcriptsStore = this.transcriptsStore.filter(t => t.meeting_id !== meetingId);
    this.meetingsStore = this.meetingsStore.filter(m => m.id !== meetingId);
  }

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

  cleanup(): void {
    if (this.stt) {
      this.stt.stop();
      this.stt = null;
    }
  }
}
