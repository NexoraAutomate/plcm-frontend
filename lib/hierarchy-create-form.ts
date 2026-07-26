import type { Inventory, InventoryInstance, Status } from '@/lib/models';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import {
  inventoryUsesInstances,
  nextSerialNumberFromInventory,
  serialNumberFromInventory,
} from '@/lib/entity-hierarchy';
import { inventoryPartNumber, mergeInventoryWithInstance } from '@/lib/inventory-entity-fields';
import { inventoryToHierarchyCreatePayload } from '@/lib/hierarchy-install-fields';
import { getSelectableInstances } from '@/lib/inventory-install';
import { isInventoryInStock } from '@/lib/inventory-filter';
import * as api from '@/lib/api';
import {
  buildInventoryAssetSources,
  copyInventoryAssetsToEntity,
  needsSerialSelection,
} from '@/lib/inventory-install';
import { installDefinedInventoryChildren } from '@/lib/inventory-child-install';
import type { CreateEntityByTypeFn } from '@/lib/inventory-child-install';

export type FormOption = { label: string; value: number | string };

export function filterInventoryForHierarchy(
  items: Inventory[],
  entityType: HierarchyEntityType,
  allowedNames: string[]
): Inventory[] {
  const allowed = new Set(
    allowedNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
  );
  if (allowed.size === 0) return [];

  return items.filter(
    (item) =>
      item.inventory_type === entityType &&
      isInventoryInStock(item) &&
      allowed.has(item.name?.trim().toLowerCase() ?? '')
  );
}

export function buildPartNumberOptions(inventoryItems: Inventory[]): FormOption[] {
  const options = new Map<string, string>();
  for (const item of inventoryItems) {
    const partNumber = inventoryPartNumber(item);
    if (!partNumber) continue;
    const qty = Number(item.available_quantity ?? item.quantity) || 0;
    const qtyLabel = qty > 1 ? ` (${qty} available)` : qty === 1 ? ' (1 available)' : '';
    const base = item.name ? `${partNumber} — ${item.name}` : partNumber;
    options.set(partNumber, `${base}${qtyLabel}`);
  }
  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

export function findInventoryByPartNumber(
  inventoryItems: Inventory[],
  partNumber: string
): Inventory | undefined {
  const normalized = partNumber.trim();
  if (!normalized) return undefined;
  return inventoryItems.find((item) => inventoryPartNumber(item) === normalized);
}

export function findInventoryByName(
  inventoryItems: Inventory[],
  name: string
): Inventory | undefined {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  return inventoryItems.find((item) => item.name?.trim().toLowerCase() === normalized);
}

export function buildSerialOptionsForPartNumber(
  inventoryItems: Inventory[],
  partNumber: string
): FormOption[] {
  const item = findInventoryByPartNumber(inventoryItems, partNumber);
  if (!item) return [];

  if (inventoryUsesInstances(item.inventory_type as HierarchyEntityType)) {
    const instances = getSelectableInstances(item);
    if (instances.length === 0) return [];
    return instances.map((instance, index) => {
      const serial =
        instance.original_serial_number?.trim() ||
        instance.serial_number?.trim() ||
        `Unit ${index + 1}`;
      const reserved =
        instance.is_reserved || instance.open_issuance_id
          ? ' (issued)'
          : '';
      return { label: `${serial}${reserved}`, value: String(instance.id) };
    });
  }

  const serial =
    item.original_serial_number?.trim() || item.serial_number?.trim();
  if (!serial) return [];
  return [{ label: serial, value: `serial:${serial}` }];
}

/** Auto-fill part # / serial when the user picks a hierarchy name. */
export function patchFormFromNameSelection(
  name: string,
  inventoryItems: Inventory[],
  current: Record<string, unknown>
): Record<string, unknown> {
  const match = findInventoryByName(inventoryItems, name);
  if (!match) {
    return { partnumber: current.partnumber ?? '', inventory_instance_id: '' };
  }

  const partNumber = inventoryPartNumber(match);
  const serialOptions = buildSerialOptionsForPartNumber(
    inventoryItems,
    partNumber
  );
  const autoSerial =
    serialOptions.length === 1 ? String(serialOptions[0].value) : '';

  return {
    partnumber: partNumber,
    inventory_instance_id: autoSerial,
  };
}

/** Reset serial when part # changes; auto-select when only one serial exists. */
export function patchFormFromPartNumberSelection(
  partNumber: string,
  inventoryItems: Inventory[]
): Record<string, unknown> {
  const serialOptions = buildSerialOptionsForPartNumber(inventoryItems, partNumber);
  return {
    inventory_instance_id:
      serialOptions.length === 1 ? String(serialOptions[0].value) : '',
  };
}

export function buildSerialNumber(name: string, partNumber: string): string {
  if (name && partNumber) return `${name}-${partNumber}`;
  return name || partNumber || '';
}

export function resolveCreateIdentity(
  formData: Record<string, unknown>,
  inventoryItems: Inventory[],
  name: string
) {
  const partNumber = String(formData.partnumber || '').trim();
  const inventoryMatch =
    findInventoryByPartNumber(inventoryItems, partNumber) ??
    findInventoryByName(inventoryItems, name);

  if (inventoryMatch) {
    const serial =
      serialNumberFromInventory(inventoryMatch) ||
      nextSerialNumberFromInventory(inventoryMatch, []);
    return {
      payload: inventoryToHierarchyCreatePayload(inventoryMatch, serial),
      inventoryMatch,
    };
  }

  return {
    payload: {
      part_number: partNumber,
      serial_number: buildSerialNumber(name, partNumber),
      configuration_item: partNumber || name,
    },
    inventoryMatch: undefined as Inventory | undefined,
  };
}

function resolveSelectedInstance(
  inventoryMatch: Inventory,
  formData: Record<string, unknown>
): { instanceId?: number; serialOverride?: string } {
  const raw = String(formData.inventory_instance_id || '').trim();
  if (!raw) {
    if (inventoryMatch.instances?.length === 1) {
      return { instanceId: inventoryMatch.instances[0].id };
    }
    return {};
  }

  if (raw.startsWith('serial:')) {
    return { serialOverride: raw.slice('serial:'.length) };
  }

  const instanceId = Number(raw);
  if (Number.isFinite(instanceId)) {
    return { instanceId };
  }

  return { serialOverride: raw };
}

/**
 * Create a hierarchy entity from the shared create form, consuming inventory
 * when a matching part # / serial was selected.
 */
export async function createHierarchyEntityFromForm(options: {
  entityType: HierarchyEntityType;
  parentId: number;
  formData: Record<string, unknown>;
  inventoryItems: Inventory[];
  createEntity: (data: Record<string, unknown>) => Promise<{ id: number }>;
  createEntityByType?: CreateEntityByTypeFn;
  extraPayload?: Record<string, unknown>;
  /** Defaults to signed-in user when installing from inventory. */
  installedById?: number | null;
}): Promise<{ id: number; inventoryConsumed: boolean; childrenInstalled: number }> {
  const {
    entityType,
    parentId,
    formData,
    inventoryItems,
    createEntity,
    createEntityByType,
    extraPayload = {},
  } = options;

  const name = String(formData.name || '');
  const resolved = resolveCreateIdentity(formData, inventoryItems, name);
  let installPayload = resolved.payload;
  const inventoryMatch = resolved.inventoryMatch;

  let consumedInstance: InventoryInstance | null = null;
  let parentInventoryAfterConsume: Inventory | null = null;
  let parentInstanceIdForChildren: number | null = null;
  let parentInstanceSerialForChildren: string | null = null;
  let linkedIssuanceId: number | null = null;
  let prefetchedChildren:
    | Awaited<ReturnType<typeof api.inventory.getChildren>>['data']
    | undefined;
  let childrenInstalled = 0;

  if (inventoryMatch) {
    const selected = resolveSelectedInstance(inventoryMatch, formData);
    if (
      needsSerialSelection(inventoryMatch) &&
      selected.instanceId == null &&
      !selected.serialOverride
    ) {
      throw new Error('Select a serial number for the chosen part number');
    }
    parentInstanceIdForChildren = selected.instanceId ?? null;

    if (selected.instanceId != null) {
      const instance = inventoryMatch.instances?.find((i) => i.id === selected.instanceId);
      parentInstanceSerialForChildren =
        instance?.original_serial_number?.trim() ||
        instance?.serial_number?.trim() ||
        null;
    } else if (selected.serialOverride) {
      parentInstanceSerialForChildren = selected.serialOverride;
    }

    try {
      const childrenRes = await api.inventory.getChildren(inventoryMatch.id, {
        parentInstanceId: parentInstanceIdForChildren ?? undefined,
        parentInstanceSerial: parentInstanceSerialForChildren ?? undefined,
      });
      prefetchedChildren = childrenRes.data ?? [];
    } catch (err) {
      console.warn('Failed to prefetch inventory children before install:', err);
    }

    const issuanceId =
      selected.instanceId != null
        ? (inventoryMatch.instances ?? []).find((i) => i.id === selected.instanceId)
            ?.open_issuance_id ?? null
        : null;

    const consumeRes = await api.inventory.consume(
      inventoryMatch.id,
      selected.instanceId,
      { issuanceId }
    );
    consumedInstance = consumeRes.data?.consumed_instance ?? null;
    parentInventoryAfterConsume = consumeRes.data?.inventory ?? inventoryMatch;
    linkedIssuanceId = consumeRes.data?.issuance?.id ?? issuanceId;

    if (!parentInstanceSerialForChildren) {
      parentInstanceSerialForChildren =
        consumedInstance?.original_serial_number?.trim() ||
        consumedInstance?.serial_number?.trim() ||
        selected.serialOverride ||
        null;
    }
    if (parentInstanceIdForChildren == null && consumedInstance?.id != null) {
      parentInstanceIdForChildren = consumedInstance.id;
    }

    const merged = mergeInventoryWithInstance(
      { ...inventoryMatch, ...parentInventoryAfterConsume },
      consumedInstance
    );

    const serialForEntity =
      parentInstanceSerialForChildren ||
      consumedInstance?.serial_number?.trim() ||
      String(
        (installPayload as { serial_number?: string }).serial_number ||
          merged.serial_number ||
          ''
      );

    installPayload = inventoryToHierarchyCreatePayload(merged, serialForEntity, {
      installedById: options.installedById,
    });
  }

  const parentFieldByType: Record<HierarchyEntityType, string> = {
    system: 'project_id',
    subsystem: 'system_id',
    module: 'subsystem_id',
    unit: 'module_id',
    component: 'unit_id',
  };

  const statusId = Number(formData.status_id ?? formData.id);
  const created = await createEntity({
    name,
    description: String(formData.description || ''),
    ...installPayload,
    // Keep form / first hierarchy status — never leave inventory status on the entity.
    status_id: Number.isFinite(statusId) && statusId > 0 ? statusId : undefined,
    installed_by_id:
      options.installedById ??
      (installPayload as { installed_by_id?: number }).installed_by_id,
    [parentFieldByType[entityType]]: parentId,
    ...extraPayload,
  });

  if (inventoryMatch && parentInventoryAfterConsume) {
    if (linkedIssuanceId) {
      try {
        await api.inventory.linkIssuanceInstall(linkedIssuanceId, entityType, created.id);
      } catch {
        // Install already succeeded; linking is best-effort for the ledger.
      }
    }

    await copyInventoryAssetsToEntity(
      entityType,
      created.id,
      buildInventoryAssetSources(inventoryMatch, consumedInstance)
    );

    if (createEntityByType) {
      childrenInstalled = await installDefinedInventoryChildren({
        parentInventoryItem: { ...inventoryMatch, ...parentInventoryAfterConsume },
        parentEntityId: created.id,
        parentInstanceId: parentInstanceIdForChildren,
        parentInstanceSerial: parentInstanceSerialForChildren,
        createEntityByType,
        prefetchedChildren,
      });
    }
  }

  return {
    id: created.id,
    inventoryConsumed: Boolean(inventoryMatch),
    childrenInstalled,
  };
}

export function buildParentField(options: {
  name: string;
  label: string;
  parentId: number;
  parentName: string;
}): {
  name: string;
  label: string;
  type: 'select';
  required: true;
  disabled: true;
  options: FormOption[];
} {
  return {
    name: options.name,
    label: options.label,
    type: 'select',
    required: true,
    disabled: true,
    options: [{ label: options.parentName, value: options.parentId }],
  };
}

export function buildPartNumberField(
  partNumberOptions: FormOption[]
): {
  name: string;
  label: string;
  type: 'select' | 'text';
  required: boolean;
  placeholder: string;
  options?: FormOption[];
} {
  if (partNumberOptions.length > 0) {
    return {
      name: 'partnumber',
      label: 'Part #',
      type: 'select',
      required: false,
      placeholder: 'Select part number from inventory',
      options: partNumberOptions,
    };
  }

  return {
    name: 'partnumber',
    label: 'Part #',
    type: 'text',
    required: false,
    placeholder: 'Enter part number',
  };
}

export function buildSerialNumberField(): {
  name: string;
  label: string;
  type: 'select';
  required: boolean;
  placeholder: string;
  getOptions: (formData: Record<string, unknown>, inventoryItems: Inventory[]) => FormOption[];
} {
  return {
    name: 'inventory_instance_id',
    label: 'Serial Number',
    type: 'select',
    required: false,
    placeholder: 'Select serial number',
    getOptions: (formData, inventoryItems) =>
      buildSerialOptionsForPartNumber(
        inventoryItems,
        String(formData.partnumber || '')
      ),
  };
}

/** Default status option helper — prefer first status if available. */
export function defaultStatusId(statuses: Status[]): number | '' {
  return statuses[0]?.id ?? '';
}
