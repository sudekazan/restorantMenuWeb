import { Category, Product } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/text.js';
import { ok } from '../utils/response.js';
import { removeProductImage } from '../middlewares/upload.js';
import { EVENTS, emitToPublicMenu, emitToStaff } from '../sockets/emitter.js';

async function assertCategory(restaurantId, categoryId) {
  if (!(await Category.exists({ _id: categoryId, restaurant: restaurantId }))) {
    throw AppError.badRequest('Kategori bulunamadı.', 'CATEGORY_NOT_FOUND');
  }
}

export async function listProducts(req, res) {
  const { category, search, includeInactive } = req.validated.query;
  const filter = { restaurant: req.restaurantId };
  if (!includeInactive) filter.isActive = true;
  if (category) filter.category = category;
  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

  const products = await Product.find(filter).sort({ sortOrder: 1, name: 1 }).populate('category', 'name slug').lean();
  ok(res, products);
}

export async function getProduct(req, res) {
  const product = await Product.findOne({ _id: req.params.id, restaurant: req.restaurantId }).populate('category', 'name slug');
  if (!product) throw AppError.notFound('Ürün bulunamadı.');
  ok(res, product);
}

export async function createProduct(req, res) {
  await assertCategory(req.restaurantId, req.body.category);
  const product = await Product.create({ ...req.body, restaurant: req.restaurantId });
  ok(res, product, 201);
}

export async function updateProduct(req, res) {
  if (req.body.category) await assertCategory(req.restaurantId, req.body.category);
  const product = await Product.findOneAndUpdate({ _id: req.params.id, restaurant: req.restaurantId }, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) throw AppError.notFound('Ürün bulunamadı.');
  ok(res, product);
}

/** Soft delete: geçmiş siparişler ve raporlar bozulmasın diye kayıt silinmez. */
export async function deleteProduct(req, res) {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.restaurantId, isActive: true },
    { isActive: false, isAvailable: false }
  );
  if (!product) throw AppError.notFound('Ürün bulunamadı.');
  res.status(204).end();
}

/** multipart/form-data, alan adı: "image" */
export async function uploadImage(req, res) {
  if (!req.file) throw AppError.badRequest('Görsel dosyası gönderilmedi (alan adı: image).', 'NO_FILE');

  const product = await Product.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!product) {
    await removeProductImage(req.file.filename);
    throw AppError.notFound('Ürün bulunamadı.');
  }

  const oldImage = product.imagePublicId;
  product.imageUrl = `/uploads/products/${req.file.filename}`;
  product.imagePublicId = req.file.filename;
  await product.save();
  await removeProductImage(oldImage);

  ok(res, product);
}

/** Mutfak: "tükendi" / "tekrar mevcut" */
export async function setAvailability(req, res) {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, restaurant: req.restaurantId, isActive: true },
    { isAvailable: req.body.isAvailable },
    { new: true }
  );
  if (!product) throw AppError.notFound('Ürün bulunamadı.');
  const availabilityPayload = { productId: product._id, isAvailable: product.isAvailable };
  emitToStaff(req.restaurantId, EVENTS.PRODUCT_AVAILABILITY, availabilityPayload);
  emitToPublicMenu(req.restaurantId, EVENTS.PRODUCT_AVAILABILITY, availabilityPayload);
  ok(res, { _id: product._id, name: product.name, isAvailable: product.isAvailable });
}
