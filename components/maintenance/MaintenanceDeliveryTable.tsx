'use client';

import React from 'react';
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
            <TableHead>Delivery Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Delivered At</TableHead>
            <TableHead>Received By</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((delivery) => (
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
