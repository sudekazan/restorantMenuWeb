/**
 * Gerçek zamanlı olay yayıncısı.
 * Servis katmanı Socket.IO nesnesine doğrudan bağımlı olmaz, bu modülü kullanır.
 */
let io = null;

export function setIO(instance) {
  io = instance;
}

export function getIO() {
  return io;
}

export const ROOMS = Object.freeze({
  staff: (restaurantId) => `staff:${restaurantId}`,               // Tüm personel/mutfak/kasa ekranları
  role: (restaurantId, role) => `role:${restaurantId}:${role}`,   // Rol bazlı alt oda (waiter, kitchen, cashier)
  publicMenu: (restaurantId) => `public:${restaurantId}`,         // Menüyü görüntüleyen müşteriler (stok değişimi vb.)
  table: (tableId) => `table:${tableId}`,                         // Masadaki müşteri cihazları (oturum öncesi dahil)
  session: (sessionKey) => `session:${sessionKey}`,               // Aktif adisyon oturumu
});

export const EVENTS = Object.freeze({
  ORDER_NEW: 'order:new',
  ORDER_UPDATED: 'order:updated',
  WAITER_CALL_NEW: 'waiter-call:new',
  WAITER_CALL_UPDATED: 'waiter-call:updated',
  TABLE_UPDATED: 'table:updated',
  SESSION_UPDATED: 'session:updated',
  PAYMENT_RECEIVED: 'payment:received',
  PAYMENT_REFUNDED: 'payment:refunded',
  PRODUCT_AVAILABILITY: 'product:availability',
});

export function emitToStaff(restaurantId, event, payload) {
  if (!io || !restaurantId) return;
  io.to(ROOMS.staff(restaurantId.toString())).emit(event, payload);
}

export function emitToRole(restaurantId, role, event, payload) {
  if (!io || !restaurantId || !role) return;
  io.to(ROOMS.role(restaurantId.toString(), role)).emit(event, payload);
}

export function emitToPublicMenu(restaurantId, event, payload) {
  if (!io || !restaurantId) return;
  io.to(ROOMS.publicMenu(restaurantId.toString())).emit(event, payload);
}

export function emitToTable(tableId, event, payload) {
  if (!io || !tableId) return;
  io.to(ROOMS.table(tableId.toString())).emit(event, payload);
}

export function emitToSession(sessionKey, event, payload) {
  if (!io || !sessionKey) return;
  io.to(ROOMS.session(sessionKey)).emit(event, payload);
}

/**
 * Hem masa odasına hem de (varsa) adisyon oturum odasına tek seferde yayın yapar.
 * Socket.IO zincirleme `.to(A).to(B).emit(...)` çağrısında her iki odada bulunan
 * istemcilere olayı mükerrer göndermez (otomatik tekilleştirir).
 */
export function emitToCustomer({ tableId, sessionKey }, event, payload) {
  if (!io) return;
  let target = null;
  if (tableId) target = io.to(ROOMS.table(tableId.toString()));
  if (sessionKey) target = (target || io).to(ROOMS.session(sessionKey));
  if (target) target.emit(event, payload);
}
