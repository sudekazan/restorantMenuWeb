import mongoose from 'mongoose';
import crypto from 'crypto';

export const TABLE_STATUSES = ['available', 'occupied', 'awaiting_payment', 'reserved', 'inactive'];

/**
 * Table (Masa)
 * QR kod içinde ham ObjectId yerine tahmin edilemez `qrToken` bulunur:
 *   https://app.domain.com/m/<qrToken>
 * Böylece masa ID'leri dışarıdan tahmin edilip sahte sipariş atılamaz.
 * Token yenilenerek (rotate) eski QR'lar geçersiz kılınabilir.
 */
const tableSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    number: { type: Number, required: true, min: 1 },    // Masa 12
    name: { type: String, trim: true },                   // "Bahçe 3" (opsiyonel etiket)
    area: { type: String, trim: true, default: 'Salon' }, // Salon, Bahçe, Teras...
    capacity: { type: Number, default: 4, min: 1 },

    qrToken: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(16).toString('hex'),
    },

    status: { type: String, enum: TABLE_STATUSES, default: 'available', index: true },
    // Masadaki aktif oturum (müşteri oturduğunda açılır, hesap kapanınca null olur)
    currentSession: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', default: null },

    // Personel ekranındaki masa haritası için konum bilgisi
    layout: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      shape: { type: String, enum: ['square', 'round', 'rect'], default: 'square' },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

tableSchema.index({ restaurant: 1, number: 1 }, { unique: true });

tableSchema.methods.rotateQrToken = function () {
  this.qrToken = crypto.randomBytes(16).toString('hex');
  return this.qrToken;
};

export default mongoose.model('Table', tableSchema);
