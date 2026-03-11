// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Meeting Transcription Service
 * Uses browser Web Speech API for real-time transcription.
 * Uses Gemini REST API (not Live) to summarise + extract action items on meeting end.
 */

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
  private recognition: SpeechRecognition | null = null;
  private onTranscriptCallback: ((segment: TranscriptionSegment) => void) | null = null;
  private geminiApiKey: string | null = null;

  // In-memory storage
  private meetingsStore: Meeting[] = [];
  private transcriptsStore: MeetingTranscript[] = [];
  private transcriptIdCounter = 0;

  constructor(apiKey?: string) {
    this.geminiApiKey = apiKey ?? null;
  }

  /** Update API key (used for end-of-meeting summarisation only) */
  setApiKey(apiKey: string) {
    this.geminiApiKey = apiKey;
  }

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
   * Start real-time transcription using the browser Web Speech API.
   * Does NOT use Gemini Live — no WebSocket, no API key required to start.
   */
  async startTranscription(meetingId: string, _audioStream?: MediaStream): Promise<void> {
    if (!meetingId) throw new Error('No active meeting');

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error(
        'Speech recognition is not supported in this browser. Try Chrome or Edge.'
      );
    }

    this.recognition = new SpeechRecognitionCtor() as SpeechRecognition;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    let pendingFinalText = '';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;

        if (result.isFinal) {
          pendingFinalText = text;
          const segment: TranscriptionSegment = {
            speaker: 'You',
            text,
            timestamp: Date.now(),
          };
          this.saveTranscript(meetingId, segment.speaker, segment.text);
          if (this.onTranscriptCallback) this.onTranscriptCallback(segment);
          pendingFinalText = '';
        } else {
          // Emit interim as a preview (not saved to store)
          if (this.onTranscriptCallback) {
            this.onTranscriptCallback({
              speaker: 'You',
              text: `${text}…`,
              timestamp: Date.now(),
            });
          }
        }
      }
      void pendingFinalText; // suppress unused warning
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' is normal during silences — restart quietly
      if (event.error === 'no-speech') {
        this.recognition?.start();
        return;
      }
      console.error('[MeetingTranscriber] SpeechRecognition error:', event.error);
    };

    this.recognition.onend = () => {
      // Auto-restart so continuous recording doesn't stop on short pauses
      const meeting = this.meetingsStore.find(m => m.id === meetingId);
      if (meeting?.status === 'active' && this.recognition) {
        try { this.recognition.start(); } catch { /* already started */ }
      }
    };

    this.recognition.start();
  }

  /** End a meeting and stop transcription */
  async endMeeting(meetingId: string): Promise<void> {
    if (!meetingId) throw new Error('No meeting ID provided');

    if (this.recognition) {
      this.recognition.onend = null; // prevent auto-restart
      this.recognition.stop();
      this.recognition = null;
    }

    const meeting = this.meetingsStore.find(m => m.id === meetingId);
    if (meeting) {
      meeting.ended_at = Date.now();
      meeting.status = 'ended';
    }
  }

  /**
   * Summarise a completed meeting using Gemini REST API.
   * Called after endMeeting() — returns structured notes.
   */
  async summariseMeeting(meetingId: string): Promise<MeetingSummary | null> {
    if (!this.geminiApiKey) return null;

    const transcripts = await this.getMeetingTranscripts(meetingId);
    if (transcripts.length === 0) return null;

    const meeting = this.meetingsStore.find(m => m.id === meetingId);
    const transcriptText = transcripts
      .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.speaker}: ${t.text}`)
      .join('\n');

    const prompt = `You are a meeting assistant. Analyse this meeting transcript and return a JSON object with:
- summary: 2-3 sentence overview
- actionItems: array of specific tasks/follow-ups identified
- decisions: array of decisions made
- keyTopics: array of main topics discussed

Meeting: ${meeting?.title ?? 'Untitled'}
Transcript:
${transcriptText}

Return ONLY valid JSON, no markdown.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      );
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as MeetingSummary;
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
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.stop();
      this.recognition = null;
    }
  }
}
