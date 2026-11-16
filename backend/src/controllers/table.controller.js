import { Order, Restaurant, Table } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/response.js';
import { buildTableMenuUrl, generateQrPng, generateTablesQrPdf } from '../services/qr.service.js';
import { slugify } from '../utils/text.js';

const withMenuUrl = (t) => ({ ...(t.toObject ? t.toObject() : t), menuUrl: buildTableMenuUrl(t) });

export async function listTables(req, res) {
  const tables = await Table.find({ restaurant: req.restaurantId }).sort({ number: 1 }).lean();
  ok(res, tables.map(withMenuUrl));
}

export async function getTable(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!table) throw AppError.notFound('Masa bulunamadı.');
  ok(res, withMenuUrl(table));
}

export async function createTable(req, res) {
  const table = await Table.create({ ...req.body, restaurant: req.restaurantId });
  ok(res, withMenuUrl(table), 201);
}

/** Toplu masa oluşturma: { from: 1, to: 20, area: "Bahçe" } — mevcut numaralar atlanır */
export async function bulkCreateTables(req, res) {
  const { from, to, area, capacity } = req.body;
  const existing = await Table.find({ restaurant: req.restaurantId, number: { $gte: from, $lte: to } }).distinct('number');
  const taken = new Set(existing);

  const docs = [];
  for (let n = from; n <= to; n++) {
    if (!taken.has(n)) docs.push({ restaurant: req.restaurantId, number: n, area, capacity });
  }
  const created = docs.length ? await Table.insertMany(docs) : [];
  ok(res, { created: created.map(withMenuUrl), skippedNumbers: [...taken].sort((a, b) => a - b) }, 201);
}

export async function updateTable(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!table) throw AppError.notFound('Masa bulunamadı.');
  if (req.body.status && table.currentSession) {
    throw AppError.conflict('Aktif oturumu olan masanın durumu elle değiştirilemez.', 'TABLE_IN_USE');
  }
  table.set(req.body);
  await table.save();
  ok(res, withMenuUrl(table));
}

/** Sipariş geçmişi varsa pasife alınır, yoksa tamamen silinir. */
export async function deleteTable(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!table) throw AppError.notFound('Masa bulunamadı.');
  if (table.currentSession) throw AppError.conflict('Aktif oturumu olan masa silinemez.', 'TABLE_IN_USE');

  if (await Order.exists({ table: table._id })) {
    table.isActive = false;
    table.status = 'inactive';
    await table.save();
  } else {
    await table.deleteOne();
  }
  res.status(204).end();
}

/** QR token'ı yeniler: eski basılı QR kodlar geçersiz olur. */
export async function rotateQr(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!table) throw AppError.notFound('Masa bulunamadı.');
  table.rotateQrToken();
  await table.save();
  ok(res, withMenuUrl(table));
}

export async function tableQrPng(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!table) throw AppError.notFound('Masa bulunamadı.');
  const png = await generateQrPng(table);
  res.set({ 'Content-Type': 'image/png', 'Content-Disposition': `inline; filename="masa-${table.number}.png"` }).send(png);
}

async function sendPdf(res, restaurantId, tables, fileName) {
  if (!tables.length) throw AppError.notFound('QR üretilecek masa bulunamadı.');
  const restaurant = await Restaurant.findById(restaurantId).select('name slug');
  const pdf = await generateTablesQrPdf({ restaurant, tables });
  res
    .set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName || `${restaurant.slug}-qr`}.pdf"` })
    .send(pdf);
}

export async function tableQrPdf(req, res) {
  const table = await Table.findOne({ _id: req.params.id, restaurant: req.restaurantId });
  if (!table) throw AppError.notFound('Masa bulunamadı.');
  await sendPdf(res, req.restaurantId, [table], `masa-${slugify(String(table.number))}-qr`);
}

/** GET /tables/qr/pdf?ids=a,b,c  (ids yoksa tüm aktif masalar) */
export async function bulkQrPdf(req, res) {
  const filter = { restaurant: req.restaurantId, isActive: true };
  if (req.validated.query.ids?.length) filter._id = { $in: req.validated.query.ids };
  const tables = await Table.find(filter).sort({ number: 1 });
  await sendPdf(res, req.restaurantId, tables);
}
