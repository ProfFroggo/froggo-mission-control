import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Phone, PhoneOff, Loader2, 
  MessageSquare, Brain, ListTodo, Clock, FileText,
  Download, ChevronRight, Calendar, Send, X
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';

/**
 * MeetingsPanel — Meeting transcription & eavesdrop (standalone)
 * 
 * Transcription engine: Gemini Live API (WebSocket-based, real-time input transcription)
 * Cleanup: Gemini Flash for post-processing
 * Storage: ~/clawd/meetings/*.md files
 */

// Gemini API key (same as used elsewhere in dashboard)
const GEMINI_API_KEY = 'AIzaSyAryVt2xhugisz03eraIhTMhXO6cKMYUGY';
const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const GEMINI_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

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

interface TranscriptLine {
  text: string;
  timestamp: number;
  cleaned?: string;
}

interface PastMeeting {
  id?: string; // DB id
  filename: string;
  filepath: string;
  date: Date;
  time: string;
  title?: string;
  duration?: number; // ms
  transcript: string[];
  actionItems: string[];
  tasksCreated: string[];
  rawContent: string;
  source: 'file' | 'db';
}

// Format duration as MM:SS or HH:MM:SS
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Task extraction patterns
const TASK_EXTRACTION_PATTERNS = [
  /action item[:\s]+(.+?)(?:\.|$)/gi,
  /todo[:\s]+(.+?)(?:\.|$)/gi,
  /task[:\s]+(.+?)(?:\.|$)/gi,
  /(?:i|we)\s+(?:need to|have to|should|will|must)\s+(.+?)(?:\.|$)/gi,
  /(?:you|they)\s+(?:need to|should|will|must)\s+(.+?)(?:\.|$)/gi,
  /follow up (?:on|with)\s+(.+?)(?:\.|$)/gi,
  /don't forget (?:to\s+)?(.+?)(?:\.|$)/gi,
  /remember to\s+(.+?)(?:\.|$)/gi,
];

export default function MeetingsPanel() {
  // Global state
  const { 
    isMuted, 
    toggleMuted,
    isMeetingActive, 
    setMeetingActive,
    addActivity 
  } = useStore();

  // Core state
  const [_listening, setListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>(gateway.getState());
  const connected = connectionState === 'connected';

  // Meeting title & timer
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [meetingDbId, setMeetingDbId] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Meeting state
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [meetingTranscriptLines, setMeetingTranscriptLines] = useState<TranscriptLine[]>([]);
  const [meetingActionItems, setMeetingActionItems] = useState<ActionItem[]>([]);
  const [meetingEndSummary, setMeetingEndSummary] = useState<{
    savedPath: string | null;
    tasksCreated: number;
    extractedTasks: string[];
  } | null>(null);

  // Past meetings
  const [pastMeetings, setPastMeetings] = useState<PastMeeting[]>([]);
  const [loadingPastMeetings, setLoadingPastMeetings] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<PastMeeting | null>(null);

  // AI Chat about meeting
  const [meetingChatInput, setMeetingChatInput] = useState('');
  const [meetingChatMessages, setMeetingChatMessages] = useState<Message[]>([]);
  const [meetingChatProcessing, setMeetingChatProcessing] = useState(false);

  // Refs
  const meetingTranscriptEndRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const endMeetingInProgressRef = useRef(false);

  // Gemini Live WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const transcriptBufferRef = useRef('');
  const meetingDbIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { meetingDbIdRef.current = meetingDbId; }, [meetingDbId]);

  // Track gateway state
  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);

  // Auto-scroll meeting transcript
  useEffect(() => {
    meetingTranscriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meetingTranscript]);

  // Load past meetings on mount
  useEffect(() => { loadPastMeetings(); }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
      if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); }
    };
  }, []);

  // ── Meeting Timer ──
  useEffect(() => {
    if (!meetingStartTime) { setElapsedTime(0); return; }
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - meetingStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStartTime]);

  // ── DB Helpers ──
  const dbExec = useCallback(async (sql: string, params: any[] = []) => {
    if (!(window as any).clawdbot?.db?.exec) return;
    await (window as any).clawdbot.db.exec(sql, params);
  }, []);

  const dbQuery = useCallback(async (sql: string, params: any[] = []): Promise<any[]> => {
    if (!(window as any).clawdbot?.db?.query) return [];
    try {
      return (await (window as any).clawdbot.db.query(sql, params)) || [];
    } catch { return []; }
  }, []);

  const ensureMeetingTables = useCallback(async () => {
    await dbExec(`CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, started_at INTEGER NOT NULL,
      ended_at INTEGER, duration INTEGER, participants TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active', summary TEXT, file_path TEXT
    )`);
    await dbExec(`CREATE TABLE IF NOT EXISTS meeting_transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_id TEXT NOT NULL,
      speaker TEXT NOT NULL, text TEXT NOT NULL, cleaned_text TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )`);
  }, [dbExec]);

  const saveMeetingToDb = useCallback(async (title: string): Promise<string> => {
    await ensureMeetingTables();
    const id = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await dbExec(
      `INSERT INTO meetings (id, title, started_at, status) VALUES (?, ?, ?, 'active')`,
      [id, title, Date.now()]
    );
    return id;
  }, [dbExec, ensureMeetingTables]);

  const saveTranscriptToDb = useCallback(async (meetingId: string, text: string, cleanedText?: string) => {
    if (!meetingId) return;
    await dbExec(
      `INSERT INTO meeting_transcripts (meeting_id, speaker, text, cleaned_text, timestamp) VALUES (?, 'user', ?, ?, ?)`,
      [meetingId, text, cleanedText || null, Date.now()]
    );
  }, [dbExec]);

  const endMeetingInDb = useCallback(async (meetingId: string, duration: number, summary?: string, filePath?: string) => {
    if (!meetingId) return;
    await dbExec(
      `UPDATE meetings SET ended_at = ?, duration = ?, status = 'ended', summary = ?, file_path = ? WHERE id = ?`,
      [Date.now(), duration, summary || null, filePath || null, meetingId]
    );
  }, [dbExec]);

  const loadDbMeetings = useCallback(async (): Promise<PastMeeting[]> => {
    await ensureMeetingTables();
    const rows = await dbQuery(`SELECT * FROM meetings WHERE status = 'ended' ORDER BY started_at DESC LIMIT 50`);
    const meetings: PastMeeting[] = [];
    for (const row of rows) {
      const transcripts = await dbQuery(
        `SELECT text, cleaned_text FROM meeting_transcripts WHERE meeting_id = ? ORDER BY timestamp ASC`,
        [row.id]
      );
      meetings.push({
        id: row.id,
        filename: row.title || 'Untitled',
        filepath: row.file_path || '',
        date: new Date(row.started_at),
        time: new Date(row.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        title: row.title,
        duration: row.duration,
        transcript: transcripts.map((t: any) => t.cleaned_text || t.text),
        actionItems: [],
        tasksCreated: [],
        rawContent: row.summary || transcripts.map((t: any) => t.cleaned_text || t.text).join('\n'),
        source: 'db',
      });
    }
    return meetings;
  }, [dbQuery, ensureMeetingTables]);

  // ── Generate AI Summary ──
  const generateSummary = useCallback(async (transcript: string[]): Promise<string | null> => {
    if (transcript.length === 0) return null;
    setGeneratingSummary(true);
    try {
      const fullText = transcript.join('\n');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Summarize this meeting transcript. Include:\n1. **Key Topics** discussed\n2. **Decisions** made\n3. **Action Items** with owners if mentioned\n4. **Next Steps**\n\nKeep it concise but comprehensive.\n\nTranscript:\n${fullText}` }] }],
            generationConfig: { maxOutputTokens: 2048, temperature: 0.3 }
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      }
    } catch (err) {
      console.error('[Meeting] Summary generation error:', err);
    } finally {
      setGeneratingSummary(false);
    }
    return null;
  }, []);

  // ── Action Item Detection ──
  const detectActionItems = useCallback((text: string): ActionItem[] => {
    const items: ActionItem[] = [];
    for (const pattern of TASK_EXTRACTION_PATTERNS) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const extractedText = match[1]?.trim();
        if (extractedText && extractedText.length > 3 && extractedText.length < 200) {
          let type: ActionItem['type'] = 'task';
          if (/schedule|meeting|calendar/i.test(text)) type = 'schedule';
          else if (/message|email|reply|send/i.test(text)) type = 'message';
          if (!items.some(i => i.text.toLowerCase() === extractedText.toLowerCase())) {
            items.push({ type, text: extractedText, confidence: 0.8 });
          }
        }
      }
    }
    return items;
  }, []);

  const extractTasksFromText = useCallback((text: string): string[] => {
    const tasks: string[] = [];
    for (const pattern of TASK_EXTRACTION_PATTERNS) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const task = match[1]?.trim();
        if (task && task.length > 3 && task.length < 200) {
          if (!tasks.some(t => t.toLowerCase() === task.toLowerCase())) tasks.push(task);
        }
      }
    }
    return tasks;
  }, []);

  // ── Load Past Meetings ──
  const loadPastMeetings = useCallback(async () => {
    if (!window.clawdbot?.exec?.run) return;
    setLoadingPastMeetings(true);
    try {
      const listResult = await window.clawdbot?.exec.run('ls -1 $HOME/clawd/meetings/*.md 2>/dev/null || echo ""');
      if (!listResult.success || !listResult.stdout.trim()) {
        setPastMeetings([]);
        setLoadingPastMeetings(false);
        return;
      }
      const files = listResult.stdout.trim().split('\n').filter((f: string) => f);
      const meetings: PastMeeting[] = [];
      for (const filepath of files) {
        try {
          const readResult = await window.clawdbot?.exec.run(`cat "${filepath}"`);
          if (!readResult.success) continue;
          const content = readResult.stdout;
          const filename = filepath.split('/').pop() || '';
          const match = filename.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.md/);
          let date = new Date();
          let time = '';
          if (match) {
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]));
            time = `${match[4]}:${match[5]}`;
          }
          const transcriptMatch = content.match(/## Transcript\n\n([\s\S]*?)(?=\n##|---|\n*$)/);
          const transcript: string[] = [];
          if (transcriptMatch) {
            for (const line of transcriptMatch[1].split('\n')) {
              const cleanLine = line.replace(/^>\s*/, '').trim();
              if (cleanLine) transcript.push(cleanLine);
            }
          }
          const actionItemsMatch = content.match(/## Action Items Detected\n\n([\s\S]*?)(?=\n##|---|\n*$)/);
          const actionItems: string[] = [];
          if (actionItemsMatch) {
            for (const line of actionItemsMatch[1].split('\n')) {
              const itemMatch = line.match(/- \[.\] \*\*\[(\w+)\]\*\* (.+)/);
              if (itemMatch) actionItems.push(`[${itemMatch[1]}] ${itemMatch[2]}`);
            }
          }
          const tasksMatch = content.match(/## Tasks to Create\n\n([\s\S]*?)(?=\n##|---|\n*$)/);
          const tasksCreated: string[] = [];
          if (tasksMatch) {
            for (const line of tasksMatch[1].split('\n')) {
              const taskMatch = line.match(/- \[.\] (.+)/);
              if (taskMatch) tasksCreated.push(taskMatch[1]);
            }
          }
          meetings.push({ filename, filepath, date, time, transcript, actionItems, tasksCreated, rawContent: content, source: 'file' });
        } catch (err) {
          console.error('[Meetings] Error parsing:', filepath, err);
        }
      }
      meetings.sort((a, b) => b.date.getTime() - a.date.getTime());
      // Also load DB meetings and merge
      try {
        const dbMeetings = await loadDbMeetings();
        const fileNames = new Set(meetings.map(m => m.filename));
        for (const dbm of dbMeetings) {
          if (!fileNames.has(dbm.filename)) {
            meetings.push(dbm);
          }
        }
        meetings.sort((a, b) => b.date.getTime() - a.date.getTime());
      } catch {}
      setPastMeetings(meetings);
    } catch (err) {
      console.error('[Meetings] Error loading:', err);
    } finally {
      setLoadingPastMeetings(false);
    }
  }, [loadDbMeetings]);

  // ── Save Meeting to File ──
  const saveMeetingToFile = useCallback(async (transcript: string[], actionItems: ActionItem[]): Promise<string | null> => {
    if (!window.clawdbot?.exec?.run) return null;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const filename = `${dateStr}-${timeStr}.md`;
    const filepath = `$HOME/clawd/meetings/${filename}`;
    const lines: string[] = [
      `# Meeting Notes - ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '', `**Time:** ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      '', `## Transcript`, '',
      ...transcript.map(line => `> ${line}`), '',
    ];
    if (actionItems.length > 0) {
      lines.push(`## Action Items Detected`, '');
      actionItems.forEach(item => lines.push(`- [ ] **[${item.type}]** ${item.text}`));
      lines.push('');
    }
    const fullText = transcript.join(' ');
    const extractedTasks = extractTasksFromText(fullText);
    if (extractedTasks.length > 0) {
      lines.push(`## Tasks to Create`, '');
      extractedTasks.forEach(task => lines.push(`- [ ] ${task}`));
      lines.push('');
    }
    lines.push(`---`, `*Generated by Froggo Voice Assistant*`);
    const content = lines.join('\n');
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    try {
      const result = await window.clawdbot?.exec.run(`mkdir -p $HOME/clawd/meetings && echo "${base64Content}" | base64 -d > "${filepath}"`);
      if (result.success) return filepath;
    } catch (err) {
      console.error('[Meeting] Save error:', err);
    }
    return null;
  }, [extractTasksFromText]);

  // ── Create Tasks ──
  const createTasksFromMeeting = useCallback(async (transcript: string[]): Promise<{ count: number; tasks: string[] }> => {
    if (!window.clawdbot?.tasks?.sync) return { count: 0, tasks: [] };
    const fullText = transcript.join(' ');
    const extracted = extractTasksFromText(fullText);
    let created = 0;
    const createdTasks: string[] = [];
    for (const taskText of extracted) {
      const taskId = `meeting-${Date.now()}-${created}`;
      let title = taskText.charAt(0).toUpperCase() + taskText.slice(1);
      title = title.replace(/[,;:]$/, '').trim();
      try {
        const result = await window.clawdbot?.tasks.sync({
          id: taskId, title, status: 'todo', project: 'Meetings',
          description: `From meeting on ${new Date().toLocaleDateString()}`,
        });
        if (result.success) { created++; createdTasks.push(title); }
      } catch {}
    }
    return { count: created, tasks: createdTasks };
  }, [extractTasksFromText]);

  // ── Gemini Live Transcription (WebSocket) ──
  const connectGeminiTranscription = useCallback(async (_stream: MediaStream) => {
    return new Promise<WebSocket>((resolve, reject) => {
      const url = `${GEMINI_WS_URL}?key=${GEMINI_API_KEY}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Gemini] WebSocket connected, sending setup...');
        // Send setup message for transcription-only mode
        ws.send(JSON.stringify({
          setup: {
            model: GEMINI_MODEL,
            generationConfig: {
              responseModalities: [], // No response audio - transcription only
            },
            realtimeInputConfig: {
              mediaResolution: 'MEDIA_RESOLUTION_LOW',
              speechConfig: {
                languageCode: 'en',
              },
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                prefixPaddingMs: 100,
                silenceDurationMs: 1500,
              },
            },
            inputAudioTranscription: {},
            systemInstruction: {
              parts: [{
                text: 'You are a silent meeting transcriber. Do NOT respond with any text or audio. Only listen and transcribe.'
              }]
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Setup complete
          if (data.setupComplete) {
            console.log('[Gemini] Setup complete, starting audio stream');
            resolve(ws);
            return;
          }

          // Input transcription (what the user said)
          if (data.serverContent?.inputTranscription?.text) {
            const text = data.serverContent.inputTranscription.text.trim();
            if (text) {
              console.log('[Gemini] Transcript:', text);
              // Accumulate into buffer, flush on sentence boundaries
              transcriptBufferRef.current += (transcriptBufferRef.current ? ' ' : '') + text;
              
              // Check if we have a complete thought (period, question mark, etc.)
              const buffer = transcriptBufferRef.current;
              if (/[.?!]\s*$/.test(buffer) || buffer.length > 200) {
                const finalText = buffer.trim();
                transcriptBufferRef.current = '';
                
                setMeetingTranscript(prev => [...prev, finalText]);
                setMeetingTranscriptLines(prev => [...prev, { text: finalText, timestamp: Date.now() }]);
                
                // Save to DB
                if (meetingDbIdRef.current) {
                  saveTranscriptToDb(meetingDbIdRef.current, finalText).catch(() => {});
                }
                
                // Detect action items
                const actions = detectActionItems(finalText);
                if (actions.length > 0) {
                  setMeetingActionItems(prev => [...prev, ...actions]);
                }

                // Gemini cleanup (async, non-blocking)
                cleanupWithGemini(finalText);
              }
            }
          }

          // Handle turn complete / interruption
          if (data.serverContent?.turnComplete) {
            // Flush any remaining buffer
            if (transcriptBufferRef.current.trim()) {
              const finalText = transcriptBufferRef.current.trim();
              transcriptBufferRef.current = '';
              setMeetingTranscript(prev => [...prev, finalText]);
              const actions = detectActionItems(finalText);
              if (actions.length > 0) setMeetingActionItems(prev => [...prev, ...actions]);
              cleanupWithGemini(finalText);
            }
          }
        } catch (err) {
          console.error('[Gemini] Message parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[Gemini] WebSocket error:', err);
        reject(new Error('Gemini WebSocket connection failed'));
      };

      ws.onclose = () => {
        console.log('[Gemini] WebSocket closed');
        wsRef.current = null;
      };
    });
  }, [detectActionItems]);

  // Stream mic audio to Gemini WebSocket
  const startAudioStreaming = useCallback((stream: MediaStream, ws: WebSocket) => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    streamRef.current = stream;

    const source = audioContext.createMediaStreamSource(stream);
    
    // Analyser for level meter
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Audio processor
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!listeningRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (isMutedRef.current) { setAudioLevel(0); return; }

      // Audio level
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg / 255);
      }

      // Convert to PCM16 and send
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }
      
      // Base64 encode
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      
      try {
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              data: btoa(binary),
              mimeType: 'audio/pcm;rate=16000'
            }]
          }
        }));
      } catch {}
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  // Gemini cleanup for transcript segments
  const cleanupWithGemini = useCallback(async (text: string) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Fix transcription errors. Common words: "perps" (perpetual futures), "Froggo", "Clawdbot", "Bitso", "Kanban", "onchain", "Solana".\n\nDO NOT add explanation or context. Output ONLY the corrected text:\n\n${text}` }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.1 }
          })
        }
      );
      if (response.ok) {
        const data = await response.json();
        const cleaned = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (cleaned && cleaned !== text) {
          setMeetingTranscript(prev => {
            const updated = [...prev];
            const idx = updated.indexOf(text);
            if (idx !== -1) updated[idx] = cleaned;
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('[Gemini] Cleanup error:', err);
    }
  }, []);

  // ── Start Meeting ──
  const startMeeting = useCallback(async () => {
    if (listeningRef.current) return;
    console.log('[Meeting] Starting with Gemini Live transcription...');
    setStatusMessage('Starting meeting...');
    setMeetingTranscript([]);
    setMeetingTranscriptLines([]);
    setMeetingActionItems([]);
    setMeetingEndSummary(null);
    setAiSummary(null);
    transcriptBufferRef.current = '';

    // Set start time for timer
    const startTime = Date.now();
    setMeetingStartTime(startTime);

    // Save to DB
    const title = meetingTitle.trim() || `Meeting ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const dbId = await saveMeetingToDb(title);
      setMeetingDbId(dbId);
    } catch (err) {
      console.warn('[Meeting] DB save failed, continuing:', err);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } 
      });

      listeningRef.current = true;
      setListening(true);

      // Connect Gemini Live WebSocket
      const ws = await connectGeminiTranscription(stream);
      
      // Start streaming audio
      startAudioStreaming(stream, ws);

      setMeetingActive(true);
      setShowTitleInput(false);
      setStatusMessage('Recording with Gemini...');
    } catch (e: any) {
      console.error('[Meeting] Failed to start:', e);
      setStatusMessage('Failed: ' + e.message);
      setMeetingStartTime(null);
      listeningRef.current = false;
      setListening(false);
    }
  }, [setMeetingActive, connectGeminiTranscription, startAudioStreaming, meetingTitle, saveMeetingToDb]);

  // ── End Meeting ──
  const endMeeting = useCallback(async () => {
    if (endMeetingInProgressRef.current) return;
    endMeetingInProgressRef.current = true;
    console.log('[Meeting] Ending...');

    try {
      // Flush transcript buffer
      if (transcriptBufferRef.current.trim()) {
        const finalText = transcriptBufferRef.current.trim();
        transcriptBufferRef.current = '';
        setMeetingTranscript(prev => [...prev, finalText]);
      }

      // Close WebSocket
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      // Stop mic
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      listeningRef.current = false;
      setListening(false);
      setAudioLevel(0);
      setMeetingActive(false);

      // Calculate duration
      const duration = meetingStartTime ? Date.now() - meetingStartTime : 0;
      setMeetingStartTime(null);

      // Wait for state to flush
      await new Promise(resolve => setTimeout(resolve, 100));

      // End in DB
      if (meetingDbId) {
        try {
          await endMeetingInDb(meetingDbId, duration);
        } catch {}
      }

    } catch (err) {
      console.error('[Meeting] Error ending:', err);
      setStatusMessage('Meeting ended with errors.');
      setMeetingActive(false);
      setMeetingStartTime(null);
    } finally {
      endMeetingInProgressRef.current = false;
    }
  }, [setMeetingActive, meetingStartTime, meetingDbId, endMeetingInDb]);

  // Post-process after meeting ends (save + create tasks)
  // This runs when isMeetingActive transitions to false with transcript data
  const prevMeetingActive = useRef(isMeetingActive);
  useEffect(() => {
    if (prevMeetingActive.current && !isMeetingActive && meetingTranscript.length > 0) {
      (async () => {
        setStatusMessage('Saving meeting notes...');
        let savedPath: string | null = null;
        let tasksCreated = 0;
        let extractedTasks: string[] = [];

        try {
          savedPath = await saveMeetingToFile(meetingTranscript, meetingActionItems);
        } catch {}

        try {
          const result = await createTasksFromMeeting(meetingTranscript);
          tasksCreated = result.count;
          extractedTasks = result.tasks;
        } catch {}

        // Generate AI summary
        const summary = await generateSummary(meetingTranscript);
        if (summary) setAiSummary(summary);

        // Update DB with summary and file path
        if (meetingDbId) {
          try {
            await endMeetingInDb(meetingDbId, elapsedTime, summary || undefined, savedPath || undefined);
          } catch {}
        }

        setMeetingEndSummary({ savedPath, tasksCreated, extractedTasks });

        if (savedPath || tasksCreated > 0) {
          const parts: string[] = [];
          if (savedPath) parts.push('Notes saved');
          if (tasksCreated > 0) parts.push(`${tasksCreated} task${tasksCreated > 1 ? 's' : ''} created`);
          setStatusMessage(parts.join(' • '));
          addActivity({ type: 'system', message: `📋 Meeting ended: ${parts.join(', ')}`, timestamp: Date.now() });
        } else {
          setStatusMessage('Meeting ended.');
        }
        loadPastMeetings();
      })();
    }
    prevMeetingActive.current = isMeetingActive;
  }, [isMeetingActive, meetingTranscript, meetingActionItems, saveMeetingToFile, createTasksFromMeeting, addActivity, loadPastMeetings]);

  // Sync with global meeting state (TopBar call button)
  useEffect(() => {
    if (isMeetingActive && !listeningRef.current && !endMeetingInProgressRef.current) {
      // Started from TopBar
      startMeeting();
    } else if (!isMeetingActive && listeningRef.current && !endMeetingInProgressRef.current) {
      // Stopped from TopBar
      endMeeting();
    }
  }, [isMeetingActive]);

  // ── Send Meeting Summary to Froggo ──
  const sendMeetingSummary = useCallback(async () => {
    const summary = [
      '**Meeting Summary:**', '',
      '**Transcript:**', meetingTranscript.join(' '), '',
      meetingActionItems.length > 0 ? '**Detected Action Items:**' : '',
      ...meetingActionItems.map(a => `- [${a.type}] ${a.text}`), '',
      'Please organize these notes and confirm any action items I should follow up on.',
    ].filter(Boolean).join('\n');

    try {
      await gateway.sendChat(summary);
    } catch {}
    setMeetingTranscript([]);
    setMeetingActionItems([]);
  }, [meetingTranscript, meetingActionItems]);

  // ── Export Meeting ──
  const exportMeeting = useCallback((meeting: PastMeeting) => {
    const blob = new Blob([meeting.rawContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = meeting.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusMessage('Meeting exported');
    setTimeout(() => setStatusMessage(''), 2000);
  }, []);

  // ── Ask About Meeting (AI Chat) ──
  const askAboutMeeting = useCallback(async (meeting: PastMeeting, question: string) => {
    if (!question.trim()) return;
    setMeetingChatProcessing(true);
    const userMsg: Message = { role: 'user', content: question, timestamp: Date.now() };
    setMeetingChatMessages(prev => [...prev, userMsg]);

    const isTaskRequest = /\b(create|add|make|new)\s+(a\s+)?(task|todo|ticket|item)\b/i.test(question);

    try {
      if (isTaskRequest && connected) {
        const taskContext = `Based on this meeting transcript, ${question}\n\nMeeting content:\n${meeting.transcript.join('\n')}`;
        const result = await gateway.sendChat(taskContext);
        if (result?.content && result.content !== 'NO_REPLY') {
          setMeetingChatMessages(prev => [...prev, { role: 'assistant', content: result.content, timestamp: Date.now() }]);
        }
      } else {
        const prompt = `You are helping Kevin review a meeting transcript. Answer questions about the meeting content.\n\nMeeting from ${meeting.date.toLocaleDateString()}:\n${meeting.rawContent}\n\nUser question: ${question}\n\nGive a helpful, concise answer based on the meeting content.`;
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1024 } })
          }
        );
        if (response.ok) {
          const data = await response.json();
          const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (answer) {
            setMeetingChatMessages(prev => [...prev, { role: 'assistant', content: answer, timestamp: Date.now() }]);
          }
        }
      }
    } catch (e: any) {
      setMeetingChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, timestamp: Date.now() }]);
    } finally {
      setMeetingChatProcessing(false);
      setMeetingChatInput('');
    }
  }, [connected]);

  // ── RENDER ──
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-clawd-border">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone size={20} className="text-clawd-accent" />
            <h2 className="text-lg font-semibold">Meetings</h2>
            {isMeetingActive && (
              <span className="flex items-center gap-1 text-sm text-orange-400">
                <span className="animate-pulse">●</span> Recording
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {statusMessage && <span className="text-sm text-clawd-text-dim">{statusMessage}</span>}
            <button
              onClick={toggleMuted}
              className={`p-2 rounded-lg transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-border/80'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex text-left">
        {/* Left: Meeting Control */}
        <div className="w-96 border-r border-clawd-border flex flex-col">
          {/* Start/End Button */}
          <div className="p-6 border-b border-clawd-border">
            {isMeetingActive ? (
              <div>
                {/* Timer display */}
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full">
                    <span className="animate-pulse text-red-400">●</span>
                    <span className="text-2xl font-mono font-bold text-red-400">{formatDuration(elapsedTime)}</span>
                  </div>
                  {meetingTitle && (
                    <p className="text-sm text-clawd-text-dim mt-2">{meetingTitle}</p>
                  )}
                </div>
                <button
                  onClick={endMeeting}
                  className="w-full py-5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-red-500/20"
                >
                  <PhoneOff size={24} />
                  End Meeting
                </button>
              </div>
            ) : showTitleInput ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') startMeeting(); if (e.key === 'Escape') setShowTitleInput(false); }}
                  placeholder="Meeting title (optional)"
                  className="w-full px-4 py-3 bg-clawd-surface border border-clawd-border rounded-xl text-sm focus:outline-none focus:border-clawd-accent"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={startMeeting}
                    className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
                  >
                    <Mic size={22} />
                    Start Recording
                  </button>
                  <button
                    onClick={() => setShowTitleInput(false)}
                    className="px-4 py-4 bg-clawd-surface border border-clawd-border rounded-xl hover:bg-clawd-border transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTitleInput(true)}
                className="w-full py-6 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-500/20"
              >
                <Phone size={28} />
                Start Meeting
              </button>
            )}
            {isMeetingActive && (
              <div className="mt-4">
                {/* Audio level indicator */}
                <div className="h-2 bg-clawd-surface rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-100 rounded-full"
                    style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-clawd-text-dim mt-2 text-center">
                  Gemini Live • Real-time transcription
                </p>
              </div>
            )}
          </div>

          {/* Live Transcript / Summary */}
          <div className="flex-1 overflow-y-auto p-4">
            {isMeetingActive ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={16} className="text-orange-400" />
                  <span className="font-medium">Live Transcript</span>
                </div>
                {meetingTranscript.length === 0 ? (
                  <div className="text-clawd-text-dim text-sm text-center py-8">
                    <Mic size={32} className="mx-auto mb-2 opacity-30" />
                    <p>Transcript will appear here...</p>
                    <p className="text-xs mt-2">Powered by Gemini Live API</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {meetingTranscript.map((line, i) => (
                      <p key={i} className="text-clawd-text bg-clawd-surface rounded px-3 py-2">{line}</p>
                    ))}
                    <div ref={meetingTranscriptEndRef} />
                  </div>
                )}
              </div>
            ) : meetingEndSummary ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={16} className="text-green-400" />
                  <span className="font-medium">Meeting Summary</span>
                </div>
                {meetingEndSummary.savedPath && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-400">✓ Notes saved</p>
                    <p className="text-xs text-clawd-text-dim mt-1">{meetingEndSummary.savedPath.split('/').pop()}</p>
                  </div>
                )}
                {meetingEndSummary.tasksCreated > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-400">✓ {meetingEndSummary.tasksCreated} task{meetingEndSummary.tasksCreated > 1 ? 's' : ''} created</p>
                    <ul className="text-xs text-clawd-text-dim mt-2 space-y-1">
                      {meetingEndSummary.extractedTasks.map((task, i) => (
                        <li key={i}>• {task}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {meetingTranscript.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-clawd-text-dim mb-2">Transcript:</p>
                    <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                      {meetingTranscript.map((line, i) => (
                        <p key={i} className="text-clawd-text-dim">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
                {/* AI Summary */}
                {generatingSummary && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-purple-400" />
                    <p className="text-sm text-purple-400">Generating AI summary...</p>
                  </div>
                )}
                {aiSummary && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-1">
                      <Brain size={14} /> AI Summary
                    </p>
                    <div className="text-xs text-clawd-text-dim">
                      <MarkdownMessage content={aiSummary} />
                    </div>
                  </div>
                )}
                {(meetingTranscript.length > 0 || meetingActionItems.length > 0) && (
                  <button
                    onClick={sendMeetingSummary}
                    className="w-full mt-4 px-4 py-2 bg-clawd-accent rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-clawd-accent/80"
                  >
                    <MessageSquare size={16} />
                    Send to Froggo
                  </button>
                )}
              </div>
            ) : (
              <div className="text-clawd-text-dim text-sm text-center py-8">
                <Phone size={32} className="mx-auto mb-2 opacity-30" />
                <p>Start a meeting to begin transcription</p>
                <p className="text-xs mt-2 text-clawd-text-dim/60">Uses Gemini Live for real-time speech-to-text</p>
              </div>
            )}
          </div>

          {/* Detected Action Items */}
          {(isMeetingActive || meetingEndSummary) && meetingActionItems.length > 0 && (
            <div className="border-t border-clawd-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <ListTodo size={16} className="text-orange-400" />
                <span className="text-sm font-medium text-orange-400">Detected Action Items</span>
              </div>
              <ul className="space-y-1 text-xs max-h-32 overflow-y-auto">
                {meetingActionItems.slice(-5).map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-orange-500/20 rounded text-orange-300 text-[10px]">{item.type}</span>
                    <span className="text-clawd-text-dim truncate">{item.text.slice(0, 50)}...</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Past Meetings */}
        <div className="flex-1 flex flex-col">
          {selectedMeeting ? (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setSelectedMeeting(null); setMeetingChatMessages([]); }} className="p-2 hover:bg-clawd-surface rounded-lg">
                    <X size={16} />
                  </button>
                  <div>
                    <h3 className="font-medium">{selectedMeeting.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                    <p className="text-sm text-clawd-text-dim">{selectedMeeting.time}</p>
                  </div>
                </div>
                <button onClick={() => exportMeeting(selectedMeeting)} className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:border-clawd-accent">
                  <Download size={14} /> Export
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-sm font-medium text-clawd-text-dim mb-2">Transcript</h4>
                <div className="space-y-2 text-sm mb-6">
                  {selectedMeeting.transcript.map((line, i) => (
                    <p key={i} className="text-clawd-text bg-clawd-surface rounded px-3 py-2">{line}</p>
                  ))}
                </div>
                {selectedMeeting.actionItems.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-clawd-text-dim mb-2">Action Items</h4>
                    <ul className="space-y-1 text-sm mb-6">
                      {selectedMeeting.actionItems.map((item, i) => (
                        <li key={i} className="text-clawd-text">• {item}</li>
                      ))}
                    </ul>
                  </>
                )}
                {selectedMeeting.tasksCreated.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-clawd-text-dim mb-2">Tasks Created</h4>
                    <ul className="space-y-1 text-sm">
                      {selectedMeeting.tasksCreated.map((task, i) => (
                        <li key={i} className="text-clawd-text">• {task}</li>
                      ))}
                    </ul>
                  </>
                )}
                {/* AI Chat */}
                <div className="mt-6 pt-4 border-t border-clawd-border">
                  <h4 className="text-sm font-medium text-clawd-text-dim mb-3 flex items-center gap-2">
                    <Brain size={16} /> Ask about this meeting
                  </h4>
                  {meetingChatMessages.length > 0 && (
                    <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                      {meetingChatMessages.map((msg, i) => (
                        <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                          <span className={`inline-block rounded-lg px-3 py-2 max-w-[90%] ${msg.role === 'user' ? 'bg-clawd-accent text-white' : 'bg-clawd-surface border border-clawd-border'}`}>
                            {msg.role === 'assistant' ? <MarkdownMessage content={msg.content} /> : msg.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={meetingChatInput}
                      onChange={(e) => setMeetingChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && meetingChatInput.trim()) askAboutMeeting(selectedMeeting, meetingChatInput); }}
                      placeholder="What were the main topics discussed?"
                      className="flex-1 px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm focus:outline-none focus:border-clawd-accent"
                      disabled={meetingChatProcessing}
                    />
                    <button
                      onClick={() => askAboutMeeting(selectedMeeting, meetingChatInput)}
                      disabled={!meetingChatInput.trim() || meetingChatProcessing}
                      className="px-3 py-2 bg-clawd-accent rounded-lg hover:bg-clawd-accent/80 disabled:opacity-50"
                    >
                      {meetingChatProcessing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-clawd-border">
                <h3 className="font-medium flex items-center gap-2"><Clock size={16} /> Past Meetings</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingPastMeetings ? (
                  <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-clawd-text-dim" /></div>
                ) : pastMeetings.length === 0 ? (
                  <div className="text-clawd-text-dim text-sm text-center py-8">
                    <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No past meetings found</p>
                    <p className="text-xs mt-1">Meetings are saved to ~/clawd/meetings/</p>
                  </div>
                ) : (
                  <div className="divide-y divide-clawd-border">
                    {pastMeetings.map((meeting, i) => (
                      <button key={i} onClick={() => setSelectedMeeting(meeting)} className="w-full p-4 text-left hover:bg-clawd-surface/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{meeting.title || meeting.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                            <div className="flex items-center gap-2 text-sm text-clawd-text-dim">
                              <span>{meeting.time}</span>
                              {meeting.duration && meeting.duration > 0 && (
                                <span className="text-xs px-1.5 py-0.5 bg-clawd-surface rounded">{formatDuration(meeting.duration)}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-clawd-text-dim" />
                        </div>
                        {meeting.transcript.length > 0 && (
                          <p className="text-sm text-clawd-text-dim mt-2 line-clamp-2">{meeting.transcript[0]}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {meeting.actionItems.length > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded">{meeting.actionItems.length} action items</span>
                          )}
                          {meeting.tasksCreated.length > 0 && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">{meeting.tasksCreated.length} tasks</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-clawd-border">
                <button onClick={loadPastMeetings} disabled={loadingPastMeetings} className="text-sm text-clawd-text-dim hover:text-clawd-accent flex items-center gap-1">
                  <Loader2 size={14} className={loadingPastMeetings ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
