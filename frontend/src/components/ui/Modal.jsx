import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// Üst üste açılan pencerelerde (çekmece + onay) Esc/Tab yalnızca en üsttekini etkilesin
const modalStack = [];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Koyu tema için erişilebilir temel pencere.
 * variant="dialog": ortada kutu · variant="drawer": sağdan açılan çekmece
 * Esc ile kapanır, odak içeride tutulur ve kapanınca önceki öğeye döner.
 */
export default function Modal({ open, onClose, title, subtitle, children, footer, variant = 'dialog', widthClass, labelledBy }) {
  const panelRef = useRef(null);
  const autoId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const token = {};
    modalStack.push(token);
    const panel = panelRef.current;
    const first = panel?.querySelector('[autofocus], [data-autofocus]') || panel?.querySelector(FOCUSABLE);
    first?.focus();

    const onKey = (e) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const isDrawer = variant === 'drawer';
  const titleId = labelledBy || autoId;

  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <div className="absolute inset-0 bg-stone-900/40 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          isDrawer
            ? `relative ml-auto h-full w-full ${widthClass || 'sm:max-w-lg'} bg-card border-l border-line flex flex-col animate-slide-in-right`
            : `relative m-auto w-[calc(100%-2rem)] ${widthClass || 'max-w-md'} max-h-[90vh] bg-card border border-line shadow-sm rounded-3xl flex flex-col animate-fade-in`
        }
      >
        <header className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-line">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-ink">
              {title}
            </h2>
            {subtitle && <div className="text-sm text-ink-soft mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="w-9 h-9 -mr-1.5 -mt-1 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="px-5 py-4 border-t border-line">{footer}</footer>}
      </div>
    </div>
  );
}
