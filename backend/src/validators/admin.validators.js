import { z } from 'zod';
import { email, password, dateKey } from './common.js';

const ASSIGNABLE_ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'];

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password,
  role: z.enum(ASSIGNABLE_ROLES),
  phone: z.string().trim().max(20).optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  phone: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
  password: password.optional(), // yönetici tarafından şifre sıfırlama
});

export const restaurantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().trim().url().optional(),
  phone: z.string().trim().max(20).optional(),
  email: email.optional(),
  address: z
    .object({
      line: z.string().trim().max(200).optional(),
      district: z.string().trim().max(60).optional(),
      city: z.string().trim().max(60).optional(),
      country: z.string().trim().max(60).optional(),
      zipCode: z.string().trim().max(10).optional(),
    })
    .optional(),
  taxRate: z.number().min(0).max(100).optional(),
  settings: z
    .object({
      allowOnlinePayment: z.boolean().optional(),
      allowCashPayment: z.boolean().optional(),
      autoAcceptOrders: z.boolean().optional(),
      serviceChargePercent: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export const restaurantIyzicoSchema = z.object({
  enabled: z.boolean().optional(),
  apiKey: z.string().trim().min(4).max(120).optional(),
  secretKey: z.string().trim().min(4).max(120).optional(),
  subMerchantKey: z.string().trim().max(120).optional(),
});

export const reportQuery = z
  .object({ from: dateKey.optional(), to: dateKey.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: '"from", "to" tarihinden sonra olamaz.' });
