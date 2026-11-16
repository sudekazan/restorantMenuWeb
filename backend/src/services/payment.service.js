import { Order, Payment, Restaurant, Table, TableSession } from '../models/index.js';
import { env } from '../config/env.js';
import {
  initializeCheckoutForm,
  kurusToTl,
  refundPaymentTransaction,
   resolveIyzicoConfig,
  retrieveCheckoutForm,
  tlToKurus,
} from '../config/iyzico.js';
import { AppError } from '../utils/AppError.js';
import { EVENTS, emitToCustomer, emitToStaff } from '../sockets/emitter.js';
import { getActiveSession, recalculateSession, resolveTableByToken } from './session.service.js';

/**
 * İyzico sepet kalemlerini (basketItems) oluşturur.
 * İyzico kuralı: basketItems[].price toplamı paidPrice/price ile kuruşu kuruşuna eşit olmalıdır.
 * Kısmi ödeme, servis ücreti veya bahşiş durumlarında kalem tutarları orantılı dağıtılır ve
 * yuvarlama farkı son kaleme eklenir.
 */
function buildIyzicoBasketItems({ orders, totalChargedKurus, subMerchantKey }) {
  const rawItems = [];
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const item of order.items) {
      if (item.lineTotal > 0) {
        rawItems.push({
          id: item._id.toString(),
          name: item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name,
          category1: 'Yiyecek & İçecek',
          rawKurus: item.lineTotal,
        });
      }
    }
  }

  if (rawItems.length === 0) {
    rawItems.push({
      id: 'adisyon',
      name: 'Masa Adisyon Ödemesi',
      category1: 'Restoran',
      rawKurus: totalChargedKurus,
    });
  }

  const rawSum = rawItems.reduce((sum, i) => sum + i.rawKurus, 0) || totalChargedKurus;
  let allocated = 0;

  return rawItems.map((item, idx) => {
    const isLast = idx === rawItems.length - 1;
    let itemKurus = isLast
      ? totalChargedKurus - allocated
      : Math.max(1, Math.round((item.rawKurus / rawSum) * totalChargedKurus));

    // Son kaleme en az 1 kuruş kalmasını garanti et
    const maxAllowed = totalChargedKurus - allocated - (rawItems.length - 1 - idx);
    if (!isLast && itemKurus > maxAllowed) itemKurus = Math.max(1, maxAllowed);
    allocated += itemKurus;

    const priceTl = kurusToTl(itemKurus);
    return {
      id: item.id,
      name: item.name.slice(0, 80),
      category1: item.category1,
      itemType: 'PHYSICAL',
      price: priceTl,
      ...(subMerchantKey && { subMerchantKey, subMerchantPrice: priceTl }),
    };
  });
}

/**
 * 1) Kasada alınan nakit / fiziksel POS ödemesini kaydeder.
 */
export async function recordManualPayment({ restaurantId, sessionId, method, amount, tipAmount = 0, userId }) {
  const session = await TableSession.findOne({ _id: sessionId, restaurant: restaurantId });
  if (!session) throw AppError.notFound('Oturum bulunamadı.');
  if (!['open', 'payment_pending'].includes(session.status)) {
    throw AppError.conflict('Bu oturum için alınacak ödeme yok.', 'NOTHING_TO_PAY');
  }

  const remaining = session.remainingAmount;
  if (remaining <= 0) throw AppError.conflict('Hesap zaten ödenmiş.', 'NOTHING_TO_PAY');

  const payAmount = amount ?? remaining;
  if (payAmount > remaining) {
    throw AppError.badRequest(
      `Ödeme tutarı kalan tutardan (${(remaining / 100).toFixed(2)} TL) fazla olamaz.`,
      'AMOUNT_EXCEEDS'
    );
  }

  const payment = await Payment.create({
    restaurant: restaurantId,
    table: session.table,
    session: session._id,
    orders: session.orders,
    amount: payAmount,
    tipAmount,
    method,
    status: 'success',
    receivedBy: userId,
    paidAt: new Date(),
  });

  await TableSession.updateOne({ _id: session._id }, { $addToSet: { payments: payment._id } });
  const updated = await recalculateSession(session._id);

  const payload = {
    paymentId: payment._id,
    sessionId: session._id,
    tableId: session.table,
    method,
    amount: payAmount,
    tipAmount,
  };
  emitToStaff(restaurantId, EVENTS.PAYMENT_RECEIVED, payload);
  emitToCustomer({ tableId: session.table, sessionKey: session.sessionKey }, EVENTS.PAYMENT_RECEIVED, payload);

  return { payment, session: updated };
}

/**
 * 2) Müşteri ekranından İyzico Checkout Form başlatır.
 */
export async function initializeOnlinePayment({ qrToken, amount, tipAmount = 0, buyer = {}, clientIp = '127.0.0.1' }) {
  const { table } = await resolveTableByToken(qrToken);
  const restaurant = await Restaurant.findById(table.restaurant).select(
    '+iyzico.apiKey +iyzico.secretKey +iyzico.subMerchantKey'
  );

  if (!restaurant.settings?.allowOnlinePayment) {
    throw AppError.forbidden('Bu restoranda online ödeme kapalıdır.', 'ONLINE_PAYMENT_DISABLED');
  }

  const session = await getActiveSession(table._id);
  if (!session || session.remainingAmount <= 0) {
    throw AppError.conflict('Masada ödenecek açık hesap bulunmuyor.', 'NOTHING_TO_PAY');
  }

  const payAmount = amount ?? session.remainingAmount;
  if (payAmount > session.remainingAmount) {
    throw AppError.badRequest(
      `Ödeme tutarı kalan hesaptan (${kurusToTl(session.remainingAmount)} TL) fazla olamaz.`,
      'AMOUNT_EXCEEDS'
    );
  }

  const totalCharged = payAmount + tipAmount;
  const priceTl = kurusToTl(totalCharged);
  const iyzicoConfig = resolveIyzicoConfig(restaurant);

  const orders = await Order.find({ session: session._id, status: { $ne: 'cancelled' } }).lean();
  const basketItems = buildIyzicoBasketItems({
    orders,
    totalChargedKurus: totalCharged,
    subMerchantKey: iyzicoConfig.subMerchantKey,
  });

  const payment = new Payment({
    restaurant: restaurant._id,
    table: table._id,
    session: session._id,
    orders: session.orders,
    amount: payAmount,
    tipAmount,
    currency: restaurant.currency || 'TRY',
    method: 'online_card',
    status: 'pending',
  });
  const conversationId = `pay_${payment._id.toString()}`;
  payment.iyzico = { conversationId };
  await payment.save();

  const callbackUrl = `${env.apiBaseUrl}/api/v1/public/payments/iyzico/callback`;
  const city = restaurant.address?.city || 'Istanbul';
  const addressLine = restaurant.address?.line || `${restaurant.name} - Masa ${table.number}`;
  const buyerName = buyer.name || 'Misafir';
  const buyerSurname = buyer.surname || `Masa ${table.number}`;

  const requestPayload = {
    locale: 'tr',
    conversationId,
    price: priceTl,
    paidPrice: priceTl,
    currency: restaurant.currency || 'TRY',
    basketId: session._id.toString(),
    paymentGroup: 'PRODUCT',
    callbackUrl,
    enabledInstallments: [1],
    buyer: {
      id: session.sessionKey.slice(0, 24),
      name: buyerName,
      surname: buyerSurname,
      gsmNumber: buyer.phone || '+905555555555',
      email: buyer.email || 'misafir@qrmenu.local',
      identityNumber: '11111111110',
      registrationAddress: addressLine,
      ip: clientIp,
      city,
      country: 'Turkey',
    },
    shippingAddress: {
      contactName: `${buyerName} ${buyerSurname}`,
      city,
      country: 'Turkey',
      address: addressLine,
    },
    billingAddress: {
      contactName: `${buyerName} ${buyerSurname}`,
      city,
      country: 'Turkey',
      address: addressLine,
    },
    basketItems,
  };

  let initResult;
  try {
    initResult = await initializeCheckoutForm({
      restaurant,
      requestPayload,
      meta: { restaurantName: restaurant.name, tableLabel: table.name || `Masa ${table.number}` },
    });
  } catch (err) {
    payment.status = 'failed';
    payment.iyzico.errorCode = err.code || 'INIT_ERROR';
    payment.iyzico.errorMessage = err.message;
    await payment.save();
    throw err;
  }

  payment.iyzico.token = initResult.token;
  await payment.save();

  if (session.status === 'open') {
    session.status = 'payment_pending';
    await session.save();
  }
  if (table.status !== 'awaiting_payment') {
    await Table.updateOne({ _id: table._id }, { status: 'awaiting_payment' });
    emitToStaff(restaurant._id, EVENTS.TABLE_UPDATED, { tableId: table._id, status: 'awaiting_payment' });
  }

  return {
    paymentId: payment._id,
    conversationId,
    token: initResult.token,
    mode: initResult.mode,
    amount: payAmount,
    tipAmount,
    totalCharged,
    checkoutFormContent: initResult.checkoutFormContent,
    paymentPageUrl: initResult.paymentPageUrl,
    tokenExpireTime: initResult.tokenExpireTime,
  };
}

/**
 * 3) İyzico Callback işleyicisi (hem POST hem GET redirect destekler, idempotent).
 */
export async function completeIyzicoCallback({ token, mockStatus }) {
  if (!token) throw AppError.badRequest('Ödeme token parametresi eksik.', 'MISSING_TOKEN');

  const payment = await Payment.findOne({ 'iyzico.token': token });
  if (!payment) throw AppError.notFound('Ödeme kaydı bulunamadı.', 'PAYMENT_NOT_FOUND');

  const table = await Table.findById(payment.table).select('qrToken number name area').lean();
  const baseReturnUrl = table ? `${env.publicMenuUrl}/${table.qrToken}` : env.publicMenuUrl;

  // Mükerrer callback koruması: daha önce başarıyla işlendiyse tekrar sayma
  if (payment.status === 'success') {
    return {
      status: 'success',
      payment,
      redirectUrl: `${baseReturnUrl}?payment=success&paymentId=${payment._id}`,
    };
  }

  const restaurant = await Restaurant.findById(payment.restaurant).select(
    '+iyzico.apiKey +iyzico.secretKey +iyzico.subMerchantKey'
  );

  const result = await retrieveCheckoutForm({
    restaurant,
    token,
    conversationId: payment.iyzico?.conversationId,
    mockStatus,
    expectedPayment: payment,
  });

  const isApproved = result.status === 'success' && result.paymentStatus === 'SUCCESS';
  const paidKurus = tlToKurus(result.paidPrice ?? result.price ?? 0);

  if (!isApproved || paidKurus < payment.amount) {
    const errorMessage = result.errorMessage || 'Ödeme banka veya İyzico tarafından onaylanmadı.';
    payment.status = 'failed';
    payment.iyzico.errorCode = result.errorCode || 'PAYMENT_DECLINED';
    payment.iyzico.errorMessage = errorMessage;
    payment.iyzico.rawResponse = result;
    await payment.save();

    return {
      status: 'failed',
      payment,
      redirectUrl: `${baseReturnUrl}?payment=failed&paymentId=${payment._id}&reason=${encodeURIComponent(errorMessage)}`,
    };
  }

  const txIds = (result.itemTransactions || [])
    .map((tx) => tx.paymentTransactionId)
    .filter(Boolean);

  // Atomik durum geçişi (eşzamanlı 2 callback gelse bile yalnızca ilki işlenir)
  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'success' } },
    {
      $set: {
        status: 'success',
        paidAt: new Date(),
        'iyzico.paymentId': result.paymentId ? String(result.paymentId) : undefined,
        'iyzico.paymentTransactionIds': txIds,
        'iyzico.cardAssociation': result.cardAssociation,
        'iyzico.cardFamily': result.cardFamily,
        'iyzico.lastFourDigits': result.lastFourDigits,
        'iyzico.installment': result.installment || 1,
        'iyzico.rawResponse': result,
      },
    },
    { new: true }
  );

  if (updatedPayment) {
    await TableSession.updateOne({ _id: payment.session }, { $addToSet: { payments: payment._id } });
    const session = await recalculateSession(payment.session);

    const payload = {
      paymentId: updatedPayment._id,
      sessionId: session._id,
      tableId: payment.table,
      table: table ? { _id: table._id, number: table.number, name: table.name, area: table.area } : undefined,
      method: 'online_card',
      amount: updatedPayment.amount,
      tipAmount: updatedPayment.tipAmount,
      remainingAmount: session.remainingAmount,
      cardAssociation: updatedPayment.iyzico?.cardAssociation,
      lastFourDigits: updatedPayment.iyzico?.lastFourDigits,
    };
    emitToStaff(payment.restaurant, EVENTS.PAYMENT_RECEIVED, payload);
    emitToCustomer({ tableId: payment.table, sessionKey: session.sessionKey }, EVENTS.PAYMENT_RECEIVED, payload);
  }

  return {
    status: 'success',
    payment: updatedPayment || payment,
    redirectUrl: `${baseReturnUrl}?payment=success&paymentId=${payment._id}`,
  };
}

/**
 * 4) Müşteri ekranından ödeme durumu sorgulama.
 */
export async function getPublicPaymentStatus({ qrToken, paymentId }) {
  const { table } = await resolveTableByToken(qrToken);
  const payment = await Payment.findOne({ _id: paymentId, table: table._id })
    .select('amount tipAmount currency method status paidAt iyzico.cardAssociation iyzico.cardFamily iyzico.lastFourDigits iyzico.errorMessage createdAt')
    .lean();
  if (!payment) throw AppError.notFound('Ödeme kaydı bulunamadı.');
  return payment;
}

/**
 * 5) Ödeme İadesi (Nakit/POS veya İyzico online kart iadesi).
 */
export async function refundPayment({ paymentId, restaurantId, clientIp = '127.0.0.1' }) {
  const payment = await Payment.findOne({ _id: paymentId, restaurant: restaurantId });
  if (!payment) throw AppError.notFound('Ödeme kaydı bulunamadı.');
  if (payment.status !== 'success') {
    throw AppError.conflict('Yalnızca başarılı ödemeler iade edilebilir.', 'INVALID_PAYMENT_STATE');
  }

  if (payment.method === 'online_card') {
    const restaurant = await Restaurant.findById(restaurantId).select(
      '+iyzico.apiKey +iyzico.secretKey +iyzico.subMerchantKey'
    );
    const txIds = payment.iyzico?.paymentTransactionIds || [];
    if (txIds.length === 0) {
      throw AppError.badRequest('İyzico kırılım ID (paymentTransactionId) bulunamadı.', 'MISSING_TX_ID');
    }

    const totalTl = kurusToTl(payment.amount + (payment.tipAmount || 0));
    // Tek kırılımda tam tutar, çoklu kırılımda rawResponse içindeki kırılım tutarları iade edilir
    const rawWithTx = await Payment.findById(payment._id).select('+iyzico.rawResponse').lean();
    const itemTxs = rawWithTx?.iyzico?.rawResponse?.itemTransactions || [];

    for (const txId of txIds) {
      const matched = itemTxs.find((t) => t.paymentTransactionId === txId);
      const priceTl = matched?.paidPrice ? String(matched.paidPrice) : totalTl;
      await refundPaymentTransaction({
        restaurant,
        paymentTransactionId: txId,
        priceTl,
        currency: payment.currency || 'TRY',
        ip: clientIp,
        conversationId: `ref_${payment._id.toString()}`,
      });
    }
  }

  payment.status = 'refunded';
  payment.refundedAt = new Date();
  await payment.save();

  const session = await recalculateSession(payment.session);
  const payload = {
    paymentId: payment._id,
    sessionId: session._id,
    tableId: payment.table,
    amount: payment.amount,
    remainingAmount: session.remainingAmount,
  };
  emitToStaff(restaurantId, EVENTS.PAYMENT_REFUNDED, payload);
  emitToCustomer({ tableId: payment.table, sessionKey: session.sessionKey }, EVENTS.PAYMENT_REFUNDED, payload);

  return { payment, session };
}
