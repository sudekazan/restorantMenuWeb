import React, { useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Send,
  UtensilsCrossed,
  ChefHat,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatKurus, formatTimeTR, ORDER_STATUS_META } from '../../lib/format.js';

export default function CartTab({
  cart = [],
  orders = [],
  currency = 'TRY',
  serviceChargePercent = 0,
  submittingOrder = false,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSubmitOrder,
  onGoMenu,
}) {
  const [customerNote, setCustomerNote] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const serviceCharge = Math.round((subtotal * (serviceChargePercent || 0)) / 100);
  const totalAmount = subtotal + serviceCharge;

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || submittingOrder) return;
    const ok = await onSubmitOrder(customerNote.trim());
    if (ok) setCustomerNote('');
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-6">
      {/* BÖLÜM 1: SEPETTEKİ YENİ ÜRÜNLER */}
      <section className="bg-card rounded-3xl border border-line/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink">Sepetim</h2>
              <p className="text-xs text-ink-faint">
                {cart.length > 0
                  ? `${cart.reduce((s, i) => s + i.quantity, 0)} ürün mutfağa gönderilmeye hazır`
                  : 'Sepetinizde henüz ürün yok'}
              </p>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Temizle</span>
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-ink-faint">
              Menüden dilediğiniz yemek ve içecekleri seçerek siparişinizi oluşturabilirsiniz.
            </p>
            <button
              type="button"
              onClick={onGoMenu}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-sm transition"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menüye Göz At</span>
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-line">
              {cart.map((item) => (
                <div key={item.cartItemId} className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink">{item.product.name}</p>
                    {(item.optionSummary || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.optionSummary.map((opt, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] bg-muted text-ink-soft px-2 py-0.5 rounded-lg"
                          >
                            {opt.groupName}: {opt.choiceName}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <p className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg mt-1.5 inline-block">
                        Not: “{item.note}”
                      </p>
                    )}
                    <p className="text-xs font-bold text-brand-600 mt-1.5">
                      {formatKurus(item.unitPrice * item.quantity, currency)}
                    </p>
                  </div>

                  {/* Adet kontrolü */}
                  <div className="flex items-center bg-muted rounded-2xl p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        item.quantity === 1
                          ? onRemoveItem(item.cartItemId)
                          : onUpdateQuantity(item.cartItemId, item.quantity - 1)
                      }
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-card transition"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="w-7 text-center text-xs font-extrabold text-ink">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-soft hover:bg-card transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Genel Sipariş Notu */}
            <div className="pt-2">
              <input
                type="text"
                maxLength={300}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Sipariş genel notu (örn: İçecekler yemekle birlikte gelsin)"
                className="w-full rounded-2xl border border-line bg-app px-4 py-2.5 text-xs text-ink placeholder:text-ink-faint focus:bg-card focus:border-brand-500 focus:outline-none transition"
              />
            </div>

            {/* Tutar Özeti */}
            <div className="bg-app rounded-2xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-soft">
                <span>Ara Toplam</span>
                <span className="font-semibold">{formatKurus(subtotal, currency)}</span>
              </div>
              {serviceCharge > 0 && (
                <div className="flex justify-between text-ink-soft">
                  <span>Servis Ücreti (%{serviceChargePercent})</span>
                  <span className="font-semibold">{formatKurus(serviceCharge, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-ink pt-1 border-t border-line/80">
                <span>Sipariş Toplamı</span>
                <span className="text-brand-600">{formatKurus(totalAmount, currency)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={submittingOrder}
              onClick={handlePlaceOrder}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold py-4 px-5 rounded-2xl shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span>
                {submittingOrder
                  ? 'Siparişiniz Mutfağa İletiliyor...'
                  : `Siparişi Mutfağa Gönder • ${formatKurus(totalAmount, currency)}`}
              </span>
            </button>
          </>
        )}
      </section>

      {/* BÖLÜM 2: MASANIN VERİLMİŞ SİPARİŞLERİ (CANLI MUTFAK DURUMU) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-brand-600" />
            <span>Mutfaktaki & Teslim Edilen Siparişleriniz</span>
          </h3>
          <span className="text-xs text-ink-faint">{orders.length} sipariş</span>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card rounded-3xl border border-line/80 p-6 text-center text-xs text-ink-faint">
            Bu masada henüz aktif bir sipariş bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3">
            {[...orders].reverse().map((order) => {
              const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.new;
              return (
                <div
                  key={order._id}
                  className="bg-card rounded-3xl border border-line/80 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold bg-muted text-ink px-2.5 py-1 rounded-xl">
                        #{order.orderNumber}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTimeTR(order.createdAt)}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${meta.badgeClass}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${meta.dotClass} animate-pulse`} />
                      {meta.label}
                    </span>
                  </div>

                  {/* 4 Adımlı Canlı Durum Çubuğu */}
                  {order.status !== 'cancelled' && (
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {['Alındı', 'Hazırlanıyor', 'Hazır', 'Teslim'].map((label, idx) => {
                        const active = meta.step >= idx + 1;
                        return (
                          <div key={label} className="space-y-1">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                active ? 'bg-brand-500' : 'bg-line'
                              }`}
                            />
                            <p
                              className={`text-[10px] text-center font-semibold ${
                                active ? 'text-ink' : 'text-ink-faint'
                              }`}
                            >
                              {label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sipariş Kalemleri */}
                  <div className="bg-app rounded-2xl p-3 space-y-1.5">
                    {(order.items || []).map((item, idx) => (
                      <div key={item._id || idx} className="flex items-start justify-between text-xs">
                        <div>
                          <span className="font-bold text-ink">{item.quantity}x </span>
                          <span className="font-medium text-ink">{item.name}</span>
                          {(item.selectedOptions || []).length > 0 && (
                            <span className="text-ink-faint">
                              {' '}
                              ({item.selectedOptions.map((o) => o.choiceName).join(', ')})
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-ink-soft shrink-0 ml-2">
                          {formatKurus(item.lineTotal, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-ink-faint flex items-center gap-1">
                      {order.paymentStatus === 'paid' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ödendi
                        </span>
                      ) : (
                        'Adisyona eklendi'
                      )}
                    </span>
                    <span className="font-extrabold text-ink">
                      Toplam: {formatKurus(order.totalAmount, currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
