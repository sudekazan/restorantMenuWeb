import { z } from 'zod';
import { objectId } from './common.js';

const layoutSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  shape: z.enum(['square', 'round', 'rect']).optional(),
});

export const tableCreateSchema = z.object({
  number: z.number().int().min(1).max(9999),
  name: z.string().trim().max(40).optional(),
  area: z.string().trim().max(40).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  layout: layoutSchema.optional(),
});

export const tableBulkCreateSchema = z
  .object({
    from: z.number().int().min(1).max(9999),
    to: z.number().int().min(1).max(9999),
    area: z.string().trim().max(40).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
  })
  .refine((v) => v.to >= v.from && v.to - v.from < 200, {
    message: 'Aralık geçersiz (tek seferde en fazla 200 masa).',
    path: ['to'],
  });

export const tableUpdateSchema = tableCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
  status: z.enum(['available', 'reserved', 'inactive']).optional(), // occupied/awaiting_payment sistem tarafından yönetilir
});

export const tableQrPdfQuery = z.object({
  ids: z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(objectId).max(200))
    .optional(),
});
