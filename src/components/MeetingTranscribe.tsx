/* eslint-disable react-hooks/exhaustive-deps */
/**
 * Meeting Transcription Component
 * Real-time transcription via browser Web Speech API.
 * End-of-meeting notes generated via Gemini REST API (optional, not required to record).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Play, Square, Download, Trash2, Clock,
  Users, Calendar, ChevronDown, ChevronUp, FileText, Upload,
  Loader2, Sparkles
} from 'lucide-react';
import { MeetingTranscriber, Meeting, MeetingTranscript, MeetingSummary } from '../lib/meetingTranscribe';
import { GeminiTranscriptionService } from '../lib/multiAgentVoice';
import MarkdownMessage from './MarkdownMessage';
import { showToast } from './Toast';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { settingsApi } = await import('../lib/api');
    const result = await settingsApi.get('gemini_api_key');
    return result?.value ?? null;
  } catch {
    return null;
  }
}

// Singleton transcriber — no API key required for recording
const transcriber = new MeetingTranscriber();

export default function MeetingTranscribe() {
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([]);
  const [interimText, setInterimText] = useState('');
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [summarising, setSummarising] = useState(false);

  // Form state
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingParticipants, setNewMeetingParticipants] = useState('');

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  // Wire up real-time callback
  useEffect(() => {
    transcriber.onTranscript((segment) => {
      if (segment.text.endsWith('…')) {
        // Interim result — show as typing indicator, don't persist
        setInterimText(segment.text.slice(0, -1));
      } else {
        setInterimText('');
        setTranscripts(prev => [...prev, {
          meeting_id: '',
          speaker: segment.speaker,
          text: segment.text,
          timestamp: segment.timestamp,
        }]);
      }
    });
    loadMeetings();
    checkActiveMeeting();
    return () => transcriber.cleanup();
  }, []);

  // Auto-scroll
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, interimText]);

  async function loadMeetings() {
    const all = await transcriber.getAllMeetings();
    setMeetings(all);
  }

  async function checkActiveMeeting() {
    const active = await transcriber.getActiveMeeting();
    setActiveMeeting(active);
    if (active) {
      setSelectedMeeting(active);
      loadTranscripts(active.id);
    }
  }

  async function loadTranscripts(meetingId: string) {
    const rows = await transcriber.getMeetingTranscripts(meetingId);
    setTranscripts(rows);
  }

  async function startNewMeeting() {
    if (!newMeetingTitle.trim()) {
      showToast('warning', 'Please enter a meeting title');
      return;
    }
    const participants = newMeetingParticipants.split(',').map(p => p.trim()).filter(Boolean);
    try {
      const meeting = await transcriber.startMeeting(newMeetingTitle, participants);
      setActiveMeeting(meeting);
      setSelectedMeeting(meeting);
      setTranscripts([]);
      setSummary(null);
      setNewMeetingTitle('');
      setNewMeetingParticipants('');
      await loadMeetings();
      await startRecording(meeting.id);
    } catch (err) {
      showToast('error', 'Failed to start meeting', (err as Error).message);
    }
  }

  async function startRecording(meetingId: string) {
    try {
      // Web Speech API handles mic permission internally when .start() is called
      await transcriber.startTranscription(meetingId);
      setIsRecording(true);
    } catch (err) {
      showToast('error', 'Could not start transcription', (err as Error).message);
    }
  }

  async function endActiveMeeting() {
    if (!activeMeeting) return;

    await transcriber.endMeeting(activeMeeting.id);
    setIsRecording(false);
    setInterimText('');

    // Reload final transcripts
    const rows = await transcriber.getMeetingTranscripts(activeMeeting.id);
    setTranscripts(rows);

    const endedMeeting = { ...activeMeeting, status: 'ended' as const, ended_at: Date.now() };
    setSelectedMeeting(endedMeeting);
    setActiveMeeting(null);
    await loadMeetings();

    // Summarise with Gemini REST if key is available
    if (rows.length > 0) {
      setSummarising(true);
      try {
        const key = await getGeminiKey();
        if (key) {
          transcriber.setApiKey(key);
          const result = await transcriber.summariseMeeting(activeMeeting.id);
          setSummary(result);
        }
      } catch { /* summarisation is optional */ }
      finally { setSummarising(false); }
    }
  }

  async function viewMeeting(meeting: Meeting) {
    setSelectedMeeting(meeting);
    setSummary(null);
    await loadTranscripts(meeting.id);
  }

  async function deleteMeeting(meetingId: string) {
    if (!confirm('Delete this meeting and all transcripts?')) return;
    await transcriber.deleteMeeting(meetingId);
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(null);
      setTranscripts([]);
      setSummary(null);
    }
    await loadMeetings();
  }

  async function downloadTranscript(meetingId: string) {
    try {
      const text = await transcriber.exportTranscript(meetingId);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${meetingId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Failed to export transcript');
    }
  }

  function toggleExpanded(meetingId: string) {
    setExpandedMeetings(prev => {
      const next = new Set(prev);
      next.has(meetingId) ? next.delete(meetingId) : next.add(meetingId);
      return next;
    });
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setIsUploading(true);

    try {
      const key = await getGeminiKey();
      if (!key) throw new Error('Gemini API key not set. Add it in Settings > API Keys.');
      const service = new GeminiTranscriptionService(key);
      const transcript = await service.transcribeAudio(file, file.type || 'audio/webm');

      const meeting = await transcriber.startMeeting(`Upload: ${file.name}`, []);
      await transcriber.saveTranscript(meeting.id, 'Transcript', transcript);
      await transcriber.endMeeting(meeting.id);

      await loadMeetings();
      await viewMeeting({ ...meeting, status: 'ended', ended_at: Date.now() });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg text-white">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-review" />
            <h2 className="text-lg font-semibold">Meeting Transcription</h2>
            <span className="text-xs text-mission-control-text-dim px-2 py-0.5 bg-mission-control-surface rounded-full border border-mission-control-border">
              Web Speech API
            </span>
          </div>
          {activeMeeting && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-error font-medium">Recording</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-mission-control-border flex flex-col">
          {/* New Meeting Form */}
          <div className="p-4 border-b border-mission-control-border space-y-2">
            <h3 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-2">New Meeting</h3>
            <input
              type="text"
              placeholder="Meeting title"
              value={newMeetingTitle}
              onChange={e => setNewMeetingTitle(e.target.value)}
              disabled={!!activeMeeting}
              onKeyDown={e => e.key === 'Enter' && !activeMeeting && startNewMeeting()}
              className="w-full px-3 py-2 bg-mission-control-surface rounded-lg border border-mission-control-border focus:border-review-border outline-none text-sm disabled:opacity-50"
            />
            <input
              type="text"
              placeholder="Participants (comma-separated)"
              value={newMeetingParticipants}
              onChange={e => setNewMeetingParticipants(e.target.value)}
              disabled={!!activeMeeting}
              className="w-full px-3 py-2 bg-mission-control-surface rounded-lg border border-mission-control-border focus:border-review-border outline-none text-sm disabled:opacity-50"
            />
            {!activeMeeting ? (
              <button onClick={startNewMeeting}
                className="w-full py-2 bg-review hover:bg-review/80 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Start Meeting
              </button>
            ) : (
              <button onClick={endActiveMeeting}
                className="w-full py-2 bg-error hover:bg-error/80 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Square className="w-4 h-4" /> End Meeting
              </button>
            )}
          </div>

          {/* Upload */}
          <div className="p-4 border-b border-mission-control-border">
            <input ref={fileInputRef} type="file" accept="audio/*,video/*" onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !!activeMeeting}
              className="w-full py-2 bg-success hover:bg-success/80 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" />Transcribing…</> : <><Upload className="w-4 h-4" />Upload Recording</>}
            </button>
            <p className="text-[11px] text-mission-control-text-dim mt-1 text-center">Requires Gemini API key · MP3, WAV, WebM, M4A</p>
            {uploadError && <div className="mt-2 p-2 bg-error-subtle text-error rounded-lg text-xs">{uploadError}</div>}
          </div>

          {/* Meeting List */}
          <div className="flex-1 overflow-y-auto p-2">
            <h3 className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide px-2 mb-2">Past Meetings</h3>
            {meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-mission-control-text-dim">
                <FileText className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">No meetings yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {meetings.map(meeting => {
                  const isExpanded = expandedMeetings.has(meeting.id);
                  const duration = (meeting.ended_at ?? Date.now()) - meeting.started_at;
                  return (
                    <div key={meeting.id}
                      className={`rounded-lg border transition-colors ${selectedMeeting?.id === meeting.id ? 'bg-review-subtle border-review-border' : 'bg-mission-control-surface border-mission-control-border hover:border-mission-control-border/80'}`}>
                      <button type="button" onClick={() => viewMeeting(meeting)} className="w-full p-3 text-left">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 mr-2">
                            <p className="font-medium text-sm truncate">{meeting.title}</p>
                            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(meeting.started_at).toLocaleDateString()}</span>
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(duration)}</span>
                            </div>
                          </div>
                          <button type="button" onClick={e => { e.stopPropagation(); toggleExpanded(meeting.id); }}
                            className="p-1 hover:bg-mission-control-border rounded flex-shrink-0">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                        {meeting.status === 'active' && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-error-subtle text-error rounded-full">Live</span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 flex gap-2 border-t border-mission-control-border pt-2">
                          <button type="button" onClick={e => { e.stopPropagation(); downloadTranscript(meeting.id); }}
                            className="flex-1 py-1 bg-mission-control-border hover:bg-mission-control-border/80 rounded text-xs font-medium flex items-center justify-center gap-1">
                            <Download className="w-3 h-3" /> Export
                          </button>
                          {meeting.status === 'ended' && (
                            <button type="button" onClick={e => { e.stopPropagation(); deleteMeeting(meeting.id); }}
                              className="flex-1 py-1 bg-error-subtle text-error hover:brightness-110 rounded text-xs font-medium flex items-center justify-center gap-1">
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main — Transcript + Summary */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {selectedMeeting ? (
            <>
              {/* Meeting header */}
              <div className="p-4 border-b border-mission-control-border flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">{selectedMeeting.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mt-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(selectedMeeting.started_at).toLocaleString()}</span>
                    {selectedMeeting.ended_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(selectedMeeting.ended_at - selectedMeeting.started_at)}</span>}
                    {selectedMeeting.participants.length > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedMeeting.participants.join(', ')}</span>}
                  </div>
                </div>
                {selectedMeeting.status === 'active' && (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isRecording ? 'bg-error-subtle text-error' : 'bg-mission-control-border text-mission-control-text-dim'}`}>
                    {isRecording ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    {isRecording ? 'Listening' : 'Paused'}
                  </div>
                )}
              </div>

              {/* AI Summary (shown after meeting ends) */}
              {summarising && (
                <div className="mx-4 mt-4 p-4 rounded-xl bg-review-subtle border border-review-border flex items-center gap-3 text-sm text-review">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  Generating meeting notes with Gemini…
                </div>
              )}
              {summary && !summarising && (
                <div className="mx-4 mt-4 p-4 rounded-xl bg-review-subtle border border-review-border space-y-3">
                  <div className="flex items-center gap-2 text-review font-semibold text-sm">
                    <Sparkles className="w-4 h-4" /> Meeting Notes
                  </div>
                  <p className="text-sm text-mission-control-text">{summary.summary}</p>
                  {summary.actionItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-1">Action Items</p>
                      <ul className="space-y-1">
                        {summary.actionItems.map((item, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-review mt-0.5">•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {summary.decisions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide mb-1">Decisions</p>
                      <ul className="space-y-1">
                        {summary.decisions.map((d, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-success mt-0.5">✓</span>{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript */}
              <div className="flex-1 overflow-y-auto p-4">
                {transcripts.length === 0 && !interimText ? (
                  <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
                    <Mic className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Start speaking — transcription appears here in real-time</p>
                    <p className="text-xs mt-1 opacity-60">No API key required · powered by Web Speech API</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transcripts.map((t, idx) => (
                      <div key={t.id ?? idx} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-review-subtle flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-review" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-[11px] text-mission-control-text-dim mb-1">
                            <span className="font-medium">{t.speaker}</span>
                            <span>·</span>
                            <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="bg-mission-control-surface rounded-lg px-3 py-2 text-sm">
                            <MarkdownMessage content={t.text} />
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Interim typing indicator */}
                    {interimText && (
                      <div className="flex gap-3 opacity-50">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-review-subtle flex items-center justify-center">
                          <Mic className="w-3.5 h-3.5 text-review animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[11px] text-mission-control-text-dim mb-1">You · now</div>
                          <div className="bg-mission-control-surface rounded-lg px-3 py-2 text-sm italic text-mission-control-text-dim">
                            {interimText}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={transcriptsEndRef} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
              <Mic className="w-14 h-14 mb-4 opacity-20" />
              <p className="text-sm">Start a meeting or select one from the list</p>
              <p className="text-xs mt-1 opacity-60">Live transcription · no API key needed to record</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
