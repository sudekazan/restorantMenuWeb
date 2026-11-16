const TR_MAP = {
  ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'C', Ğ: 'G', İ: 'I', I: 'I', Ö: 'O', Ş: 'S', Ü: 'U',
};

/** Türkçe karakterleri ASCII karşılıklarına çevirir (büyük/küçük harf korunur). */
export function transliterateTR(text = '') {
  return String(text).replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c] ?? c);
}

/** "Ana Yemekler & Çorbalar" => "ana-yemekler-corbalar" */
export function slugify(text = '') {
  return transliterateTR(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Kullanıcı girdisini regex içinde güvenle kullanmak için kaçışlar. */
export function escapeRegex(text = '') {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** { a: { b: 1 } } => { 'a.b': 1 }  (kısmi $set güncellemeleri için; diziler düzleştirilmez) */
export function toDotPaths(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      toDotPaths(value, path, out);
    } else if (value !== undefined) {
      out[path] = value;
    }
  }
  return out;
}
