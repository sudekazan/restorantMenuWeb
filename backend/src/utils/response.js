/** Standart başarılı yanıt formatı: { success: true, data, meta? } */
export function ok(res, data, status = 200, meta) {
  return res.status(status).json({ success: true, data, ...(meta && { meta }) });
}
