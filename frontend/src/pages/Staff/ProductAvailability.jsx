import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, PackageX, Search, X } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { staffApi } from '../../lib/api.js';
import { formatKurus } from '../../lib/format.js';
import { useStaff } from './StaffContext.js';

/** Mutfak: ürünü "Tükendi" / "Mevcut" olarak işaretleme. Müşteri menüsü anında güncellenir. */
export default function ProductAvailability() {
  const { socket, currency } = useStaff();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyUnavailable, setOnlyUnavailable] = useState(false);
  const [pending, setPending] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await staffApi.listProducts());
      setError('');
    } catch (err) {
      setError(err.message || 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Başka bir cihazdan yapılan değişiklikleri canlı yansıt
  useEffect(() => {
    if (!socket) return undefined;
    const onAvailability = ({ productId, isAvailable }) => {
      setProducts((prev) => prev.map((p) => (String(p._id) === String(productId) ? { ...p, isAvailable } : p)));
    };
    socket.on('product:availability', onAvailability);
    return () => socket.off('product:availability', onAvailability);
  }, [socket]);

  const toggle = async (product) => {
    const nextValue = !product.isAvailable;
    setPending((prev) => new Set(prev).add(product._id));
    setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, isAvailable: nextValue } : p)));
    try {
      await staffApi.setProductAvailability(product._id, nextValue);
      toast({
        title: nextValue ? `${product.name} tekrar mevcut` : `${product.name} tükendi`,
        description: nextValue ? 'Ürün müşteri menüsünde yeniden sipariş edilebilir.' : 'Müşteri menüsünde "Tükendi" olarak görünür.',
        variant: nextValue ? 'success' : 'info',
        duration: 2500,
      });
    } catch (err) {
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, isAvailable: !nextValue } : p)));
      toast({ title: 'Ürün güncellenemedi', description: err.message, variant: 'error' });
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(product._id);
        return next;
      });
    }
  };

  const unavailableCount = products.filter((p) => !p.isAvailable).length;

  const grouped = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const filtered = products.filter(
      (p) => (!onlyUnavailable || !p.isAvailable) && (!q || p.name.toLocaleLowerCase('tr-TR').includes(q))
    );
    const map = new Map();
    for (const p of filtered) {
      const key = p.category?.name || 'Diğer';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()];
  }, [products, search, onlyUnavailable]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-ink-soft">
        <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        <span className="text-sm">Ürünler yükleniyor…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 p-6 rounded-3xl bg-rose-950/40 border border-rose-800/60 text-center space-y-3">
        <p className="text-sm text-rose-200">{error}</p>
        <button type="button" onClick={load} className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line transition">
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <label htmlFor="product-search" className="sr-only">
              Ürün ara
            </label>
            <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün ara"
              className="w-full rounded-2xl bg-card border border-line pl-10 pr-10 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Aramayı temizle"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            aria-pressed={onlyUnavailable}
            onClick={() => setOnlyUnavailable((v) => !v)}
            className={`px-4 py-3 rounded-2xl text-sm font-semibold border inline-flex items-center justify-center gap-2 transition ${
              onlyUnavailable ? 'bg-rose-600 border-rose-500 text-white' : 'bg-card border-line text-ink-soft hover:border-ink-faint/60'
            }`}
          >
            <PackageX className="w-4 h-4" />
            Tükenenler ({unavailableCount})
          </button>
        </div>

        {grouped.length === 0 && (
          <div className="py-12 text-center space-y-3 text-ink-soft">
            <p className="text-sm">
              {onlyUnavailable && !search ? 'Tükenen ürün yok, tüm menü servis ediliyor.' : 'Aramanızla eşleşen ürün bulunamadı.'}
            </p>
            {(search || onlyUnavailable) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setOnlyUnavailable(false);
                }}
                className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line text-ink transition"
              >
                Filtreleri Temizle
              </button>
            )}
          </div>
        )}

        {grouped.map(([categoryName, list]) => (
          <section key={categoryName} aria-label={categoryName} className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">{categoryName}</h2>
            <ul className="rounded-3xl border border-line bg-card divide-y divide-line">
              {list.map((product) => (
                <li key={product._id} className="flex items-center gap-3 px-4 py-3">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-11 h-11 rounded-xl object-cover bg-muted shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-muted shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${product.isAvailable ? 'text-ink' : 'text-ink-faint line-through'}`}>
                      {product.name}
                    </p>
                    <p className="text-xs text-ink-faint tabular-nums">{formatKurus(product.price, currency)}</p>
                  </div>
                  <span className={`text-xs font-semibold ${product.isAvailable ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {product.isAvailable ? 'Mevcut' : 'Tükendi'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={product.isAvailable}
                    aria-label={`${product.name} mevcut`}
                    disabled={pending.has(product._id)}
                    onClick={() => toggle(product)}
                    className={`relative w-12 h-7 rounded-full transition shrink-0 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      product.isAvailable ? 'bg-emerald-500' : 'bg-ink-faint/50'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        product.isAvailable ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
