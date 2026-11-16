/**
 * Zod ile params/query/body doğrulama.
 * Express 5'te req.query salt-okunur olduğundan doğrulanmış veriler
 * req.validated.{params,query,body} altında tutulur; body ayrıca req.body'ye yazılır.
 *
 * Kullanım: validate({ params: idParam, body: createSchema })
 */
export const validate = (schemas) => (req, _res, next) => {
  req.validated = req.validated || {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) return next(result.error);
    req.validated[key] = result.data;
    if (key === 'body') req.body = result.data;
  }
  next();
};
