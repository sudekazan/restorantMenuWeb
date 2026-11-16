import { Category, Product } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/text.js';
import { ok } from '../utils/response.js';

export async function listCategories(req, res) {
  const categories = await Category.find({ restaurant: req.restaurantId }).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([
    { $match: { restaurant: req.restaurantId, isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
  ok(res, categories.map((c) => ({ ...c, productCount: countMap.get(c._id.toString()) ?? 0 })));
}

export async function getCategory(req, res) {
  const category = await Category.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!category) throw AppError.notFound('Kategori bulunamadı.');
  ok(res, category);
}

export async function createCategory(req, res) {
  const category = await Category.create({ ...req.body, restaurant: req.restaurantId, slug: slugify(req.body.name) });
  ok(res, category, 201);
}

export async function updateCategory(req, res) {
  const update = { ...req.body };
  if (update.name) update.slug = slugify(update.name);
  const category = await Category.findOneAndUpdate({ _id: req.params.id, restaurant: req.restaurantId }, update, {
    new: true,
    runValidators: true,
  });
  if (!category) throw AppError.notFound('Kategori bulunamadı.');
  ok(res, category);
}

export async function deleteCategory(req, res) {
  const hasProducts = await Product.exists({ restaurant: req.restaurantId, category: req.params.id, isActive: true });
  if (hasProducts) throw AppError.conflict('Bu kategoride ürünler var. Önce ürünleri taşıyın veya silin.', 'CATEGORY_NOT_EMPTY');

  const result = await Category.deleteOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!result.deletedCount) throw AppError.notFound('Kategori bulunamadı.');
  res.status(204).end();
}

/** Sürükle-bırak ile kategori sırası: { ids: [id1, id2, ...] } */
export async function reorderCategories(req, res) {
  await Category.bulkWrite(
    req.body.ids.map((id, index) => ({
      updateOne: { filter: { _id: id, restaurant: req.restaurantId }, update: { sortOrder: index } },
    }))
  );
  ok(res, { reordered: req.body.ids.length });
}
