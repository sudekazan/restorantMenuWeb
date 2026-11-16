import { Router } from 'express';
import * as pub from '../controllers/public.controller.js';
import { validate } from '../middlewares/validate.js';
import { orderLimiter, publicLimiter, waiterCallLimiter } from '../middlewares/rateLimit.js';
import { qrTokenParam } from '../validators/common.js';
import {
  customerOrderSchema,
  iyzicoInitSchema,
  qrPaymentParam,
  waiterCallCreateSchema,
} from '../validators/order.validators.js';

/** Müşteri (QR) uçları: /api/v1/public/... */
const router = Router();
router.use(publicLimiter);

const t = validate({ params: qrTokenParam });

router.get('/t/:qrToken', t, pub.getTableInfo);
router.get('/t/:qrToken/menu', t, pub.getMenu);
router.get('/t/:qrToken/session', t, pub.getSession);
router.post('/t/:qrToken/orders', orderLimiter, validate({ params: qrTokenParam, body: customerOrderSchema }), pub.placeOrder);
router.post('/t/:qrToken/waiter-calls', waiterCallLimiter, validate({ params: qrTokenParam, body: waiterCallCreateSchema }), pub.callWaiter);

// İyzico online ödeme uçları
router.post(
  '/t/:qrToken/payments/iyzico/initialize',
  orderLimiter,
  validate({ params: qrTokenParam, body: iyzicoInitSchema }),
  pub.initIyzicoPayment
);
router.get('/t/:qrToken/payments/:paymentId', validate({ params: qrPaymentParam }), pub.getPaymentStatus);
router.post('/payments/iyzico/callback', pub.iyzicoCallback);
router.get('/payments/iyzico/callback', pub.iyzicoCallback);

export default router;
