'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  embedded?: boolean;
}

/**
 * Shared page chrome for Settings hub and individual admin panels.
 * When `embedded` is true, the page-level title is omitted (Settings shell owns it).
 */
export function SettingsLayout({
  title,
  description,
  children,
  className,
  embedded = false,
}: SettingsLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {!embedded && title ? (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
