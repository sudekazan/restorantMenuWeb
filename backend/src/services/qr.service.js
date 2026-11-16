import fs from 'fs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { transliterateTR } from '../utils/text.js';

export const buildTableMenuUrl = (table) => `${env.publicMenuUrl}/${table.qrToken}`;

export function generateQrPng(table) {
  return QRCode.toBuffer(buildTableMenuUrl(table), { errorCorrectionLevel: 'M', margin: 1, width: 600 });
}

/**
 * Masa QR kartlarını A4 PDF olarak üretir (sayfa başına 2x3 kesilebilir kart).
 * Türkçe karakterler için PDF_FONT_PATH ile bir TTF font verilmezse
 * metinler ASCII'ye çevrilir (PDFKit'in gömülü Helvetica fontu ş/ğ/ı desteklemez).
 */
export async function generateTablesQrPdf({ restaurant, tables }) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    info: { Title: transliterateTR(`${restaurant.name} - Masa QR Kodlari`), Author: 'QR Menu' },
  });

  const hasFont = env.pdfFontPath && fs.existsSync(env.pdfFontPath);
  if (hasFont) doc.registerFont('Main', env.pdfFontPath).font('Main');
  const t = (s) => (hasFont ? s : transliterateTR(s));

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const qrImages = await Promise.all(tables.map(generateQrPng));

  const cols = 2;
  const rows = 3;
  const margin = 36;
  const gap = 18;
  const cellW = (doc.page.width - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (doc.page.height - margin * 2 - gap * (rows - 1)) / rows;
  const qrSize = Math.min(cellW - 70, cellH - 120);

  tables.forEach((table, i) => {
    const idx = i % (cols * rows);
    if (i > 0 && idx === 0) doc.addPage();

    const x = margin + (idx % cols) * (cellW + gap);
    const y = margin + Math.floor(idx / cols) * (cellH + gap);

    doc.save().roundedRect(x, y, cellW, cellH, 14).lineWidth(1).dash(4, { space: 4 }).strokeColor('#9ca3af').stroke().undash().restore();

    doc.fillColor('#6b7280').fontSize(11).text(t(restaurant.name), x, y + 14, { width: cellW, align: 'center' });
    doc.fillColor('#111827').fontSize(22).text(t(table.name || `Masa ${table.number}`), x, y + 30, { width: cellW, align: 'center' });

    doc.image(qrImages[i], x + (cellW - qrSize) / 2, y + 62, { width: qrSize, height: qrSize });

    doc.fillColor('#374151').fontSize(10).text(t('Menü ve sipariş için QR kodu okutun'), x, y + 68 + qrSize, { width: cellW, align: 'center' });
    if (table.area) {
      doc.fillColor('#9ca3af').fontSize(8).text(t(`${table.area} • No: ${table.number}`), x, y + 82 + qrSize, { width: cellW, align: 'center' });
    }
  });

  doc.end();
  return done;
}
