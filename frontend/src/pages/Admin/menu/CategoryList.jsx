import React from 'react';
import { ChevronDown, ChevronUp, EyeOff, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { iconBtn, primaryBtn } from './menuUi.jsx';

/** Sol panel: kategori listesi, seçim, sıralama, düzenleme ve silme. */
export default function CategoryList({ categories, counts, selectedId, busy, onSelect, onMove, onAdd, onEdit, onDelete }) {
  return (
    <section aria-labelledby="menu-categories-title" className="bg-card border border-line rounded-3xl shadow-sm">
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <h2 id="menu-categories-title" className="text-sm font-bold text-ink mr-auto">
          Kategoriler <span className="text-ink-faint font-semibold">({categories.length})</span>
        </h2>
        <button type="button" onClick={onAdd} title="Kategori ekle" aria-label="Kategori ekle" className={iconBtn}>
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {categories.length === 0 ? (
        <div className="px-4 pb-5 pt-2 text-center space-y-3">
          <p className="text-sm text-ink-soft">Henüz kategori yok. Ürün eklemek için önce bir kategori oluşturun.</p>
          <button type="button" onClick={onAdd} className={primaryBtn}>
            <FolderPlus className="w-4 h-4" />
            Kategori Ekle
          </button>
        </div>
      ) : (
        <ul className="border-t border-line divide-y divide-line">
          {categories.map((c, index) => {
            const selected = c._id === selectedId;
            return (
              <li key={c._id} className={`flex items-center gap-1 pl-2 pr-2 py-1.5 ${selected ? 'bg-brand-50' : ''}`}>
                <button
                  type="button"
                  onClick={() => onSelect(c._id)}
                  aria-current={selected ? 'true' : undefined}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {c.icon && (
                    <span className="text-base shrink-0" aria-hidden="true">
                      {c.icon}
                    </span>
                  )}
                  <span className={`text-sm font-semibold truncate ${selected ? 'text-brand-700' : 'text-ink'}`}>{c.name}</span>
                  {c.isActive === false && (
                    <span title="Menüde gizli" className="shrink-0 text-ink-faint">
                      <EyeOff className="w-3.5 h-3.5" aria-label="Menüde gizli" />
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-ink-faint tabular-nums">{counts[c._id] || 0}</span>
                </button>
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={busy || index === 0}
                    title="Yukarı taşı"
                    aria-label={`${c.name} kategorisini yukarı taşı`}
                    className={iconBtn}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={busy || index === categories.length - 1}
                    title="Aşağı taşı"
                    aria-label={`${c.name} kategorisini aşağı taşı`}
                    className={iconBtn}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onEdit(c)} title="Düzenle" aria-label={`${c.name} kategorisini düzenle`} className={iconBtn}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c)}
                    title="Sil"
                    aria-label={`${c.name} kategorisini sil`}
                    className={`${iconBtn} hover:text-rose-600`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
