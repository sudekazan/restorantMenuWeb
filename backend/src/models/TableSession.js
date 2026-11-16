import mongoose from 'mongoose';

export const SESSION_STATUSES = ['open', 'payment_pending', 'paid', 'closed', 'cancelled'];
// Personel "masayı kapat" diyene kadar oturum aktiftir (ödendi olsa bile ek sipariş gelebilir)
export const ACTIVE_SESSION_STATUSES = ['open', 'payment_pending', 'paid'];

/**
 * TableSession (Masa Oturumu / Adisyon)
 * Bir müşteri grubunun masaya oturduğu andan hesabı ödeyip kalktığı ana kadar
 * verilen TÜM siparişleri ve ödemeleri gruplar. Masanın "hesabı" budur.
 *  - Aynı masada birden fazla sipariş (ilk sipariş + sonradan içecek) => tek oturum
 *  - Kısmi ödeme (hesabı bölme) => birden fazla Payment, tek oturum
 */
const tableSessionSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    // İndeks aşağıdaki kısmi tekil indeksten gelir; burada `index: true` aynı adla (table_1) çakışıyordu
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },

    // Müşteri cihazına (localStorage) verilen anonim oturum anahtarı; Socket.IO odası için de kullanılır
    sessionKey: { type: String, required: true, unique: true },

    status: { type: String, enum: SESSION_STATUSES, default: 'open', index: true },
    guestCount: { type: Number, default: 1, min: 1 },

    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],

    // Tutarlar (kuruş). Sipariş/ödeme eklendikçe servis katmanında güncellenir.
    totalAmount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },

    waiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // masayla ilgilenen garson
    openedAt: { type: Date, default: Date.now },
    closedAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

tableSessionSchema.virtual('remainingAmount').get(function () {
  return Math.max(0, this.totalAmount - this.paidAmount);
});

// Bir masada aynı anda yalnızca BİR aktif oturum olabilir
tableSessionSchema.index(
  { table: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_SESSION_STATUSES } } }
);

export default mongoose.model('TableSession', tableSessionSchema);
