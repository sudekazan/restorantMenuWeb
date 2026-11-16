import mongoose from 'mongoose';

export const PAYMENT_METHODS = ['online_card', 'cash', 'pos_card'];
export const PAYMENT_STATES = ['pending', 'success', 'failed', 'refunded', 'cancelled'];

/**
 * Payment (Ödeme)
 * - online_card : Müşteri masadan İyzico ile ödedi
 * - cash        : Kasada / garsona nakit
 * - pos_card    : Fiziksel POS cihazı ile kartla
 * Raporlardaki "online / nakit oranı" bu koleksiyondan hesaplanır.
 */
const paymentSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'TableSession', required: true, index: true },
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }], // bu ödemenin kapsadığı siparişler

    amount: { type: Number, required: true, min: 1 }, // kuruş
    tipAmount: { type: Number, default: 0, min: 0 },  // bahşiş (kuruş)
    currency: { type: String, default: 'TRY' },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATES, default: 'pending' },

    // İyzico alanları (sadece online_card)
    iyzico: {
      conversationId: { type: String, index: true, sparse: true }, // bizim ürettiğimiz eşsiz ID
      token: { type: String, index: true, sparse: true },          // Checkout Form token
      paymentId: String,                                            // İyzico paymentId
      paymentTransactionIds: [String],                              // iade için gerekli
      cardAssociation: String,   // VISA, MASTER_CARD
      cardFamily: String,        // Bonus, World...
      lastFourDigits: String,
      installment: { type: Number, default: 1 },
      errorCode: String,
      errorMessage: String,
      rawResponse: { type: mongoose.Schema.Types.Mixed, select: false }, // debug/denetim
    },

    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // nakit/POS'u alan personel
    paidAt: Date,
    refundedAt: Date,
  },
  { timestamps: true }
);

// Raporlar: tarih + yöntem bazlı ciro
paymentSchema.index({ restaurant: 1, status: 1, paidAt: -1 });
paymentSchema.index({ restaurant: 1, method: 1, paidAt: -1 });

export default mongoose.model('Payment', paymentSchema);
