import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminApi } from '../../lib/api.js';
import { formatKurus, PAYMENT_METHOD_LABELS } from '../../lib/format.js';
import { inputClass, primaryBtn, secondaryBtn } from './menu/menuUi.jsx';
import { BarList, ColumnChart, StatCard } from './reports/reportUi.jsx';
import { addDaysKey, fillDaily, fillHourly, formatDayLabel, rangeLabel, todayKey } from './reports/reportUtils.js';

const PRESETS = [
  { id: 'today', label: 'Bugün', days: 1 },
  { id: '7d', label: 'Son 7 gün', days: 7 },
  { id: '30d', label: 'Son 30 gün', days: 30 },
  { id: 'custom', label: 'Özel aralık' },
];

const presetRange = (days) => {
  const to = todayKey();
  return { from: addDaysKey(to, -(days - 1)), to };
};

/**
 * Yönetim > Raporlar: GET /admin/reports/summary verisini gösterir.
 * Ciro tahsilat (başarılı ödeme) bazlıdır; sipariş sayıları iptaller hariçtir.
 */
export default function ReportsSection() {
  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(() => presetRange(1));
  const [draft, setDraft] = useState(() => presetRange(7));
  const [draftError, setDraftError] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await adminApi.getReportSummary(range);
      if (id !== reqId.current) return;
      setData(res);
      setError('');
    } catch (err) {
      if (id !== reqId.current) return;
      setError(err.message || 'Rapor yüklenemedi.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const choosePreset = (p) => {
    setPreset(p.id);
    setDraftError('');
    if (p.days) setRange(presetRange(p.days));
  };

  const applyCustom = (e) => {
    e.preventDefault();
    if (!draft.from || !draft.to) return setDraftError('Başlangıç ve bitiş tarihini seçin.');
    if (draft.from > draft.to) return setDraftError('Başlangıç tarihi bitişten sonra olamaz.');
    setDraftError('');
    setRange({ ...draft });
  };

  const heading = (
    <div>
      <h1 className="text-xl font-extrabold text-ink">Raporlar</h1>
      <p className="text-sm text-ink-soft">Ciro, ödeme yöntemleri ve satış analizleri.</p>
    </div>
  );

  const today = todayKey();

  return (
    <section className="space-y-4">
      {heading}

      {/* Tarih aralığı */}
      <div className="bg-card border border-line rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tarih aralığı">
          {PRESETS.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => choosePreset(p)}
                className={`px-3.5 py-2 rounded-2xl text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  active ? 'bg-brand-600 text-white' : 'bg-muted text-ink hover:bg-line'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {preset === 'custom' && (
          <form onSubmit={applyCustom} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <label htmlFor="report-from" className="block text-sm font-semibold text-ink">
                  Başlangıç
                </label>
                <input
                  id="report-from"
                  type="date"
                  max={today}
                  value={draft.from}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="report-to" className="block text-sm font-semibold text-ink">
                  Bitiş
                </label>
                <input
                  id="report-to"
                  type="date"
                  max={today}
                  value={draft.to}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <button type="submit" className={primaryBtn}>
                Raporu Göster
              </button>
            </div>
            {draftError && <p className="text-xs text-rose-600">{draftError}</p>}
          </form>
        )}

        {data?.range && (
          <p className="text-xs text-ink-faint">
            Gösterilen aralık: <span className="font-semibold text-ink-soft">{rangeLabel(data.range.from, data.range.to)}</span>
          </p>
        )}
      </div>

      <ReportBody data={data} loading={loading} error={error} onRetry={load} />
    </section>
  );
}

function ReportBody({ data, loading, error, onRetry }) {
  if (loading && !data) {
    return (
      <div className="py-16 flex items-center justify-center gap-3 text-ink-soft">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm">Rapor yükleniyor…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-3">
        <p className="text-sm text-rose-800">{error}</p>
        <button type="button" onClick={onRetry} className={secondaryBtn}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!data) return null;

  const money = (k) => formatKurus(k, data.currency);
  const { revenue = {}, orders = {}, paymentRatio = {}, topProducts = [], hourly = [], daily = [] } = data;
  const isEmpty = !revenue.total && !orders.count && !orders.cancelled;

  const methods = [
    { key: 'online_card', amount: revenue.online, ratio: paymentRatio.online, bar: 'bg-brand-600' },
    { key: 'cash', amount: revenue.cash, ratio: paymentRatio.cash, bar: 'bg-brand-400' },
    { key: 'pos_card', amount: revenue.posCard, ratio: paymentRatio.posCard, bar: 'bg-brand-200' },
  ];

  const multiDay = data.range && data.range.from !== data.range.to;
  const dailySeries = multiDay ? fillDaily(daily, data.range.from, data.range.to) : [];
  const hourlySeries = fillHourly(hourly);
  const maxQty = Math.max(0, ...topProducts.map((p) => p.quantity || 0));

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Ciro (tahsilat)" value={money(revenue.total)} hint="Başarılı ödemeler" />
        <StatCard label="Sipariş" value={orders.count ?? 0} hint="İptaller hariç" />
        <StatCard label="Ortalama sepet" value={money(orders.averageOrderValue)} />
        <StatCard label="Sipariş tutarı" value={money(orders.grossAmount)} hint="İptaller hariç" />
        <StatCard label="İptal edilen" value={orders.cancelled ?? 0} hint="Sipariş" />
        <StatCard label="Bahşiş" value={money(revenue.tips)} />
      </div>

      {isEmpty ? (
        <div className="bg-card border border-line rounded-3xl p-8 shadow-sm text-center space-y-1">
          <p className="text-sm font-semibold text-ink">Bu aralıkta sipariş veya ödeme yok</p>
          <p className="text-xs text-ink-soft">Başka bir tarih aralığı seçmeyi deneyin.</p>
        </div>
      ) : (
        <>
          <Panel title="Ödeme yöntemleri">
            <ul className="space-y-3">
              {methods.map((m) => (
                <li key={m.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{PAYMENT_METHOD_LABELS[m.key]}</span>
                    <span className="text-ink-soft tabular-nums">
                      {money(m.amount)} <span className="text-ink-faint">· %{(m.ratio ?? 0).toLocaleString('tr-TR')}</span>
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${Math.min(100, m.ratio || 0)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {multiDay && (
            <Panel title="Günlük ciro" subtitle="Başarılı ödemeler">
              <ColumnChart
                items={dailySeries.map((d) => ({
                  key: d.date,
                  label: formatDayLabel(d.date),
                  value: d.total,
                  title: `${formatDayLabel(d.date)}: ${money(d.total)} (online ${money(d.online)})`,
                }))}
                formatValue={money}
                emptyText="Bu aralıkta tahsilat yok."
              />
            </Panel>
          )}

          <Panel title="Saatlik yoğunluk" subtitle="Sipariş adedi, iptaller hariç">
            <ColumnChart
              items={hourlySeries.map((h) => ({
                key: h.hour,
                label: String(h.hour).padStart(2, '0'),
                value: h.orders,
                title: `${String(h.hour).padStart(2, '0')}:00 · ${h.orders} sipariş · ${money(h.revenue)}`,
              }))}
              formatValue={(v) => `${v} sipariş`}
              emptyText="Bu aralıkta sipariş yok."
            />
          </Panel>

          <Panel title="En çok satan ürünler" subtitle="İlk 10, adede göre">
            <BarList
              items={topProducts.map((p, i) => ({
                key: p.productId || `${p.name}-${i}`,
                label: p.name,
                value: p.quantity,
                max: maxQty,
                right: (
                  <>
                    <span className="font-semibold text-ink">{p.quantity} adet</span>
                    <span className="text-ink-faint"> · {money(p.revenue)}</span>
                  </>
                ),
              }))}
              emptyText="Bu aralıkta satılan ürün yok."
            />
          </Panel>
        </>
      )}
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="bg-card border border-line rounded-3xl p-4 shadow-sm min-w-0 space-y-3">
      <header>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}
