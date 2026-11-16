import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal.jsx';

const TONE_CLASS = {
  danger: 'bg-rose-600 hover:bg-rose-500',
  warning: 'bg-amber-600 hover:bg-amber-500',
  primary: 'bg-brand-600 hover:bg-brand-700',
};

/** Geri alınamayan işlemler için onay penceresi. onConfirm Promise dönebilir. */
export default function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Vazgeç', tone = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      footer={
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line transition disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={`px-4 py-2.5 rounded-2xl text-sm font-semibold text-white inline-flex items-center gap-2 transition disabled:opacity-60 ${TONE_CLASS[tone] || TONE_CLASS.danger}`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm text-ink-soft leading-relaxed">{description}</div>
    </Modal>
  );
}
