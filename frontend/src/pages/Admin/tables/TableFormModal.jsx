import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { Field, Switch, inputClass, inputErrorClass, primaryBtn, secondaryBtn } from '../menu/menuUi.jsx';
import { isIntBetween, toInt } from './tableUtils.js';

const EMPTY = { number: '', name: '', area: '', capacity: '4', isActive: true, reserved: false };

/** Tek masa ekleme / düzenleme penceresi. onSubmit(payload) Promise döner. */
export default function TableFormModal({ open, table, suggestedNumber, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const inSession = !!table?.currentSession;

  useEffect(() => {
    if (!open) return;
    setForm(
      table
        ? {
            number: String(table.number ?? ''),
            name: table.name || '',
            area: table.area || '',
            capacity: String(table.capacity ?? ''),
            isActive: table.isActive !== false,
            reserved: table.status === 'reserved',
          }
        : { ...EMPTY, number: suggestedNumber ? String(suggestedNumber) : '' }
    );
    setErrors({});
  }, [open, table, suggestedNumber]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!isIntBetween(toInt(form.number), 1, 9999)) next.number = '1 ile 9999 arasında bir tam sayı yazın.';
    if (form.capacity.trim() && !isIntBetween(toInt(form.capacity), 1, 50)) next.capacity = 'Kapasite 1 ile 50 arasında olmalı.';
    if (form.name.trim().length > 40) next.name = 'En fazla 40 karakter olabilir.';
    if (form.area.trim().length > 40) next.area = 'En fazla 40 karakter olabilir.';
    return next;
  };

  const blurCheck = (key) => () => setErrors((er) => ({ ...er, [key]: validate()[key] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = { number: toInt(form.number), name: form.name.trim() };
    if (form.area.trim()) payload.area = form.area.trim();
    if (form.capacity.trim()) payload.capacity = toInt(form.capacity);
    if (table) {
      payload.isActive = form.isActive;
      // Aktif oturumu olan masanın durumu elle değiştirilemez (backend 409 döner)
      if (!inSession) payload.status = !form.isActive ? 'inactive' : form.reserved ? 'reserved' : 'available';
    }

    setBusy(true);
    try {
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={table ? `Masa ${table.number} Düzenle` : 'Yeni Masa'}
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Vazgeç
          </button>
          <button type="submit" form="table-form" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {table ? 'Değişiklikleri Kaydet' : 'Masa Ekle'}
          </button>
        </div>
      }
    >
      <form id="table-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="table-number" label="Masa numarası" error={errors.number}>
            <input
              id="table-number"
              data-autofocus
              inputMode="numeric"
              value={form.number}
              onChange={(e) => set('number', e.target.value.replace(/[^\d]/g, ''))}
              onBlur={blurCheck('number')}
              maxLength={4}
              aria-invalid={!!errors.number}
              aria-describedby={errors.number ? 'table-number-error' : undefined}
              className={`${inputClass} ${errors.number ? inputErrorClass : ''}`}
            />
          </Field>
          <Field id="table-capacity" label="Kişi sayısı" error={errors.capacity}>
            <input
              id="table-capacity"
              inputMode="numeric"
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value.replace(/[^\d]/g, ''))}
              onBlur={blurCheck('capacity')}
              maxLength={2}
              aria-invalid={!!errors.capacity}
              aria-describedby={errors.capacity ? 'table-capacity-error' : undefined}
              className={`${inputClass} ${errors.capacity ? inputErrorClass : ''}`}
            />
          </Field>
        </div>
        <Field id="table-area" label="Bölüm (isteğe bağlı)" hint="Boş bırakılırsa Salon olur." error={errors.area}>
          <input
            id="table-area"
            value={form.area}
            onChange={(e) => set('area', e.target.value)}
            maxLength={40}
            placeholder="Örn. Bahçe"
            className={`${inputClass} ${errors.area ? inputErrorClass : ''}`}
          />
        </Field>
        <Field id="table-name" label="Etiket (isteğe bağlı)" error={errors.name}>
          <input
            id="table-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={40}
            placeholder="Örn. Pencere kenarı"
            className={`${inputClass} ${errors.name ? inputErrorClass : ''}`}
          />
        </Field>

        {table && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">Masa kullanımda</p>
                <p className="text-xs text-ink-soft">Kapalıysa bu masanın QR kodu ile sipariş verilemez.</p>
              </div>
              <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Masa kullanımda" />
            </div>
            {form.isActive && !inSession && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Rezerve</p>
                  <p className="text-xs text-ink-soft">Personel masa haritasında rezerve olarak görünür.</p>
                </div>
                <Switch checked={form.reserved} onChange={(v) => set('reserved', v)} label="Rezerve" />
              </div>
            )}
            {inSession && <p className="text-xs text-ink-faint">Masada açık hesap olduğu için durum hesap kapanınca değişir.</p>}
          </>
        )}
      </form>
    </Modal>
  );
}
