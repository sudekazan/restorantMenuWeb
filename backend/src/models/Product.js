import mongoose from 'mongoose';

/**
 * NOT: Tüm para değerleri KURUŞ cinsinden tam sayı (Integer) olarak saklanır.
 * Örn: 149,90 TL => 14990. Böylece floating-point hataları önlenir.
 * İyzico'ya gönderirken (kurus / 100).toFixed(2) ile dönüştürülür.
 */

// Ürün seçenekleri: "Boyut" (tekli seçim), "Ekstralar" (çoklu seçim) gibi
const optionChoiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },   // "Büyük", "Ekstra Peynir"
    priceDelta: { type: Number, default: 0, min: 0 },      // kuruş, ana fiyata eklenir
    isAvailable: { type: Boolean, default: true },
  },
  { _id: true }
);

const optionGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },   // "Boyut", "Soslar"
    type: { type: String, enum: ['single', 'multiple'], default: 'single' },
    isRequired: { type: Boolean, default: false },
    maxSelect: { type: Number, default: 1, min: 1 },
    choices: { type: [optionChoiceSchema], default: [] },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 600 },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Fiyat kuruş cinsinden tam sayı olmalıdır.' },
    },
    imageUrl: String,
    imagePublicId: String,            // Cloudinary/S3 silme işlemleri için
    optionGroups: { type: [optionGroupSchema], default: [] },
    allergens: [{ type: String, trim: true }], // "gluten", "süt", "fıstık"
    tags: [{ type: String, trim: true }],      // "vegan", "acılı", "yeni"
    calories: Number,
    preparationTime: { type: Number, default: 10 }, // dakika
    isAvailable: { type: Boolean, default: true },  // stokta yok => false (menüde pasif görünür)
    isActive: { type: Boolean, default: true },     // soft delete
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ restaurant: 1, category: 1, sortOrder: 1 });
productSchema.index({ restaurant: 1, name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);
