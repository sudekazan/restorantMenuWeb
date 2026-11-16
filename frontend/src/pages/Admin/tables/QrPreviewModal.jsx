import React, { useEffect, useState } from 'react';
import { Copy, Download, FileDown, Loader2, RefreshCw } from 'lucide-react';
import Modal from '../../../components/ui/Modal.jsx';
import { useToast } from '../../../components/ui/ToastProvider.jsx';
import { adminApi } from '../../../lib/api.js';
import { primaryBtn, secondaryBtn } from '../menu/menuUi.jsx';
import { saveBlob, tableTitle } from './tableUtils.js';

/** Tek masanın QR önizlemesi; PNG / PDF indirme ve QR yenileme buradan yapılır. */
export default function QrPreviewModal({ open, table, onClose, onRotate }) {
  const { toast } = useToast();
  const [png, setPng] = useState(null); // { blob, url }
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);

  const tableId = table?._id;
  const qrToken = table?.qrToken;

  // PNG'yi yetki başlığıyla (JWT) çek; <img src> doğrudan kullanılamaz çünkü başlık gönderemez
  useEffect(() => {
    if (!open || !tableId) return undefined;
    let cancelled = false;
    let objectUrl = '';
    setPng(null);
    setLoadError('');
    adminApi
      .getTableQrPng(tableId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPng({ blob, url: objectUrl });
      })
      .catch((err) => !cancelled && setLoadError(err.message || 'QR kod yüklenemedi.'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, tableId, qrToken, reloadKey]);

  if (!table) return null;

  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const blob = await adminApi.getTableQrPdf(table._id);
      saveBlob(blob, `masa-${table.number}-qr.pdf`);
    } catch (err) {
      toast({ title: 'PDF indirilemedi', description: err.message, variant: 'error' });
    } finally {
      setPdfBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(table.menuUrl);
      toast({ title: 'Bağlantı kopyalandı', variant: 'success', duration: 2000 });
    } catch {
      toast({ title: 'Bağlantı kopyalanamadı', description: 'Bağlantıyı seçip elle kopyalayabilirsiniz.', variant: 'error' });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tableTitle(table)}
      subtitle={table.area || undefined}
      footer={
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={() => onRotate(table)} className={`${secondaryBtn} mr-auto`}>
            <RefreshCw className="w-4 h-4" />
            QR'ı Yenile
          </button>
          <button type="button" onClick={downloadPdf} disabled={pdfBusy} className={secondaryBtn}>
            {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            PDF İndir
          </button>
          <button
            type="button"
            data-autofocus
            onClick={() => png && saveBlob(png.blob, `masa-${table.number}.png`)}
            disabled={!png}
            className={primaryBtn}
          >
            <Download className="w-4 h-4" />
            PNG İndir
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {table.isActive === false && (
          <p className="text-sm rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3">
            Bu masa kullanım dışı. QR kodu okutulsa da menü açılmaz.
          </p>
        )}

        <div className="mx-auto w-56 h-56 max-w-full rounded-3xl bg-white border border-line flex items-center justify-center overflow-hidden">
          {png ? (
            <img src={png.url} alt={`${tableTitle(table)} QR kodu`} className="w-full h-full object-contain p-3" />
          ) : loadError ? (
            <div className="text-center space-y-2 px-4">
              <p className="text-sm text-rose-700">{loadError}</p>
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={secondaryBtn}>
                Tekrar Dene
              </button>
            </div>
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" aria-label="QR kod yükleniyor" />
          )}
        </div>

        {table.menuUrl && (
          <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
            <p className="text-xs text-ink-soft break-all flex-1 min-w-0 select-all">{table.menuUrl}</p>
            <button
              type="button"
              onClick={copyLink}
              title="Bağlantıyı kopyala"
              aria-label="Menü bağlantısını kopyala"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-line shrink-0"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
