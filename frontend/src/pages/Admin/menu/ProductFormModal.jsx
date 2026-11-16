import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { kurusToInput, parseTlToKurus } from '../../../lib/format.js';
import OptionGroupsEditor, { groupsToForm, groupsToPayload, validateGroups } from './OptionGroupsEditor.jsx';
import { Field, Switch, inputClass, inputErrorClass, primaryBtn, secondaryBtn, splitList } from './menuUi.jsx';

// backend/src/middlewares/upload.js ile aynı sınırlar
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function initialForm(product, defaultCategoryId) {
  return {
    name: product?.name || '',
    description: product?.description || '',
    price: product ? kurusToInput(product.price) : '',
    category: product ? String(product.category?._id || product.category || '') : defaultCategoryId || '',
    preparationTime: product?.preparationTime != null ? String(product.preparationTime) : '10',
    calories: product?.calories != null ? String(product.calories) : '',
    allergens: (product?.allergens || []).join(', '),
    tags: (product?.tags || []).join(', '),
    isAvailable: product ? product.isAvailable !== false : true,
  };
}

function validateForm(form) {
  const e = {};
  if (!form.name.trim()) e.name = 'Ürün adını yazın.';
  else if (form.name.trim().length > 100) e.name = 'Ürün adı en fazla 100 karakter olabilir.';
  if (form.description.length > 600) e.description = 'Açıklama en fazla 600 karakter olabilir.';
  if (!form.category) e.category = 'Bir kategori seçin.';
  if (parseTlToKurus(form.price) === null) e.price = 'Fiyatı 125,50 biçiminde yazın.';
  if (form.preparationTime !== '') {
    const n = Number(form.preparationTime);
    if (!Number.isInteger(n) || n < 0 || n > 240) e.preparationTime = '0 ile 240 dakika arasında tam sayı yazın.';
  }
  if (form.calories !== '') {
    const n = Number(form.calories);
    if (!Number.isInteger(n) || n < 0) e.calories = 'Kaloriyi tam sayı olarak yazın.';
  }
  const allergens = splitList(form.allergens);
  const tags = splitList(form.tags);
  if (allergens.length > 20 || allergens.some((a) => a.length > 30)) e.allergens = 'En fazla 20 alerjen, her biri en fazla 30 karakter.';
  if (tags.length > 20 || tags.some((t) => t.length > 30)) e.tags = 'En fazla 20 etiket, her biri en fazla 30 karakter.';
  return e;
}

/**
 * Ürün ekleme / düzenleme penceresi.
 * onSubmit(payload, imageFile) Promise döner; görsel, ürün kaydedildikten sonra ayrı yüklenir.
 */
export default function ProductFormModal({ open, product, categories, defaultCategoryId, onClose, onSubmit }) {
  const [form, setForm] = useState(() => initialForm(product, defaultCategoryId));
  const [errors, setErrors] = useState({});
  const [groups, setGroups] = useState(() => groupsToForm(product?.optionGroups));
  const [showGroupErrors, setShowGroupErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(product, defaultCategoryId));
    setErrors({});
    setGroups(groupsToForm(product?.optionGroups));
    setShowGroupErrors(false);
    setImageFile(null);
  }, [open, product, defaultCategoryId]);

  useEffect(() => {
    if (!imageFile) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const blurCheck = (key) => () => {
    if (form[key] === '') return;
    setErrors((er) => ({ ...er, [key]: validateForm(form)[key] }));
  };

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setErrors((er) => ({ ...er, image: 'Yalnızca JPG, PNG veya WEBP görsel seçebilirsiniz.' }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((er) => ({ ...er, image: 'Görsel en fazla 3 MB olabilir.' }));
      return;
    }
    setErrors((er) => ({ ...er, image: undefined }));
    setImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validateForm(form);
    const nextGroupErrors = validateGroups(groups);
    setErrors(next);
    setShowGroupErrors(true);
    if (Object.keys(next).length || Object.keys(nextGroupErrors).length) {
      // İlk hatalı alana odaklan (uzun formda görünür olsun)
      requestAnimationFrame(() => document.querySelector('#product-form [aria-invalid="true"]')?.focus());
      return;
    }
    const payload = {
      category: form.category,
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseTlToKurus(form.price),
      allergens: splitList(form.allergens),
      tags: splitList(form.tags),
      isAvailable: form.isAvailable,
      optionGroups: groupsToPayload(groups),
    };
    if (form.preparationTime !== '') payload.preparationTime = Number(form.preparationTime);
    if (form.calories !== '') payload.calories = Number(form.calories);
    setBusy(true);
    try {
      await onSubmit(payload, imageFile);
    } finally {
      setBusy(false);
    }
  };

  const shownImage = preview || product?.imageUrl || '';
  const groupErrors = showGroupErrors ? validateGroups(groups) : {};
  const inputCls = (key) => `${inputClass} ${errors[key] ? inputErrorClass : ''}`;

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      variant="drawer"
      title={product ? 'Ürünü Düzenle' : 'Yeni Ürün'}
      subtitle={product?.name}
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Vazgeç
          </button>
          <button type="submit" form="product-form" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {product ? 'Değişiklikleri Kaydet' : 'Ürün Ekle'}
          </button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Görsel */}
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink">Görsel (isteğe bağlı)</p>
          <div className="flex items-center gap-3">
            {shownImage ? (
              <img src={shownImage} alt="" className="w-20 h-20 rounded-2xl object-cover bg-muted shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-muted shrink-0 flex items-center justify-center text-ink-faint" aria-hidden="true">
                <ImagePlus className="w-6 h-6" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtn}>
                <ImagePlus className="w-4 h-4" />
                {shownImage ? 'Görseli Değiştir' : 'Görsel Seç'}
              </button>
              {imageFile && (
                <button type="button" onClick={() => setImageFile(null)} className={secondaryBtn}>
                  <X className="w-4 h-4" />
                  Seçimi Kaldır
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} onChange={pickImage} className="sr-only" tabIndex={-1} aria-label="Ürün görseli seç" />
          </div>
          {errors.image ? (
            <p className="text-xs text-rose-600">{errors.image}</p>
          ) : (
            <p className="text-xs text-ink-faint">JPG, PNG veya WEBP, en fazla 3 MB. Kaydettiğinizde yüklenir.</p>
          )}
        </div>

        <Field id="p-name" label="Ürün adı" error={errors.name}>
          <input
            id="p-name"
            data-autofocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={blurCheck('name')}
            maxLength={100}
            aria-invalid={!!errors.name}
            className={inputCls('name')}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="p-price" label="Fiyat" hint="Örn. 125,50" error={errors.price}>
            <input
              id="p-price"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              onBlur={blurCheck('price')}
              aria-invalid={!!errors.price}
              className={`${inputCls('price')} tabular-nums`}
            />
          </Field>
          <Field id="p-category" label="Kategori" error={errors.category}>
            <select
              id="p-category"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              aria-invalid={!!errors.category}
              className={inputCls('category')}
            >
              <option value="">Kategori seçin</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="p-desc" label="Açıklama (isteğe bağlı)" error={errors.description}>
          <textarea
            id="p-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={600}
            className={`${inputCls('description')} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field id="p-prep" label="Hazırlık (dk)" error={errors.preparationTime}>
            <input
              id="p-prep"
              inputMode="numeric"
              value={form.preparationTime}
              onChange={(e) => set('preparationTime', e.target.value)}
              onBlur={blurCheck('preparationTime')}
              className={`${inputCls('preparationTime')} tabular-nums`}
            />
          </Field>
          <Field id="p-cal" label="Kalori (isteğe bağlı)" error={errors.calories}>
            <input
              id="p-cal"
              inputMode="numeric"
              value={form.calories}
              onChange={(e) => set('calories', e.target.value)}
              onBlur={blurCheck('calories')}
              className={`${inputCls('calories')} tabular-nums`}
            />
          </Field>
        </div>

        <Field id="p-allergens" label="Alerjenler (isteğe bağlı)" hint="Virgülle ayırın, örn. gluten, süt" error={errors.allergens}>
          <input id="p-allergens" value={form.allergens} onChange={(e) => set('allergens', e.target.value)} className={inputCls('allergens')} />
        </Field>
        <Field id="p-tags" label="Etiketler (isteğe bağlı)" hint="Virgülle ayırın, örn. vegan, acılı" error={errors.tags}>
          <input id="p-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} className={inputCls('tags')} />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Stokta var</p>
            <p className="text-xs text-ink-soft">Kapalıysa müşteri menüsünde "Tükendi" görünür.</p>
          </div>
          <Switch checked={form.isAvailable} onChange={(v) => set('isAvailable', v)} label="Stokta var" />
        </div>

        <OptionGroupsEditor groups={groups} onChange={setGroups} errors={groupErrors} />
      </form>
    </Modal>
  );
}
