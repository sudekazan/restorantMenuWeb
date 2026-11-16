import 'dotenv/config';
import { fileURLToPath } from 'url';

// Türkçe karakterli PDF'ler için projeyle gelen font (SIL OFL lisanslı Noto Sans).
const DEFAULT_PDF_FONT = fileURLToPath(new URL('../../assets/fonts/NotoSans-Regular.ttf', import.meta.url));

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Eksik ortam değişkenleri: ${missing.join(', ')} (.env dosyasını kontrol edin)`);
}

const port = Number(process.env.PORT) || 5050;

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  encryptionSecret: process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET,
  apiBaseUrl: (process.env.API_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, ''),
  clientUrls: (process.env.CLIENT_URLS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicMenuUrl: (process.env.PUBLIC_MENU_URL || 'http://localhost:5173/m').replace(/\/+$/, ''),
  iyzico: Object.freeze({
    mode: process.env.IYZICO_MODE || 'auto', // 'auto' | 'live' | 'mock'
    baseUrl: (process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com').replace(/\/+$/, ''),
    apiKey: process.env.IYZICO_API_KEY || '',
    secretKey: process.env.IYZICO_SECRET_KEY || '',
  }),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  timezone: process.env.APP_TIMEZONE || 'Europe/Istanbul',
  pdfFontPath: process.env.PDF_FONT_PATH || DEFAULT_PDF_FONT,
});
