import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { Field, Switch, inputClass, inputErrorClass, primaryBtn, secondaryBtn } from '../menu/menuUi.jsx';
import { ASSIGNABLE_ROLES, passwordError, roleLabel } from './userUtils.js';

const EMPTY = { name: '', email: '', password: '', role: 'waiter', phone: '', isActive: true };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Personel ekleme / düzenleme penceresi. onSubmit(payload) Promise döner.
 * isSelf: oturumdaki kullanıcının kendisi; rolü ve etkinliği değiştirilemez (backend de engeller).
 */
export default function UserFormModal({ open, user, isSelf, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const editing = !!user;

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? { name: user.name || '', email: user.email || '', password: '', role: user.role, phone: user.phone || '', isActive: user.isActive !== false }
        : EMPTY
    );
    setErrors({});
  }, [open, user]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 80) next.name = 'Ad 2 ile 80 karakter arasında olmalı.';
    if (!editing) {
      if (!EMAIL_RE.test(form.email.trim())) next.email = 'Geçerli bir e-posta yazın.';
      const pw = passwordError(form.password);
      if (pw) next.password = pw;
    }
    if (form.phone.trim().length > 20) next.phone = 'Telefon en fazla 20 karakter olabilir.';
    return next;
  };

  const blurCheck = (key) => () => setErrors((er) => ({ ...er, [key]: validate()[key] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = { name: form.name.trim(), phone: form.phone.trim() };
    if (editing) {
      if (!isSelf) {
        payload.role = form.role;
        payload.isActive = form.isActive;
      }
    } else {
      payload.email = form.email.trim();
      payload.password = form.password;
      payload.role = form.role;
      if (!payload.phone) delete payload.phone;
    }

    setBusy(true);
    try {
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  };

  const errProps = (key) => ({
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `user-${key}-error` : undefined,
    className: `${inputClass} ${errors[key] ? inputErrorClass : ''}`,
  });

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={editing ? `${user.name} Düzenle` : 'Yeni Kullanıcı'}
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Vazgeç
          </button>
          <button type="submit" form="user-form" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Değişiklikleri Kaydet' : 'Kullanıcı Ekle'}
          </button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id="user-name" label="Ad soyad" error={errors.name}>
          <input
            id="user-name"
            data-autofocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={blurCheck('name')}
            maxLength={80}
            autoComplete="off"
            {...errProps('name')}
          />
        </Field>

        <Field id="user-email" label="E-posta" hint={editing ? 'E-posta adresi sonradan değiştirilemez.' : 'Personel bu adresle giriş yapar.'} error={errors.email}>
          <input
            id="user-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            onBlur={editing ? undefined : blurCheck('email')}
            readOnly={editing}
            autoComplete="off"
            {...errProps('email')}
            className={`${errProps('email').className} ${editing ? 'bg-muted text-ink-soft' : ''}`}
          />
        </Field>

        {!editing && (
          <Field id="user-password" label="Şifre" hint="En az 8 karakter. Personelle güvenli bir yoldan paylaşın." error={errors.password}>
            <input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              onBlur={blurCheck('password')}
              autoComplete="new-password"
              maxLength={72}
              {...errProps('password')}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="user-role" label="Rol" hint={isSelf ? 'Kendi rolünüzü değiştiremezsiniz.' : undefined}>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              disabled={isSelf}
              className={`${inputClass} disabled:opacity-60`}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="user-phone" label="Telefon (isteğe bağlı)" error={errors.phone}>
            <input
              id="user-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              onBlur={blurCheck('phone')}
              maxLength={20}
              {...errProps('phone')}
            />
          </Field>
        </div>

        {editing && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Hesap etkin</p>
              <p className="text-xs text-ink-soft">
                {isSelf ? 'Kendi hesabınızı pasife alamazsınız.' : 'Pasif hesap giriş yapamaz; geçmiş kayıtlarda adı görünmeye devam eder.'}
              </p>
            </div>
            <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Hesap etkin" disabled={isSelf} />
          </div>
        )}
      </form>
    </Modal>
  );
}
