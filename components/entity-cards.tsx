'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Network,
  Pencil,
  Replace,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';
import { StatusBadge } from './status-badge';
import { resolveStatusName } from '@/lib/entity-status';
import type { Status } from '@/lib/models';
import Link from 'next/link';
import { EntityStatusHistorySheet } from './entity-status-history-sheet';
import { EntityPicture } from './entity-picture';
import type { HardwareEntityType } from '@/lib/entity-resolver';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { canManageInstall, isOwnInstall } from '@/lib/install-ownership';
import { cn } from '@/lib/utils';
import { WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { AssignDeveloperDialog } from '@/components/hierarchy/assign-developer-dialog';
import { RejectInstallationDialog } from '@/components/inventory/reject-installation-dialog';
import { RejectionReasonsDialog } from '@/components/inventory/rejection-reasons-dialog';
import * as api from '@/lib/api';
import type { HierarchyAssignmentStatus, ItemInstallRejection } from '@/lib/models';
import { useProjectInventoryFlags } from '@/hooks/use-project-inventory-flags';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queries/query-keys';
import { inventoryFlagKey } from '@/lib/system-hierarchy-graph';
import {
  ENTITY_LIFECYCLE_LABEL,
  entityLifecycleCardClass,
  resolveEntityLifecycleTone,
} from '@/lib/entity-lifecycle-style';
import { EntityInventoryHoldDetails } from '@/components/entity-inventory-hold-details';
import { toast } from 'sonner';

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
    picture_url?: string | null;
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
  /** Loads reserved/shortage inventory details for card PN/SN and lifecycle colors. */
  projectId?: number | null;
  /** Permission code(s) required to add entities. Omit to always allow (backward compat). */
  createPermission?: string | string[];
  /** Permission code(s) required to edit entities. Omit to always allow (backward compat). */
  editPermission?: string | string[];
  /** Permission code(s) required to delete entities. Omit to always allow (backward compat). */
  deletePermission?: string | string[];
  /** Hide add/edit/delete/assign/revert — cancelled projects stay view-only. */
  readOnly?: boolean;
  /**
   * Existing-project (Add as Existing Project) cards: Edit + Hierarchy only.
   * Generated projects show Assign Developer (or Verify Installation) + Hierarchy.
   */
  isExistingProject?: boolean;
  /** When true, show Replace (completed normal projects or existing in-service projects). */
  allowReplace?: boolean;
}

export function EntityCards({
  title,
  description,
  entities,
  onAdd,
  onEdit,
  onReplace,
  detailPath,
  secondaryPath,
  secondaryButtonLabel = 'Hierarchy',
  addButtonLabel = 'Add New',
  emptyMessage = 'No entities found',
  statuses = [],
  childEntityType,
  projectId,
  createPermission,
  editPermission,
  readOnly = false,
  isExistingProject = false,
  allowReplace = false,
}: EntityCardsProps) {
  const { can, user, isInventoryManager } = useAuth();
  const { users, patchHierarchyEntity } = useDataStore();
  const queryClient = useQueryClient();
  const inventoryFlags = useProjectInventoryFlags(projectId);
  const inventoryManager = isInventoryManager();
  const canCreate = !createPermission || can(createPermission);
  const canEditPerm = !editPermission || can(editPermission);
  const [assignTarget, setAssignTarget] = useState<{
    id: number;
    name: string;
    developerId?: number | null;
    issued: boolean;
  } | null>(null);
  const [assignmentById, setAssignmentById] = useState<Record<number, HierarchyAssignmentStatus>>(
    {}
  );
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    entityId: number;
    issuanceId: number;
    name: string;
  } | null>(null);
  const [rejectionView, setRejectionView] = useState<{
    label: string;
    history: ItemInstallRejection[];
  } | null>(null);

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

  async function handleAcceptInstallation(entityId: number, issuanceId: number) {
    if (!childEntityType) return;

    setVerifyingId(entityId);
    try {
      await api.inventory.verifyItemInstallation(issuanceId);
      toast.success('Installation accepted');
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectProgress(projectId),
        });
      }
      const res = await api.hierarchyWorkflow.assignmentStatus(childEntityType, [entityId]);
      const row = res.data?.[0];
      if (row) {
        setAssignmentById((prev) => ({ ...prev, [entityId]: row }));
      }
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not accept installation';
      toast.error(typeof detail === 'string' ? detail : 'Could not accept installation');
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleRejectInstallation(reason: string) {
    if (!childEntityType || !rejectTarget) return;
    const { entityId, issuanceId } = rejectTarget;
    setVerifyingId(entityId);
    try {
      await api.inventory.rejectItemInstallation(issuanceId, reason);
      toast.success('Installation rejected — returned to developer');
      setRejectTarget(null);
      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectProgress(projectId),
        });
      }
      const res = await api.hierarchyWorkflow.assignmentStatus(childEntityType, [entityId]);
      const row = res.data?.[0];
      if (row) {
        setAssignmentById((prev) => ({ ...prev, [entityId]: row }));
      }
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not reject installation';
      toast.error(typeof detail === 'string' ? detail : 'Could not reject installation');
    } finally {
      setVerifyingId(null);
    }
  }

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
              const flagKey = childEntityType
                ? inventoryFlagKey(childEntityType, entity.id)
                : '';
              const reservation = flagKey
                ? inventoryFlags.reservationsByKey[flagKey]
                : undefined;
              const shortage = flagKey ? inventoryFlags.shortagesByKey[flagKey] : undefined;
              const hasActiveReservation = Boolean(reservation);
              const hasShortage = Boolean(shortage);
              const tone = resolveEntityLifecycleTone({
                hasShortage,
                hasActiveReservation,
                assignedDeveloperId: assignedId,
                assignment,
                statusName: statusLabel !== 'Unknown' ? statusLabel : null,
              });
              const lifecycleLabel = ENTITY_LIFECYCLE_LABEL[tone];
              const primaryStatus = assignment?.defect_pending
                ? 'Defect / rework'
                : assignment?.item_status ||
                  (issued
                    ? 'ISSUED'
                    : lifecycleLabel || (statusLabel !== 'Unknown' ? statusLabel : null));
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
              const canVerifyItem = Boolean(
                assignment?.issuance_id &&
                  assignment.complete_reported &&
                  assignment.test_result?.toLowerCase() === 'pass' &&
                  !assignment.verified
              );
              const hasRejectionHistory =
                (assignment?.rejection_count ?? 0) > 0 ||
                (assignment?.rejection_history?.length ?? 0) > 0;
              const showOwnInstallChrome =
                tone === 'neutral' &&
                !inventoryManager &&
                mine &&
                entity.is_current_install !== false;
              return (
              <Card
                key={entity.id}
                className={cn(
                  'hover:shadow-md transition-shadow',
                  entityLifecycleCardClass(tone),
                  showOwnInstallChrome &&
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
                            {showOwnInstallChrome ? (
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                                Installed by you
                              </p>
                            ) : null}
                            {(entity.replacement_sequence ?? 0) > 0 ? (
                              <p className="text-xs font-medium text-primary mt-0.5">
                                Current install · replacement #{entity.replacement_sequence}
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
                            {reservation || shortage || tone === 'reserved' || tone === 'short' ? (
                              <EntityInventoryHoldDetails
                                tone={tone}
                                reservation={reservation}
                                shortage={shortage}
                                entity={entity}
                                compact
                              />
                            ) : entity.part_number?.trim() || entity.serial_number?.trim() ? (
                              <div className="mt-1.5 space-y-0.5">
                                {entity.part_number?.trim() ? (
                                  <p className="text-xs text-muted-foreground">
                                    Part # {entity.part_number}
                                  </p>
                                ) : null}
                                {entity.serial_number?.trim() ? (
                                  <p className="text-xs text-muted-foreground">
                                    Serial # {entity.serial_number}
                                  </p>
                                ) : null}
                              </div>
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
                            {primaryStatus ? <StatusBadge status={primaryStatus} /> : null}
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
                      {isExistingProject ? (
                        <div className="flex gap-2">
                          {onEdit && canEdit && !readOnly ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={() => onEdit(entity.id)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          ) : null}
                          {secondaryPath ? (
                            <Link
                              href={secondaryPath(entity.id)}
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="outline" size="sm" className="w-full gap-1.5">
                                <Network className="h-3 w-3" />
                                {secondaryButtonLabel}
                              </Button>
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {!isExistingProject &&
                      allowReplace &&
                      onReplace &&
                      ownsInstall &&
                      !readOnly ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => onReplace(entity)}
                        >
                          <Replace className="h-3 w-3" />
                          Replace
                        </Button>
                      ) : null}
                      {!readOnly && childEntityType && canVerifyItem && !isExistingProject ? (
                        <WorkflowCan role={['HM', 'ADMIN']} permission={P.item_verify}>
                          <div className="space-y-1.5">
                            <div className="flex gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 gap-1.5"
                                disabled={verifyingId === entity.id}
                                onClick={() =>
                                  void handleAcceptInstallation(
                                    entity.id,
                                    assignment.issuance_id as number
                                  )
                                }
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {verifyingId === entity.id ? 'Accepting…' : 'Accept'}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="flex-1"
                                disabled={verifyingId === entity.id}
                                onClick={() =>
                                  setRejectTarget({
                                    entityId: entity.id,
                                    issuanceId: assignment.issuance_id as number,
                                    name: entity.name,
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </div>
                            {hasRejectionHistory ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                disabled={verifyingId === entity.id}
                                onClick={() =>
                                  setRejectionView({
                                    label: entity.name,
                                    history: assignment?.rejection_history ?? [],
                                  })
                                }
                              >
                                Rejection Reasons
                              </Button>
                            ) : null}
                          </div>
                        </WorkflowCan>
                      ) : !readOnly &&
                        childEntityType &&
                        !isExistingProject &&
                        hasRejectionHistory ? (
                        <WorkflowCan role={['HM', 'ADMIN']} permission={P.item_verify}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() =>
                              setRejectionView({
                                label: entity.name,
                                history: assignment?.rejection_history ?? [],
                              })
                            }
                          >
                            Rejection Reasons
                          </Button>
                        </WorkflowCan>
                      ) : null}
                      {!readOnly &&
                      childEntityType &&
                      !isExistingProject &&
                      !canVerifyItem ? (
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
                      {!isExistingProject && secondaryPath ? (
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
    <RejectInstallationDialog
      open={rejectTarget != null}
      onOpenChange={(open) => {
        if (!open) setRejectTarget(null);
      }}
      itemLabel={rejectTarget?.name}
      busy={rejectTarget != null && verifyingId === rejectTarget.entityId}
      onConfirm={handleRejectInstallation}
    />
    <RejectionReasonsDialog
      open={rejectionView != null}
      onOpenChange={(open) => {
        if (!open) setRejectionView(null);
      }}
      itemLabel={rejectionView?.label}
      history={rejectionView?.history}
    />
    </>
  );
}
