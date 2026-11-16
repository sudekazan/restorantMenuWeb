import { Restaurant, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { encryptSecret } from '../utils/crypto.js';
import { toDotPaths } from '../utils/text.js';
import { ok } from '../utils/response.js';
import { getSummaryReport } from '../services/report.service.js';

/* ================= RESTORAN AYARLARI ================= */

export async function getMyRestaurant(req, res) {
  ok(res, await Restaurant.findById(req.restaurantId));
}

export async function updateMyRestaurant(req, res) {
  // İç içe alanlar (settings, address) kısmi güncellensin diye dot-path'e çevrilir
  const restaurant = await Restaurant.findByIdAndUpdate(req.restaurantId, { $set: toDotPaths(req.body) }, { new: true, runValidators: true });
  ok(res, restaurant);
}

/** Restoranın kendi İyzico API anahtarlarını AES-256-GCM ile şifreleyerek kaydeder. */
export async function updateRestaurantIyzico(req, res) {
  const updates = {};
  if (req.body.enabled !== undefined) updates['iyzico.enabled'] = req.body.enabled;
  if (req.body.apiKey !== undefined) updates['iyzico.apiKey'] = encryptSecret(req.body.apiKey);
  if (req.body.secretKey !== undefined) updates['iyzico.secretKey'] = encryptSecret(req.body.secretKey);
  if (req.body.subMerchantKey !== undefined) updates['iyzico.subMerchantKey'] = encryptSecret(req.body.subMerchantKey);

  const restaurant = await Restaurant.findByIdAndUpdate(req.restaurantId, { $set: updates }, { new: true });
  ok(res, restaurant);
}

/* ================= PERSONEL YÖNETİMİ ================= */

export async function listUsers(req, res) {
  const users = await User.find({ restaurant: req.restaurantId }).sort({ role: 1, name: 1 });
  ok(res, users);
}

export async function createUser(req, res) {
  const user = await User.create({ ...req.body, restaurant: req.restaurantId });
  ok(res, user, 201);
}

export async function updateUser(req, res) {
  const user = await User.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!user) throw AppError.notFound('Kullanıcı bulunamadı.');

  const isSelf = user._id.equals(req.user._id);
  if (isSelf && (req.body.isActive === false || (req.body.role && req.body.role !== user.role))) {
    throw AppError.badRequest('Kendi rolünüzü değiştiremez veya hesabınızı pasife alamazsınız.', 'SELF_UPDATE_FORBIDDEN');
  }

  user.set(req.body); // password değişirse pre-save hook hash'ler ve eski token'ları iptal eder
  await user.save();
  ok(res, user);
}

/** Personel silinmez, pasife alınır (geçmiş kayıtlarda adı görünmeye devam eder). */
export async function deactivateUser(req, res) {
  if (req.params.id === req.user._id.toString()) {
    throw AppError.badRequest('Kendi hesabınızı pasife alamazsınız.', 'SELF_UPDATE_FORBIDDEN');
  }
  const user = await User.findOneAndUpdate({ _id: req.params.id, restaurant: req.restaurantId }, { isActive: false });
  if (!user) throw AppError.notFound('Kullanıcı bulunamadı.');
  res.status(204).end();
}

/* ================= RAPORLAR ================= */

/** GET /admin/reports/summary?from=2026-11-01&to=2026-11-14 (varsayılan: bugün) */
export async function getSummary(req, res) {
  ok(res, await getSummaryReport(req.restaurantId, req.validated.query));
}
