import { Counter, Order, Product, TableSession } from '../models/index.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { dayKey, startOfDayInTz } from '../utils/date.js';
import { EVENTS, emitToCustomer, emitToStaff } from '../sockets/emitter.js';
import { getOrCreateActiveSession, recalculateSession } from './session.service.js';

/**
 * İstemciden gelen sepeti doğrular ve fiyatları SUNUCUDA hesaplar.
 * İstemcinin gönderdiği fiyatlara asla güvenilmez.
 */
export async function buildOrderItems(restaurantId, inputItems) {
  const ids = [...new Set(inputItems.map((i) => i.product))];
  const products = await Product.find({ _id: { $in: ids }, restaurant: restaurantId, isActive: true });
  const byId = new Map(products.map((p) => [p.id, p]));

  return inputItems.map((input) => {
    const product = byId.get(input.product);
    if (!product) throw AppError.badRequest('Sepetteki bir ürün artık menüde yok.', 'PRODUCT_NOT_FOUND');
    if (!product.isAvailable) {
      throw AppError.badRequest(`"${product.name}" şu anda servis dışı.`, 'PRODUCT_UNAVAILABLE');
    }

    const selections = input.selectedOptions ?? [];
    for (const sel of selections) {
      if (!product.optionGroups.id(sel.groupId)) {
        throw AppError.badRequest(`"${product.name}" için geçersiz seçenek grubu.`, 'INVALID_OPTION');
      }
    }

    let unitPrice = product.price;
    const selectedOptions = [];

    for (const group of product.optionGroups) {
      const choiceIds = [...new Set(selections.find((s) => s.groupId === group.id)?.choiceIds ?? [])];
      const limit = group.type === 'single' ? 1 : group.maxSelect;

      if (group.isRequired && choiceIds.length === 0) {
        throw AppError.badRequest(`"${product.name}" için "${group.name}" seçimi zorunludur.`, 'OPTION_REQUIRED');
      }
      if (choiceIds.length > limit) {
        throw AppError.badRequest(`"${group.name}" için en fazla ${limit} seçim yapılabilir.`, 'OPTION_LIMIT');
      }

      for (const choiceId of choiceIds) {
        const choice = group.choices.id(choiceId);
        if (!choice || !choice.isAvailable) {
          throw AppError.badRequest(`"${group.name}" içindeki bir seçenek mevcut değil.`, 'INVALID_OPTION');
        }
        unitPrice += choice.priceDelta;
        selectedOptions.push({ groupName: group.name, choiceName: choice.name, priceDelta: choice.priceDelta });
      }
    }

    return {
      product: product._id,
      name: product.name,
      unitPrice,
      quantity: input.quantity,
      selectedOptions,
      note: input.note,
      lineTotal: unitPrice * input.quantity,
    };
  });
}

/** Sipariş oluşturur: doğrula -> oturum aç/bul -> numara al -> kaydet -> toplamları güncelle -> yayınla */
export async function createOrder({ restaurant, table, items, customerNote, source = 'qr', createdBy }) {
  // Önce doğrulama: hatalı sepet boş bir oturum açıp masayı "dolu" göstermesin
  const orderItems = await buildOrderItems(restaurant._id, items);
  const session = await getOrCreateActiveSession(table);

  const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const serviceCharge = Math.round((subtotal * (restaurant.settings?.serviceChargePercent || 0)) / 100);
  const orderNumber = await Counter.next(`order:${restaurant._id}:${dayKey(new Date(), env.timezone)}`);

  const order = await Order.create({
    restaurant: restaurant._id,
    table: table._id,
    session: session._id,
    orderNumber,
    items: orderItems,
    subtotal,
    serviceCharge,
    totalAmount: subtotal + serviceCharge,
    customerNote,
    source,
    createdBy,
    kanbanPosition: Date.now(), // yeni siparişler kolonun sonuna düşer
  });

  await TableSession.updateOne({ _id: session._id }, { $push: { orders: order._id } });
  const updatedSession = await recalculateSession(session._id);

  const payload = { ...order.toObject(), table: { _id: table._id, number: table.number, name: table.name, area: table.area } };
  emitToStaff(restaurant._id, EVENTS.ORDER_NEW, payload);
  emitToCustomer({ tableId: table._id, sessionKey: session.sessionKey }, EVENTS.ORDER_NEW, payload);

  return { order, session: updatedSession };
}

/** Kanban: durum ve/veya kolon içi sıra değişikliği */
export async function updateOrderStatus({ orderId, restaurantId, status, kanbanPosition, cancelReason, userId }) {
  const order = await Order.findOne({ _id: orderId, restaurant: restaurantId });
  if (!order) throw AppError.notFound('Sipariş bulunamadı.');
  if (order.status === 'cancelled') throw AppError.conflict('İptal edilmiş sipariş güncellenemez.');

  const statusChanged = status && status !== order.status;

  if (statusChanged && status === 'cancelled' && order.paymentStatus === 'paid') {
    throw AppError.conflict('Ödemesi alınmış sipariş iptal edilemez; önce iade yapılmalıdır.', 'ORDER_PAID');
  }

  if (statusChanged) {
    order.status = status;
    order.statusHistory.push({ status, changedBy: userId });
    if (status === 'delivered') order.deliveredAt = new Date();
    if (status === 'cancelled') order.cancelReason = cancelReason;
  }
  if (kanbanPosition !== undefined) order.kanbanPosition = kanbanPosition;
  await order.save();

  if (statusChanged && status === 'cancelled') await recalculateSession(order.session);

  const session = await TableSession.findById(order.session).select('sessionKey').lean();
  const payload = { _id: order._id, status: order.status, kanbanPosition: order.kanbanPosition, orderNumber: order.orderNumber, table: order.table };
  emitToStaff(restaurantId, EVENTS.ORDER_UPDATED, payload);
  if (statusChanged) emitToCustomer({ tableId: order.table, sessionKey: session?.sessionKey }, EVENTS.ORDER_UPDATED, payload);

  return order;
}

/** Kanban için varsayılan liste: aktif siparişler + bugün teslim edilenler */
export async function listOrders({ restaurantId, statuses, date }) {
  const filter = { restaurant: restaurantId };

  if (statuses?.length || date) {
    if (statuses?.length) filter.status = { $in: statuses };
    if (date) {
      const start = startOfDayInTz(date, env.timezone);
      filter.createdAt = { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
    }
  } else {
    const todayStart = startOfDayInTz(dayKey(new Date(), env.timezone), env.timezone);
    filter.$or = [
      { status: { $in: ['new', 'preparing', 'ready'] } },
      { status: 'delivered', deliveredAt: { $gte: todayStart } },
    ];
  }

  return Order.find(filter)
    .sort({ status: 1, kanbanPosition: 1 })
    .populate('table', 'number name area')
    .lean();
}
