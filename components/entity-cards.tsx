'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowRight, Network, Pencil, Replace } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { resolveStatusName } from '@/lib/entity-status';
import type { Status } from '@/lib/models';
import Link from 'next/link';
import { ConfirmDialog } from './confirm-dialog';
import { EntityStatusHistorySheet } from './entity-status-history-sheet';
import { EntityPicture } from './entity-picture';
import type { HardwareEntityType } from '@/lib/entity-resolver';
import { useAuth } from '@/lib/auth-context';

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
}: EntityCardsProps) {
  const { can } = useAuth();
  const canCreate = !createPermission || can(createPermission);
  const canEdit = !editPermission || can(editPermission);
  const canDelete = !deletePermission || can(deletePermission);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {onAdd && canCreate ? (
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
              return (
              <Card key={entity.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <Link href={detailPath(entity.id)} className="block rounded-md transition-colors hover:bg-muted/30">
                      <div className="space-y-3 p-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate">{entity.name}</h3>
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
                          <div className="flex shrink-0 items-center gap-1">
                            {statusLabel !== 'Unknown' && (
                              <StatusBadge status={statusLabel} />
                            )}
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
                      <div className="flex gap-2">
                        <Link href={detailPath(entity.id)} className="flex-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="w-full gap-1.5">
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                        {onEdit && canEdit ? (
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
                        {onReplace ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => onReplace(entity)}
                          >
                            <Replace className="h-3 w-3" />
                            Replace
                          </Button>
                        ) : null}
                        {onDelete && canDelete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ id: entity.id, name: entity.name })}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
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
    </>
  );
}
