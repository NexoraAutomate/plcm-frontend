import type { User, HierarchyInstallFields, Inventory } from '@/lib/models';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';

/** Part/serial + install metadata when creating hierarchy rows from inventory. */
export function inventoryToHierarchyCreatePayload(item: Inventory, serialNumber: string) {
  const partNumber = inventoryPartNumber(item);
  return {
    part_number: partNumber,
    serial_number: serialNumber,
    configuration_item: item.configuration_item || partNumber || item.name,
    original_part_number: item.original_part_number || partNumber,
    original_serial_number: item.original_serial_number || serialNumber,
    installation_date: item.installation_date || new Date().toISOString(),
    installed_by_id: item.installed_by_id,
    ...(item.status_id != null ? { status_id: item.status_id } : {}),
    picture_url: item.picture_url,
    ...(item.inventory_type === 'component' && item.sku ? { sku: item.sku } : {}),
  };
}

export interface HierarchyInstallFieldOptions {
  users: User[];
}

export function parseHierarchyInstallPayload(
  data: Record<string, unknown>
): Partial<HierarchyInstallFields> {
  const installedByRaw = data.installed_by_id;
  const installedById =
    installedByRaw === '' || installedByRaw == null
      ? undefined
      : Number(installedByRaw);

  return {
    installation_date: data.installation_date
      ? new Date(String(data.installation_date)).toISOString()
      : undefined,
    installed_by_id: Number.isFinite(installedById) ? installedById : undefined,
    picture_url: data.remove_picture === true ? null : String(data.picture_url || '') || undefined,
  };
}

export function toDateInputValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function hierarchyInstallInitialValues(entity: HierarchyInstallFields) {
  return {
    installation_date: toDateInputValue(entity.installation_date),
    installed_by_id: entity.installed_by_id ?? '',
    picture_url: entity.picture_url ?? '',
    picture_file: null,
    remove_picture: false,
  };
}

export function hierarchyInstallFormFields({
  users,
  ownerType,
  ownerId,
}: HierarchyInstallFieldOptions & { ownerType?: string; ownerId?: number }) {
  return [
    {
      name: 'installation_date',
      label: 'Installation Date',
      type: 'date' as const,
      required: false,
    },
    {
      name: 'installed_by_id',
      label: 'Installed By',
      type: 'select' as const,
      required: false,
      options: users.map((user) => ({
        label: user.full_name || user.username,
        value: user.id,
      })),
    },
    {
      name: 'picture_url',
      label: 'Picture',
      type: 'picture' as const,
      required: false,
      placeholder: 'Path or URL to entity photo',
      ownerType,
      ownerId,
    },
  ];
}

export function inventoryExtendedFormFields({ users }: HierarchyInstallFieldOptions) {
  return [
    {
      name: 'holder_user_id',
      label: 'Inventory Holder',
      type: 'select' as const,
      required: false,
      options: users.map((user) => ({
        label: user.full_name || user.username,
        value: user.id,
      })),
    },
    {
      name: 'added_date',
      label: 'Added Date',
      type: 'date' as const,
      required: false,
    },
    {
      name: 'shelf_life_expires_at',
      label: 'Shelf Life Expires',
      type: 'date' as const,
      required: false,
    },
    {
      name: 'picture_url',
      label: 'Picture',
      type: 'picture' as const,
      required: false,
      placeholder: 'Path or URL to item photo',
    },
  ];
}
