'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1.5 font-medium',
        isActive
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-700 dark:text-red-400'
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-emerald-500' : 'bg-red-500')}
        aria-hidden
      />
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}
