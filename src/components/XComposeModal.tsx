import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@radix-ui/themes';
import XPublishComposer from './XPublishComposer';

interface XComposeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function XComposeModal({ open, onClose }: XComposeModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl h-full bg-mission-control-bg border-l border-mission-control-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-mission-control-border bg-mission-control-surface">
          <h2 className="text-sm font-semibold text-mission-control-text">New Post</h2>
          <IconButton
            onClick={onClose}
            variant="ghost"
            color="gray"
            size="2"
          >
            <X size={18} />
          </IconButton>
        </div>

        {/* Composer */}
        <div className="flex-1 overflow-y-auto">
          <XPublishComposer onPostSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
