import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Geçersiz ID formatı.');
export const idParam = z.object({ id: objectId });
export const qrTokenParam = z.object({ qrToken: z.string().regex(/^[a-f\d]{32}$/i, 'Geçersiz QR kod.') });

/** Tüm tutarlar kuruş cinsinden tam sayıdır (149,90 TL => 14990). */
export const kurus = z.number().int('Tutar kuruş cinsinden tam sayı olmalıdır.').nonnegative();

export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih formatı YYYY-MM-DD olmalıdır.');

/** Query string boolean: ?includeInactive=true */
export const boolQuery = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

/** Query string virgüllü liste: ?status=new,preparing */
export const csvEnum = (values) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1));

export const email = z.string().trim().toLowerCase().email('Geçerli bir e-posta girin.');
export const password = z.string().min(8, 'Şifre en az 8 karakter olmalıdır.').max(72);
