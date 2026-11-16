import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const PRODUCT_UPLOAD_DIR = path.resolve(env.uploadDir, 'products');
fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: PRODUCT_UPLOAD_DIR,
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`);
  },
});

/**
 * Tek görsel yükleme (form-data alanı: "image").
 * Not: Production'da S3/Cloudinary'ye geçmek için yalnızca bu dosya ve
 * product.controller'daki URL üretimi değişecektir.
 */
export const uploadProductImage = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(AppError.badRequest('Yalnızca JPG, PNG veya WEBP görseller yüklenebilir.', 'INVALID_FILE_TYPE'));
  },
}).single('image');

export async function removeProductImage(fileName) {
  if (!fileName) return;
  await fs.promises.unlink(path.join(PRODUCT_UPLOAD_DIR, path.basename(fileName))).catch(() => {});
}
