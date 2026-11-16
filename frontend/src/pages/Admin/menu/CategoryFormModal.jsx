import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { Field, Switch, inputClass, inputErrorClass, primaryBtn, secondaryBtn } from './menuUi.jsx';

const EMPTY = { name: '', description: '', icon: '', isActive: true };

/** Kategori ekleme / düzenleme penceresi. onSubmit(payload) Promise döner. */
export default function CategoryFormModal({ open, category, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      category
        ? {
            name: category.name || '',
            description: category.description || '',
            icon: category.icon || '',
            isActive: category.isActive !== false,
          }
        : EMPTY
    );
    setErrors({});
  }, [open, category]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Kategori adını yazın.';
    else if (form.name.trim().length > 60) next.name = 'Kategori adı en fazla 60 karakter olabilir.';
    if (form.description.length > 300) next.description = 'Açıklama en fazla 300 karakter olabilir.';
    if (form.icon.length > 40) next.icon = 'Simge en fazla 40 karakter olabilir.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim(),
        isActive: form.isActive,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={category ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Vazgeç
          </button>
          <button type="submit" form="category-form" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {category ? 'Değişiklikleri Kaydet' : 'Kategori Ekle'}
          </button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id="cat-name" label="Kategori adı" error={errors.name}>
          <input
            id="cat-name"
            data-autofocus
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => form.name && setErrors((er) => ({ ...er, name: validate().name }))}
            maxLength={60}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'cat-name-error' : undefined}
            placeholder="Örn. Ana Yemekler"
            className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
          />
        </Field>
        <Field id="cat-icon" label="Simge (isteğe bağlı)" hint="Bir emoji yazabilirsiniz, örn. 🍔" error={errors.icon}>
          <input
            id="cat-icon"
            value={form.icon}
            onChange={(e) => set('icon', e.target.value)}
            maxLength={40}
            className={`${inputClass} ${errors.icon ? inputErrorClass : ''}`}
          />
        </Field>
        <Field id="cat-desc" label="Açıklama (isteğe bağlı)" error={errors.description}>
          <textarea
            id="cat-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={300}
            className={`${inputClass} resize-none ${errors.description ? inputErrorClass : ''}`}
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Menüde göster</p>
            <p className="text-xs text-ink-soft">Kapalıysa müşteriler bu kategoriyi görmez.</p>
          </div>
          <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Menüde göster" />
        </div>
      </form>
    </Modal>
  );
}
