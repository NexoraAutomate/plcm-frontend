'use client';

import React, { useMemo } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
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
import type { MaintenanceDelivery } from '@/lib/models';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { sortRowsByState } from '@/lib/sorting';

interface MaintenanceDeliveryTableProps {
  deliveries: MaintenanceDelivery[];
  onConfirm?: (delivery: MaintenanceDelivery) => void;
  onDelete?: (delivery: MaintenanceDelivery) => void;
  isLoading?: boolean;
}

export function MaintenanceDeliveryTable({
  deliveries,
  onConfirm,
  onDelete,
  isLoading = false,
}: MaintenanceDeliveryTableProps) {
  const { sort, cycleSort } = useTableSorting({
    initial: { sortBy: 'created_at', sortOrder: 'desc' },
  });

  const sortedDeliveries = useMemo(
    () =>
      sortRowsByState(
        deliveries as unknown as Record<string, unknown>[],
        sort
      ) as unknown as MaintenanceDelivery[],
    [deliveries, sort]
  );

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading deliveries...
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No deliveries found.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <SortableTableHead column="delivery_type" sort={sort} onSort={cycleSort}>
              Delivery Type
            </SortableTableHead>
            <SortableTableHead column="status" sort={sort} onSort={cycleSort}>
              Status
            </SortableTableHead>
            <SortableTableHead column="delivered_at" sort={sort} onSort={cycleSort}>
              Delivered At
            </SortableTableHead>
            <SortableTableHead column="received_by" sort={sort} onSort={cycleSort}>
              Received By
            </SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeliveries.map((delivery) => (
            <TableRow key={delivery.id} className="hover:bg-muted/50">
              <TableCell className="text-sm capitalize">
                {delivery.delivery_type.replace(/_/g, ' ')}
              </TableCell>
              <TableCell>
                <StatusBadge status={delivery.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {delivery.delivered_at
                  ? new Date(delivery.delivered_at).toLocaleDateString()
                  : '-'}
              </TableCell>
              <TableCell className="text-sm">{delivery.received_by || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {onConfirm &&
                    delivery.status === 'dispatched' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onConfirm(delivery)}
                        className="h-8 w-8 p-0"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(delivery)}
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
