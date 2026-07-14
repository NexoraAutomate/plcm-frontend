import * as api from '@/lib/api';
import {
  canAddInventoryChildren,
  resolveInventoryInstanceSerial,
} from '@/lib/inventory-child-install';
import {
  inventoryPartNumber,
  mergeInventoryWithInstance,
} from '@/lib/inventory-entity-fields';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import type { Inventory, InventoryChildLink, InventoryInstance } from '@/lib/models';
import {
  hierarchyTreeToFlow,
  mapEntityFields,
  type HierarchyTreeNode,
} from '@/lib/system-hierarchy-graph';

function resolveInstance(
  item: Inventory,
  instanceId?: number | null,
  instanceSerial?: string | null
): InventoryInstance | null {
  const instances = item.instances ?? [];
  if (instanceId != null) {
    return instances.find((entry) => entry.id === instanceId) ?? null;
  }
  const normalized = instanceSerial?.trim().toLowerCase();
  if (normalized) {
    return (
      instances.find((entry) => {
        const serial =
          entry.original_serial_number?.trim().toLowerCase() ||
          entry.serial_number?.trim().toLowerCase();
        return serial === normalized;
      }) ?? null
    );
  }
  if (instances.length === 1) return instances[0];
  return null;
}

function nodeIdFor(
  inventoryId: number,
  instanceId?: number | null,
  linkId?: number | null
): string {
  const instancePart = instanceId != null ? `i${instanceId}` : 'group';
  const linkPart = linkId != null ? `l${linkId}` : 'root';
  return `inv-${inventoryId}-${instancePart}-${linkPart}`;
}

async function loadChildSubtree(link: InventoryChildLink): Promise<HierarchyTreeNode | null> {
  let stock: Inventory;
  try {
    const stockRes = await api.inventory.get(link.child_inventory_id);
    if (!stockRes.data) return null;
    stock = stockRes.data;
  } catch {
    return null;
  }

  const childType = stock.inventory_type as HierarchyEntityType;
  const instance = resolveInstance(
    stock,
    link.child_instance_id,
    link.child_instance_serial
  );
  const merged = mergeInventoryWithInstance(stock, instance);
  if (link.child_instance_serial?.trim()) {
    merged.serial_number = link.child_instance_serial.trim();
    merged.original_serial_number =
      merged.original_serial_number || link.child_instance_serial.trim();
  }

  const fields = mapEntityFields(merged);
  const children =
    childType === 'component'
      ? []
      : await loadChildrenForInventory(stock, {
          instanceId: link.child_instance_id,
          instanceSerial: link.child_instance_serial,
        });

  return {
    id: nodeIdFor(stock.id, link.child_instance_id, link.id),
    entityId: stock.id,
    type: childType,
    name: fields.name || link.child_category_name || stock.name,
    status: fields.status,
    serialNumber: fields.serialNumber,
    partNumber: fields.partNumber || inventoryPartNumber(stock),
    configurationItem: fields.configurationItem,
    createdAt: fields.createdAt,
    description: fields.description,
    detailPath: '/inventory',
    children,
  };
}

async function loadChildrenForInventory(
  item: Inventory,
  options?: { instanceId?: number | null; instanceSerial?: string | null }
): Promise<HierarchyTreeNode[]> {
  const parentType = item.inventory_type as HierarchyEntityType;
  if (!canAddInventoryChildren(parentType)) return [];

  const instanceSerial =
    options?.instanceSerial?.trim() ||
    resolveInventoryInstanceSerial(item, options?.instanceId ?? null);

  try {
    const childrenRes = await api.inventory.getChildren(item.id, {
      parentInstanceId: options?.instanceId ?? undefined,
      parentInstanceSerial: instanceSerial,
    });
    const links = childrenRes.data ?? [];
    const childNodes = await Promise.all(links.map((link) => loadChildSubtree(link)));
    return childNodes.filter((node): node is HierarchyTreeNode => node != null);
  } catch {
    return [];
  }
}

/** Build the composed inventory tree for a stock item (and optional serial/instance). */
export async function buildInventoryHierarchyTree(
  item: Inventory,
  options?: { instanceId?: number | null }
): Promise<HierarchyTreeNode> {
  const rootType = item.inventory_type as HierarchyEntityType;
  const instance = resolveInstance(item, options?.instanceId);
  const merged = mergeInventoryWithInstance(item, instance);
  const fields = mapEntityFields(merged);
  const instanceSerial = resolveInventoryInstanceSerial(item, options?.instanceId ?? null);

  const children = await loadChildrenForInventory(item, {
    instanceId: options?.instanceId ?? instance?.id,
    instanceSerial,
  });

  return {
    id: nodeIdFor(item.id, options?.instanceId ?? instance?.id),
    entityId: item.id,
    type: rootType,
    name: fields.name || item.name,
    status: fields.status,
    serialNumber: fields.serialNumber,
    partNumber: fields.partNumber || inventoryPartNumber(item),
    configurationItem: fields.configurationItem,
    createdAt: fields.createdAt,
    description: fields.description,
    detailPath: '/inventory',
    children,
  };
}

export function inventoryHierarchyTreeToFlow(root: HierarchyTreeNode) {
  return hierarchyTreeToFlow(root);
}
