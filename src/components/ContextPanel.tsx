// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image as ImageIcon, FileText, Video, File as FileIcon,
  Upload, X, Eye, Loader2, Trash2, StickyNote, CheckCircle2, Circle,
} from 'lucide-react';
import { TextArea, Box, Flex } from '@radix-ui/themes';

interface ContextFile {
  id: string;
  entityType: string;
  entityId: string;
  originalName: string;
  filePath: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number | null;
  processedContent: string | null;
  summary: string | null;
  createdAt: number;
  processedAt: number | null;
}

interface Props {
  entityType: 'project' | 'campaign';
  entityId: string;
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  const cls = 'text-mission-control-text-dim flex-shrink-0';
  if (fileType === 'image') return <ImageIcon size={16} className={cls} />;
  if (fileType === 'video') return <Video size={16} className={cls} />;
  if (fileType === 'document') return <FileText size={16} className={cls} />;
  return <FileIcon size={16} className={cls} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

type UploadStep = { label: string; status: 'pending' | 'active' | 'done' };

const UPLOAD_STEPS: string[] = ['Saving file', 'Sending to Gemini', 'Generating context', 'Done'];

export default function ContextPanel({ entityType, entityId }: Props) {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [contextNotes, setContextNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadStepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewingFile, setViewingFile] = useState<ContextFile | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/context-files?entityType=${entityType}&entityId=${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
        setContextNotes(data.contextNotes ?? '');
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [entityType, entityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNotesChange = (value: string) => {
    setContextNotes(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      setSavingNotes(true);
      try {
        await fetch('/api/context-files', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityType, entityId, notes: value }),
        });
      } catch { /* non-critical */ }
      finally { setSavingNotes(false); }
    }, 1000);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    // Initialise steps
    const steps: UploadStep[] = UPLOAD_STEPS.map((label, i) => ({
      label,
      status: i === 0 ? 'active' : 'pending',
    }));
    setUploadSteps(steps);

    // Advance steps on a timer to show progress while Gemini processes
    const delays = [600, 1800, 3500]; // ms to advance each step
    uploadStepTimersRef.current.forEach(clearTimeout);
    uploadStepTimersRef.current = delays.map((delay, i) =>
      setTimeout(() => {
        setUploadSteps(prev => prev.map((s, idx) => ({
          ...s,
          status: idx < i + 1 ? 'done' : idx === i + 1 ? 'active' : s.status,
        })));
      }, delay)
    );

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      const res = await fetch('/api/context-files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error || 'Upload failed');
      } else {
        await loadData();
      }
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      uploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/context-files/${id}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch { /* non-critical */ }
  };

  return (
    <Box p="5" className="flex-1 overflow-y-auto space-y-6">
      {/* Notes Section */}
      <section>
        <Flex align="center" gap="2" mb="3">
          <StickyNote size={14} className="text-mission-control-text-dim" />
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Context Notes</h3>
          {savingNotes && (
            <span className="text-xs text-mission-control-text-dim ml-auto">Saving...</span>
          )}
        </Flex>
        <TextArea
          value={contextNotes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add notes for AI agents working on this — goals, constraints, brand voice, key facts..."
          rows={4}
          size="2"
          className="w-full"
        />
      </section>

      {/* Files Section */}
      <section>
        <Flex align="center" gap="2" mb="3">
          <FileText size={14} className="text-mission-control-text-dim" />
          <h3 className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Context Files</h3>
          <span className="text-xs text-mission-control-text-dim ml-1">({files.length})</span>
        </Flex>

        {/* Upload Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors mb-4 ${
            dragging
              ? 'border-mission-control-accent bg-mission-control-accent/10'
              : 'border-mission-control-border hover:border-mission-control-accent/50 hover:bg-mission-control-surface'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <Flex direction="column" align="start" gap="2" className="w-full max-w-[220px] mx-auto">
              {uploadSteps.map((step, i) => (
                <Flex key={i} align="center" gap="2">
                  {step.status === 'done' ? (
                    <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                  ) : step.status === 'active' ? (
                    <Loader2 size={14} className="animate-spin text-mission-control-accent flex-shrink-0" />
                  ) : (
                    <Circle size={14} className="text-mission-control-border flex-shrink-0" />
                  )}
                  <span className={`text-xs ${step.status === 'pending' ? 'text-mission-control-text-dim' : step.status === 'active' ? 'text-mission-control-text' : 'text-mission-control-text-dim line-through'}`}>
                    {step.label}
                  </span>
                </Flex>
              ))}
            </Flex>
          ) : (
            <Flex direction="column" align="center" gap="2">
              <Upload size={20} className="text-mission-control-text-dim" />
              <span className="text-sm text-mission-control-text-dim">Drop files here or click to upload</span>
              <span className="text-xs text-mission-control-text-dim">Documents, images, PDFs — any file type</span>
            </Flex>
          )}
        </div>

        {uploadError && (
          <p className="text-xs text-error mb-3">{uploadError}</p>
        )}

        {/* File Grid */}
        {loading ? (
          <Flex justify="center" py="6">
            <Loader2 size={18} className="animate-spin text-mission-control-text-dim" />
          </Flex>
        ) : files.length === 0 ? (
          <p className="text-sm text-mission-control-text-dim text-center py-4">
            No context files yet. Upload docs, images, or briefs for AI agents to reference.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {files.map(file => (
              <Flex
                key={file.id}
                align="start"
                gap="3"
                p="3"
                className="bg-mission-control-surface border border-mission-control-border rounded-lg"
              >
                <Box className="mt-0.5">
                  <FileTypeIcon fileType={file.fileType} />
                </Box>
                <Box className="flex-1 min-w-0">
                  <Flex align="center" gap="2">
                    <span className="text-sm font-medium text-mission-control-text truncate">{file.originalName}</span>
                    {file.fileSize && (
                      <span className="text-xs text-mission-control-text-dim flex-shrink-0">{formatBytes(file.fileSize)}</span>
                    )}
                  </Flex>
                  {file.summary && (
                    <p className="text-xs text-mission-control-text-dim mt-0.5 line-clamp-2">{file.summary}</p>
                  )}
                  {!file.processedAt && file.fileType !== 'video' && (
                    <p className="text-xs text-mission-control-text-dim mt-0.5 italic">Not yet processed</p>
                  )}
                </Box>
                <Flex align="center" gap="1" className="flex-shrink-0">
                  {file.processedContent && (
                    <button
                      type="button"
                      onClick={() => setViewingFile(file)}
                      title="View processed content"
                      aria-label="View processed content"
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    title="Delete file"
                    aria-label="Delete file"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </Flex>
              </Flex>
            ))}
          </div>
        )}
      </section>

      {/* View Content Modal */}
      {viewingFile && (
        <Flex
          align="center"
          justify="center"
          p="4"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setViewingFile(null)}
        >
          <Flex
            direction="column"
            className="w-full max-w-2xl max-h-[80vh] bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <Flex align="center" justify="between" px="4" py="3" className="border-b border-mission-control-border">
              <Flex align="center" gap="2">
                <FileTypeIcon fileType={viewingFile.fileType} />
                <span className="text-sm font-semibold text-mission-control-text truncate">{viewingFile.originalName}</span>
              </Flex>
              <button
                type="button"
                onClick={() => setViewingFile(null)}
                aria-label="Close"
                className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                <X size={15} />
              </button>
            </Flex>
            <Box p="4" className="flex-1 overflow-y-auto">
              <pre className="text-xs text-mission-control-text whitespace-pre-wrap font-mono leading-relaxed">
                {viewingFile.processedContent}
              </pre>
            </Box>
          </Flex>
        </Flex>
      )}
    </Box>
  );
}
