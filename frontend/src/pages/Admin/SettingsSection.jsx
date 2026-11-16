import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminApi } from '../../lib/api.js';
import { adminCan } from './adminRoles.js';
import { Field, Switch, inputClass, inputErrorClass, primaryBtn, secondaryBtn } from './menu/menuUi.jsx';
import IyzicoCard from './settings/IyzicoCard.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADDRESS_KEYS = ['line', 'district', 'city', 'country', 'zipCode'];
const SWITCH_KEYS = ['allowOnlinePayment', 'allowCashPayment', 'autoAcceptOrders'];

const PLAN_LABELS = { free: 'Ücretsiz', basic: 'Temel', pro: 'Pro' };
const SUB_STATUS_LABELS = { trial: 'Deneme', active: 'Etkin', past_due: 'Ödeme gecikti', canceled: 'İptal edildi' };

/** Sunucudan gelen restoran -> form durumu (metin alanları) */
function toForm(r = {}) {
  const a = r.address || {};
  const s = r.settings || {};
  return {
    name: r.name || '',
    phone: r.phone || '',
    email: r.email || '',
    logoUrl: r.logoUrl || '',
    line: a.line || '',
    district: a.district || '',
    city: a.city || '',
    country: a.country || '',
    zipCode: a.zipCode || '',
    taxRate: r.taxRate != null ? String(r.taxRate) : '',
    serviceChargePercent: s.serviceChargePercent != null ? String(s.serviceChargePercent) : '',
    allowOnlinePayment: s.allowOnlinePayment !== false,
    allowCashPayment: s.allowCashPayment !== false,
    autoAcceptOrders: s.autoAcceptOrders !== false,
  };
}

/** "10,5" -> 10.5 · geçersizse NaN */
const toPercent = (v) => (String(v).trim() === '' ? NaN : Number(String(v).replace(',', '.')));
const isPercent = (n) => Number.isFinite(n) && n >= 0 && n <= 100;

const TEXT_LIMITS = { phone: 20, line: 200, district: 60, city: 60, country: 60, zipCode: 10 };

/** Yönetim > Ayarlar: restoran bilgileri, sipariş/ödeme ayarları ve İyzico. Müdür yalnızca görür. */
export default function SettingsSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = adminCan(user?.role).editSettings;

  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(toForm());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.getRestaurant();
      setRestaurant(r);
      setForm(toForm(r));
      setErrors({});
      setError('');
    } catch (err) {
      setError(err.message || 'Ayarlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const initial = useMemo(() => toForm(restaurant || {}), [restaurant]);
  const dirty = Object.keys(initial).some((k) => initial[k] !== form[k]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 120) next.name = 'Restoran adı 2 ile 120 karakter arasında olmalı.';
    const email = form.email.trim();
    if (email && !EMAIL_RE.test(email)) next.email = 'Geçerli bir e-posta yazın.';
    if (!email && initial.email) next.email = 'E-posta boş bırakılamaz; yeni adresi yazın.';
    const logo = form.logoUrl.trim();
    if (logo && !/^https?:\/\/\S+$/i.test(logo)) next.logoUrl = 'http:// veya https:// ile başlayan bir adres yazın.';
    if (!logo && initial.logoUrl) next.logoUrl = 'Logo adresi boş bırakılamaz; yeni adresi yazın.';
    Object.entries(TEXT_LIMITS).forEach(([k, max]) => {
      if (form[k].trim().length > max) next[k] = `En fazla ${max} karakter olabilir.`;
    });
    if (!isPercent(toPercent(form.taxRate))) next.taxRate = '0 ile 100 arasında bir oran yazın.';
    if (!isPercent(toPercent(form.serviceChargePercent))) next.serviceChargePercent = '0 ile 100 arasında bir oran yazın.';
    return next;
  };

  const blurCheck = (key) => () => setErrors((er) => ({ ...er, [key]: validate()[key] }));

  /** Yalnızca değişen alanlar gönderilir (backend iç içe alanları kısmi günceller). */
  const buildPayload = () => {
    const changed = (k) => form[k] !== initial[k];
    const payload = {};
    ['name', 'phone', 'email', 'logoUrl'].forEach((k) => {
      if (changed(k)) payload[k] = form[k].trim();
    });
    const address = {};
    ADDRESS_KEYS.forEach((k) => {
      if (changed(k)) address[k] = form[k].trim();
    });
    if (Object.keys(address).length) payload.address = address;
    if (changed('taxRate')) payload.taxRate = toPercent(form.taxRate);
    const settings = {};
    SWITCH_KEYS.forEach((k) => {
      if (changed(k)) settings[k] = form[k];
    });
    if (changed('serviceChargePercent')) settings.serviceChargePercent = toPercent(form.serviceChargePercent);
    if (Object.keys(settings).length) payload.settings = settings;
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    const payload = buildPayload();
    if (!Object.keys(payload).length) return;

    setBusy(true);
    try {
      const updated = await adminApi.updateRestaurant(payload);
      setRestaurant(updated);
      setForm(toForm(updated));
      toast({ title: 'Ayarlar kaydedildi', variant: 'success', duration: 2500 });
    } catch (err) {
      const description = err?.details?.length ? err.details.map((d) => d.message).join(' ') : err.message;
      toast({ title: 'Ayarlar kaydedilemedi', description, variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saveIyzico = async (payload) => {
    try {
      const updated = await adminApi.updateIyzico(payload);
      setRestaurant((r) => ({ ...r, iyzico: updated?.iyzico ?? r?.iyzico }));
      toast({ title: 'İyzico ayarları kaydedildi', variant: 'success', duration: 2500 });
      return true;
    } catch (err) {
      const description = err?.details?.length ? err.details.map((d) => d.message).join(' ') : err.message;
      toast({ title: 'İyzico ayarları kaydedilemedi', description, variant: 'error' });
      return false;
    }
  };

  /* ---------- Görünüm ---------- */
  const heading = (
    <div>
      <h1 className="text-xl font-extrabold text-ink">Ayarlar</h1>
      <p className="text-sm text-ink-soft">Restoran bilgileri, sipariş ve ödeme tercihleri.</p>
    </div>
  );

  if (loading) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="py-16 flex items-center justify-center gap-3 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          <span className="text-sm">Ayarlar yükleniyor…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <p className="text-sm text-rose-800">{error}</p>
          <button type="button" onClick={load} className={secondaryBtn}>
            Tekrar Dene
          </button>
        </div>
      </section>
    );
  }

  const readOnlyClass = canEdit ? '' : 'bg-muted text-ink-soft';
  const textInput = (key, { label, hint, type = 'text', maxLength, placeholder, inputMode, autoFocus } = {}) => (
    <Field id={`settings-${key}`} label={label} hint={hint} error={errors[key]}>
      <input
        id={`settings-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        onBlur={canEdit ? blurCheck(key) : undefined}
        readOnly={!canEdit}
        maxLength={maxLength}
        placeholder={canEdit ? placeholder : undefined}
        inputMode={inputMode}
        data-autofocus={autoFocus || undefined}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `settings-${key}-error` : undefined}
        className={`${inputClass} ${errors[key] ? inputErrorClass : ''} ${readOnlyClass}`}
      />
    </Field>
  );

  const switchRow = (key, title, description) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-soft">{description}</p>
      </div>
      <Switch checked={form[key]} onChange={(v) => set(key, v)} label={title} disabled={!canEdit || busy} />
    </div>
  );

  const sub = restaurant?.subscription || {};
  const card = 'bg-card border border-line rounded-3xl shadow-sm p-4 sm:p-5 space-y-4';

  return (
    <section className="space-y-4">
      {heading}

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-ink-soft">
          <Eye className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>Ayarları görüntülüyorsunuz. Değişiklik yapmak için işletme yöneticisiyle görüşün.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className={card}>
          <h2 className="text-base font-bold text-ink">Restoran bilgileri</h2>
          {textInput('name', { label: 'Restoran adı', maxLength: 120 })}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {textInput('phone', { label: 'Telefon', type: 'tel', maxLength: 20, placeholder: 'Örn. 0212 555 00 00' })}
            {textInput('email', { label: 'E-posta', type: 'email', placeholder: 'ornek@restoran.com' })}
          </div>
          {textInput('logoUrl', { label: 'Logo adresi (URL)', type: 'url', placeholder: 'https://…' })}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-faint">Menü adresi kısa adı</dt>
              <dd className="font-semibold text-ink break-all">{restaurant?.slug || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Para birimi</dt>
              <dd className="font-semibold text-ink">{restaurant?.currency || 'TRY'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Paket</dt>
              <dd className="font-semibold text-ink">{PLAN_LABELS[sub.plan] || sub.plan || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Abonelik</dt>
              <dd className="font-semibold text-ink">{SUB_STATUS_LABELS[sub.status] || sub.status || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className={card}>
          <h2 className="text-base font-bold text-ink">Adres</h2>
          {textInput('line', { label: 'Açık adres', maxLength: 200 })}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {textInput('district', { label: 'İlçe', maxLength: 60 })}
            {textInput('city', { label: 'İl', maxLength: 60 })}
            {textInput('country', { label: 'Ülke', maxLength: 60 })}
            {textInput('zipCode', { label: 'Posta kodu', maxLength: 10, inputMode: 'numeric' })}
          </div>
        </div>

        <div className={card}>
          <h2 className="text-base font-bold text-ink">Sipariş ve ödeme</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {textInput('taxRate', { label: 'KDV oranı (%)', inputMode: 'decimal', maxLength: 6, hint: 'Raporlarda kullanılır.' })}
            {textInput('serviceChargePercent', { label: 'Servis ücreti (%)', inputMode: 'decimal', maxLength: 6, hint: '0 ise servis ücreti alınmaz.' })}
          </div>
          {switchRow('autoAcceptOrders', 'Siparişleri otomatik onayla', 'Açıksa müşteri siparişi garson onayı beklemeden mutfağa düşer.')}
          {switchRow('allowOnlinePayment', 'Online ödeme', 'Müşteriler QR menüden kartla ödeyebilir (İyzico gerekir).')}
          {switchRow('allowCashPayment', 'Kasada ödeme', 'Müşteriler nakit veya kartla kasada ödeyebilir.')}
        </div>

        {canEdit && (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setForm(initial); setErrors({}); }} disabled={busy || !dirty} className={secondaryBtn}>
              Değişiklikleri Geri Al
            </button>
            <button type="submit" disabled={busy || !dirty} className={primaryBtn}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Ayarları Kaydet
            </button>
          </div>
        )}
      </form>

      <IyzicoCard enabled={restaurant?.iyzico?.enabled} canEdit={canEdit} onSubmit={saveIyzico} />
    </section>
  );
}
