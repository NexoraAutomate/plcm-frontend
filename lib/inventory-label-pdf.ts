import { jsPDF } from 'jspdf';
import type { AppDefinitions, InventoryLabel } from '@/lib/models';
import { code128Bars } from '@/lib/code128';
import { qrDataUrl } from '@/components/reporting/ReportQRCode';

export type InventoryPrintCode = 'qr' | 'barcode';
export type InventoryLabelPdfSettings = Pick<
  AppDefinitions,
  | 'inventory_qr_size_in'
  | 'inventory_barcode_width_in'
  | 'inventory_barcode_height_in'
  | 'inventory_qr_sticker_width_in'
  | 'inventory_qr_sticker_height_in'
  | 'inventory_barcode_sticker_width_in'
  | 'inventory_barcode_sticker_height_in'
>;

function barcodeDataUrl(value: string): Promise<string> {
  const bars = code128Bars(value);
  const scale = 3;
  let cursor = 8;
  const width = bars.reduce((total, bar) => total + bar.width * scale, 16);
  const rectangles = bars
    .map((bar) => {
      const x = cursor;
      cursor += bar.width * scale;
      return bar.dark
        ? `<rect x="${x}" y="8" width="${bar.width * scale}" height="100"/>`
        : '';
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="126" viewBox="0 0 ${width} 126"><rect width="100%" height="100%" fill="white"/>${rectangles}<text x="50%" y="122" text-anchor="middle" font-family="monospace" font-size="12" fill="black">${value}</text></svg>`;
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = 126;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Unable to prepare barcode image'));
        return;
      }
      context.fillStyle = 'white';
      context.fillRect(0, 0, width, 126);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Unable to prepare barcode image'));
    };
    image.src = blobUrl;
  });
}

function oneLine(value: string | null | undefined, fallback: string, maxLength: number) {
  const text = value?.trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function addLabelMetadata(
  doc: jsPDF,
  label: InventoryLabel,
  x: number,
  y: number,
  width: number,
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(oneLine(label.inventory_name, 'Inventory item', 34), x + width / 2, y, {
    align: 'center',
  });
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  doc.text(
    oneLine(`PN: ${label.part_number || '—'}`, 'PN: —', 42),
    x + width / 2,
    y + 3.5,
    { align: 'center' },
  );
  doc.text(
    oneLine(`SN: ${label.serial_number || '—'}`, 'SN: —', 42),
    x + width / 2,
    y + 7,
    { align: 'center' },
  );
}

/** Save one or more inventory codes as a compact, printable PDF. */
export async function saveInventoryLabelsPdf(
  labels: InventoryLabel[],
  code: InventoryPrintCode,
  settings: InventoryLabelPdfSettings,
): Promise<void> {
  if (labels.length === 0) return;

  const pageWidth = 210;
  const pageHeight = 297;
  const isQr = code === 'qr';
  const codeWidth =
    (isQr ? settings.inventory_qr_size_in : settings.inventory_barcode_width_in) * 25.4;
  const codeHeight =
    (isQr ? settings.inventory_qr_size_in : settings.inventory_barcode_height_in) * 25.4;
  const cellWidth =
    (isQr
      ? settings.inventory_qr_sticker_width_in
      : settings.inventory_barcode_sticker_width_in) * 25.4;
  const cellHeight =
    (isQr
      ? settings.inventory_qr_sticker_height_in
      : settings.inventory_barcode_sticker_height_in) * 25.4;
  const gap = 3;
  const marginX = 8;
  const marginY = 10;
  const columns = Math.max(1, Math.floor((pageWidth - marginX * 2 + gap) / (cellWidth + gap)));
  const rows = Math.floor((pageHeight - marginY * 2 + gap) / (cellHeight + gap));
  const labelsPerPage = columns * rows;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  for (const [index, label] of labels.entries()) {
    if (index > 0 && index % labelsPerPage === 0) {
      doc.addPage('a4');
    }
    const pageIndex = index % labelsPerPage;
    const column = pageIndex % columns;
    const row = Math.floor(pageIndex / columns);
    const cellX = marginX + column * (cellWidth + gap);
    const cellY = marginY + row * (cellHeight + gap);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.rect(cellX, cellY, cellWidth, cellHeight);
    addLabelMetadata(doc, label, cellX, cellY + 4, cellWidth);
    const codeY = cellY + cellHeight - codeHeight - 1.5;

    if (isQr) {
      const qr = await qrDataUrl(label.signed_payload, 360);
      doc.addImage(
        qr,
        'PNG',
        cellX + (cellWidth - codeWidth) / 2,
        codeY,
        codeWidth,
        codeHeight,
      );
    } else {
      const barcode = await barcodeDataUrl(label.barcode_payload || label.signed_payload);
      doc.addImage(
        barcode,
        'PNG',
        cellX + (cellWidth - codeWidth) / 2,
        codeY,
        codeWidth,
        codeHeight,
      );
    }
  }

  doc.save(`inventory-${code}-labels.pdf`);
}
