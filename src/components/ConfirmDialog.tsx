/**
 * ConfirmDialog - Confirmation dialog for destructive actions
 * Prevents accidental data loss and provides clear action context
 */

import { useState } from 'react';
import { AlertTriangle, Trash2, X, Info } from 'lucide-react';
import { LoadingButton } from './LoadingStates';
import BaseModal, { BaseModalBody, BaseModalFooter } from './BaseModal';

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

  const config = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-error-subtle',
      iconColor: 'text-error',
      confirmVariant: 'danger' as const,
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-warning-subtle',
      iconColor: 'text-warning',
      confirmVariant: 'primary' as const,
    },
    info: {
      icon: Info,
      iconBg: 'bg-info-subtle',
      iconColor: 'text-info',
      confirmVariant: 'primary' as const,
    },
  };

  const { icon: Icon, iconBg, iconColor, confirmVariant } = config[type];

  const canConfirm = !requireInput || inputValue === requireInput.expectedValue;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // 'Confirmation action failed:', error;
    } finally {
      setIsProcessing(false);
      setInputValue('');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setInputValue('');
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={handleClose}
      size="md"
      ariaLabel={title}
      ariaDescribedby="confirm-dialog-message"
      showCloseButton={false}
      preventEscClose={isProcessing}
      preventBackdropClose={isProcessing}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-6 border-b border-clawd-border">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={24} className={iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-clawd-text">{title}</h3>
          <p id="confirm-dialog-message" className="text-sm text-clawd-text-dim mt-1">{message}</p>
        </div>
        <button
          onClick={handleClose}
          disabled={isProcessing}
          className="p-1 hover:bg-clawd-border rounded transition-colors disabled:opacity-50"
          aria-label="Close dialog"
          type="button"
        >
          <X size={20} className="text-clawd-text-dim" />
        </button>
      </div>

      {/* Content */}
      <BaseModalBody>
        {requireInput && (
          <div className="space-y-2">
            <label htmlFor="confirm-input" className="block text-sm font-medium text-clawd-text">
              {requireInput.hint}
            </label>
            <input
              id="confirm-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={requireInput.placeholder}
              className="w-full px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg text-clawd-text placeholder-clawd-text-dim focus:outline-none focus:ring-2 focus:ring-clawd-accent"
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
              disabled={isProcessing}
            />
            {inputValue && inputValue !== requireInput.expectedValue && (
              <p className="text-xs text-error">
                Please type exactly: <code className="font-mono">{requireInput.expectedValue}</code>
              </p>
            )}
          </div>
        )}
      </BaseModalBody>

      {/* Actions */}
      <BaseModalFooter align="right">
        <LoadingButton
          onClick={handleClose}
          variant="ghost"
          disabled={isProcessing}
        >
          {cancelLabel}
        </LoadingButton>
        <LoadingButton
          onClick={handleConfirm}
          variant={confirmVariant}
          disabled={!canConfirm}
          loading={isProcessing || loading}
        >
          {confirmLabel}
        </LoadingButton>
      </BaseModalFooter>
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
