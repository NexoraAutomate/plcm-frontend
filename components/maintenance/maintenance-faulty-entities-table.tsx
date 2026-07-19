'use client';

import { useMemo } from 'react';
import { Check, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { FaultyEntity, MaintenanceAction } from '@/lib/models';
import { FaultyEntityTreeList } from '@/components/maintenance/faulty-entity-tree-list';
import {
  FaultyEntityWorkflowStatus,
  isTerminalDisplayStatus,
  mapFaultyEntityStatusFromApi,
} from '@/lib/maintenance-workflow';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

interface MaintenanceFaultyEntitiesTableProps {
  entities: FaultyEntity[];
  actions?: MaintenanceAction[];
  selectedIds: number[];
  onToggleSelect: (entityId: number) => void;
  onToggleSelectAll: () => void;
  onView?: (entity: FaultyEntity) => void;
  onConfirmFaulty?: (entity: FaultyEntity) => void;
  onNoFaultFound?: (entity: FaultyEntity) => void;
  onResolve?: (entity: FaultyEntity) => void;
  isLoading?: boolean;
}

export function MaintenanceFaultyEntitiesTable({
  entities,
  actions = [],
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onConfirmFaulty,
  onNoFaultFound,
  onResolve,
  isLoading = false,
}: MaintenanceFaultyEntitiesTableProps) {
  const { can } = useAuth();
  const canConfirmFault = can(P.confirm_faults);
  const canResolve = can(P.edit_faulty_entities);
  const allSelected = useMemo(
    () => entities.length > 0 && selectedIds.length === entities.length,
    [entities.length, selectedIds]
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading entities...</div>;
  }

  if (!entities || entities.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No faulty entities found for this case.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
        <span className="text-sm text-muted-foreground">Select all entities</span>
      </div>

      <FaultyEntityTreeList
        entities={entities}
        actions={actions}
        emptyMessage="No faulty entities found for this case."
        renderLeading={(entity) => (
          <Checkbox
            checked={selectedIds.includes(entity.id)}
            onCheckedChange={() => onToggleSelect(entity.id)}
          />
        )}
        renderActions={(entity) => {
          const entityActions = actions.filter((a) => a.faulty_entity_id === entity.id);
          const displayStatus = mapFaultyEntityStatusFromApi(entity, entityActions);
          const isTerminal = isTerminalDisplayStatus(displayStatus);

          return (
            <>
              {onView ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(entity)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              ) : null}
              {onConfirmFaulty &&
              canConfirmFault &&
              displayStatus !== FaultyEntityWorkflowStatus.CONFIRMED_FAULTY &&
              !isTerminal ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfirmFaulty(entity)}
                  className="h-8 w-8 p-0"
                  title="Confirm fault"
                >
                  ✓
                </Button>
              ) : null}
              {onResolve && canResolve && !isTerminal ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResolve(entity)}
                  className="h-8 w-8 p-0"
                  title="Resolve"
                >
                  <Check className="h-4 w-4" />
                </Button>
              ) : null}
              {onNoFaultFound && !isTerminal ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNoFaultFound(entity)}
                  className="h-8 px-2 text-xs"
                  title="No fault found"
                >
                  NFF
                </Button>
              ) : null}
            </>
          );
        }}
      />
    </div>
  );
}
