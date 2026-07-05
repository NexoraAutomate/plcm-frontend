'use client';

import { Button } from '@/components/ui/button';

interface ListPageErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function ListPageError({ message, onRetry }: ListPageErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="text-sm text-destructive">
        {message ?? 'Failed to load data. Please try again.'}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
