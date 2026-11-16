import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => console.error('[db] Bağlantı hatası:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[db] Bağlantı koptu'));

  await mongoose.connect(env.mongoUri);
  console.log(`[db] MongoDB bağlandı: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.connection.close();
}
