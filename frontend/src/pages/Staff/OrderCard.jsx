import React from 'react';
import { ArrowRight, Clock, GripVertical, MessageSquareText, Undo2, UserRound, X } from 'lucide-react';
import { formatElapsed, formatKurus, formatTimeTR, tableLabel } from '../../lib/format.js';

const FORWARD_LABEL = {
  new: 'Hazırlamaya Başla',
  preparing: 'Hazır',
  ready: 'Teslim Et',
};

const FORWARD_CLASS = {
  new: 'bg-sky-600 hover:bg-sky-500',
  preparing: 'bg-violet-600 hover:bg-violet-500',
  ready: 'bg-emerald-600 hover:bg-emerald-500',
};

/** Bekleme süresine göre renk: 15 dk sonrası uyarı, 25 dk sonrası kritik. */
function elapsedTone(order, now) {
  if (order.status === 'delivered') return 'text-ink-faint';
  const minutes = (now - new Date(order.createdAt).getTime()) / 60000;
  if (minutes >= 25) return 'text-rose-600';
  if (minutes >= 15) return 'text-amber-700';
  return 'text-ink-soft';
}

export default function OrderCard({
  order,
  now,
  currency,
  highlighted,
  dragging,
  onDragStart,
  onDragEnd,
  onForward,
  onBack,
  onCancel,
}) {
  const delivered = order.status === 'delivered';

  return (
    <article
      data-order-card
      data-order-id={order._id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-2xl border bg-card shadow-sm p-3.5 cursor-grab active:cursor-grabbing select-none transition ${
        dragging ? 'opacity-40' : ''
      } ${highlighted ? 'border-amber-400 animate-attention' : 'border-line hover:border-ink-faint/50'} ${
        delivered ? 'opacity-75' : ''
      }`}
    >
      <header className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-ink-faint mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-ink tabular-nums">#{order.orderNumber}</span>
            <span className="text-sm font-semibold text-ink truncate">{tableLabel(order.table)}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-faint">
            {order.table?.area && <span className="truncate">{order.table.area}</span>}
            <span>{formatTimeTR(order.createdAt)}</span>
            {order.source === 'waiter' && (
              <span className="inline-flex items-center gap-1 text-sky-700">
                <UserRound className="w-3 h-3" /> Garson
              </span>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${elapsedTone(order, now)}`}>
          <Clock className="w-3.5 h-3.5" />
          {formatElapsed(order.createdAt, now)}
        </span>
      </header>

      <ul className="mt-3 space-y-2">
        {(order.items || []).map((item) => (
          <li key={item._id} className="text-sm">
            <div className="flex gap-2">
              <span className="font-bold text-brand-600 tabular-nums shrink-0">{item.quantity}×</span>
              <span className="font-medium text-ink">{item.name}</span>
            </div>
            {item.selectedOptions?.length > 0 && (
              <p className="pl-6 text-xs text-ink-soft">
                {item.selectedOptions.map((opt) => `${opt.groupName}: ${opt.choiceName}`).join(' · ')}
              </p>
            )}
            {item.note && <p className="pl-6 text-xs font-medium text-amber-700">“{item.note}”</p>}
          </li>
        ))}
      </ul>

      {order.customerNote && (
        <p className="mt-3 flex gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-2">
          <MessageSquareText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{order.customerNote}</span>
        </p>
      )}

      <footer className="mt-3 pt-2 border-t border-line flex items-center gap-1">
        <span className="text-sm font-bold text-ink tabular-nums whitespace-nowrap mr-auto">
          {formatKurus(order.totalAmount, currency)}
        </span>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            title="Siparişi iptal et"
            aria-label={`Sipariş #${order.orderNumber} iptal et`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            title="Önceki aşamaya geri al"
            aria-label={`Sipariş #${order.orderNumber} önceki aşamaya geri al`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
        )}
      </footer>

      {onForward && (
        <button
          type="button"
          onClick={onForward}
          className={`mt-2 w-full h-10 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white transition ${FORWARD_CLASS[order.status]}`}
        >
          <span>{FORWARD_LABEL[order.status]}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </article>
  );
}
