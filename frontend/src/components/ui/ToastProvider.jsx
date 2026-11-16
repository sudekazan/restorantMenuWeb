import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, BellRing } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: {
    box: 'bg-emerald-50/95 text-emerald-900 border-emerald-200',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />,
  },
  error: {
    box: 'bg-rose-50/95 text-rose-900 border-rose-200',
    icon: <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />,
  },
  warning: {
    box: 'bg-amber-50/95 text-amber-900 border-amber-200',
    icon: <BellRing className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />,
  },
  info: {
    box: 'bg-card/95 text-ink border-line',
    icon: <Info className="w-5 h-5 text-brand-600 shrink-0" />,
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 4000 }) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, title, description, variant }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed top-4 inset-x-4 sm:left-auto sm:right-5 sm:w-96 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const style = VARIANT_STYLES[t.variant] || VARIANT_STYLES.info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all ${style.box}`}
            >
              {style.icon}
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-sm font-semibold leading-tight">{t.title}</p>}
                {t.description && <p className="text-xs text-ink-soft mt-0.5 leading-snug">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="text-ink-faint hover:text-ink p-1 -mr-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
