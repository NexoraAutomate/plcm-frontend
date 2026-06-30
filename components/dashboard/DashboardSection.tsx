'use client';

import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  description?: string;
  highlighted?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function DashboardSection({
  title,
  description,
  highlighted = false,
  className,
  children,
}: DashboardSectionProps) {
  return (
    <section
      className={cn(
        'space-y-4 rounded-xl border bg-card p-4 transition-all duration-200 md:p-6',
        highlighted && 'ring-2 ring-primary/40 shadow-lg shadow-primary/10',
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
