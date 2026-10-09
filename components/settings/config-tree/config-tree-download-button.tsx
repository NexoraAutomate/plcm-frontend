'use client';

import { useCallback, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Panel, useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import * as api from '@/lib/api';
import { formatUserRef } from '@/lib/user-display';

/** Capture sharper than screen so text stays crisp when fitted onto a print page. */
const PIXEL_RATIO = 3;
/** Keep canvas under common browser limits once multiplied by PIXEL_RATIO. */
const MAX_EXPORT_SIDE = 4096;
const BOUNDS_PADDING = 0.12;

const HEADER_H_MM = 28;
const FOOTER_H_MM = 14;
const SIDE_MARGIN_MM = 10;
const BAND_GAP_MM = 3;

export type ConfigTreePdfMeta = {
  name?: string | null;
  code?: string | null;
  version?: number | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdById?: number | null;
  createdByName?: string | null;
  exportedBy?: string | null;
  isAvailable?: boolean | null;
};

/**
 * Download flow as a print-quality PDF
 * (capture based on https://reactflow.dev/examples/misc/download-image).
 */
export function ConfigTreeDownloadButton({ meta }: { meta?: ConfigTreePdfMeta }) {
  const { getNodes } = useReactFlow();
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const nodes = getNodes();
      if (nodes.length === 0) {
        toast.error('Nothing to export');
        return;
      }

      const nodesBounds = getNodesBounds(nodes);
      const { width, height } = exportPixelSize(nodesBounds.width, nodesBounds.height);
      const viewport = getViewportForBounds(
        nodesBounds,
        width,
        height,
        0.1,
        4,
        BOUNDS_PADDING
      );

      const viewportEl = document.querySelector(
        '.react-flow__viewport'
      ) as HTMLElement | null;
      if (!viewportEl) {
        toast.error('Could not find flow viewport');
        return;
      }

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: '#ffffff',
        width,
        height,
        pixelRatio: PIXEL_RATIO,
        cacheBust: true,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      const createdBy = await resolveCreatedBy(meta);
      const resolvedMeta: ResolvedPdfMeta = {
        name: (meta?.name ?? '').trim() || 'Untitled configuration',
        code: (meta?.code ?? '').trim() || '—',
        versionLabel:
          meta?.version != null && Number.isFinite(meta.version)
            ? `v${meta.version}`
            : 'Draft',
        description: (meta?.description ?? '').trim(),
        createdAt: formatMetaDate(meta?.createdAt),
        updatedAt: formatMetaDate(meta?.updatedAt),
        createdBy,
        exportedBy: (meta?.exportedBy ?? '').trim() || '—',
        exportedAt: formatMetaDate(new Date().toISOString(), true),
        availability:
          meta?.isAvailable == null
            ? '—'
            : meta.isAvailable
              ? 'Available for HM'
              : 'Unavailable',
      };

      const doc = buildPdfFromPng(
        dataUrl,
        width * PIXEL_RATIO,
        height * PIXEL_RATIO,
        resolvedMeta
      );
      doc.save(pdfFileName(resolvedMeta));
      toast.success('PDF downloaded');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    } finally {
      setBusy(false);
    }
  }, [getNodes, meta]);

  return (
    <Panel position="bottom-right">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 shadow"
        disabled={busy}
        onClick={() => void onClick()}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {busy ? 'Exporting…' : 'Download'}
      </Button>
    </Panel>
  );
}

type ResolvedPdfMeta = {
  name: string;
  code: string;
  versionLabel: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  exportedBy: string;
  exportedAt: string;
  availability: string;
};

async function resolveCreatedBy(meta?: ConfigTreePdfMeta): Promise<string> {
  const named = (meta?.createdByName ?? '').trim();
  if (named) return named;
  const id = meta?.createdById;
  if (id == null) return '—';
  try {
    const res = await api.users.get(id);
    return formatUserRef(res.data, `User #${id}`);
  } catch {
    return `User #${id}`;
  }
}

function formatMetaDate(value?: string | null, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  if (withTime) {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function pdfFileName(meta: ResolvedPdfMeta): string {
  const slug = (meta.code !== '—' ? meta.code : meta.name)
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const rev = meta.versionLabel.replace(/\s+/g, '');
  return `${slug || 'hierarchy-config'}-${rev}.pdf`;
}

/** Size the capture roughly 1:1 with node coordinates so labels are not downscaled. */
function exportPixelSize(boundsWidth: number, boundsHeight: number) {
  const padFactor = 1 + BOUNDS_PADDING * 2;
  let width = Math.max(Math.ceil(boundsWidth * padFactor), 640);
  let height = Math.max(Math.ceil(boundsHeight * padFactor), 480);

  const maxLogical = Math.floor(MAX_EXPORT_SIDE / PIXEL_RATIO);
  if (width > maxLogical || height > maxLogical) {
    const factor = Math.min(maxLogical / width, maxLogical / height);
    width = Math.max(Math.floor(width * factor), 1);
    height = Math.max(Math.floor(height * factor), 1);
  }

  return { width, height };
}

/** Fit the high-res PNG onto an A4 page with identifying header/footer. */
function buildPdfFromPng(
  dataUrl: string,
  imgWidthPx: number,
  imgHeightPx: number,
  meta: ResolvedPdfMeta
) {
  const landscape = imgWidthPx >= imgHeightPx;
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawHeader(doc, pageWidth, meta);
  drawFooter(doc, pageWidth, pageHeight, meta);

  const maxW = pageWidth - SIDE_MARGIN_MM * 2;
  const maxH =
    pageHeight - HEADER_H_MM - FOOTER_H_MM - BAND_GAP_MM * 2;
  const aspect = imgWidthPx / imgHeightPx;

  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }

  const x = (pageWidth - drawW) / 2;
  const y = HEADER_H_MM + BAND_GAP_MM + (maxH - drawH) / 2;

  doc.addImage(dataUrl, 'PNG', x, y, drawW, drawH, undefined, 'NONE');
  return doc;
}

function drawHeader(doc: jsPDF, pageWidth: number, meta: ResolvedPdfMeta) {
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, HEADER_H_MM, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(0, HEADER_H_MM, pageWidth, HEADER_H_MM);

  const left = SIDE_MARGIN_MM;
  const right = pageWidth - SIDE_MARGIN_MM;

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Hierarchy configuration tree', left, 6.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(truncate(doc, meta.name, pageWidth * 0.55), left, 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Code: ${meta.code}`, left, 19.5);
  doc.text(`Created: ${meta.createdAt}  ·  By: ${meta.createdBy}`, left, 24.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Revision ${meta.versionLabel}`, right, 13.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(meta.availability, right, 19.5, { align: 'right' });
  doc.text(`Updated: ${meta.updatedAt}`, right, 24.5, { align: 'right' });
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number, meta: ResolvedPdfMeta) {
  const top = pageHeight - FOOTER_H_MM;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, top, pageWidth, FOOTER_H_MM, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(0, top, pageWidth, top);

  const left = SIDE_MARGIN_MM;
  const right = pageWidth - SIDE_MARGIN_MM;
  const midY = top + 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const desc = meta.description
    ? `Description: ${meta.description}`
    : 'Description: —';
  doc.text(truncate(doc, desc, pageWidth * 0.62), left, midY);

  doc.text(`Exported: ${meta.exportedAt}`, right, midY, { align: 'right' });
  doc.text(`Exported by: ${meta.exportedBy}`, right, midY + 4.5, {
    align: 'right',
  });
  doc.text('Page 1 of 1', left, midY + 4.5);
}

function truncate(doc: jsPDF, text: string, maxWidthMm: number): string {
  if (doc.getTextWidth(text) <= maxWidthMm) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidthMm) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}
