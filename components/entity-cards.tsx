'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowRight, Network, Pencil, Replace, UserPlus } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { resolveStatusName } from '@/lib/entity-status';
import type { Status } from '@/lib/models';
import Link from 'next/link';
import { ConfirmDialog } from './confirm-dialog';
import { EntityStatusHistorySheet } from './entity-status-history-sheet';
import { EntityPicture } from './entity-picture';
import type { HardwareEntityType } from '@/lib/entity-resolver';
import { useAuth } from '@/lib/auth-context';
import { RevertToInventoryButton } from '@/components/revert-to-inventory-button';
import { useDataStore } from '@/lib/data-store';
import { canManageInstall, isOwnInstall } from '@/lib/install-ownership';
import { cn } from '@/lib/utils';
import { WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { AssignDeveloperDialog } from '@/components/hierarchy/assign-developer-dialog';
import * as api from '@/lib/api';
import type { HierarchyAssignmentStatus } from '@/lib/models';

interface EntityCardsProps {
  title: string;
  description: string;
  entities: Array<{
    id: number;
    name: string;
    status_id?: number;
    status_name?: string;
    status?: { status_name: string };
    description?: string;
    picture_url?: string;
    installation_date?: string;
    part_number?: string;
    serial_number?: string;
    replacement_sequence?: number;
    is_current_install?: boolean;
    installed_by_id?: number | null;
    assigned_developer_id?: number | null;
  }>;
  statuses?: Status[];
  onAdd?: () => void;
  onEdit?: (id: number) => void;
  onReplace?: (entity: {
    id: number;
    name: string;
    part_number?: string;
    serial_number?: string;
    replacement_sequence?: number;
  }) => void;
  onDelete?: (id: number) => void;
  detailPath: (id: number) => string;
  secondaryPath?: (id: number) => string;
  secondaryButtonLabel?: string;
  addButtonLabel?: string;
  emptyMessage?: string;
  childEntityType?: HardwareEntityType;
  /** Permission code(s) required to add entities. Omit to always allow (backward compat). */
  createPermission?: string | string[];
  /** Permission code(s) required to edit entities. Omit to always allow (backward compat). */
  editPermission?: string | string[];
  /** Permission code(s) required to delete entities. Omit to always allow (backward compat). */
  deletePermission?: string | string[];
  /** Hide add/edit/delete/assign/revert — cancelled projects stay view-only. */
  readOnly?: boolean;
}

export function EntityCards({
  title,
  description,
  entities,
  onAdd,
  onEdit,
  onReplace,
  onDelete,
  detailPath,
  secondaryPath,
  secondaryButtonLabel = 'Hierarchy',
  addButtonLabel = 'Add New',
  emptyMessage = 'No entities found',
  statuses = [],
  childEntityType,
  createPermission,
  editPermission,
  deletePermission,
  readOnly = false,
}: EntityCardsProps) {
  const { can, user, isInventoryManager } = useAuth();
  const { ensureHierarchyLoaded, markLocalInstallReverted, users, patchHierarchyEntity } =
    useDataStore();
  const inventoryManager = isInventoryManager();
  const canCreate = !createPermission || can(createPermission);
  const canEditPerm = !editPermission || can(editPermission);
  const canDeletePerm = !deletePermission || can(deletePermission);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [assignTarget, setAssignTarget] = useState<{
    id: number;
    name: string;
    developerId?: number | null;
    issued: boolean;
  } | null>(null);
  const [assignmentById, setAssignmentById] = useState<Record<number, HierarchyAssignmentStatus>>(
    {}
  );

  const entityStatusKey = entities
    .map((entity) => `${entity.id}:${entity.assigned_developer_id ?? ''}`)
    .join(',');

  useEffect(() => {
    if (!childEntityType || !entityStatusKey) {
      setAssignmentById({});
      return;
    }
    const ids = entityStatusKey
      .split(',')
      .map((part) => Number(part.split(':')[0]))
      .filter((id) => Number.isFinite(id) && id > 0);
    let cancelled = false;
    api.hierarchyWorkflow
      .assignmentStatus(childEntityType, ids)
      .then((res) => {
        if (cancelled) return;
        const next: Record<number, HierarchyAssignmentStatus> = {};
        for (const row of res.data ?? []) {
          next[row.id] = row;
        }
        setAssignmentById(next);
      })
      .catch(() => {
        if (!cancelled) setAssignmentById({});
      });
    return () => {
      cancelled = true;
    };
  }, [childEntityType, entityStatusKey]);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {onAdd && canCreate && !readOnly ? (
          <Button onClick={onAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            {addButtonLabel}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map((entity) => {
              const statusLabel = resolveStatusName(entity, statuses);
              const assignment = assignmentById[entity.id];
              const assignedId =
                assignment?.assigned_developer_id ?? entity.assigned_developer_id ?? null;
              const issued = Boolean(assignment?.issued);
              const showAssigned = Boolean(assignedId) && !issued;
              const ownsInstall = canManageInstall({
                isInventoryManager: inventoryManager,
                currentUserId: user?.id,
                installedById: entity.installed_by_id,
              });
              const mine = isOwnInstall({
                currentUserId: user?.id,
                installedById: entity.installed_by_id,
              });
              const canEdit = canEditPerm && ownsInstall;
              const canDelete = canDeletePerm && ownsInstall;
              const canRevert =
                Boolean(childEntityType) &&
                ownsInstall &&
                entity.is_current_install !== false &&
                Boolean(
                  entity.installation_date ||
                    entity.installed_by_id ||
                    entity.part_number ||
                    entity.serial_number
                );
              return (
              <Card
                key={entity.id}
                className={cn(
                  'hover:shadow-md transition-shadow',
                  !inventoryManager &&
                    mine &&
                    entity.is_current_install !== false &&
                    'border-emerald-500/70 bg-emerald-50/60 ring-1 ring-emerald-500/30 dark:bg-emerald-950/30 dark:border-emerald-500/50'
                )}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Link href={detailPath(entity.id)} className="block rounded-md transition-colors hover:bg-muted/30">
                      <div className="space-y-3 p-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{entity.name}</h3>
                            {!inventoryManager && mine && entity.is_current_install !== false ? (
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                                Installed by you
                              </p>
                            ) : null}
                            {(entity.replacement_sequence ?? 0) > 0 ? (
                              <p className="text-xs font-medium text-primary mt-0.5">
                                Current install · replacement #{entity.replacement_sequence}
                              </p>
                            ) : null}
                            {entity.serial_number?.trim() ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Serial # {entity.serial_number}
                              </p>
                            ) : null}
                            {entity.description && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {entity.description}
                              </p>
                            )}
                            {entity.installation_date ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Installed {new Date(entity.installation_date).toLocaleDateString()}
                              </p>
                            ) : null}
                          </div>
                          {entity.picture_url ? (
                            <EntityPicture
                              src={entity.picture_url}
                              ownerType={childEntityType}
                              ownerId={entity.id}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded border object-cover"
                            />
                          ) : null}
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                            {showAssigned ? <StatusBadge status="Assigned" /> : null}
                            {assignment?.item_status ? (
                              <StatusBadge status={assignment.item_status} />
                            ) : issued && !['ISSUED', 'Issued'].includes(statusLabel) ? (
                              <StatusBadge status="ISSUED" />
                            ) : null}
                            {assignment?.defect_pending ? (
                              <StatusBadge status="Failed" />
                            ) : null}
                            {statusLabel !== 'Unknown' &&
                            statusLabel.toUpperCase() !== (assignment?.item_status || '').toUpperCase() ? (
                              <StatusBadge status={statusLabel} />
                            ) : null}
                            {childEntityType ? (
                              <div onClick={(event) => event.preventDefault()}>
                                <EntityStatusHistorySheet
                                  entityType={childEntityType}
                                  entityPk={entity.id}
                                  entityName={entity.name}
                                  statuses={statuses}
                                  triggerVariant="icon"
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Link>

                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2 flex-wrap">
                        <Link href={detailPath(entity.id)} className="flex-1 min-w-[5.5rem]" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="w-full gap-1.5">
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {onEdit && canEdit && !readOnly ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 min-w-[5.5rem] gap-1.5"
                            onClick={() => onEdit(entity.id)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        ) : null}
                        {onReplace && ownsInstall && !readOnly ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 min-w-22 gap-1.5"
                            onClick={() => onReplace(entity)}
                          >
                            <Replace className="h-3 w-3" />
                            Replace
                          </Button>
                        ) : null}
                        {onDelete && canDelete && !readOnly ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 min-w-[5.5rem] gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: entity.id, name: entity.name })}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
                      {!readOnly && childEntityType ? (
                        <WorkflowCan role={['HM', 'ADMIN']} permission={P.hierarchy_assign_developer}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5"
                            disabled={issued}
                            onClick={() =>
                              setAssignTarget({
                                id: entity.id,
                                name: entity.name,
                                developerId: assignedId,
                                issued,
                              })
                            }
                          >
                            <UserPlus className="h-3 w-3" />
                            {issued
                              ? 'Issued'
                              : assignedId
                                ? 'Reassign developer'
                                : 'Assign developer'}
                          </Button>
                        </WorkflowCan>
                      ) : null}
                      {!readOnly && canRevert && childEntityType ? (
                        <RevertToInventoryButton
                          entityType={childEntityType}
                          entityId={entity.id}
                          partNumber={entity.part_number}
                          serialNumber={entity.serial_number}
                          installedById={entity.installed_by_id}
                          isCurrentInstall={entity.is_current_install !== false}
                          className="w-full"
                          onReverted={() => {
                            markLocalInstallReverted(childEntityType, entity.id);
                            void ensureHierarchyLoaded({ force: true });
                          }}
                        />
                      ) : null}
                      {secondaryPath ? (
                        <Link href={secondaryPath(entity.id)} onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="w-full gap-2">
                            <Network className="h-3 w-3" />
                            {secondaryButtonLabel}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}
      </CardContent>
    </Card>

    <ConfirmDialog
      open={deleteTarget !== null}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
      title={`Delete ${deleteTarget?.name ?? 'entity'}`}
      description="This action cannot be undone."
      onConfirm={() => {
        if (deleteTarget && onDelete) {
          onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }
      }}
    />
    {!readOnly && childEntityType ? (
      <AssignDeveloperDialog
        open={assignTarget !== null}
        onOpenChange={(open) => !open && setAssignTarget(null)}
        entityType={childEntityType}
        entityId={assignTarget?.id ?? 0}
        entityName={assignTarget?.name}
        users={users}
        currentDeveloperId={assignTarget?.developerId}
        issued={assignTarget?.issued}
        onAssigned={(developerId, developerName) => {
          if (!assignTarget || !childEntityType) return;
          patchHierarchyEntity(childEntityType, assignTarget.id, {
            assigned_developer_id: developerId,
          });
          setAssignmentById((prev) => ({
            ...prev,
            [assignTarget.id]: {
              entity_type: childEntityType,
              id: assignTarget.id,
              name: assignTarget.name,
              assigned_developer_id: developerId,
              assigned_developer_name: developerName,
              issued: assignTarget.issued,
            },
          }));
        }}
      />
    ) : null}
    </>
  );
}
