import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

export const STAFF_ROLES = ['admin', 'manager', 'waiter', 'kitchen', 'cashier'];

/** Bearer JWT doğrular, req.user ve req.restaurantId'yi doldurur. */
export async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw AppError.unauthorized();

  const payload = verifyToken(token); // Geçersiz/süresi dolmuş => errorHandler 401 döner
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw AppError.unauthorized('Kullanıcı bulunamadı veya pasif.');

  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw AppError.unauthorized('Şifreniz değiştirildi, lütfen tekrar giriş yapın.', 'TOKEN_REVOKED');
  }

  req.user = user;
  req.restaurantId = user.restaurant ?? null;
  next();
}

/** Belirtilen rollerden birine sahip olmayı zorunlu kılar. */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}

/** Restorana bağlı olmayan (super_admin) kullanıcıların tenant uçlarına erişimini engeller. */
export function requireTenant(req, _res, next) {
  if (!req.restaurantId) throw AppError.forbidden('Bu işlem bir restoran hesabı gerektirir.');
  next();
}
