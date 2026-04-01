/**
 * ErrorDisplay - Comprehensive error display component
 * Shows user-friendly error messages with recovery actions
 */

import React from 'react';
import { AlertCircle, AlertTriangle, Info, RefreshCw, ArrowLeft, Mail, ExternalLink, X } from 'lucide-react';
import { Callout, Button, Flex, Heading, Text } from '@radix-ui/themes';
import { getErrorInfo, ErrorInfo } from '../utils/errorMessages';

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

const ErrorDisplay = React.memo(function ErrorDisplay({
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

  const calloutColors: Record<string, 'red' | 'orange' | 'blue'> = {
    error: 'red',
    warning: 'orange',
    info: 'blue',
  };

  const Icon = icons[errorInfo.severity];
  const calloutColor = calloutColors[errorInfo.severity];

  const handleRecoveryAction = (action: NonNullable<ErrorInfo['recovery']>[0]) => {
    switch (action.action) {
      case 'retry':
        onRetry?.();
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'restart':
        window.location.reload();
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
      <Callout.Root color={calloutColor} variant="soft">
        <Callout.Icon>
          <Icon size={16} />
        </Callout.Icon>
        <Flex direction="column" gap="1" className="flex-1 min-w-0">
          <Text size="2" weight="medium">{errorInfo.title}</Text>
          <Text size="2">{errorInfo.message}</Text>
          {errorInfo.recovery && errorInfo.recovery.length > 0 && (
            <Flex gap="2" mt="1">
              {errorInfo.recovery.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                  onClick={() => handleRecoveryAction(action)}
                >
                  {action.label}
                </button>
              ))}
            </Flex>
          )}
        </Flex>
        {onDismiss && (
          <button
            type="button"
            className="inline-flex items-center justify-center w-5 h-5 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors flex-shrink-0"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </Callout.Root>
    );
  }

  const actionIcons = {
    retry: RefreshCw,
    refresh: RefreshCw,
    restart: RefreshCw,
    navigate: ArrowLeft,
    contact: Mail,
    custom: ExternalLink,
  };

  const errorBgClass = calloutColor === 'red'
    ? 'bg-error/8 border border-error/20'
    : calloutColor === 'orange'
    ? 'bg-warning/8 border border-warning/20'
    : 'bg-info/8 border border-info/20';

  const iconColorClass = calloutColor === 'red'
    ? 'text-error'
    : calloutColor === 'orange'
    ? 'text-warning'
    : 'text-info';

  const iconBgClass = calloutColor === 'red'
    ? 'bg-error/10'
    : calloutColor === 'orange'
    ? 'bg-warning/10'
    : 'bg-info/10';

  return (
    <Flex align="center" justify="center" className="min-h-[400px] p-8">
      <div className={`max-w-md w-full rounded-xl px-6 py-5 ${errorBgClass}`}>
        {/* Icon */}
        <Flex justify="center" mb="4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBgClass}`}>
            <Icon size={24} className={iconColorClass} aria-hidden="true" />
          </div>
        </Flex>

        {/* Title */}
        <Heading size="3" align="center" mb="2" className="text-mission-control-text">
          {errorInfo.title}
        </Heading>

        {/* Message */}
        <Text size="2" align="center" as="p" mb="4" className="text-mission-control-text-dim">
          {errorInfo.message}
        </Text>

        {/* Error code */}
        {errorInfo.code && (
          <Text size="1" align="center" as="p" mb="4" className="text-mission-control-text-dim">
            Error Code: {errorInfo.code}
          </Text>
        )}

        {/* Recovery Actions */}
        {errorInfo.recovery && errorInfo.recovery.length > 0 && (
          <Flex direction="column" gap="2">
            {errorInfo.recovery.map((action, idx) => {
              const ActionIcon = actionIcons[action.action];

              return (
                <Button
                  key={idx}
                  onClick={() => handleRecoveryAction(action)}
                  variant="soft"
                  color={idx === 0 ? 'red' : 'gray'}
                  size="1"
                  className="w-full"
                >
                  <ActionIcon size={14} />
                  {action.label}
                </Button>
              );
            })}
          </Flex>
        )}

        {/* Technical details (for debugging) */}
        {showStack && error?.stack && (
          <details className="mt-6">
            <summary className="text-xs text-mission-control-text-dim cursor-pointer hover:text-mission-control-text">
              Technical Details
            </summary>
            <pre className="mt-2 p-3 bg-mission-control-surface rounded-lg text-xs text-mission-control-text-dim overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}

        {/* Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors w-full mt-4"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </Flex>
  );
});

export default ErrorDisplay;

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
    <Flex align="center" gap="1" mt="1">
      <AlertCircle size={14} className="text-error" />
      <Text size="1" className="text-error">{error}</Text>
    </Flex>
  );
}
