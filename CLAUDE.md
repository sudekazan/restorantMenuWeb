# QR Restoran Sipariş Sistemi

Müşteri masadaki QR'ı okutur, menüden sipariş verir, garson çağırır ve öder. Personel siparişleri Kanban ekranında izler; yönetici menü, masa, kullanıcı, ayar ve raporları yönetir. Birden çok restoran (tenant) aynı sistemde çalışır.

## Yapı
- `backend/`: Node 20, Express 5, MongoDB (Mongoose), Socket.IO, iyzico. Giriş: `src/server.js`, `src/app.js`.
  - `src/routes/`: `/api/auth`, `/api/public` (QR ile müşteri), `/api/staff`, `/api/admin`.
  - `src/controllers`, `src/services` (sipariş, oturum, ödeme, QR, rapor), `src/models`, `src/validators` (zod).
  - `scripts/seed.js`: `demo-kafe` restoranını silip yeniden kurar.
- `frontend/`: React 18, Vite 6, Tailwind 3, React Router 6, lucide-react.
  - `/m/:qrToken` müşteri menüsü (`pages/CustomerMenu`), `/staff/*` personel (`pages/Staff`), `/admin/*` yönetici (`pages/Admin`), `/login`.
  - Vite `/api`, `/uploads` ve `/socket.io` isteklerini backend'e yönlendirir (`VITE_BACKEND_URL`).

## Çalıştırma
- Önizleme ayarları `.claude/launch.json` içinde: backend 5050, frontend 5173 portunda.
- Demo veri: `npm --prefix backend run seed`.
- Ortam değişkenleri için `backend/.env.example`'a bak. `backend/.env` dosyasına dokunma, içeriğini yazma.
- Frontend'de test yok; değişiklikten sonra `npm --prefix frontend run build` ile derlendiğini doğrula, sonra tarayıcıda dene.

- Git deposu: `https://github.com/sudekazan/restorantMenuWeb.git`, ana dal `main`.

## Kurallar
- Para tutarları kuruş olarak (tam sayı) saklanır.
- Roller: `super_admin`, `admin`, `manager`, `waiter`, `kitchen`, `cashier`.
- iyzico `IYZICO_MODE`: `auto` (anahtar yoksa geliştirmede sahte ödeme), `live`, `mock`. Restoranların iyzico anahtarları veritabanında şifreli durur.
- Arayüz metinleri şimdilik Türkçe ve koda yazılı; çeviri dosyası yok.

## Açık sorular
- Tailwind'de `darkMode: 'class'` ayarlı ama hiçbir yerde `dark:` sınıfı ya da karanlık mod düğmesi yok. Karanlık mod istenecek mi, yoksa ayar kaldırılsın mı?

## Son kararlar
- 2026-11-15: Yönetici paneli (menü, masalar ve QR, kullanıcılar, ayarlar, raporlar) bitti ve arayüzden denendi.
