'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastTone = 'info' | 'success' | 'warning';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { wrapper: string; Icon: typeof Info }> = {
  info: { wrapper: 'border-blue-200 bg-white text-slate-800', Icon: Info },
  success: { wrapper: 'border-green-200 bg-white text-slate-800', Icon: CheckCircle2 },
  warning: {
    wrapper: 'border-amber-200 bg-white text-slate-800',
    Icon: AlertTriangle,
  },
};

const ICON_COLORS: Record<ToastTone, string> = {
  info: 'text-blue-600',
  success: 'text-green-600',
  warning: 'text-amber-600',
};

/** Lightweight toast host — no external dependency. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { wrapper, Icon } = TONE_STYLES[toast.tone];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-md animate-fade-in-up',
        wrapper
      )}
    >
      <Icon
        className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_COLORS[toast.tone])}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded-lg p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Returns a no-op-safe toast trigger. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: () => undefined };
  }
  return context;
}
