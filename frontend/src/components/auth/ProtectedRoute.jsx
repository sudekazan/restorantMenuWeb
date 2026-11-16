import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS } from '../../lib/format.js';

/** Giriş yapılmamışsa /login'e yönlendirir; `roles` verilirse rol yetkisini de denetler. */
export default function ProtectedRoute({ roles, children }) {
  const { status, user, logout } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-app text-ink-soft flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm">Oturum doğrulanıyor…</span>
      </div>
    );
  }

  if (status !== 'authenticated') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-app text-ink flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-card border border-line rounded-3xl p-8 shadow-sm text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="text-lg font-bold text-ink">Bu ekrana erişim yetkiniz yok</h1>
          <p className="text-sm text-ink-soft">
            {ROLE_LABELS[user.role] || user.role} rolüyle giriş yaptınız. Farklı bir hesapla giriş yapabilir veya ana ekrana
            dönebilirsiniz.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/" className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line transition">
              Ana Ekran
            </Link>
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition"
            >
              Hesap Değiştir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
