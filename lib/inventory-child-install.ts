import * as api from '@/lib/api';
import {
  getChildInventoryType,
  getInventoryTypeLabel,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  installEntityFromInventory as installEntityFromInventoryStock,
  isValidEntityId,
} from '@/lib/inventory-install';
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
  serialNumber?: string;
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
  selectedInstanceId: string;
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

export function entityMatchesInstanceSerial(
  entity: { serial_number?: string; original_serial_number?: string },
  instanceSerial?: string
): boolean {
  if (!instanceSerial?.trim()) return true;
  const target = instanceSerial.trim().toLowerCase();
  const original = entity.original_serial_number?.trim().toLowerCase();
  if (original && (original === target || original.includes(target) || target.includes(original))) {
    return true;
  }
  const serial = entity.serial_number?.trim().toLowerCase();
  if (!serial) return false;
  return serial === target || serial.includes(target) || target.includes(serial);
}

function inventoryItemMatchesEntity(
  inventoryItem: Inventory,
  entity: { name?: string; part_number?: string; original_part_number?: string }
): boolean {
  const inventoryName = inventoryItem.name?.trim().toLowerCase() ?? '';
  const entityName = entity.name?.trim().toLowerCase() ?? '';
  if (inventoryName && entityName === inventoryName) return true;

  const inventoryPart = inventoryPartNumber(inventoryItem)?.trim().toLowerCase() ?? '';
  if (!inventoryPart) return false;

  const part = entity.part_number?.trim().toLowerCase() ?? '';
  const originalPart = entity.original_part_number?.trim().toLowerCase() ?? '';
  return inventoryPart === part || inventoryPart === originalPart;
}

export function resolveInventoryInstanceSerial(
  inventoryItem: Inventory,
  instanceId: number | null
): string | undefined {
  if (instanceId != null) {
    const instance = inventoryItem.instances?.find((entry) => entry.id === instanceId);
    const serial =
      instance?.original_serial_number?.trim() || instance?.serial_number?.trim();
    if (serial) return serial;
  }

  if (inventoryItem.instances?.length === 1) {
    const instance = inventoryItem.instances[0];
    return instance.original_serial_number?.trim() || instance.serial_number?.trim();
  }

  return inventoryItem.original_serial_number?.trim() || inventoryItem.serial_number?.trim();
}

function formatInstalledEntityLabel(name: string, serialNumber?: string): string {
  const serial = serialNumber?.trim();
  return serial ? `${name} (${serial})` : name;
}

export function findInstalledParentOptions(
  inventoryItem: Inventory,
  context: HierarchyContext,
  instanceSerial?: string
): InstalledParentOption[] {
  const type = inventoryItem.inventory_type as HierarchyEntityType;

  const matchInventory = <
    T extends {
      id: number;
      name: string;
      part_number?: string;
      original_part_number?: string;
      serial_number?: string;
      original_serial_number?: string;
    },
  >(
    items: T[]
  ) =>
    items
      .filter((item) => inventoryItemMatchesEntity(inventoryItem, item))
      .filter((item) => entityMatchesInstanceSerial(item, instanceSerial));

  switch (type) {
    case 'system':
      return matchInventory(context.systems).map((system) => ({
        id: system.id,
        label: formatInstalledEntityLabel(
          system.name,
          system.original_serial_number || system.serial_number
        ),
        path: systemPath(system, context.projects),
        serialNumber: system.original_serial_number || system.serial_number,
      }));
    case 'subsystem':
      return matchInventory(context.subsystems).map((subsystem) => ({
        id: subsystem.id,
        label: formatInstalledEntityLabel(
          subsystem.name,
          subsystem.original_serial_number || subsystem.serial_number
        ),
        path: subsystemPath(subsystem, context.systems, context.projects),
        serialNumber: subsystem.original_serial_number || subsystem.serial_number,
      }));
    case 'module':
      return matchInventory(context.modules).map((module) => ({
        id: module.id,
        label: formatInstalledEntityLabel(
          module.name,
          module.original_serial_number || module.serial_number
        ),
        path: modulePath(module, context.subsystems, context.systems, context.projects),
        serialNumber: module.original_serial_number || module.serial_number,
      }));
    case 'unit':
      return matchInventory(context.units).map((unit) => ({
        id: unit.id,
        label: formatInstalledEntityLabel(
          unit.name,
          unit.original_serial_number || unit.serial_number
        ),
        path: unitPath(unit, context.modules, context.subsystems, context.systems, context.projects),
        serialNumber: unit.original_serial_number || unit.serial_number,
      }));
    default:
      return [];
  }
}

export function resolveInstalledParentForInventory(
  inventoryItem: Inventory,
  context: HierarchyContext,
  instanceId: number | null
): InstalledParentOption | null {
  const instanceSerial = resolveInventoryInstanceSerial(inventoryItem, instanceId);
  const options = findInstalledParentOptions(inventoryItem, context, instanceSerial);

  if (options.length === 0) return null;

  if (inventoryItem.entity_id && isValidEntityId(inventoryItem.entity_id)) {
    const linked = options.find((option) => option.id === inventoryItem.entity_id);
    if (linked) return linked;
  }

  if (instanceSerial) {
    const normalized = instanceSerial.toLowerCase();
    const exact = options.find(
      (option) => option.serialNumber?.trim().toLowerCase() === normalized
    );
    if (exact) return exact;
  }

  return options[0];
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

export type CreateEntityByTypeFn = (
  entityType: HierarchyEntityType,
  data: Record<string, unknown>
) => Promise<{ id: number }>;

export function buildCreateEntityByType(handlers: {
  createSystem: (data: Record<string, unknown>) => Promise<{ id: number }>;
  createSubsystem: (data: Record<string, unknown>) => Promise<{ id: number }>;
  createModule: (data: Record<string, unknown>) => Promise<{ id: number }>;
  createUnit: (data: Record<string, unknown>) => Promise<{ id: number }>;
  createComponent: (data: Record<string, unknown>) => Promise<{ id: number }>;
}): CreateEntityByTypeFn {
  return (entityType, data) => {
    switch (entityType) {
      case 'system':
        return handlers.createSystem(data);
      case 'subsystem':
        return handlers.createSubsystem(data);
      case 'module':
        return handlers.createModule(data);
      case 'unit':
        return handlers.createUnit(data);
      case 'component':
        return handlers.createComponent(data);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  };
}

function pickInventoryStockForChild(
  childInventory: Inventory[],
  childType: HierarchyEntityType,
  childName: string
): Inventory | undefined {
  const options = filterInventoryForChildCategory(childInventory, childType, childName);
  return options.find((item) => item.quantity > 0);
}

/** Install configured inventory children (and their descendants) when parent is used in hierarchy. */
export async function installDefinedInventoryChildren({
  parentInventoryItem,
  parentEntityId,
  parentInstanceId,
  parentInstanceSerial,
  createEntityByType,
  inventoryUpdates,
}: {
  parentInventoryItem: Inventory;
  parentEntityId: number;
  parentInstanceId?: number | null;
  parentInstanceSerial?: string | null;
  createEntityByType: CreateEntityByTypeFn;
  inventoryUpdates?: Map<number, Inventory>;
}): Promise<number> {
  if (!isValidEntityId(parentEntityId)) {
    throw new Error('Invalid parent entity for child inventory install');
  }

  const parentType = parentInventoryItem.inventory_type as HierarchyEntityType;
  if (!canAddInventoryChildren(parentType)) return 0;

  const childType = getChildInventoryType(parentType);
  const configuredChildrenRes = await api.inventory.getChildren(parentInventoryItem.id, {
    parentInstanceId: parentInstanceId ?? undefined,
    parentInstanceSerial: parentInstanceSerial ?? undefined,
  });
  const configuredChildren = configuredChildrenRes.data ?? [];

  if (configuredChildren.length > 0) {
    const childStatusRes = await api.statuses.list(STATUS_TYPE_BY_ENTITY[childType]);
    const defaultStatus = childStatusRes.data?.[0];
    if (!defaultStatus) return 0;

    let installedCount = 0;
    let existingChildren: { name: string; serial_number?: string }[] = [];

    for (const link of configuredChildren) {
      const stockRes = await api.inventory.get(link.child_inventory_id);
      const stock = stockRes.data;
      if (!stock || stock.quantity <= 0) continue;

      const result = await installEntityFromInventory({
        inventoryItem: stock,
        instanceId: link.child_instance_id ?? undefined,
        parentEntityId,
        entityType: childType,
        existingChildren,
        defaultStatus,
        createEntity: (data) => createEntityByType(childType, data),
      });

      inventoryUpdates?.set(stock.id, result.updatedInventory);
      existingChildren = [...existingChildren, { name: stock.name }];
      installedCount += 1;

      const nestedCount = await installDefinedInventoryChildren({
        parentInventoryItem: { ...stock, ...result.updatedInventory },
        parentEntityId: result.id,
        parentInstanceId: link.child_instance_id ?? undefined,
        parentInstanceSerial: link.child_instance_serial ?? undefined,
        createEntityByType,
        inventoryUpdates,
      });
      installedCount += nestedCount;
    }

    return installedCount;
  }

  const childHierarchies = await loadAllowedChildHierarchyNames(
    parentInventoryItem.name,
    parentType
  );
  if (childHierarchies.length === 0) return 0;

  const [childInventoryRes, childStatusRes] = await Promise.all([
    api.inventory.list(0, 1000, childType),
    api.statuses.list(STATUS_TYPE_BY_ENTITY[childType]),
  ]);
  const childInventory = childInventoryRes.data ?? [];
  const defaultStatus = childStatusRes.data?.[0];
  if (!defaultStatus) return 0;

  let installedCount = 0;
  let existingChildren: { name: string; serial_number?: string }[] = [];

  for (const hierarchy of childHierarchies) {
    const stock = pickInventoryStockForChild(childInventory, childType, hierarchy.name);
    if (!stock) continue;

    const result = await installEntityFromInventory({
      inventoryItem: stock,
      parentEntityId,
      entityType: childType,
      existingChildren,
      defaultStatus,
      createEntity: (data) => createEntityByType(childType, data),
    });

    inventoryUpdates?.set(stock.id, result.updatedInventory);
    existingChildren = [...existingChildren, { name: stock.name }];
    installedCount += 1;

    const nestedCount = await installDefinedInventoryChildren({
      parentInventoryItem: { ...stock, ...result.updatedInventory },
      parentEntityId: result.id,
      parentInstanceId: undefined,
      createEntityByType,
      inventoryUpdates,
    });
    installedCount += nestedCount;
  }

  return installedCount;
}

export async function installEntityFromInventory({
  inventoryItem,
  instanceId,
  parentEntityId,
  entityType,
  existingChildren,
  defaultStatus,
  createEntity,
}: {
  inventoryItem: Inventory;
  instanceId?: number;
  parentEntityId: number;
  entityType: HierarchyEntityType;
  existingChildren: { name: string; serial_number?: string }[];
  defaultStatus: Status;
  createEntity: CreateEntityFn;
}): Promise<{ id: number; updatedInventory: Inventory }> {
  const parentField = PARENT_FK_FIELD[entityType];
  if (!parentField) {
    throw new Error(`Cannot install entity type ${entityType}`);
  }

  const result = await installEntityFromInventoryStock({
    inventoryItem,
    instanceId,
    entityType,
    parentEntityId,
    parentField,
    existingChildren,
    defaultStatus,
    createEntity,
  });

  return { id: result.entityId, updatedInventory: result.updatedInventory };
}

export async function installEntityFromInventoryWithChildren({
  inventoryItem,
  instanceId,
  parentEntityId,
  entityType,
  existingChildren,
  defaultStatus,
  createEntity,
  createEntityByType,
}: {
  inventoryItem: Inventory;
  instanceId?: number;
  parentEntityId: number;
  entityType: HierarchyEntityType;
  existingChildren: { name: string; serial_number?: string }[];
  defaultStatus: Status;
  createEntity: CreateEntityFn;
  createEntityByType: CreateEntityByTypeFn;
}): Promise<{
  id: number;
  updatedInventory: Inventory;
  childrenInstalled: number;
}> {
  const parentResult = await installEntityFromInventory({
    inventoryItem,
    instanceId,
    parentEntityId,
    entityType,
    existingChildren,
    defaultStatus,
    createEntity,
  });

  const inventoryUpdates = new Map<number, Inventory>();
  inventoryUpdates.set(inventoryItem.id, parentResult.updatedInventory);

  const childrenInstalled = await installDefinedInventoryChildren({
    parentInventoryItem: { ...inventoryItem, ...parentResult.updatedInventory },
    parentEntityId: parentResult.id,
    parentInstanceId: instanceId ?? null,
    parentInstanceSerial: resolveInventoryInstanceSerial(inventoryItem, instanceId ?? null) ?? null,
    createEntityByType,
    inventoryUpdates,
  });

  return {
    id: parentResult.id,
    updatedInventory: parentResult.updatedInventory,
    childrenInstalled,
  };
}

export function buildInitialChildSlots(
  hierarchies: Hierarchy[],
  savedLinks: Array<{
    child_category_name: string;
    child_inventory_id: number;
    child_instance_id?: number | null;
    child_instance_serial?: string | null;
  }> = []
): ChildInstallSlot[] {
  return hierarchies.map((hierarchy) => {
    const saved = savedLinks.find(
      (link) => link.child_category_name.trim().toLowerCase() === hierarchy.name.trim().toLowerCase()
    );
    return {
      hierarchyId: hierarchy.id,
      childName: hierarchy.name,
      skipped: false,
      selectedInventoryId: saved ? String(saved.child_inventory_id) : '',
      selectedInstanceId: saved?.child_instance_id ? String(saved.child_instance_id) : '',
    };
  });
}
