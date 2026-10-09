'use client';

import React from 'react';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useClientTableSort } from '@/hooks/use-table-sorting';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/status-badge';
import type { MaintenanceLog } from '@/lib/models';

interface MaintenanceTableProps {
  logs: MaintenanceLog[];
  onEdit?: (log: MaintenanceLog) => void;
  onDelete?: (logId: number) => void;
  isLoading?: boolean;
}

export function MaintenanceTable({
  logs,
  onEdit,
  onDelete,
  isLoading = false,
}: MaintenanceTableProps) {
  const { sort, cycleSort, sortedRows } = useClientTableSort(logs);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading maintenance logs...</div>;
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No maintenance logs found.
      </div>
    );
  }

  return (
    <div className="overflow-x-visible rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead column="notes" sort={sort} onSort={cycleSort}>
              Notes
            </SortableTableHead>
            <SortableTableHead column="performed_by" sort={sort} onSort={cycleSort}>
              Performed By
            </SortableTableHead>
            <SortableTableHead column="performed_at" sort={sort} onSort={cycleSort}>
              Performed At
            </SortableTableHead>
            <SortableTableHead column="next_due" sort={sort} onSort={cycleSort}>
              Next Due
            </SortableTableHead>
            <SortableTableHead column="maintenance_type" sort={sort} onSort={cycleSort}>
              Type
            </SortableTableHead>
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/50">
              <TableCell className="text-sm">{log.notes || '-'}</TableCell>
              <TableCell className="text-sm">
                {log.performed_by || '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {log.performed_at
                  ? new Date(log.performed_at).toLocaleDateString()
                  : '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {log.next_due
                  ? new Date(log.next_due).toLocaleDateString()
                  : '-'}
              </TableCell>
              <TableCell>
                <StatusBadge status={log.maintenance_type || 'Open'} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(log)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(log.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
