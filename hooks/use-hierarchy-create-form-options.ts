'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '@/lib/api';
import type { Inventory } from '@/lib/models';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import type { FormField } from '@/components/entity-form';
import {
  buildParentField,
  buildPartNumberField,
  buildPartNumberOptions,
  buildSerialOptionsForPartNumber,
  filterInventoryForHierarchy,
  patchFormFromNameSelection,
  patchFormFromPartNumberSelection,
} from '@/lib/hierarchy-create-form';

interface UseHierarchyCreateFormOptions {
  entityType: HierarchyEntityType;
  entityLabel: string;
  nameOptions: Array<{ label: string; value: string }>;
  statusOptions: Array<{ label: string; value: number | string }>;
  allowedNames: string[];
  parent?: {
    fieldName: string;
    label: string;
    id: number;
    name: string;
  };
  /** Extra fields appended after status (e.g. install metadata). */
  extraFields?: FormField[];
  /** When false, inventory is not loaded (e.g. edit dialogs). Default true. */
  enabled?: boolean;
}

export function useHierarchyCreateFormOptions({
  entityType,
  entityLabel,
  nameOptions,
  statusOptions,
  allowedNames,
  parent,
  extraFields = [],
  enabled = true,
}: UseHierarchyCreateFormOptions) {
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const allowedNamesKey = allowedNames.join('\0');

  useEffect(() => {
    if (!enabled) {
      setInventoryItems([]);
      return;
    }

    const names = allowedNamesKey ? allowedNamesKey.split('\0') : [];
    let cancelled = false;

    const load = async () => {
      setLoadingInventory(true);
      try {
        const invRes = await api.inventory.list(0, 1000, entityType);
        if (cancelled) return;
        setInventoryItems(
          filterInventoryForHierarchy(invRes.data ?? [], entityType, names)
        );
      } catch (error) {
        console.error('Failed to load inventory for create form', error);
        if (!cancelled) setInventoryItems([]);
      } finally {
        if (!cancelled) setLoadingInventory(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [allowedNamesKey, enabled, entityType]);

  const partNumberOptions = useMemo(
    () => buildPartNumberOptions(inventoryItems),
    [inventoryItems]
  );

  const createFormFields = useMemo((): FormField[] => {
    const fields: FormField[] = [
      {
        name: 'name',
        label: `${entityLabel} Name`,
        type: 'select',
        required: true,
        options: nameOptions,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        required: false,
        placeholder: `Enter ${entityLabel.toLowerCase()} description`,
      },
    ];

    if (parent) {
      fields.push(
        buildParentField({
          name: parent.fieldName,
          label: parent.label,
          parentId: parent.id,
          parentName: parent.name,
        })
      );
    }

    fields.push(buildPartNumberField(partNumberOptions));

    fields.push({
      name: 'inventory_instance_id',
      label: 'Serial Number',
      type: 'select',
      required: false,
      placeholder: 'Select serial number for part #',
      getOptions: (formData) =>
        buildSerialOptionsForPartNumber(
          inventoryItems,
          String(formData.partnumber || '')
        ),
    });

    fields.push({
      name: 'id',
      label: 'Status',
      type: 'select',
      required: true,
      options: statusOptions,
    });

    fields.push(...extraFields);
    return fields;
  }, [
    entityLabel,
    extraFields,
    inventoryItems,
    nameOptions,
    parent,
    partNumberOptions,
    statusOptions,
  ]);

  const handleFieldChange = useCallback(
    (fieldName: string, value: unknown, formData: Record<string, unknown>) => {
      if (fieldName === 'name') {
        return patchFormFromNameSelection(
          String(value || ''),
          inventoryItems,
          formData
        );
      }
      if (fieldName === 'partnumber') {
        return patchFormFromPartNumberSelection(String(value || ''), inventoryItems);
      }
      return undefined;
    },
    [inventoryItems]
  );

  const createInitialValues = useMemo(() => {
    const firstStatusId = statusOptions[0]?.value;
    return {
      ...(parent ? { [parent.fieldName]: parent.id } : {}),
      ...(firstStatusId != null ? { id: firstStatusId } : {}),
    };
  }, [parent, statusOptions]);

  return {
    inventoryItems,
    loadingInventory,
    partNumberOptions,
    createFormFields,
    handleFieldChange,
    createInitialValues,
  };
}
