/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: MeetingsPanel uses file-level suppression for intentional stable callback patterns.
// The suppressions are legitimate because:
// - All callbacks are wrapped in useCallback with proper deps
// - Mount-only effects for gateway subscription and cleanup are intentional
// - Complex meeting lifecycle effects are carefully designed
// - Post-processing effects depend on stable useCallback hooks
// Review: 2026-02-17 - suppression retained, all patterns intentional

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, IconButton, TextField, Select, TextArea, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import { 
  Mic, MicOff, Phone, PhoneOff, Loader2, 
  MessageSquare, Brain, ListTodo, Clock, FileText,
  Download, ChevronRight, Calendar, Send, X,
  Check, Edit3, Trash2, Plus, CheckCircle2, XCircle,
  Upload, Zap, Archive
} from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import TabNav from './TabNav';
import { gateway, ConnectionState } from '../lib/gateway';
import { authHeaders } from '../lib/api';
// GeminiLiveService not used for passive recording — using Web Speech API for live + Gemini audio API for post-meeting diarization
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

// Server-side Gemini proxy helper — API key never leaves the server (F-02 fix)
async function geminiGenerate(
  contents: unknown[],
  generationConfig?: Record<string, unknown>,
  model?: string,
): Promise<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }> {
  const { authHeaders } = await import('../lib/api');
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ contents, generationConfig, model }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  return res.json();
}

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

interface PastMeetingTaskProposal {
  id: string; title: string; description: string; planningNotes: string;
  priority: string; assignedTo: string; subtasks: string[];
  status: 'pending' | 'approved' | 'rejected';
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
  oneLiner?: string;
  source: 'file' | 'db';
  summarySource?: string;
  storedActionItems?: Array<{ id: string; text: string }>;
  storedTaskProposals?: PastMeetingTaskProposal[];
}

/** Expandable transcript preview — fetches raw content from scheduled_items */
function TranscriptPreview({ meetingId }: { meetingId?: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadContent = useCallback(async () => {
    if (content || !meetingId || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/meetings?status=completed', { headers: { ...authHeaders() } });
      if (!res.ok) return;
      const rows = await res.json();
      const match = rows.find((r: Record<string, unknown>) => r.id === meetingId);
      if (match?.content) setContent(match.content as string);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [meetingId, content, loading]);

  return (
    <details
      className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden"
      onToggle={(e) => {
        const isOpen = (e.target as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen) loadContent();
      }}
    >
      <summary className="p-4 cursor-pointer hover:bg-mission-control-bg/50 flex items-center gap-2">
        <FileText size={16} className="text-mission-control-text-dim" />
        <span className="font-medium text-mission-control-text">Transcript Preview</span>
        {open && loading && <Loader2 size={14} className="animate-spin text-mission-control-text-dim" />}
      </summary>
      {content && (
        <div className="p-4 border-t border-mission-control-border max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-mission-control-text">{content}</pre>
        </div>
      )}
      {!content && !loading && open && (
        <div className="p-4 border-t border-mission-control-border text-sm text-mission-control-text-dim">
          No transcript content available.
        </div>
      )}
    </details>
  );
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

  // Transcript upload state
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<string | null>(null);
  const [uploadSummarySource, setUploadSummarySource] = useState<'gemini' | 'extractive' | null>(null);
  const [uploadSavedPath, setUploadSavedPath] = useState<string | null>(null);
  const [uploadActionItems, setUploadActionItems] = useState<Array<{
    id: string;
    text: string;
    status: 'pending' | 'approved' | 'dismissed';
    editedText?: string;
  }>>([]);
  const [editingUploadItemId, setEditingUploadItemId] = useState<string | null>(null);
  const [editingUploadItemText, setEditingUploadItemText] = useState('');
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [tasksCreatedCount, setTasksCreatedCount] = useState(0);
  const [recentUploads, setRecentUploads] = useState<Array<{ id: string; title: string; date: string; actionCount: number; summarySource: string }>>([]);
  const [taskProposals, setTaskProposals] = useState<Array<{
    id: string; title: string; description: string; planningNotes: string;
    priority: string; assignedTo: string; subtasks: string[]; status: 'pending' | 'approved' | 'rejected';
  }>>([]);

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingChunksRef = useRef<Blob[]>([]);
  const transcribingRef = useRef(false);
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

  // DB Helpers — route through server API
  const dbExec = useCallback(async (_sql: string, _params: (string | number | boolean | null)[] = []) => {
    // No-op — individual operations use dedicated API endpoints below
  }, []);

  const dbQuery = useCallback(async <T extends Record<string, unknown>>(_sql: string, _params: (string | number | boolean | null)[] = []): Promise<T[]> => {
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
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          title,
          description: opts?.agenda || '',
          scheduledAt: new Date().toISOString(),
          duration: 0,
          attendees: opts?.participants?.split(',').map(p => p.trim()).filter(Boolean) || [],
          type: 'meeting',
        }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return data.id || '';
    } catch {
      return '';
    }
  }, []);

  const saveTranscriptToDb = useCallback(async (meetingId: string, text: string, cleanedText?: string) => {
    if (!meetingId) return;
    await dbExec(
      `INSERT INTO meeting_transcripts (meeting_id, speaker, text, cleaned_text, timestamp) VALUES (?, 'user', ?, ?, ?)`,
      [meetingId, text, cleanedText || null, Date.now()]
    );
  }, [dbExec]);

  const endMeetingInDb = useCallback(async (meetingId: string, duration: number, summary?: string, _filePath?: string) => {
    if (!meetingId) return;
    try {
      await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          status: 'completed',
          duration: Math.round(duration / 1000),
          description: summary || undefined,
        }),
      });
    } catch { /* non-critical */ }
  }, []);

  const loadDbMeetings = useCallback(async (): Promise<PastMeeting[]> => {
    // Load from API (scheduled_items where type=meeting and status=completed)
    try {
      const res = await fetch('/api/meetings?status=completed', { headers: { ...authHeaders() } });
      if (!res.ok) return [];
      const rows = await res.json() as Array<Record<string, unknown>>;
      return rows.map((row) => {
        let meta: Record<string, unknown> = {};
        try { meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata as string) : (row.metadata || {}); } catch { /* */ }
        const scheduledAt = (row.scheduledAt as number) || Date.now();
        return {
          id: row.id as string,
          filename: (row.title as string) || 'Untitled',
          filepath: (meta.filePath as string) || '',
          date: new Date(scheduledAt),
          time: new Date(scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          title: row.title as string,
          duration: row.duration as number | undefined,
          transcript: [],
          actionItems: [],
          tasksCreated: [],
          rawContent: (meta.summary as string) || (row.description as string) || (row.content as string) || '',
          oneLiner: meta.summary
            ? (row.description as string) || ''
            : ((row.description as string) || '').replace(/[#*_]/g, '').split(/[.!?\n]/)[0]?.trim().slice(0, 120) || '',
          source: 'db' as const,
          summarySource: meta.summarySource as string | undefined,
          storedActionItems: Array.isArray(meta.actionItems) ? meta.actionItems as Array<{ id: string; text: string }> : undefined,
          storedTaskProposals: Array.isArray(meta.taskProposals)
            ? (meta.taskProposals as PastMeetingTaskProposal[]).map((tp, i) => ({ ...tp, id: tp.id || `tp-${i}`, status: tp.status || 'pending' as const }))
            : undefined,
        };
      });
    } catch {
      return [];
    }
  }, []);

  const generateSummary = useCallback(async (transcript: string[]): Promise<string | null> => {
    if (transcript.length === 0) return null;
    setGeneratingSummary(true);
    try {
      const fullText = transcript.join('\n');
      const data = await geminiGenerate(
        [{ parts: [{ text: `Summarize this meeting transcript. Include:\n1. **Key Topics** discussed\n2. **Decisions** made\n3. **Action Items** with owners if mentioned\n4. **Next Steps**\n\nKeep it concise but comprehensive.\n\nTranscript:\n${fullText}` }] }],
        { maxOutputTokens: 2048, temperature: 0.3 }
      );
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
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
      const data = await geminiGenerate(
        [{ parts: [{ text: prompt }] }],
        { maxOutputTokens: 4096, temperature: 0.2 }
      );

      {
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

      // Transcribe via server-side proxy (F-02: API key never leaves server)
      const mimeType = file.type || 'audio/webm';
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('mimeType', mimeType);
      const { authHeaders: getAuthHeaders } = await import('../lib/api');
      const transcribeResponse = await fetch('/api/gemini/transcribe', {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        body: formData,
      });
      if (!transcribeResponse.ok) throw new Error(`Transcription error: ${transcribeResponse.status}`);
      const transcribeData = await transcribeResponse.json();
      const result = transcribeData.transcript?.trim() || '';
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

  // Handle transcript file upload (.txt, .md) — validates, reads, POSTs to API
  const processTranscriptFile = useCallback(async (file: File) => {
    // Reset state
    setUploadError(null);
    setUploadSummary(null);
    setUploadSummarySource(null);
    setUploadSavedPath(null);
    setUploadActionItems([]);
    setTasksCreatedCount(0);
    setTranscriptionResult('');
    setTranscriptionSaved(false);

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`);
      return;
    }

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'md') {
      setUploadError(`Unsupported file type: .${ext}. Only .txt and .md files are accepted.`);
      return;
    }

    setTranscribing(true);
    setTranscriptionProgress(0);
    setTranscriptionFileName(file.name.replace(/\.[^/.]+$/, ''));
    setStatusMessage('Processing transcript...');

    const progressInterval = setInterval(() => {
      setTranscriptionProgress(prev => prev >= 85 ? prev : prev + Math.random() * 8 + 3);
    }, 500);

    try {
      const content = await file.text();
      if (!content.trim()) {
        throw new Error('File is empty');
      }

      setTranscriptionProgress(30);

      // POST to server API
      const response = await fetch('/api/meetings/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content, filename: file.name }),
      });

      setTranscriptionProgress(90);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      setTranscriptionProgress(100);
      setTranscriptionResult(content.trim());
      setUploadSummary(result.summary);
      setUploadSummarySource(result.summarySource);
      setUploadSavedPath(result.savedPath);
      setUploadActionItems(result.actionItems || []);
      setTaskProposals(result.taskProposals || []);
      setTranscriptionSaved(true);
      setStatusMessage(`Transcript processed — ${result.actionItemCount || 0} action items, ${(result.taskProposals || []).length} tasks proposed`);
      // Track in recent uploads for card display
      if (result.meetingId) {
        setRecentUploads(prev => [{
          id: result.meetingId,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          actionCount: result.actionItemCount || 0,
          summarySource: result.summarySource || 'extractive',
        }, ...prev]);
      }
      addActivity({ type: 'system', message: `Transcript uploaded: ${file.name}`, timestamp: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
      setStatusMessage(`Upload failed: ${msg}`);
      setTranscriptionProgress(0);
    } finally {
      clearInterval(progressInterval);
      setTranscribing(false);
    }
  }, [addActivity]);

  const handleTranscriptUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processTranscriptFile(file);
    // Reset input so re-uploading same file triggers onChange
    event.target.value = '';
  }, [processTranscriptFile]);

  const handleTranscriptDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) processTranscriptFile(file);
  }, [processTranscriptFile]);

  const handleTranscriptDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setUploadDragOver(true);
  }, []);

  const handleTranscriptDragLeave = useCallback(() => {
    setUploadDragOver(false);
  }, []);

  // Create tasks from approved upload action items
  const createTasksFromUploadItems = useCallback(async () => {
    const approved = uploadActionItems.filter(i => i.status === 'approved');
    if (approved.length === 0) return;

    setCreatingTasks(true);
    let created = 0;
    try {
      const { taskApi } = await import('../lib/api');
      for (const item of approved) {
        const title = (item.editedText || item.text).charAt(0).toUpperCase() + (item.editedText || item.text).slice(1);
        try {
          await taskApi.create({
            title: title.replace(/[,;:]$/, '').trim(),
            status: 'todo',
            priority: 'p2',
            project: 'meetings',
            description: `Extracted from meeting transcript on ${new Date().toLocaleDateString()}`,
          });
          created++;
        } catch { /* continue on individual failure */ }
      }
      setTasksCreatedCount(created);
      addActivity({ type: 'task', message: `Created ${created} task(s) from transcript`, timestamp: Date.now() });
      setStatusMessage(`Created ${created} task${created !== 1 ? 's' : ''} from transcript`);
    } catch (err) {
      logger.error('Failed to create tasks from transcript:', err);
      setStatusMessage('Failed to create tasks');
    } finally {
      setCreatingTasks(false);
    }
  }, [uploadActionItems, addActivity]);

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
            setStatusMessage('Saved to Meetings!');
          }
        } catch (err) {
          logger.error('Mission Control review error:', err);
          setStatusMessage('Saved! (Mission Control review failed)');
        }
      } else {
        setStatusMessage('Saved to Meetings!');
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

  const cleanupWithGemini = useCallback(async (text: string) => {
    try {
      const data = await geminiGenerate(
        [{ parts: [{ text: `Fix transcription errors. Common words: "perps" (perpetual futures), "Mission Control", "Bitso", "Kanban", "onchain", "Solana".\n\nDO NOT add explanation or context. Output ONLY the corrected text:\n\n${text}` }] }],
        { maxOutputTokens: 512, temperature: 0.1 }
      );
      const cleaned = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (cleaned && cleaned !== text) {
        setMeetingTranscript(prev => {
          const updated = [...prev];
          const idx = updated.indexOf(text);
          if (idx !== -1) updated[idx] = cleaned;
          return updated;
        });
      }
    } catch {
      // '[Gemini] Cleanup error'
    }
  }, []);

  // Web Speech API Transcription — defined after cleanupWithGemini to avoid TDZ
  const startSpeechRecognition = useCallback((meetingDbId: string | null) => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) throw new Error('Speech recognition not supported in this browser. Use Chrome or Edge.');

    const recognition: any = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.trim();
        if (!text) continue;

        if (event.results[i].isFinal) {
          // Final result — commit to transcript
          transcriptBufferRef.current = '';
          setMeetingTranscript(prev => [...prev, text]);
          setMeetingTranscriptLines(prev => [...prev, { text, timestamp: Date.now() }]);
          if (meetingDbId) saveTranscriptToDb(meetingDbId, text).catch(() => {});
          cleanupWithGemini(text);
        } else {
          // Interim result — show live typing indicator
          transcriptBufferRef.current = text;
          setStatusMessage(text.slice(-80));
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'aborted') return;
      console.error('[SpeechRecognition] error:', event.error, event);
      setStatusMessage(`Mic error: ${event.error}`);
    };

    recognition.onaudiostart = () => { console.log('[SpeechRecognition] audio started — mic is active'); setStatusMessage('Mic active — listening...'); };
    recognition.onspeechstart = () => { console.log('[SpeechRecognition] speech detected'); setStatusMessage('Hearing you...'); };
    recognition.onspeechend = () => { console.log('[SpeechRecognition] speech ended — waiting for more...'); };
    recognition.onnomatch = () => { console.log('[SpeechRecognition] no match'); };

    recognition.onend = () => {
      console.log('[SpeechRecognition] ended, listeningRef:', listeningRef.current);
      if (listeningRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { console.error('[SpeechRecognition] restart failed:', e); }
      }
    };

    try {
      recognition.start();
      console.log('[SpeechRecognition] started successfully');
    } catch (e) {
      console.error('[SpeechRecognition] start() failed:', e);
      setStatusMessage(`Speech recognition failed to start: ${e}`);
    }
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
      // Grab mic with selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      });
      streamRef.current = stream;

      // Audio level meter
      try {
        const audioContext = new AudioContext();
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
      } catch { /* audio level metering is non-critical */ }

      // Record audio — full recording for post-meeting + chunks for live transcription
      audioChunksRef.current = [];
      pendingChunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          pendingChunksRef.current.push(e.data);
        }
      };
      recorder.start(10000); // 10s chunks
      mediaRecorderRef.current = recorder;

      listeningRef.current = true;
      setListening(true);

      // Start Web Speech API for live transcription (Chrome/Edge)
      try {
        startSpeechRecognition(dbId);
        console.log('[Meeting] Web Speech API started for live transcription');
      } catch (e) {
        console.error('[Meeting] Web Speech API failed:', e);
        setStatusMessage('Speech recognition unavailable — audio is still being recorded for post-meeting processing');
      }

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
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
        transcriptionIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
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

  // Post-process after meeting ends:
  // 1. Send audio to Gemini for speaker diarization (if audio recorded)
  // 2. Send diarized transcript to /api/meetings/transcript for summary + task extraction
  // 3. Update meeting record with results
  const prevMeetingActive = useRef(isMeetingActive);
  useEffect(() => {
    if (prevMeetingActive.current && !isMeetingActive && meetingTranscript.length > 0) {
      (async () => {
        const rawTranscript = meetingTranscript.join('\n\n');
        let finalTranscript = rawTranscript;

        // Step 1: Diarize — send audio or raw text to Gemini for speaker labels
        setStatusMessage('Identifying speakers...');
        try {
          const formData = new FormData();
          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            formData.append('audio', audioBlob, 'meeting.webm');
          }
          formData.append('rawTranscript', rawTranscript);

          const diarRes = await fetch('/api/meetings/diarize', { method: 'POST', headers: { ...authHeaders() }, body: formData });
          if (diarRes.ok) {
            const diarData = await diarRes.json();
            if (diarData.diarizedTranscript) {
              finalTranscript = diarData.diarizedTranscript;
            }
          }
        } catch { /* diarization failed — use raw transcript */ }
        audioChunksRef.current = []; // free memory

        // Step 2: Send diarized transcript for summary + task extraction
        setStatusMessage('Generating summary and extracting tasks...');
        try {
          const res = await fetch('/api/meetings/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              content: finalTranscript,
              filename: `live-meeting-${new Date().toISOString().slice(0, 10)}.md`,
            }),
          });

          if (res.ok) {
            const result = await res.json();
            if (result.summary) setAiSummary(result.summary);
            if (result.taskProposals) setTaskProposals(result.taskProposals);
            setMeetingEndSummary({ savedPath: result.savedPath, tasksCreated: 0, extractedTasks: [] });

            if (meetingDbId) {
              try { await endMeetingInDb(meetingDbId, elapsedTime, result.summary || undefined); } catch { /* ignore */ }
            }

            setStatusMessage('Meeting processed — review in Meetings tab');
          } else {
            if (meetingDbId) {
              try { await endMeetingInDb(meetingDbId, elapsedTime); } catch { /* ignore */ }
            }
            setMeetingEndSummary({ savedPath: null, tasksCreated: 0, extractedTasks: [] });
            setStatusMessage('Meeting ended');
          }
        } catch {
          if (meetingDbId) {
            try { await endMeetingInDb(meetingDbId, elapsedTime); } catch { /* ignore */ }
          }
          setMeetingEndSummary({ savedPath: null, tasksCreated: 0, extractedTasks: [] });
          setStatusMessage('Meeting ended');
        }

        addActivity({ type: 'system', message: 'Meeting ended and processed', timestamp: Date.now() });
        loadPastMeetings();
      })();
    }
    prevMeetingActive.current = isMeetingActive;
  }, [isMeetingActive, meetingTranscript, addActivity, loadPastMeetings, meetingDbId, elapsedTime, endMeetingInDb]);

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
        const data = await geminiGenerate(
          [{ parts: [{ text: prompt }] }],
          { maxOutputTokens: 1024 }
        );
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (answer) {
          setMeetingChatMessages(prev => [...prev, { role: 'assistant', content: answer, timestamp: Date.now() }]);
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
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-control-border flex-shrink-0 bg-mission-control-surface">
        <div className="max-w-5xl mx-auto">
          <Flex align="center" justify="between">
            <Flex align="center" gap="4">
              <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0">
                <Phone size={20} className="text-mission-control-accent" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-mission-control-text">Meetings</h1>
                <p className="text-xs text-mission-control-text-dim mt-0.5">
                  {isMeetingActive ? 'Recording in progress' : 'Transcribe and review meetings'}
                </p>
              </div>
            </Flex>
            <Flex align="center" gap="3">
              {statusMessage && (
                <span className="text-sm text-mission-control-text-dim bg-mission-control-bg px-3 py-1 rounded-full">
                  {statusMessage}
                </span>
              )}
              <button
                onClick={toggleMuted}
                title={isMuted ? 'Unmute' : 'Mute'}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                  isMuted
                    ? 'bg-[var(--color-error)]-subtle border border-[var(--color-error)]-border text-[var(--color-error)]'
                    : 'border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </Flex>
          </Flex>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="shrink-0 bg-mission-control-surface">
        <div className="max-w-5xl mx-auto">
          <TabNav
            tabs={[
              { id: 'current', label: 'Current Meeting', icon: Phone },
              { id: 'history', label: 'Meetings', icon: Clock },
              { id: 'transcribe', label: 'Upload Audio', icon: Upload },
              { id: 'upload-transcript', label: 'Upload Transcript', icon: FileText },
            ]}
            activeTab={activeView}
            onTabChange={(id) => {
              if (id === 'current') { setActiveView('current'); setSelectedMeeting(null); }
              else setActiveView(id as typeof activeView);
            }}
          />
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
                        <Flex align="center" gap="3">
                          <div className="relative flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-error)]/10 flex items-center justify-center">
                            <Mic size={18} className="text-[var(--color-error)]" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--color-error)] rounded-full animate-pulse" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-mission-control-text truncate">{meetingTitle || 'Untitled Meeting'}</p>
                            <p className="text-xs text-mission-control-text-dim">
                              {formatDuration(elapsedTime)} · {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label?.split('(')[0].trim() || 'Default mic'}
                            </p>
                          </div>
                          <Button
                            onClick={endMeeting}
                            size="2"
                            variant="solid"
                            color="red"

                            className="flex-shrink-0"
                          >
                            <PhoneOff size={15} /> End
                          </Button>
                        </Flex>

                        {/* Audio waveform */}
                        <Flex align="end" gap="1" className="h-8 px-1">
                          {Array.from({ length: 32 }).map((_, i) => {
                            const active = i / 32 < audioLevel * 1.4;
                            const height = active ? `${30 + Math.sin(i * 0.9 + Date.now() / 200) * 50}%` : '15%';
                            return (
                              <div key={i} className={`flex-1 rounded-full transition-colors duration-75 ${active ? 'bg-[var(--color-success)]' : 'bg-mission-control-border'}`}
                                style={{ height }} />
                            );
                          })}
                        </Flex>

                        {/* Live transcript feed */}
                        <div className="bg-mission-control-bg rounded-lg p-4 min-h-[80px]">
                          {meetingTranscript.length > 0 ? (
                            <div className="space-y-1.5">
                              {meetingTranscript.slice(-4).map((line, i, arr) => (
                                <p key={i} className={`text-sm leading-relaxed transition-opacity ${i === arr.length - 1 ? 'text-mission-control-text' : 'text-mission-control-text-dim opacity-60'}`}>
                                  {line}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Flex align="center" gap="3" className="text-mission-control-text-dim">
                                <span className="flex gap-1 items-center">
                                  {[0, 1, 2].map(i => (
                                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-bounce"
                                      style={{ animationDelay: `${i * 0.2}s` }} />
                                  ))}
                                </span>
                                <span className="text-sm">{statusMessage || 'Listening — audio is being recorded...'}</span>
                              </Flex>
                              <p className="text-xs text-mission-control-text-dim">
                                Audio is recording. Transcript will be generated with speaker labels when the meeting ends.
                              </p>
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
                          <TextField.Root
                            value={meetingTitle}
                            onChange={(e) => { setMeetingTitle(e.target.value); setStartError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setShowTitleInput(false); setStartError(null); } }}
                            placeholder="Meeting title (optional)"
                            autoFocus
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Agenda</label>
                          <TextArea
                            value={meetingAgenda}
                            onChange={(e) => setMeetingAgenda(e.target.value)}
                            placeholder="Topics to discuss..."
                            rows={2}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Participants</label>
                          <TextField.Root
                            value={meetingParticipants}
                            onChange={(e) => setMeetingParticipants(e.target.value)}
                            placeholder="Names, comma-separated"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Notes</label>
                          <TextArea
                            value={meetingNotes}
                            onChange={(e) => setMeetingNotes(e.target.value)}
                            placeholder="Pre-meeting notes..."
                            rows={2}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Microphone</label>
                          <Select.Root value={selectedDeviceId || '__default__'} onValueChange={val => setSelectedDeviceId(val === '__default__' ? '' : val)}>
                            <Select.Trigger className="w-full" />
                            <Select.Content>
                              <Select.Item value="__default__">System Default</Select.Item>
                              {audioDevices.map(d => (
                                <Select.Item key={d.deviceId} value={d.deviceId}>
                                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Root>
                        </div>

                        {startError && (
                          <Flex align="start" gap="3" p="4" className="bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg">
                            <XCircle size={18} className="text-[var(--color-error)] shrink-0 mt-0.5" />
                            <p className="text-sm text-[var(--color-error)]">{startError}</p>
                          </Flex>
                        )}

                        <Flex gap="3">
                          <Button
                            onClick={startMeeting}
                            size="3"
                            variant="solid"
                            className="flex-1"
                          >
                            <Mic size={24} />
                            Start Recording
                          </Button>
                          <button
                            onClick={() => { setShowTitleInput(false); setStartError(null); }}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                          >
                            <X size={20} />
                          </button>
                        </Flex>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--color-success)]/10 flex items-center justify-center">
                          <Phone size={36} className="text-[var(--color-success)]" />
                        </div>
                        <h2 className="text-sm font-semibold text-mission-control-text mb-2">Start a Meeting</h2>
                        <p className="text-mission-control-text-dim mb-6 max-w-md mx-auto">
                          Record, transcribe, and extract action items from your meetings with AI-powered transcription.
                        </p>
                        <Button
                          onClick={() => setShowTitleInput(true)}
                          size="3"
                          variant="solid"
                          className="mx-auto"
                        >
                          <Phone size={24} />
                          New Meeting
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Calendar Events */}
                {upcomingEvents.length > 0 && !isMeetingActive && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-mission-control-border flex items-center justify-between">
                      <Flex align="center" gap="2">
                        <Calendar size={16} className="text-mission-control-accent" />
                        <h3 className="text-sm font-semibold text-mission-control-text">Upcoming Meetings</h3>
                      </Flex>
                      <button
                        onClick={loadUpcomingEvents}
                        disabled={loadingUpcomingEvents}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
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
                            <Flex align="start" gap="3">
                              <div className="w-12 h-12 rounded-lg bg-mission-control-bg flex flex-col items-center justify-center shrink-0">
                                <span className="text-xs font-medium text-mission-control-accent">
                                  {isToday ? 'Today' : startDate.toLocaleDateString('en-US', { weekday: 'short' })}
                                </span>
                                <span className="text-lg font-semibold text-mission-control-text">
                                  {startDate.getDate()}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-mission-control-text truncate">{event.summary || 'Untitled'}</p>
                                <p className="text-[10px] tabular-nums font-mono text-mission-control-text-dim">
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
                            </Flex>
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
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                          <Brain size={16} className="text-[var(--color-review)]" />
                          <h3 className="text-sm font-semibold text-mission-control-text">AI Summary</h3>
                          {generatingSummary && <Loader2 size={14} className="animate-spin text-mission-control-text-dim" />}
                        </div>
                        <div className="p-6">
                          {generatingSummary ? (
                            <Flex align="center" gap="3" className="text-mission-control-text-dim">
                              <Loader2 size={16} className="animate-spin" />
                              <span>Generating summary...</span>
                            </Flex>
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
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center justify-between">
                          <Flex align="center" gap="2">
                            <ListTodo size={16} className="text-[var(--color-warning)]" />
                            <h3 className="text-sm font-semibold text-mission-control-text">Action Items</h3>
                            <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                              {pendingItems.length} pending • {approvedItems.length} approved
                            </span>
                          </Flex>
                          {pendingItems.length > 0 && (
                            <button
                              onClick={approveAllPending}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
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
                              className={`p-4 transition-colors ${
                                item.status === 'dismissed' ? 'opacity-40' : ''
                              } ${item.status === 'approved' ? 'bg-[var(--color-success)]/10' : ''}`}
                            >
                              {editingItemId === item.id ? (
                                <div className="space-y-3">
                                  <TextField.Root
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEditedItem();
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    className="w-full"
                                  />
                                  <Flex gap="2">
                                    <Button
                                      onClick={saveEditedItem}
                                      size="1"
                                      variant="solid"
                                      color="green"
                                    >
                                      <Check size={14} />
                                      Save & Approve
                                    </Button>
                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </Flex>
                                </div>
                              ) : (
                                <Flex align="start" justify="between" gap="4">
                                  <div className="flex-1">
                                    <Flex align="center" gap="2" className="mb-1">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        item.type === 'task' ? 'bg-[var(--color-info)]/10 text-[var(--color-info)]' :
                                        item.type === 'schedule' ? 'bg-[var(--color-review)]-subtle text-[var(--color-review)]' :
                                        item.type === 'message' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                                        'bg-mission-control-border text-mission-control-text-dim'
                                      }`}>
                                        {item.type}
                                      </span>
                                      {item.status === 'approved' && (
                                        <span className="text-xs px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-full flex items-center gap-1">
                                          <Check size={10} />
                                          Approved
                                        </span>
                                      )}
                                      {item.status === 'dismissed' && (
                                        <span className="text-xs px-2 py-0.5 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded-full">
                                          Dismissed
                                        </span>
                                      )}
                                    </Flex>
                                    <p className={`text-sm ${item.status === 'dismissed' ? 'line-through text-mission-control-text-dim' : 'text-mission-control-text'}`}>
                                      {item.editedText || item.text}
                                    </p>
                                  </div>
                                  {item.status === 'pending' && (
                                    <Flex align="center" gap="1">
                                      <button
                                        onClick={() => approveActionItem(item.id)}
                                        title="Approve"
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => startEditingItem(item)}
                                        title="Edit"
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                      <button
                                        onClick={() => dismissActionItem(item.id)}
                                        title="Dismiss"
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-error)]/70 hover:text-[var(--color-error)] hover:bg-mission-control-surface transition-colors"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </Flex>
                                  )}
                                </Flex>
                              )}
                            </div>
                          ))}
                        </div>
                        {approvedItems.length > 0 && (
                          <Flex align="center" justify="between" p="4" className="border-t border-mission-control-border bg-mission-control-bg">
                            <p className="text-sm text-mission-control-text-dim">
                              {approvedItems.length} item{approvedItems.length > 1 ? 's' : ''} ready to create as tasks
                            </p>
                            <Button
                              onClick={async () => {
                                const count = await createTasksFromApproved();
                                setMeetingEndSummary(prev => prev ? { ...prev, tasksCreated: count } : null);
                                addActivity({ type: 'system', message: `Created ${count} tasks from meeting`, timestamp: Date.now() });
                              }}
                              size="2"
                              variant="solid"
                              color="green"
                             
                            >
                              <Plus size={16} />
                              Create Tasks
                            </Button>
                          </Flex>
                        )}
                      </div>
                    )}

                    {/* Agent-Proposed Tasks */}
                    {proposedTasks.length > 0 && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                          <Brain size={16} className="text-[var(--color-review)]" />
                          <h3 className="text-sm font-semibold text-mission-control-text">Agent-Proposed Tasks</h3>
                          <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                            {proposedTasks.filter(t => t.status === 'pending').length} pending • {proposedTasks.filter(t => t.status === 'approved').length} approved
                          </span>
                        </div>
                        <div className="divide-y divide-mission-control-border">
                          {proposedTasks.map((task) => (
                            <div 
                              key={task.id} 
                              className={`p-4 transition-colors ${
                                task.status === 'rejected' ? 'opacity-40' : ''
                              } ${task.status === 'approved' ? 'bg-[var(--color-success)]/10' : ''}`}
                            >
                              {editingProposedTask === task.id ? (
                                <div className="space-y-3">
                                  <TextField.Root
                                    value={editingProposedText}
                                    onChange={(e) => setEditingProposedText(e.target.value)}
                                    placeholder="Edit task title..."
                                    className="w-full"
                                  />
                                  <Flex gap="2">
                                    <Button
                                      onClick={() => {
                                        setProposedTasks(prev => prev.map(t =>
                                          t.id === task.id ? { ...t, title: editingProposedText, status: 'approved' as const } : t
                                        ));
                                        setEditingProposedTask(null);
                                      }}
                                      size="1"
                                      variant="solid"
                                      color="green"
                                    >
                                      Save
                                    </Button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingProposedTask(null)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </Flex>
                                </div>
                              ) : (
                                <Flex align="start" justify="between" gap="4">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-mission-control-text">{task.title}</p>
                                    {task.description && (
                                      <p className="text-sm text-mission-control-text-dim mt-1">{task.description}</p>
                                    )}
                                    {task.plan && (
                                      <p className="text-xs text-mission-control-text-dim mt-2 italic">Plan: {task.plan}</p>
                                    )}
                                    <Flex align="center" gap="2" className="mt-2">
                                      <span className="text-xs px-2 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full">
                                        {task.proposedAgent}
                                      </span>
                                    </Flex>
                                  </div>
                                  {task.status === 'pending' && (
                                    <Flex align="center" gap="1" className="shrink-0">
                                      <button
                                        onClick={() => approveProposedTask(task.id)}
                                        title="Approve & Create Task"
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                      >
                                        <CheckCircle2 size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingProposedTask(task.id);
                                          setEditingProposedText(task.title);
                                        }}
                                        title="Edit"
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                      <button
                                        onClick={() => rejectProposedTask(task.id)}
                                        title="Reject"
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-error)]/70 hover:text-[var(--color-error)] hover:bg-mission-control-surface transition-colors"
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </Flex>
                                  )}
                                </Flex>
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
                    <Flex gap="3">
                      <Button
                        onClick={sendMeetingSummary}
                        size="2"
                        variant="soft"
                        color="gray"
                       
                        className="flex-1"
                      >
                        <MessageSquare size={18} />
                        Send to Mission Control
                      </Button>
                      <button
                        onClick={() => {
                          setMeetingTranscript([]);
                          setMeetingActionItems([]);
                          setMeetingEndSummary(null);
                          setAiSummary(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-[var(--color-error)]/70 hover:text-[var(--color-error)] hover:bg-mission-control-surface transition-colors"
                      >
                        <Trash2 size={18} />
                        Clear
                      </button>
                    </Flex>
                  </>
                )}
              </div>
            )}

            {activeView === 'history' && (
              <div>
                {selectedMeeting ? (
                  <div className="space-y-6">
                    {/* Meeting Detail Header */}
                    <Flex align="center" justify="between">
                      <button
                        onClick={() => { setSelectedMeeting(null); setMeetingChatMessages([]); }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                      >
                        <ChevronRight size={16} className="rotate-180" />
                        Back to list
                      </button>
                      <Flex align="center" gap="2">
                        <Button
                          onClick={() => exportMeeting(selectedMeeting)}
                          size="2"
                          variant="soft"
                          color="gray"
                         
                        >
                          <Download size={14} />
                          Export
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!selectedMeeting.id) return;
                            try {
                              await fetch(`/api/meetings/${selectedMeeting.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ status: 'archived' }) });
                              setPastMeetings(prev => prev.filter(m => m.id !== selectedMeeting.id));
                              setSelectedMeeting(null);
                              showToast('success', 'Meeting archived');
                            } catch { showToast('error', 'Failed to archive'); }
                          }}
                          size="2"
                          variant="soft"
                          color="gray"
                         
                          title="Archive meeting"
                        >
                          <Archive size={14} />
                          Archive
                        </Button>
                        <IconButton
                          onClick={async () => {
                            if (!selectedMeeting.id) return;
                            try {
                              await fetch(`/api/meetings/${selectedMeeting.id}`, { method: 'DELETE', headers: { ...authHeaders() } });
                              setPastMeetings(prev => prev.filter(m => m.id !== selectedMeeting.id));
                              setSelectedMeeting(null);
                              showToast('success', 'Meeting deleted');
                            } catch { showToast('error', 'Failed to delete'); }
                          }}
                          size="2"
                          variant="soft"
                          color="red"
                         
                          title="Delete meeting"
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Flex>
                    </Flex>

                    {/* Meeting Info */}
                    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                      <h2 className="text-sm font-semibold text-mission-control-text mb-1">
                        {selectedMeeting.title || selectedMeeting.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h2>
                      {selectedMeeting.oneLiner && (
                        <p className="text-xs text-mission-control-text-dim mb-2">{selectedMeeting.oneLiner}</p>
                      )}
                      <Flex align="center" gap="4" className="text-xs text-mission-control-text-dim">
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
                      </Flex>
                    </div>

                    {/* Summary (from uploaded transcript — stored in rawContent/description) */}
                    {selectedMeeting.rawContent && selectedMeeting.transcript.length === 0 && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                          <Brain size={16} className="text-mission-control-accent" />
                          <h3 className="text-sm font-semibold text-mission-control-text">Meeting Summary</h3>
                        </div>
                        <div className="p-4 text-sm">
                          <MarkdownMessage content={selectedMeeting.rawContent} />
                        </div>
                      </div>
                    )}

                    {/* Transcript (from live meetings — stored as line array) */}
                    {selectedMeeting.transcript.length > 0 && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                          <FileText size={16} className="text-mission-control-text-dim" />
                          <h3 className="text-sm font-semibold text-mission-control-text">Transcript</h3>
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
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                          <ListTodo size={16} className="text-mission-control-text-dim" />
                          <h3 className="text-sm font-semibold text-mission-control-text">Action Items</h3>
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
                                  <li key={task} className="text-sm text-[var(--color-success)] flex items-center gap-2">
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

                    {/* Proposed Tasks (from uploaded transcript metadata) — fully actionable */}
                    {selectedMeeting.storedTaskProposals && selectedMeeting.storedTaskProposals.length > 0 && (
                      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                          <Zap size={16} className="text-mission-control-accent" />
                          <h3 className="text-sm font-semibold text-mission-control-text">Proposed Tasks</h3>
                          <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                            {selectedMeeting.storedTaskProposals.filter(t => t.status === 'pending').length} pending
                          </span>
                        </div>
                        <div className="divide-y divide-mission-control-border">
                          {selectedMeeting.storedTaskProposals.map(proposal => (
                            <div
                              key={proposal.id}
                              className={`p-4 transition-colors ${
                                proposal.status === 'rejected' ? 'opacity-30' : ''
                              } ${proposal.status === 'approved' ? 'bg-[var(--color-success)]/10' : ''}`}
                            >
                              <Flex align="start" gap="3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="font-medium text-sm text-mission-control-text">{proposal.title}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                      proposal.priority === 'p0' ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]' :
                                      proposal.priority === 'p1' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                                      proposal.priority === 'p2' ? 'bg-[var(--color-info)]/10 text-[var(--color-info)]' :
                                      'bg-mission-control-bg text-mission-control-text-dim'
                                    }`}>{proposal.priority?.toUpperCase()}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-mission-control-bg text-mission-control-text-dim">{proposal.assignedTo}</span>
                                  </div>
                                  <p className="text-xs text-mission-control-text-dim mb-2">{proposal.description}</p>
                                  {proposal.subtasks?.length > 0 && (
                                    <div className="text-xs text-mission-control-text-dim space-y-0.5">
                                      {proposal.subtasks.map((st, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                          <span className="w-1 h-1 rounded-full bg-mission-control-text-dim shrink-0" />
                                          {st}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {proposal.status === 'pending' && (
                                  <Flex align="center" gap="1" className="shrink-0">
                                    <button
                                      onClick={async () => {
                                        // Update local state
                                        const updated = selectedMeeting.storedTaskProposals!.map(p =>
                                          p.id === proposal.id ? { ...p, status: 'approved' as const } : p
                                        );
                                        setSelectedMeeting({ ...selectedMeeting, storedTaskProposals: updated });
                                        // Create task with subtasks — assigned to agent, not human
                                        try {
                                          const { taskApi } = await import('../lib/api');
                                          const result = await taskApi.create({
                                            title: proposal.title,
                                            description: proposal.description,
                                            planningNotes: proposal.planningNotes,
                                            priority: proposal.priority,
                                            assignedTo: proposal.assignedTo,
                                            status: 'todo',
                                            tags: ['meeting-extracted'],
                                          });
                                          if (result?.id && proposal.subtasks?.length > 0) {
                                            for (const st of proposal.subtasks) {
                                              await taskApi.addSubtask(result.id, { title: st });
                                            }
                                          }
                                          showToast('success', 'Task created', `"${proposal.title}" assigned to ${proposal.assignedTo}`);
                                        } catch {
                                          showToast('error', 'Failed to create task');
                                        }
                                      }}
                                      title="Approve — creates task assigned to agent"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const updated = selectedMeeting.storedTaskProposals!.map(p =>
                                          p.id === proposal.id ? { ...p, status: 'rejected' as const } : p
                                        );
                                        setSelectedMeeting({ ...selectedMeeting, storedTaskProposals: updated });
                                      }}
                                      title="Reject"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-error)]/70 hover:text-[var(--color-error)] hover:bg-mission-control-surface transition-colors"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </Flex>
                                )}
                                {proposal.status === 'approved' && (
                                  <Flex align="center" gap="1" className="shrink-0 mt-1">
                                    <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                                    <span className="text-xs text-[var(--color-success)]">Created</span>
                                  </Flex>
                                )}
                                {proposal.status === 'rejected' && (
                                  <span className="text-xs text-mission-control-text-dim shrink-0 mt-1">Rejected</span>
                                )}
                              </Flex>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expandable Transcript Preview (raw transcript content from DB) */}
                    {selectedMeeting.source === 'db' && (
                      <TranscriptPreview meetingId={selectedMeeting.id} />
                    )}

                    {/* AI Chat */}
                    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-mission-control-border flex items-center gap-2">
                        <Brain size={16} className="text-mission-control-text-dim" />
                        <h3 className="text-sm font-semibold text-mission-control-text">Ask about this meeting</h3>
                      </div>
                      <div className="p-4">
                        {meetingChatMessages.length > 0 && (
                          <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                            {meetingChatMessages.map((msg) => (
                              <div key={`${msg.role}-${msg.timestamp}-${msg.content.slice(0, 20)}`} className={`text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <span className={`inline-block rounded-lg px-3 py-2 max-w-[90%] ${
                                  msg.role === 'user'
                                    ? 'bg-mission-control-accent/10 border border-mission-control-accent/20 text-mission-control-text'
                                    : 'bg-mission-control-bg border border-mission-control-border text-mission-control-text'
                                }`}>
                                  {msg.role === 'assistant' ? <MarkdownMessage content={msg.content} /> : msg.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <Flex gap="2">
                          <TextField.Root
                            value={meetingChatInput}
                            onChange={(e) => setMeetingChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && meetingChatInput.trim())
                                askAboutMeeting(selectedMeeting, meetingChatInput);
                            }}
                            placeholder="What were the main topics discussed?"
                            disabled={meetingChatProcessing}
                            className="flex-1"
                          />
                          <IconButton
                            onClick={() => askAboutMeeting(selectedMeeting, meetingChatInput)}
                            disabled={!meetingChatInput.trim() || meetingChatProcessing}
                            size="2"
                            variant="solid"

                          >
                            {meetingChatProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                          </IconButton>
                        </Flex>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Meetings List */}
                    <Flex align="center" justify="between" className="mb-4">
                      <h2 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Meetings</h2>
                      <button
                        onClick={loadPastMeetings}
                        disabled={loadingPastMeetings}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-50"
                      >
                        {loadingPastMeetings ? <Spinner size={14} /> : <Loader2 size={14} />}
                        Refresh
                      </button>
                    </Flex>

                    {loadingPastMeetings ? (
                      <Flex align="center" justify="center" className="py-12">
                        <Spinner size={24} />
                      </Flex>
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
                        description="Upload a transcript or start a meeting to see it here."
                      />
                    ) : (
                      <div className="space-y-3">
                        {pastMeetings.map((meeting) => (
                          <button
                            type="button"
                            key={meeting.id || meeting.filepath}
                            onClick={() => setSelectedMeeting(meeting)}
                            className="w-full text-left bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/30 transition-colors group cursor-pointer"
                          >
                            <Flex align="center" justify="between" className="mb-2">
                              <div>
                                <p className="text-sm font-semibold text-mission-control-text group-hover:text-mission-control-accent transition-colors">
                                  {meeting.title || meeting.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                <Flex align="center" gap="3" className="text-sm text-mission-control-text-dim">
                                  <span className="text-[10px] tabular-nums font-mono text-mission-control-text-dim">{meeting.time}</span>
                                  {meeting.duration && meeting.duration > 0 && (
                                    <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full">
                                      {formatDuration(meeting.duration)}
                                    </span>
                                  )}
                                </Flex>
                              </div>
                              <ChevronRight size={16} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
                            </Flex>
                            {(meeting.oneLiner || meeting.transcript.length > 0) && (
                              <p className="text-sm text-mission-control-text-dim line-clamp-2 mt-2">
                                {meeting.oneLiner || meeting.transcript[0]?.slice(0, 150)}
                              </p>
                            )}
                            {(meeting.actionItems.length > 0 || meeting.tasksCreated.length > 0) && (
                              <Flex gap="2" className="mt-3">
                                {meeting.actionItems.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded-full">
                                    {meeting.actionItems.length} action items
                                  </span>
                                )}
                                {meeting.tasksCreated.length > 0 && (
                                  <span className="text-xs px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-full">
                                    {meeting.tasksCreated.length} tasks
                                  </span>
                                )}
                              </Flex>
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
                <h2 className="text-sm font-semibold text-mission-control-text mb-4">Transcribe Audio File</h2>
                <p className="text-mission-control-text-dim mb-6">
                  Upload an audio file (MP3, WAV, M4A) to transcribe using Gemini AI.
                </p>

                {!transcribing && !transcriptionResult && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8 text-center">
                    <Upload size={48} className="mx-auto mb-4 text-mission-control-text-dim opacity-30" />
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-mission-control-accent hover:bg-mission-control-accent/90 text-white rounded-lg cursor-pointer transition-colors">
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
                    <Flex align="center" gap="3" className="mb-4">
                      <Loader2 size={20} className="animate-spin text-mission-control-accent" />
                      <span className="font-medium text-mission-control-text">Transcribing audio...</span>
                    </Flex>
                    <div className="w-full h-3 bg-mission-control-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-mission-control-accent to-success rounded-full transition-colors duration-500"
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
                <h2 className="text-sm font-semibold text-mission-control-text mb-4">Upload Transcript</h2>
                <p className="text-mission-control-text-dim mb-6">
                  Upload a .txt or .md transcript file to generate a summary and extract action items.
                </p>

                {/* Upload error */}
                {uploadError && !transcribing && (
                  <div className="mb-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-2xl p-4 flex items-start gap-3">
                    <XCircle size={20} className="text-[var(--color-error)] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-[var(--color-error)]">Upload failed</p>
                      <p className="text-sm text-mission-control-text-dim mt-1">{uploadError}</p>
                    </div>
                    <button
                      onClick={() => setUploadError(null)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors ml-auto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* File picker + drag-drop zone */}
                {!transcribing && !transcriptionSaved && (
                  <div
                    onDrop={handleTranscriptDrop}
                    onDragOver={handleTranscriptDragOver}
                    onDragLeave={handleTranscriptDragLeave}
                    className={`bg-mission-control-surface border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                      uploadDragOver
                        ? 'border-mission-control-accent bg-mission-control-accent/5'
                        : 'border-mission-control-border hover:border-mission-control-text-dim'
                    }`}
                  >
                    <Upload size={48} className={`mx-auto mb-4 transition-colors ${
                      uploadDragOver ? 'text-mission-control-accent scale-110' : 'text-mission-control-text-dim opacity-30'
                    }`} />
                    <p className="text-mission-control-text font-medium mb-2">
                      {uploadDragOver ? 'Drop file here' : 'Drag & drop a transcript file'}
                    </p>
                    <p className="text-sm text-mission-control-text-dim mb-4">or</p>
                    <label className="inline-flex items-center gap-2 px-6 py-3 bg-mission-control-accent hover:bg-mission-control-accent/90 text-white rounded-lg cursor-pointer transition-colors">
                      <FileText size={18} />
                      Choose File
                      <input
                        type="file"
                        accept=".txt,.md"
                        onChange={handleTranscriptUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-mission-control-text-dim mt-4">
                      Supported: .txt, .md — Max 5MB
                    </p>
                  </div>
                )}

                {/* Progress bar during processing */}
                {transcribing && (
                  <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-8">
                    <Flex align="center" gap="3" className="mb-4">
                      <Loader2 size={20} className="animate-spin text-mission-control-accent" />
                      <span className="font-medium text-mission-control-text">Processing transcript...</span>
                    </Flex>
                    <div className="w-full h-3 bg-mission-control-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-mission-control-accent to-success rounded-full transition-colors duration-500"
                        style={{ width: `${Math.min(100, transcriptionProgress)}%` }}
                      />
                    </div>
                    <p className="text-sm text-mission-control-text-dim mt-2 text-right">
                      {Math.round(transcriptionProgress)}%
                    </p>
                  </div>
                )}

                {/* Results: Success card that navigates to meeting detail */}
                {transcriptionSaved && !transcribing && (
                  <div className="space-y-4">
                    {/* Success — navigate to meeting detail */}
                    <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-2xl p-5">
                      <Flex align="center" gap="3" className="mb-3">
                        <CheckCircle2 size={20} className="text-[var(--color-success)] shrink-0" />
                        <p className="font-medium text-[var(--color-success)]">Transcript processed</p>
                      </Flex>
                      <p className="text-sm text-mission-control-text-dim mb-4">
                        {uploadSummary ? 'AI summary generated' : 'Extractive summary created'}
                        {taskProposals.length > 0 && ` with ${taskProposals.length} proposed tasks`}
                        {uploadActionItems.length > 0 && ` and ${uploadActionItems.length} action items`}.
                        View the full meeting to review and approve tasks.
                      </p>
                      <Flex align="center" gap="2">
                        <Button
                          onClick={async () => {
                            await loadPastMeetings();
                            // Find the most recent meeting and select it
                            const meetings = await (async () => {
                              try {
                                const res = await fetch('/api/meetings?status=completed', { headers: { ...authHeaders() } });
                                if (!res.ok) return [];
                                return await res.json();
                              } catch { return []; }
                            })();
                            if (meetings.length > 0) {
                              // Find the one we just created by matching the most recent
                              const latest = meetings.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
                                ((b.createdAt as number) || 0) - ((a.createdAt as number) || 0)
                              )[0];
                              if (latest) {
                                let meta: Record<string, unknown> = {};
                                try { meta = typeof latest.metadata === 'string' ? JSON.parse(latest.metadata as string) : (latest.metadata || {}); } catch { /* */ }
                                const scheduledAt = (latest.scheduledAt as number) || Date.now();
                                setSelectedMeeting({
                                  id: latest.id as string,
                                  filename: (latest.title as string) || 'Untitled',
                                  filepath: (meta.filePath as string) || '',
                                  date: new Date(scheduledAt),
                                  time: new Date(scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                  title: latest.title as string,
                                  transcript: [],
                                  actionItems: [],
                                  tasksCreated: [],
                                  rawContent: (meta.summary as string) || (latest.description as string) || (latest.content as string) || '',
                                  oneLiner: meta.summary ? (latest.description as string) || '' : ((latest.description as string) || '').replace(/[#*_]/g, '').split(/[.!?\n]/)[0]?.trim().slice(0, 120) || '',
                                  source: 'db',
                                  summarySource: meta.summarySource as string | undefined,
                                  storedTaskProposals: Array.isArray(meta.taskProposals)
                                    ? (meta.taskProposals as PastMeetingTaskProposal[]).map((tp, i) => ({ ...tp, id: tp.id || `tp-${i}`, status: tp.status || 'pending' as const }))
                                    : undefined,
                                });
                              }
                            }
                            setActiveView('history');
                          }}
                          size="2"
                          variant="solid"
                         
                        >
                          View Meeting
                        </Button>
                        <Button
                          onClick={() => {
                            setTranscriptionSaved(false);
                            setTranscriptionResult('');
                            setUploadSummary(null);
                            setUploadActionItems([]);
                            setTaskProposals([]);
                            setUploadError(null);
                            setTasksCreatedCount(0);
                          }}
                          size="2"
                          variant="soft"
                          color="gray"
                        >
                          Upload Another
                        </Button>
                      </Flex>
                    </div>

                    {/* All detail content (summary, actions, proposals) now lives in meeting detail view */}

                  </div>
                )}

                {/* Recent uploads — shown as clickable cards */}
                {recentUploads.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Recently Uploaded</h3>
                    <div className="space-y-2">
                      {recentUploads.map(upload => (
                        <button
                          type="button"
                          key={upload.id}
                          onClick={() => {
                            setActiveView('history');
                            loadPastMeetings();
                          }}
                          className="w-full p-3 bg-mission-control-surface border border-mission-control-border rounded-xl flex items-center gap-3 hover:border-mission-control-accent/50 transition-colors text-left cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[var(--color-info)]/10 flex items-center justify-center shrink-0">
                            <FileText size={16} className="text-[var(--color-info)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-mission-control-text truncate">{upload.title}</p>
                            <p className="text-xs text-mission-control-text-dim">{upload.date} &middot; {upload.actionCount} action items &middot; {upload.summarySource}</p>
                          </div>
                          <ChevronRight size={14} className="text-mission-control-text-dim shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Post-result UI for transcribe view only (upload-transcript has its own result UI above) */}
            {activeView === 'transcribe' && transcriptionResult && !transcribing && (
              <div className="p-6 pt-0 max-w-2xl mx-auto">
                <div className="space-y-4">
                  {!transcriptionSaved ? (
                    <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-2xl p-6">
                      <Flex align="center" gap="2" className="mb-4">
                        <CheckCircle2 size={20} className="text-[var(--color-success)]" />
                        <span className="font-medium text-[var(--color-success)]">
                          {activeView === 'transcribe' ? 'Transcription Complete' : 'Text Extracted'}
                        </span>
                      </Flex>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-mission-control-text mb-1.5">Meeting Name</label>
                          <TextField.Root
                            value={transcriptionFileName}
                            onChange={(e) => setTranscriptionFileName(e.target.value)}
                            placeholder="Name this meeting..."
                            className="w-full"
                          />
                        </div>
                        <Flex gap="3">
                          <Button
                            onClick={saveTranscriptionAsMeeting}
                            disabled={transcriptionSaving}
                            size="2"
                            variant="solid"
                            className="flex-1"
                          >
                            {transcriptionSaving ? (
                              <><Loader2 size={18} className="animate-spin" /> Processing...</>
                            ) : (
                              <><Check size={18} /> Save to Meetings</>
                            )}
                          </Button>
                          <Button
                            onClick={async () => {
                              const success = await copyToClipboard(transcriptionResult);
                              if (!success) {
                                alert('Failed to copy transcription. Please copy manually.');
                              }
                            }}
                            size="2"
                            variant="soft"
                            color="gray"
                          >
                            Copy Text
                          </Button>
                        </Flex>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-2xl p-6 text-center">
                      <CheckCircle2 size={32} className="text-[var(--color-success)] mx-auto mb-3" />
                      <p className="font-medium text-[var(--color-success)] mb-1">Saved to Meetings</p>
                      <p className="text-sm text-mission-control-text-dim mb-4">
                        Summary and tasks have been generated. View in the Meetings tab.
                      </p>
                      <Flex gap="3" justify="center">
                        <Button
                          onClick={() => { setActiveView('history'); setTranscriptionResult(''); setTranscriptionSaved(false); }}
                          size="2"
                          variant="solid"
                         
                        >
                          View Meetings
                        </Button>
                        <Button
                          onClick={() => { setTranscriptionResult(''); setTranscriptionSaved(false); setTranscriptionProgress(0); }}
                          size="2"
                          variant="soft"
                          color="gray"
                        >
                          Upload Another
                        </Button>
                      </Flex>
                    </div>
                  )}

                  {/* Proposed Task Cards from Mission Control */}
                  {proposedTasks.length > 0 && (
                    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-mission-control-border flex items-center justify-between">
                        <Flex align="center" gap="2">
                          <Brain size={16} className="text-[var(--color-review)]" />
                          <h3 className="text-sm font-semibold text-mission-control-text">Task Cards from Mission Control</h3>
                          <span className="text-xs px-2 py-0.5 bg-mission-control-bg rounded-full text-mission-control-text-dim">
                            {proposedTasks.filter(t => t.status === 'pending').length} pending
                          </span>
                        </Flex>
                        <p className="text-xs text-mission-control-text-dim">Approve to add to Kanban</p>
                      </div>
                      <div className="divide-y divide-mission-control-border">
                        {proposedTasks.map((task) => (
                          <div
                            key={task.id}
                            className={`p-4 transition-colors ${
                              task.status === 'rejected' ? 'opacity-40' : ''
                            } ${task.status === 'approved' ? 'bg-[var(--color-success)]/10' : ''}`}
                          >
                            {editingProposedTask === task.id ? (
                              <div className="space-y-3">
                                <TextField.Root
                                  value={editingProposedText}
                                  onChange={(e) => setEditingProposedText(e.target.value)}
                                  placeholder="Edit task title..."
                                  className="w-full"
                                />
                                <Flex gap="2">
                                  <Button
                                    onClick={() => {
                                      setProposedTasks(prev => prev.map(t =>
                                        t.id === task.id ? { ...t, title: editingProposedText, status: 'approved' as const } : t
                                      ));
                                      approveProposedTask(task.id);
                                      setEditingProposedTask(null);
                                    }}
                                    size="1"
                                    variant="solid"
                                    color="green"
                                  >
                                    Save & Approve
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingProposedTask(null)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </Flex>
                              </div>
                            ) : (
                              <Flex align="start" justify="between" gap="4">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-mission-control-text">{task.title}</p>
                                  {task.description && (
                                    <p className="text-sm text-mission-control-text-dim mt-1">{task.description}</p>
                                  )}
                                  <Flex align="center" gap="2" className="mt-2">
                                    <span className="text-xs px-2 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full">
                                      {task.proposedAgent}
                                    </span>
                                    {task.status === 'approved' && (
                                      <span className="text-xs px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] rounded-full flex items-center gap-1">
                                        <Check size={10} /> Added to Kanban
                                      </span>
                                    )}
                                  </Flex>
                                </div>
                                {task.status === 'pending' && (
                                  <Flex align="center" gap="1" className="shrink-0">
                                    <button
                                      onClick={() => approveProposedTask(task.id)}
                                      title="Approve — add to Kanban"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingProposedTask(task.id);
                                        setEditingProposedText(task.title);
                                      }}
                                      title="Edit & Approve"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button
                                      onClick={() => rejectProposedTask(task.id)}
                                      title="Reject"
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-error)]/70 hover:text-[var(--color-error)] hover:bg-mission-control-surface transition-colors"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </Flex>
                                )}
                              </Flex>
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
    </Flex>
  );
}
