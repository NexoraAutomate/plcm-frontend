import * as api from '@/lib/api';
import {
  getChildInventoryType,
  getInventoryTypeLabel,
  nextSerialNumberFromInventory,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import { inventoryToHierarchyCreatePayload } from '@/lib/hierarchy-install-fields';
import { inventoryPartNumber, mergeInventoryWithInstance } from '@/lib/inventory-entity-fields';
import type {
  Component,
  Hierarchy,
  Inventory,
  Module,
  Project,
  Status,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';

export const PARENT_FK_ENTITY_TYPE: Record<
  HierarchyEntityType,
  HierarchyEntityType | 'project' | null
> = {
  system: 'project',
  subsystem: 'system',
  module: 'subsystem',
  unit: 'module',
  component: 'unit',
};

export const PARENT_FK_FIELD: Record<
  HierarchyEntityType,
  'project_id' | 'system_id' | 'subsystem_id' | 'module_id' | 'unit_id' | null
> = {
  system: 'project_id',
  subsystem: 'system_id',
  module: 'subsystem_id',
  unit: 'module_id',
  component: 'unit_id',
};

export const STATUS_TYPE_BY_ENTITY: Record<HierarchyEntityType, string> = {
  system: 'systems',
  subsystem: 'subsystems',
  module: 'modules',
  unit: 'units',
  component: 'components',
};

export interface InstalledParentOption {
  id: number;
  label: string;
  path: string;
}

export interface ParentFkTarget {
  id: number;
  label: string;
}

export interface ChildInstallSlot {
  hierarchyId: number;
  childName: string;
  skipped: boolean;
  selectedInventoryId: string;
}

interface HierarchyContext {
  projects: Project[];
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}

export function canAddInventoryChildren(type: string): boolean {
  return type !== 'component';
}

export async function loadAllowedChildHierarchyNames(
  parentInventoryName: string,
  parentInventoryType: HierarchyEntityType
): Promise<Hierarchy[]> {
  if (parentInventoryType === 'component') return [];

  const childType = getChildInventoryType(parentInventoryType);
  const parentHierarchies = await api.hierarchies.list(parentInventoryType);
  const parentHierarchyId = parentHierarchies.data?.find(
    (hierarchy) => hierarchy.name === parentInventoryName
  )?.id;

  if (!parentHierarchyId) return [];

  const childRes = await api.hierarchies.list(childType, parentHierarchyId);
  return childRes.data ?? [];
}

export function filterInventoryForChildCategory(
  items: Inventory[],
  childType: HierarchyEntityType,
  childName: string
): Inventory[] {
  const normalized = childName.trim().toLowerCase();
  return items.filter(
    (item) =>
      item.inventory_type === childType &&
      item.name?.trim().toLowerCase() === normalized &&
      item.quantity > 0
  );
}

function systemPath(system: System, projects: Project[]): string {
  const project = projects.find((entry) => entry.id === system.project_id);
  return project ? `Project: ${project.name}` : `System #${system.id}`;
}

function subsystemPath(subsystem: Subsystem, systems: System[], projects: Project[]): string {
  const system = systems.find((entry) => entry.id === subsystem.system_id);
  if (!system) return `Subsystem #${subsystem.id}`;
  return `${systemPath(system, projects)} → ${system.name}`;
}

function modulePath(
  module: Module,
  subsystems: Subsystem[],
  systems: System[],
  projects: Project[]
): string {
  const subsystem = subsystems.find((entry) => entry.id === module.subsystem_id);
  if (!subsystem) return `Module #${module.id}`;
  return `${subsystemPath(subsystem, systems, projects)} → ${subsystem.name}`;
}

function unitPath(
  unit: Unit,
  modules: Module[],
  subsystems: Subsystem[],
  systems: System[],
  projects: Project[]
): string {
  const module = modules.find((entry) => entry.id === unit.module_id);
  if (!module) return `Unit #${unit.id}`;
  return `${modulePath(module, subsystems, systems, projects)} → ${module.name}`;
}

export function findInstalledParentOptions(
  inventoryItem: Inventory,
  context: HierarchyContext
): InstalledParentOption[] {
  const type = inventoryItem.inventory_type as HierarchyEntityType;
  const name = inventoryItem.name?.trim().toLowerCase() ?? '';

  const matchName = <T extends { id: number; name: string }>(items: T[]) =>
    items
      .filter((item) => item.name?.trim().toLowerCase() === name)
      .map((item) => item);

  switch (type) {
    case 'system':
      return matchName(context.systems).map((system) => ({
        id: system.id,
        label: system.name,
        path: systemPath(system, context.projects),
      }));
    case 'subsystem':
      return matchName(context.subsystems).map((subsystem) => ({
        id: subsystem.id,
        label: subsystem.name,
        path: subsystemPath(subsystem, context.systems, context.projects),
      }));
    case 'module':
      return matchName(context.modules).map((module) => ({
        id: module.id,
        label: module.name,
        path: modulePath(module, context.subsystems, context.systems, context.projects),
      }));
    case 'unit':
      return matchName(context.units).map((unit) => ({
        id: unit.id,
        label: unit.name,
        path: unitPath(unit, context.modules, context.subsystems, context.systems, context.projects),
      }));
    default:
      return [];
  }
}

export function listParentFkTargets(
  entityType: HierarchyEntityType,
  context: HierarchyContext
): ParentFkTarget[] {
  switch (entityType) {
    case 'system':
      return context.projects.map((project) => ({
        id: project.id,
        label: project.name,
      }));
    case 'subsystem':
      return context.systems.map((system) => ({
        id: system.id,
        label: `${system.name} (${systemPath(system, context.projects)})`,
      }));
    case 'module':
      return context.subsystems.map((subsystem) => ({
        id: subsystem.id,
        label: `${subsystem.name} (${subsystemPath(subsystem, context.systems, context.projects)})`,
      }));
    case 'unit':
      return context.modules.map((module) => ({
        id: module.id,
        label: `${module.name} (${modulePath(module, context.subsystems, context.systems, context.projects)})`,
      }));
    case 'component':
      return context.units.map((unit) => ({
        id: unit.id,
        label: `${unit.name} (${unitPath(unit, context.modules, context.subsystems, context.systems, context.projects)})`,
      }));
    default:
      return [];
  }
}

export function childTypeLabel(parentType: HierarchyEntityType): string {
  if (parentType === 'component') return '';
  return getInventoryTypeLabel(getChildInventoryType(parentType));
}

export function inventoryStockLabel(item: Inventory): string {
  const part = inventoryPartNumber(item);
  const serial = item.serial_number?.trim();
  const bits = [part, serial, `qty ${item.quantity}`].filter(Boolean);
  return bits.join(' · ');
}

type CreateEntityFn = (data: Record<string, unknown>) => Promise<{ id: number }>;

export async function installEntityFromInventory({
  inventoryItem,
  parentEntityId,
  entityType,
  existingChildren,
  defaultStatus,
  createEntity,
}: {
  inventoryItem: Inventory;
  parentEntityId: number;
  entityType: HierarchyEntityType;
  existingChildren: { name: string }[];
  defaultStatus: Status;
  createEntity: CreateEntityFn;
}): Promise<{ id: number }> {
  const consumeRes = await api.inventory.consume(inventoryItem.id);
  const merged = mergeInventoryWithInstance(
    { ...inventoryItem, ...consumeRes.data?.inventory },
    consumeRes.data?.consumed_instance
  );

  const parentField = PARENT_FK_FIELD[entityType];
  if (!parentField) {
    throw new Error(`Cannot install entity type ${entityType}`);
  }

  const created = await createEntity({
    name: merged.name,
    description: merged.description || '',
    status_id: defaultStatus.id,
    ...inventoryToHierarchyCreatePayload(
      merged,
      nextSerialNumberFromInventory(merged, existingChildren)
    ),
    [parentField]: parentEntityId,
  });

  return created;
}

export function buildInitialChildSlots(hierarchies: Hierarchy[]): ChildInstallSlot[] {
  return hierarchies.map((hierarchy) => ({
    hierarchyId: hierarchy.id,
    childName: hierarchy.name,
    skipped: false,
    selectedInventoryId: '',
  }));
}
