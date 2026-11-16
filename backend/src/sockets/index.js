import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { TableSession, User } from '../models/index.js';
import { STAFF_ROLES } from '../middlewares/auth.js';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { objectId, qrTokenParam } from '../validators/common.js';
import { orderStatusSchema, waiterCallCreateSchema, waiterCallUpdateSchema } from '../validators/order.validators.js';
import { getActiveSession, resolveTableByToken } from '../services/session.service.js';
import { createWaiterCall, updateWaiterCall } from '../services/waiterCall.service.js';
import { updateOrderStatus } from '../services/order.service.js';
import { ROOMS, setIO } from './emitter.js';

/** Ack callback'ini güvenli şekilde çağırır (istemci ack göndermemişse sessizce geçer). */
function reply(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

/** Socket bazlı basit kayan pencere (sliding-window) hız sınırlayıcı. */
function checkSocketRateLimit(socket, key, maxRequests, windowMs) {
  const now = Date.now();
  socket.data.rateLimits = socket.data.rateLimits || {};
  const timestamps = (socket.data.rateLimits[key] || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    throw AppError.badRequest('Çok sık istek gönderildi, lütfen biraz bekleyin.', 'TOO_MANY_REQUESTS');
  }
  timestamps.push(now);
  socket.data.rateLimits[key] = timestamps;
}

/** JWT'den personel kimliğini doğrular ve personel odalarına dahil eder. */
async function authenticateStaffSocket(socket, rawToken) {
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
  const payload = verifyToken(token);
  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    throw AppError.unauthorized('Kullanıcı bulunamadı veya pasif.');
  }
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw AppError.unauthorized('Şifreniz değiştirildi, lütfen tekrar giriş yapın.', 'TOKEN_REVOKED');
  }
  if (!user.restaurant || !STAFF_ROLES.includes(user.role)) {
    throw AppError.forbidden('Personel yetkisi bulunamadı.');
  }

  const restaurantId = user.restaurant.toString();
  socket.data.staff = {
    userId: user._id.toString(),
    restaurantId,
    role: user.role,
    name: user.name,
  };

  await socket.join([ROOMS.staff(restaurantId), ROOMS.role(restaurantId, user.role)]);
  return socket.data.staff;
}

/** QR token'dan müşteri masasını doğrular ve ilgili masa/menü/oturum odalarına dahil eder. */
async function joinCustomerRooms(socket, { qrToken, sessionKey }) {
  const parsed = qrTokenParam.safeParse({ qrToken });
  if (!parsed.success) throw AppError.badRequest('Geçersiz QR kod.', 'INVALID_QR_TOKEN');

  const { table, restaurant } = await resolveTableByToken(parsed.data.qrToken);
  const activeSession = await getActiveSession(table._id);

  // Önceki masa/oturum odalarından ayrıl (müşteri farklı bir QR okuttuysa)
  if (socket.data.customer?.tableId && socket.data.customer.tableId !== table._id.toString()) {
    await socket.leave(ROOMS.table(socket.data.customer.tableId));
  }
  if (socket.data.customer?.sessionKey && socket.data.customer.sessionKey !== activeSession?.sessionKey) {
    await socket.leave(ROOMS.session(socket.data.customer.sessionKey));
  }

  const resolvedSessionKey = activeSession?.sessionKey || sessionKey || null;
  const rooms = [ROOMS.publicMenu(restaurant._id), ROOMS.table(table._id)];
  if (resolvedSessionKey) rooms.push(ROOMS.session(resolvedSessionKey));

  await socket.join(rooms);

  socket.data.customer = {
    qrToken: table.qrToken,
    tableId: table._id.toString(),
    tableNumber: table.number,
    restaurantId: restaurant._id.toString(),
    sessionKey: resolvedSessionKey,
  };

  return {
    restaurantId: restaurant._id,
    table: { _id: table._id, number: table.number, name: table.name, area: table.area },
    sessionKey: resolvedSessionKey,
  };
}

/** Hataları yakalayıp standart ack formatında döndüren sarmalayıcı. */
function withAck(handler) {
  return async (payload = {}, ack) => {
    try {
      const data = await handler(payload || {});
      reply(ack, { success: true, data });
    } catch (err) {
      const message = err?.isOperational ? err.message : 'İşlem gerçekleştirilemedi.';
      const code = typeof err?.code === 'string' ? err.code : 'SOCKET_ERROR';
      reply(ack, { success: false, error: { code, message } });
    }
  };
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrls, credentials: true },
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  // Handshake aşamasında opsiyonel otomatik kimlik/masa bağlama
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const token = socket.handshake.auth?.token || authHeader;
      const qrToken = socket.handshake.auth?.qrToken || socket.handshake.query?.qrToken;
      const sessionKey = socket.handshake.auth?.sessionKey || socket.handshake.query?.sessionKey;

      if (token) {
        await authenticateStaffSocket(socket, String(token));
      } else if (qrToken) {
        await joinCustomerRooms(socket, { qrToken: String(qrToken), sessionKey: sessionKey ? String(sessionKey) : undefined });
      }
      next();
    } catch (err) {
      next(new Error(err?.message || 'UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    /* ---------- MÜŞTERİ OLAYLARI ---------- */

    // Müşteri masa QR'ı ile odaya katılır veya masa değiştirir
    socket.on(
      'table:join',
      withAck(async ({ qrToken, sessionKey }) => joinCustomerRooms(socket, { qrToken, sessionKey }))
    );

    // İlk sipariş verildikten sonra oluşan sessionKey odasına katılır
    socket.on(
      'session:join',
      withAck(async ({ sessionKey }) => {
        if (!sessionKey || typeof sessionKey !== 'string') {
          throw AppError.badRequest('Geçerli bir sessionKey gerekli.');
        }
        const session = await TableSession.findOne({ sessionKey }).select('table restaurant sessionKey').lean();
        if (!session) throw AppError.notFound('Oturum bulunamadı.');
        if (socket.data.customer?.tableId && socket.data.customer.tableId !== session.table.toString()) {
          throw AppError.forbidden('Bu oturum masanıza ait değil.');
        }
        await socket.join(ROOMS.session(sessionKey));
        if (socket.data.customer) socket.data.customer.sessionKey = sessionKey;
        return { sessionKey };
      })
    );

    // Tek tuşla Socket.IO üzerinden "Garson Çağır" / "Hesap İste" bildirimi
    socket.on(
      'waiter:call',
      withAck(async (payload) => {
        checkSocketRateLimit(socket, 'waiter:call', 5, 60_000);

        const qrToken = payload.qrToken || socket.data.customer?.qrToken;
        const parsedQr = qrTokenParam.safeParse({ qrToken });
        if (!parsedQr.success) throw AppError.badRequest('Geçersiz masa QR kodu.', 'INVALID_QR_TOKEN');

        const parsedBody = waiterCallCreateSchema.safeParse({ type: payload.type, note: payload.note });
        if (!parsedBody.success) throw AppError.badRequest('Geçersiz çağrı bilgisi.', 'VALIDATION_ERROR');

        const { table } = await resolveTableByToken(parsedQr.data.qrToken);
        const { call, duplicate } = await createWaiterCall({
          table,
          type: parsedBody.data.type,
          note: parsedBody.data.note,
        });

        return {
          call: { _id: call._id, type: call.type, status: call.status, createdAt: call.createdAt },
          duplicate,
        };
      })
    );

    /* ---------- PERSONEL / MUTFAK OLAYLARI ---------- */

    // Bağlantı kurulduktan sonra JWT ile personel odasına geçiş
    socket.on(
      'staff:join',
      withAck(async ({ token }) => {
        if (!token) throw AppError.unauthorized();
        return authenticateStaffSocket(socket, String(token));
      })
    );

    // Kanban sürükle-bırak durum güncellemesi (Socket.IO üzerinden)
    socket.on(
      'order:status',
      withAck(async ({ orderId, status, kanbanPosition, cancelReason }) => {
        if (!socket.data.staff) throw AppError.unauthorized('Personel oturumu gerekli.');
        const idCheck = objectId.safeParse(orderId);
        const bodyCheck = orderStatusSchema.safeParse({ status, kanbanPosition, cancelReason });
        if (!idCheck.success || !bodyCheck.success) {
          throw AppError.badRequest('Geçersiz sipariş durum verisi.', 'VALIDATION_ERROR');
        }

        const order = await updateOrderStatus({
          orderId: idCheck.data,
          restaurantId: socket.data.staff.restaurantId,
          userId: socket.data.staff.userId,
          ...bodyCheck.data,
        });
        return { _id: order._id, status: order.status, kanbanPosition: order.kanbanPosition };
      })
    );

    // Garson çağrısını yanıtlama / tamamlama (Socket.IO üzerinden)
    socket.on(
      'waiter:respond',
      withAck(async ({ callId, status }) => {
        if (!socket.data.staff) throw AppError.unauthorized('Personel oturumu gerekli.');
        const idCheck = objectId.safeParse(callId);
        const bodyCheck = waiterCallUpdateSchema.safeParse({ status });
        if (!idCheck.success || !bodyCheck.success) {
          throw AppError.badRequest('Geçersiz çağrı güncelleme verisi.', 'VALIDATION_ERROR');
        }

        const call = await updateWaiterCall({
          callId: idCheck.data,
          restaurantId: socket.data.staff.restaurantId,
          status: bodyCheck.data.status,
          userId: socket.data.staff.userId,
        });
        return { _id: call._id, status: call.status, acknowledgedBy: call.acknowledgedBy };
      })
    );
  });

  setIO(io);
  return io;
}
