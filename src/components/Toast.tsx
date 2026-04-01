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

const variantStyles: Record<ToastType, { border: string; icon: string }> = {
  success: { border: 'border-l-4 border-l-[var(--color-success)]',  icon: 'text-success'  },
  error:   { border: 'border-l-4 border-l-[var(--color-error)]',    icon: 'text-error'    },
  warning: { border: 'border-l-4 border-l-[var(--color-warning)]',  icon: 'text-warning'  },
  info:    { border: 'border-l-4 border-l-[var(--color-info)]',     icon: 'text-info'     },
};

const progressColor: Record<ToastType, string> = {
  success: 'bg-success',
  error:   'bg-error',
  warning: 'bg-warning',
  info:    'bg-info',
};

function ToastItem({ toast, onDismiss }: ToastProps) {
  const Icon = icons[toast.type];
  const { border, icon } = variantStyles[toast.type];
  const duration = toast.duration || 5000;
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);

  // Trigger enter animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Progress bar countdown
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  // Screen reader announcement
  const announcement = toast.message ? `${toast.title}: ${toast.message}` : toast.title;

  return (
    <div
      className={`pointer-events-auto flex flex-col min-w-[280px] max-w-[360px] rounded-xl bg-mission-control-surface border border-mission-control-border shadow-xl overflow-hidden ${border} transition-[transform,opacity] duration-300 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <AlertRegion message={announcement} />

      <div className="flex items-start gap-3 px-4 py-3">
        <Icon size={16} className={`flex-shrink-0 mt-0.5 ${icon}`} />

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-mission-control-text">{toast.title}</div>
          {toast.message && (
            <div className="text-xs text-mission-control-text-dim/80 mt-0.5">{toast.message}</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="ml-auto flex-shrink-0 p-1 rounded hover:bg-mission-control-border/40 text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-mission-control-border/30">
        <div
          className={`h-full ${progressColor[toast.type]} transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
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
      className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none"
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
