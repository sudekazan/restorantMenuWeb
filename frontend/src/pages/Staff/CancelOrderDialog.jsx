import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { tableLabel } from '../../lib/format.js';

export default function CancelOrderDialog({ order, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) {
      setReason('');
      setBusy(false);
    }
  }, [order]);

  const handleConfirm = async () => {
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    if (!ok) setBusy(false);
  };

  return (
    <Modal
      open={Boolean(order)}
      onClose={busy ? undefined : onClose}
      title={order ? `Sipariş #${order.orderNumber} iptal edilsin mi?` : ''}
      subtitle={order ? `${tableLabel(order.table)} · İptal edilen sipariş adisyondan düşülür ve geri alınamaz.` : ''}
      footer={
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line transition disabled:opacity-60"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white inline-flex items-center gap-2 transition disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Siparişi İptal Et
          </button>
        </div>
      }
    >
      <label htmlFor="cancel-reason" className="block text-sm font-medium text-ink-soft mb-1.5">
        İptal nedeni <span className="text-ink-faint font-normal">(isteğe bağlı)</span>
      </label>
      <input
        id="cancel-reason"
        type="text"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Örn: Müşteri vazgeçti, ürün tükendi"
        className="w-full rounded-2xl bg-muted border border-line px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
      />
    </Modal>
  );
}
