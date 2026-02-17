/**
 * PromptDialog - Text input dialog component
 * Replaces window.prompt() with a proper React modal
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import BaseModal from './BaseModal';
import { LoadingButton } from './LoadingStates';

export interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void | Promise<void>;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  loading?: boolean;
}

export function usePromptDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Omit<PromptDialogProps, 'open' | 'onClose' | 'onSubmit'>>({
    title: 'Enter Value',
    message: '',
    placeholder: '',
    defaultValue: '',
    confirmLabel: 'Submit',
    cancelLabel: 'Cancel',
    multiline: false,
  });
  const [onSubmitCallback, setOnSubmitCallback] = useState<(value: string) => void | Promise<void>>(() => {});

  const showPrompt = (
    options: Omit<PromptDialogProps, 'open' | 'onClose' | 'onSubmit'>,
    onSubmit: (value: string) => void | Promise<void>
  ) => {
    setConfig(options);
    setOnSubmitCallback(() => onSubmit);
    setOpen(true);
  };

  const closePrompt = () => {
    setOpen(false);
  };

  return {
    open,
    config,
    onSubmit: onSubmitCallback,
    showPrompt,
    closePrompt,
  };
}

export default function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  message,
  placeholder,
  defaultValue = '',
  confirmLabel = 'Submit',
  cancelLabel = 'Cancel',
  multiline = false,
  loading = false,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      // Focus input after modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, defaultValue]);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(value);
      setValue('');
      onClose();
    } catch (error) {
      console.error('Prompt submit failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSubmit();
      }
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      size="md"
      ariaLabel={title}
      showCloseButton={false}
      preventEscClose={isSubmitting}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-clawd-text">{title}</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded hover:bg-clawd-bg-subtle text-clawd-text-dim hover:text-clawd-text transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        {message && (
          <p className="text-sm text-clawd-text-dim mb-4">{message}</p>
        )}

        {/* Input */}
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={4}
            className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-primary focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-primary focus:border-transparent"
            disabled={isSubmitting}
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-bg-subtle rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <LoadingButton
            onClick={handleSubmit}
            loading={isSubmitting || loading}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm font-medium bg-clawd-primary text-white rounded-lg hover:bg-clawd-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </BaseModal>
  );
}
