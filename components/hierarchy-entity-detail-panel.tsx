'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import { getEntityStatusName } from '@/lib/entity-status';
import { getOriginalBuildDisplayFields } from '@/lib/hierarchy-build-fields';
import type { HierarchyDossierMode } from '@/lib/hierarchy-dossier-mode';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { formatUserRef } from '@/lib/user-display';
import { useDataStore } from '@/lib/data-store';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import { WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { AssignDeveloperDialog } from '@/components/hierarchy/assign-developer-dialog';
import type {
  Component,
  Inventory,
  Module,
  Project,
  Status,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';

export interface HierarchyEntitySelection {
  entityId: number;
  type: HierarchyEntityType;
}

interface HierarchyEntityDetailPanelProps {
  selection: HierarchyEntitySelection | null;
  open: boolean;
  onClose: () => void;
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
  project?: Project;
  statuses?: Status[];
  dossierMode?: HierarchyDossierMode;
}

import { useAppDefinitions } from '@/lib/app-definitions-context';

const DETAIL_PATH: Record<HierarchyEntityType, (id: number) => string> = {
  system: (id) => `/systems/${id}`,
  subsystem: (id) => `/subsystems/${id}`,
  module: (id) => `/modules/${id}`,
  unit: (id) => `/units/${id}`,
  component: (id) => `/components/${id}`,
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;

  return (
    <div className="space-y-1 border-b border-border/60 py-3 last:border-b-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm wrap-break-words">{value}</p>
    </div>
  );
}

function findEntity(
  selection: HierarchyEntitySelection,
  systems: System[],
  subsystems: Subsystem[],
  modules: Module[],
  units: Unit[],
  components: Component[]
) {
  switch (selection.type) {
    case 'system':
      return systems.find((item) => item.id === selection.entityId);
    case 'subsystem':
      return subsystems.find((item) => item.id === selection.entityId);
    case 'module':
      return modules.find((item) => item.id === selection.entityId);
    case 'unit':
      return units.find((item) => item.id === selection.entityId);
    case 'component':
      return components.find((item) => item.id === selection.entityId);
  }
}

function findInventoryForOriginalPart(
  items: Inventory[],
  originalPartNumber?: string
): Inventory | undefined {
  if (!originalPartNumber?.trim()) return undefined;
  const normalized = originalPartNumber.trim().toLowerCase();

  return items.find((item) => {
    const candidates = [inventoryPartNumber(item), item.original_part_number]
      .filter(Boolean)
      .map((value) => value!.trim().toLowerCase());

    return candidates.includes(normalized);
  });
}

export function HierarchyEntityDetailPanel({
  selection,
  open,
  onClose,
  systems,
  subsystems,
  modules,
  units,
  components,
  project,
  statuses = [],
  dossierMode = 'bhd',
}: HierarchyEntityDetailPanelProps) {
  const { entityLabel } = useAppDefinitions();
  const { users, patchHierarchyEntity } = useDataStore();
  const { user } = useAuth();
  const [linkedInventory, setLinkedInventory] = useState<Inventory[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [assignmentIssued, setAssignmentIssued] = useState(false);

  const entity = selection
    ? findEntity(selection, systems, subsystems, modules, units, components)
    : undefined;

  const isBhdMode = dossierMode === 'bhd';
  const originalBuild = entity ? getOriginalBuildDisplayFields(entity) : null;

  const loadLinkedInventory = useCallback(async () => {
    if (!entity || !selection) {
      setLinkedInventory([]);
      return;
    }

    try {
      const res = await api.inventory.listByEntity(entity.id);
      setLinkedInventory(res.data ?? []);
    } catch {
      setLinkedInventory([]);
    }
  }, [entity, selection]);

  useEffect(() => {
    if (!open || !entity) {
      setLinkedInventory([]);
      return;
    }
    void loadLinkedInventory();
  }, [open, entity, loadLinkedInventory]);

  useEffect(() => {
    if (!open || !selection) {
      setAssignmentIssued(false);
      return;
    }
    let cancelled = false;
    api.hierarchyWorkflow
      .assignmentStatus(selection.type, [selection.entityId])
      .then((res) => {
        if (cancelled) return;
        setAssignmentIssued(Boolean(res.data?.[0]?.issued));
      })
      .catch(() => {
        if (!cancelled) setAssignmentIssued(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selection]);

  const inventoryMatch = useMemo(
    () => findInventoryForOriginalPart(linkedInventory, originalBuild?.partNumber),
    [linkedInventory, originalBuild?.partNumber]
  );

  const statusName = entity ? getEntityStatusName(entity, statuses) : undefined;
  const installerLabel = useMemo(() => {
    if (!entity?.installed_by_id) return undefined;
    const found = users.find((item) => item.id === entity.installed_by_id);
    return found ? formatUserRef(found) : `User #${entity.installed_by_id}`;
  }, [entity?.installed_by_id, users]);

  const developerLabel = useMemo(() => {
    if (!entity?.assigned_developer_id) return undefined;
    const found = users.find((item) => item.id === entity.assigned_developer_id);
    return found ? formatUserRef(found) : `User #${entity.assigned_developer_id}`;
  }, [entity?.assigned_developer_id, users]);

  async function handleRequestItem() {
    if (!selection) return;
    setRequesting(true);
    try {
      await api.inventory.createItemRequest({
        entity_type: selection.type,
        entity_id: selection.entityId,
      });
      toast.success('Item requested from Inventory Manager');
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Request failed';
      toast.error(typeof detail === 'string' ? detail : 'Request failed');
    } finally {
      setRequesting(false);
    }
  }

  const typeLabel = selection ? entityLabel(selection.type) : '';
  const detailPath = selection ? DETAIL_PATH[selection.type](selection.entityId) : '';

  return (
    <div
      className={cn(
        'h-full shrink-0 overflow-hidden border-l bg-background transition-[width] duration-300 ease-in-out',
        open ? 'w-[380px]' : 'w-0'
      )}
    >
      <div className="flex h-full w-[380px] flex-col">
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {typeLabel}
              </p>
              {isBhdMode ? (
                <Badge variant="outline" className="text-[10px]">
                  Original Build
                </Badge>
              ) : null}
            </div>
            <h2 className="truncate text-lg font-semibold">
              {entity && 'name' in entity ? entity.name : 'Details'}
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {!selection || !entity ? (
            <p className="py-6 text-sm text-muted-foreground">
              Select a node to view its details.
            </p>
          ) : isBhdMode ? (
            <div className="py-2">
              {statusName ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {entity.assigned_developer_id && !assignmentIssued ? (
                    <StatusBadge status="Assigned" />
                  ) : null}
                  {assignmentIssued && statusName.toUpperCase() !== 'ISSUED' ? (
                    <StatusBadge status="ISSUED" />
                  ) : null}
                  <StatusBadge status={statusName} />
                </div>
              ) : entity.assigned_developer_id && !assignmentIssued ? (
                <div className="mb-2">
                  <StatusBadge status="Assigned" />
                </div>
              ) : null}

              <DetailRow label="Name" value={entity.name} />
              <DetailRow label="Description" value={entity.description} />
              <DetailRow label="Original Part Number" value={originalBuild?.partNumber} />
              <DetailRow label="Original Serial Number" value={originalBuild?.serialNumber} />
              <DetailRow
                label="Configuration Item"
                value={originalBuild?.configurationItem}
              />
              <DetailRow
                label="OEM"
                value={inventoryMatch?.oem_name}
              />
              <DetailRow label="Location" value={inventoryMatch?.location} />
              {'sku' in entity && entity.sku ? (
                <DetailRow label="SKU" value={entity.sku} />
              ) : inventoryMatch?.sku ? (
                <DetailRow label="SKU" value={inventoryMatch.sku} />
              ) : null}
              {entity.installation_date ? (
                <DetailRow
                  label="Installation Date"
                  value={new Date(entity.installation_date).toLocaleDateString()}
                />
              ) : null}
              <DetailRow label="Installed By" value={installerLabel} />
              {selection.type === 'system' && project ? (
                <DetailRow label="Project" value={project.name} />
              ) : null}
              <DetailRow label="Assigned developer" value={developerLabel} />
              <DetailRow
                label="Created"
                value={entity.created_at ? new Date(entity.created_at).toLocaleString() : undefined}
              />
            </div>
          ) : (
            <div className="py-2">
              {statusName ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {entity.assigned_developer_id && !assignmentIssued ? (
                    <StatusBadge status="Assigned" />
                  ) : null}
                  {assignmentIssued && statusName.toUpperCase() !== 'ISSUED' ? (
                    <StatusBadge status="ISSUED" />
                  ) : null}
                  <StatusBadge status={statusName} />
                </div>
              ) : entity.assigned_developer_id && !assignmentIssued ? (
                <div className="mb-2">
                  <StatusBadge status="Assigned" />
                </div>
              ) : null}

              <DetailRow label="Name" value={entity.name} />
              <DetailRow label="Description" value={entity.description} />
              <DetailRow label="Part Number" value={entity.part_number} />
              <DetailRow label="Serial Number" value={entity.serial_number} />
              <DetailRow label="Configuration Item" value={entity.configuration_item} />
              {entity.installation_date ? (
                <DetailRow
                  label="Installation Date"
                  value={new Date(entity.installation_date).toLocaleDateString()}
                />
              ) : null}
              {'original_part_number' in entity && entity.original_part_number ? (
                <DetailRow label="Original Part #" value={entity.original_part_number} />
              ) : null}
              {'original_serial_number' in entity && entity.original_serial_number ? (
                <DetailRow label="Original Serial #" value={entity.original_serial_number} />
              ) : null}
              {selection.type === 'system' && project ? (
                <DetailRow label="Project" value={project.name} />
              ) : null}
              <DetailRow label="Assigned developer" value={developerLabel} />
              <DetailRow
                label="Created"
                value={entity.created_at ? new Date(entity.created_at).toLocaleString() : undefined}
              />
            </div>
          )}
        </div>

        {selection && entity ? (
          <div className="space-y-2 border-t p-4">
            <WorkflowCan role={['HM', 'ADMIN']} permission={P.hierarchy_assign_developer}>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => setAssignOpen(true)}
                disabled={assignmentIssued}
              >
                {assignmentIssued
                  ? 'Issued — assignment locked'
                  : entity.assigned_developer_id
                    ? 'Reassign developer'
                    : 'Assign developer'}
              </Button>
            </WorkflowCan>
            <WorkflowCan role="DEV" permission={P.item_request}>
              {entity.assigned_developer_id && entity.assigned_developer_id === user?.id ? (
                <Button
                  className="w-full"
                  onClick={() => void handleRequestItem()}
                  disabled={requesting}
                >
                  {requesting ? 'Requesting…' : 'Request item'}
                </Button>
              ) : null}
            </WorkflowCan>
            <Link href={detailPath}>
              <Button variant="outline" className="w-full gap-2">
                Open full page
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <AssignDeveloperDialog
              open={assignOpen}
              onOpenChange={setAssignOpen}
              entityType={selection.type}
              entityId={selection.entityId}
              entityName={'name' in entity ? entity.name : null}
              users={users}
              currentDeveloperId={entity.assigned_developer_id}
              issued={assignmentIssued}
              onAssigned={(developerId) => {
                patchHierarchyEntity(selection.type, selection.entityId, {
                  assigned_developer_id: developerId,
                });
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
