import React, { useMemo, useState } from 'react';
import { BellRing, Check, CheckCheck, Eye, HandCoins, Loader2, MessageCircle, Receipt } from 'lucide-react';
import { CALL_TYPE_LABELS, formatElapsed, tableLabel } from '../../lib/format.js';
import { useNow } from '../../hooks/useNow.js';
import { useStaff } from './StaffContext.js';

const CALL_ICONS = {
  call_waiter: BellRing,
  request_bill: Receipt,
  request_cash_payment: HandCoins,
  other: MessageCircle,
};

/** Bekleyen / görülen garson çağrıları: her sekmede görünen yatay şerit. */
export default function WaiterCallsBar() {
  const { calls, respondCall, highlighted } = useStaff();
  const now = useNow(15000);
  const [busy, setBusy] = useState({}); // { [callId]: 'acknowledged' | 'resolved' }

  const sorted = useMemo(
    () =>
      [...calls].sort((a, b) => {
        // Bekleyenler önce, sonra en eski üstte
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      }),
    [calls]
  );

  if (sorted.length === 0) return null;

  const pendingCount = sorted.filter((c) => c.status === 'pending').length;

  const act = async (callId, status) => {
    setBusy((prev) => ({ ...prev, [callId]: status }));
    await respondCall(callId, status);
    setBusy((prev) => {
      const next = { ...prev };
      delete next[callId];
      return next;
    });
  };

  return (
    <section aria-label="Garson çağrıları" className="shrink-0 border-b border-line bg-card">
      <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3">
        <div className="shrink-0 flex items-center gap-2 text-sm font-semibold">
          <BellRing className={`w-4 h-4 ${pendingCount ? 'text-amber-700' : 'text-ink-faint'}`} />
          <span className="text-ink hidden sm:inline">Çağrılar</span>
          {pendingCount > 0 && (
            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500 text-ink text-[11px] font-bold inline-flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </div>

        <ul className="flex-1 min-w-0 flex gap-2 overflow-x-auto no-scrollbar py-0.5">
          {sorted.map((call) => {
            const Icon = CALL_ICONS[call.type] || BellRing;
            const pending = call.status === 'pending';
            const isBill = call.type === 'request_bill' || call.type === 'request_cash_payment';
            const working = busy[call._id];
            return (
              <li
                key={call._id}
                className={`shrink-0 flex items-center gap-3 pl-3 pr-1.5 py-1.5 rounded-2xl border ${
                  pending
                    ? isBill
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-amber-50 border-amber-200'
                    : 'bg-card border-line'
                } ${highlighted.has(String(call._id)) ? 'animate-attention' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${pending ? (isBill ? 'text-rose-600' : 'text-amber-700') : 'text-ink-faint'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink leading-tight whitespace-nowrap">
                    {tableLabel(call.table)}
                    <span className="font-medium text-ink-soft"> · {CALL_TYPE_LABELS[call.type] || 'Çağrı'}</span>
                  </p>
                  <p className="text-xs text-ink-soft leading-tight whitespace-nowrap max-w-[16rem] truncate">
                    {formatElapsed(call.createdAt, now)}
                    {!pending && ' · Görüldü'}
                    {call.note && ` · ${call.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {pending && (
                    <button
                      type="button"
                      onClick={() => act(call._id, 'acknowledged')}
                      disabled={Boolean(working)}
                      title="Görüldü olarak işaretle"
                      className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold bg-muted hover:bg-line text-ink transition disabled:opacity-60"
                    >
                      {working === 'acknowledged' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                      Görüldü
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => act(call._id, 'resolved')}
                    disabled={Boolean(working)}
                    title="Tamamlandı olarak işaretle"
                    className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-60"
                  >
                    {working === 'resolved' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : pending ? (
                      <CheckCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Tamamlandı
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
