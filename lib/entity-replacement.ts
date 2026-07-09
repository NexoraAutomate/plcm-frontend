import type { Inventory, InventoryInstance } from '@/lib/models';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { inventoryUsesInstances, type HierarchyEntityType } from '@/lib/entity-hierarchy';
import { getSelectableInstances } from '@/lib/inventory-install';

export const HARDWARE_ENTITY_DETAIL_PATH: Record<
  HierarchyEntityType,
  (id: number) => string
> = {
  system: (id) => `/systems/${id}`,
  subsystem: (id) => `/subsystems/${id}`,
  module: (id) => `/modules/${id}`,
  unit: (id) => `/units/${id}`,
  component: (id) => `/components/${id}`,
};

export interface EntityReplacementFields {
  is_current_install?: boolean;
  root_entity_id?: number | null;
  replaced_entity_id?: number | null;
  replacement_sequence?: number;
  replaced_at?: string | null;
}

export interface ReplacementStockRow {
  srNo: number;
  inventoryId: number;
  instanceId?: number;
  name: string;
  partNumber: string;
  serialNumber: string;
  configurationItem?: string;
  oemName?: string;
  location?: string;
}

export function isCurrentInstallEntity<T extends EntityReplacementFields>(entity: T): boolean {
  return entity.is_current_install !== false;
}

export type HardwareEntityWithSlot = EntityReplacementFields & {
  id: number;
  root_entity_id?: number | null;
};

export function resolveSlotRootId(entity: { id: number; root_entity_id?: number | null }): number {
  return entity.root_entity_id ?? entity.id;
}

export function filterCurrentInstallEntities<T extends HardwareEntityWithSlot>(entities: T[]): T[] {
  const current = entities.filter(isCurrentInstallEntity);
  const bySlot = new Map<number, T>();

  for (const entity of current) {
    const rootId = resolveSlotRootId(entity);
    const existing = bySlot.get(rootId);
    if (!existing) {
      bySlot.set(rootId, entity);
      continue;
    }

    const existingSeq = existing.replacement_sequence ?? 0;
    const entitySeq = entity.replacement_sequence ?? 0;
    if (entitySeq > existingSeq || (entitySeq === existingSeq && entity.id > existing.id)) {
      bySlot.set(rootId, entity);
    }
  }

  return [...bySlot.values()];
}

/** Resolve the active install for a hardware slot when the URL may reference a superseded row. */
export function resolveCurrentInstallEntity<T extends HardwareEntityWithSlot>(
  entityId: number,
  entities: T[]
): T | undefined {
  const requested = entities.find((entity) => entity.id === entityId);
  if (!requested) return undefined;

  const rootId = resolveSlotRootId(requested);
  const slotEntities = entities.filter((entity) => resolveSlotRootId(entity) === rootId);
  const currentInstalls = filterCurrentInstallEntities(slotEntities);
  if (currentInstalls.length > 0) return currentInstalls[0];

  return slotEntities.sort(
    (a, b) => (b.replacement_sequence ?? 0) - (a.replacement_sequence ?? 0)
  )[0];
}

export function instanceLabel(instance: InventoryInstance, index: number): string {
  return instance.serial_number?.trim() || `Unit ${index + 1}`;
}

export function buildReplacementStockRows(items: Inventory[]): ReplacementStockRow[] {
  const rows: ReplacementStockRow[] = [];
  let srNo = 0;

  for (const item of items) {
    const usesInstances = inventoryUsesInstances(item.inventory_type as HierarchyEntityType);
    const partNumber = inventoryPartNumber(item) || item.name || '—';

    if (!usesInstances) {
      if (item.quantity <= 0) continue;
      srNo += 1;
      rows.push({
        srNo,
        inventoryId: item.id,
        name: item.name,
        partNumber,
        serialNumber: item.serial_number?.trim() || '—',
        configurationItem: item.configuration_item,
        oemName: item.oem_name,
        location: item.location,
      });
      continue;
    }

    const instances = getSelectableInstances(item);
    if (instances.length === 0) {
      if (item.quantity <= 0) continue;
      srNo += 1;
      rows.push({
        srNo,
        inventoryId: item.id,
        name: item.name,
        partNumber,
        serialNumber: item.serial_number?.trim() || '—',
        configurationItem: item.configuration_item,
        oemName: item.oem_name,
        location: item.location,
      });
      continue;
    }

    instances.forEach((instance, index) => {
      srNo += 1;
      rows.push({
        srNo,
        inventoryId: item.id,
        instanceId: instance.id,
        name: item.name,
        partNumber: inventoryPartNumber(item) || partNumber,
        serialNumber: instanceLabel(instance, index),
        configurationItem: instance.configuration_item || item.configuration_item,
        oemName: item.oem_name,
        location: instance.location || item.location,
      });
    });
  }

  return rows;
}

export function getReplacementDateForDisplay(entity: {
  replaced_at?: string | null;
  installation_date?: string;
  replacement_sequence?: number;
}): string | undefined {
  if (entity.replaced_at) return entity.replaced_at;
  if ((entity.replacement_sequence ?? 0) > 0 && entity.installation_date) {
    return entity.installation_date;
  }
  return undefined;
}

export function resolveProjectIdForHardwareEntity(
  entityType: HierarchyEntityType,
  entityId: number,
  context: {
    systems: Array<{ id: number; project_id: number }>;
    subsystems: Array<{ id: number; system_id: number }>;
    modules: Array<{ id: number; subsystem_id: number }>;
    units: Array<{ id: number; module_id: number }>;
    components: Array<{ id: number; unit_id: number }>;
  }
): number | null {
  if (entityType === 'system') {
    return context.systems.find((item) => item.id === entityId)?.project_id ?? null;
  }

  if (entityType === 'subsystem') {
    const subsystem = context.subsystems.find((item) => item.id === entityId);
    if (!subsystem) return null;
    return resolveProjectIdForHardwareEntity('system', subsystem.system_id, context);
  }

  if (entityType === 'module') {
    const module = context.modules.find((item) => item.id === entityId);
    if (!module) return null;
    return resolveProjectIdForHardwareEntity('subsystem', module.subsystem_id, context);
  }

  if (entityType === 'unit') {
    const unit = context.units.find((item) => item.id === entityId);
    if (!unit) return null;
    return resolveProjectIdForHardwareEntity('module', unit.module_id, context);
  }

  const component = context.components.find((item) => item.id === entityId);
  if (!component) return null;
  return resolveProjectIdForHardwareEntity('unit', component.unit_id, context);
}
