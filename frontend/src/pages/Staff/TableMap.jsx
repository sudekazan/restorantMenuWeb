import React, { useMemo, useState } from 'react';
import { BellRing, Clock, LayoutGrid, Loader2, Users } from 'lucide-react';
import { CALL_TYPE_LABELS, TABLE_STATUS_META, formatElapsed, formatKurus } from '../../lib/format.js';
import { useNow } from '../../hooks/useNow.js';
import { useStaff } from './StaffContext.js';
import TableSessionDrawer from './TableSessionDrawer.jsx';

const SUMMARY_STATUSES = ['available', 'occupied', 'awaiting_payment', 'reserved'];

export default function TableMap() {
  const { tables, calls, loading, currency, highlighted } = useStaff();
  const now = useNow(30000);
  const [area, setArea] = useState('all');
  const [openTableId, setOpenTableId] = useState(null);

  const areas = useMemo(() => [...new Set(tables.map((t) => t.area || 'Salon'))], [tables]);

  const grouped = useMemo(() => {
    const visible = area === 'all' ? tables : tables.filter((t) => (t.area || 'Salon') === area);
    const map = new Map();
    for (const t of visible) {
      const key = t.area || 'Salon';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()];
  }, [tables, area]);

  // Yeni gelen (vurgulu) çağrısı olan masalar yanıp söner
  const alertTableIds = useMemo(
    () => new Set(calls.filter((c) => highlighted.has(String(c._id))).map((c) => String(c.table?._id ?? c.table))),
    [calls, highlighted]
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(SUMMARY_STATUSES.map((s) => [s, 0]));
    for (const t of tables) if (c[t.status] !== undefined) c[t.status] += 1;
    return c;
  }, [tables]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-ink-soft">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm">Masalar yükleniyor…</span>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-6 text-ink-soft">
        <LayoutGrid className="w-8 h-8 text-ink-faint" />
        <p className="text-sm">Henüz tanımlı masa yok. Masalar yönetici panelinden eklenir.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {SUMMARY_STATUSES.map((status) => (
          <span
            key={status}
            className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${TABLE_STATUS_META[status].badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${TABLE_STATUS_META[status].dotClass}`} />
            {TABLE_STATUS_META[status].label}: {counts[status]}
          </span>
        ))}

        {areas.length > 1 && (
          <div className="ml-auto flex gap-1 bg-muted border border-line rounded-2xl p-1" role="tablist" aria-label="Alan filtresi">
            {['all', ...areas].map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={area === a}
                onClick={() => setArea(a)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  area === a ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {a === 'all' ? 'Tümü' : a}
              </button>
            ))}
          </div>
        )}
      </div>

      {grouped.map(([areaName, list]) => (
        <section key={areaName} aria-label={areaName} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">{areaName}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {list.map((table) => (
              <TableCard
                key={table._id}
                table={table}
                now={now}
                currency={currency}
                onOpen={() => setOpenTableId(table._id)}
                pulse={alertTableIds.has(String(table._id))}
              />
            ))}
          </div>
        </section>
      ))}

      <TableSessionDrawer tableId={openTableId} onClose={() => setOpenTableId(null)} />
    </div>
  );
}

function TableCard({ table, now, currency, onOpen, pulse }) {
  const meta = TABLE_STATUS_META[table.status] || TABLE_STATUS_META.available;
  const session = table.currentSession;
  const calls = table.pendingCalls;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative text-left rounded-3xl border p-4 min-h-[8.5rem] flex flex-col gap-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${meta.cardClass} ${
        pulse ? 'animate-attention' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold text-ink tabular-nums leading-none">{table.number}</p>
          {table.name && <p className="text-xs text-ink-soft truncate mt-1">{table.name}</p>}
        </div>
        {calls?.count > 0 && (
          <span
            title={calls.types.map((t) => CALL_TYPE_LABELS[t] || t).join(', ')}
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500 text-ink"
          >
            <BellRing className="w-3 h-3" />
            {calls.count}
          </span>
        )}
      </div>

      <span className={`self-start inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
        {meta.label}
      </span>

      {session ? (
        <div className="mt-auto space-y-1">
          <p className="text-sm font-bold text-ink tabular-nums">
            {session.remainingAmount > 0 ? formatKurus(session.remainingAmount, currency) : 'Ödendi'}
          </p>
          <p className="flex items-center gap-2 text-[11px] text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatElapsed(session.openedAt, now)}
            </span>
            {session.guestCount > 1 && (
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {session.guestCount}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="mt-auto text-[11px] text-ink-faint">{table.capacity ? `${table.capacity} kişilik` : 'Boş masa'}</p>
      )}
    </button>
  );
}
