import { useState, useEffect } from 'react';
import { X, FileText, Calendar, Download, RefreshCw } from 'lucide-react';
import { showToast } from './Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReportFile {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type: 'training-log' | 'weekly-report';
}

interface HRReportsModalProps {
  onClose: () => void;
}

export default function HRReportsModal({ onClose }: HRReportsModalProps) {
  const [files, setFiles] = useState<ReportFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ReportFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/training-logs?type=reports');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ReportFile[] = await res.json();
      setFiles(data.filter(f => f.type === 'weekly-report'));
      if (data.length > 0 && !selectedFile) {
        loadFileContent(data[0]);
      }
    } catch (error) {
      showToast('error', 'Failed to load reports', String(error));
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (file: ReportFile) => {
    setSelectedFile(file);
    setLoadingContent(true);
    setFileContent('');
    try {
      const res = await fetch(`/api/training-logs?file=${encodeURIComponent(file.name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFileContent(data.content || '');
    } catch (error) {
      showToast('error', 'Failed to read report', String(error));
      setFileContent('');
    } finally {
      setLoadingContent(false);
    }
  };

  const downloadReport = () => {
    if (!selectedFile || !fileContent) return;
    const blob = new Blob([fileContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Report downloaded');
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const trainingLogs = files.filter((f) => f.type === 'training-log');
  const weeklyReports = files.filter((f) => f.type === 'weekly-report');

  const renderSidebarSection = (title: string, items: ReportFile[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="px-4 py-2 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">
          {title}
        </div>
        <div className="px-4 space-y-2">
          {items.map((file) => (
            <button
              key={file.name}
              onClick={() => loadFileContent(file)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedFile?.name === file.name
                  ? 'border-mission-control-accent/50 bg-mission-control-accent/10'
                  : 'border-mission-control-border hover:border-mission-control-border/50 hover:bg-mission-control-bg'
              }`}
            >
              <div className="font-medium text-sm mb-1 line-clamp-1">{file.name}</div>
              <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
                <Calendar size={12} />
                {formatDate(file.modifiedAt)}
              </div>
              <div className="text-xs text-mission-control-text-dim mt-1">
                {formatSize(file.size)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-mission-control-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mission-control-accent/20 flex items-center justify-center ring-2 ring-mission-control-accent/30">
              <FileText size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">HR Reports</h2>
              <p className="text-sm text-mission-control-text-dim">
                {files.length} report{files.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadFiles}
              disabled={loading}
              className="p-2 hover:bg-mission-control-bg rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {selectedFile && fileContent && (
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 px-3 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
              >
                <Download size={16} />
                Download
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-mission-control-bg rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - File List */}
          <div className="w-80 flex-shrink-0 border-r border-mission-control-border overflow-y-auto py-4">
            {loading ? (
              <div className="p-4 text-center text-mission-control-text-dim">Loading...</div>
            ) : files.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={48} className="text-mission-control-text-dim mx-auto mb-4 opacity-40" />
                <p className="text-mission-control-text-dim text-sm">
                  No reports yet — run an HR training job to generate reports
                </p>
              </div>
            ) : (
              <>
                {renderSidebarSection('Training Logs', trainingLogs)}
                {renderSidebarSection('Weekly Reports', weeklyReports)}
              </>
            )}
          </div>

          {/* Main - File Content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {loadingContent ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw size={32} className="animate-spin text-mission-control-text-dim" />
              </div>
            ) : !selectedFile ? (
              <div className="flex items-center justify-center h-full text-mission-control-text-dim">
                Select a report to view
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
