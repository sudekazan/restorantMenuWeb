import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { kurusToInput, parseTlToKurus } from '../../../lib/format.js';
import { Switch, inputClass, inputErrorClass, iconBtn, secondaryBtn } from './menuUi.jsx';

// backend/src/validators/menu.validators.js ile aynı sınırlar
export const MAX_GROUPS = 10;
export const MAX_CHOICES = 30;
export const MAX_SELECT_LIMIT = 20;
const NAME_MAX = 60;

let keySeq = 0;
const newKey = () => `k${Date.now().toString(36)}${(keySeq += 1)}`;

const emptyChoice = () => ({ key: newKey(), name: '', priceDelta: '', isAvailable: true });
const emptyGroup = () => ({
  key: newKey(),
  name: '',
  type: 'single',
  isRequired: false,
  maxSelect: '1',
  choices: [emptyChoice()],
});

/** Üründeki grupları form durumuna çevirir (_id'ler korunur). */
export function groupsToForm(optionGroups) {
  return (optionGroups || []).map((g) => ({
    key: newKey(),
    _id: g._id,
    name: g.name || '',
    type: g.type === 'multiple' ? 'multiple' : 'single',
    isRequired: !!g.isRequired,
    maxSelect: String(g.maxSelect ?? 1),
    choices: (g.choices || []).map((c) => ({
      key: newKey(),
      _id: c._id,
      name: c.name || '',
      priceDelta: c.priceDelta ? kurusToInput(c.priceDelta) : '',
      isAvailable: c.isAvailable !== false,
    })),
  }));
}

/** Form durumunu backend'e gidecek diziye çevirir. Önce validateGroups çağrılmalı. */
export function groupsToPayload(groups) {
  return groups.map((g) => {
    const out = {
      name: g.name.trim(),
      type: g.type,
      isRequired: g.isRequired,
      maxSelect: g.type === 'multiple' ? Number(g.maxSelect) : 1,
      choices: g.choices.map((c) => {
        const choice = {
          name: c.name.trim(),
          priceDelta: c.priceDelta.trim() === '' ? 0 : parseTlToKurus(c.priceDelta),
          isAvailable: c.isAvailable,
        };
        if (c._id) choice._id = c._id;
        return choice;
      }),
    };
    if (g._id) out._id = g._id;
    return out;
  });
}

/**
 * Backend kurallarına göre doğrular.
 * Dönüş: { [grupKey]: { name?, maxSelect?, choices?, items: { [seçenekKey]: { name?, priceDelta? } } } }
 * Hata yoksa boş nesne.
 */
export function validateGroups(groups) {
  const errors = {};
  for (const g of groups) {
    const ge = { items: {} };
    const name = g.name.trim();
    if (!name) ge.name = 'Grup adını yazın.';
    else if (name.length > NAME_MAX) ge.name = `Grup adı en fazla ${NAME_MAX} karakter olabilir.`;

    if (g.choices.length === 0) ge.choices = 'En az bir seçenek ekleyin.';
    else if (g.choices.length > MAX_CHOICES) ge.choices = `Bir grupta en fazla ${MAX_CHOICES} seçenek olabilir.`;

    if (g.type === 'multiple') {
      const n = Number(g.maxSelect);
      if (g.maxSelect === '' || !Number.isInteger(n) || n < 1 || n > MAX_SELECT_LIMIT) {
        ge.maxSelect = `1 ile ${MAX_SELECT_LIMIT} arasında tam sayı yazın.`;
      } else if (g.choices.length > 0 && n > g.choices.length) {
        ge.maxSelect = `Seçenek sayısından (${g.choices.length}) fazla olamaz.`;
      }
    }

    for (const c of g.choices) {
      const ce = {};
      const cname = c.name.trim();
      if (!cname) ce.name = 'Seçenek adını yazın.';
      else if (cname.length > NAME_MAX) ce.name = `En fazla ${NAME_MAX} karakter olabilir.`;
      if (c.priceDelta.trim() !== '' && parseTlToKurus(c.priceDelta) === null) ce.priceDelta = 'Ek fiyatı 12,50 biçiminde yazın.';
      if (Object.keys(ce).length) ge.items[c.key] = ce;
    }

    if (ge.name || ge.choices || ge.maxSelect || Object.keys(ge.items).length) errors[g.key] = ge;
  }
  return errors;
}

function move(list, index, dir) {
  const to = index + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

const smallInput = (err) => `${inputClass} ${err ? inputErrorClass : ''} !py-2.5`;

/**
 * Ürün seçenek grupları düzenleyicisi (Boyut, Ekstralar gibi).
 * groups: groupsToForm çıktısı; errors: validateGroups çıktısı (gösterilecekse).
 */
export default function OptionGroupsEditor({ groups, onChange, errors = {} }) {
  const updateGroup = (key, patch) => onChange(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const updateChoice = (gKey, cKey, patch) =>
    onChange(
      groups.map((g) =>
        g.key === gKey ? { ...g, choices: g.choices.map((c) => (c.key === cKey ? { ...c, ...patch } : c)) } : g
      )
    );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Seçenek grupları (isteğe bağlı)</p>
        <p className="text-xs text-ink-faint">Porsiyon, sos, ekstra malzeme gibi. Müşteri menüsünde bu sırayla görünür.</p>
      </div>

      {groups.map((g, gi) => {
        const ge = errors[g.key] || { items: {} };
        const gid = `og-${g.key}`;
        return (
          <fieldset key={g.key} className="rounded-2xl border border-line bg-card p-3 sm:p-4 space-y-3">
            <legend className="sr-only">{`${gi + 1}. seçenek grubu`}</legend>

            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 space-y-1.5">
                <label htmlFor={`${gid}-name`} className="block text-sm font-semibold text-ink">
                  Grup adı
                </label>
                <input
                  id={`${gid}-name`}
                  value={g.name}
                  onChange={(e) => updateGroup(g.key, { name: e.target.value })}
                  maxLength={NAME_MAX}
                  placeholder="Örn. Boyut"
                  aria-invalid={!!ge.name}
                  className={smallInput(ge.name)}
                />
                {ge.name && <p className="text-xs text-rose-600">{ge.name}</p>}
              </div>
              <div className="flex shrink-0 pt-7">
                <button type="button" onClick={() => onChange(move(groups, gi, -1))} disabled={gi === 0} className={iconBtn} aria-label="Grubu yukarı taşı" title="Yukarı taşı">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => onChange(move(groups, gi, 1))} disabled={gi === groups.length - 1} className={iconBtn} aria-label="Grubu aşağı taşı" title="Aşağı taşı">
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(groups.filter((x) => x.key !== g.key))}
                  className={`${iconBtn} hover:!text-rose-600`}
                  aria-label={`"${g.name || 'Adsız'}" grubunu sil`}
                  title="Grubu sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-ink">Seçim türü</p>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="radiogroup" aria-label="Seçim türü">
                  {[
                    ['single', 'Tek seçim'],
                    ['multiple', 'Çoklu seçim'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={g.type === val}
                      onClick={() => updateGroup(g.key, { type: val })}
                      className={`rounded-xl px-2 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        g.type === val ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {g.type === 'multiple' && (
                <div className="space-y-1.5">
                  <label htmlFor={`${gid}-max`} className="block text-sm font-semibold text-ink">
                    En çok seçim
                  </label>
                  <input
                    id={`${gid}-max`}
                    inputMode="numeric"
                    value={g.maxSelect}
                    onChange={(e) => updateGroup(g.key, { maxSelect: e.target.value })}
                    aria-invalid={!!ge.maxSelect}
                    className={`${smallInput(ge.maxSelect)} tabular-nums`}
                  />
                  {ge.maxSelect ? (
                    <p className="text-xs text-rose-600">{ge.maxSelect}</p>
                  ) : (
                    <p className="text-xs text-ink-faint">Müşteri bu gruptan en fazla bu kadar seçebilir.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">Zorunlu</p>
                <p className="text-xs text-ink-soft">Açıksa müşteri en az bir seçim yapmadan sepete ekleyemez.</p>
              </div>
              <Switch checked={g.isRequired} onChange={(v) => updateGroup(g.key, { isRequired: v })} label="Zorunlu grup" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">Seçenekler</p>
              {g.choices.map((c, ci) => {
                const ce = ge.items?.[c.key] || {};
                const cid = `${gid}-c-${c.key}`;
                return (
                  <div key={c.key} className="rounded-2xl bg-muted/60 p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`${cid}-name`} className="sr-only">{`${ci + 1}. seçenek adı`}</label>
                        <input
                          id={`${cid}-name`}
                          value={c.name}
                          onChange={(e) => updateChoice(g.key, c.key, { name: e.target.value })}
                          maxLength={NAME_MAX}
                          placeholder="Seçenek adı, örn. Büyük"
                          aria-invalid={!!ce.name}
                          className={smallInput(ce.name)}
                        />
                        {ce.name && <p className="text-xs text-rose-600 mt-1">{ce.name}</p>}
                      </div>
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          onClick={() => updateGroup(g.key, { choices: move(g.choices, ci, -1) })}
                          disabled={ci === 0}
                          className={iconBtn}
                          aria-label="Seçeneği yukarı taşı"
                          title="Yukarı taşı"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGroup(g.key, { choices: move(g.choices, ci, 1) })}
                          disabled={ci === g.choices.length - 1}
                          className={iconBtn}
                          aria-label="Seçeneği aşağı taşı"
                          title="Aşağı taşı"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGroup(g.key, { choices: g.choices.filter((x) => x.key !== c.key) })}
                          className={`${iconBtn} hover:!text-rose-600`}
                          aria-label={`"${c.name || 'Adsız'}" seçeneğini sil`}
                          title="Seçeneği sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`${cid}-price`} className="block text-xs font-semibold text-ink-soft mb-1">
                          Ek fiyat (TL)
                        </label>
                        <input
                          id={`${cid}-price`}
                          inputMode="decimal"
                          value={c.priceDelta}
                          onChange={(e) => updateChoice(g.key, c.key, { priceDelta: e.target.value })}
                          placeholder="0,00"
                          aria-invalid={!!ce.priceDelta}
                          className={`${smallInput(ce.priceDelta)} tabular-nums`}
                        />
                        {ce.priceDelta && <p className="text-xs text-rose-600 mt-1">{ce.priceDelta}</p>}
                      </div>
                      <div className="shrink-0 pt-5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink-soft">Stokta</span>
                        <Switch
                          checked={c.isAvailable}
                          onChange={(v) => updateChoice(g.key, c.key, { isAvailable: v })}
                          label={`"${c.name || 'Adsız'}" stokta`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {ge.choices && <p className="text-xs text-rose-600">{ge.choices}</p>}
              <button
                type="button"
                onClick={() => updateGroup(g.key, { choices: [...g.choices, emptyChoice()] })}
                disabled={g.choices.length >= MAX_CHOICES}
                className={`${secondaryBtn} w-full`}
              >
                <Plus className="w-4 h-4" />
                Seçenek Ekle
              </button>
              {g.choices.length >= MAX_CHOICES && (
                <p className="text-xs text-ink-faint">Bir grupta en fazla {MAX_CHOICES} seçenek olabilir.</p>
              )}
            </div>
          </fieldset>
        );
      })}

      <button type="button" onClick={() => onChange([...groups, emptyGroup()])} disabled={groups.length >= MAX_GROUPS} className={`${secondaryBtn} w-full`}>
        <Plus className="w-4 h-4" />
        Seçenek Grubu Ekle
      </button>
      {groups.length >= MAX_GROUPS && <p className="text-xs text-ink-faint">Bir üründe en fazla {MAX_GROUPS} seçenek grubu olabilir.</p>}
    </div>
  );
}
