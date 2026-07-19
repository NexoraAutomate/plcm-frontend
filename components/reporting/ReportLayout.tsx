'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ReportHeader, type ReportHeaderProps } from './ReportHeader';
import { ReportFooter, type ReportFooterProps } from './ReportFooter';
import { ReportMetadata, type ReportMetadataProps } from './ReportMetadata';

export interface ReportLayoutProps {
  children: React.ReactNode;
  header?: ReportHeaderProps;
  footer?: ReportFooterProps;
  metadata?: ReportMetadataProps | null;
  className?: string;
  orientation?: 'portrait' | 'landscape';
}

export const ReportLayout = forwardRef<HTMLDivElement, ReportLayoutProps>(
  function ReportLayout(
    { children, header, footer, metadata, className, orientation = 'portrait' },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          'report-print-root mx-auto bg-background text-foreground shadow-sm',
          orientation === 'landscape' ? 'max-w-6xl' : 'max-w-4xl',
          'rounded-lg border border-border p-6 md:p-8',
          className
        )}
      >
        <ReportHeader {...header} />
        {metadata && (
          <div className="mt-4">
            <ReportMetadata {...metadata} />
          </div>
        )}
        <div className="mt-6 space-y-8">{children}</div>
        <ReportFooter {...footer} />
      </div>
    );
  }
);
