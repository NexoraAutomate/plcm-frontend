'use client';

import { cn } from '@/lib/utils';

export interface ReportFooterProps {
  confidentiality?: string;
  companyLines?: string[];
  pageNumber?: number;
  totalPages?: number;
  softwareVersion?: string;
  className?: string;
}

/**
 * Props-driven footer — final copy can be swapped later without refactoring.
 */
export function ReportFooter({
  confidentiality = 'Controlled Document — For Authorized Use Only',
  companyLines = ['SSDLS PLCM'],
  pageNumber,
  totalPages,
  softwareVersion,
  className,
}: ReportFooterProps) {
  return (
    <footer
      className={cn(
        'mt-6 flex items-end justify-between gap-4 border-t border-border pt-3 text-xs text-muted-foreground',
        className
      )}
    >
      <div>
        <p>{confidentiality}</p>
        {companyLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {softwareVersion && <p>Software v{softwareVersion}</p>}
      </div>
      {(pageNumber != null || totalPages != null) && (
        <p className="shrink-0 tabular-nums">
          Page {pageNumber ?? '—'}
          {totalPages != null ? ` of ${totalPages}` : ''}
        </p>
      )}
    </footer>
  );
}
