/**
 * ErrorDisplay - Comprehensive error display component
 * Shows user-friendly error messages with recovery actions
 */

import { AlertCircle, AlertTriangle, Info, RefreshCw, ArrowLeft, Mail, ExternalLink } from 'lucide-react';
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
                <Button
                  key={idx}
                  size="1"
                  variant="ghost"
                  color={calloutColor}
                  onClick={() => handleRecoveryAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </Flex>
          )}
        </Flex>
        {onDismiss && (
          <Button
            size="1"
            variant="ghost"
            color={calloutColor}
            onClick={onDismiss}
            className="flex-shrink-0"
          >
            &times;
          </Button>
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

  return (
    <Flex align="center" justify="center" className="min-h-[400px] p-8">
      <div className="max-w-md w-full">
        {/* Icon */}
        <Flex justify="center" mb="6">
          <div className={`w-16 h-16 rounded-full bg-${calloutColor === 'red' ? 'error' : calloutColor === 'orange' ? 'warning' : 'info'}-subtle flex items-center justify-center`}>
            <Icon size={32} className={`text-${calloutColor === 'red' ? 'error' : calloutColor === 'orange' ? 'warning' : 'info'}`} />
          </div>
        </Flex>

        {/* Title */}
        <Heading size="4" align="center" mb="2">
          {errorInfo.title}
        </Heading>

        {/* Message */}
        <Text size="2" color="gray" align="center" as="p" mb="6">
          {errorInfo.message}
        </Text>

        {/* Error code */}
        {errorInfo.code && (
          <Text size="1" color="gray" align="center" as="p" mb="4">
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
                  variant={idx === 0 ? 'solid' : 'surface'}
                  color={idx === 0 ? 'grass' : 'gray'}
                  size="2"
                  className="w-full"
                >
                  <ActionIcon size={16} />
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
            <pre className="mt-2 p-3 bg-mission-control-bg rounded text-xs text-mission-control-text-dim overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}

        {/* Dismiss button */}
        {onDismiss && (
          <Button
            variant="ghost"
            color="gray"
            size="2"
            onClick={onDismiss}
            className="w-full mt-4"
          >
            Dismiss
          </Button>
        )}
      </div>
    </Flex>
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
    <Flex align="center" gap="1" mt="1">
      <AlertCircle size={14} className="text-error" />
      <Text size="1" className="text-error">{error}</Text>
    </Flex>
  );
}
