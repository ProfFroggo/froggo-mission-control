import { useState, useEffect, useRef } from 'react';
import { X, BookOpen, RefreshCw } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TrainingLogFile {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type: 'training-log' | 'weekly-report';
}

export default function TrainingLogModal({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<TrainingLogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<TrainingLogFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadFiles();
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/training-logs?type=training');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const logs: TrainingLogFile[] = await res.json();
      setFiles(logs);
      if (logs.length > 0) {
        loadFileContent(logs[0]);
      }
    } catch {
      // Failed to load training logs
    } finally {
      setLoading(false);
    }
  };

  const loadFileContent = async (file: TrainingLogFile) => {
    setSelectedFile(file);
    setLoadingContent(true);
    setFileContent('');
    try {
      const res = await fetch(`/api/training-logs?file=${encodeURIComponent(file.name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFileContent(data.content || '');
    } catch {
      setFileContent('');
    } finally {
      setLoadingContent(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(onClose, 200);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Flex
      align="center"
      justify="center"
      p="4"
      className={`fixed inset-0 z-50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default"
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        aria-label="Close training log"
      />
      <div
        className={`relative w-full max-w-4xl bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl flex flex-col max-h-[80vh] ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="2">
            <BookOpen size={16} className="text-mission-control-accent" />
            <span className="text-base font-semibold text-mission-control-text">Training Log</span>
          </Flex>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - file list */}
          <div className="w-56 flex-shrink-0 border-r border-mission-control-border overflow-y-auto p-3 space-y-1">
            {loading ? (
              <div className="text-center text-mission-control-text-dim py-4 text-sm">Loading...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-mission-control-text-dim text-xs px-2">
                No training logs yet.
              </div>
            ) : (
              files.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => loadFileContent(file)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFile?.name === file.name
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text hover:bg-mission-control-border/30'
                  }`}
                >
                  <div className="font-medium text-xs line-clamp-2 mb-0.5">{file.name}</div>
                  <div className="text-[10px] opacity-70">{formatDate(file.modifiedAt)}</div>
                </button>
              ))
            )}
          </div>

          {/* Main - markdown content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            {loadingContent ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw size={24} className="animate-spin text-mission-control-text-dim" />
              </div>
            ) : !selectedFile ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BookOpen size={32} className="mx-auto text-mission-control-text-dim mb-3 opacity-40" />
                <p className="text-mission-control-text-dim text-sm">No training sessions yet.</p>
                <p className="text-mission-control-text-dim text-xs mt-1">
                  Training runs automatically during quiet periods.
                </p>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </Flex>
  );
}
