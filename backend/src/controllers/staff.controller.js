import { Order, Payment, Restaurant, Table, WaiterCall } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/response.js';
import { createOrder, listOrders, updateOrderStatus } from '../services/order.service.js';
import { closeSession, getActiveSession } from '../services/session.service.js';
import { recordManualPayment, refundPayment } from '../services/payment.service.js';
import { updateWaiterCall } from '../services/waiterCall.service.js';

/* ================= SİPARİŞLER (Kanban) ================= */

export async function getOrders(req, res) {
  const { status, date } = req.validated.query;
  const orders = await listOrders({ restaurantId: req.restaurantId, statuses: status, date });
  ok(res, orders);
}

export async function getOrder(req, res) {
  const order = await Order.findOne({ _id: req.params.id, restaurant: req.restaurantId })
    .populate('table', 'number name area')
    .populate('statusHistory.changedBy', 'name role');
  if (!order) throw AppError.notFound('Sipariş bulunamadı.');
  ok(res, order);
}

/** Garsonun masa adına sipariş girmesi */
export async function createStaffOrder(req, res) {
  const [table, restaurant] = await Promise.all([
    Table.findOne({ _id: req.body.tableId, restaurant: req.restaurantId, isActive: true }),
    Restaurant.findById(req.restaurantId),
  ]);
  if (!table) throw AppError.notFound('Masa bulunamadı.');

  const result = await createOrder({
    restaurant,
    table,
    items: req.body.items,
    customerNote: req.body.customerNote,
    source: 'waiter',
    createdBy: req.user._id,
  });
  ok(res, result, 201);
}

/** PATCH /orders/:id/status  { status?, kanbanPosition?, cancelReason? } */
export async function patchOrderStatus(req, res) {
  const order = await updateOrderStatus({
    orderId: req.params.id,
    restaurantId: req.restaurantId,
    userId: req.user._id,
    ...req.body,
  });
  ok(res, order);
}

/* ================= MASA HARİTASI & ADİSYON ================= */

export async function getTableMap(req, res) {
  const [tables, calls] = await Promise.all([
    Table.find({ restaurant: req.restaurantId, isActive: true })
      .sort({ number: 1 })
      .select('-qrToken')
      .populate('currentSession', 'status totalAmount paidAmount guestCount openedAt')
      .lean(),
    WaiterCall.aggregate([
      { $match: { restaurant: req.restaurantId, status: { $in: ['pending', 'acknowledged'] } } },
      { $group: { _id: '$table', count: { $sum: 1 }, types: { $addToSet: '$type' }, oldest: { $min: '$createdAt' } } },
    ]),
  ]);

  const callMap = new Map(calls.map((c) => [c._id.toString(), c]));
  ok(
    res,
    tables.map((t) => {
      const s = t.currentSession;
      const call = callMap.get(t._id.toString());
      return {
        ...t,
        currentSession: s ? { ...s, remainingAmount: Math.max(0, s.totalAmount - s.paidAmount) } : null,
        pendingCalls: call ? { count: call.count, types: call.types, oldest: call.oldest } : null,
      };
    })
  );
}

/** Bir masanın aktif adisyonu (siparişler + ödemeler) */
export async function getTableSession(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId }).select('-qrToken');
  if (!table) throw AppError.notFound('Masa bulunamadı.');

  const session = await getActiveSession(table._id);
  if (!session) return ok(res, { table, session: null, orders: [], payments: [] });

  const [orders, payments] = await Promise.all([
    Order.find({ session: session._id }).sort({ createdAt: 1 }).lean(),
    Payment.find({ session: session._id }).sort({ createdAt: 1 }).populate('receivedBy', 'name').lean(),
  ]);
  ok(res, { table, session, orders, payments });
}

export async function postCloseSession(req, res) {
  const session = await closeSession({ sessionId: req.params.id, restaurantId: req.restaurantId, force: req.body?.force });
  ok(res, session);
}

/** Kasada nakit / POS ödemesi */
export async function postManualPayment(req, res) {
  const result = await recordManualPayment({
    restaurantId: req.restaurantId,
    sessionId: req.params.id,
    userId: req.user._id,
    ...req.body,
  });
  ok(res, result, 201);
}

/** Ödeme iadesi (Nakit/POS veya İyzico online kart) */
export async function postRefundPayment(req, res) {
  const result = await refundPayment({
    paymentId: req.params.id,
    restaurantId: req.restaurantId,
    clientIp: req.ip || '127.0.0.1',
  });
  ok(res, result);
}

/* ================= GARSON ÇAĞRILARI ================= */

export async function getWaiterCalls(req, res) {
  const statuses = req.validated.query.status ?? ['pending', 'acknowledged'];
  const calls = await WaiterCall.find({ restaurant: req.restaurantId, status: { $in: statuses } })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('table', 'number name area')
    .populate('acknowledgedBy', 'name')
    .lean();
  ok(res, calls);
}

export async function patchWaiterCall(req, res) {
  const call = await updateWaiterCall({
    callId: req.params.id,
    restaurantId: req.restaurantId,
    status: req.body.status,
    userId: req.user._id,
  });
  ok(res, call);
}
