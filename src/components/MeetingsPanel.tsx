import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Phone, PhoneOff, Loader2, 
  MessageSquare, Brain, ListTodo, Clock, FileText,
  Download, ChevronRight, Calendar, Send, X,
  Check, Edit3, Trash2, Plus, CheckCircle2, XCircle
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';

/**
 * MeetingsPanel — Redesigned Meeting Transcription & Workflow
 * 
 * Key Changes:
 * 1. Layout: Proper max-width, left-aligned text, better scrolling
 * 2. Workflow: End-of-meeting summary focus (not live updates)
 * 3. Action Items: Clear approve/edit/dismiss workflow
 */

// Gemini API key — loaded dynamically, no hardcoded fallback
let _cachedGeminiKey: string | null = null;
async function getGeminiApiKey(): Promise<string> {
  if (_cachedGeminiKey) return _cachedGeminiKey;
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
  if (viteKey && viteKey !== 'your_key_here') { _cachedGeminiKey = viteKey; return viteKey; }
  try {
    const key = await (window as any).clawdbot?.settings?.getApiKey?.('gemini');
    if (key) { _cachedGeminiKey = key; return key; }
  } catch {}
  try {
    const s = JSON.parse(localStorage.getItem('froggo-settings') || '{}');
    if (s.geminiApiKey) { _cachedGeminiKey = s.geminiApiKey; return s.geminiApiKey; }
  } catch {}
  return '';
}
const GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const GEMINI_MODEL = 'models/gemini-live-2.5-flash-preview';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ActionItem {
  id: string;
  type: 'schedule' | 'message' | 'email' | 'task' | 'general';
  text: string;
  confidence: number;
  status: 'pending' | 'approved' | 'dismissed';
  editedText?: string;
}

interface TranscriptLine {
  text: string;
  timestamp: number;
  cleaned?: string;
}

interface PastMeeting {
  id?: string;
  filename: string;
  filepath: string;
  date: Date;
  time: string;
  title?: string;
  duration?: number;
  transcript: string[];
  actionItems: string[];
  tasksCreated: string[];
  rawContent: string;
  source: 'file' | 'db';
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

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

  // Meeting state
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStartTime, setMeetingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [meetingDbId, setMeetingDbId] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Transcript & action items
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [meetingTranscriptLines, setMeetingTranscriptLines] = useState<TranscriptLine[]>([]);
  const [meetingActionItems, setMeetingActionItems] = useState<ActionItem[]>([]);
  const [meetingEndSummary, setMeetingEndSummary] = useState<{
    savedPath: string | null;
    tasksCreated: number;
    extractedTasks: string[];
  } | null>(null);

  // Action item editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // View state
  const [activeView, setActiveView] = useState<'current' | 'history'>('current');
  const [pastMeetings, setPastMeetings] = useState<PastMeeting[]>([]);
  const [loadingPastMeetings, setLoadingPastMeetings] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<PastMeeting | null>(null);

  // AI Chat
  const [meetingChatInput, setMeetingChatInput] = useState('');
  const [meetingChatMessages, setMeetingChatMessages] = useState<Message[]>([]);
  const [meetingChatProcessing, setMeetingChatProcessing] = useState(false);

  // Refs
  const listeningRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const endMeetingInProgressRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const transcriptBufferRef = useRef('');
  const meetingDbIdRef = useRef<string | null>(null);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { meetingDbIdRef.current = meetingDbId; }, [meetingDbId]);

  useEffect(() => {
    const unsub = gateway.on('stateChange', ({ state }: { state: ConnectionState }) => {
      setConnectionState(state);
    });
    setConnectionState(gateway.getState());
    return () => { unsub(); };
  }, []);

  useEffect(() => { loadPastMeetings(); }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
      if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); }
    };
  }, []);

  useEffect(() => {
    if (!meetingStartTime) { setElapsedTime(0); return; }
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - meetingStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStartTime]);

  // DB Helpers
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

  const generateSummary = useCallback(async (transcript: string[]): Promise<string | null> => {
    if (transcript.length === 0) return null;
    setGeneratingSummary(true);
    try {
      const fullText = transcript.join('\n');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${await getGeminiApiKey()}`,
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
            items.push({ 
              id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type, 
              text: extractedText, 
              confidence: 0.8,
              status: 'pending'
            });
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

  const loadPastMeetings = useCallback(async () => {
    if (!window.clawdbot?.exec?.run) return;
    setLoadingPastMeetings(true);
    try {
      const listResult = await window.clawdbot?.exec.run('ls -1 $HOME/froggo/meetings/*.md 2>/dev/null || echo ""');
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

  const saveMeetingToFile = useCallback(async (transcript: string[], actionItems: ActionItem[]): Promise<string | null> => {
    if (!window.clawdbot?.exec?.run) return null;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const filename = `${dateStr}-${timeStr}.md`;
    const filepath = `$HOME/froggo/meetings/${filename}`;
    const approvedItems = actionItems.filter(i => i.status === 'approved');
    const lines: string[] = [
      `# Meeting Notes - ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '', `**Time:** ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      '', `## Transcript`, '',
      ...transcript.map(line => `> ${line}`), '',
    ];
    if (approvedItems.length > 0) {
      lines.push(`## Action Items`, '');
      approvedItems.forEach(item => lines.push(`- [ ] **[${item.type}]** ${item.editedText || item.text}`));
      lines.push('');
    }
    lines.push(`---`, `*Generated by Froggo Voice Assistant*`);
    const content = lines.join('\n');
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    try {
      const result = await window.clawdbot?.exec.run(`mkdir -p $HOME/froggo/meetings && echo "${base64Content}" | base64 -d > "${filepath}"`);
      if (result.success) return filepath;
    } catch (err) {
      console.error('[Meeting] Save error:', err);
    }
    return null;
  }, []);

  // Action Item Handlers
  const approveActionItem = useCallback((id: string) => {
    setMeetingActionItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'approved' as const } : item
    ));
  }, []);

  const dismissActionItem = useCallback((id: string) => {
    setMeetingActionItems(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'dismissed' as const } : item
    ));
  }, []);

  const startEditingItem = useCallback((item: ActionItem) => {
    setEditingItemId(item.id);
    setEditingText(item.editedText || item.text);
  }, []);

  const saveEditedItem = useCallback(() => {
    if (!editingItemId) return;
    setMeetingActionItems(prev => prev.map(item => 
      item.id === editingItemId ? { ...item, editedText: editingText, status: 'approved' as const } : item
    ));
    setEditingItemId(null);
    setEditingText('');
  }, [editingItemId, editingText]);

  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setEditingText('');
  }, []);

  const approveAllPending = useCallback(() => {
    setMeetingActionItems(prev => prev.map(item => 
      item.status === 'pending' ? { ...item, status: 'approved' as const } : item
    ));
  }, []);

  const createTasksFromApproved = useCallback(async (): Promise<number> => {
    if (!window.clawdbot?.tasks?.sync) return 0;
    const approved = meetingActionItems.filter(i => i.status === 'approved');
    let created = 0;
    for (const item of approved) {
      const taskId = `meeting-${Date.now()}-${created}`;
      let title = (item.editedText || item.text).charAt(0).toUpperCase() + (item.editedText || item.text).slice(1);
      title = title.replace(/[,;:]$/, '').trim();
      try {
        const result = await window.clawdbot?.tasks.sync({
          id: taskId, title, status: 'todo', project: 'Meetings',
          description: `From meeting on ${new Date().toLocaleDateString()}`,
        });
        if (result.success) created++;
      } catch {}
    }
    return created;
  }, [meetingActionItems]);

  // Gemini Live Transcription
  const connectGeminiTranscription = useCallback(async (_stream: MediaStream) => {
    const apiKey = await getGeminiApiKey();
    return new Promise<WebSocket>((resolve, reject) => {
      const url = `${GEMINI_WS_URL}?key=${apiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Gemini] WebSocket connected, sending setup...');
        ws.send(JSON.stringify({
          setup: {
            model: GEMINI_MODEL,
            generationConfig: { responseModalities: [] },
            realtimeInputConfig: {
              mediaResolution: 'MEDIA_RESOLUTION_LOW',
              speechConfig: { languageCode: 'en' },
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
              parts: [{ text: 'You are a silent meeting transcriber. Do NOT respond with any text or audio. Only listen and transcribe.' }]
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.setupComplete) {
            console.log('[Gemini] Setup complete');
            resolve(ws);
            return;
          }
          if (data.serverContent?.inputTranscription?.text) {
            const text = data.serverContent.inputTranscription.text.trim();
            if (text) {
              transcriptBufferRef.current += (transcriptBufferRef.current ? ' ' : '') + text;
              const buffer = transcriptBufferRef.current;
              if (/[.?!]\s*$/.test(buffer) || buffer.length > 200) {
                const finalText = buffer.trim();
                transcriptBufferRef.current = '';
                setMeetingTranscript(prev => [...prev, finalText]);
                setMeetingTranscriptLines(prev => [...prev, { text: finalText, timestamp: Date.now() }]);
                if (meetingDbIdRef.current) {
                  saveTranscriptToDb(meetingDbIdRef.current, finalText).catch(() => {});
                }
                const actions = detectActionItems(finalText);
                if (actions.length > 0) {
                  setMeetingActionItems(prev => [...prev, ...actions]);
                }
                cleanupWithGemini(finalText);
              }
            }
          }
          if (data.serverContent?.turnComplete) {
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

  const startAudioStreaming = useCallback((stream: MediaStream, ws: WebSocket) => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    streamRef.current = stream;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (!listeningRef.current || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (isMutedRef.current) { setAudioLevel(0); return; }
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(avg / 255);
      }
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      try {
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{ data: btoa(binary), mimeType: 'audio/pcm;rate=16000' }]
          }
        }));
      } catch {}
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
  }, []);

  const cleanupWithGemini = useCallback(async (text: string) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${await getGeminiApiKey()}`,
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

  const startMeeting = useCallback(async () => {
    if (listeningRef.current) return;
    console.log('[Meeting] Starting...');
    setStatusMessage('Starting meeting...');
    setMeetingTranscript([]);
    setMeetingTranscriptLines([]);
    setMeetingActionItems([]);
    setMeetingEndSummary(null);
    setAiSummary(null);
    transcriptBufferRef.current = '';
    const startTime = Date.now();
    setMeetingStartTime(startTime);
    const title = meetingTitle.trim() || `Meeting ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const dbId = await saveMeetingToDb(title);
      setMeetingDbId(dbId);
    } catch (err) {
      console.warn('[Meeting] DB save failed:', err);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } 
      });
      listeningRef.current = true;
      setListening(true);
      const ws = await connectGeminiTranscription(stream);
      startAudioStreaming(stream, ws);
      setMeetingActive(true);
      setShowTitleInput(false);
      setStatusMessage('Recording...');
    } catch (e: any) {
      console.error('[Meeting] Failed to start:', e);
      setStatusMessage('Failed: ' + e.message);
      setMeetingStartTime(null);
      listeningRef.current = false;
      setListening(false);
    }
  }, [setMeetingActive, connectGeminiTranscription, startAudioStreaming, meetingTitle, saveMeetingToDb]);

  const endMeeting = useCallback(async () => {
    if (endMeetingInProgressRef.current) return;
    endMeetingInProgressRef.current = true;
    console.log('[Meeting] Ending...');
    try {
      if (transcriptBufferRef.current.trim()) {
        const finalText = transcriptBufferRef.current.trim();
        transcriptBufferRef.current = '';
        setMeetingTranscript(prev => [...prev, finalText]);
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      listeningRef.current = false;
      setListening(false);
      setAudioLevel(0);
      setMeetingActive(false);
      const duration = meetingStartTime ? Date.now() - meetingStartTime : 0;
      setMeetingStartTime(null);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (meetingDbId) {
        try { await endMeetingInDb(meetingDbId, duration); } catch {}
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

  // Post-process after meeting ends
  const prevMeetingActive = useRef(isMeetingActive);
  useEffect(() => {
    if (prevMeetingActive.current && !isMeetingActive && meetingTranscript.length > 0) {
      (async () => {
        setStatusMessage('Processing meeting...');
        let savedPath: string | null = null;
        try {
          savedPath = await saveMeetingToFile(meetingTranscript, meetingActionItems);
        } catch {}
        const summary = await generateSummary(meetingTranscript);
        if (summary) setAiSummary(summary);
        if (meetingDbId) {
          try { await endMeetingInDb(meetingDbId, elapsedTime, summary || undefined, savedPath || undefined); } catch {}
        }
        setMeetingEndSummary({ savedPath, tasksCreated: 0, extractedTasks: [] });
        setStatusMessage('Meeting ended');
        addActivity({ type: 'system', message: '📋 Meeting ended', timestamp: Date.now() });
        loadPastMeetings();
      })();
    }
    prevMeetingActive.current = isMeetingActive;
  }, [isMeetingActive, meetingTranscript, meetingActionItems, saveMeetingToFile, generateSummary, addActivity, loadPastMeetings, meetingDbId, elapsedTime, endMeetingInDb]);

  useEffect(() => {
    if (isMeetingActive && !listeningRef.current && !endMeetingInProgressRef.current) {
      startMeeting();
    } else if (!isMeetingActive && listeningRef.current && !endMeetingInProgressRef.current) {
      endMeeting();
    }
  }, [isMeetingActive]);

  const sendMeetingSummary = useCallback(async () => {
    const approved = meetingActionItems.filter(i => i.status === 'approved');
    const summary = [
      '**Meeting Summary:**', '',
      '**Transcript:**', meetingTranscript.join(' '), '',
      approved.length > 0 ? '**Approved Action Items:**' : '',
      ...approved.map(a => `- [${a.type}] ${a.editedText || a.text}`), '',
      'Please confirm any action items.',
    ].filter(Boolean).join('\n');
    try { await gateway.sendChat(summary); } catch {}
    setMeetingTranscript([]);
    setMeetingActionItems([]);
  }, [meetingTranscript, meetingActionItems]);

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
  }, []);

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
        const prompt = `You are helping Kevin review a meeting transcript. Answer questions about the meeting content.\n\nMeeting from ${meeting.date.toLocaleDateString()}:\n${meeting.rawContent}\n\nUser question: ${question}\n\nGive a helpful, concise answer.`;
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${await getGeminiApiKey()}`,
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

  const pendingItems = meetingActionItems.filter(i => i.status === 'pending');
  const approvedItems = meetingActionItems.filter(i => i.status === 'approved');

  // ── RENDER ──
  return (
    <div className="h-full flex flex-col bg-clawd-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-clawd-border bg-clawd-surface">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Phone size={20} className="text-green-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-clawd-text">Meetings</h1>
                <p className="text-sm text-clawd-text-dim">
                  {isMeetingActive ? 'Recording in progress' : 'Transcribe and review meetings'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {statusMessage && (
                <span className="text-sm text-clawd-text-dim bg-clawd-bg px-3 py-1 rounded-full">
                  {statusMessage}
                </span>
              )}
              <button
                onClick={toggleMuted}
                className={`p-2.5 rounded-lg transition-all ${isMuted 
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                  : 'bg-clawd-border text-clawd-text-dim hover:bg-clawd-border/80'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="shrink-0 border-b border-clawd-border bg-clawd-surface/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => { setActiveView('current'); setSelectedMeeting(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeView === 'current' 
                  ? 'border-green-500 text-green-500' 
                  : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              Current Meeting
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeView === 'history' 
                  ? 'border-green-500 text-green-500' 
                  : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              Past Meetings
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6">
            
            {activeView === 'current' && (
              <div className="space-y-6">
                {/* Meeting Control Card */}
                <div className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                  <div className="p-6">
                    {isMeetingActive ? (
                      <div className="space-y-6">
                        {/* Active Meeting Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                <span className="text-3xl font-mono font-bold text-red-500">
                                  {formatDuration(elapsedTime)}
                                </span>
                              </div>
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                            </div>
                            <div>
                              <p className="font-medium text-clawd-text">{meetingTitle || 'Untitled Meeting'}</p>
                              <p className="text-sm text-clawd-text-dim">Recording with Gemini Live</p>
                            </div>
                          </div>
                          <button
                            onClick={endMeeting}
                            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-red-500/20"
                          >
                            <PhoneOff size={20} />
                            End Meeting
                          </button>
                        </div>

                        {/* Audio Level */}
                        <div>
                          <div className="h-2 bg-clawd-bg rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-100 rounded-full"
                              style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-clawd-text-dim mt-2">Audio level</p>
                        </div>

                        {/* Minimal Live Indicator */}
                        <div className="bg-clawd-bg rounded-xl p-4">
                          <div className="flex items-center gap-2 text-clawd-text-dim">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-sm">
                              {meetingTranscript.length > 0 
                                ? `${meetingTranscript.length} segments captured`
                                : 'Listening for speech...'
                              }
                            </span>
                          </div>
                          {meetingTranscript.length > 0 && (
                            <p className="text-sm text-clawd-text mt-2 line-clamp-2">
                              {meetingTranscript[meetingTranscript.length - 1]}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : showTitleInput ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={meetingTitle}
                          onChange={(e) => setMeetingTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') startMeeting(); if (e.key === 'Escape') setShowTitleInput(false); }}
                          placeholder="Meeting title (optional)"
                          className="w-full px-4 py-3 bg-clawd-bg border border-clawd-border rounded-xl text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20"
                          autoFocus
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={startMeeting}
                            className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-500/20"
                          >
                            <Mic size={24} />
                            Start Recording
                          </button>
                          <button
                            onClick={() => setShowTitleInput(false)}
                            className="px-5 py-4 bg-clawd-bg border border-clawd-border rounded-xl hover:bg-clawd-border transition-all"
                          >
                            <X size={20} className="text-clawd-text-dim" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-500/10 flex items-center justify-center">
                          <Phone size={36} className="text-green-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-clawd-text mb-2">Start a Meeting</h2>
                        <p className="text-clawd-text-dim mb-6 max-w-md mx-auto">
                          Record, transcribe, and extract action items from your meetings with AI-powered transcription.
                        </p>
                        <button
                          onClick={() => setShowTitleInput(true)}
                          className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-500/20 mx-auto"
                        >
                          <Phone size={24} />
                          New Meeting
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Post-Meeting Summary */}
                {meetingEndSummary && !isMeetingActive && (
                  <>
                    {/* AI Summary */}
                    {(generatingSummary || aiSummary) && (
                      <div className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-clawd-border flex items-center gap-2">
                          <Brain size={18} className="text-purple-400" />
                          <h3 className="font-medium text-clawd-text">AI Summary</h3>
                          {generatingSummary && <Loader2 size={14} className="animate-spin text-clawd-text-dim" />}
                        </div>
                        <div className="p-6">
                          {generatingSummary ? (
                            <div className="flex items-center gap-3 text-clawd-text-dim">
                              <Loader2 size={16} className="animate-spin" />
                              <span>Generating summary...</span>
                            </div>
                          ) : aiSummary ? (
                            <div className="prose prose-sm prose-invert max-w-none">
                              <MarkdownMessage content={aiSummary} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Action Items Approval */}
                    {meetingActionItems.length > 0 && (
                      <div className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ListTodo size={18} className="text-orange-400" />
                            <h3 className="font-medium text-clawd-text">Action Items</h3>
                            <span className="text-xs px-2 py-0.5 bg-clawd-bg rounded-full text-clawd-text-dim">
                              {pendingItems.length} pending • {approvedItems.length} approved
                            </span>
                          </div>
                          {pendingItems.length > 0 && (
                            <button
                              onClick={approveAllPending}
                              className="text-sm text-green-500 hover:text-green-400 flex items-center gap-1"
                            >
                              <CheckCircle2 size={14} />
                              Approve All
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-clawd-border">
                          {meetingActionItems.map((item) => (
                            <div 
                              key={item.id} 
                              className={`p-4 transition-all ${
                                item.status === 'dismissed' ? 'opacity-40' : ''
                              } ${item.status === 'approved' ? 'bg-green-500/5' : ''}`}
                            >
                              {editingItemId === item.id ? (
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-clawd-text focus:outline-none focus:border-green-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditedItem();
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={saveEditedItem}
                                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 flex items-center gap-1"
                                    >
                                      <Check size={14} />
                                      Save & Approve
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="px-3 py-1.5 bg-clawd-bg border border-clawd-border rounded-lg text-sm hover:bg-clawd-border text-clawd-text-dim"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        item.type === 'task' ? 'bg-blue-500/20 text-blue-400' :
                                        item.type === 'schedule' ? 'bg-purple-500/20 text-purple-400' :
                                        item.type === 'message' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-clawd-border text-clawd-text-dim'
                                      }`}>
                                        {item.type}
                                      </span>
                                      {item.status === 'approved' && (
                                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                                          <Check size={10} />
                                          Approved
                                        </span>
                                      )}
                                      {item.status === 'dismissed' && (
                                        <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                                          Dismissed
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-sm ${item.status === 'dismissed' ? 'line-through text-clawd-text-dim' : 'text-clawd-text'}`}>
                                      {item.editedText || item.text}
                                    </p>
                                  </div>
                                  {item.status === 'pending' && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => approveActionItem(item.id)}
                                        className="p-2 hover:bg-green-500/10 rounded-lg text-green-500 transition-all"
                                        title="Approve"
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button
                                        onClick={() => startEditingItem(item)}
                                        className="p-2 hover:bg-clawd-bg rounded-lg text-clawd-text-dim transition-all"
                                        title="Edit"
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                      <button
                                        onClick={() => dismissActionItem(item.id)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all"
                                        title="Dismiss"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {approvedItems.length > 0 && (
                          <div className="p-4 border-t border-clawd-border bg-clawd-bg/50 flex items-center justify-between">
                            <p className="text-sm text-clawd-text-dim">
                              {approvedItems.length} item{approvedItems.length > 1 ? 's' : ''} ready to create as tasks
                            </p>
                            <button
                              onClick={async () => {
                                const count = await createTasksFromApproved();
                                setMeetingEndSummary(prev => prev ? { ...prev, tasksCreated: count } : null);
                                addActivity({ type: 'system', message: `✅ Created ${count} tasks from meeting`, timestamp: Date.now() });
                              }}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                            >
                              <Plus size={16} />
                              Create Tasks
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Full Transcript (collapsed by default) */}
                    {meetingTranscript.length > 0 && (
                      <details className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                        <summary className="p-4 cursor-pointer hover:bg-clawd-bg/50 flex items-center gap-2">
                          <FileText size={18} className="text-clawd-text-dim" />
                          <span className="font-medium text-clawd-text">Full Transcript</span>
                          <span className="text-xs px-2 py-0.5 bg-clawd-bg rounded-full text-clawd-text-dim">
                            {meetingTranscript.length} segments
                          </span>
                        </summary>
                        <div className="p-4 border-t border-clawd-border max-h-96 overflow-y-auto">
                          <div className="space-y-2">
                            {meetingTranscript.map((line, i) => (
                              <p key={i} className="text-sm text-clawd-text bg-clawd-bg rounded-lg px-3 py-2">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      </details>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={sendMeetingSummary}
                        className="flex-1 px-4 py-3 bg-clawd-surface border border-clawd-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:border-green-500 transition-all"
                      >
                        <MessageSquare size={18} />
                        Send to Froggo
                      </button>
                      <button
                        onClick={() => {
                          setMeetingTranscript([]);
                          setMeetingActionItems([]);
                          setMeetingEndSummary(null);
                          setAiSummary(null);
                        }}
                        className="px-4 py-3 bg-clawd-surface border border-clawd-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:border-red-500 text-clawd-text-dim transition-all"
                      >
                        <Trash2 size={18} />
                        Clear
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeView === 'history' && (
              <div>
                {selectedMeeting ? (
                  <div className="space-y-6">
                    {/* Meeting Detail Header */}
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => { setSelectedMeeting(null); setMeetingChatMessages([]); }}
                        className="flex items-center gap-2 text-clawd-text-dim hover:text-clawd-text transition-all"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                        Back to list
                      </button>
                      <button 
                        onClick={() => exportMeeting(selectedMeeting)}
                        className="flex items-center gap-2 px-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:border-clawd-accent transition-all"
                      >
                        <Download size={16} />
                        Export
                      </button>
                    </div>

                    {/* Meeting Info */}
                    <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
                      <h2 className="text-xl font-semibold text-clawd-text mb-2">
                        {selectedMeeting.title || selectedMeeting.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h2>
                      <div className="flex items-center gap-4 text-sm text-clawd-text-dim">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {selectedMeeting.date.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {selectedMeeting.time}
                        </span>
                        {selectedMeeting.duration && selectedMeeting.duration > 0 && (
                          <span className="px-2 py-0.5 bg-clawd-bg rounded-full">
                            {formatDuration(selectedMeeting.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Transcript */}
                    {selectedMeeting.transcript.length > 0 && (
                      <div className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-clawd-border">
                          <h3 className="font-medium text-clawd-text flex items-center gap-2">
                            <FileText size={16} />
                            Transcript
                          </h3>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                          {selectedMeeting.transcript.map((line, i) => (
                            <p key={i} className="text-sm text-clawd-text bg-clawd-bg rounded-lg px-3 py-2">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items & Tasks */}
                    {(selectedMeeting.actionItems.length > 0 || selectedMeeting.tasksCreated.length > 0) && (
                      <div className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-clawd-border">
                          <h3 className="font-medium text-clawd-text flex items-center gap-2">
                            <ListTodo size={16} />
                            Action Items
                          </h3>
                        </div>
                        <div className="p-4 space-y-4">
                          {selectedMeeting.actionItems.length > 0 && (
                            <div>
                              <p className="text-xs text-clawd-text-dim mb-2">Detected</p>
                              <ul className="space-y-1">
                                {selectedMeeting.actionItems.map((item, i) => (
                                  <li key={i} className="text-sm text-clawd-text">• {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedMeeting.tasksCreated.length > 0 && (
                            <div>
                              <p className="text-xs text-clawd-text-dim mb-2">Tasks Created</p>
                              <ul className="space-y-1">
                                {selectedMeeting.tasksCreated.map((task, i) => (
                                  <li key={i} className="text-sm text-green-400 flex items-center gap-2">
                                    <Check size={12} />
                                    {task}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AI Chat */}
                    <div className="bg-clawd-surface border border-clawd-border rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-clawd-border">
                        <h3 className="font-medium text-clawd-text flex items-center gap-2">
                          <Brain size={16} />
                          Ask about this meeting
                        </h3>
                      </div>
                      <div className="p-4">
                        {meetingChatMessages.length > 0 && (
                          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                            {meetingChatMessages.map((msg, i) => (
                              <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <span className={`inline-block rounded-lg px-3 py-2 max-w-[90%] ${
                                  msg.role === 'user' 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-clawd-bg border border-clawd-border'
                                }`}>
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
                            onKeyDown={(e) => { 
                              if (e.key === 'Enter' && !e.shiftKey && meetingChatInput.trim()) 
                                askAboutMeeting(selectedMeeting, meetingChatInput); 
                            }}
                            placeholder="What were the main topics discussed?"
                            className="flex-1 px-4 py-2.5 bg-clawd-bg border border-clawd-border rounded-xl text-sm focus:outline-none focus:border-green-500"
                            disabled={meetingChatProcessing}
                          />
                          <button
                            onClick={() => askAboutMeeting(selectedMeeting, meetingChatInput)}
                            disabled={!meetingChatInput.trim() || meetingChatProcessing}
                            className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl disabled:opacity-50 transition-all"
                          >
                            {meetingChatProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Past Meetings List */}
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-clawd-text">Past Meetings</h2>
                      <button 
                        onClick={loadPastMeetings} 
                        disabled={loadingPastMeetings}
                        className="text-sm text-clawd-text-dim hover:text-clawd-accent flex items-center gap-1"
                      >
                        <Loader2 size={14} className={loadingPastMeetings ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>

                    {loadingPastMeetings ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-clawd-text-dim" />
                      </div>
                    ) : pastMeetings.length === 0 ? (
                      <div className="text-center py-12 bg-clawd-surface border border-clawd-border rounded-2xl">
                        <Calendar size={48} className="mx-auto mb-4 text-clawd-text-dim opacity-30" />
                        <p className="text-clawd-text-dim">No past meetings found</p>
                        <p className="text-sm text-clawd-text-dim/60 mt-1">Meetings are saved to ~/froggo/meetings/</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pastMeetings.map((meeting, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedMeeting(meeting)}
                            className="w-full text-left bg-clawd-surface border border-clawd-border rounded-xl p-4 hover:border-clawd-accent transition-all group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-clawd-text group-hover:text-green-500 transition-all">
                                  {meeting.title || meeting.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-clawd-text-dim">
                                  <span>{meeting.time}</span>
                                  {meeting.duration && meeting.duration > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-clawd-bg rounded-full">
                                      {formatDuration(meeting.duration)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-clawd-text-dim group-hover:text-green-500 transition-all" />
                            </div>
                            {meeting.transcript.length > 0 && (
                              <p className="text-sm text-clawd-text-dim line-clamp-2 mt-2">
                                {meeting.transcript[0]}
                              </p>
                            )}
                            {(meeting.actionItems.length > 0 || meeting.tasksCreated.length > 0) && (
                              <div className="flex gap-2 mt-3">
                                {meeting.actionItems.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                                    {meeting.actionItems.length} action items
                                  </span>
                                )}
                                {meeting.tasksCreated.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                                    {meeting.tasksCreated.length} tasks
                                  </span>
                                )}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
