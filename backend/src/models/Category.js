import mongoose from 'mongoose';

/**
 * Category (Menü kategorisi: Yemekler, İçecekler, Tatlılar...)
 */
const categorySchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, maxlength: 300 },
    icon: String,       // emoji veya ikon adı (ör. "🍔" / "burger")
    imageUrl: String,
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Aynı restoranda aynı slug iki kez olamaz
categorySchema.index({ restaurant: 1, slug: 1 }, { unique: true });
categorySchema.index({ restaurant: 1, sortOrder: 1 });

export default mongoose.model('Category', categorySchema);
