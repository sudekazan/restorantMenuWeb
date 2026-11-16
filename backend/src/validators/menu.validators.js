import { z } from 'zod';
import { objectId, kurus, boolQuery } from './common.js';

/* ---------- Kategori ---------- */
export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(40).optional(),
  imageUrl: z.string().trim().url().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();
export const categoryReorderSchema = z.object({ ids: z.array(objectId).min(1).max(200) });

/* ---------- Ürün ---------- */
const optionChoiceSchema = z.object({
  _id: objectId.optional(),
  name: z.string().trim().min(1).max(60),
  priceDelta: kurus.optional(),
  isAvailable: z.boolean().optional(),
});

const optionGroupSchema = z
  .object({
    _id: objectId.optional(),
    name: z.string().trim().min(1).max(60),
    type: z.enum(['single', 'multiple']).optional(),
    isRequired: z.boolean().optional(),
    maxSelect: z.number().int().min(1).max(20).optional(),
    choices: z.array(optionChoiceSchema).min(1).max(30),
  })
  .refine((g) => g.type !== 'multiple' || (g.maxSelect ?? 1) <= g.choices.length, {
    message: 'maxSelect, seçenek sayısından büyük olamaz.',
    path: ['maxSelect'],
  });

export const productCreateSchema = z.object({
  category: objectId,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(600).optional(),
  price: kurus,
  optionGroups: z.array(optionGroupSchema).max(10).optional(),
  allergens: z.array(z.string().trim().max(30)).max(20).optional(),
  tags: z.array(z.string().trim().max(30)).max(20).optional(),
  calories: z.number().int().nonnegative().optional(),
  preparationTime: z.number().int().min(0).max(240).optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const productUpdateSchema = productCreateSchema.partial().extend({ isActive: z.boolean().optional() });
export const productAvailabilitySchema = z.object({ isAvailable: z.boolean() });
export const productListQuery = z.object({
  category: objectId.optional(),
  search: z.string().trim().max(60).optional(),
  includeInactive: boolQuery.optional(),
});
