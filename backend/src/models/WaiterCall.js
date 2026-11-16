import mongoose from 'mongoose';

export const CALL_TYPES = ['call_waiter', 'request_bill', 'request_cash_payment', 'other'];
export const CALL_STATUSES = ['pending', 'acknowledged', 'resolved'];

/**
 * WaiterCall (Garson Çağrısı)
 * Socket.IO ile anlık iletilir; ayrıca DB'ye yazılır ki:
 *  - Personel ekranı yenilense bile bekleyen çağrılar kaybolmasın
 *  - Ortalama yanıt süresi raporlanabilsin
 */
const waiterCallSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession' },
    type: { type: String, enum: CALL_TYPES, default: 'call_waiter' },
    note: { type: String, maxlength: 200 },
    status: { type: String, enum: CALL_STATUSES, default: 'pending' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true }
);

waiterCallSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
// Spam önleme sorgusu: aynı masanın son X saniyedeki bekleyen çağrısı
waiterCallSchema.index({ table: 1, status: 1, createdAt: -1 });

export default mongoose.model('WaiterCall', waiterCallSchema);
