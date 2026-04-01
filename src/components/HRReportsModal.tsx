import { useState, useEffect } from 'react';
import { X, FileText, Calendar, Download, RefreshCw } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
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
        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
          {title}
        </div>
        <div className="px-4 space-y-2">
          {items.map((file) => (
            <button
              key={file.name}
              type="button"
              onClick={() => loadFileContent(file)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                selectedFile?.name === file.name
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-transparent text-mission-control-text hover:bg-mission-control-border/30 hover:border-mission-control-border'
              }`}
            >
              <div className="w-full">
                <div className="font-medium text-sm mb-1 line-clamp-1">{file.name}</div>
                <div className="flex items-center gap-2 text-[11px] text-mission-control-text-dim/70">
                  <Calendar size={11} />
                  {formatDate(file.modifiedAt)}
                </div>
                <div className="text-[11px] text-mission-control-text-dim/70 mt-0.5 tabular-nums">
                  {formatSize(file.size)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Flex align="center" justify="center" p="4" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-mission-control-surface rounded-2xl shadow-2xl border border-mission-control-border w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-mission-control-text">HR Reports</h2>
            <p className="text-xs text-mission-control-text-dim mt-0.5">
              {files.length} report{files.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              title="Refresh"
              onClick={loadFiles}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {selectedFile && fileContent && (
              <Button size="2" variant="solid" onClick={downloadReport}>
                <Download size={16} />
                Download
              </Button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
              <X size={16} />
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
    </Flex>
  );
}
