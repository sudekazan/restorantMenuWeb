import mongoose from 'mongoose';

/**
 * Counter
 * Restoran başına GÜNLÜK sipariş numarası üretmek için atomik sayaç.
 * key örneği: "order:<restaurantId>:2026-11-14"
 */
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
  // 7 gün sonra otomatik silinir (TTL)
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

counterSchema.statics.next = async function (key) {
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.seq;
};

export default mongoose.model('Counter', counterSchema);
