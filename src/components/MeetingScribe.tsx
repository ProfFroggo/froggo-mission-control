/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: MeetingScribe uses file-level suppression for intentional stable ref patterns.
// Complex real-time transcription component - patterns are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

/**
 * MeetingScribe - Real-time meeting transcription using Gemini API
 * Records mic audio in chunks, sends to Gemini for transcription,
 * displays live results, and saves transcripts with timestamps.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic, Square, Brain, ListTodo, FileText,
  Download, Send, Trash2, Clock, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button, Flex, Spinner } from '@radix-ui/themes';
import { useStore } from '../store/store';
import { gateway } from '../lib/gateway';
import { createLogger } from '../utils/logger';

const logger = createLogger('MeetingScribe');

// How often to send audio chunks for transcription (ms)
const CHUNK_INTERVAL_MS = 8000;

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  isProcessing?: boolean;
  isCleaned?: boolean;
}

interface ActionItem {
  type: 'task' | 'schedule' | 'message' | 'followup';
  text: string;
  timestamp: number;
}

interface MeetingSummary {
  savedPath: string | null;
  tasksCreated: number;
  extractedTasks: string[];
  duration: number;
}

// Task extraction patterns
const TASK_PATTERNS = [
  /action item[:\s]+(.+?)(?:\.|$)/gi,
  /todo[:\s]+(.+?)(?:\.|$)/gi,
  /(?:i|we)\s+(?:need to|have to|should|must)\s+(.+?)(?:\.|$)/gi,
  /(?:you|they)\s+(?:need to|should|must)\s+(.+?)(?:\.|$)/gi,
  /follow up (?:on|with)\s+(.+?)(?:\.|$)/gi,
  /don't forget (?:to\s+)?(.+?)(?:\.|$)/gi,
  /remember to\s+(.+?)(?:\.|$)/gi,
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function transcribeWithGemini(base64Audio: string, mimeType: string): Promise<string> {
  const { authHeaders } = await import('../lib/api');
  // Convert base64 to Blob for FormData upload
  const binaryStr = atob(base64Audio);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append('audio', blob, 'chunk.webm');
  formData.append('mimeType', mimeType);

  const response = await fetch('/api/gemini/transcribe', {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData,
  });
  if (!response.ok) throw new Error(`Transcription error: ${response.status}`);
  const data = await response.json();
  const text = (data.transcript || '').trim();
  return text
    .replace(/^(Here'?s?\s+)?the\s+transcri(pt|ption)[:\s]*/i, '')
    .replace(/^(Okay|OK|Sure)[,.\s]*/i, '')
    .trim();
}

function detectActionItems(text: string): ActionItem[] {
  const items: ActionItem[] = [];
  const now = Date.now();
  
  for (const pattern of TASK_PATTERNS) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1]?.trim();
      if (extracted && extracted.length > 3 && extracted.length < 200) {
        if (!items.some(i => i.text.toLowerCase() === extracted.toLowerCase())) {
          let type: ActionItem['type'] = 'task';
          if (/schedule|meeting|calendar/i.test(text)) type = 'schedule';
          else if (/message|email|send/i.test(text)) type = 'message';
          else if (/follow up/i.test(text)) type = 'followup';
          
          items.push({ type, text: extracted, timestamp: now });
        }
      }
    }
  }
  return items;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MeetingScribe() {
  const { setMeetingActive, addActivity } = useStore();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [_isPaused, setIsPaused] = useState(false);
  const [timer, setTimer] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Transcript state
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [processingChunk, setProcessingChunk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Post-meeting state
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [showActionItems, setShowActionItems] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isRecordingRef = useRef(false);
  const mimeTypeRef = useRef('audio/webm');
  
  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) stopRecording(true);
    };
  }, []);

  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) return; // Skip tiny chunks
    
    const entryId = crypto.randomUUID();
    const timestamp = Date.now();
    
    // Add placeholder
    setEntries(prev => [...prev, { id: entryId, text: '...', timestamp, isProcessing: true }]);
    setProcessingChunk(true);
    
    try {
      const base64 = await blobToBase64(audioBlob);
      const transcript = await transcribeWithGemini(base64, mimeTypeRef.current);
      
      if (transcript && transcript.length > 0) {
        setEntries(prev => prev.map(e => 
          e.id === entryId 
            ? { ...e, text: transcript, isProcessing: false, isCleaned: true }
            : e
        ));
        
        // Detect action items
        const items = detectActionItems(transcript);
        if (items.length > 0) {
          setActionItems(prev => [...prev, ...items]);
        }
      } else {
        // Remove empty placeholder
        setEntries(prev => prev.filter(e => e.id !== entryId));
      }
    } catch (err: unknown) {
      // '[Scribe] Transcription error:', err;
      setEntries(prev => prev.map(e =>
        e.id === entryId
          ? { ...e, text: `[Transcription failed: ${err instanceof Error ? err.message : String(err)}]`, isProcessing: false }
          : e
      ));
    } finally {
      setProcessingChunk(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setSummary(null);
    setAiSummary(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      });
      streamRef.current = stream;
      
      // Audio level visualization
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const updateLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 255);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      // Determine best mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      mimeTypeRef.current = mimeType;
      
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      recorder.start(1000); // Collect in 1s chunks
      
      isRecordingRef.current = true;
      setIsRecording(true);
      setIsPaused(false);
      setMeetingActive(true);
      setEntries([]);
      setActionItems([]);
      setTimer(0);
      
      // Timer
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
      
      // Audio level animation
      animFrameRef.current = requestAnimationFrame(updateLevel);
      
      // Periodic chunk processing
      chunkIntervalRef.current = setInterval(async () => {
        if (!isRecordingRef.current || !mediaRecorderRef.current) return;
        
        // Stop current recorder, process chunks, start new one
        const currentChunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        
        if (currentChunks.length > 0) {
          const blob = new Blob(currentChunks, { type: mimeType });
          processAudioChunk(blob);
        }
        
        // Restart recorder for next chunk
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          
          // Small delay then restart
          await new Promise(r => setTimeout(r, 100));
          if (isRecordingRef.current && streamRef.current) {
            const newRecorder = new MediaRecorder(streamRef.current, { mimeType });
            mediaRecorderRef.current = newRecorder;
            audioChunksRef.current = [];
            newRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            newRecorder.start(1000);
          }
        }
      }, CHUNK_INTERVAL_MS);
      
      addActivity({ type: 'system', message: 'Meeting scribe started (Gemini)', timestamp: Date.now() });
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
      isRecordingRef.current = false;
      setIsRecording(false);
      // Clean up any partially-created resources
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    }
  }, [setMeetingActive, addActivity, processAudioChunk]);

  const stopRecording = useCallback(async (silent = false) => {
    isRecordingRef.current = false;
    
    // Stop intervals
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    
    // Process remaining audio
    const remainingChunks = [...audioChunksRef.current];
    audioChunksRef.current = [];
    
    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    
    // Stop mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch((err) => { logger.error('Failed to close audio context:', err); });
      audioCtxRef.current = null;
    }
    
    setIsRecording(false);
    setAudioLevel(0);
    setMeetingActive(false);
    
    // Process final chunk
    if (remainingChunks.length > 0) {
      const blob = new Blob(remainingChunks, { type: mimeTypeRef.current });
      if (blob.size > 1000) {
        await processAudioChunk(blob);
      }
    }
    
    if (!silent) {
      // Save meeting
      const finalEntries = entries.filter(e => !e.isProcessing && e.text !== '...');
      if (finalEntries.length > 0) {
        const saved = await saveMeeting(finalEntries, actionItems, timer);
        setSummary(saved);
        addActivity({
          type: 'system',
          message: `Meeting ended: ${saved.savedPath ? 'transcript saved' : 'no save'} ${saved.tasksCreated > 0 ? `+ ${saved.tasksCreated} tasks` : ''}`,
          timestamp: Date.now(),
        });
      }
    }
  }, [entries, actionItems, timer, setMeetingActive, addActivity, processAudioChunk]);

  const saveMeeting = useCallback(async (
    transcriptEntries: TranscriptEntry[],
    items: ActionItem[],
    duration: number
  ): Promise<MeetingSummary> => {
    const result: MeetingSummary = { savedPath: null, tasksCreated: 0, extractedTasks: [], duration };
    
    // File save not available in web mode — generate downloadable blob instead
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const filename = `${dateStr}-${timeStr}.md`;

    const lines = [
      `# Meeting Notes - ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      `**Time:** ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      `**Duration:** ${formatDuration(duration)}`,
      `**Transcription:** Gemini (server-proxied)`,
      '',
      '## Transcript',
      '',
      ...transcriptEntries.map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `> **[${time}]** ${e.text}`;
      }),
      '',
    ];

    if (items.length > 0) {
      lines.push('## Action Items Detected', '');
      items.forEach(item => {
        lines.push(`- [ ] **[${item.type}]** ${item.text}`);
      });
      lines.push('');
    }

    lines.push('---', '*Generated by Meeting Scribe (Gemini)*');

    const content = lines.join('\n');

    try {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      result.savedPath = filename;
    } catch {
      // Save error — non-critical
    }

    return result;
  }, []);

  const generateAiSummary = useCallback(async () => {
    const transcriptText = entries
      .filter(e => !e.isProcessing && e.text !== '...')
      .map(e => e.text)
      .join('\n');
    
    if (!transcriptText) return;
    
    setIsSummarizing(true);
    try {
      const prompt = `Summarize this meeting transcript concisely. Include:
1. **Key Topics** discussed
2. **Decisions** made
3. **Action Items** with owners if mentioned
4. **Next Steps**

Transcript:
${transcriptText}`;

      const { authHeaders } = await import('../lib/api');
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }], role: 'user' }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
      const data = await res.json();

      const summaryText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (summaryText) setAiSummary(summaryText);
    } catch (err) {
      // '[Scribe] Summary error:', err;
    } finally {
      setIsSummarizing(false);
    }
  }, [entries]);

  const sendToMissionControl = useCallback(async () => {
    const transcriptText = entries
      .filter(e => !e.isProcessing)
      .map(e => e.text)
      .join('\n');
    
    if (!transcriptText) return;
    
    const message = [
      '**Meeting Summary:**',
      '',
      transcriptText,
      '',
      actionItems.length > 0 ? '**Detected Action Items:**' : '',
      ...actionItems.map(a => `- [${a.type}] ${a.text}`),
      '',
      'Please organize these notes and confirm any action items I should follow up on.',
    ].filter(Boolean).join('\n');
    
    try {
      await gateway.sendChat(message);
    } catch (err) {
      // '[Scribe] Failed to send to Mission Control:', err;
    }
  }, [entries, actionItems]);

  const exportMarkdown = useCallback(() => {
    const transcriptText = entries
      .filter(e => !e.isProcessing)
      .map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        return `[${time}] ${e.text}`;
      })
      .join('\n');
    
    let content = `# Meeting Transcript\n\nDate: ${new Date().toLocaleString()}\nDuration: ${formatDuration(timer)}\n\n## Transcript\n\n${transcriptText}`;
    
    if (aiSummary) {
      content += `\n\n## AI Summary\n\n${aiSummary}`;
    }
    
    if (actionItems.length > 0) {
      content += `\n\n## Action Items\n\n${actionItems.map(a => `- [${a.type}] ${a.text}`).join('\n')}`;
    }
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, actionItems, aiSummary, timer]);

  const clearAll = useCallback(() => {
    setEntries([]);
    setActionItems([]);
    setSummary(null);
    setAiSummary(null);
    setTimer(0);
  }, []);

  const hasTranscript = entries.some(e => !e.isProcessing && e.text !== '...');

  return (
    <div className="flex-1 overflow-hidden flex text-left">
      {/* Left: Recording Controls & Live Transcript */}
      <div className="w-96 border-r border-mission-control-border flex flex-col">
        {/* Record Button */}
        <div className="p-6 border-b border-mission-control-border">
          {isRecording ? (
            <Button
              onClick={() => stopRecording()}
              variant="solid"
              color="red"
              size="3"
              className="w-full py-5 text-lg font-bold"
            >
              <Square size={24} />
              Stop Recording
            </Button>
          ) : (
            <Button
              onClick={startRecording}
              variant="solid"
              color="grass"
              size="3"
              className="w-full py-5 text-lg font-bold"
            >
              <Mic size={24} />
              Start Meeting Scribe
            </Button>
          )}
          
          {/* Recording info */}
          {isRecording && (
            <Flex align="center" justify="between" className="mt-4">
              <Flex align="center" gap="2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-error" />
                </span>
                <span className="text-sm text-error font-medium">Recording</span>
              </Flex>
              <span className="font-mono text-base tabular-nums text-mission-control-text">{formatDuration(timer)}</span>
              {/* Audio level bar */}
              <div className="w-20 h-1.5 bg-mission-control-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-mission-control-accent rounded-full transition-[width] duration-75"
                  style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
                />
              </div>
            </Flex>
          )}
          
          {processingChunk && (
            <Flex align="center" gap="1" className="mt-2 text-xs text-mission-control-text-dim">
              <Spinner size="1" />
              Transcribing chunk...
            </Flex>
          )}
          
          {error && (
            <div className="mt-3 p-2 bg-error/10 border border-error/30 rounded text-sm text-error">
              {error}
            </div>
          )}
          
          <p className="text-xs text-mission-control-text-dim mt-3 text-center">
            Powered by Gemini • Audio sent in {CHUNK_INTERVAL_MS / 1000}s chunks
          </p>
        </div>
        
        {/* Live Transcript */}
        <div className="flex-1 overflow-y-auto p-4">
          <Flex align="center" gap="2" className="mb-3">
            <Brain size={16} className="text-[--accent-11]" />
            <span className="font-medium text-sm">Live Transcript</span>
            {entries.length > 0 && (
              <span className="text-xs text-mission-control-text-dim">({entries.filter(e => !e.isProcessing).length} segments)</span>
            )}
          </Flex>
          
          {entries.length === 0 ? (
            <div className="text-mission-control-text-dim text-sm text-center py-12">
              <Mic size={32} className="mx-auto mb-3 opacity-30" />
              <p>{isRecording ? 'Listening... transcript will appear here' : 'Start recording to begin transcription'}</p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    entry.isProcessing
                      ? 'bg-mission-control-surface border-mission-control-border/50 text-mission-control-text-dim animate-pulse'
                      : 'bg-mission-control-surface border-mission-control-border text-mission-control-text'
                  }`}
                >
                  <Flex align="start" justify="between" gap="2">
                    <p className="flex-1 leading-relaxed">{entry.text}</p>
                    <span className="text-[11px] tabular-nums text-mission-control-text-dim/70 shrink-0 mt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Flex>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
        
        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="border-t border-mission-control-border p-4">
            <button
              onClick={() => setShowActionItems(!showActionItems)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors mb-2 w-full justify-start"
            >
              <ListTodo size={16} />
              Action Items ({actionItems.length})
              {showActionItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showActionItems && (
              <ul className="space-y-1.5 text-xs max-h-32 overflow-y-auto">
                {actionItems.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-mission-control-surface border border-mission-control-border px-2.5 py-1.5">
                    <span className="px-1.5 py-0.5 bg-warning/10 rounded-full text-warning text-[10px] font-medium shrink-0 uppercase tracking-wide">
                      {item.type}
                    </span>
                    <span className="text-mission-control-text/70 truncate">{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      
      {/* Right: Summary & Actions */}
      <div className="flex-1 flex flex-col">
        {summary ? (
          /* Post-meeting summary */
          <div className="flex-1 overflow-y-auto p-6">
            <Flex align="center" gap="2" className="mb-6">
              <FileText size={20} className="text-[--accent-11]" />
              <h3 className="text-lg font-medium">Meeting Complete</h3>
              <span className="text-sm text-mission-control-text-dim">({formatDuration(summary.duration)})</span>
            </Flex>
            
            {summary.savedPath && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-success">Notes saved</p>
                <p className="text-xs text-mission-control-text-dim mt-1">{summary.savedPath.split('/').pop()}</p>
              </div>
            )}
            
            {/* AI Summary */}
            {aiSummary ? (
              <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 mb-4">
                <Flex align="center" gap="2" className="mb-2">
                  <Sparkles size={16} className="text-review" />
                  <span className="text-sm font-medium text-review">AI Summary</span>
                </Flex>
                <div className="text-sm text-mission-control-text whitespace-pre-wrap">{aiSummary}</div>
              </div>
            ) : (
              <Button
                onClick={generateAiSummary}
                disabled={isSummarizing || !hasTranscript}
                variant="soft"
                color="violet"
                size="2"
                className="w-full mb-4"
              >
                {isSummarizing ? (
                  <><Spinner /> Generating summary...</>
                ) : (
                  <><Sparkles size={16} /> Generate AI Summary</>
                )}
              </Button>
            )}
            
            {/* Action buttons */}
            <Flex gap="2" className="mb-6">
              <Button
                onClick={sendToMissionControl}
                disabled={!hasTranscript}
                variant="solid"
                color="violet"
                size="2"
                className="flex-1"
              >
                <Send size={14} /> Send to Mission Control
              </Button>
              <Button
                onClick={exportMarkdown}
                disabled={!hasTranscript}
                variant="soft"
                color="gray"
                size="2"
                className="flex-1"
              >
                <Download size={14} /> Export
              </Button>
            </Flex>
            
            {/* Full transcript review */}
            <div>
              <h4 className="text-sm font-medium text-mission-control-text-dim mb-2">Full Transcript</h4>
              <div className="space-y-1 text-sm max-h-64 overflow-y-auto">
                {entries.filter(e => !e.isProcessing).map(entry => (
                  <p key={entry.id} className="text-mission-control-text-dim">
                    <span className="text-xs text-mission-control-text-dim/70 mr-1">
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {entry.text}
                  </p>
                ))}
              </div>
            </div>
            
            {/* Clear */}
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-error/70 hover:text-error hover:bg-mission-control-surface transition-colors mt-6"
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>
        ) : !isRecording && !hasTranscript ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center text-mission-control-text-dim">
            <div className="text-center">
              <Mic size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">Meeting Scribe</p>
              <p className="text-sm">Real-time meeting transcription powered by Gemini</p>
              <p className="text-xs mt-4 max-w-sm mx-auto">
                Start recording to capture meeting audio. Transcription happens in real-time
                with automatic action item detection.
              </p>
            </div>
          </div>
        ) : (
          /* During recording - show larger live view */
          <div className="flex-1 flex flex-col p-6">
            <Flex align="center" gap="2" className="mb-4">
              <Clock size={16} className="text-mission-control-text-dim" />
              <span className="text-sm text-mission-control-text-dim">Recording in progress • {formatDuration(timer)}</span>
            </Flex>
            
            <div className="flex-1 overflow-y-auto space-y-2.5">
              {entries.filter(e => !e.isProcessing).map(entry => (
                <div key={entry.id} className="bg-mission-control-surface border border-mission-control-border rounded-xl px-4 py-3">
                  <Flex align="start" justify="between" gap="3">
                    <p className="text-mission-control-text leading-relaxed">{entry.text}</p>
                    <span className="text-[11px] tabular-nums text-mission-control-text-dim/70 shrink-0 mt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Flex>
                </div>
              ))}
              {processingChunk && (
                <Flex align="center" gap="2" className="text-mission-control-text-dim text-sm px-4">
                  <Spinner size="1" />
                  Transcribing...
                </Flex>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
