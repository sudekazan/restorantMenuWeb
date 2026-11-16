import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

/**
 * Müşteri (QR) ekranı için Socket.IO bağlantısı oluşturur.
 */
export function createCustomerSocket({ qrToken, sessionKey }) {
  return io(SOCKET_URL, {
    auth: { qrToken, ...(sessionKey && { sessionKey }) },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
  });
}

/**
 * Personel / Mutfak ekranı için JWT doğrulamalı Socket.IO bağlantısı oluşturur.
 */
export function createStaffSocket(token) {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
  });
}

/** Socket.IO ack callback'ini Promise'e dönüştürür. */
export function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    if (!socket || !socket.connected) {
      reject(new Error('Anlık bağlantı kurulamadı.'));
      return;
    }
    socket.timeout(8000).emit(event, payload, ( timeoutErr, response ) => {
      if (timeoutErr) {
        reject(new Error('Sunucu yanıt vermedi, lütfen tekrar deneyin.'));
        return;
      }
      if (!response?.success) {
        const err = new Error(response?.error?.message || 'İşlem başarısız.');
        err.code = response?.error?.code;
        reject(err);
        return;
      }
      resolve(response.data);
    });
  });
}
