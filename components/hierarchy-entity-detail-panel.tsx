'use client';

import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import { getEntityStatusName } from '@/lib/entity-status';
import type {
  Component,
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
}

const TYPE_LABELS: Record<HierarchyEntityType, string> = {
  system: 'System',
  subsystem: 'Subsystem',
  module: 'Module',
  unit: 'Unit',
  component: 'Component',
};

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
}: HierarchyEntityDetailPanelProps) {
  const entity = selection
    ? findEntity(selection, systems, subsystems, modules, units, components)
    : undefined;

  const statusName = entity ? getEntityStatusName(entity, statuses) : undefined;

  const typeLabel = selection ? TYPE_LABELS[selection.type] : '';
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {typeLabel}
            </p>
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
          ) : (
            <div className="py-2">
              {statusName ? (
                <div className="mb-2">
                  <StatusBadge status={statusName} />
                </div>
              ) : null}

              <DetailRow label="Name" value={entity.name} />
              <DetailRow label="Description" value={entity.description} />
              <DetailRow label="Part Number" value={entity.part_number} />
              <DetailRow label="Serial Number" value={entity.serial_number} />
              <DetailRow label="Configuration Item" value={entity.configuration_item} />
              {'installation_date' in entity && entity.installation_date ? (
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
              <DetailRow
                label="Created"
                value={entity.created_at ? new Date(entity.created_at).toLocaleString() : undefined}
              />
            </div>
          )}
        </div>

        {selection && entity ? (
          <div className="border-t p-4">
            <Link href={detailPath}>
              <Button variant="outline" className="w-full gap-2">
                Open full page
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
