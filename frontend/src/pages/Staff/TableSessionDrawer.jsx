import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCheck, CreditCard, DoorClosed, Loader2, Receipt, RotateCcw, Wallet } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { staffApi } from '../../lib/api.js';
import {
  CALL_TYPE_LABELS,
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATE_LABELS,
  TABLE_STATUS_META,
  formatElapsed,
  formatKurus,
  formatTimeTR,
  kurusToInput,
  parseTlToKurus,
  tableLabel,
} from '../../lib/format.js';
import { useStaff } from './StaffContext.js';

const SESSION_STATUS_LABELS = {
  open: 'Açık',
  payment_pending: 'Ödeme bekleniyor',
  paid: 'Ödendi',
  closed: 'Kapandı',
  cancelled: 'İptal',
};

const PAYABLE_SESSION_STATUSES = ['open', 'payment_pending'];

export default function TableSessionDrawer({ tableId, onClose }) {
  const { can, currency, tableVersions, reloadTables, calls, respondCall } = useStaff();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { kind: 'refund' | 'close', payment? }

  const version = tableId ? tableVersions[String(tableId)] || 0 : 0;

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!tableId) return;
      if (!silent) setLoading(true);
      try {
        setData(await staffApi.getTableSession(tableId));
        setError('');
      } catch (err) {
        setError(err.message || 'Adisyon yüklenemedi.');
      } finally {
        setLoading(false);
      }
    },
    [tableId]
  );

  // Çekmece açıldığında yükle
  useEffect(() => {
    if (!tableId) {
      setData(null);
      setConfirm(null);
      return;
    }
    load();
  }, [tableId, load]);

  // Bu masaya ait canlı olay geldiğinde sessizce yenile
  useEffect(() => {
    if (tableId && version > 0) load({ silent: true });
  }, [version, tableId, load]);

  const table = data?.table;
  const session = data?.session;
  const orders = data?.orders || [];
  const payments = data?.payments || [];
  const remaining = session?.remainingAmount ?? 0;
  const tableCalls = useMemo(
    () => calls.filter((c) => String(c.table?._id ?? c.table) === String(tableId)),
    [calls, tableId]
  );

  const afterChange = () => {
    load({ silent: true });
    reloadTables().catch(() => {});
  };

  const handleRefund = async (payment) => {
    try {
      await staffApi.refundPayment(payment._id);
      toast({
        title: 'Ödeme iade edildi',
        description: `${PAYMENT_METHOD_LABELS[payment.method]} · ${formatKurus(payment.amount + (payment.tipAmount || 0), currency)}`,
        variant: 'success',
      });
      setConfirm(null);
      afterChange();
    } catch (err) {
      toast({ title: 'İade yapılamadı', description: err.message, variant: 'error' });
    }
  };

  const handleClose = async () => {
    try {
      await staffApi.closeSession(session._id, { force: remaining > 0 });
      toast({ title: `${tableLabel(table)} kapatıldı`, description: 'Masa yeniden boş olarak işaretlendi.', variant: 'success' });
      setConfirm(null);
      reloadTables().catch(() => {});
      onClose();
    } catch (err) {
      toast({ title: 'Masa kapatılamadı', description: err.message, variant: 'error' });
    }
  };

  const tableMeta = table ? TABLE_STATUS_META[table.status] || TABLE_STATUS_META.available : null;

  return (
    <>
      <Modal
        open={Boolean(tableId)}
        onClose={onClose}
        variant="drawer"
        title={table ? tableLabel(table) : 'Adisyon'}
        subtitle={
          table && (
            <span className="inline-flex items-center gap-2">
              <span>{table.area}</span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tableMeta.badgeClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tableMeta.dotClass}`} />
                {tableMeta.label}
              </span>
            </span>
          )
        }
        footer={
          session && can.takePayment ? (
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'close' })}
              className="w-full py-3 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 bg-muted hover:bg-line text-ink transition"
            >
              <DoorClosed className="w-4 h-4" />
              Masayı Kapat
            </button>
          ) : null
        }
      >
        {loading && !data ? (
          <div className="py-16 flex items-center justify-center gap-3 text-ink-soft">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="text-sm">Adisyon yükleniyor…</span>
          </div>
        ) : error ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-rose-600">{error}</p>
            <button type="button" onClick={() => load()} className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line transition">
              Tekrar Dene
            </button>
          </div>
        ) : !session ? (
          <div className="py-16 flex flex-col items-center text-center gap-3 text-ink-soft">
            <Receipt className="w-8 h-8 text-ink-faint" />
            <p className="text-sm">Bu masada açık adisyon yok.</p>
            <p className="text-xs text-ink-faint">Müşteri QR ile sipariş verdiğinde adisyon otomatik açılır.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <SummaryCard session={session} currency={currency} />

            {tableCalls.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint">Bekleyen çağrılar</h3>
                {tableCalls.map((call) => (
                  <div key={call._id} className="flex items-center gap-3 rounded-2xl border border-amber-700/50 bg-amber-950/40 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{CALL_TYPE_LABELS[call.type]}</p>
                      <p className="text-xs text-ink-soft truncate">
                        {formatElapsed(call.createdAt)}
                        {call.status === 'acknowledged' && ' · Görüldü'}
                        {call.note && ` · ${call.note}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => respondCall(call._id, 'resolved')}
                      className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Tamamlandı
                    </button>
                  </div>
                ))}
              </section>
            )}

            {can.takePayment && PAYABLE_SESSION_STATUSES.includes(session.status) && remaining > 0 && (
              <PaymentForm session={session} remaining={remaining} currency={currency} onPaid={afterChange} />
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint">Siparişler ({orders.length})</h3>
              {orders.length === 0 && <p className="text-sm text-ink-faint">Henüz sipariş yok.</p>}
              {orders.map((order) => (
                <OrderBlock key={order._id} order={order} currency={currency} />
              ))}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint">Ödemeler ({payments.length})</h3>
              {payments.length === 0 && <p className="text-sm text-ink-faint">Henüz ödeme alınmadı.</p>}
              {payments.map((payment) => (
                <PaymentRow
                  key={payment._id}
                  payment={payment}
                  currency={currency}
                  onRefund={can.refund && payment.status === 'success' ? () => setConfirm({ kind: 'refund', payment }) : null}
                />
              ))}
            </section>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'refund'}
        title="Ödeme iade edilsin mi?"
        description={
          confirm?.payment && (
            <>
              <p>
                {PAYMENT_METHOD_LABELS[confirm.payment.method]} ile alınan{' '}
                <strong className="text-ink">{formatKurus(confirm.payment.amount + (confirm.payment.tipAmount || 0), currency)}</strong>{' '}
                iade edilecek ve masanın kalan tutarına geri eklenecek.
              </p>
              {confirm.payment.method === 'online_card' && (
                <p className="mt-2 text-ink-soft">Online kart ödemesi İyzico üzerinden müşterinin kartına iade edilir.</p>
              )}
              <p className="mt-2 text-ink-soft">Bu işlem geri alınamaz.</p>
            </>
          )
        }
        confirmLabel="İade Et"
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={() => handleRefund(confirm.payment)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'close'}
        title={remaining > 0 ? 'Ödenmemiş tutar var' : 'Masa kapatılsın mı?'}
        description={
          remaining > 0 ? (
            <p>
              Masada <strong className="text-rose-600">{formatKurus(remaining, currency)}</strong> ödenmemiş tutar var. Yine de
              kapatırsanız bu tutar tahsil edilmemiş olarak kalır ve masa boşa çıkar.
            </p>
          ) : (
            <p>Adisyon kapanacak ve masa yeni müşteriler için boş olarak işaretlenecek.</p>
          )
        }
        confirmLabel={remaining > 0 ? 'Yine de Kapat' : 'Masayı Kapat'}
        tone={remaining > 0 ? 'danger' : 'primary'}
        onClose={() => setConfirm(null)}
        onConfirm={handleClose}
      />
    </>
  );
}

function SummaryCard({ session, currency }) {
  return (
    <div className="rounded-3xl bg-card border border-line p-4">
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>
          {SESSION_STATUS_LABELS[session.status] || session.status} · {formatTimeTR(session.openedAt)} açıldı
        </span>
        <span>{formatElapsed(session.openedAt)}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Toplam" value={formatKurus(session.totalAmount, currency)} />
        <Stat label="Ödenen" value={formatKurus(session.paidAmount, currency)} tone="text-emerald-700" />
        <Stat
          label="Kalan"
          value={formatKurus(session.remainingAmount, currency)}
          tone={session.remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-700'}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-ink' }) {
  return (
    <div>
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className={`text-base font-extrabold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function OrderBlock({ order, currency }) {
  const meta = ORDER_STATUS_META[order.status];
  const cancelled = order.status === 'cancelled';
  return (
    <div className={`rounded-2xl border border-line bg-card p-3 ${cancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-ink">#{order.orderNumber}</span>
        <span className="text-xs text-ink-faint">{formatTimeTR(order.createdAt)}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-soft">
          <span className={`w-1.5 h-1.5 rounded-full ${meta?.dotClass || 'bg-ink-faint'}`} />
          {meta?.shortLabel || order.status}
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        {order.items.map((item) => (
          <li key={item._id} className="flex gap-2 text-sm">
            <span className="text-ink-soft tabular-nums shrink-0">{item.quantity}×</span>
            <span className={`flex-1 min-w-0 ${cancelled ? 'line-through text-ink-faint' : 'text-ink'}`}>
              {item.name}
              {item.selectedOptions?.length > 0 && (
                <span className="block text-xs text-ink-faint">{item.selectedOptions.map((o) => o.choiceName).join(', ')}</span>
              )}
            </span>
            <span className="tabular-nums text-ink-soft">{formatKurus(item.lineTotal, currency)}</span>
          </li>
        ))}
      </ul>
      {order.serviceCharge > 0 && (
        <p className="mt-1 flex justify-between text-xs text-ink-faint">
          <span>Servis ücreti</span>
          <span className="tabular-nums">{formatKurus(order.serviceCharge, currency)}</span>
        </p>
      )}
      {cancelled && order.cancelReason && <p className="mt-1 text-xs text-rose-600">İptal nedeni: {order.cancelReason}</p>}
    </div>
  );
}

function PaymentRow({ payment, currency, onRefund }) {
  const Icon = payment.method === 'cash' ? Banknote : payment.method === 'pos_card' ? CreditCard : Wallet;
  const refunded = payment.status === 'refunded';
  const failed = payment.status === 'failed' || payment.status === 'cancelled' || payment.status === 'pending';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5">
      <Icon className="w-4 h-4 text-ink-soft shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold tabular-nums ${refunded || failed ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {formatKurus(payment.amount, currency)}
          {payment.tipAmount > 0 && <span className="font-normal text-ink-soft"> + {formatKurus(payment.tipAmount, currency)} bahşiş</span>}
        </p>
        <p className="text-xs text-ink-faint truncate">
          {PAYMENT_METHOD_LABELS[payment.method]} · {formatTimeTR(payment.paidAt || payment.createdAt)}
          {payment.receivedBy?.name && ` · ${payment.receivedBy.name}`}
          {payment.status !== 'success' && ` · ${PAYMENT_STATE_LABELS[payment.status] || payment.status}`}
        </p>
      </div>
      {onRefund && (
        <button
          type="button"
          onClick={onRefund}
          className="h-9 px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          İade Et
        </button>
      )}
    </div>
  );
}

function PaymentForm({ session, remaining, currency, onPaid }) {
  const { toast } = useToast();
  const [method, setMethod] = useState('cash');
  const [amountInput, setAmountInput] = useState('');
  const [tipInput, setTipInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = amountInput.trim() ? parseTlToKurus(amountInput) : remaining;
  const parsedTip = tipInput.trim() ? parseTlToKurus(tipInput) : 0;

  const validate = () => {
    if (parsedAmount === null || parsedAmount <= 0) return 'Geçerli bir tutar girin (örn. 125,50).';
    if (parsedAmount > remaining) return `Tutar kalan hesaptan (${formatKurus(remaining, currency)}) fazla olamaz.`;
    if (parsedTip === null) return 'Bahşiş tutarını kontrol edin (örn. 20 veya 20,50).';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setSubmitting(true);
    try {
      await staffApi.addPayment(session._id, {
        method,
        amount: parsedAmount === remaining && !amountInput.trim() ? undefined : parsedAmount,
        tipAmount: parsedTip || undefined,
      });
      toast({
        title: `${PAYMENT_METHOD_LABELS[method]} ödeme alındı`,
        description: `${formatKurus(parsedAmount, currency)}${parsedTip ? ` + ${formatKurus(parsedTip, currency)} bahşiş` : ''}`,
        variant: 'success',
      });
      setAmountInput('');
      setTipInput('');
      setError('');
      onPaid();
    } catch (err) {
      setError(err.message || 'Ödeme kaydedilemedi, tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const half = Math.round(remaining / 2);
  const perGuest = session.guestCount > 1 ? Math.ceil(remaining / session.guestCount) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-3xl border border-line bg-card p-4 space-y-4">
      <h3 className="text-sm font-bold text-ink">Ödeme Al</h3>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ödeme yöntemi">
        {[
          { value: 'cash', label: 'Nakit', icon: Banknote },
          { value: 'pos_card', label: 'POS (Kart)', icon: CreditCard },
        ].map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={`py-3 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 border transition ${
              method === value ? 'bg-brand-600 border-brand-500 text-white' : 'bg-muted border-line text-ink-soft hover:border-ink-faint/60'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pay-amount" className="block text-sm font-medium text-ink-soft">
          Tutar (₺)
        </label>
        <input
          id="pay-amount"
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => {
            setAmountInput(e.target.value);
            if (error) setError('');
          }}
          placeholder={kurusToInput(remaining)}
          className="w-full rounded-2xl bg-muted border border-line px-4 py-3 text-sm text-ink tabular-nums placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          <QuickAmount label="Tamamı" onClick={() => setAmountInput('')} active={!amountInput.trim()} />
          <QuickAmount label={`Yarısı · ${formatKurus(half, currency)}`} onClick={() => setAmountInput(kurusToInput(half))} />
          {perGuest && (
            <QuickAmount
              label={`Kişi başı (${session.guestCount}) · ${formatKurus(perGuest, currency)}`}
              onClick={() => setAmountInput(kurusToInput(Math.min(perGuest, remaining)))}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pay-tip" className="block text-sm font-medium text-ink-soft">
          Bahşiş (₺) <span className="text-ink-faint font-normal">(isteğe bağlı)</span>
        </label>
        <input
          id="pay-tip"
          type="text"
          inputMode="decimal"
          value={tipInput}
          onChange={(e) => {
            setTipInput(e.target.value);
            if (error) setError('');
          }}
          placeholder="0,00"
          className="w-full rounded-2xl bg-muted border border-line px-4 py-3 text-sm text-ink tabular-nums placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-2xl text-sm font-bold inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-60"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {parsedAmount && parsedAmount > 0
          ? `${formatKurus(parsedAmount + (parsedTip || 0), currency)} ${PAYMENT_METHOD_LABELS[method]} Tahsil Et`
          : 'Tahsil Et'}
      </button>
    </form>
  );
}

function QuickAmount({ label, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
        active ? 'bg-card border-ink-faint/60 text-ink shadow-sm' : 'bg-muted border-line text-ink-soft hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}
