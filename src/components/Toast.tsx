import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { AlertRegion } from './LiveRegion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  success: 'bg-success-subtle border-success-border text-success',
  error: 'bg-error-subtle border-error-border text-error',
  warning: 'bg-warning-subtle border-warning-border text-warning',
  info: 'bg-info-subtle border-info-border text-info',
};

function ToastItem({ toast, onDismiss }: ToastProps) {
  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  // Build screen reader announcement: title + optional message
  const announcement = toast.message ? `${toast.title}: ${toast.message}` : toast.title;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-lg animate-toast-in ${colors[toast.type]}`}
    >
      {/* Screen reader announcement — assertive so errors/warnings are immediately announced */}
      <AlertRegion message={announcement} />
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">{toast.title}</div>
        {toast.message && (
          <div className="text-sm opacity-80 mt-0.5">{toast.message}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 hover:bg-mission-control-text/10 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// Global toast state
let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let currentToasts: ToastMessage[] = [];

export function showToast(type: ToastType, title: string, message?: string, duration?: number): void;
export function showToast(title: string, type: ToastType, message?: string, duration?: number): void;
export function showToast(typeOrTitle: string, titleOrType: string, message?: string, duration?: number) {
  const validTypes: ToastType[] = ['success', 'error', 'warning', 'info'];
  let type: ToastType;
  let title: string;
  if (validTypes.includes(typeOrTitle as ToastType)) {
    type = typeOrTitle as ToastType;
    title = titleOrType;
  } else {
    type = (validTypes.includes(titleOrType as ToastType) ? titleOrType : 'info') as ToastType;
    title = typeOrTitle;
  }
  const toast: ToastMessage = {
    id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    message,
    duration: duration || 5000,
  };
  
  currentToasts = [...currentToasts, toast];
  toastListeners.forEach(listener => listener(currentToasts));
}

export function dismissToast(id: string) {
  currentToasts = currentToasts.filter(t => t.id !== id);
  toastListeners.forEach(listener => listener(currentToasts));
}

/** Reset global toast state (for tests) */
export function _resetToasts() {
  currentToasts = [];
  toastListeners.forEach(listener => listener([]));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (newToasts: ToastMessage[]) => setToasts([...newToasts]);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
