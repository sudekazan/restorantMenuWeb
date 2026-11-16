import React from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { formatKurus } from '../../../lib/format.js';
import { Switch, iconBtn, inputClass, primaryBtn, secondaryBtn } from './menuUi.jsx';

/** Sağ panel: seçili kategorinin ürünleri. */
export default function ProductList({
  category,
  products,
  currency,
  search,
  onSearch,
  pendingIds,
  reorderBusy,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
  onMove,
}) {
  const q = search.trim().toLocaleLowerCase('tr-TR');
  const visible = q ? products.filter((p) => p.name.toLocaleLowerCase('tr-TR').includes(q)) : products;
  const canMove = !q && !reorderBusy;

  return (
    <section aria-labelledby="menu-products-title" className="bg-card border border-line rounded-3xl shadow-sm min-w-0">
      <header className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
        <h2 id="menu-products-title" className="text-sm font-bold text-ink mr-auto min-w-0 truncate">
          {category.icon ? `${category.icon} ` : ''}
          {category.name} <span className="text-ink-faint font-semibold">({products.length})</span>
        </h2>
        <button type="button" onClick={onAdd} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          Ürün Ekle
        </button>
      </header>

      {products.length > 0 && (
        <div className="px-4 pb-3">
          <div className="relative">
            <label htmlFor="admin-product-search" className="sr-only">
              Bu kategoride ürün ara
            </label>
            <Search className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="admin-product-search"
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Ürün ara"
              className={`${inputClass} pl-10 pr-10`}
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch('')}
                aria-label="Aramayı temizle"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {q && <p className="text-xs text-ink-faint mt-2">Arama açıkken sıralama kapalıdır.</p>}
        </div>
      )}

      {products.length === 0 ? (
        <div className="border-t border-line px-4 py-10 text-center space-y-3">
          <p className="text-sm text-ink-soft">Bu kategoride henüz ürün yok.</p>
          <button type="button" onClick={onAdd} className={primaryBtn}>
            <Plus className="w-4 h-4" />
            İlk Ürünü Ekle
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="border-t border-line px-4 py-10 text-center space-y-3">
          <p className="text-sm text-ink-soft">Aramanızla eşleşen ürün bulunamadı.</p>
          <button type="button" onClick={() => onSearch('')} className={secondaryBtn}>
            Aramayı Temizle
          </button>
        </div>
      ) : (
        <ul className="border-t border-line divide-y divide-line">
          {visible.map((p, index) => (
            <li key={p._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="flex items-center gap-3 flex-1 min-w-[11rem]">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-muted shrink-0" loading="lazy" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-muted shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${p.isAvailable ? 'text-ink' : 'text-ink-faint line-through'}`}>{p.name}</p>
                  <p className="text-xs text-ink-soft tabular-nums">{formatKurus(p.price, currency)}</p>
                  {p.optionGroups?.length > 0 && <p className="text-xs text-ink-faint">{p.optionGroups.length} seçenek grubu</p>}
                </div>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <span className={`text-xs font-semibold mr-1 ${p.isAvailable ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {p.isAvailable ? 'Stokta' : 'Tükendi'}
                </span>
                <Switch
                  checked={!!p.isAvailable}
                  onChange={() => onToggle(p)}
                  disabled={pendingIds.has(p._id)}
                  label={`${p.name} stokta var`}
                />
                <span className="w-1" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={!canMove || index === 0}
                  title="Yukarı taşı"
                  aria-label={`${p.name} ürününü yukarı taşı`}
                  className={iconBtn}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={!canMove || index === visible.length - 1}
                  title="Aşağı taşı"
                  aria-label={`${p.name} ürününü aşağı taşı`}
                  className={iconBtn}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onEdit(p)} title="Düzenle" aria-label={`${p.name} ürününü düzenle`} className={iconBtn}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  title="Sil"
                  aria-label={`${p.name} ürününü sil`}
                  className={`${iconBtn} hover:text-rose-600`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
