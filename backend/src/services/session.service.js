import crypto from 'crypto';
import { Order, Payment, Restaurant, Table, TableSession, WaiterCall } from '../models/index.js';
import { ACTIVE_SESSION_STATUSES } from '../models/TableSession.js';
import { AppError } from '../utils/AppError.js';
import { EVENTS, emitToCustomer, emitToStaff } from '../sockets/emitter.js';

/** QR token'dan masa + restoranı çözer (müşteri uçlarının giriş noktası). */
export async function resolveTableByToken(qrToken) {
  const table = await Table.findOne({ qrToken, isActive: true });
  if (!table) throw AppError.notFound('Masa bulunamadı veya QR kod geçersiz.', 'TABLE_NOT_FOUND');

  const restaurant = await Restaurant.findOne({ _id: table.restaurant, isActive: true });
  if (!restaurant) throw AppError.notFound('Restoran şu anda hizmet vermiyor.', 'RESTAURANT_INACTIVE');

  return { table, restaurant };
}

export function getActiveSession(tableId) {
  return TableSession.findOne({ table: tableId, status: { $in: ACTIVE_SESSION_STATUSES } });
}

/** Masada aktif oturum varsa onu döner, yoksa yenisini açar (yarış durumuna dayanıklı). */
export async function getOrCreateActiveSession(table) {
  const existing = await getActiveSession(table._id);
  if (existing) return existing;

  try {
    const session = await TableSession.create({
      restaurant: table.restaurant,
      table: table._id,
      sessionKey: crypto.randomBytes(24).toString('hex'),
    });
    await Table.updateOne({ _id: table._id }, { status: 'occupied', currentSession: session._id });
    emitToStaff(table.restaurant, EVENTS.TABLE_UPDATED, { tableId: table._id, status: 'occupied', sessionId: session._id });
    return session;
  } catch (err) {
    // Aynı anda iki cihaz ilk siparişi verirse partial unique index ikinciyi reddeder
    if (err?.code === 11000) {
      const session = await getActiveSession(table._id);
      if (session) return session;
    }
    throw err;
  }
}

/**
 * Oturumun toplam / ödenen tutarlarını siparişlerden ve başarılı ödemelerden
 * yeniden hesaplar; ödeme durumlarını senkronlar. Sipariş, iptal ve ödeme
 * sonrasında MUTLAKA çağrılmalıdır (tek doğruluk kaynağı).
 */
export async function recalculateSession(sessionId) {
  const session = await TableSession.findById(sessionId);
  if (!session) throw AppError.notFound('Oturum bulunamadı.');

  const [[orderAgg], [payAgg]] = await Promise.all([
    Order.aggregate([
      { $match: { session: session._id, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Payment.aggregate([
      { $match: { session: session._id, status: 'success' } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
  ]);

  session.totalAmount = orderAgg?.total ?? 0;
  session.paidAmount = payAgg?.paid ?? 0;

  const fullyPaid = session.totalAmount > 0 && session.paidAmount >= session.totalAmount;
  if (fullyPaid && ['open', 'payment_pending'].includes(session.status)) session.status = 'paid';
  else if (!fullyPaid && session.status === 'paid') session.status = 'open';
  await session.save();

  const activeOrders = { session: session._id, status: { $ne: 'cancelled' } };
  if (fullyPaid) {
    await Order.updateMany(activeOrders, { paymentStatus: 'paid' });
    await Table.updateOne({ _id: session.table, status: 'awaiting_payment' }, { status: 'occupied' });
  } else if (session.paidAmount > 0) {
    await Order.updateMany(activeOrders, { paymentStatus: 'partially_paid' });
  } else {
    await Order.updateMany(activeOrders, { paymentStatus: 'unpaid' });
  }

  const payload = {
    sessionId: session._id,
    tableId: session.table,
    status: session.status,
    totalAmount: session.totalAmount,
    paidAmount: session.paidAmount,
    remainingAmount: session.remainingAmount,
  };
  emitToStaff(session.restaurant, EVENTS.SESSION_UPDATED, payload);
  emitToCustomer({ tableId: session.table, sessionKey: session.sessionKey }, EVENTS.SESSION_UPDATED, payload);

  return session;
}

/** Masayı kapatır (hesap kapandı, müşteri kalktı). */
export async function closeSession({ sessionId, restaurantId, force = false }) {
  const session = await TableSession.findOne({ _id: sessionId, restaurant: restaurantId });
  if (!session) throw AppError.notFound('Oturum bulunamadı.');
  if (!ACTIVE_SESSION_STATUSES.includes(session.status)) throw AppError.conflict('Oturum zaten kapalı.');

  if (session.remainingAmount > 0 && !force) {
    throw AppError.conflict(
      `Masada ödenmemiş ${(session.remainingAmount / 100).toFixed(2)} TL tutar var. Yine de kapatmak için force=true gönderin.`,
      'UNPAID_BALANCE'
    );
  }

  session.status = session.totalAmount === 0 ? 'cancelled' : 'closed';
  session.closedAt = new Date();
  await session.save();

  await Table.updateOne({ _id: session.table }, { status: 'available', currentSession: null });

  // Masa boşaldı: bu masada açık kalan garson çağrılarını da kapat.
  const openCalls = await WaiterCall.find({ restaurant: restaurantId, table: session.table, status: { $ne: 'resolved' } });
  if (openCalls.length) {
    const now = new Date();
    await WaiterCall.updateMany(
      { _id: { $in: openCalls.map((c) => c._id) } },
      { $set: { status: 'resolved', resolvedAt: now } }
    );
    openCalls.forEach((call) => {
      emitToStaff(restaurantId, EVENTS.WAITER_CALL_UPDATED, {
        _id: call._id, table: call.table, type: call.type, status: 'resolved', acknowledgedBy: call.acknowledgedBy,
      });
    });
  }

  emitToStaff(restaurantId, EVENTS.TABLE_UPDATED, { tableId: session.table, status: 'available', sessionId: null });
  emitToCustomer(
    { tableId: session.table, sessionKey: session.sessionKey },
    EVENTS.SESSION_UPDATED,
    { sessionId: session._id, tableId: session.table, status: session.status }
  );

  return session;
}
