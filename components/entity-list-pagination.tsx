'use client';

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface EntityListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  rangeLabel: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
}

export function EntityListPagination({
  page,
  totalPages,
  total,
  rangeLabel,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  loading,
}: EntityListPaginationProps) {
  return (
    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {rangeLabel}
        {total > 0 ? ` (${total} matching)` : ''}
      </p>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (hasPrev && !loading) onPrev();
              }}
              className={!hasPrev || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="px-3 text-sm tabular-nums text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (hasNext && !loading) onNext();
              }}
              className={!hasNext || loading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
