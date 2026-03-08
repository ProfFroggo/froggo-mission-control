import { useEffect, useState, useRef } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    name: string;
    type: string;
    dataUrl?: string;
    size: number;
  } | null;
}

export default function FilePreviewModal({ isOpen, onClose, file }: FilePreviewModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // ESC key handler - works even when typing
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    
    // Use capture phase
    window.addEventListener('keydown', handleEsc, { capture: true });
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- handleClose is stable modal handler

  if (!isOpen || !file) return null;

  const isImage = file.type.startsWith('image/');
  const isPDF = file.type.includes('pdf');
  const isText = file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml');

  const handleDownload = () => {
    if (!file.dataUrl) return;
    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 ${
          isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-preview-title"
          className={`relative max-w-6xl max-h-[90vh] w-full glass-modal rounded-2xl border border-mission-control-border shadow-2xl flex flex-col overflow-hidden pointer-events-auto ${
            isClosing ? 'modal-content-exit' : 'modal-content-enter'
          }`}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mission-control-border bg-mission-control-bg/50">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div>
              <h3 id="file-preview-title" className="font-semibold truncate">{file.name}</h3>
              <p className="text-sm text-mission-control-text-dim">
                {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              title="Download"
              aria-label="Download file"
              type="button"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              title="Close (ESC)"
              aria-label="Close modal"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isImage && file.dataUrl ? (
            <div className="flex items-center justify-center h-full">
              <img
                src={file.dataUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          ) : isPDF && file.dataUrl ? (
            <div className="h-full">
              <iframe
                src={file.dataUrl}
                className="w-full h-full rounded-lg border border-mission-control-border"
                title={file.name}
              />
            </div>
          ) : isText && file.dataUrl ? (
            <div className="bg-mission-control-bg rounded-lg border border-mission-control-border p-4 font-mono text-sm overflow-auto max-h-[70vh]">
              <pre className="whitespace-pre-wrap">{atob(file.dataUrl.split(',')[1])}</pre>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <ExternalLink size={48} className="mx-auto mb-4 text-mission-control-text-dim opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Preview not available</h3>
                <p className="text-sm text-mission-control-text-dim mb-4">
                  This file type can&apos;t be previewed in the browser.
                </p>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
                >
                  <Download size={16} />
                  Download File
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-mission-control-border bg-mission-control-bg/30 text-center">
          <p className="text-xs text-mission-control-text-dim">
            Press <kbd className="px-1.5 py-0.5 bg-mission-control-border rounded text-xs">Esc</kbd> to close
          </p>
        </div>
        </div>
      </div>
    </>
  );
}
