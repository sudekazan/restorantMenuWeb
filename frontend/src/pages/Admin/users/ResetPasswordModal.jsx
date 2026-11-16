import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { Field, inputClass, inputErrorClass, primaryBtn, secondaryBtn } from '../menu/menuUi.jsx';
import { passwordError } from './userUtils.js';

/** Yöneticinin bir personelin şifresini sıfırlaması. onSubmit(password) Promise döner. */
export default function ResetPasswordModal({ open, user, onClose, onSubmit }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setRepeat('');
    setErrors({});
  }, [open]);

  const validate = () => {
    const next = {};
    const pw = passwordError(password);
    if (pw) next.password = pw;
    if (repeat !== password) next.repeat = 'Şifreler aynı değil.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSubmit(password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Şifreyi Sıfırla"
      subtitle={user ? `${user.name} · ${user.email}` : undefined}
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Vazgeç
          </button>
          <button type="submit" form="reset-password-form" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Şifreyi Değiştir
          </button>
        </div>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-ink-soft">Kullanıcının açık oturumları kapanır; yeni şifreyle tekrar giriş yapması gerekir.</p>
        <Field id="reset-password" label="Yeni şifre" hint="En az 8 karakter." error={errors.password}>
          <input
            id="reset-password"
            data-autofocus
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((er) => ({ ...er, password: undefined }));
            }}
            onBlur={() => setErrors((er) => ({ ...er, password: validate().password }))}
            autoComplete="new-password"
            maxLength={72}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
            className={`${inputClass} ${errors.password ? inputErrorClass : ''}`}
          />
        </Field>
        <Field id="reset-password-repeat" label="Yeni şifre (tekrar)" error={errors.repeat}>
          <input
            id="reset-password-repeat"
            type="password"
            value={repeat}
            onChange={(e) => {
              setRepeat(e.target.value);
              if (errors.repeat) setErrors((er) => ({ ...er, repeat: undefined }));
            }}
            autoComplete="new-password"
            maxLength={72}
            aria-invalid={!!errors.repeat}
            aria-describedby={errors.repeat ? 'reset-password-repeat-error' : undefined}
            className={`${inputClass} ${errors.repeat ? inputErrorClass : ''}`}
          />
        </Field>
      </form>
    </Modal>
  );
}
