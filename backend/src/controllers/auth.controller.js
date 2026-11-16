import { Restaurant, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import { slugify } from '../utils/text.js';
import { ok } from '../utils/response.js';

async function uniqueRestaurantSlug(name) {
  const base = slugify(name) || 'restoran';
  let slug = base;
  for (let i = 2; await Restaurant.exists({ slug }); i++) slug = `${base}-${i}`;
  return slug;
}

/** SaaS kaydı: yeni restoran + sahibi (admin) */
export async function registerRestaurant(req, res) {
  const { restaurantName, name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw AppError.conflict('Bu e-posta adresi zaten kayıtlı.', 'EMAIL_TAKEN');

  const restaurant = await Restaurant.create({
    name: restaurantName,
    slug: await uniqueRestaurantSlug(restaurantName),
    email,
    phone,
  });

  let user;
  try {
    user = await User.create({ restaurant: restaurant._id, name, email, password, phone, role: 'admin' });
  } catch (err) {
    await Restaurant.deleteOne({ _id: restaurant._id }); // telafi (compensation)
    throw err;
  }

  ok(res, { token: signToken(user), user, restaurant }, 201);
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw AppError.unauthorized('E-posta veya şifre hatalı.', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw AppError.forbidden('Hesabınız pasif durumda.', 'USER_INACTIVE');

  let restaurant = null;
  if (user.restaurant) {
    restaurant = await Restaurant.findById(user.restaurant);
    if (!restaurant?.isActive) throw AppError.forbidden('Restoran hesabı pasif durumda.', 'RESTAURANT_INACTIVE');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  ok(res, { token: signToken(user), user, restaurant });
}

export async function me(req, res) {
  const restaurant = req.restaurantId ? await Restaurant.findById(req.restaurantId) : null;
  ok(res, { user: req.user, restaurant });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw AppError.badRequest('Mevcut şifre hatalı.', 'INVALID_PASSWORD');
  }
  user.password = req.body.newPassword;
  await user.save();
  ok(res, { token: signToken(user) }); // eski token'lar geçersiz, yenisi döner
}
