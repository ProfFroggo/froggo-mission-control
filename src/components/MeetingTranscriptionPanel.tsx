import { useState, useRef, useCallback } from 'react';
import { Button, IconButton, Spinner, Flex } from '@radix-ui/themes';
import { FileAudio, Download, Trash2, Upload, Sparkles } from 'lucide-react';

interface TranscriptionResult {
  id: string;
  filename: string;
  transcript: string;
  summary?: {
    summary: string;
    actionItems: string[];
    keyDecisions: string[];
    participants: string[];
  };
  timestamp: number;
}

export default function MeetingTranscriptionPanel() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [summarizingIds, setSummarizingIds] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<TranscriptionResult[]>(() => {
    try {
      const saved = localStorage.getItem('mission-control-meeting-transcriptions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsTranscribing(true);

    try {
      // Transcribe via server-side proxy (API key never leaves server)
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('mimeType', file.type || 'audio/webm');
      const res = await fetch('/api/gemini/transcribe', { method: 'POST', body: formData });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Transcription failed' }));
        throw new Error(errBody.error || `Server error: ${res.status}`);
      }
      const { transcript } = await res.json();

      const result: TranscriptionResult = {
        id: crypto.randomUUID(),
        filename: file.name,
        transcript,
        timestamp: Date.now()
      };

      setResults(prev => {
        const updated = [result, ...prev];
        localStorage.setItem('mission-control-meeting-transcriptions', JSON.stringify(updated));
        return updated;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const summarize = useCallback(async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result) return;

    // Clear any previous error for this result before starting
    setErrors(prev => { const next = { ...prev }; delete next[resultId]; return next; });
    // Mark this result as in-flight
    setSummarizingIds(prev => new Set(prev).add(resultId));

    try {
      // Summarize via server-side proxy (API key never leaves server)
      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: result.transcript }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Summarization failed' }));
        throw new Error(errBody.error || `Server error: ${res.status}`);
      }
      const summary = await res.json();

      setResults(prev => {
        const updated = prev.map(r => r.id === resultId ? { ...r, summary } : r);
        localStorage.setItem('mission-control-meeting-transcriptions', JSON.stringify(updated));
        return updated;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Summarization failed';
      setErrors(prev => ({ ...prev, [resultId]: message }));
    } finally {
      setSummarizingIds(prev => { const next = new Set(prev); next.delete(resultId); return next; });
    }
  }, [results]);

  const deleteResult = useCallback((id: string) => {
    setResults(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('mission-control-meeting-transcriptions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const downloadTranscript = useCallback((result: TranscriptionResult) => {
    let content = `# Meeting Transcription: ${result.filename}\n`;
    content += `Date: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    content += `## Transcript\n${result.transcript}\n`;
    if (result.summary) {
      content += `\n## Summary\n${result.summary.summary}\n`;
      if (result.summary.actionItems.length) {
        content += `\n## Action Items\n${result.summary.actionItems.map(a => `- ${a}`).join('\n')}\n`;
      }
      if (result.summary.keyDecisions.length) {
        content += `\n## Key Decisions\n${result.summary.keyDecisions.map(d => `- ${d}`).join('\n')}\n`;
      }
    }
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${result.filename.replace(/\.[^.]+$/, '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg text-mission-control-text">
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center space-x-3">
          <FileAudio className="w-5 h-5 text-[--accent-11]" />
          <h2 className="text-lg font-semibold">Meeting Transcription</h2>
        </div>
        <span className="text-xs text-mission-control-text-dim">Powered by Gemini AI</span>
      </div>

      {/* Upload */}
      <div className="p-4 border-b border-mission-control-border">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isTranscribing}
          variant="solid"
          color="grass"
          size="3"
          className="w-full"
        >
          {isTranscribing ? (
            <><Spinner /><span>Transcribing...</span></>
          ) : (
            <><Upload className="w-5 h-5" /><span>Upload Audio for Transcription</span></>
          )}
        </Button>
        <p className="text-xs text-mission-control-text-dim mt-2 text-center">
          Supports MP3, WAV, WebM, M4A, OGG, and video files
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-error-subtle text-error rounded-lg text-sm">{error}</div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <FileAudio className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-sm">No transcriptions yet</p>
            <p className="text-xs mt-2">Upload a meeting recording to get started</p>
          </div>
        ) : (
          results.map(result => (
            <div key={result.id} className="bg-mission-control-surface rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{result.filename}</div>
                  <div className="text-xs text-mission-control-text-dim">{new Date(result.timestamp).toLocaleString()}</div>
                </div>
                <div className="flex items-center space-x-2">
                  {!result.summary && (
                    <IconButton
                      onClick={() => summarize(result.id)}
                      disabled={summarizingIds.has(result.id)}
                      variant="ghost"
                      color="violet"
                      size="2"
                      title="AI Summarize"
                    >
                      {summarizingIds.has(result.id) ? <Spinner /> : <Sparkles className="w-4 h-4" />}
                    </IconButton>
                  )}
                  <IconButton onClick={() => downloadTranscript(result)} variant="ghost" color="gray" size="2" title="Download">
                    <Download className="w-4 h-4" />
                  </IconButton>
                  <IconButton onClick={() => deleteResult(result.id)} variant="ghost" color="red" size="2" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              </div>

              <div className="text-sm text-mission-control-text max-h-40 overflow-y-auto whitespace-pre-wrap bg-mission-control-bg rounded p-3">
                {result.transcript}
              </div>

              {errors[result.id] && (
                <div className="p-2 bg-error-subtle text-error rounded text-xs">{errors[result.id]}</div>
              )}

              {result.summary && (
                <div className="space-y-2 border-t border-mission-control-border pt-3">
                  <div className="text-sm font-medium text-[--accent-11]">AI Summary</div>
                  <p className="text-sm text-mission-control-text">{result.summary.summary}</p>
                  {result.summary.actionItems.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-warning mb-1">Action Items</div>
                      <ul className="text-xs text-mission-control-text-dim space-y-1">
                        {result.summary.actionItems.map((item, i) => <li key={i}>- {item}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.summary.keyDecisions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-info mb-1">Key Decisions</div>
                      <ul className="text-xs text-mission-control-text-dim space-y-1">
                        {result.summary.keyDecisions.map((d, i) => <li key={i}>- {d}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Flex>
  );
}
