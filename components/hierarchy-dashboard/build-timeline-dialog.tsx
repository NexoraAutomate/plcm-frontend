'use client';

import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  buildInstallTimelineForNode,
  buildReplacementHistoryRows,
  type LifecycleTimelineEvent,
  type SubtreeMatchContext,
} from '@/lib/resolution-history-matching';
import type { ConfigurationHistory, MaintenanceDelivery } from '@/lib/models';
import type { SubtreeEntityRef } from '@/lib/project-hierarchy-dashboard';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';
import { TimelineEventRow } from '@/components/hierarchy-dashboard/resolution-history-timeline-dialog';
import { ReplacementHistoryDialog } from '@/components/hierarchy-dashboard/replacement-history-dialog';
import { EntityResolutionDialog } from '@/components/hierarchy-dashboard/entity-resolution-dialog';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';

interface BuildTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeLabel: string;
  projectId: number;
  records: ConfigurationHistory[];
  matchContext: SubtreeMatchContext;
  subtreeByEntityId: Map<number, SubtreeEntityRef>;
  installationRefs: SubtreeEntityRef[];
  deliveries?: MaintenanceDelivery[];
  onHistoryRefresh?: () => void;
}

export function BuildTimelineDialog({
  open,
  onOpenChange,
  nodeLabel,
  projectId,
  records,
  matchContext,
  subtreeByEntityId,
  installationRefs,
  deliveries = [],
  onHistoryRefresh,
}: BuildTimelineDialogProps) {
  const { users } = useDataStore();
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: HierarchyEntityType;
    pk: number;
    label: string;
    ref: SubtreeEntityRef;
  } | null>(null);

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
    () => buildReplacementHistoryRows(records, matchContext, subtreeByEntityId, deliveries),
    [records, matchContext, subtreeByEntityId, deliveries]
  );

  const handleEntitySelect = (event: LifecycleTimelineEvent) => {
    if (!event.entityType || event.entityPk == null) return;
    const ref = installationRefs.find(
      (item) => item.type === event.entityType && item.pk === event.entityPk
    );
    if (!ref) return;
    setSelectedEntity({
      type: event.entityType,
      pk: event.entityPk,
      label: event.entityLabel,
      ref,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>Initial Build Timeline — {nodeLabel}</DialogTitle>
                <DialogDescription>
                  Install dates, installers, and original identifiers for this node and its
                  descendants.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setReplacementOpen(true)}
              >
                <History className="mr-2 h-4 w-4" />
                View Replacement History
                {replacementRows.length > 0 ? (
                  <Badge variant="secondary" className="ml-2">
                    {replacementRows.length}
                  </Badge>
                ) : null}
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1 py-2">
            {installEvents.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No installation events recorded for this subtree.
              </p>
            ) : (
              installEvents.map((event) => (
                <TimelineEventRow
                  key={event.id}
                  event={event}
                  onEntitySelect={
                    event.kind === 'installation' && event.entityPk != null
                      ? handleEntitySelect
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ReplacementHistoryDialog
        open={replacementOpen}
        onOpenChange={setReplacementOpen}
        title={`Replacement History — ${nodeLabel}`}
        rows={replacementRows}
      />

      {selectedEntity ? (
        <EntityResolutionDialog
          open={Boolean(selectedEntity)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setSelectedEntity(null);
          }}
          projectId={projectId}
          entityRef={selectedEntity.ref}
          entityType={selectedEntity.type}
          entityPk={selectedEntity.pk}
          entityLabel={selectedEntity.label}
          records={records}
          matchContext={matchContext}
          subtreeByEntityId={subtreeByEntityId}
          deliveries={deliveries}
          onCompleted={() => {
            onHistoryRefresh?.();
            setSelectedEntity(null);
          }}
        />
      ) : null}
    </>
  );
}
