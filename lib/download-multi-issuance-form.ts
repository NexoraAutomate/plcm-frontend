import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ItemIssueRequest } from '@/lib/models';

function text(value?: string | null) {
  const trimmed = (value || '').trim();
  return trimmed || '—';
}

function safeFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Download a multi-item issuance confirmation PDF for hard-copy signatures. */
export function downloadMultiItemIssuanceForm(rows: ItemIssueRequest[]) {
  if (typeof window === 'undefined' || rows.length === 0) return;

  const developer =
    rows[0]?.assigned_developer_name?.trim() ||
    (rows[0] ? `User #${rows[0].assigned_developer_id}` : '—');
  const generatedAt = new Date().toLocaleString();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const marginX = 40;
  let y = 48;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Inventory Issuance Confirmation', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60);
  const metaLines = [
    `Issued to (Developer): ${developer}`,
    `Items: ${rows.length}`,
    `Generated: ${generatedAt}`,
  ];
  for (const line of metaLines) {
    doc.text(line, marginX, y);
    y += 14;
  }
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 8,
    head: [['#', 'Item', 'Part number', 'Serial number', 'Hierarchy', 'Project / Flight / SDLS']],
    body: rows.map((row, index) => [
      String(index + 1),
      text(row.inventory_name),
      text(row.part_number),
      text(row.serial_number),
      text(
        row.target_entity_name ||
          `${row.target_entity_type} #${row.target_entity_id}`
      ),
      text(
        [row.project_name, row.flight_code || row.flight_name, row.sdls_code || row.sdls_name]
          .filter(Boolean)
          .join(' / ')
      ),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 5,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [243, 243, 243],
      textColor: 20,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 90 },
      2: { cellWidth: 78 },
      3: { cellWidth: 78 },
      4: { cellWidth: 110 },
      5: { cellWidth: 'auto' },
    },
    margin: { left: marginX, right: marginX },
  });

  const tableEndY =
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 40;
  let signatureY = tableEndY + 28;
  const pageHeight = doc.internal.pageSize.getHeight();
  const boxHeight = 110;
  const gap = 18;
  const boxWidth = (doc.internal.pageSize.getWidth() - marginX * 2 - gap) / 2;

  if (signatureY + boxHeight + 48 > pageHeight - 40) {
    doc.addPage();
    signatureY = 48;
  }

  const boxes = [
    { label: 'Developer signature', x: marginX },
    { label: 'Inventory Manager acknowledgement', x: marginX + boxWidth + gap },
  ];

  for (const box of boxes) {
    doc.setDrawColor(40);
    doc.rect(box.x, signatureY, boxWidth, boxHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(box.label, box.x + 10, signatureY + 18);
    doc.setDrawColor(80);
    doc.line(box.x + 10, signatureY + boxHeight - 28, box.x + boxWidth - 10, signatureY + boxHeight - 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text('Name / Signature / Date', box.x + 10, signatureY + boxHeight - 14);
  }

  doc.setTextColor(80);
  doc.setFontSize(8);
  doc.text(
    'After signing, scan this form and attach the scan when confirming hard-copy issuance in the Issue Queue.',
    marginX,
    signatureY + boxHeight + 24,
    { maxWidth: doc.internal.pageSize.getWidth() - marginX * 2 }
  );

  const developerPart = safeFilePart(developer) || 'developer';
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`inventory-issuance-form-${developerPart}-${stamp}.pdf`);
}
