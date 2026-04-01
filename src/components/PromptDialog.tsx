/**
 * PromptDialog - Text input dialog component
 * Replaces window.prompt() with a proper React modal
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { TextArea, TextField } from '@radix-ui/themes';
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
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setSubmitError(null);
    try {
      await onSubmit(value);
      setValue('');
      onClose();
    } catch (error) {
      // 'Prompt submit failed:', error;
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong');
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
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <h2 className="text-base font-semibold text-mission-control-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Message */}
          {message && (
            <p className="text-sm text-mission-control-text-dim">{message}</p>
          )}

          {/* Input */}
          {multiline ? (
            <TextArea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={4}
              disabled={isSubmitting}
            />
          ) : (
            <TextField.Root
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSubmitting}
            />
          )}

          {/* Error */}
          {submitError && (
            <p className="text-sm text-error">{submitError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <LoadingButton
            onClick={handleSubmit}
            loading={isSubmitting || loading}
            disabled={!value.trim()}
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </BaseModal>
  );
}
