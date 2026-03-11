/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: MeetingsPanel uses file-level suppression for intentional stable callback patterns.
// The suppressions are legitimate because:
// - All callbacks are wrapped in useCallback with proper deps
// - Mount-only effects for gateway subscription and cleanup are intentional
// - Complex meeting lifecycle effects are carefully designed
// - Post-processing effects depend on stable useCallback hooks
// Review: 2026-02-17 - suppression retained, all patterns intentional

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Phone, PhoneOff, Loader2, 
  MessageSquare, Brain, ListTodo, Clock, FileText,
  Download, ChevronRight, Calendar, Send, X,
  Check, Edit3, Trash2, Plus, CheckCircle2, XCircle,
  Upload
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { gateway, ConnectionState } from '../lib/gateway';
import { useStore } from '../store/store';
import { createLogger } from '../utils/logger';
import { copyToClipboard } from '../utils/clipboard';
import { Spinner } from './LoadingStates';
import ErrorDisplay from './ErrorDisplay';
import EmptyState from './EmptyState';

const logger = createLogger('Meetings');

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
  try {
    const { settingsApi } = await import('../lib/api');
    const result = await settingsApi.get('gemini_api_key');
    if (result?.value) { _cachedGeminiKey = result.value; return result.value; }
  } catch { /* ignore */ }
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

/** Database transcript row structure */
interface TranscriptRow {
  cleaned_text?: string;
  text: string;
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
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [meetingStartTime, setMeetingStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [meetingParticipants, setMeetingParticipants] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [meetingDbId, setMeetingDbId] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Transcript & action items
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const [_meetingTranscriptLines, setMeetingTranscriptLines] = useState<TranscriptLine[]>([]);
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
  const [activeView, setActiveView] = useState<'current' | 'history' | 'transcribe' | 'upload-transcript'>('current');
  const [pastMeetings, setPastMeetings] = useState<PastMeeting[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionFileName, setTranscriptionFileName] = useState('');
  const [transcriptionSaving, setTranscriptionSaving] = useState(false);
  const [transcriptionSaved, setTranscriptionSaved] = useState(false);
  const [loadingPastMeetings, setLoadingPastMeetings] = useState(false);
  const [pastMeetingsError, setPastMeetingsError] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<PastMeeting | null>(null);

  // AI Chat
  const [meetingChatInput, setMeetingChatInput] = useState('');
  const [meetingChatMessages, setMeetingChatMessages] = useState<Message[]>([]);
  const [meetingChatProcessing, setMeetingChatProcessing] = useState(false);

  // Upcoming Calendar Events
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    account?: string;
  }>>([]);
  const [loadingUpcomingEvents, setLoadingUpcomingEvents] = useState(false);

  // Fetch upcoming calendar events — not available in web mode
  const loadUpcomingEvents = useCallback(async () => {
    // Calendar API not available in web mode
    setLoadingUpcomingEvents(false);
  }, []);

  // Enumerate audio input devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => setAudioDevices(devices.filter(d => d.kind === 'audioinput')))
      .catch(() => {});
  }, []);

  // Refs
  const listeningRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const endMeetingInProgressRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
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
  useEffect(() => { loadUpcomingEvents(); }, [loadUpcomingEvents]);

  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
      if (audioContextRef.current) { audioContextRef.current.close().catch((err) => { logger.error('Failed to close audio context:', err); }); }
    };
  }, []);

  useEffect(() => {
    if (!meetingStartTime) { setElapsedTime(0); return; }
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - meetingStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStartTime]);

  // DB Helpers — not available in web mode, return no-ops
  const dbExec = useCallback(async (_sql: string, _params: (string | number | boolean | null)[] = []) => {
    // DB not available in web mode
  }, []);

  const dbQuery = useCallback(async <T extends Record<string, unknown>>(_sql: string, _params: (string | number | boolean | null)[] = []): Promise<T[]> => {
    // DB not available in web mode
    return [];
  }, []);

  const ensureMeetingTables = useCallback(async () => {
    await dbExec(`CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, started_at INTEGER NOT NULL,
      ended_at INTEGER, duration INTEGER, participants TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active', summary TEXT, file_path TEXT,
      agenda TEXT DEFAULT '', notes TEXT DEFAULT ''
    )`);
    // Add columns to existing tables that lack them
    await dbExec(`ALTER TABLE meetings ADD COLUMN agenda TEXT DEFAULT ''`).catch(() => {});
    await dbExec(`ALTER TABLE meetings ADD COLUMN notes TEXT DEFAULT ''`).catch(() => {});
    await dbExec(`CREATE TABLE IF NOT EXISTS meeting_transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_id TEXT NOT NULL,
      speaker TEXT NOT NULL, text TEXT NOT NULL, cleaned_text TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )`);
  }, [dbExec]);

  const saveMeetingToDb = useCallback(async (
    title: string,
    opts?: { agenda?: string; participants?: string; notes?: string }
  ): Promise<string> => {
    await ensureMeetingTables();
    const id = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const participantsJson = opts?.participants
      ? JSON.stringify(opts.participants.split(',').map(p => p.trim()).filter(Boolean))
      : '[]';
    await dbExec(
      `INSERT INTO meetings (id, title, started_at, status, agenda, participants, notes) VALUES (?, ?, ?, 'active', ?, ?, ?)`,
      [id, title, Date.now(), opts?.agenda || '', participantsJson, opts?.notes || '']
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
    const rows = await dbQuery<Record<string, unknown> & { id: string; title?: string; file_path?: string; started_at: number; duration?: number; summary?: string }>(`SELECT * FROM meetings WHERE status = 'ended' ORDER BY started_at DESC LIMIT 50`);
    const meetings: PastMeeting[] = [];
    for (const row of rows) {
      const transcripts = await dbQuery<TranscriptRow & Record<string, unknown>>(
        `SELECT text, cleaned_text FROM meeting_transcripts WHERE meeting_id = ? ORDER BY timestamp ASC`,
        [row.id as string]
      );
      meetings.push({
        id: row.id,
        filename: row.title || 'Untitled',
        filepath: row.file_path || '',
        date: new Date(row.started_at),
        time: new Date(row.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        title: row.title,
        duration: row.duration,
        transcript: transcripts.map((t: TranscriptRow) => t.cleaned_text || t.text),
        actionItems: [],
        tasksCreated: [],
        rawContent: row.summary || transcripts.map((t: TranscriptRow) => t.cleaned_text || t.text).join('\n'),
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
      // '[Meeting] Summary generation error:', err;
    } finally {
      setGeneratingSummary(false);
    }
    return null;
  }, []);

  // Proposed tasks from agent review
  const [proposedTasks, setProposedTasks] = useState<Array<{
    id: string;
    title: string;
    description: string;
    plan: string;
    proposedAgent: string;
    status: 'pending' | 'approved' | 'rejected';
  }>>([]);

  // Trigger Mission Control agent to review transcript and create task proposals
  const triggerAgentReview = useCallback(async (transcript: string[]): Promise<void> => {
    if (transcript.length === 0 || !connected) return;
    
    setStatusMessage('Agent reviewing transcript...');
    
    const fullText = transcript.join('\n');
    const prompt = `Review this meeting transcript and create task proposals.

Transcript:
${fullText}

Based on the transcript, create 1-5 task proposals in this JSON format (only respond with valid JSON array):
[
  {
    "title": "Task title",
    "description": "What needs to be done",
    "plan": "How to accomplish it",
    "proposedAgent": "coder" | "writer" | "researcher" | "designer" | "chief" | "hr"
  }
]

Only include tasks that are clearly mentioned or implied. Assign appropriate agents based on task type.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${await getGeminiApiKey()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.2 }
          })
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        if (content) {
          // Extract JSON from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const tasks = JSON.parse(jsonMatch[0]);
            const formatted = tasks.map((t: any, idx: number) => ({
              id: `proposed-${Date.now()}-${idx}`,
              title: t.title || 'Untitled Task',
              description: t.description || '',
              plan: t.plan || '',
              proposedAgent: t.proposedAgent || 'coder',
              status: 'pending' as const
            }));
            setProposedTasks(formatted);
            setStatusMessage('Agent review complete');
          }
        }
      }
    } catch (err) {
      logger.error('Agent review error:', err);
      setStatusMessage('Agent review failed');
    }
  }, [connected]);

  // Approve a proposed task and create it
  const approveProposedTask = useCallback(async (taskId: string) => {
    const task = proposedTasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const { taskApi } = await import('../lib/api');
      await taskApi.create({
        title: task.title,
        description: `${task.description}\n\n**Plan:** ${task.plan}\n\n*Proposed agent: ${task.proposedAgent}*`,
        status: 'todo',
        project: 'Meetings'
      });

      setProposedTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'approved' } : t
      ));
      addActivity({ type: 'task', message: `Created task: ${task.title}`, timestamp: Date.now() });
    } catch (err) {
      logger.error('Failed to create task:', err);
    }
  }, [proposedTasks, addActivity]);

  // Reject a proposed task
  const rejectProposedTask = useCallback((taskId: string) => {
    setProposedTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'rejected' } : t
    ));
  }, []);

  // Edit and re-propose a task
  const [editingProposedTask, setEditingProposedTask] = useState<string | null>(null);
  const [editingProposedText, setEditingProposedText] = useState('');

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

  const loadPastMeetings = useCallback(async () => {
    // File system access not available in web mode — load from DB only
    setLoadingPastMeetings(true);
    try {
      const dbMeetings = await loadDbMeetings();
      setPastMeetings(dbMeetings);
    } catch (err) {
      logger.error('Error loading past meetings:', err);
      setPastMeetingsError(err instanceof Error ? err.message : 'Failed to load past meetings');
    } finally {
      setLoadingPastMeetings(false);
    }
  }, [loadDbMeetings]);

  const saveMeetingToFile = useCallback(async (transcript: string[], actionItems: ActionItem[]): Promise<string | null> => {
    // File system not available in web mode — offer download instead
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const filename = `${dateStr}-${timeStr}.md`;
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
    lines.push(`---`, `*Generated by Mission Control Voice Assistant*`);
    const content = lines.join('\n');
    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return filename;
    } catch {
      // Save error — non-critical
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

  // Gemini File API Transcription for audio files — uses browser Gemini API in web mode
  const transcribeAudioFile = useCallback(async (_audioFilePath: string): Promise<string> => {
    // Shell-based transcription not available in web mode
    throw new Error('File-based transcription not available in web mode. Use the browser recording feature instead.');
  }, []);

  // Handle audio file transcription request
  const handleTranscribeFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTranscribing(true);
    setTranscriptionResult('');
    setTranscriptionProgress(0);
    setTranscriptionSaved(false);
    setTranscriptionFileName(file.name.replace(/\.[^/.]+$/, ''));
    setStatusMessage('Transcribing audio file...');

    // Simulate progress during transcription
    const progressInterval = setInterval(() => {
      setTranscriptionProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8 + 2;
      });
    }, 500);

    try {
      // Copy file to a accessible location first
      const tempPath = `/tmp/${file.name}`;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Transcribe using Gemini API directly in browser
      // Use Gemini API directly with the base64 data
      const apiKey = await getGeminiApiKey();
      if (!apiKey) throw new Error('Gemini API key not configured');
      const mimeType = file.type || 'audio/webm';
      const transcribeResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: 'Transcribe this audio accurately. Output ONLY the transcript text. If no speech detected, return empty string.' }
              ]
            }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.1 }
          })
        }
      );
      if (!transcribeResponse.ok) throw new Error(`Gemini API error: ${transcribeResponse.status}`);
      const transcribeData = await transcribeResponse.json();
      const result = transcribeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      setTranscriptionProgress(100);
      setTranscriptionResult(result);
      setStatusMessage('Transcription complete!');
    } catch (err) {
      setStatusMessage(`Transcription failed: ${err}`);
      setTranscriptionProgress(0);
    } finally {
      clearInterval(progressInterval);
      setTranscribing(false);
    }
  }, [transcribeAudioFile]);

  // Handle transcript file upload (.txt, .pdf, .docx)
  const handleTranscriptUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setTranscribing(true);
    setTranscriptionResult('');
    setTranscriptionProgress(0);
    setTranscriptionSaved(false);
    setTranscriptionFileName(file.name.replace(/\.[^/.]+$/, ''));
    setStatusMessage('Extracting text from transcript...');

    const progressInterval = setInterval(() => {
      setTranscriptionProgress(prev => prev >= 90 ? prev : prev + Math.random() * 10 + 5);
    }, 400);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let text = '';

      if (ext === 'txt') {
        text = await file.text();
        setTranscriptionProgress(100);
      } else if (ext === 'pdf' || ext === 'docx' || ext === 'doc') {
        // Use Gemini to extract text from PDF/DOCX
        const apiKey = await getGeminiApiKey();
        if (!apiKey) throw new Error('Gemini API key not configured — needed for PDF/DOCX extraction');

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const mimeType = ext === 'pdf' ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType, data: base64Data } },
                  { text: 'Extract all text content from this document. Return only the raw text, preserving paragraphs and line breaks. Do not add commentary.' }
                ]
              }]
            })
          }
        );

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Gemini API error: ${response.status} ${err}`);
        }

        const result = await response.json();
        text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) throw new Error('Gemini returned empty text extraction');
        setTranscriptionProgress(100);
      } else {
        throw new Error(`Unsupported file type: .${ext}`);
      }

      setTranscriptionResult(text.trim());
      setStatusMessage('Text extracted successfully!');
    } catch (err) {
      setStatusMessage(`Text extraction failed: ${err}`);
      setTranscriptionProgress(0);
    } finally {
      clearInterval(progressInterval);
      setTranscribing(false);
    }
  }, []);

  // Save transcription as a past meeting, then send to Mission Control for task card generation
  const saveTranscriptionAsMeeting = useCallback(async () => {
    if (!transcriptionResult || transcriptionSaving) return;
    setTranscriptionSaving(true);
    setProposedTasks([]);
    const title = transcriptionFileName.trim() || `Transcription ${new Date().toLocaleDateString()}`;
    try {
      const dbId = await saveMeetingToDb(title);
      const lines = transcriptionResult.split('\n').filter(l => l.trim());
      for (const line of lines) {
        await saveTranscriptToDb(dbId, line);
      }
      // Generate summary
      const summary = await generateSummary(lines);
      await endMeetingInDb(dbId, 0, summary || undefined);
      if (summary) setAiSummary(summary);
      setTranscriptionSaved(true);
      addActivity({ type: 'system', message: `Transcription saved: ${title}`, timestamp: Date.now() });
      loadPastMeetings();

      // Send to Mission Control via gateway for task card processing
      setStatusMessage('Mission Control reviewing transcript for tasks...');
      if (connected) {
        try {
          const truncated = transcriptionResult.length > 6000
            ? transcriptionResult.slice(0, 6000) + '\n[truncated]'
            : transcriptionResult;
          const reviewPrompt = [
            `Review this meeting transcription titled "${title}" and extract actionable tasks.`,
            `Return ONLY a JSON array (no markdown, no explanation) of task objects:`,
            `[{"title":"...","description":"...","plan":"...","proposedAgent":"coder|writer|researcher|designer|chief|hr|social-manager|growth-director"}]`,
            `Only include clearly actionable items. Assign the right agent for each task type.`,
            `\nTranscript:\n${truncated}`,
          ].join('\n');
          const result = await gateway.sendChat(reviewPrompt);
          if (result?.content && result.content !== 'NO_REPLY') {
            const jsonMatch = result.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const tasks = JSON.parse(jsonMatch[0]);
              const formatted = tasks.map((t: any, idx: number) => ({
                id: `proposed-${Date.now()}-${idx}`,
                title: t.title || 'Untitled Task',
                description: t.description || '',
                plan: t.plan || '',
                proposedAgent: t.proposedAgent || 'coder',
                status: 'pending' as const,
              }));
              setProposedTasks(formatted);
              setStatusMessage(`Mission Control found ${formatted.length} task${formatted.length !== 1 ? 's' : ''}`);
            } else {
              setStatusMessage('Saved! No tasks extracted.');
            }
          } else {
            setStatusMessage('Saved to Past Meetings!');
          }
        } catch (err) {
          logger.error('Mission Control review error:', err);
          setStatusMessage('Saved! (Mission Control review failed)');
        }
      } else {
        setStatusMessage('Saved to Past Meetings!');
      }
    } catch (err) {
      setStatusMessage(`Failed to save: ${err}`);
    } finally {
      setTranscriptionSaving(false);
    }
  }, [transcriptionResult, transcriptionFileName, transcriptionSaving, connected, saveMeetingToDb, saveTranscriptToDb, generateSummary, endMeetingInDb, addActivity, loadPastMeetings]);

  const approveAllPending = useCallback(() => {
    setMeetingActionItems(prev => prev.map(item => 
      item.status === 'pending' ? { ...item, status: 'approved' as const } : item
    ));
  }, []);

  const createTasksFromApproved = useCallback(async (): Promise<number> => {
    const { taskApi } = await import('../lib/api');
    const approved = meetingActionItems.filter(i => i.status === 'approved');
    let created = 0;
    for (const item of approved) {
      let title = (item.editedText || item.text).charAt(0).toUpperCase() + (item.editedText || item.text).slice(1);
      title = title.replace(/[,;:]$/, '').trim();
      try {
        await taskApi.create({
          title, status: 'todo', project: 'Meetings',
          description: `From meeting on ${new Date().toLocaleDateString()}`,
        });
        created++;
      } catch { /* ignore */ }
    }
    return created;
  }, [meetingActionItems]);

  // --- LEGACY: kept for file-upload transcription path only ---
  const connectGeminiTranscription = useCallback(async (_stream: MediaStream) => {
    const apiKey = await getGeminiApiKey();
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Gemini API key not configured. Add it in Settings \u2192 API Keys.');
    }
    return new Promise<WebSocket>((resolve, reject) => {
      const url = `${GEMINI_WS_URL}?key=${apiKey}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
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
                  saveTranscriptToDb(meetingDbIdRef.current, finalText).catch((err) => { logger.error('Failed to save transcript:', err); });
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
          // '[Gemini] Message parse error:', err;
        }
      };

      ws.onerror = (err) => {
        logger.error('Gemini WebSocket error:', err);
        reject(new Error('Gemini WebSocket connection failed'));
      };

      ws.onclose = () => {
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
      } catch { /* ignore */ }
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
            contents: [{ parts: [{ text: `Fix transcription errors. Common words: "perps" (perpetual futures), "Mission Control", "Bitso", "Kanban", "onchain", "Solana".\n\nDO NOT add explanation or context. Output ONLY the corrected text:\n\n${text}` }] }],
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
      // '[Gemini] Cleanup error:', err;
    }
  }, []);

  // Web Speech API Transcription — defined after cleanupWithGemini to avoid TDZ
  const startSpeechRecognition = useCallback((meetingDbId: string | null) => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) throw new Error('Speech recognition not supported in this browser. Use Chrome or Edge.');

    const recognition: any = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;
        setMeetingTranscript(prev => [...prev, text]);
        setMeetingTranscriptLines(prev => [...prev, { text, timestamp: Date.now() }]);
        if (meetingDbId) saveTranscriptToDb(meetingDbId, text).catch(() => {});
        const actions = detectActionItems(text);
        if (actions.length > 0) setMeetingActionItems(prev => [...prev, ...actions]);
        cleanupWithGemini(text);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      logger.error('[SpeechRecognition] error:', event.error);
    };

    recognition.onend = () => {
      if (listeningRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* already running */ }
      }
    };

    recognition.start();
  }, [detectActionItems, cleanupWithGemini, saveTranscriptToDb]);

  const startMeeting = useCallback(async () => {
    if (listeningRef.current) return;
    setStartError(null);
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
    let dbId: string | null = null;
    try {
      dbId = await saveMeetingToDb(title, {
        agenda: meetingAgenda,
        participants: meetingParticipants,
        notes: meetingNotes,
      });
      setMeetingDbId(dbId);
    } catch (_err) {
      // DB save failure is non-blocking — meeting continues
    }
    try {
      // Acquire mic with selected device — keeps stream for audio level metering
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;
      // Wire audio level analyser
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const pollLevel = () => {
        if (!listeningRef.current || !analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        setAudioLevel(data.reduce((a, b) => a + b) / data.length / 255);
        requestAnimationFrame(pollLevel);
      };
      pollLevel();

      listeningRef.current = true;
      setListening(true);
      startSpeechRecognition(dbId);
      setMeetingActive(true);
      setShowTitleInput(false);
      setMeetingAgenda('');
      setMeetingParticipants('');
      setMeetingNotes('');
      setStatusMessage('Recording...');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStartError(`Failed to start recording: ${msg}`);
      setStatusMessage('');
      setMeetingStartTime(null);
      listeningRef.current = false;
      setListening(false);
    }
  }, [setMeetingActive, startSpeechRecognition, selectedDeviceId, meetingTitle, meetingAgenda, meetingParticipants, meetingNotes, saveMeetingToDb]);

  const endMeeting = useCallback(async () => {
    if (endMeetingInProgressRef.current) return;
    endMeetingInProgressRef.current = true;
    try {
      if (transcriptBufferRef.current.trim()) {
        const finalText = transcriptBufferRef.current.trim();
        transcriptBufferRef.current = '';
        setMeetingTranscript(prev => [...prev, finalText]);
      }
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // prevent auto-restart
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
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
        try { await endMeetingInDb(meetingDbId, duration); } catch { /* ignore */ }
      }
    } catch (err) {
      // '[Meeting] Error ending:', err;
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
        } catch { /* ignore */ }
        const summary = await generateSummary(meetingTranscript);
        if (summary) setAiSummary(summary);
        if (meetingDbId) {
          try { await endMeetingInDb(meetingDbId, elapsedTime, summary || undefined, savedPath || undefined); } catch { /* ignore */ }
        }
        setMeetingEndSummary({ savedPath, tasksCreated: 0, extractedTasks: [] });
        
        // Trigger agent review for task proposals
        if (meetingTranscript.length > 0 && connected) {
          await triggerAgentReview(meetingTranscript);
        }
        
        setStatusMessage('Meeting ended');
        addActivity({ type: 'system', message: '📋 Meeting ended', timestamp: Date.now() });
        loadPastMeetings();
      })();
    }
    prevMeetingActive.current = isMeetingActive;
  }, [isMeetingActive, meetingTranscript, meetingActionItems, saveMeetingToFile, generateSummary, triggerAgentReview, connected, addActivity, loadPastMeetings, meetingDbId, elapsedTime, endMeetingInDb]);

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
    try { await gateway.sendChat(summary); } catch { /* ignore */ }
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
    } catch (e) {
      setMeetingChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : String(e)}`, timestamp: Date.now() }]);
    } finally {
      setMeetingChatProcessing(false);
      setMeetingChatInput('');
    }
  }, [connected]);

  const pendingItems = meetingActionItems.filter(i => i.status === 'pending');
  const approvedItems = meetingActionItems.filter(i => i.status === 'approved');

  // ── RENDER ──
  return (
    <div className="h-full flex flex-col bg-mission-control-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-mission-control-border bg-mission-control-surface">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-success-subtle flex items-center justify-center">
                <Phone size={20} className="text-success" />
              </div>
              <div>
                <h1 className="text-heading-2">Meetings</h1>
                <p className="text-secondary">
                  {isMeetingActive ? 'Recording in progress' : 'Transcribe and review meetings'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {statusMessage && (
                <span className="text-sm text-mission-control-text-dim bg-mission-control-bg px-3 py-1 rounded-full">
                  {statusMessage}
                </span>
              )}
              <button
                onClick={toggleMuted}
                className={`p-2.5 rounded-lg transition-all ${isMuted 
                  ? 'bg-error-subtle text-error hover:bg-error-subtle' 
                  : 'bg-mission-control-border text-mission-control-text-dim hover:bg-mission-control-border/80'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="shrink-0 border-b border-mission-control-border bg-mission-control-surface/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => { setActiveView('current'); setSelectedMeeting(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeView === 'current' 
                  ? 'border-green-500 text-success' 
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              Current Meeting
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeView === 'history' 
                  ? 'border-green-500 text-success' 
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              Past Meetings
            </button>
            <button
              onClick={() => setActiveView('transcribe')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeView === 'transcribe' 
                  ? 'border-green-500 text-success' 
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              Upload Audio
            </button>
            <button
              onClick={() => setActiveView('upload-transcript')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeView === 'upload-transcript'
                  ? 'border-green-500 text-success'
                  : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              Upload Transcript
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
                <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                  <div className="p-6">
                    {isMeetingActive ? (
                      <div className="space-y-4">
                        {/* Header row */}
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-error-subtle flex items-center justify-center">
                            <Mic size={18} className="text-error" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-mission-control-text truncate">{meetingTitle || 'Untitled Meeting'}</p>
                            <p className="text-xs text-mission-control-text-dim">
                              {formatDuration(elapsedTime)} · {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label?.split('(')[0].trim() || 'Default mic'}
                            </p>
                          </div>
                          <button
                            onClick={endMeeting}
                            className="flex-shrink-0 px-4 py-2 bg-error hover:bg-error/80 text-white rounded-xl font-medium flex items-center gap-2 text-sm transition-colors"
                          >
                            <PhoneOff size={15} /> End
                          </button>
                        </div>

                        {/* Audio waveform */}
                        <div className="flex items-end gap-0.5 h-8 px-1">
                          {Array.from({ length: 32 }).map((_, i) => {
                            const active = i / 32 < audioLevel * 1.4;
                            const height = active ? `${30 + Math.sin(i * 0.9 + Date.now() / 200) * 50}%` : '15%';
                            return (
                              <div key={i} className={`flex-1 rounded-full transition-all duration-75 ${active ? 'bg-success' : 'bg-mission-control-border'}`}
                                style={{ height }} />
                            );
                          })}
                        </div>

                        {/* Live transcript feed */}
                        <div className="bg-mission-control-bg rounded-xl p-4 min-h-[80px]">
                          {meetingTranscript.length > 0 ? (
                            <div className="space-y-1.5">
                              {meetingTranscript.slice(-4).map((line, i, arr) => (
                                <p key={i} className={`text-sm leading-relaxed transition-opacity ${i === arr.length - 1 ? 'text-mission-control-text' : 'text-mission-control-text-dim opacity-60'}`}>
                                  {line}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 text-mission-control-text-dim h-full">
                              <span className="flex gap-1 items-center">
                                {[0, 1, 2].map(i => (
                                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-success animate-bounce"
                                    style={{ animationDelay: `${i * 0.2}s` }} />
                                ))}
                              </span>
                              <span className="text-sm">Listening…</span>
                            </div>
                          )}
                        </div>

                        {meetingTranscript.length > 0 && (
                          <p className="text-xs text-mission-control-text-dim text-right">
                            {meetingTranscript.length} segment{meetingTranscript.length !== 1 ? 's' : ''} · {meetingActionItems.length} action item{meetingActionItems.length !== 1 ? 's' : ''} detected
                          </p>
                        )}
                      </div>
                    ) : showTitleInput ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Title</label>
                          <input
                            type="text"
                            value={meetingTitle}
                            onChange={(e) => { setMeetingTitle(e.target.value); setStartError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setShowTitleInput(false); setStartError(null); } }}
                            placeholder="Meeting title (optional)"
                            className="w-full px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-success-border focus:ring-1 focus:ring-success/20"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Agenda</label>
                          <textarea
                            value={meetingAgenda}
                            onChange={(e) => setMeetingAgenda(e.target.value)}
                            placeholder="Topics to discuss..."
                            rows={2}
                            className="w-full px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-success-border focus:ring-1 focus:ring-success/20 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Participants</label>
                          <input
                            type="text"
                            value={meetingParticipants}
                            onChange={(e) => setMeetingParticipants(e.target.value)}
                            placeholder="Names, comma-separated"
                            className="w-full px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-success-border focus:ring-1 focus:ring-success/20"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Notes</label>
                          <textarea
                            value={meetingNotes}
                            onChange={(e) => setMeetingNotes(e.target.value)}
                            placeholder="Pre-meeting notes..."
                            rows={2}
                            className="w-full px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-success-border focus:ring-1 focus:ring-success/20 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Microphone</label>
                          <select
                            value={selectedDeviceId}
                            onChange={e => setSelectedDeviceId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-mission-control-text focus:outline-none focus:border-success-border focus:ring-1 focus:ring-success/20 text-sm"
                          >
                            <option value="">System Default</option>
                            {audioDevices.map(d => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        {startError && (
                          <div className="flex items-start gap-3 p-4 bg-error-subtle border border-error-border rounded-xl">
                            <XCircle size={18} className="text-error shrink-0 mt-0.5" />
                            <p className="text-sm text-error">{startError}</p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={startMeeting}
                            className="flex-1 py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-3 transition-all shadow-lg shadow-green-500/20"
                          >
                            <Mic size={24} />
                            Start Recording
                          </button>
                          <button
                            onClick={() => { setShowTitleInput(false); setStartError(null); }}
                            className="px-5 py-3.5 bg-mission-control-bg border border-mission-control-border rounded-xl hover:bg-mission-control-border transition-all"
                          >
                            <X size={20} className="text-mission-control-text-dim" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-success-subtle flex items-center justify-center">
                          <Phone size={36} className="text-success" />
                        </div>
                        <h2 className="text-heading-3 mb-2">Start a Meeting</h2>
                        <p className="text-mission-control-text-dim mb-6 max-w-md mx-auto">
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

                {/* Upcoming Calendar Events */}
                {upcomingEvents.length > 0 && !isMeetingActive && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-mission-control-accent" />
                        <h3 className="font-medium text-mission-control-text">Upcoming Meetings</h3>
                      </div>
                      <button 
                        onClick={loadUpcomingEvents}
                        disabled={loadingUpcomingEvents}
                        className="text-xs text-mission-control-text-dim hover:text-mission-control-accent"
                      >
                        <Loader2 size={12} className={loadingUpcomingEvents ? 'animate-spin inline' : 'hidden'} />
                        Refresh
                      </button>
                    </div>
                    <div className="divide-y divide-mission-control-border">
                      {upcomingEvents.slice(0, 5).map((event) => {
                        const startDate = new Date(event.start?.dateTime || event.start?.date || '');
                        const endDate = new Date(event.end?.dateTime || event.end?.date || '');
                        const isToday = startDate.toDateString() === new Date().toDateString();
                        return (
                          <div key={event.id} className="p-4 hover:bg-mission-control-bg/50 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-lg bg-mission-control-bg flex flex-col items-center justify-center shrink-0">
                                <span className="text-xs font-medium text-mission-control-accent">
                                  {isToday ? 'Today' : startDate.toLocaleDateString('en-US', { weekday: 'short' })}
                                </span>
                                <span className="text-lg font-semibold text-mission-control-text">
                                  {startDate.getDate()}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-mission-control-text truncate">{event.summary || 'Untitled'}</p>
                                <p className="text-sm text-mission-control-text-dim">
                                  {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  {endDate.getTime() !== startDate.getTime() && (
                                    <> - {endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</>
                                  )}
                                  {event.account && <span className="ml-2 text-xs">({event.account})</span>}
                                </p>
                                {event.location && (
                                  <p className="text-xs text-mission-control-text-dim mt-1 truncate">{event.location}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Post-Meeting Summary */}
                {meetingEndSummary && !isMeetingActive && (
                  <>
                    {/* AI Summary */}
                    {(generatingSummary || aiSummary) && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-mission-control-border flex items-center gap-2">
                          <Brain size={18} className="text-review" />
                          <h3 className="font-medium text-mission-control-text">AI Summary</h3>
                          {generatingSummary && <Loader2 size={14} className="animate-spin text-mission-control-text-dim" />}
                        </div>
                        <div className="p-6">
                          {generatingSummary ? (
                            <div className="flex items-center gap-3 text-mission-control-text-dim">
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
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ListTodo size={18} className="text-warning" />
                            <h3 className="font-medium text-mission-control-text">Action Items</h3>
                            <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                              {pendingItems.length} pending • {approvedItems.length} approved
                            </span>
                          </div>
                          {pendingItems.length > 0 && (
                            <button
                              onClick={approveAllPending}
                              className="text-sm text-success hover:text-success flex items-center gap-1"
                            >
                              <CheckCircle2 size={14} />
                              Approve All
                            </button>
                          )}
                        </div>
                        <div className="divide-y divide-mission-control-border">
                          {meetingActionItems.map((item) => (
                            <div 
                              key={item.id} 
                              className={`p-4 transition-all ${
                                item.status === 'dismissed' ? 'opacity-40' : ''
                              } ${item.status === 'approved' ? 'bg-success-subtle' : ''}`}
                            >
                              {editingItemId === item.id ? (
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="w-full px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-success-border"
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
                                      className="px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm hover:bg-mission-control-border text-mission-control-text-dim"
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
                                        item.type === 'task' ? 'bg-info-subtle text-info' :
                                        item.type === 'schedule' ? 'bg-review-subtle text-review' :
                                        item.type === 'message' ? 'bg-warning-subtle text-warning' :
                                        'bg-mission-control-border text-mission-control-text-dim'
                                      }`}>
                                        {item.type}
                                      </span>
                                      {item.status === 'approved' && (
                                        <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded-full flex items-center gap-1">
                                          <Check size={10} />
                                          Approved
                                        </span>
                                      )}
                                      {item.status === 'dismissed' && (
                                        <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded-full">
                                          Dismissed
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-sm ${item.status === 'dismissed' ? 'line-through text-mission-control-text-dim' : 'text-mission-control-text'}`}>
                                      {item.editedText || item.text}
                                    </p>
                                  </div>
                                  {item.status === 'pending' && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => approveActionItem(item.id)}
                                        className="p-2 hover:bg-success-subtle rounded-lg text-success transition-all"
                                        title="Approve"
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button
                                        onClick={() => startEditingItem(item)}
                                        className="p-2 hover:bg-mission-control-bg rounded-lg text-mission-control-text-dim transition-all"
                                        title="Edit"
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                      <button
                                        onClick={() => dismissActionItem(item.id)}
                                        className="p-2 hover:bg-error-subtle rounded-lg text-error transition-all"
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
                          <div className="p-4 border-t border-mission-control-border bg-mission-control-bg/50 flex items-center justify-between">
                            <p className="text-sm text-mission-control-text-dim">
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

                    {/* Agent-Proposed Tasks */}
                    {proposedTasks.length > 0 && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-mission-control-border flex items-center gap-2">
                          <Brain size={18} className="text-review" />
                          <h3 className="font-medium text-mission-control-text">Agent-Proposed Tasks</h3>
                          <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                            {proposedTasks.filter(t => t.status === 'pending').length} pending • {proposedTasks.filter(t => t.status === 'approved').length} approved
                          </span>
                        </div>
                        <div className="divide-y divide-mission-control-border">
                          {proposedTasks.map((task) => (
                            <div 
                              key={task.id} 
                              className={`p-4 transition-all ${
                                task.status === 'rejected' ? 'opacity-40' : ''
                              } ${task.status === 'approved' ? 'bg-success-subtle' : ''}`}
                            >
                              {editingProposedTask === task.id ? (
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingProposedText}
                                    onChange={(e) => setEditingProposedText(e.target.value)}
                                    className="w-full px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm text-mission-control-text"
                                    placeholder="Edit task title..."
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setProposedTasks(prev => prev.map(t => 
                                          t.id === task.id ? { ...t, title: editingProposedText, status: 'approved' as const } : t
                                        ));
                                        setEditingProposedTask(null);
                                      }}
                                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingProposedTask(null)}
                                      className="px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm text-mission-control-text"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-mission-control-text">{task.title}</p>
                                    {task.description && (
                                      <p className="text-sm text-mission-control-text-dim mt-1">{task.description}</p>
                                    )}
                                    {task.plan && (
                                      <p className="text-xs text-mission-control-text-dim mt-2 italic">Plan: {task.plan}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs px-2 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full">
                                        {task.proposedAgent}
                                      </span>
                                    </div>
                                  </div>
                                  {task.status === 'pending' && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => approveProposedTask(task.id)}
                                        className="p-2 hover:bg-success-subtle rounded-lg text-success transition-all"
                                        title="Approve & Create Task"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingProposedTask(task.id);
                                          setEditingProposedText(task.title);
                                        }}
                                        className="p-2 hover:bg-mission-control-bg rounded-lg text-mission-control-text-dim transition-all"
                                        title="Edit"
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                      <button
                                        onClick={() => rejectProposedTask(task.id)}
                                        className="p-2 hover:bg-error-subtle rounded-lg text-error transition-all"
                                        title="Reject"
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
                      </div>
                    )}

                    {/* Full Transcript (collapsed by default) */}
                    {meetingTranscript.length > 0 && (
                      <details className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <summary className="p-4 cursor-pointer hover:bg-mission-control-bg/50 flex items-center gap-2">
                          <FileText size={18} className="text-mission-control-text-dim" />
                          <span className="font-medium text-mission-control-text">Full Transcript</span>
                          <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                            {meetingTranscript.length} segments
                          </span>
                        </summary>
                        <div className="p-4 border-t border-mission-control-border max-h-96 overflow-y-auto">
                          <div className="space-y-2">
                            {meetingTranscript.map((line, i) => (
                              <p key={`${line.substring(0, 30)}-${i}`} className="text-sm text-mission-control-text bg-mission-control-bg rounded-lg px-3 py-2">
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
                        className="flex-1 px-4 py-3 bg-mission-control-surface border border-mission-control-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:border-success-border transition-all"
                      >
                        <MessageSquare size={18} />
                        Send to Mission Control
                      </button>
                      <button
                        onClick={() => {
                          setMeetingTranscript([]);
                          setMeetingActionItems([]);
                          setMeetingEndSummary(null);
                          setAiSummary(null);
                        }}
                        className="px-4 py-3 bg-mission-control-surface border border-mission-control-border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:border-error-border text-mission-control-text-dim transition-all"
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
                        className="flex items-center gap-2 text-mission-control-text-dim hover:text-mission-control-text transition-all"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                        Back to list
                      </button>
                      <button 
                        onClick={() => exportMeeting(selectedMeeting)}
                        className="flex items-center gap-2 px-4 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm hover:border-mission-control-accent transition-all"
                      >
                        <Download size={16} />
                        Export
                      </button>
                    </div>

                    {/* Meeting Info */}
                    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                      <h2 className="text-heading-3 mb-2">
                        {selectedMeeting.title || selectedMeeting.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h2>
                      <div className="flex items-center gap-4 text-secondary">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {selectedMeeting.date.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {selectedMeeting.time}
                        </span>
                        {selectedMeeting.duration && selectedMeeting.duration > 0 && (
                          <span className="px-2 py-0.5 bg-mission-control-bg rounded-full">
                            {formatDuration(selectedMeeting.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Transcript */}
                    {selectedMeeting.transcript.length > 0 && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-mission-control-border">
                          <h3 className="font-medium text-mission-control-text flex items-center gap-2">
                            <FileText size={16} />
                            Transcript
                          </h3>
                        </div>
                        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                          {selectedMeeting.transcript.map((line, i) => (
                            <p key={`${line.substring(0, 30)}-${i}`} className="text-sm text-mission-control-text bg-mission-control-bg rounded-lg px-3 py-2">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Items & Tasks */}
                    {(selectedMeeting.actionItems.length > 0 || selectedMeeting.tasksCreated.length > 0) && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-mission-control-border">
                          <h3 className="font-medium text-mission-control-text flex items-center gap-2">
                            <ListTodo size={16} />
                            Action Items
                          </h3>
                        </div>
                        <div className="p-4 space-y-4">
                          {selectedMeeting.actionItems.length > 0 && (
                            <div>
                              <p className="text-xs text-mission-control-text-dim mb-2">Detected</p>
                              <ul className="space-y-1">
                                {selectedMeeting.actionItems.map((item) => (
                                  <li key={item} className="text-sm text-mission-control-text">• {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedMeeting.tasksCreated.length > 0 && (
                            <div>
                              <p className="text-xs text-mission-control-text-dim mb-2">Tasks Created</p>
                              <ul className="space-y-1">
                                {selectedMeeting.tasksCreated.map((task) => (
                                  <li key={task} className="text-sm text-success flex items-center gap-2">
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
                    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-mission-control-border">
                        <h3 className="font-medium text-mission-control-text flex items-center gap-2">
                          <Brain size={16} />
                          Ask about this meeting
                        </h3>
                      </div>
                      <div className="p-4">
                        {meetingChatMessages.length > 0 && (
                          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                            {meetingChatMessages.map((msg) => (
                              <div key={`${msg.role}-${msg.timestamp}-${msg.content.slice(0, 20)}`} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <span className={`inline-block rounded-lg px-3 py-2 max-w-[90%] ${
                                  msg.role === 'user' 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-mission-control-bg border border-mission-control-border'
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
                            className="flex-1 px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-sm focus:outline-none focus:border-success-border"
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
                      <h2 className="text-heading-3">Past Meetings</h2>
                      <button 
                        onClick={loadPastMeetings} 
                        disabled={loadingPastMeetings}
                        className="text-sm text-mission-control-text-dim hover:text-mission-control-accent flex items-center gap-1"
                      >
                        {loadingPastMeetings ? <Spinner size={14} /> : <Loader2 size={14} />}
                        Refresh
                      </button>
                    </div>

                    {loadingPastMeetings ? (
                      <div className="flex items-center justify-center py-12">
                        <Spinner size={24} />
                      </div>
                    ) : pastMeetingsError ? (
                      <ErrorDisplay
                        error={pastMeetingsError}
                        context={{ action: 'load meetings', resource: 'past meetings' }}
                        onRetry={() => { setPastMeetingsError(null); loadPastMeetings(); }}
                        inline
                      />
                    ) : pastMeetings.length === 0 ? (
                      <EmptyState
                        icon={Calendar}
                        title="No meetings recorded"
                        description="Start a meeting to see it here. Recordings are saved to ~/mission-control/meetings/."
                      />
                    ) : (
                      <div className="space-y-3">
                        {pastMeetings.map((meeting) => (
                          <button
                            key={meeting.id || meeting.filepath}
                            onClick={() => setSelectedMeeting(meeting)}
                            className="w-full text-left bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent transition-all group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium text-mission-control-text group-hover:text-success transition-all">
                                  {meeting.title || meeting.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-mission-control-text-dim">
                                  <span>{meeting.time}</span>
                                  {meeting.duration && meeting.duration > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full">
                                      {formatDuration(meeting.duration)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-mission-control-text-dim group-hover:text-success transition-all" />
                            </div>
                            {meeting.transcript.length > 0 && (
                              <p className="text-sm text-mission-control-text-dim line-clamp-2 mt-2">
                                {meeting.transcript[0]}
                              </p>
                            )}
                            {(meeting.actionItems.length > 0 || meeting.tasksCreated.length > 0) && (
                              <div className="flex gap-2 mt-3">
                                {meeting.actionItems.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-warning-subtle text-warning rounded-full">
                                    {meeting.actionItems.length} action items
                                  </span>
                                )}
                                {meeting.tasksCreated.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded-full">
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

            {/* Transcribe Audio File View */}
            {activeView === 'transcribe' && (
              <div className="p-6 max-w-2xl mx-auto">
                <h2 className="text-heading-3 mb-4">Transcribe Audio File</h2>
                <p className="text-mission-control-text-dim mb-6">
                  Upload an audio file (MP3, WAV, M4A) to transcribe using Gemini AI.
                </p>

                {!transcribing && !transcriptionResult && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8 text-center">
                    <Upload size={48} className="mx-auto mb-4 text-mission-control-text-dim opacity-30" />
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-mission-control-accent hover:bg-mission-control-accent/90 text-white rounded-xl cursor-pointer transition-all">
                      <Upload size={18} />
                      Choose Audio File
                      <input
                        type="file"
                        accept="audio/*,video/*"
                        onChange={handleTranscribeFile}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-mission-control-text-dim mt-4">
                      Supported: MP3, WAV, M4A, WebM, OGG, FLAC
                    </p>
                  </div>
                )}

                {/* Progress bar during transcription */}
                {transcribing && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 size={20} className="animate-spin text-mission-control-accent" />
                      <span className="font-medium text-mission-control-text">Transcribing audio...</span>
                    </div>
                    <div className="w-full h-3 bg-mission-control-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-mission-control-accent to-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, transcriptionProgress)}%` }}
                      />
                    </div>
                    <p className="text-sm text-mission-control-text-dim mt-2 text-right">
                      {Math.round(transcriptionProgress)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Upload Transcript View */}
            {activeView === 'upload-transcript' && (
              <div className="p-6 max-w-2xl mx-auto">
                <h2 className="text-heading-3 mb-4">Upload Transcript</h2>
                <p className="text-mission-control-text-dim mb-6">
                  Upload an existing transcript file to generate a summary and extract tasks.
                </p>

                {!transcribing && !transcriptionResult && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8 text-center">
                    <FileText size={48} className="mx-auto mb-4 text-mission-control-text-dim opacity-30" />
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-mission-control-accent hover:bg-mission-control-accent/90 text-white rounded-xl cursor-pointer transition-all">
                      <Upload size={18} />
                      Choose Transcript File
                      <input
                        type="file"
                        accept=".txt,.pdf,.docx,.doc"
                        onChange={handleTranscriptUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-mission-control-text-dim mt-4">
                      Supported: TXT, PDF, DOCX
                    </p>
                  </div>
                )}

                {/* Progress bar during extraction */}
                {transcribing && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 size={20} className="animate-spin text-mission-control-accent" />
                      <span className="font-medium text-mission-control-text">Extracting text...</span>
                    </div>
                    <div className="w-full h-3 bg-mission-control-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-mission-control-accent to-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, transcriptionProgress)}%` }}
                      />
                    </div>
                    <p className="text-sm text-mission-control-text-dim mt-2 text-right">
                      {Math.round(transcriptionProgress)}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Shared post-result UI for both transcribe and upload-transcript */}
            {(activeView === 'transcribe' || activeView === 'upload-transcript') && transcriptionResult && !transcribing && (
              <div className="p-6 pt-0 max-w-2xl mx-auto">
                <div className="space-y-4">
                  {!transcriptionSaved ? (
                    <div className="bg-success-subtle border border-success-border rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 size={20} className="text-success" />
                        <span className="font-medium text-success">
                          {activeView === 'transcribe' ? 'Transcription Complete' : 'Text Extracted'}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Meeting Name</label>
                          <input
                            type="text"
                            value={transcriptionFileName}
                            onChange={(e) => setTranscriptionFileName(e.target.value)}
                            placeholder="Name this meeting..."
                            className="w-full px-4 py-2.5 bg-mission-control-bg border border-mission-control-border rounded-xl text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-success-border"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={saveTranscriptionAsMeeting}
                            disabled={transcriptionSaving}
                            className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                          >
                            {transcriptionSaving ? (
                              <><Loader2 size={18} className="animate-spin" /> Processing...</>
                            ) : (
                              <><Check size={18} /> Save to Past Meetings</>
                            )}
                          </button>
                          <button
                            onClick={async () => {
                              const success = await copyToClipboard(transcriptionResult);
                              if (!success) {
                                alert('Failed to copy transcription. Please copy manually.');
                              }
                            }}
                            className="px-4 py-3 bg-mission-control-surface border border-mission-control-border rounded-xl text-sm hover:border-mission-control-accent transition-all"
                          >
                            Copy Text
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-success-subtle border border-success-border rounded-2xl p-6 text-center">
                      <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
                      <p className="font-medium text-success mb-1">Saved to Past Meetings</p>
                      <p className="text-sm text-mission-control-text-dim mb-4">
                        Summary and tasks have been generated. View in the Past Meetings tab.
                      </p>
                      <div className="flex gap-3 justify-center">
                        <button
                          onClick={() => { setActiveView('history'); setTranscriptionResult(''); setTranscriptionSaved(false); }}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-all"
                        >
                          View Past Meetings
                        </button>
                        <button
                          onClick={() => { setTranscriptionResult(''); setTranscriptionSaved(false); setTranscriptionProgress(0); }}
                          className="px-4 py-2 bg-mission-control-surface border border-mission-control-border rounded-xl text-sm hover:border-mission-control-accent transition-all"
                        >
                          Upload Another
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Proposed Task Cards from Mission Control */}
                  {proposedTasks.length > 0 && (
                    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-mission-control-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Brain size={18} className="text-review" />
                          <h3 className="font-medium text-mission-control-text">Task Cards from Mission Control</h3>
                          <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                            {proposedTasks.filter(t => t.status === 'pending').length} pending
                          </span>
                        </div>
                        <p className="text-xs text-mission-control-text-dim">Approve to add to Kanban</p>
                      </div>
                      <div className="divide-y divide-mission-control-border">
                        {proposedTasks.map((task) => (
                          <div
                            key={task.id}
                            className={`p-4 transition-all ${
                              task.status === 'rejected' ? 'opacity-40' : ''
                            } ${task.status === 'approved' ? 'bg-success-subtle' : ''}`}
                          >
                            {editingProposedTask === task.id ? (
                              <div className="space-y-3">
                                <input
                                  type="text"
                                  value={editingProposedText}
                                  onChange={(e) => setEditingProposedText(e.target.value)}
                                  className="w-full px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm text-mission-control-text"
                                  placeholder="Edit task title..."
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setProposedTasks(prev => prev.map(t =>
                                        t.id === task.id ? { ...t, title: editingProposedText, status: 'approved' as const } : t
                                      ));
                                      approveProposedTask(task.id);
                                      setEditingProposedTask(null);
                                    }}
                                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm"
                                  >
                                    Save & Approve
                                  </button>
                                  <button
                                    onClick={() => setEditingProposedTask(null)}
                                    className="px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm text-mission-control-text"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-mission-control-text">{task.title}</p>
                                  {task.description && (
                                    <p className="text-sm text-mission-control-text-dim mt-1">{task.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs px-2 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full">
                                      {task.proposedAgent}
                                    </span>
                                    {task.status === 'approved' && (
                                      <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded-full flex items-center gap-1">
                                        <Check size={10} /> Added to Kanban
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {task.status === 'pending' && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => approveProposedTask(task.id)}
                                      className="p-2 hover:bg-success-subtle rounded-lg text-success transition-all"
                                      title="Approve — add to Kanban"
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingProposedTask(task.id);
                                        setEditingProposedText(task.title);
                                      }}
                                      className="p-2 hover:bg-mission-control-bg rounded-lg text-mission-control-text-dim transition-all"
                                      title="Edit & Approve"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button
                                      onClick={() => rejectProposedTask(task.id)}
                                      className="p-2 hover:bg-error-subtle rounded-lg text-error transition-all"
                                      title="Reject"
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
                    </div>
                  )}

                  {/* Transcript preview */}
                  <details className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                    <summary className="p-4 cursor-pointer hover:bg-mission-control-bg/50 flex items-center gap-2">
                      <FileText size={18} className="text-mission-control-text-dim" />
                      <span className="font-medium text-mission-control-text">Transcript Preview</span>
                    </summary>
                    <div className="p-4 border-t border-mission-control-border max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-mission-control-text">
                        {transcriptionResult}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
