import { Category, Order, Payment, Product } from '../models/index.js';
import { ok } from '../utils/response.js';
import { getActiveSession, resolveTableByToken } from '../services/session.service.js';
import { createOrder } from '../services/order.service.js';
import { createWaiterCall } from '../services/waiterCall.service.js';
import {
  completeIyzicoCallback,
  getPublicPaymentStatus,
  initializeOnlinePayment,
} from '../services/payment.service.js';

/**
 * MÜŞTERİ (QR) UÇLARI — kimlik doğrulama yok.
 * Erişim anahtarı: tahmin edilemez qrToken (masada fiziksel olarak bulunmak).
 */

const publicRestaurant = (r) => ({
  _id: r._id,
  name: r.name,
  slug: r.slug,
  logoUrl: r.logoUrl,
  currency: r.currency,
  settings: {
    allowOnlinePayment: r.settings.allowOnlinePayment,
    allowCashPayment: r.settings.allowCashPayment,
    serviceChargePercent: r.settings.serviceChargePercent,
  },
});

const publicTable = (t) => ({ _id: t._id, number: t.number, name: t.name, area: t.area });

const sessionSummary = (s) =>
  s && {
    _id: s._id,
    sessionKey: s.sessionKey, // Socket.IO odasına katılmak için (Adım 3)
    status: s.status,
    totalAmount: s.totalAmount,
    paidAmount: s.paidAmount,
    remainingAmount: s.remainingAmount,
    openedAt: s.openedAt,
  };

/** GET /public/t/:qrToken — QR okutulunca ilk çağrılan uç */
export async function getTableInfo(req, res) {
  const { table, restaurant } = await resolveTableByToken(req.params.qrToken);
  const session = await getActiveSession(table._id);
  ok(res, { restaurant: publicRestaurant(restaurant), table: publicTable(table), session: sessionSummary(session) });
}

/** GET /public/t/:qrToken/menu — kategorilere gruplanmış menü */
export async function getMenu(req, res) {
  const { restaurant } = await resolveTableByToken(req.params.qrToken);

  const [categories, products] = await Promise.all([
    Category.find({ restaurant: restaurant._id, isActive: true }).sort({ sortOrder: 1, name: 1 }).select('name slug icon imageUrl description').lean(),
    Product.find({ restaurant: restaurant._id, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('-restaurant -imagePublicId -isActive -createdAt -updatedAt -__v')
      .lean(),
  ]);

  const byCategory = new Map(categories.map((c) => [c._id.toString(), { ...c, products: [] }]));
  for (const p of products) byCategory.get(p.category.toString())?.products.push(p);

  res.set('Cache-Control', 'public, max-age=30');
  ok(res, { restaurant: publicRestaurant(restaurant), categories: [...byCategory.values()].filter((c) => c.products.length) });
}

/** POST /public/t/:qrToken/orders */
export async function placeOrder(req, res) {
  const { table, restaurant } = await resolveTableByToken(req.params.qrToken);
  const { order, session } = await createOrder({
    restaurant,
    table,
    items: req.body.items,
    customerNote: req.body.customerNote,
    source: 'qr',
  });
  ok(res, { order, session: sessionSummary(session) }, 201);
}

/** GET /public/t/:qrToken/session — masanın hesabı (adisyon) */
export async function getSession(req, res) {
  const { table } = await resolveTableByToken(req.params.qrToken);
  const session = await getActiveSession(table._id);
  if (!session) return ok(res, { session: null, orders: [], payments: [] });

  const [orders, payments] = await Promise.all([
    Order.find({ session: session._id })
      .sort({ createdAt: 1 })
      .select('orderNumber items subtotal serviceCharge totalAmount status paymentStatus customerNote createdAt')
      .lean(),
    Payment.find({ session: session._id, status: 'success' }).select('amount method paidAt').lean(),
  ]);

  ok(res, { session: sessionSummary(session), orders, payments });
}

/** POST /public/t/:qrToken/waiter-calls */
export async function callWaiter(req, res) {
  const { table } = await resolveTableByToken(req.params.qrToken);
  const { call, duplicate } = await createWaiterCall({ table, type: req.body.type, note: req.body.note });
  ok(res, { call: { _id: call._id, type: call.type, status: call.status, createdAt: call.createdAt }, duplicate }, duplicate ? 200 : 201);
}

/** POST /public/t/:qrToken/payments/iyzico/initialize */
export async function initIyzicoPayment(req, res) {
  const data = await initializeOnlinePayment({
    qrToken: req.params.qrToken,
    amount: req.body.amount,
    tipAmount: req.body.tipAmount,
    buyer: req.body.buyer,
    clientIp: req.ip || '127.0.0.1',
  });
  ok(res, data, 201);
}

/** POST & GET /public/payments/iyzico/callback */
export async function iyzicoCallback(req, res) {
  const token = req.body?.token || req.query?.token;
  const mockStatus = req.body?.mockStatus || req.query?.mockStatus;
  const result = await completeIyzicoCallback({ token, mockStatus });

  if (req.query?.format === 'json') {
    return ok(res, {
      status: result.status,
      paymentId: result.payment._id,
      redirectUrl: result.redirectUrl,
    });
  }
  return res.redirect(303, result.redirectUrl);
}

/** GET /public/t/:qrToken/payments/:paymentId */
export async function getPaymentStatus(req, res) {
  const payment = await getPublicPaymentStatus({
    qrToken: req.params.qrToken,
    paymentId: req.params.paymentId,
  });
  ok(res, payment);
}
