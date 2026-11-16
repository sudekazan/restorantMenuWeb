import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const USER_ROLES = ['super_admin', 'admin', 'manager', 'waiter', 'kitchen', 'cashier'];

/**
 * User (Personel / Yönetici)
 * Müşteriler kullanıcı hesabı açmaz; QR token + TableSession ile anonim çalışırlar.
 */
const userSchema = new mongoose.Schema(
  {
    // super_admin platform sahibidir ve bir restorana bağlı değildir.
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: function () {
        return this.role !== 'super_admin';
      },
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: USER_ROLES, default: 'waiter' },
    phone: { type: String, trim: true },
    avatarUrl: String,
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    // Şifre değiştiğinde eski JWT'leri geçersiz kılmak için
    passwordChangedAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
