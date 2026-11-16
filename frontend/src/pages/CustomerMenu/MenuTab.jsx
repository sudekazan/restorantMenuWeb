import React, { useMemo, useState } from 'react';
import { Search, X, Plus, Clock, Sparkles, ShoppingBag } from 'lucide-react';
import { formatKurus } from '../../lib/format.js';

export default function MenuTab({
  categories = [],
  currency = 'TRY',
  cartCount = 0,
  cartTotal = 0,
  onSelectProduct,
  onQuickAdd,
  onOpenCart,
}) {
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .filter((cat) => activeCategoryId === 'all' || cat._id === activeCategoryId)
      .map((cat) => ({
        ...cat,
        products: (cat.products || []).filter((p) => {
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.tags || []).some((t) => t.toLowerCase().includes(q))
          );
        }),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [categories, activeCategoryId, search]);

  const handleCardAction = (product, e) => {
    e.stopPropagation();
    if (!product.isAvailable) return;
    // Seçenek grubu varsa modal aç, yoksa doğrudan sepete 1 adet ekle
    if ((product.optionGroups || []).length > 0) {
      onSelectProduct(product);
    } else {
      onQuickAdd(product);
    }
  };

  return (
    <div className="pb-32">
      {/* Arama Kutusu */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-ink-faint absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Menüde yemek, içecek veya içerik ara..."
            className="w-full bg-card border border-line/90 rounded-2xl pl-10 pr-10 py-3 text-sm text-ink placeholder:text-ink-faint shadow-xs focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Yapışkan (Sticky) Kategori Sekmeleri */}
      <div className="sticky top-[68px] z-20 bg-app/95 backdrop-blur-md py-2.5 border-b border-line/60">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4">
          <button
            type="button"
            onClick={() => setActiveCategoryId('all')}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeCategoryId === 'all'
                ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                : 'bg-card text-ink-soft border border-line hover:border-ink-faint/50'
            }`}
          >
            ✨ Tümü
          </button>
          {categories.map((cat) => {
            const active = activeCategoryId === cat._id;
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => setActiveCategoryId(cat._id)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                    : 'bg-card text-ink-soft border border-line hover:border-ink-faint/50'
                }`}
              >
                {cat.icon && <span className="text-sm">{cat.icon}</span>}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kategori ve Ürün Listesi */}
      <div className="px-4 pt-4 space-y-7">
        {filteredCategories.length === 0 ? (
          <div className="bg-card rounded-3xl border border-line/80 p-10 text-center">
            <p className="text-base font-bold text-ink-soft">Aramanızla eşleşen ürün bulunamadı</p>
            <p className="text-xs text-ink-faint mt-1">Farklı bir anahtar kelime veya kategori deneyin.</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <section key={category._id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  {category.icon && <span className="text-lg">{category.icon}</span>}
                  <span>{category.name}</span>
                </h2>
                <span className="text-xs font-medium text-ink-faint">
                  {category.products.length} ürün
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {category.products.map((product) => {
                  const unavailable = !product.isAvailable;
                  const hasOptions = (product.optionGroups || []).length > 0;

                  return (
                    <div
                      key={product._id}
                      onClick={() => !unavailable && onSelectProduct(product)}
                      className={`group bg-card rounded-3xl p-4 border transition-all flex items-stretch justify-between gap-3.5 ${
                        unavailable
                          ? 'opacity-60 border-line bg-app cursor-not-allowed'
                          : 'border-line/80 hover:border-brand-300 hover:shadow-md cursor-pointer active:scale-[0.99]'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-ink group-hover:text-brand-600 transition-colors">
                              {product.name}
                            </h3>
                            {unavailable && (
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-line text-ink-soft px-2 py-0.5 rounded-full">
                                Tükendi
                              </span>
                            )}
                          </div>

                          {product.description && (
                            <p className="text-xs text-ink-faint mt-1 line-clamp-2 leading-relaxed">
                              {product.description}
                            </p>
                          )}

                          {/* Etiket ve hazırlama süresi */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {product.preparationTime > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint bg-muted px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3 text-ink-faint" />
                                {product.preparationTime} dk
                              </span>
                            )}
                            {(product.tags || []).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                {tag}
                              </span>
                            ))}
                            {hasOptions && (
                              <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                                Seçenekli
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-base font-extrabold text-ink">
                            {formatKurus(product.price, currency)}
                          </span>

                          <button
                            type="button"
                            disabled={unavailable}
                            onClick={(e) => handleCardAction(product, e)}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-2xl transition ${
                              unavailable
                                ? 'bg-line text-ink-faint'
                                : 'bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white shadow-xs'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                            <span>{hasOptions ? 'Seç' : 'Ekle'}</span>
                          </button>
                        </div>
                      </div>

                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-24 h-24 rounded-2xl object-cover shrink-0 self-center bg-muted"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Yüzen Sepet Çubuğu */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 inset-x-4 max-w-md mx-auto z-30">
          <button
            type="button"
            onClick={onOpenCart}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-2xl p-3.5 px-5 shadow-xl flex items-center justify-between transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 text-white font-extrabold text-xs flex items-center justify-center">
                {cartCount}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold leading-tight">Sepeti Görüntüle</p>
                <p className="text-[11px] text-brand-100">Siparişi mutfağa göndermek için dokunun</p>
              </div>
            </div>
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <span>{formatKurus(cartTotal, currency)}</span>
              <ShoppingBag className="w-4 h-4 text-brand-100" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
