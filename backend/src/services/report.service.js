import mongoose from 'mongoose';
import { Order, Payment } from '../models/index.js';
import { env } from '../config/env.js';
import { addDays, dayKey, startOfDayInTz } from '../utils/date.js';

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

/**
 * Yönetici özet raporu (tarih aralığı, restoran saat dilimine göre).
 * - Ciro: başarılı ödemelerden (tahsilat bazlı)
 * - Online / nakit / POS oranları
 * - Sipariş adedi, ortalama sepet, iptaller
 * - En çok satan ürünler, saatlik yoğunluk, günlük ciro serisi
 */
export async function getSummaryReport(restaurantId, { from, to } = {}) {
  const tz = env.timezone;
  const fromKey = from ?? dayKey(new Date(), tz);
  const toKey = to ?? fromKey;
  const start = startOfDayInTz(fromKey, tz);
  const end = startOfDayInTz(addDays(toKey, 1), tz);

  const rid = new mongoose.Types.ObjectId(restaurantId.toString());
  const paymentMatch = { restaurant: rid, status: 'success', paidAt: { $gte: start, $lt: end } };
  const orderMatch = { restaurant: rid, createdAt: { $gte: start, $lt: end } };
  const validOrderMatch = { ...orderMatch, status: { $ne: 'cancelled' } };

  const [byMethod, [orderStats], topProducts, hourly, daily] = await Promise.all([
    Payment.aggregate([
      { $match: paymentMatch },
      { $group: { _id: '$method', total: { $sum: '$amount' }, tips: { $sum: '$tipAmount' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          count: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          gross: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$totalAmount', 0] } },
        },
      },
    ]),
    Order.aggregate([
      { $match: validOrderMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $last: '$items.name' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, productId: '$_id', name: 1, quantity: 1, revenue: 1 } },
    ]),
    Order.aggregate([
      { $match: validOrderMatch },
      { $group: { _id: { $hour: { date: '$createdAt', timezone: tz } }, orders: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', orders: 1, revenue: 1 } },
    ]),
    Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: tz } },
          total: { $sum: '$amount' },
          online: { $sum: { $cond: [{ $eq: ['$method', 'online_card'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', total: 1, online: 1 } },
    ]),
  ]);

  const sumBy = (m) => byMethod.find((x) => x._id === m)?.total ?? 0;
  const online = sumBy('online_card');
  const cash = sumBy('cash');
  const posCard = sumBy('pos_card');
  const total = online + cash + posCard;
  const orderCount = orderStats?.count ?? 0;

  return {
    range: { from: fromKey, to: toKey, timezone: tz },
    currency: 'TRY',
    revenue: { total, online, cash, posCard, tips: byMethod.reduce((s, x) => s + x.tips, 0) },
    paymentRatio: { online: pct(online, total), cash: pct(cash, total), posCard: pct(posCard, total) },
    orders: {
      count: orderCount,
      cancelled: orderStats?.cancelled ?? 0,
      grossAmount: orderStats?.gross ?? 0,
      averageOrderValue: orderCount ? Math.round((orderStats.gross || 0) / orderCount) : 0,
    },
    topProducts,
    hourly,
    daily,
  };
}
