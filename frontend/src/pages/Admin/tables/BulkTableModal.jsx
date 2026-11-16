import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { Field, inputClass, inputErrorClass, primaryBtn, secondaryBtn } from '../menu/menuUi.jsx';
import { isIntBetween, toInt } from './tableUtils.js';

/** Numara aralığıyla toplu masa ekleme. onSubmit({ from, to, area?, capacity? }) Promise döner. */
export default function BulkTableModal({ open, suggestedFrom, onClose, onSubmit }) {
  const [form, setForm] = useState({ from: '', to: '', area: '', capacity: '4' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = suggestedFrom || 1;
    setForm({ from: String(start), to: String(start + 9), area: '', capacity: '4' });
    setErrors({});
  }, [open, suggestedFrom]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const from = toInt(form.from);
    const to = toInt(form.to);
    if (!isIntBetween(from, 1, 9999)) next.from = '1 ile 9999 arasında olmalı.';
    if (!isIntBetween(to, 1, 9999)) next.to = '1 ile 9999 arasında olmalı.';
    else if (!next.from && to < from) next.to = 'Başlangıçtan küçük olamaz.';
    else if (!next.from && to - from >= 200) next.to = 'Tek seferde en fazla 200 masa.';
    if (form.capacity.trim() && !isIntBetween(toInt(form.capacity), 1, 50)) next.capacity = 'Kapasite 1 ile 50 arasında olmalı.';
    if (form.area.trim().length > 40) next.area = 'En fazla 40 karakter olabilir.';
    return next;
  };

  const blurCheck = (key) => () => setErrors((er) => ({ ...er, [key]: validate()[key] }));

  const from = toInt(form.from);
  const to = toInt(form.to);
  const count = Number.isInteger(from) && Number.isInteger(to) && to >= from ? to - from + 1 : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    const payload = { from, to };
    if (form.area.trim()) payload.area = form.area.trim();
    if (form.capacity.trim()) payload.capacity = toInt(form.capacity);
    setBusy(true);
    try {
      await onSubmit(payload);
    } finally {
      setBusy(false);
    }
  };

  const numericInput = (key, label) => (
    <Field id={`bulk-${key}`} label={label} error={errors[key]}>
      <input
        id={`bulk-${key}`}
        data-autofocus={key === 'from' ? true : undefined}
        inputMode="numeric"
        value={form[key]}
        onChange={(e) => set(key, e.target.value.replace(/[^\d]/g, ''))}
        onBlur={blurCheck(key)}
        maxLength={key === 'capacity' ? 2 : 4}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `bulk-${key}-error` : undefined}
        className={`${inputClass} ${errors[key] ? inputErrorClass : ''}`}
      />
    </Field>
  );

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Toplu Masa Ekle"
      subtitle="Var olan numaralar atlanır."
      footer={
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={busy} className={secondaryBtn}>
            Vazgeç
          </button>
          <button type="submit" form="bulk-table-form" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {count > 0 && count <= 200 ? `${count} Masa Ekle` : 'Masaları Ekle'}
          </button>
        </div>
      }
    >
      <form id="bulk-table-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {numericInput('from', 'İlk numara')}
          {numericInput('to', 'Son numara')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="bulk-area" label="Bölüm" hint="Boşsa Salon." error={errors.area}>
            <input
              id="bulk-area"
              value={form.area}
              onChange={(e) => set('area', e.target.value)}
              maxLength={40}
              placeholder="Örn. Teras"
              className={`${inputClass} ${errors.area ? inputErrorClass : ''}`}
            />
          </Field>
          {numericInput('capacity', 'Kişi sayısı')}
        </div>
      </form>
    </Modal>
  );
}
