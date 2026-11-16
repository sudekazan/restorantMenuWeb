/**
 * Beklenen (operasyonel) hatalar için. errorHandler bu hataları
 * statusCode + code ile istemciye olduğu gibi iletir.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }
  static unauthorized(message = 'Oturum açmanız gerekiyor.', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }
  static forbidden(message = 'Bu işlem için yetkiniz yok.', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
  static notFound(message = 'Kayıt bulunamadı.', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }
  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }
}
