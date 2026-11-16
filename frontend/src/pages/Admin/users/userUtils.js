import { ROLE_LABELS } from '../../../lib/format.js';

/** backend/src/validators/admin.validators.js > ASSIGNABLE_ROLES ile aynı sıra. */
export const ASSIGNABLE_ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'];

export const roleLabel = (role) => ROLE_LABELS[role] || role;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function passwordError(value) {
  if (!value) return 'Şifre yazın.';
  if (value.length < PASSWORD_MIN) return `Şifre en az ${PASSWORD_MIN} karakter olmalı.`;
  if (value.length > PASSWORD_MAX) return `Şifre en fazla ${PASSWORD_MAX} karakter olabilir.`;
  return undefined;
}

export function userErrorMessage(err) {
  if (err?.code === 'DUPLICATE') return 'Bu e-posta ile kayıtlı bir hesap zaten var.';
  if (err?.code === 'VALIDATION_ERROR' && err.details?.length) return err.details.map((d) => d.message).join(' ');
  return err?.message || 'Bir sorun oluştu. Lütfen tekrar deneyin.';
}
