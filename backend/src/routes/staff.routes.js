import { Router } from 'express';
import * as staff from '../controllers/staff.controller.js';
import * as product from '../controllers/product.controller.js';
import { STAFF_ROLES, authorize, protect, requireTenant } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import { productAvailabilitySchema, productListQuery } from '../validators/menu.validators.js';
import {
  closeSessionSchema,
  manualPaymentSchema,
  orderListQuery,
  orderStatusSchema,
  staffOrderSchema,
  waiterCallListQuery,
  waiterCallUpdateSchema,
} from '../validators/order.validators.js';

/** Personel / Mutfak uçları: /api/v1/staff/... */
const router = Router();
router.use(protect, requireTenant, authorize(...STAFF_ROLES));

const cashierRoles = authorize('admin', 'manager', 'cashier', 'waiter');
const id = validate({ params: idParam });

// Siparişler (Kanban)
router.get('/orders', validate({ query: orderListQuery }), staff.getOrders);
router.post('/orders', authorize('admin', 'manager', 'waiter'), validate({ body: staffOrderSchema }), staff.createStaffOrder);
router.get('/orders/:id', id, staff.getOrder);
router.patch('/orders/:id/status', validate({ params: idParam, body: orderStatusSchema }), staff.patchOrderStatus);

// Masa haritası & adisyon
router.get('/tables', staff.getTableMap);
router.get('/tables/:id/session', id, staff.getTableSession);
router.post('/sessions/:id/close', cashierRoles, validate({ params: idParam, body: closeSessionSchema }), staff.postCloseSession);
router.post('/sessions/:id/payments', cashierRoles, validate({ params: idParam, body: manualPaymentSchema }), staff.postManualPayment);
router.post('/payments/:id/refund', authorize('admin', 'manager', 'cashier'), id, staff.postRefundPayment);

// Garson çağrıları
router.get('/waiter-calls', validate({ query: waiterCallListQuery }), staff.getWaiterCalls);
router.patch('/waiter-calls/:id', validate({ params: idParam, body: waiterCallUpdateSchema }), staff.patchWaiterCall);

// Mutfak: ürün tükendi / mevcut (liste salt okunur; mutfak rolü admin uçlarına erişemediği için burada)
router.get('/products', validate({ query: productListQuery }), product.listProducts);
router.patch(
  '/products/:id/availability',
  authorize('admin', 'manager', 'kitchen'),
  validate({ params: idParam, body: productAvailabilitySchema }),
  product.setAvailability
);

export default router;
