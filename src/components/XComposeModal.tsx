import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
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
    <Flex justify="end" className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl h-full bg-mission-control-bg border-l border-mission-control-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <h2 className="text-base font-semibold text-mission-control-text">New Post</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Composer */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <XPublishComposer onPostSuccess={onClose} />
        </div>
      </div>
    </Flex>
  );
}
