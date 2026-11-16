import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Layers, Loader2, Pencil, Plus, QrCode, Trash2, Users } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { adminApi } from '../../lib/api.js';
import { iconBtn, primaryBtn, secondaryBtn } from './menu/menuUi.jsx';
import TableFormModal from './tables/TableFormModal.jsx';
import BulkTableModal from './tables/BulkTableModal.jsx';
import QrPreviewModal from './tables/QrPreviewModal.jsx';
import { STATUS_META, saveBlob, tableErrorMessage, tableTitle } from './tables/tableUtils.js';

const ALL = '__all__';
const byNumber = (a, b) => a.number - b.number;

/** Yönetim > Masalar ve QR: masa ekleme, düzenleme, silme ve QR çıktıları. */
export default function TablesSection() {
  const { toast } = useToast();

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [area, setArea] = useState(ALL);
  const [form, setForm] = useState(null); // { table?: object }
  const [bulkOpen, setBulkOpen] = useState(false);
  const [qrId, setQrId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'delete' | 'rotate', table }
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminApi.listTables();
      setTables([...list].sort(byNumber));
      setError('');
    } catch (err) {
      setError(err.message || 'Masalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const areas = useMemo(() => [...new Set(tables.map((t) => t.area || 'Salon'))].sort((a, b) => a.localeCompare(b, 'tr')), [tables]);
  useEffect(() => {
    if (area !== ALL && !areas.includes(area)) setArea(ALL);
  }, [areas, area]);

  const visible = area === ALL ? tables : tables.filter((t) => (t.area || 'Salon') === area);
  const nextNumber = tables.length ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
  const activeCount = tables.filter((t) => t.isActive !== false).length;
  const qrTable = tables.find((t) => t._id === qrId) || null;

  const replaceTable = (updated) => setTables((prev) => prev.map((t) => (t._id === updated._id ? { ...t, ...updated } : t)).sort(byNumber));

  /* ---------- Ekle / düzenle ---------- */
  const saveTable = async (payload) => {
    const editing = form?.table;
    try {
      if (editing) {
        replaceTable(await adminApi.updateTable(editing._id, payload));
        toast({ title: `Masa ${payload.number} güncellendi`, variant: 'success', duration: 2500 });
      } else {
        const created = await adminApi.createTable(payload);
        setTables((prev) => [...prev, created].sort(byNumber));
        toast({ title: `Masa ${created.number} eklendi`, variant: 'success', duration: 2500 });
      }
      setForm(null);
    } catch (err) {
      toast({ title: 'Masa kaydedilemedi', description: tableErrorMessage(err), variant: 'error' });
    }
  };

  const bulkCreate = async (payload) => {
    try {
      const { created = [], skippedNumbers = [] } = await adminApi.bulkCreateTables(payload);
      setTables((prev) => [...prev, ...created].sort(byNumber));
      setBulkOpen(false);
      const skipped = skippedNumbers.length
        ? `Zaten var olan ${skippedNumbers.length} numara atlandı: ${skippedNumbers.slice(0, 10).join(', ')}${skippedNumbers.length > 10 ? '…' : ''}`
        : undefined;
      toast({
        title: created.length ? `${created.length} masa eklendi` : 'Yeni masa eklenmedi',
        description: skipped,
        variant: created.length ? 'success' : 'error',
      });
    } catch (err) {
      toast({ title: 'Masalar eklenemedi', description: tableErrorMessage(err), variant: 'error' });
    }
  };

  /* ---------- Onaylı işlemler ---------- */
  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, table } = confirm;
    try {
      if (kind === 'rotate') {
        replaceTable(await adminApi.rotateTableQr(table._id));
        toast({ title: 'QR kod yenilendi', description: 'Yeni QR kodu indirip masaya yerleştirin.', variant: 'success' });
      } else {
        await adminApi.deleteTable(table._id);
        if (qrId === table._id) setQrId(null);
        // Sipariş geçmişi olan masa silinmez, pasife alınır: gerçek durumu listeden al
        await load();
        toast({ title: `${tableTitle(table)} kaldırıldı`, variant: 'success', duration: 2500 });
      }
      setConfirm(null);
    } catch (err) {
      toast({ title: kind === 'rotate' ? 'QR kod yenilenemedi' : 'Masa silinemedi', description: tableErrorMessage(err), variant: 'error' });
    }
  };

  const downloadAllPdf = async () => {
    setPdfBusy(true);
    try {
      const blob = await adminApi.getBulkQrPdf();
      saveBlob(blob, 'masa-qr-kodlari.pdf');
    } catch (err) {
      toast({ title: 'PDF indirilemedi', description: err.message, variant: 'error' });
    } finally {
      setPdfBusy(false);
    }
  };

  /* ---------- Görünüm ---------- */
  const heading = (
    <div>
      <h1 className="text-xl font-extrabold text-ink">Masalar ve QR</h1>
      <p className="text-sm text-ink-soft">Masaları yönetin, QR kodlarını indirip yazdırın.</p>
    </div>
  );

  if (loading) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="py-16 flex items-center justify-center gap-3 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          <span className="text-sm">Masalar yükleniyor…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <p className="text-sm text-rose-800">{error}</p>
          <button type="button" onClick={load} className={secondaryBtn}>
            Tekrar Dene
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">{heading}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadAllPdf} disabled={pdfBusy || activeCount === 0} className={secondaryBtn}>
            {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Tüm QR'lar (PDF)
          </button>
          <button type="button" onClick={() => setBulkOpen(true)} className={secondaryBtn}>
            <Layers className="w-4 h-4" />
            Toplu Ekle
          </button>
          <button type="button" onClick={() => setForm({})} className={primaryBtn}>
            <Plus className="w-4 h-4" />
            Masa Ekle
          </button>
        </div>
      </div>

      <div className="bg-card border border-line rounded-3xl shadow-sm min-w-0">
        {tables.length === 0 ? (
          <div className="px-4 py-12 text-center space-y-3">
            <p className="text-sm font-semibold text-ink">Henüz masa yok</p>
            <p className="text-sm text-ink-soft">Masaları tek tek ya da numara aralığıyla toplu ekleyebilirsiniz.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setBulkOpen(true)} className={secondaryBtn}>
                <Layers className="w-4 h-4" />
                Toplu Ekle
              </button>
              <button type="button" onClick={() => setForm({})} className={primaryBtn}>
                <Plus className="w-4 h-4" />
                İlk Masayı Ekle
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
              <h2 className="text-sm font-bold text-ink mr-auto">
                {tables.length} masa <span className="text-ink-faint font-semibold">({activeCount} kullanımda)</span>
              </h2>
              {areas.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bölüme göre filtrele">
                  {[ALL, ...areas].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setArea(a)}
                      aria-pressed={area === a}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        area === a ? 'bg-brand-600 text-white' : 'bg-muted text-ink-soft hover:text-ink'
                      }`}
                    >
                      {a === ALL ? 'Tümü' : a}
                    </button>
                  ))}
                </div>
              )}
            </header>
            {activeCount < tables.length && (
              <p className="px-4 pb-3 text-xs text-ink-faint">Toplu PDF yalnızca kullanımdaki masaları içerir.</p>
            )}

            <ul className="border-t border-line divide-y divide-line">
              {visible.map((t) => {
                const status = STATUS_META[t.isActive === false ? 'inactive' : t.status] || STATUS_META.available;
                return (
                  <li key={t._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[10rem]">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-extrabold tabular-nums shrink-0 ${
                          t.isActive === false ? 'bg-muted text-ink-faint' : 'bg-brand-50 text-brand-700'
                        }`}
                        aria-hidden="true"
                      >
                        {t.number}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${t.isActive === false ? 'text-ink-faint' : 'text-ink'}`}>{tableTitle(t)}</p>
                        <p className="text-xs text-ink-soft flex items-center gap-1.5">
                          <span className="truncate">{t.area || 'Salon'}</span>
                          <span aria-hidden="true">·</span>
                          <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="tabular-nums">{t.capacity}</span>
                          <span className="sr-only">kişilik</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-auto">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-lg mr-1 ${status.className}`}>{status.label}</span>
                      <button type="button" onClick={() => setQrId(t._id)} title="QR kod" aria-label={`${tableTitle(t)} QR kodunu göster`} className={iconBtn}>
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setForm({ table: t })} title="Düzenle" aria-label={`${tableTitle(t)} düzenle`} className={iconBtn}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'delete', table: t })}
                        disabled={!!t.currentSession}
                        title={t.currentSession ? 'Açık hesabı olan masa silinemez' : 'Sil'}
                        aria-label={`${tableTitle(t)} sil`}
                        className={`${iconBtn} hover:text-rose-600`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <TableFormModal
        open={!!form}
        table={form?.table}
        suggestedNumber={nextNumber}
        onClose={() => setForm(null)}
        onSubmit={saveTable}
      />
      <BulkTableModal open={bulkOpen} suggestedFrom={nextNumber} onClose={() => setBulkOpen(false)} onSubmit={bulkCreate} />
      <QrPreviewModal
        open={!!qrTable}
        table={qrTable}
        onClose={() => setQrId(null)}
        onRotate={(table) => setConfirm({ kind: 'rotate', table })}
      />
      <ConfirmDialog
        open={!!confirm}
        tone={confirm?.kind === 'rotate' ? 'warning' : 'danger'}
        title={confirm?.kind === 'rotate' ? "QR'ı yenile" : 'Masayı sil'}
        description={
          confirm?.kind === 'rotate'
            ? `${tableTitle(confirm?.table)} için yeni bir QR kod oluşturulacak. Basılı eski QR kod hemen geçersiz olur ve okutulduğunda menü açılmaz. Yeni QR'ı indirip masaya yerleştirmeniz gerekir.`
            : `${tableTitle(confirm?.table)} kaldırılacak ve QR kodu çalışmayacak. Geçmiş siparişi olan masa silinmez, kullanım dışı bırakılır; raporlar etkilenmez.`
        }
        confirmLabel={confirm?.kind === 'rotate' ? "QR'ı Yenile" : 'Masayı Sil'}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}
