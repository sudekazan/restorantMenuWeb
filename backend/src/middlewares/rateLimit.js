import rateLimit from 'express-rate-limit';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message } },
  });

export const authLimiter = make(15 * 60 * 1000, 20, 'Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin.');
export const publicLimiter = make(60 * 1000, 120, 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.');
export const orderLimiter = make(60 * 1000, 10, 'Çok kısa sürede çok fazla sipariş verildi.');
export const waiterCallLimiter = make(60 * 1000, 5, 'Çok fazla çağrı gönderildi. Lütfen biraz bekleyin.');
