import React, { useMemo, useState } from 'react';
import { X, Plus, Minus, Clock, Flame, AlertCircle, Check } from 'lucide-react';
import { formatKurus } from '../../lib/format.js';

export default function ProductModal({ product, currency = 'TRY', onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // Varsayılan seçimler: zorunlu tekli gruplarda ilk uygun seçeneği seç
  const [selections, setSelections] = useState(() => {
    const init = {};
    for (const group of product.optionGroups || []) {
      const availableChoices = (group.choices || []).filter((c) => c.isAvailable !== false);
      if (group.isRequired && group.type === 'single' && availableChoices.length > 0) {
        init[group._id] = [availableChoices[0]._id];
      } else {
        init[group._id] = [];
      }
    }
    return init;
  });

  const toggleChoice = (group, choice) => {
    if (choice.isAvailable === false) return;
    setError('');

    setSelections((prev) => {
      const current = prev[group._id] || [];
      const exists = current.includes(choice._id);

      if (group.type === 'single') {
        if (exists && !group.isRequired) return { ...prev, [group._id]: [] };
        return { ...prev, [group._id]: [choice._id] };
      }

      // multiple
      if (exists) {
        return { ...prev, [group._id]: current.filter((id) => id !== choice._id) };
      }
      const max = group.maxSelect || 1;
      if (current.length >= max) {
        setError(`"${group.name}" grubundan en fazla ${max} seçim yapabilirsiniz.`);
        return prev;
      }
      return { ...prev, [group._id]: [...current, choice._id] };
    });
  };

  const { unitPrice, optionSummary } = useMemo(() => {
    let price = product.price;
    const summary = [];

    for (const group of product.optionGroups || []) {
      const chosenIds = selections[group._id] || [];
      for (const cid of chosenIds) {
        const choice = (group.choices || []).find((c) => c._id === cid);
        if (choice) {
          price += choice.priceDelta || 0;
          summary.push({
            groupId: group._id,
            groupName: group.name,
            choiceId: choice._id,
            choiceName: choice.name,
            priceDelta: choice.priceDelta || 0,
          });
        }
      }
    }

    return { unitPrice: price, optionSummary: summary };
  }, [product, selections]);

  const handleConfirm = () => {
    for (const group of product.optionGroups || []) {
      const chosenIds = selections[group._id] || [];
      if (group.isRequired && chosenIds.length === 0) {
        setError(`Lütfen "${group.name}" seçimi yapın.`);
        return;
      }
    }

    const selectedOptionsPayload = (product.optionGroups || [])
      .map((g) => ({
        groupId: g._id,
        choiceIds: selections[g._id] || [],
      }))
      .filter((g) => g.choiceIds.length > 0);

    onAddToCart({
      product,
      quantity,
      unitPrice,
      selectedOptions: selectedOptionsPayload,
      optionSummary,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg bg-card rounded-t-[2rem] sm:rounded-[2rem] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Üst görsel / başlık alanı */}
        <div className="relative bg-gradient-to-br from-brand-50 via-amber-50 to-muted p-6 pb-5 border-b border-line">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/90 hover:bg-card text-ink-soft flex items-center justify-center shadow-md transition"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>

          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-44 object-cover rounded-2xl mb-4 shadow-sm"
            />
          )}

          <div className="flex items-start justify-between gap-3 pr-10">
            <h3 className="text-xl font-bold text-ink leading-snug">{product.name}</h3>
            <span className="text-lg font-extrabold text-brand-600 shrink-0">
              {formatKurus(product.price, currency)}
            </span>
          </div>

          {product.description && (
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{product.description}</p>
          )}

          {/* Meta rozetleri */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {product.preparationTime > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-card/80 text-ink-soft px-2.5 py-1 rounded-full border border-line/80">
                <Clock className="w-3.5 h-3.5 text-brand-500" />
                ~{product.preparationTime} dk
              </span>
            )}
            {product.calories > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-card/80 text-ink-soft px-2.5 py-1 rounded-full border border-line/80">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                {product.calories} kcal
              </span>
            )}
            {(product.tags || []).map((tag) => (
              <span
                key={tag}
                className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200"
              >
                #{tag}
              </span>
            ))}
            {(product.allergens || []).length > 0 && (
              <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                Alerjen: {product.allergens.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Kaydırılabilir seçenekler ve not alanı */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(product.optionGroups || []).map((group) => {
            const chosenIds = selections[group._id] || [];
            return (
              <div key={group._id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-ink">{group.name}</h4>
                    <p className="text-xs text-ink-faint">
                      {group.type === 'single'
                        ? 'Tek seçim yapabilirsiniz'
                        : `En fazla ${group.maxSelect || 1} seçim`}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      group.isRequired
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-muted text-ink-soft'
                    }`}
                  >
                    {group.isRequired ? 'Zorunlu' : 'İsteğe Bağlı'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {(group.choices || []).map((choice) => {
                    const isSelected = chosenIds.includes(choice._id);
                    const disabled = choice.isAvailable === false;
                    return (
                      <button
                        key={choice._id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleChoice(group, choice)}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-all ${
                          disabled
                            ? 'opacity-45 bg-app border-line cursor-not-allowed'
                            : isSelected
                            ? 'bg-brand-50/70 border-brand-500 ring-2 ring-brand-500/20'
                            : 'bg-card border-line hover:border-ink-faint/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                              isSelected
                                ? 'bg-brand-600 border-brand-600 text-white'
                                : 'border-ink-faint/50 bg-card'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {choice.name}
                            {disabled && ' (Tükendi)'}
                          </span>
                        </div>
                        {choice.priceDelta > 0 && (
                          <span className="text-xs font-semibold text-brand-700">
                            +{formatKurus(choice.priceDelta, currency)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Ürün notu */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-ink">
              Mutfak Notu <span className="text-xs font-normal text-ink-faint">(İsteğe bağlı)</span>
            </label>
            <textarea
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn: Soğansız olsun, sosu ayrı verilsin..."
              className="w-full rounded-2xl border border-line bg-app px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:bg-card focus:border-brand-500 focus:outline-none transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Alt Aksiyon Çubuğu */}
        <div className="p-4 bg-card border-t border-line flex items-center gap-3 pb-safe">
          <div className="flex items-center bg-muted rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-soft hover:bg-card transition"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold text-ink">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(25, q + 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-soft hover:bg-card transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-bold py-3.5 px-5 rounded-2xl shadow-lg shadow-brand-600/25 flex items-center justify-between transition"
          >
            <span>Sepete Ekle</span>
            <span>{formatKurus(unitPrice * quantity, currency)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
