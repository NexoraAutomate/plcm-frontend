'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import { useDataStore } from '@/lib/data-store';
import { useHierarchiesQuery } from '@/hooks/queries';
import {
  buildInventoryCreatePayload,
  emptyInventoryEntityForm,
  inventoryPartNumber,
} from '@/lib/inventory-entity-fields';
import { toDateInputValue } from '@/lib/hierarchy-install-fields';
import {
  inventoryUsesInstances,
} from '@/lib/entity-hierarchy';
import {
  buildEntityIdentifiersFromDefinitions,
  nextInventorySequences,
  suggestAbbreviation,
} from '@/lib/app-definitions';
import {
  canSuggestInventorySerial,
  inventoryEntitiesForType,
  suggestNextInventorySerial,
} from '@/lib/inventory-serial';
import type { PendingAttachmentUpload } from '@/components/entity-attachments-section';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import type { Inventory } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';
import { validateInventoryForm } from '@/lib/form-validation';
import * as api from '@/lib/api';

export type InventoryEntityFormType = HierarchyEntityType;

export function useInventoryEntityForm(options: {
  entityType: InventoryEntityFormType;
  /** When false, entity type selector is hidden and locked to entityType. */
  allowTypeChange?: boolean;
  open?: boolean;
  context?: 'inventory' | 'hierarchy';
  initialFormData?: Partial<typeof emptyInventoryEntityForm>;
  lockEntityName?: boolean;
}) {
  const {
    entityType,
    allowTypeChange = false,
    open = true,
    context = 'inventory',
    initialFormData,
    lockEntityName = false,
  } = options;
  const { user } = useAuth();
  const { definitions, entityLabel } = useAppDefinitions();
  const { systems, subsystems, modules, units, components } = useDataStore();

  const [selectedEntityType, setSelectedEntityType] =
    useState<InventoryEntityFormType>(entityType);
  const [formData, setFormData] = useState({ ...emptyInventoryEntityForm });
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [pendingPictureFile, setPendingPictureFile] = useState<File | null>(null);
  const [pendingPictureFiles, setPendingPictureFiles] = useState<File[]>([]);
  const [removePicture, setRemovePicture] = useState(false);
  const [formTab, setFormTab] = useState('general');
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);

  const { data: entityListNames = [] } = useHierarchiesQuery(selectedEntityType);
  const inventoryHolderUserId = user?.id ? String(user.id) : '';
  const inventoryHolderLabel = user ? formatUserRef(user) : 'Inventory Manager';

  const entityPools = useMemo(
    () => ({ systems, subsystems, modules, units, components }),
    [systems, subsystems, modules, units, components]
  );

  useEffect(() => {
    if (!open) return;
    setSelectedEntityType(entityType);
  }, [entityType, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void api.inventory
      .list(0, 500, selectedEntityType)
      .then((res) => {
        if (!cancelled) setInventoryItems(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setInventoryItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedEntityType]);

  const resetForm = useCallback(() => {
    const today = toDateInputValue(new Date().toISOString());
    const merged = {
      ...emptyInventoryEntityForm,
      holder_user_id: inventoryHolderUserId,
      inventory_type: entityType,
      ...initialFormData,
    };
    if (context === 'hierarchy') {
      if (!merged.installation_date?.trim()) {
        merged.installation_date = today;
      }
      if (!merged.installed_by_id?.trim() && inventoryHolderUserId) {
        merged.installed_by_id = inventoryHolderUserId;
      }
    }
    setFormData(merged);
    setPendingAttachments([]);
    setPendingPictureFile(null);
    setPendingPictureFiles([]);
    setRemovePicture(false);
    setFormTab(context === 'hierarchy' ? 'part-number' : 'general');
    setSelectedEntityType(entityType);
  }, [context, entityType, initialFormData, inventoryHolderUserId]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const findExistingStockGroup = useCallback(
    (type: InventoryEntityFormType, name: string): Inventory | undefined => {
      const normalized = name.trim().toLowerCase();
      return inventoryItems.find(
        (item) =>
          item.inventory_type === type &&
          (item.name || '').trim().toLowerCase() === normalized
      );
    },
    [inventoryItems]
  );

  const applyDefinitionIdentifiers = useCallback(
    (
      type: InventoryEntityFormType,
      name: string,
      vendor: string,
      prev: typeof formData
    ): typeof formData => {
      if (!name.trim()) return prev;
      const entityListHit = entityListNames.find((entry) => entry.name === name);
      const existing = findExistingStockGroup(type, name);

      if (existing) {
        const partNumber = inventoryPartNumber(existing) || existing.part_number || '';
        const relatedEntities = inventoryEntitiesForType(type, entityPools);
        const serial_number = canSuggestInventorySerial(existing)
          ? suggestNextInventorySerial(existing, relatedEntities)
          : prev.serial_number;
        // Hierarchy OEM is per-entity; do not copy from unrelated stock groups that share a name.
        const oem_name =
          context === 'hierarchy'
            ? prev.oem_name
            : existing.oem_name?.trim() || prev.oem_name;
        return {
          ...prev,
          name,
          part_number: partNumber,
          serial_number,
          oem_name,
          configuration_item: existing.configuration_item || partNumber || prev.configuration_item,
          sku: type === 'component' ? existing.sku || prev.sku : prev.sku,
        };
      }

      const { pnSeq, snSeq } = nextInventorySequences(inventoryItems, type, name);
      const ids = buildEntityIdentifiersFromDefinitions(definitions, {
        name,
        level: type,
        entityAbbr: entityListHit?.abbreviation || suggestAbbreviation(name),
        vendor: vendor.trim() || prev.oem_name.trim(),
        seq: snSeq,
        pnSeq,
      });
      return {
        ...prev,
        name,
        part_number: ids.part_number,
        serial_number: ids.serial_number,
        configuration_item: ids.configuration_item || ids.part_number,
        sku: type === 'component' ? ids.sku : prev.sku,
      };
    },
    [context, definitions, entityListNames, entityPools, findExistingStockGroup, inventoryItems]
  );

  const buildInventoryPayload = useCallback(
    () => buildInventoryCreatePayload(formData, selectedEntityType, removePicture, { context }),
    [context, formData, removePicture, selectedEntityType]
  );

  const validateCreate = useCallback((): string | null => {
    return validateInventoryForm({
      name: formData.name,
      partNumber: formData.part_number,
      location: formData.location,
      quantity: formData.quantity,
      usesInstances: inventoryUsesInstances(selectedEntityType),
      supportsQuantity: true,
      isHierarchy: context === 'hierarchy',
      isComponent: selectedEntityType === 'component',
      entityCategoryLabel: entityLabel(selectedEntityType),
    });
  }, [context, entityLabel, formData, selectedEntityType]);

  return {
    allowTypeChange,
    context,
    lockEntityName,
    selectedEntityType,
    setSelectedEntityType,
    formData,
    setFormData,
    pendingAttachments,
    setPendingAttachments,
    pendingPictureFile,
    setPendingPictureFile: (file: File | null) => {
      setPendingPictureFile(file);
      setPendingPictureFiles(file ? [file] : []);
    },
    pendingPictureFiles,
    setPendingPictureFiles: (files: File[]) => {
      setPendingPictureFiles(files);
      setPendingPictureFile(files[0] ?? null);
    },
    removePicture,
    setRemovePicture,
    formTab,
    setFormTab,
    entityListNames,
    inventoryHolderLabel,
    inventoryHolderUserId,
    applyDefinitionIdentifiers,
    buildInventoryPayload,
    validateCreate,
    resetForm,
    entityLabel,
  };
}
