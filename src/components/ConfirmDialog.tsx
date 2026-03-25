/**
 * ConfirmDialog - Confirmation dialog for destructive actions
 * Prevents accidental data loss and provides clear action context
 */

import { useState } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';
import { Button, TextField } from '@radix-ui/themes';
import { LoadingButton } from './LoadingStates';
import BaseModal, { BaseModalBody } from './BaseModal';

export type ConfirmDialogType = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: ConfirmDialogType;
  requireInput?: {
    placeholder: string;
    expectedValue: string;
    hint: string;
  };
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'warning',
  requireInput,
  loading = false,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const config = {
    danger: {
      icon: Trash2,
      iconWrapperClass: 'bg-[var(--color-error)]/10 text-[var(--color-error)]',
      isDanger: true,
    },
    warning: {
      icon: AlertTriangle,
      iconWrapperClass: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
      isDanger: false,
    },
    info: {
      icon: Info,
      iconWrapperClass: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
      isDanger: false,
    },
  };

  const { icon: Icon, iconWrapperClass, isDanger } = config[type];

  const canConfirm = !requireInput || inputValue === requireInput.expectedValue;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
      setInputValue('');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setInputValue('');
      setActionError(null);
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={handleClose}
      size="sm"
      ariaLabel={title}
      ariaDescribedby="confirm-dialog-message"
      showCloseButton={false}
      preventEscClose={isProcessing}
      preventBackdropClose={isProcessing}
      className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl"
    >
      {/* Overlay is handled by BaseModal; inner panel is solid surface */}
      <div className="p-6">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4 ${iconWrapperClass}`}>
          <Icon size={20} />
        </div>

        {/* Title + message */}
        <h3 className="text-base font-semibold text-mission-control-text text-center">{title}</h3>
        <p id="confirm-dialog-message" className="text-sm text-mission-control-text-dim text-center mt-1 leading-relaxed">
          {message}
        </p>

        {/* Optional input confirmation */}
        {requireInput && (
          <div className="space-y-2 mt-4">
            <label htmlFor="confirm-input" className="block text-sm font-medium text-mission-control-text">
              {requireInput.hint}
            </label>
            <TextField.Root
              id="confirm-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={requireInput.placeholder}
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
              disabled={isProcessing}
            />
            {inputValue && inputValue !== requireInput.expectedValue && (
              <p className="text-xs text-[var(--color-error)]">
                Please type exactly: <code className="font-mono">{requireInput.expectedValue}</code>
              </p>
            )}
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <p className="text-sm text-[var(--color-error)] mt-3 text-center">{actionError}</p>
        )}

        {/* Footer */}
        <div className="flex gap-2 mt-6">
          <Button
            variant="soft"
            size="2"
            className="flex-1"
            onClick={handleClose}
            disabled={isProcessing}
            type="button"
          >
            {cancelLabel}
          </Button>
          <LoadingButton
            variant={isDanger ? 'danger' : 'primary'}
            disabled={!canConfirm}
            loading={isProcessing || loading}
            onClick={handleConfirm}
            className="flex-1"
            type="button"
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </BaseModal>
  );
}

/**
 * Hook for managing confirm dialog state
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Omit<ConfirmDialogProps, 'open' | 'onClose' | 'onConfirm'>>({
    title: 'Confirm Action',
    message: 'Are you sure?',
  });
  const [onConfirmCallback, setOnConfirmCallback] = useState<() => void | Promise<void>>(() => {});

  const showConfirm = (
    options: Omit<ConfirmDialogProps, 'open' | 'onClose' | 'onConfirm'>,
    onConfirm: () => void | Promise<void>
  ) => {
    setConfig(options);
    setOnConfirmCallback(() => onConfirm);
    setOpen(true);
  };

  const closeConfirm = () => {
    setOpen(false);
  };

  return {
    open,
    config,
    onConfirm: onConfirmCallback,
    showConfirm,
    closeConfirm,
  };
}

/**
 * Quick confirmation for common actions
 */
export const confirmPresets = {
  deleteTask: (taskTitle: string) => ({
    title: 'Delete Task',
    message: `Are you sure you want to delete "${taskTitle}"? This action cannot be undone.`,
    confirmLabel: 'Delete Task',
    type: 'danger' as ConfirmDialogType,
  }),

  deleteAgent: (agentName: string) => ({
    title: 'Delete Agent',
    message: `Delete agent "${agentName}"? All associated data will be removed.`,
    confirmLabel: 'Delete Agent',
    type: 'danger' as ConfirmDialogType,
    requireInput: {
      placeholder: `Type "${agentName}" to confirm`,
      expectedValue: agentName,
      hint: `Type the agent name to confirm deletion:`,
    },
  }),

  abortAgent: (agentName: string) => ({
    title: 'Abort Agent',
    message: `Stop "${agentName}" immediately? Current work will be lost.`,
    confirmLabel: 'Abort Agent',
    type: 'warning' as ConfirmDialogType,
  }),

  clearData: () => ({
    title: 'Clear All Data',
    message: 'This will permanently delete all tasks, agents, and settings. This action cannot be undone.',
    confirmLabel: 'Clear All Data',
    type: 'danger' as ConfirmDialogType,
    requireInput: {
      placeholder: 'Type "DELETE" to confirm',
      expectedValue: 'DELETE',
      hint: 'Type DELETE to confirm:',
    },
  }),

  reopenTask: () => ({
    title: 'Reopen Task',
    message: 'Move this task back to "In Progress"? The current agent will resume work.',
    confirmLabel: 'Reopen Task',
    type: 'info' as ConfirmDialogType,
  }),

  approveChanges: () => ({
    title: 'Approve Changes',
    message: 'Review the changes and approve to proceed. This will execute the requested action.',
    confirmLabel: 'Approve',
    type: 'info' as ConfirmDialogType,
  }),
};
