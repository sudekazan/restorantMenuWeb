import mongoose from 'mongoose';

// Kanban kolonları: new -> preparing -> delivered  (+ cancelled)
export const ORDER_STATUSES = ['new', 'preparing', 'ready', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid', 'refunded'];

/**
 * Sipariş kalemleri ürünün o anki adını ve fiyatını SNAPSHOT olarak saklar.
 * Admin daha sonra ürün fiyatını değiştirse bile geçmiş siparişler ve
 * ciro raporları bozulmaz.
 */
const selectedOptionSchema = new mongoose.Schema(
  {
    groupName: { type: String, required: true },
    choiceName: { type: String, required: true },
    priceDelta: { type: Number, default: 0 }, // kuruş
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },         // snapshot
    unitPrice: { type: Number, required: true },    // snapshot, kuruş (opsiyonlar dahil)
    quantity: { type: Number, required: true, min: 1, max: 50 },
    selectedOptions: { type: [selectedOptionSchema], default: [] },
    note: { type: String, maxlength: 200 },          // "Soğansız olsun"
    lineTotal: { type: Number, required: true },     // unitPrice * quantity
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // müşteri ise null
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', required: true, index: true },

    // Mutfakta okunabilir kısa numara (günlük sıfırlanır) -> Counter modeli ile üretilir
    orderNumber: { type: Number, required: true },

    items: {
      type: [orderItemSchema],
      validate: { validator: (v) => v.length > 0, message: 'Sipariş en az bir ürün içermelidir.' },
    },

    subtotal: { type: Number, required: true, min: 0 },     // kuruş
    serviceCharge: { type: Number, default: 0, min: 0 },    // kuruş
    discount: { type: Number, default: 0, min: 0 },         // kuruş
    totalAmount: { type: Number, required: true, min: 0 },  // kuruş

    status: { type: String, enum: ORDER_STATUSES, default: 'new' },
    statusHistory: { type: [statusHistorySchema], default: () => [{ status: 'new' }] },
    // Kanban kolonu içindeki sürükle-bırak sıralaması
    kanbanPosition: { type: Number, default: 0 },

    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
    customerNote: { type: String, maxlength: 300 },
    source: { type: String, enum: ['qr', 'waiter', 'admin'], default: 'qr' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // garson girdiyse

    cancelReason: String,
    deliveredAt: Date,
  },
  { timestamps: true }
);

// Kanban ekranı: restoranın aktif siparişleri, kolon + sıra
orderSchema.index({ restaurant: 1, status: 1, kanbanPosition: 1 });
// Raporlar: tarih aralığı sorguları
orderSchema.index({ restaurant: 1, createdAt: -1 });
// Satılan ürün analizi ($unwind items -> $group product)
orderSchema.index({ restaurant: 1, 'items.product': 1 });

export default mongoose.model('Order', orderSchema);
