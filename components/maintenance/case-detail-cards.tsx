'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CaseProgressStepper } from '@/components/maintenance/case-progress-stepper';
import {
  MaintenanceCaseStatusBadge,
  FaultyEntityStatusBadge,
  ResolutionTypeBadge,
  ActionOutcomeBadge,
} from '@/components/maintenance/badges';
import {
  buildEntityDisplayContexts,
  getAllowedCaseStatusTransitions,
  getCaseDisplayStatus,
  getCaseStatusMeta,
  getActionTypeMeta,
  type MaintenanceCaseWorkflowStatus,
} from '@/lib/maintenance-workflow';
import type { FaultyEntity, MaintenanceAction, MaintenanceCase } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';

interface CaseDetailCardsProps {
  maintenanceCase: MaintenanceCase;
  entities: FaultyEntity[];
  actions: MaintenanceAction[];
  onCaseStatusChange?: (status: MaintenanceCaseWorkflowStatus) => void;
  isUpdatingCase?: boolean;
}

function groupActionsByEntity(
  entities: FaultyEntity[],
  actions: MaintenanceAction[]
): Map<number, MaintenanceAction[]> {
  const map = new Map<number, MaintenanceAction[]>();
  for (const entity of entities) {
    map.set(
      entity.id,
      actions
        .filter((a) => a.faulty_entity_id === entity.id)
        .sort(
          (a, b) =>
            new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
        )
    );
  }
  return map;
}

export function CaseDetailCards({
  maintenanceCase,
  entities,
  actions,
  onCaseStatusChange,
  isUpdatingCase = false,
}: CaseDetailCardsProps) {
  const contexts = useMemo(
    () => buildEntityDisplayContexts(entities, actions),
    [entities, actions]
  );
  const displayStatus = useMemo(
    () => getCaseDisplayStatus(maintenanceCase, contexts, actions),
    [maintenanceCase, contexts, actions]
  );
  const allowedTransitions = useMemo(
    () => getAllowedCaseStatusTransitions(displayStatus),
    [displayStatus]
  );
  const actionsByEntity = useMemo(
    () => groupActionsByEntity(entities, actions),
    [entities, actions]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Case Progress</CardTitle>
            <MaintenanceCaseStatusBadge
              maintenanceCase={maintenanceCase}
              entities={entities}
              actions={actions}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CaseProgressStepper displayStatus={displayStatus} />
          {onCaseStatusChange && allowedTransitions.length > 0 ? (
            <Select
              value={displayStatus}
              onValueChange={(value) =>
                onCaseStatusChange(value as MaintenanceCaseWorkflowStatus)
              }
              disabled={isUpdatingCase}
            >
              <SelectTrigger>
                <SelectValue placeholder="Change case status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={displayStatus}>
                  {getCaseStatusMeta(displayStatus).label} (current)
                </SelectItem>
                {allowedTransitions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getCaseStatusMeta(status).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Faulty Entities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-80 overflow-y-auto">
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No faulty entities recorded.</p>
          ) : (
            entities.map((entity) => (
              <div
                key={entity.id}
                className="rounded-lg border border-border p-3 space-y-2"
              >
                <p className="text-sm font-medium">
                  {entity.entity_name || entity.part_number || `${entity.entity_type} ${entity.entity_id}`}
                </p>
                <FaultyEntityStatusBadge
                  entity={entity}
                  allEntities={entities}
                  actions={actions}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ResolutionTypeBadge resolutionType={entity.resolution_type} />
                  <span>
                    Engineer: {entity.identified_by ? `User #${entity.identified_by}` : 'Unassigned'}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Maintenance Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-h-80 overflow-y-auto">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
          ) : (
            entities.map((entity) => {
              const entityActions = actionsByEntity.get(entity.id) ?? [];
              if (entityActions.length === 0) return null;
              const label =
                entity.entity_name ||
                entity.part_number ||
                `${entity.entity_type} ${entity.entity_id}`;

              return (
                <div key={entity.id} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  {entityActions.map((action) => {
                    const meta = getActionTypeMeta(action.action_type);
                    return (
                      <div
                        key={action.id}
                        className="rounded-md border border-border bg-muted/30 p-2 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{meta.label}</span>
                          <ActionOutcomeBadge outcome={action.outcome} />
                        </div>
                        {action.notes ? (
                          <p className="text-xs text-muted-foreground">{action.notes}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {action.performed_by ? `User #${action.performed_by} · ` : ''}
                          {new Date(action.performed_at).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
