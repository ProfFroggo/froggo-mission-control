import { useState, useRef, useCallback } from 'react';
import { FileAudio, Loader2, Download, Trash2, Upload, Sparkles } from 'lucide-react';
import { GeminiTranscriptionService } from '../lib/multiAgentVoice';

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
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [results, setResults] = useState<TranscriptionResult[]>(() => {
    try {
      const saved = localStorage.getItem('froggo-meeting-transcriptions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getService = useCallback(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    if (!apiKey || apiKey === 'your_key_here') {
      throw new Error('Gemini API key not set. Configure it in Voice Settings.');
    }
    return new GeminiTranscriptionService(apiKey);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsTranscribing(true);

    try {
      const service = getService();
      const transcript = await service.transcribeAudio(file, file.type || 'audio/webm');

      const result: TranscriptionResult = {
        id: crypto.randomUUID(),
        filename: file.name,
        transcript,
        timestamp: Date.now()
      };

      setResults(prev => {
        const updated = [result, ...prev];
        localStorage.setItem('froggo-meeting-transcriptions', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'Transcription failed');
    } finally {
      setIsTranscribing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [getService]);

  const summarize = useCallback(async (resultId: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result) return;

    setIsSummarizing(true);
    setError('');

    try {
      const service = getService();
      const summary = await service.summarizeMeeting(result.transcript);

      setResults(prev => {
        const updated = prev.map(r => r.id === resultId ? { ...r, summary } : r);
        localStorage.setItem('froggo-meeting-transcriptions', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'Summarization failed');
    } finally {
      setIsSummarizing(false);
    }
  }, [results, getService]);

  const deleteResult = useCallback((id: string) => {
    setResults(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('froggo-meeting-transcriptions', JSON.stringify(updated));
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
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <FileAudio className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">🐸 Meeting Transcription</h2>
        </div>
        <span className="text-xs text-gray-500">Powered by Gemini AI</span>
      </div>

      {/* Upload */}
      <div className="p-4 border-b border-gray-700">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isTranscribing}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {isTranscribing ? (
            <><Loader2 className="w-5 h-5 animate-spin" /><span>Transcribing...</span></>
          ) : (
            <><Upload className="w-5 h-5" /><span>Upload Audio for Transcription</span></>
          )}
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Supports MP3, WAV, WebM, M4A, OGG, and video files
        </p>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-500/20 text-red-300 rounded-lg text-sm">{error}</div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileAudio className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-sm">No transcriptions yet</p>
            <p className="text-xs mt-2">Upload a meeting recording to get started</p>
          </div>
        ) : (
          results.map(result => (
            <div key={result.id} className="bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{result.filename}</div>
                  <div className="text-xs text-gray-500">{new Date(result.timestamp).toLocaleString()}</div>
                </div>
                <div className="flex items-center space-x-2">
                  {!result.summary && (
                    <button
                      onClick={() => summarize(result.id)}
                      disabled={isSummarizing}
                      className="p-2 hover:bg-gray-700 rounded transition-colors text-emerald-400"
                      title="AI Summarize"
                    >
                      {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => downloadTranscript(result)} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteResult(result.id)} className="p-2 hover:bg-gray-700 rounded transition-colors text-red-400" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap bg-gray-900 rounded p-3">
                {result.transcript}
              </div>

              {result.summary && (
                <div className="space-y-2 border-t border-gray-700 pt-3">
                  <div className="text-sm font-medium text-emerald-400">✨ AI Summary</div>
                  <p className="text-sm text-gray-300">{result.summary.summary}</p>
                  {result.summary.actionItems.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-yellow-400 mb-1">Action Items</div>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {result.summary.actionItems.map((item, i) => <li key={i}>• {item}</li>)}
                      </ul>
                    </div>
                  )}
                  {result.summary.keyDecisions.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-blue-400 mb-1">Key Decisions</div>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {result.summary.keyDecisions.map((d, i) => <li key={i}>• {d}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
