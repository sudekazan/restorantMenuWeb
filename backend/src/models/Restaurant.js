import mongoose from 'mongoose';

/**
 * Restaurant (Tenant)
 * SaaS mimarisinin kökü. Diğer tüm koleksiyonlar `restaurant` alanı ile
 * bir işletmeye bağlanır (multi-tenant izolasyon).
 */
const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: {
      line: String,
      district: String,
      city: String,
      country: { type: String, default: 'Turkey' },
      zipCode: String,
    },

    currency: { type: String, default: 'TRY', enum: ['TRY', 'USD', 'EUR'] },
    // Fiyatlara KDV dahil mi? Raporlama için oran tutulur.
    taxRate: { type: Number, default: 10, min: 0, max: 100 },

    settings: {
      allowOnlinePayment: { type: Boolean, default: true },
      allowCashPayment: { type: Boolean, default: true },
      // Müşteri siparişi garson onayı olmadan mutfağa düşsün mü?
      autoAcceptOrders: { type: Boolean, default: true },
      serviceChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    },

    // İyzico alt-üye işyeri / API bilgileri. Hassas alanlar varsayılan olarak sorgulardan gizli.
    iyzico: {
      enabled: { type: Boolean, default: false },
      apiKey: { type: String, select: false },     // Uygulama katmanında şifrelenerek saklanacak
      secretKey: { type: String, select: false },  // Uygulama katmanında şifrelenerek saklanacak
      subMerchantKey: { type: String, select: false },
    },

    subscription: {
      plan: { type: String, enum: ['free', 'basic', 'pro'], default: 'free' },
      status: { type: String, enum: ['trial', 'active', 'past_due', 'canceled'], default: 'trial' },
      currentPeriodEnd: Date,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Restaurant', restaurantSchema);
