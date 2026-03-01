/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: MeetingTranscribe uses file-level suppression for intentional stable ref patterns.
// Complex meeting transcription component - patterns are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

/**
 * Meeting Transcription Component
 * Real-time meeting transcription UI with speaker labels using Gemini AI
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Play, Square, Download, Trash2, Clock,
  Users, Calendar, ChevronDown, ChevronUp, FileText, Upload, Loader2
} from 'lucide-react';
import { MeetingTranscriber, Meeting, MeetingTranscript, TranscriptionSegment } from '../lib/meetingTranscribe';
import { GeminiTranscriptionService } from '../lib/multiAgentVoice';
import MarkdownMessage from './MarkdownMessage';
import { showToast } from './Toast';

// API key loading — no hardcoded fallback; uses IPC to fetch from secure store
async function getApiKey(): Promise<string> {
  // 1. Try Vite env var first (from .env file)
  const viteKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
  if (viteKey && viteKey !== 'your_key_here') return viteKey;
  // 2. Try IPC to main process secret store
  try {
    const key = await window.clawdbot?.settings?.getApiKey?.('gemini');
    if (key) return key;
  } catch { /* ignore */ }
  // 3. Try localStorage
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey && storedKey !== 'your_key_here') return storedKey;
  // 4. Check localStorage settings
  try {
    const s = JSON.parse(localStorage.getItem('froggo-settings') || '{}');
    if (s.geminiApiKey) return s.geminiApiKey;
  } catch { /* ignore */ }
  throw new Error('Gemini API key not set. Configure it in Settings > API Keys.');
}

export default function MeetingTranscribe() {
  const [transcriber, setTranscriber] = useState<MeetingTranscriber | null>(null);
  const [initError, setInitError] = useState('');
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([]);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

  // Form state
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingParticipants, setNewMeetingParticipants] = useState('');

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audioStreamRef = useRef<MediaStream | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  // Initialize transcriber
  useEffect(() => {
    (async () => {
    try {
      const apiKey = await getApiKey();
      const t = new MeetingTranscriber(apiKey);
      // Set up real-time callback to push segments into state
      t.onTranscript((segment: TranscriptionSegment) => {
        setTranscripts(prev => [...prev, {
          meeting_id: '',
          speaker: segment.speaker,
          text: segment.text,
          timestamp: segment.timestamp
        }]);
      });
      setTranscriber(t);
    } catch (err: unknown) {
      setInitError(err instanceof Error ? err.message : String(err));
    }
    })();
  }, []);

  // Load meetings on mount
  useEffect(() => {
    if (!transcriber) return;
    loadMeetings();
    checkActiveMeeting();
  }, [transcriber]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Poll for new transcripts when viewing an ended meeting
  useEffect(() => {
    if (!selectedMeeting || !transcriber) return;
    // Only poll for active meetings (real-time callback handles live ones too,
    // but DB polling catches any we missed)
    if (selectedMeeting.status !== 'active') return;

    const interval = setInterval(() => {
      loadTranscripts(selectedMeeting.id);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedMeeting, transcriber]);

  async function loadMeetings() {
    if (!transcriber) return;
    const allMeetings = await transcriber.getAllMeetings();
    setMeetings(allMeetings);
  }

  async function checkActiveMeeting() {
    if (!transcriber) return;
    const active = await transcriber.getActiveMeeting();
    setActiveMeeting(active);
    if (active) {
      setSelectedMeeting(active);
      loadTranscripts(active.id);
    }
  }

  async function loadTranscripts(meetingId: string) {
    if (!transcriber) return;
    const meetingTranscripts = await transcriber.getMeetingTranscripts(meetingId);
    setTranscripts(meetingTranscripts);
  }

  async function startNewMeeting() {
    if (!transcriber) return;
    if (!newMeetingTitle.trim()) {
      showToast('warning', 'Please enter a meeting title');
      return;
    }

    const participants = newMeetingParticipants
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    try {
      const meeting = await transcriber.startMeeting(newMeetingTitle, participants);
      setActiveMeeting(meeting);
      setSelectedMeeting(meeting);
      setNewMeetingTitle('');
      setNewMeetingParticipants('');
      await loadMeetings();

      // Start recording immediately
      await startRecording(meeting.id);
    } catch (error) {
      // '[MeetingTranscribe] Failed to start meeting:', error;
      showToast('error', 'Failed to start meeting');
    }
  }

  async function startRecording(meetingId: string) {
    if (!transcriber) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      audioStreamRef.current = stream;
      await transcriber.startTranscription(meetingId, stream);
      setIsRecording(true);
    } catch (error) {
      // '[MeetingTranscribe] Failed to start recording:', error;
      showToast('error', 'Microphone access denied');
    }
  }

  async function stopRecording() {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setIsRecording(false);
  }

  async function endActiveMeeting() {
    if (!activeMeeting || !transcriber) return;

    await stopRecording();
    await transcriber.endMeeting(activeMeeting.id);
    setActiveMeeting(null);
    await loadMeetings();
  }

  async function viewMeeting(meeting: Meeting) {
    setSelectedMeeting(meeting);
    await loadTranscripts(meeting.id);
  }

  async function deleteMeeting(meetingId: string) {
    if (!transcriber) return;
    if (!confirm('Delete this meeting and all transcripts?')) return;

    await transcriber.deleteMeeting(meetingId);
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(null);
      setTranscripts([]);
    }
    await loadMeetings();
  }

  async function downloadTranscript(meetingId: string) {
    if (!transcriber) return;
    try {
      const transcript = await transcriber.exportTranscript(meetingId);
      const blob = new Blob([transcript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-transcript-${meetingId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // '[MeetingTranscribe] Failed to export transcript:', error;
      showToast('error', 'Failed to export transcript');
    }
  }

  function toggleMeetingExpanded(meetingId: string) {
    const newExpanded = new Set(expandedMeetings);
    if (newExpanded.has(meetingId)) {
      newExpanded.delete(meetingId);
    } else {
      newExpanded.add(meetingId);
    }
    setExpandedMeetings(newExpanded);
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !transcriber) return;

    setUploadError('');
    setIsUploading(true);

    try {
      const apiKey = await getApiKey();
      const service = new GeminiTranscriptionService(apiKey);
      const transcript = await service.transcribeAudio(file, file.type || 'audio/webm');

      // Create a meeting record for the uploaded file
      const title = `📎 ${file.name}`;
      const now = Date.now();

      // Save meeting to DB (started + ended immediately)
      await transcriber.startMeeting(title, []);
      // Get the meeting we just created (it'll be the active one)
      const active = await transcriber.getActiveMeeting();
      if (active) {
        // Save the full transcript as a single segment
        await transcriber.saveTranscript(active.id, 'Transcript', transcript);
        await transcriber.endMeeting(active.id);

        // Select and view it
        setSelectedMeeting({ ...active, status: 'ended', ended_at: now });
        await loadMeetings();
        await loadTranscripts(active.id);
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [transcriber]);

  function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-clawd-bg text-white p-8">
        <FileText className="w-16 h-16 mb-4 text-error opacity-50" />
        <p className="text-error text-sm mb-2">Failed to initialize</p>
        <p className="text-clawd-text-dim text-xs">{initError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-clawd-bg text-white">
      {/* API Key Warning */}
      {(!import.meta.env.VITE_GEMINI_API_KEY && !localStorage.getItem('gemini_api_key')) && (
        <div className="bg-warning-subtle border-b border-warning-border px-4 py-2 text-center">
          <p className="text-warning text-sm font-medium">
            ⚠️ Using fallback API key
          </p>
          <p className="text-warning text-xs mt-1">
            Set VITE_GEMINI_API_KEY in .env for production use
          </p>
        </div>
      )}
      
      {/* Header */}
      <div className="p-4 border-b border-clawd-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-review" />
            <h2 className="text-lg font-semibold">🐸 Meeting Transcription</h2>
          </div>
          {activeMeeting && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-error">Recording</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Meeting List */}
        <div className="w-80 flex-shrink-0 border-r border-clawd-border flex flex-col">
          {/* New Meeting Form */}
          <div className="p-4 border-b border-clawd-border">
            <h3 className="text-sm font-semibold mb-3">Start New Meeting</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Meeting title"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                disabled={!!activeMeeting}
                className="w-full px-3 py-2 bg-clawd-surface rounded border border-clawd-border focus:border-review-border outline-none text-sm disabled:opacity-50"
              />
              <input
                type="text"
                placeholder="Participants (comma-separated)"
                value={newMeetingParticipants}
                onChange={(e) => setNewMeetingParticipants(e.target.value)}
                disabled={!!activeMeeting}
                className="w-full px-3 py-2 bg-clawd-surface rounded border border-clawd-border focus:border-review-border outline-none text-sm disabled:opacity-50"
              />
              {!activeMeeting ? (
                <button
                  onClick={startNewMeeting}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Meeting</span>
                </button>
              ) : (
                <button
                  onClick={endActiveMeeting}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Square className="w-4 h-4" />
                  <span>End Meeting</span>
                </button>
              )}
            </div>
          </div>

          {/* Upload Recording */}
          <div className="p-4 border-b border-clawd-border">
            <h3 className="text-sm font-semibold mb-3">Upload Recording</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !!activeMeeting}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isUploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Transcribing...</span></>
              ) : (
                <><Upload className="w-4 h-4" /><span>Upload Recording</span></>
              )}
            </button>
            <p className="text-xs text-clawd-text-dim mt-1 text-center">MP3, WAV, WebM, M4A, OGG, video</p>
            {uploadError && (
              <div className="mt-2 p-2 bg-error-subtle text-error rounded text-xs">{uploadError}</div>
            )}
          </div>

          {/* Meeting List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <h3 className="text-xs font-semibold text-clawd-text-dim px-2 mb-2">Past Meetings</h3>
              {meetings.length === 0 ? (
                <div className="text-center py-8 text-clawd-text-dim text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No meetings yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {meetings.map((meeting) => {
                    const isExpanded = expandedMeetings.has(meeting.id);
                    const duration = meeting.ended_at
                      ? meeting.ended_at - meeting.started_at
                      : Date.now() - meeting.started_at;

                    return (
                      <div
                        key={meeting.id}
                        className={`rounded-lg border transition-colors ${
                          selectedMeeting?.id === meeting.id
                            ? 'bg-review-subtle border-purple-500'
                            : 'bg-clawd-surface border-clawd-border hover:border-clawd-border/80'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full p-3 cursor-pointer text-left"
                          onClick={() => viewMeeting(meeting)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{meeting.title}</div>
                              <div className="flex items-center space-x-2 text-xs text-clawd-text-dim mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(meeting.started_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMeetingExpanded(meeting.id);
                              }}
                              className="p-1 hover:bg-clawd-border rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center space-x-3 text-xs text-clawd-text-dim">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(duration)}</span>
                            </div>
                            {meeting.participants.length > 0 && (
                              <div className="flex items-center space-x-1">
                                <Users className="w-3 h-3" />
                                <span>{meeting.participants.length}</span>
                              </div>
                            )}
                            <div className={`px-2 py-0.5 rounded-full ${
                              meeting.status === 'active'
                                ? 'bg-error-subtle text-error'
                                : 'bg-clawd-border text-clawd-text-dim'
                            }`}>
                              {meeting.status}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-2 border-t border-clawd-border pt-2">
                            {meeting.participants.length > 0 && (
                              <div>
                                <div className="text-xs text-clawd-text-dim mb-1">Participants:</div>
                                <div className="text-xs text-clawd-text">
                                  {meeting.participants.join(', ')}
                                </div>
                              </div>
                            )}
                            <div className="flex space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadTranscript(meeting.id);
                                }}
                                className="flex-1 py-1 bg-clawd-border hover:bg-clawd-border/80 rounded text-xs font-medium transition-colors flex items-center justify-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Export</span>
                              </button>
                              {meeting.status === 'ended' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMeeting(meeting.id);
                                  }}
                                  className="flex-1 py-1 bg-error-subtle hover:bg-error-subtle text-error rounded text-xs font-medium transition-colors flex items-center justify-center space-x-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main - Transcript View */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedMeeting ? (
            <>
              {/* Meeting Header */}
              <div className="p-4 border-b border-clawd-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedMeeting.title}</h3>
                    <div className="flex items-center space-x-4 text-sm text-clawd-text-dim mt-1">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(selectedMeeting.started_at).toLocaleString()}</span>
                      </div>
                      {selectedMeeting.ended_at && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{formatDuration(selectedMeeting.ended_at - selectedMeeting.started_at)}</span>
                        </div>
                      )}
                      {selectedMeeting.participants.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>{selectedMeeting.participants.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedMeeting.status === 'active' && (
                    <div className="flex items-center space-x-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-2 ${
                        isRecording
                          ? 'bg-error-subtle text-error'
                          : 'bg-clawd-border text-clawd-text-dim'
                      }`}>
                        {isRecording ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                        <span>{isRecording ? 'Recording' : 'Paused'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Transcripts */}
              <div className="flex-1 overflow-y-auto p-4">
                {transcripts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
                    <FileText className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm">No transcripts yet</p>
                    {selectedMeeting.status === 'active' && (
                      <p className="text-xs mt-2">Start speaking to see transcription</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transcripts.map((transcript, idx) => (
                      <div key={transcript.id || idx} className="flex space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-review-subtle flex items-center justify-center">
                          <Users className="w-4 h-4 text-review" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 text-xs text-clawd-text-dim mb-1">
                            <span className="font-medium">{transcript.speaker}</span>
                            <span>•</span>
                            <span>{new Date(transcript.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="bg-clawd-surface rounded-lg px-4 py-2">
                            <MarkdownMessage content={transcript.text} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={transcriptsEndRef} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-sm">Select a meeting or start a new one</p>
              <p className="text-xs mt-2">Real-time transcription powered by Gemini AI</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
