import { Table, TableSession, WaiterCall } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { EVENTS, emitToCustomer, emitToStaff } from '../sockets/emitter.js';
import { getActiveSession } from './session.service.js';

const DUPLICATE_WINDOW_MS = 60 * 1000;
const BILL_TYPES = ['request_bill', 'request_cash_payment'];

/** Müşteri çağrısı. Aynı masadan 60 sn içinde aynı tipte bekleyen çağrı varsa onu döner (idempotent). */
export async function createWaiterCall({ table, type, note }) {
  const recent = await WaiterCall.findOne({
    table: table._id,
    type,
    status: 'pending',
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  });
  if (recent) return { call: recent, duplicate: true };

  const session = await getActiveSession(table._id);
  const call = await WaiterCall.create({ restaurant: table.restaurant, table: table._id, session: session?._id, type, note });

  if (BILL_TYPES.includes(type)) {
    await Table.updateOne({ _id: table._id }, { status: 'awaiting_payment' });
    if (session?.status === 'open') {
      session.status = 'payment_pending';
      await session.save();
    }
    emitToStaff(table.restaurant, EVENTS.TABLE_UPDATED, { tableId: table._id, status: 'awaiting_payment' });
  }

  const payload = {
    ...call.toObject(),
    table: { _id: table._id, number: table.number, name: table.name, area: table.area },
  };
  emitToStaff(table.restaurant, EVENTS.WAITER_CALL_NEW, payload);
  emitToCustomer({ tableId: table._id, sessionKey: session?.sessionKey }, EVENTS.WAITER_CALL_NEW, payload);

  return { call, duplicate: false };
}

export async function updateWaiterCall({ callId, restaurantId, status, userId }) {
  const call = await WaiterCall.findOne({ _id: callId, restaurant: restaurantId });
  if (!call) throw AppError.notFound('Çağrı bulunamadı.');
  if (call.status === 'resolved') throw AppError.conflict('Çağrı zaten tamamlanmış.');

  const now = new Date();
  if (!call.acknowledgedAt) {
    call.acknowledgedAt = now;
    call.acknowledgedBy = userId;
  }
  if (status === 'resolved') call.resolvedAt = now;
  call.status = status;
  await call.save();

  const payload = { _id: call._id, table: call.table, type: call.type, status: call.status, acknowledgedBy: call.acknowledgedBy };
  emitToStaff(restaurantId, EVENTS.WAITER_CALL_UPDATED, payload);

  const session = call.session ? await TableSession.findById(call.session).select('sessionKey').lean() : null;
  emitToCustomer({ tableId: call.table, sessionKey: session?.sessionKey }, EVENTS.WAITER_CALL_UPDATED, payload);

  return call;
}
