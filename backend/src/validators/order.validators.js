import { z } from 'zod';
import { objectId, kurus, csvEnum, dateKey } from './common.js';
import { ORDER_STATUSES } from '../models/Order.js';
import { CALL_TYPES } from '../models/WaiterCall.js';

const orderItemInput = z.object({
  product: objectId,
  quantity: z.number().int().min(1).max(50),
  selectedOptions: z
    .array(z.object({ groupId: objectId, choiceIds: z.array(objectId).max(20) }))
    .max(20)
    .optional(),
  note: z.string().trim().max(200).optional(),
});

/* Müşteri (QR) siparişi */
export const customerOrderSchema = z.object({
  items: z.array(orderItemInput).min(1, 'Sepet boş.').max(50),
  customerNote: z.string().trim().max(300).optional(),
});

/* Garsonun masa adına girdiği sipariş */
export const staffOrderSchema = customerOrderSchema.extend({ tableId: objectId });

/* Kanban sürükle-bırak */
export const orderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    kanbanPosition: z.number().finite().optional(),
    cancelReason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.status || v.kanbanPosition !== undefined, { message: 'status veya kanbanPosition gerekli.' });

export const orderListQuery = z.object({
  status: csvEnum(ORDER_STATUSES).optional(),
  date: dateKey.optional(),
});

/* Garson çağrısı */
export const waiterCallCreateSchema = z.object({
  type: z.enum(CALL_TYPES).default('call_waiter'),
  note: z.string().trim().max(200).optional(),
});
export const waiterCallUpdateSchema = z.object({ status: z.enum(['acknowledged', 'resolved']) });
export const waiterCallListQuery = z.object({
  status: csvEnum(['pending', 'acknowledged', 'resolved']).optional(),
});

/* Kasada manuel ödeme (nakit / fiziksel POS). */
export const manualPaymentSchema = z.object({
  method: z.enum(['cash', 'pos_card']),
  amount: kurus.positive().optional(), // boşsa kalan tutarın tamamı
  tipAmount: kurus.optional(),
});

/* Müşteri ekranından İyzico Checkout Form başlatma */
export const iyzicoInitSchema = z.object({
  amount: kurus.positive().optional(), // boşsa kalan tutarın tamamı
  tipAmount: kurus.optional(),
  buyer: z
    .object({
      name: z.string().trim().min(1).max(60).optional(),
      surname: z.string().trim().min(1).max(60).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().max(20).optional(),
    })
    .optional(),
});

export const qrPaymentParam = z.object({
  qrToken: z.string().regex(/^[a-f\d]{32}$/i, 'Geçersiz QR kod.'),
  paymentId: objectId,
});

export const closeSessionSchema = z.object({ force: z.boolean().optional() });
