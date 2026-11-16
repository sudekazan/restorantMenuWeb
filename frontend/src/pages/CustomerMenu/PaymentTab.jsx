import React, { useEffect, useRef, useState } from 'react';
import {
  CreditCard,
  Banknote,
  CheckCircle2,
  Split,
  ShieldCheck,
  Receipt,
  X,
  Sparkles,
} from 'lucide-react';
import { formatKurus, formatTimeTR } from '../../lib/format.js';

/**
 * İyzico Checkout Form HTML içeriğini (<script> etiketlerini çalıştırarak)
 * güvenli bir kapsayıcı içine yerleştirir.
 */
function IyzicoFormHost({ html }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !html) return;
    el.innerHTML = html;

    // İyzico'nun döndürdüğü <script> etiketlerini çalıştır
    const scripts = Array.from(el.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.text = oldScript.text;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [html]);

  return <div ref={containerRef} className="w-full" />;
}

export default function PaymentTab({
  session,
  orders = [],
  payments = [],
  currency = 'TRY',
  allowOnlinePayment = true,
  allowCashPayment = true,
  onInitOnlinePayment,
  onRequestCashOrBill,
}) {
  const remaining = session?.remainingAmount || 0;
  const totalAmount = session?.totalAmount || 0;
  const paidAmount = session?.paidAmount || 0;

  const [splitMode, setSplitMode] = useState('full'); // 'full' | 'half' | 'third' | 'custom'
  const [customTl, setCustomTl] = useState('');
  const [tipPercent, setTipPercent] = useState(0); // 0, 5, 10, 15
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);

  // Ödenecek ana tutar (kuruş)
  let payAmount = remaining;
  if (splitMode === 'half') payAmount = Math.max(100, Math.round(remaining / 2));
  else if (splitMode === 'third') payAmount = Math.max(100, Math.round(remaining / 3));
  else if (splitMode === 'custom') {
    const parsed = Math.round(Number(String(customTl).replace(',', '.')) * 100);
    payAmount = Number.isFinite(parsed) && parsed > 0 ? Math.min(remaining, parsed) : 0;
  }

  const tipAmount = Math.round((payAmount * tipPercent) / 100);
  const totalCharged = payAmount + tipAmount;

  const handleStartOnlinePayment = async () => {
    if (payAmount <= 0 || loadingCheckout) return;
    setLoadingCheckout(true);
    try {
      const data = await onInitOnlinePayment({
        amount: payAmount,
        tipAmount,
      });
      if (data) setCheckoutData(data);
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (!session || totalAmount === 0) {
    return (
      <div className="px-4 pt-6 pb-28">
        <div className="bg-card rounded-3xl border border-line/80 p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-muted text-ink-faint flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-ink">Açık Hesap Bulunmuyor</h2>
          <p className="text-xs text-ink-faint">
            Sipariş verdiğinizde masa adisyonunuz ve online ödeme seçenekleriniz burada görünecektir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-5">
      {/* Adisyon Özet Kartı */}
      <div className="bg-card border border-line text-ink rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Masa Adisyonu
          </span>
          {remaining === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tamamı Ödendi
            </span>
          ) : (
            <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
              Ödeme Bekliyor
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-muted rounded-2xl p-3">
            <p className="text-[11px] text-ink-faint">Toplam</p>
            <p className="text-sm font-extrabold mt-0.5">{formatKurus(totalAmount, currency)}</p>
          </div>
          <div className="bg-muted rounded-2xl p-3">
            <p className="text-[11px] text-ink-faint">Ödenen</p>
            <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
              {formatKurus(paidAmount, currency)}
            </p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-3">
            <p className="text-[11px] text-brand-700">Kalan</p>
            <p className="text-sm font-extrabold text-ink mt-0.5">
              {formatKurus(remaining, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Kalan Tutar Varsa Ödeme Seçenekleri */}
      {remaining > 0 && (
        <div className="bg-card rounded-3xl border border-line/80 p-5 shadow-xs space-y-5">
          {/* Hesabı Böl / Tutar Seçimi */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-ink flex items-center gap-1.5">
                <Split className="w-4 h-4 text-brand-600" />
                <span>Ödenecek Tutar</span>
              </h3>
              <span className="text-xs text-ink-faint">Hesabı bölebilirsiniz</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'full', label: 'Tamamı' },
                { id: 'half', label: '1/2 Yarısı' },
                { id: 'third', label: '1/3 Üçte Biri' },
                { id: 'custom', label: 'Özel Tutar' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSplitMode(opt.id)}
                  className={`py-2.5 px-2 rounded-2xl text-xs font-bold border transition ${
                    splitMode === opt.id
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'bg-app text-ink-soft border-line hover:border-ink-faint/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {splitMode === 'custom' && (
              <div className="pt-1">
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={customTl}
                  onChange={(e) => setCustomTl(e.target.value)}
                  placeholder={`Ödenecek tutarı girin (Maks: ${(remaining / 100).toFixed(2)} TL)`}
                  className="w-full rounded-2xl border border-line bg-app px-4 py-2.5 text-sm font-semibold text-ink focus:bg-card focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Bahşiş Seçimi */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Bahşiş Ekle</span>
              </h3>
              {tipAmount > 0 && (
                <span className="text-xs font-bold text-emerald-700">
                  +{formatKurus(tipAmount, currency)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[0, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setTipPercent(pct)}
                  className={`py-2 rounded-2xl text-xs font-bold border transition ${
                    tipPercent === pct
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-app text-ink-soft border-line'
                  }`}
                >
                  {pct === 0 ? 'Yok' : `%${pct}`}
                </button>
              ))}
            </div>
          </div>

          {/* Online Kredi Kartı (İyzico) & Nakit Butonları */}
          <div className="space-y-2.5 pt-1">
            {allowOnlinePayment && (
              <button
                type="button"
                disabled={payAmount <= 0 || loadingCheckout}
                onClick={handleStartOnlinePayment}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-4 px-5 rounded-2xl shadow-lg shadow-brand-600/25 flex items-center justify-between transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5" />
                  <span>{loadingCheckout ? 'İyzico Hazırlanıyor...' : 'Kredi / Banka Kartı ile Öde'}</span>
                </div>
                <span className="font-extrabold">{formatKurus(totalCharged, currency)}</span>
              </button>
            )}

            {allowCashPayment && (
              <button
                type="button"
                onClick={() => onRequestCashOrBill('request_cash_payment')}
                className="w-full bg-muted hover:bg-line text-ink font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 text-xs transition"
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Masaya Nakit / Fiziksel POS İste</span>
              </button>
            )}

            <p className="text-[11px] text-ink-faint text-center flex items-center justify-center gap-1 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>256-bit SSL ve iyzico Korumalı Ödeme altyapısı</span>
            </p>
          </div>
        </div>
      )}

      {/* Adisyon Kalem Dökümü */}
      <div className="bg-card rounded-3xl border border-line/80 p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-ink">Adisyon Kalemleri</h3>
        <div className="divide-y divide-line text-xs">
          {orders
            .filter((o) => o.status !== 'cancelled')
            .flatMap((o) => o.items || [])
            .map((item, idx) => (
              <div key={item._id || idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink">{item.quantity}x </span>
                  <span className="text-ink-soft">{item.name}</span>
                </div>
                <span className="font-semibold text-ink">
                  {formatKurus(item.lineTotal, currency)}
                </span>
              </div>
            ))}
        </div>

        {payments.length > 0 && (
          <div className="pt-3 border-t border-line/80 space-y-1.5">
            <p className="text-xs font-bold text-ink-soft">Alınan Ödemeler</p>
            {payments.map((p, idx) => (
              <div key={p._id || idx} className="flex items-center justify-between text-xs text-emerald-700">
                <span>
                  {p.method === 'online_card' ? 'Online Kart (iyzico)' : p.method === 'cash' ? 'Nakit' : 'POS Kart'}{' '}
                  • {formatTimeTR(p.paidAt)}
                </span>
                <span className="font-bold">-{formatKurus(p.amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* İyzico Checkout Form Modal */}
      {checkoutData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full max-w-lg bg-card rounded-t-[2rem] sm:rounded-[2rem] max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <h3 className="text-sm font-extrabold text-ink">Online Güvenli Ödeme</h3>
                <p className="text-xs text-ink-faint">
                  Ödenecek Tutar: {formatKurus(checkoutData.totalCharged, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutData(null)}
                className="w-9 h-9 rounded-full bg-muted text-ink-soft flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <div id="iyzipay-checkout-form" className="responsive" />
              <IyzicoFormHost html={checkoutData.checkoutFormContent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
