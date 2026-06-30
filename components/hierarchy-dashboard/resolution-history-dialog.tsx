'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  buildInstallTimelineForNode,
  buildReplacementHistoryRows,
  type SubtreeMatchContext,
} from '@/lib/resolution-history-matching';
import type { ConfigurationHistory, MaintenanceDelivery } from '@/lib/models';
import type { SubtreeEntityRef } from '@/lib/project-hierarchy-dashboard';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';
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
import { TimelineEventRow } from '@/components/hierarchy-dashboard/resolution-history-timeline-dialog';

interface ResolutionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeLabel: string;
  records: ConfigurationHistory[];
  matchContext: SubtreeMatchContext;
  subtreeByEntityId: Map<number, SubtreeEntityRef>;
  installationRefs: SubtreeEntityRef[];
  deliveries?: MaintenanceDelivery[];
}

export function ResolutionHistoryDialog({
  open,
  onOpenChange,
  nodeLabel,
  records,
  matchContext,
  subtreeByEntityId,
  installationRefs,
  deliveries = [],
}: ResolutionHistoryDialogProps) {
  const { users } = useDataStore();

  const userLabelsById = useMemo(
    () => new Map(users.map((user) => [user.id, formatUserRef(user)])),
    [users]
  );

  const installEvents = useMemo(
    () =>
      buildInstallTimelineForNode(installationRefs, {
        userLabelsById,
        deliveries,
      }),
    [installationRefs, userLabelsById, deliveries]
  );

  const replacementRows = useMemo(
    () =>
      buildReplacementHistoryRows(
        records,
        matchContext,
        subtreeByEntityId,
        deliveries
      ),
    [records, matchContext, subtreeByEntityId, deliveries]
  );

  const hasContent = installEvents.length > 0 || replacementRows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-[min(100vw-2rem,72rem)] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Resolution History — {nodeLabel}</DialogTitle>
          <DialogDescription>
            Initial build timeline and replacement history for this node and its descendants only.
          </DialogDescription>
        </DialogHeader>

        {!hasContent ? (
          <p className="py-6 text-sm text-muted-foreground">
            No build or replacement records found for this node.
          </p>
        ) : (
          <div className="grid max-h-[calc(90vh-8rem)] grid-cols-1 gap-6 overflow-hidden lg:grid-cols-2">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-3">
                <h3 className="text-sm font-semibold">Initial Build Timeline</h3>
                <p className="text-xs text-muted-foreground">
                  Install dates, installers, and delivery events
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {installEvents.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No installation events recorded for this subtree.
                  </p>
                ) : (
                  installEvents.map((event) => (
                    <TimelineEventRow key={event.id} event={event} />
                  ))
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-3">
                <h3 className="text-sm font-semibold">Replacement History</h3>
                <p className="text-xs text-muted-foreground">
                  Part replacements with fault type and redelivery dates
                </p>
              </div>
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                {replacementRows.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    No replacement records for this subtree.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Fault</TableHead>
                        <TableHead>Old Part / Serial</TableHead>
                        <TableHead>New Part / Serial</TableHead>
                        <TableHead>Redelivery</TableHead>
                        <TableHead>Case</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {replacementRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {new Date(row.date).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {row.entityLabel}
                          </TableCell>
                          <TableCell className="text-sm capitalize">
                            {row.faultType?.replace(/_/g, ' ') || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {[row.oldPartNumber, row.oldSerialNumber]
                              .filter(Boolean)
                              .join(' / ') || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {[row.newPartNumber, row.newSerialNumber]
                              .filter(Boolean)
                              .join(' / ') || '—'}
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
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
