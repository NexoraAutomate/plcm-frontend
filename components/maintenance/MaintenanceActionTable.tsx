'use client';

import React from 'react';
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

  const sortedActions = [...actions].sort(
    (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Action Type</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Performed At</TableHead>
            <TableHead>Engineer</TableHead>
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
