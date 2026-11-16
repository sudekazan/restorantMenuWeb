import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { QrCode, Smartphone, ChefHat, ShieldCheck, ArrowRight } from 'lucide-react';

export default function HomeLanding() {
  const [tokenInput, setTokenInput] = useState('');
  const navigate = useNavigate();

  const handleOpenTable = (e) => {
    e.preventDefault();
    const raw = tokenInput.trim();
    if (!raw) return;
    // Tam URL yapıştırıldıysa son parçayı (qrToken) ayıkla
    const parts = raw.split('/').filter(Boolean);
    const qrToken = parts[parts.length - 1];
    navigate(`/m/${qrToken}`);
  };

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col justify-center p-6">
      <div className="max-w-3xl w-full mx-auto space-y-8">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-brand-500/15 text-brand-600 border border-brand-500/30 px-3.5 py-1.5 rounded-full">
            <QrCode className="w-3.5 h-3.5" />
            QR Tabanlı Restoran & Kafe SaaS
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            Dijital Menü, Mutfak Kanban & Yönetim Sistemi
          </h1>
          <p className="text-sm text-ink-soft max-w-xl mx-auto">
            Masadaki QR kod ile müşteri ekranına girebilir veya personel ve yönetici panellerine geçiş yapabilirsiniz.
          </p>
        </div>

        {/* Müşteri Masa QR Giriş Kartı */}
        <form
          onSubmit={handleOpenTable}
          className="bg-card border border-line rounded-3xl p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">1. Müşteri Ekranı (Mobile-First & PWA)</h2>
              <p className="text-xs text-ink-soft">
                <code className="text-brand-600">npm run seed</code> çıktısındaki masa QR adresini veya 32 karakterlik <code className="text-brand-600">qrToken</code> değerini girin.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Örn: a1b2c3d4e5f6... veya http://localhost:5173/m/..."
              className="flex-1 rounded-2xl bg-muted border border-line px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-6 py-3 rounded-2xl inline-flex items-center justify-center gap-2 transition"
            >
              <span>Masaya Git</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Diğer Modüller */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/staff"
            className="group bg-card/80 hover:bg-card border border-line hover:border-ink-faint/60 rounded-3xl p-5 flex items-start gap-4 transition"
          >
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink group-hover:text-emerald-700 transition-colors">
                2. Personel / Mutfak Ekranı
              </h3>
              <p className="text-xs text-ink-soft mt-1">
                Dark Mode Kanban Board, anlık garson çağrıları ve canlı masa haritası.
              </p>
            </div>
          </Link>

          <Link
            to="/admin"
            className="group bg-card/80 hover:bg-card border border-line hover:border-ink-faint/60 rounded-3xl p-5 flex items-start gap-4 transition"
          >
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink group-hover:text-indigo-600 transition-colors">
                3. Admin Paneli (Yönetici)
              </h3>
              <p className="text-xs text-ink-soft mt-1">
                Menü CRUD, masa & PDF QR üretimi, günlük ciro ve ödeme analizi.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
