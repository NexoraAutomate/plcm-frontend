'use client';

import React, { useMemo } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActionOutcomeBadge } from '@/components/maintenance/badges';
import { getActionTypeMeta } from '@/lib/maintenance-workflow';
import type { FaultyEntity, MaintenanceAction } from '@/lib/models';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { sortRowsByState } from '@/lib/sorting';

interface MaintenanceActionTableProps {
  actions: MaintenanceAction[];
  entities?: FaultyEntity[];
  onEdit?: (action: MaintenanceAction) => void;
  onDelete?: (action: MaintenanceAction) => void;
  isLoading?: boolean;
}

function entityLabelForAction(action: MaintenanceAction, entities: FaultyEntity[]) {
  const entity = entities.find((item) => item.id === action.faulty_entity_id);
  return (
    entity?.entity_name ||
    entity?.part_number ||
    (entity ? `${entity.entity_type} ${entity.entity_id}` : `Entity #${action.faulty_entity_id}`)
  );
}

export function MaintenanceActionTable({
  actions,
  entities = [],
  onEdit,
  onDelete,
  isLoading = false,
}: MaintenanceActionTableProps) {
  const { sort, cycleSort } = useTableSorting({
    initial: { sortBy: 'performed_at', sortOrder: 'desc' },
  });

  const sortedActions = useMemo(
    () =>
      sortRowsByState(
        actions as unknown as Record<string, unknown>[],
        sort
      ) as unknown as MaintenanceAction[],
    [actions, sort]
  );

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading maintenance actions...
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No maintenance actions found.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <SortableTableHead column="action_type" sort={sort} onSort={cycleSort}>
              Action Type
            </SortableTableHead>
            <SortableTableHead column="faulty_entity_id" sort={sort} onSort={cycleSort}>
              Entity
            </SortableTableHead>
            <SortableTableHead column="outcome" sort={sort} onSort={cycleSort}>
              Outcome
            </SortableTableHead>
            <SortableTableHead column="notes" sort={sort} onSort={cycleSort}>
              Notes
            </SortableTableHead>
            <SortableTableHead column="performed_at" sort={sort} onSort={cycleSort}>
              Performed At
            </SortableTableHead>
            <SortableTableHead column="performed_by" sort={sort} onSort={cycleSort}>
              Engineer
            </SortableTableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedActions.map((action) => (
            <TableRow key={action.id} className="hover:bg-muted/50">
              <TableCell className="text-sm">
                {getActionTypeMeta(action.action_type).label}
              </TableCell>
              <TableCell className="text-sm">
                {entityLabelForAction(action, entities)}
              </TableCell>
              <TableCell>
                <ActionOutcomeBadge outcome={action.outcome} />
              </TableCell>
              <TableCell className="text-sm max-w-xs truncate">
                {action.notes || '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(action.performed_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {action.performed_by ? `User ${action.performed_by}` : '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {onEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(action)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(action)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
