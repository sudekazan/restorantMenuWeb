/**
 * Demo veri: npm run seed
 * "demo-kafe" restoranını (varsa) siler ve yeniden oluşturur.
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import {
  Category, Order, Payment, Product, Restaurant, Table, TableSession, User, WaiterCall,
} from '../src/models/index.js';

const SLUG = 'demo-kafe';
const TL = (n) => Math.round(n * 100); // TL -> kuruş

async function wipe() {
  const existing = await Restaurant.findOne({ slug: SLUG });
  if (!existing) return;
  const r = { restaurant: existing._id };
  await Promise.all([
    User.deleteMany(r), Category.deleteMany(r), Product.deleteMany(r), Table.deleteMany(r),
    TableSession.deleteMany(r), Order.deleteMany(r), Payment.deleteMany(r), WaiterCall.deleteMany(r),
  ]);
  await existing.deleteOne();
}

async function seed() {
  await connectDB();
  await mongoose.connection.syncIndexes();
  await wipe();

  const restaurant = await Restaurant.create({
    name: 'Demo Kafe',
    slug: SLUG,
    email: 'info@demokafe.com',
    address: { city: 'İstanbul', district: 'Kadıköy' },
    settings: { serviceChargePercent: 0 },
  });
  const rid = restaurant._id;

  await User.create([
    { restaurant: rid, name: 'Ayşe Yönetici', email: 'admin@demo.com', password: 'Admin123!', role: 'admin' },
    { restaurant: rid, name: 'Mehmet Mutfak', email: 'mutfak@demo.com', password: 'Mutfak123!', role: 'kitchen' },
    { restaurant: rid, name: 'Can Garson', email: 'garson@demo.com', password: 'Garson123!', role: 'waiter' },
    { restaurant: rid, name: 'Elif Kasa', email: 'kasa@demo.com', password: 'Kasa1234!', role: 'cashier' },
  ]);

  const [burger, main, drinks, desserts] = await Category.create([
    { restaurant: rid, name: 'Burgerler', slug: 'burgerler', icon: '🍔', sortOrder: 0 },
    { restaurant: rid, name: 'Ana Yemekler', slug: 'ana-yemekler', icon: '🍝', sortOrder: 1 },
    { restaurant: rid, name: 'İçecekler', slug: 'icecekler', icon: '🥤', sortOrder: 2 },
    { restaurant: rid, name: 'Tatlılar', slug: 'tatlilar', icon: '🍰', sortOrder: 3 },
  ]);

  const sizeGroup = (deltaL) => ({
    name: 'Boyut', type: 'single', isRequired: true,
    choices: [{ name: 'Normal', priceDelta: 0 }, { name: 'Büyük', priceDelta: TL(deltaL) }],
  });

  await Product.create([
    {
      restaurant: rid, category: burger._id, name: 'Klasik Burger', price: TL(240), preparationTime: 15,
      description: '150g dana köfte, cheddar, turşu, özel sos', allergens: ['gluten', 'süt'],
      optionGroups: [
        sizeGroup(60),
        { name: 'Ekstralar', type: 'multiple', maxSelect: 3, choices: [
          { name: 'Ekstra Peynir', priceDelta: TL(25) }, { name: 'Bacon', priceDelta: TL(40) }, { name: 'Karamelize Soğan', priceDelta: TL(20) },
        ] },
      ],
    },
    { restaurant: rid, category: burger._id, name: 'Tavuk Burger', price: TL(210), preparationTime: 15, optionGroups: [sizeGroup(50)] },
    { restaurant: rid, category: main._id, name: 'Fettuccine Alfredo', price: TL(260), preparationTime: 20, tags: ['vejetaryen'] },
    { restaurant: rid, category: main._id, name: 'Izgara Köfte', price: TL(290), preparationTime: 20 },
    {
      restaurant: rid, category: drinks._id, name: 'Latte', price: TL(95), preparationTime: 5,
      optionGroups: [{ name: 'Süt', type: 'single', choices: [{ name: 'Normal Süt' }, { name: 'Yulaf Sütü', priceDelta: TL(15) }] }],
    },
    { restaurant: rid, category: drinks._id, name: 'Limonata', price: TL(80), preparationTime: 3, tags: ['ev yapımı'] },
    { restaurant: rid, category: drinks._id, name: 'Türk Kahvesi', price: TL(70), preparationTime: 5 },
    { restaurant: rid, category: desserts._id, name: 'San Sebastian', price: TL(160), preparationTime: 2, allergens: ['süt', 'yumurta'] },
    { restaurant: rid, category: desserts._id, name: 'Sufle', price: TL(140), preparationTime: 12, isAvailable: false },
  ]);

  const tables = await Table.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      restaurant: rid, number: i + 1, area: i < 6 ? 'Salon' : 'Bahçe', capacity: i % 3 === 0 ? 6 : 4,
      layout: { x: (i % 5) * 120, y: Math.floor(i / 5) * 120, shape: i % 2 ? 'round' : 'square' },
    }))
  );

  console.log('\n✅ Demo veri oluşturuldu\n');
  console.log('Giriş bilgileri:');
  console.log('  admin@demo.com  / Admin123!   (admin)');
  console.log('  mutfak@demo.com / Mutfak123!  (kitchen)');
  console.log('  garson@demo.com / Garson123!  (waiter)');
  console.log('  kasa@demo.com   / Kasa1234!   (cashier)\n');
  console.log('Örnek masa QR adresleri:');
  tables.slice(0, 3).forEach((t) => console.log(`  Masa ${t.number}: ${env.publicMenuUrl}/${t.qrToken}`));
  console.log(`  API:     GET /api/v1/public/t/${tables[0].qrToken}/menu\n`);
}

seed()
  .catch((err) => {
    console.error('Seed hatası:', err);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
