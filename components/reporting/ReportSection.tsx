'use client';

import { cn } from '@/lib/utils';

export interface ReportSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function ReportSection({
  title,
  description,
  children,
  className,
}: ReportSectionProps) {
  return (
    <section className={cn('space-y-3 break-inside-avoid', className)}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
