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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReplacementHistoryRow } from '@/lib/resolution-history-matching';

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
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Fault</TableHead>
                  <TableHead>Old Part / Serial</TableHead>
                  <TableHead>New Part / Serial</TableHead>
                  <TableHead className="whitespace-nowrap">Redelivery</TableHead>
                  <TableHead>Case</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
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
