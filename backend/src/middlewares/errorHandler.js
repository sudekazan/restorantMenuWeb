import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(AppError.notFound(`Endpoint bulunamadı: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let code = typeof err.code === 'string' ? err.code : undefined;
  let message = err.message || 'Sunucu hatası.';
  let details;

  if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Gönderilen veriler geçersiz.';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Gönderilen veriler geçersiz.';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'INVALID_ID';
    message = `Geçersiz değer: ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    const fields = Object.keys(err.keyValue || {}).join(', ');
    message = `Bu kayıt zaten mevcut${fields ? ` (${fields})` : ''}.`;
  } else if (err?.name === 'TokenExpiredError') {
    status = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Oturum süreniz doldu, lütfen tekrar giriş yapın.';
  } else if (err?.name === 'JsonWebTokenError') {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Geçersiz oturum anahtarı.';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    code = 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Dosya boyutu çok büyük.' : err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Geçersiz JSON gövdesi.';
  }

  if (status >= 500) {
    console.error('[error]', err);
    if (env.isProd) message = 'Beklenmeyen bir sunucu hatası oluştu.';
  }

  res.status(status).json({
    success: false,
    error: { code: code || (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'), message, ...(details && { details }) },
  });
}
