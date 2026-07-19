'use client';

import { Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';

export interface ReportPreviewToolbarProps {
  onPrint?: () => void;
  onExportPdf?: () => void;
  onGenerate?: () => void;
  generating?: boolean;
  exporting?: boolean;
  generateLabel?: string;
  disableExport?: boolean;
  disablePrint?: boolean;
}

export function ReportPreviewToolbar({
  onPrint,
  onExportPdf,
  onGenerate,
  generating,
  exporting,
  generateLabel = 'Generate Preview',
  disableExport,
  disablePrint,
}: ReportPreviewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onGenerate && (
        <Button type="button" onClick={onGenerate} disabled={generating}>
          {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {generateLabel}
        </Button>
      )}
      <Can permission={P.print_reports}>
        <Button
          type="button"
          variant="outline"
          onClick={onPrint}
          disabled={disablePrint || !onPrint}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </Can>
      <Can permission={P.export_reports}>
        <Button
          type="button"
          variant="secondary"
          onClick={onExportPdf}
          disabled={disableExport || exporting || !onExportPdf}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>
      </Can>
    </div>
  );
}
