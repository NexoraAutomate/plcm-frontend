'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListContentSuspenseProps {
  loading: boolean;
  children: ReactNode;
  className?: string;
}

/** In-place overlay for table/card bodies while search or filters refetch. */
export function ListContentSuspense({
  loading,
  children,
  className,
}: ListContentSuspenseProps) {
  return (
    <div className={cn('relative', className)} aria-busy={loading} aria-live="polite">
      <div
        className={cn(
          'transition-opacity duration-150',
          loading && 'pointer-events-none select-none opacity-40'
        )}
      >
        {children}
      </div>
      {loading ? (
        <div className="absolute inset-0 z-10 flex min-h-48 items-center justify-center rounded-xl bg-background/55 backdrop-blur-[1px]">
          <div className="loader scale-75" role="status" aria-label="Updating results" />
        </div>
      ) : null}
    </div>
  );
}
