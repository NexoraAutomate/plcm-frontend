'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReplacementHistoryRow } from '@/lib/resolution-history-matching';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useClientTableSort } from '@/hooks/use-table-sorting';

interface ReplacementHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: ReplacementHistoryRow[];
}

export function ReplacementHistoryDialog({
  open,
  onOpenChange,
  title,
  description = 'Part replacements with fault type and redelivery dates.',
  rows,
}: ReplacementHistoryDialogProps) {
  const { sort, cycleSort, sortedRows } = useClientTableSort(rows);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-7xl max-w-[min(96vw,80rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-8rem)] overflow-auto rounded-lg border">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              No replacement records found for this selection.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="date" sort={sort} onSort={cycleSort} className="whitespace-nowrap">
                    Date
                  </SortableTableHead>
                  <SortableTableHead column="entityLabel" sort={sort} onSort={cycleSort}>
                    Entity
                  </SortableTableHead>
                  <SortableTableHead column="faultType" sort={sort} onSort={cycleSort}>
                    Fault
                  </SortableTableHead>
                  <SortableTableHead column="oldPartNumber" sort={sort} onSort={cycleSort}>
                    Old Part / Serial
                  </SortableTableHead>
                  <SortableTableHead column="newPartNumber" sort={sort} onSort={cycleSort}>
                    New Part / Serial
                  </SortableTableHead>
                  <SortableTableHead column="redeliveryDate" sort={sort} onSort={cycleSort} className="whitespace-nowrap">
                    Redelivery
                  </SortableTableHead>
                  <SortableTableHead column="maintenanceCaseId" sort={sort} onSort={cycleSort}>
                    Case
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.date).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{row.entityLabel}</TableCell>
                    <TableCell className="text-sm capitalize">
                      {row.faultType?.replace(/_/g, ' ') || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {[row.oldPartNumber, row.oldSerialNumber].filter(Boolean).join(' / ') ||
                        '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {[row.newPartNumber, row.newSerialNumber].filter(Boolean).join(' / ') ||
                        '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {row.redeliveryDate
                        ? new Date(row.redeliveryDate).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.maintenanceCaseId ? (
                        <Link
                          href={`/maintenance/cases/${row.maintenanceCaseId}`}
                          className="text-primary hover:underline"
                        >
                          #{row.maintenanceCaseId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
