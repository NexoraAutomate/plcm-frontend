'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableSortState } from '@/lib/sorting';

interface TableSortIconProps {
  column: string;
  sort: TableSortState;
  className?: string;
}

export function TableSortIcon({ column, sort, className }: TableSortIconProps) {
  const isActive = sort.sortBy === column && sort.sortOrder != null;
  const Icon =
    !isActive ? ArrowUpDown : sort.sortOrder === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Icon
      className={cn(
        'inline-block h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70',
        isActive && 'opacity-100 text-foreground',
        className
      )}
      aria-hidden
    />
  );
}
