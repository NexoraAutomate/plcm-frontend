'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { TableHead } from '@/components/ui/table';
import { TableSortIcon } from '@/components/data-table/table-sort-icon';
import { cn } from '@/lib/utils';
import { ariaSortValue, type TableSortState } from '@/lib/sorting';

export interface SortableTableHeadProps {
  column: string;
  sort: TableSortState;
  onSort: (column: string) => void;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function SortableTableHead({
  column,
  sort,
  onSort,
  children,
  className,
  title = 'Sort',
}: SortableTableHeadProps) {
  const isActive = sort.sortBy === column && sort.sortOrder != null;

  const handleKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSort(column);
    }
  };

  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive && 'text-foreground font-semibold',
        className
      )}
      role="columnheader"
      tabIndex={0}
      title={title}
      aria-sort={ariaSortValue(sort, column)}
      onClick={() => onSort(column)}
      onKeyDown={handleKeyDown}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        <TableSortIcon column={column} sort={sort} />
      </span>
    </TableHead>
  );
}
