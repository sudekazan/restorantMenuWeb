import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const KEY = crypto.scryptSync(env.encryptionSecret, 'qr-restaurant-tenant-salt', 32);

/**
 * Hassas metinleri (ör. tenant İyzico API/Secret anahtarları) AES-256-GCM ile şifreler.
 * Çıktı formatı: "enc:v1:<ivHex>:<tagHex>:<cipherHex>"
 */
export function encryptSecret(plainText) {
  if (!plainText) return '';
  if (String(plainText).startsWith('enc:v1:')) return plainText;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value) {
  if (!value) return '';
  const str = String(value);
  if (!str.startsWith('enc:v1:')) return str;

  const [, , ivHex, tagHex, dataHex] = str.split(':');
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
