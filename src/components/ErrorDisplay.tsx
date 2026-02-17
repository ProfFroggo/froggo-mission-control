/**
 * ErrorDisplay - Comprehensive error display component
 * Shows user-friendly error messages with recovery actions
 */

import { AlertCircle, AlertTriangle, Info, RefreshCw, ArrowLeft, Mail, ExternalLink } from 'lucide-react';
import { getErrorInfo, ErrorInfo } from '../utils/errorMessages';
import { LoadingButton } from './LoadingStates';

interface ErrorDisplayProps {
  error: any;
  context?: {
    action?: string;
    resource?: string;
    technical?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  inline?: boolean;
  showStack?: boolean;
}

export default function ErrorDisplay({
  error,
  context,
  onRetry,
  onDismiss,
  inline = false,
  showStack = false,
}: ErrorDisplayProps) {
  if (!error) return null;

  const errorInfo = getErrorInfo(error, context);

  const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    error: {
      bg: 'bg-error-subtle',
      border: 'border-error-border',
      text: 'text-error',
      iconBg: 'bg-error-subtle',
    },
    warning: {
      bg: 'bg-warning-subtle',
      border: 'border-warning-border',
      text: 'text-warning',
      iconBg: 'bg-warning-subtle',
    },
    info: {
      bg: 'bg-info-subtle',
      border: 'border-info-border',
      text: 'text-info',
      iconBg: 'bg-info-subtle',
    },
  };

  const Icon = icons[errorInfo.severity];
  const colorScheme = colors[errorInfo.severity];

  const handleRecoveryAction = (action: NonNullable<ErrorInfo['recovery']>[0]) => {
    switch (action.action) {
      case 'retry':
        onRetry?.();
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'restart':
        window.clawdbot?.app?.restart?.();
        break;
      case 'navigate':
        if (action.url) {
          window.location.href = action.url;
        }
        break;
      case 'contact':
        window.open('mailto:support@example.com', '_blank');
        break;
      case 'custom':
        action.customHandler?.();
        break;
    }
  };

  if (inline) {
    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${colorScheme.bg} ${colorScheme.border}`}>
        <Icon size={16} className={`flex-shrink-0 mt-0.5 ${colorScheme.text}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${colorScheme.text}`}>{errorInfo.title}</div>
          <div className="text-sm text-clawd-text-dim mt-1">{errorInfo.message}</div>
          {errorInfo.recovery && errorInfo.recovery.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              {errorInfo.recovery.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecoveryAction(action)}
                  className={`text-xs px-2 py-1 rounded ${colorScheme.text} hover:bg-white/5 transition-colors`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors text-clawd-text-dim"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-full ${colorScheme.iconBg} flex items-center justify-center`}>
            <Icon size={32} className={colorScheme.text} />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-center text-clawd-text mb-2">
          {errorInfo.title}
        </h3>

        {/* Message */}
        <p className="text-sm text-center text-clawd-text-dim mb-6">
          {errorInfo.message}
        </p>

        {/* Error code */}
        {errorInfo.code && (
          <p className="text-xs text-center text-clawd-text-dim/50 mb-4">
            Error Code: {errorInfo.code}
          </p>
        )}

        {/* Recovery Actions */}
        {errorInfo.recovery && errorInfo.recovery.length > 0 && (
          <div className="flex flex-col gap-2">
            {errorInfo.recovery.map((action, idx) => {
              const actionIcons = {
                retry: RefreshCw,
                refresh: RefreshCw,
                restart: RefreshCw,
                navigate: ArrowLeft,
                contact: Mail,
                custom: ExternalLink,
              };
              const ActionIcon = actionIcons[action.action];

              return (
                <LoadingButton
                  key={idx}
                  onClick={() => handleRecoveryAction(action)}
                  variant={idx === 0 ? 'primary' : 'secondary'}
                  icon={<ActionIcon size={16} />}
                  className="w-full"
                >
                  {action.label}
                </LoadingButton>
              );
            })}
          </div>
        )}

        {/* Technical details (for debugging) */}
        {showStack && error?.stack && (
          <details className="mt-6">
            <summary className="text-xs text-clawd-text-dim cursor-pointer hover:text-clawd-text">
              Technical Details
            </summary>
            <pre className="mt-2 p-3 bg-clawd-bg rounded text-xs text-clawd-text-dim overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full mt-4 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error for form fields
 */
interface FieldErrorProps {
  error?: string;
  touched?: boolean;
}

export function FieldError({ error, touched }: FieldErrorProps) {
  if (!error || !touched) return null;

  return (
    <div className="flex items-center gap-1 mt-1 text-xs text-error">
      <AlertCircle size={14} />
      <span>{error}</span>
    </div>
  );
}
