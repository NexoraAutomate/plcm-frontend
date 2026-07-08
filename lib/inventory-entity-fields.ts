import type { Inventory, InventoryInstance } from '@/lib/models';

/** Merge catalog row with a consumed serialized unit for entity creation. */
export function mergeInventoryWithInstance(
  item: Inventory,
  instance?: InventoryInstance | null
): Inventory {
  if (!instance) return item;
  return {
    ...item,
    serial_number: instance.serial_number ?? item.serial_number,
    configuration_item: instance.configuration_item ?? item.configuration_item,
    status_id: instance.status_id ?? item.status_id,
    picture_url: instance.picture_url ?? item.picture_url,
    installation_date: instance.installation_date ?? item.installation_date,
    installed_by_id: instance.installed_by_id ?? item.installed_by_id,
    original_part_number: instance.original_part_number ?? item.original_part_number,
    original_serial_number: instance.original_serial_number ?? item.original_serial_number,
  };
}

export function inventoryPartNumber(item: Inventory): string {
  return item.part_number?.trim() || '';
}

export const emptyInventoryEntityForm = {
  name: '',
  inventory_type: 'component',
  serial_number: '',
  quantity: 0,
  description: '',
  oem_name: '',
  part_number: '',
  configuration_item: '',
  status_id: '',
  sku: '',
  location: '',
  holder_user_id: '',
  added_date: '',
  shelf_life_expires_at: '',
  picture_url: '',
  installation_date: '',
  installed_by_id: '',
  original_part_number: '',
  original_serial_number: '',
};

export function inventoryGroupFieldsFromForm(
  formData: typeof emptyInventoryEntityForm,
  selectedEntityType: string,
  removePicture: boolean
) {
  const partNumber = formData.part_number.trim();
  return {
    name: formData.name,
    inventory_type: selectedEntityType,
    description: formData.description,
    oem_name: formData.oem_name,
    part_number: partNumber,
    configuration_item: formData.configuration_item || partNumber || formData.name,
    status_id: formData.status_id ? Number(formData.status_id) : undefined,
    sku: selectedEntityType === 'component' ? formData.sku || undefined : undefined,
    installation_date: formData.installation_date
      ? new Date(formData.installation_date).toISOString()
      : undefined,
    installed_by_id: formData.installed_by_id ? Number(formData.installed_by_id) : undefined,
    original_part_number: formData.original_part_number || undefined,
    original_serial_number: formData.original_serial_number || undefined,
    ...(selectedEntityType === 'component'
      ? {
          serial_number: formData.serial_number,
          quantity: formData.quantity,
          location: formData.location,
          holder_user_id: formData.holder_user_id ? Number(formData.holder_user_id) : undefined,
          added_date: formData.added_date
            ? new Date(formData.added_date).toISOString()
            : undefined,
          shelf_life_expires_at: formData.shelf_life_expires_at
            ? new Date(formData.shelf_life_expires_at).toISOString()
            : undefined,
          picture_url: removePicture ? undefined : formData.picture_url || undefined,
        }
      : {}),
  };
}

export function inventoryInstanceFieldsFromForm(
  formData: typeof emptyInventoryEntityForm,
  removePicture: boolean
) {
  const partNumber = formData.part_number.trim();
  return {
    serial_number: formData.serial_number,
    configuration_item: formData.configuration_item || partNumber || undefined,
    status_id: formData.status_id ? Number(formData.status_id) : undefined,
    location: formData.location,
    holder_user_id: formData.holder_user_id ? Number(formData.holder_user_id) : undefined,
    added_date: formData.added_date ? new Date(formData.added_date).toISOString() : undefined,
    shelf_life_expires_at: formData.shelf_life_expires_at
      ? new Date(formData.shelf_life_expires_at).toISOString()
      : undefined,
    picture_url: removePicture ? undefined : formData.picture_url || undefined,
    installation_date: formData.installation_date
      ? new Date(formData.installation_date).toISOString()
      : undefined,
    installed_by_id: formData.installed_by_id ? Number(formData.installed_by_id) : undefined,
    original_part_number: formData.original_part_number || undefined,
    original_serial_number: formData.original_serial_number || undefined,
  };
}

export function inventoryFormFromItem(item: Inventory) {
  return {
    name: item.name || '',
    inventory_type: item.inventory_type,
    serial_number: item.serial_number || '',
    quantity: item.quantity,
    description: item.description || '',
    oem_name: item.oem_name || '',
    part_number: inventoryPartNumber(item),
    configuration_item: item.configuration_item || '',
    status_id: item.status_id ? String(item.status_id) : '',
    sku: item.sku || '',
    location: item.location || '',
    holder_user_id: item.holder_user_id ? String(item.holder_user_id) : '',
    added_date: item.added_date ? item.added_date.slice(0, 10) : '',
    shelf_life_expires_at: item.shelf_life_expires_at
      ? item.shelf_life_expires_at.slice(0, 10)
      : '',
    picture_url: item.picture_url || '',
    installation_date: item.installation_date ? item.installation_date.slice(0, 10) : '',
    installed_by_id: item.installed_by_id ? String(item.installed_by_id) : '',
    original_part_number: item.original_part_number || '',
    original_serial_number: item.original_serial_number || '',
  };
}

export function inventoryFormFromInstance(instance: InventoryInstance, group: Inventory) {
  return {
    ...inventoryFormFromItem(group),
    serial_number: instance.serial_number || '',
    configuration_item: instance.configuration_item || group.configuration_item || '',
    status_id: instance.status_id ? String(instance.status_id) : group.status_id ? String(group.status_id) : '',
    location: instance.location || '',
    holder_user_id: instance.holder_user_id ? String(instance.holder_user_id) : '',
    added_date: instance.added_date ? instance.added_date.slice(0, 10) : '',
    shelf_life_expires_at: instance.shelf_life_expires_at
      ? instance.shelf_life_expires_at.slice(0, 10)
      : '',
    picture_url: instance.picture_url || '',
    installation_date: instance.installation_date
      ? instance.installation_date.slice(0, 10)
      : group.installation_date
        ? group.installation_date.slice(0, 10)
        : '',
    installed_by_id: instance.installed_by_id
      ? String(instance.installed_by_id)
      : group.installed_by_id
        ? String(group.installed_by_id)
        : '',
    original_part_number: instance.original_part_number || group.original_part_number || '',
    original_serial_number: instance.original_serial_number || group.original_serial_number || '',
  };
}
