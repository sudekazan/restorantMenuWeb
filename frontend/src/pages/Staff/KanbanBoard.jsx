import React, { useMemo, useRef, useState } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { KANBAN_COLUMNS, ORDER_STATUS_META } from '../../lib/format.js';
import { useNow } from '../../hooks/useNow.js';
import { positionBetween, sortByPosition, useStaff } from './StaffContext.js';
import OrderCard from './OrderCard.jsx';
import CancelOrderDialog from './CancelOrderDialog.jsx';

const COLUMN_STYLE = {
  new: { title: 'Yeni', accent: 'bg-amber-400', dropRing: 'ring-amber-400/60' },
  preparing: { title: 'Hazırlanıyor', accent: 'bg-sky-400', dropRing: 'ring-sky-400/60' },
  ready: { title: 'Hazır', accent: 'bg-violet-400', dropRing: 'ring-violet-400/60' },
  delivered: { title: 'Teslim Edildi', accent: 'bg-emerald-400', dropRing: 'ring-emerald-400/60' },
};

// Teslim edilenler kolonu en yeni üstte gösterilir ve sınırlı tutulur
const DELIVERED_LIMIT = 30;

function nextStatus(status) {
  const idx = KANBAN_COLUMNS.indexOf(status);
  return idx >= 0 && idx < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[idx + 1] : null;
}

function prevStatus(status) {
  const idx = KANBAN_COLUMNS.indexOf(status);
  return idx > 0 ? KANBAN_COLUMNS[idx - 1] : null;
}

export default function KanbanBoard() {
  const { orders, loading, updateOrder, highlighted, currency } = useStaff();
  const now = useNow(30000);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { status, index }
  const [cancelTarget, setCancelTarget] = useState(null);
  const listRefs = useRef({});

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(KANBAN_COLUMNS.map((s) => [s, []]));
    for (const order of orders) if (grouped[order.status]) grouped[order.status].push(order);
    for (const status of KANBAN_COLUMNS) grouped[status] = sortByPosition(grouped[status]);
    grouped.delivered = grouped.delivered.reverse();
    return grouped;
  }, [orders]);

  /** Kolonun sonuna (teslim edilenlerde en üste) yerleşecek pozisyon. */
  const endPosition = (status, excludeId) => {
    const list = sortByPosition(orders.filter((o) => o.status === status && o._id !== excludeId));
    return positionBetween(list[list.length - 1]?.kanbanPosition ?? null, null);
  };

  const moveTo = (order, status) => updateOrder(order._id, { status, kanbanPosition: endPosition(status, order._id) });

  /* ---------- HTML5 Drag & Drop ---------- */

  const computeDropIndex = (status, clientY) => {
    const container = listRefs.current[status];
    if (!container) return 0;
    const cards = [...container.querySelectorAll('[data-order-card]')].filter((el) => el.dataset.orderId !== dragId);
    const idx = cards.findIndex((el) => {
      const rect = el.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    return idx === -1 ? cards.length : idx;
  };

  const handleDragOver = (status) => (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const index = status === 'delivered' ? 0 : computeDropIndex(status, e.clientY);
    setDropTarget((prev) => (prev?.status === status && prev.index === index ? prev : { status, index }));
  };

  const handleDragLeave = (status) => (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropTarget((prev) => (prev?.status === status ? null : prev));
  };

  const handleDrop = (status) => (e) => {
    e.preventDefault();
    const id = dragId || e.dataTransfer.getData('text/plain');
    const order = orders.find((o) => o._id === id);
    const index = dropTarget?.status === status ? dropTarget.index : 0;
    setDragId(null);
    setDropTarget(null);
    if (!order) return;

    if (status === 'delivered') {
      if (order.status !== 'delivered') moveTo(order, 'delivered');
      return;
    }

    const list = columns[status].filter((o) => o._id !== id);
    const prev = list[index - 1]?.kanbanPosition ?? null;
    const next = list[index]?.kanbanPosition ?? null;

    // Aynı kolonda aynı yere bırakıldıysa istek atma
    if (order.status === status) {
      const original = columns[status].findIndex((o) => o._id === id);
      if (original === index) return;
    }

    const patch = { kanbanPosition: positionBetween(prev, next) };
    if (order.status !== status) patch.status = status;
    updateOrder(order._id, patch);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-ink-soft">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm">Siparişler yükleniyor…</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="h-full grid grid-flow-col auto-cols-[minmax(232px,1fr)] gap-3 p-3 lg:p-4 min-w-max lg:min-w-0">
          {KANBAN_COLUMNS.map((status) => {
            const style = COLUMN_STYLE[status];
            const list = status === 'delivered' ? columns[status].slice(0, DELIVERED_LIMIT) : columns[status];
            const total = columns[status].length;
            const isDropping = dropTarget?.status === status;

            return (
              <section
                key={status}
                aria-label={`${style.title} siparişler`}
                onDragOver={handleDragOver(status)}
                onDragLeave={handleDragLeave(status)}
                onDrop={handleDrop(status)}
                className={`flex flex-col min-h-0 rounded-3xl bg-muted border border-line transition ${
                  isDropping ? `ring-2 ${style.dropRing} bg-line/50` : ''
                }`}
              >
                <header className="flex items-center gap-2 px-4 pt-4 pb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${style.accent}`} />
                  <h2 className="text-sm font-bold text-ink">{style.title}</h2>
                  <span className="ml-auto text-xs font-semibold text-ink-soft bg-card rounded-full px-2 py-0.5">
                    {total}
                  </span>
                </header>

                <div
                  ref={(el) => {
                    listRefs.current[status] = el;
                  }}
                  className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-2.5"
                >
                  {list.length === 0 && !isDropping && (
                    <div className="h-32 flex flex-col items-center justify-center text-center gap-2 text-ink-faint border border-dashed border-line rounded-2xl">
                      <Inbox className="w-5 h-5" />
                      <p className="text-xs">
                        {status === 'new' ? 'Yeni sipariş bekleniyor' : `${ORDER_STATUS_META[status].shortLabel} sipariş yok`}
                      </p>
                    </div>
                  )}

                  {(() => {
                    let visibleIndex = -1;
                    return list.map((order) => {
                      const isDragged = order._id === dragId;
                      if (!isDragged) visibleIndex += 1;
                      return (
                        <React.Fragment key={order._id}>
                          {isDropping && !isDragged && dropTarget.index === visibleIndex && <DropIndicator />}
                          <OrderCard
                            order={order}
                            now={now}
                            currency={currency}
                            highlighted={highlighted.has(String(order._id))}
                            dragging={isDragged}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', order._id);
                              setDragId(order._id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropTarget(null);
                            }}
                            onForward={nextStatus(order.status) ? () => moveTo(order, nextStatus(order.status)) : null}
                            onBack={prevStatus(order.status) ? () => moveTo(order, prevStatus(order.status)) : null}
                            onCancel={
                              order.status !== 'delivered' && order.paymentStatus !== 'paid' ? () => setCancelTarget(order) : null
                            }
                          />
                        </React.Fragment>
                      );
                    });
                  })()}
                  {isDropping && dropTarget.index >= list.filter((o) => o._id !== dragId).length && <DropIndicator />}

                  {status === 'delivered' && total > DELIVERED_LIMIT && (
                    <p className="text-center text-xs text-ink-faint py-2">Son {DELIVERED_LIMIT} teslimat gösteriliyor</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <CancelOrderDialog
        order={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          const ok = await updateOrder(cancelTarget._id, { status: 'cancelled', cancelReason: reason || undefined });
          if (ok) setCancelTarget(null);
          return ok;
        }}
      />
    </>
  );
}

function DropIndicator() {
  return <div className="h-1.5 rounded-full bg-brand-500/80" aria-hidden="true" />;
}
