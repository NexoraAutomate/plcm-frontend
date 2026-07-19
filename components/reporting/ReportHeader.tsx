'use client';

import { cn } from '@/lib/utils';

export interface ReportHeaderProps {
  title?: string;
  subtitle?: string;
  logoSrc?: string | null;
  companyLines?: string[];
  documentLabel?: string;
  className?: string;
}

/**
 * Props-driven header — final copy can be swapped later without refactoring.
 */
export function ReportHeader({
  title = 'Enterprise Report',
  subtitle,
  logoSrc,
  companyLines = ['SSDLS', 'Product Lifecycle Management'],
  documentLabel,
  className,
}: ReportHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 border-b border-border pb-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-muted-foreground/40 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="Logo" className="h-10 w-10 object-contain" />
          ) : (
            'Logo'
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {companyLines[0]}
          </p>
          {companyLines.slice(1).map((line) => (
            <p key={line} className="text-xs text-muted-foreground">
              {line}
            </p>
          ))}
          {documentLabel && (
            <p className="mt-1 text-[11px] text-muted-foreground/80">{documentLabel}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}
