import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ChefHat, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { defaultPathForRole, useAuth } from '../context/AuthContext.jsx';

// Yalnızca geliştirme ortamında gösterilir (backend/scripts/seed.js demo hesapları)
const DEMO_ACCOUNTS = [
  { label: 'Yönetici', email: 'admin@demo.com', password: 'Admin123!' },
  { label: 'Mutfak', email: 'mutfak@demo.com', password: 'Mutfak123!' },
  { label: 'Garson', email: 'garson@demo.com', password: 'Garson123!' },
  { label: 'Kasa', email: 'kasa@demo.com', password: 'Kasa1234!' },
];

/** Açık yönlendirme (open redirect) olmasın diye yalnızca uygulama içi yollara izin verilir. */
function safeNext(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function Login() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (status === 'authenticated' && user) {
    return <Navigate to={next || defaultPathForRole(user.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!email.trim() || !password) {
      setError('E-posta ve şifrenizi girin.');
      return;
    }
    setSubmitting(true);
    try {
      const loggedIn = await login({ email: email.trim().toLowerCase(), password });
      navigate(next || defaultPathForRole(loggedIn.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app text-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">Personel Girişi</h1>
            <p className="text-sm text-ink-soft mt-1">Mutfak, garson, kasa ve yönetici hesapları</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-card border border-line rounded-3xl p-6 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-ink-soft">
              E-posta
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className="w-full rounded-2xl bg-muted border border-line px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              placeholder="ornek@restoran.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-ink-soft">
              Şifre
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                className="w-full rounded-2xl bg-muted border border-line pl-4 pr-12 py-3 text-sm text-ink focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-2xl inline-flex items-center justify-center gap-2 transition"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}</span>
          </button>
        </form>

        {import.meta.env.DEV && (
          <div className="bg-card/60 border border-dashed border-line rounded-3xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-ink-soft">Demo hesaplar (yalnızca geliştirme)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError('');
                  }}
                  className="text-left px-3 py-2 rounded-xl bg-card border border-line hover:border-ink-faint/60 transition"
                >
                  <span className="block text-xs font-semibold text-ink">{acc.label}</span>
                  <span className="block text-[11px] text-ink-faint truncate">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center">
          <Link to="/" className="text-sm text-ink-faint hover:text-ink-soft transition">
            Ana ekrana dön
          </Link>
        </p>
      </div>
    </div>
  );
}
