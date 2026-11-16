import React, { useState } from 'react';
import {
  BellRing,
  Receipt,
  Banknote,
  MessageSquarePlus,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CALL_TYPE_LABELS } from '../../lib/format.js';

const QUICK_CALLS = [
  {
    type: 'call_waiter',
    title: 'Garson Çağır',
    subtitle: 'Masanıza hemen bir servis personeli yönlendirilir',
    icon: BellRing,
    accent: 'from-brand-500 to-orange-600 text-white shadow-brand-500/25',
  },
  {
    type: 'request_bill',
    title: 'Hesap İste',
    subtitle: 'Masa adisyonunuz kontrol edilip masanıza getirilir',
    icon: Receipt,
    accent: 'from-card to-muted text-ink border border-line shadow-ink/5',
  },
  {
    type: 'request_cash_payment',
    title: 'Masada Nakit / POS Ödeme',
    subtitle: 'Garsonumuz fiziksel POS cihazı veya nakit tahsilat için gelir',
    icon: Banknote,
    accent: 'from-emerald-600 to-teal-700 text-white shadow-emerald-600/20',
  },
];

export default function WaiterTab({ activeCall, sendingCall, onTriggerCall }) {
  const [customNote, setCustomNote] = useState('');

  const handleCustomCall = async (e) => {
    e.preventDefault();
    if (!customNote.trim() || sendingCall) return;
    const ok = await onTriggerCall({ type: 'other', note: customNote.trim() });
    if (ok) setCustomNote('');
  };

  return (
    <div className="px-4 pt-4 pb-28 space-y-5">
      {/* Canlı Çağrı Durum Banner'ı */}
      {activeCall && activeCall.status !== 'resolved' && (
        <div
          className={`rounded-3xl p-4 border flex items-start gap-3.5 transition-all ${
            activeCall.status === 'acknowledged'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              activeCall.status === 'acknowledged'
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-white animate-pulse'
            }`}
          >
            {activeCall.status === 'acknowledged' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold">
              {activeCall.status === 'acknowledged'
                ? 'Garsonunuz çağrınızı gördü, masanıza geliyor!'
                : `${CALL_TYPE_LABELS[activeCall.type] || 'Çağrınız'} personele iletildi`}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              {activeCall.status === 'acknowledged'
                ? 'Servis personelimiz şu anda masanıza yönlendirildi.'
                : 'Personel ekranında sesli ve görsel bildirim oluşturuldu.'}
            </p>
          </div>
        </div>
      )}

      {/* Tek Tuşla Hızlı Çağrı Kartları */}
      <div className="space-y-3">
        <div className="px-1">
          <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <span>Tek Dokunuşla Servis</span>
          </h2>
          <p className="text-xs text-ink-faint mt-0.5">
            Seçiminiz anında personele iletilir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {QUICK_CALLS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                disabled={sendingCall}
                onClick={() => onTriggerCall({ type: item.type })}
                className={`w-full bg-gradient-to-r ${item.accent} rounded-3xl p-5 text-left shadow-lg flex items-center justify-between gap-4 transition active:scale-[0.98] disabled:opacity-60`}
              >
                <div className="space-y-1">
                  <p className="text-base font-extrabold">{item.title}</p>
                  <p className="text-xs opacity-85 leading-snug">{item.subtitle}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Özel Not ile Garson Çağırma */}
      <form
        onSubmit={handleCustomCall}
        className="bg-card rounded-3xl border border-line/80 p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-extrabold text-ink">Özel İstek Gönder</h3>
        </div>
        <p className="text-xs text-ink-faint">
          Peçete, buz, bebek sandalyesi veya Wi-Fi şifresi gibi taleplerinizi yazabilirsiniz.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={200}
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Örn: Ekstra peçete ve limon rica ediyoruz"
            className="flex-1 rounded-2xl border border-line bg-app px-4 py-3 text-xs text-ink placeholder:text-ink-faint focus:bg-card focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!customNote.trim() || sendingCall}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold px-5 rounded-2xl shrink-0 transition"
          >
            Gönder
          </button>
        </div>
      </form>
    </div>
  );
}
