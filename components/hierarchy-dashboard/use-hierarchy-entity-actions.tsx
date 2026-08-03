'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { useDataStore } from '@/lib/data-store';
import {
  CHILD_ENTITY_TYPE,
  getDashboardLevels,
  PARENT_ID_FIELD,
  resolveEntityParentIds,
  SELECTION_KEY_BY_ENTITY,
  type DashboardEntityType,
  type DashboardLevelKey,
} from '@/lib/hierarchy-dashboard-entity-config';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import {
  hierarchyInstallFormFields,
  hierarchyInstallInitialValues,
  parseHierarchyInstallPayload,
} from '@/lib/hierarchy-install-fields';
import type { HierarchyDashboardSelection } from '@/lib/project-hierarchy-dashboard';
import { syncEntityPicture } from '@/lib/entity-picture-upload';
import { needsSerialSelection } from '@/lib/inventory-install';
import { buildCreateEntityByType } from '@/lib/inventory-child-install';
import {
  buildParentField,
  buildPartNumberField,
  buildPartNumberOptions,
  buildSerialOptionsForPartNumber,
  createHierarchyEntityFromForm,
  filterInventoryForHierarchy,
  findInventoryByPartNumber,
  findInventoryByName,
  patchFormFromNameSelection,
  patchFormFromPartNumberSelection,
} from '@/lib/hierarchy-create-form';
import type { Hierarchy, Inventory, Status, System } from '@/lib/models';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EntityForm, type FormField } from '@/components/entity-form';
import { InventorySerialSelectDialog } from '@/components/inventory-serial-select-dialog';

type DialogMode = 'add-sibling' | 'add-child' | 'edit';

interface DialogState {
  mode: DialogMode;
  entityType: DashboardEntityType;
  entityId?: number;
  parentId: number;
}

export interface HierarchyEntityActionHandlers {
  onAddSibling: (entityId: number, type: HierarchyEntityType) => void;
  onAddChild: (entityId: number, type: HierarchyEntityType) => void;
  onEdit: (entityId: number, type: HierarchyEntityType) => void;
  onDelete: (entityId: number, type: HierarchyEntityType, label: string) => void;
  onAddRootSystem: (projectId: number) => void;
}

interface UseHierarchyEntityActionsOptions {
  selection: HierarchyDashboardSelection;
  onSelectionChange: (selection: HierarchyDashboardSelection) => void;
  updateSelection: (key: DashboardLevelKey, value?: number) => void;
  systemsOverride?: System[];
  onEntityChanged?: () => void | Promise<void>;
}

function formatAxiosError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg || JSON.stringify(item)).join(', ');
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

const PARENT_LEVEL: Record<DashboardEntityType, string | 'project'> = {
  system: 'project',
  subsystem: 'system',
  module: 'subsystem',
  unit: 'module',
  component: 'unit',
};

export function useHierarchyEntityActions({
  selection,
  onSelectionChange,
  updateSelection,
  systemsOverride = [],
  onEntityChanged,
}: UseHierarchyEntityActionsOptions) {
  const { entityLabel } = useAppDefinitions();
  const dashboardLevels = useMemo(() => getDashboardLevels(entityLabel), [entityLabel]);

  const parentLabelFor = useCallback(
    (type: DashboardEntityType) => {
      const parent = PARENT_LEVEL[type];
      return parent === 'project' ? 'Project' : entityLabel(parent);
    },
    [entityLabel]
  );

  const {
    systems: storeSystems,
    subsystems,
    modules,
    units,
    components,
    projects,
    users,
    createSystem,
    updateSystem,
    deleteSystem,
    createSubsystem,
    updateSubsystem,
    deleteSubsystem,
    createModule,
    updateModule,
    deleteModule,
    createUnit,
    updateUnit,
    deleteUnit,
    createComponent,
    updateComponent,
    deleteComponent,
    refreshData,
    ensureHierarchyLoaded,
    runSilentEntityBatch,
  } = useDataStore();

  const effectiveSystems = useMemo(() => {
    const merged = new Map(storeSystems.map((system) => [system.id, system]));
    for (const system of systemsOverride) {
      merged.set(system.id, system);
    }
    return Array.from(merged.values());
  }, [storeSystems, systemsOverride]);

  const createEntityByType = useMemo(
    () =>
      buildCreateEntityByType({
        createSystem,
        createSubsystem,
        createModule,
        createUnit,
        createComponent,
      }, { silent: true }),
    [createSystem, createSubsystem, createModule, createUnit, createComponent]
  );

  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    entityType: DashboardEntityType;
    entityId: number;
    name: string;
    selectionKey: DashboardLevelKey;
  } | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{
    entityType: DashboardEntityType;
    parentId: number;
    formData: Record<string, unknown>;
    inventoryItem: Inventory;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [hierarchyNames, setHierarchyNames] = useState<Hierarchy[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);
  const [loadingFormData, setLoadingFormData] = useState(false);

  const notifyEntityChanged = useCallback(async () => {
    await ensureHierarchyLoaded({ force: true });
    await refreshData({ silent: true });
    await onEntityChanged?.();
  }, [ensureHierarchyLoaded, onEntityChanged, refreshData]);

  const getEntity = useCallback(
    (type: DashboardEntityType, id: number) => {
      switch (type) {
        case 'system':
          return effectiveSystems.find((item) => item.id === id);
        case 'subsystem':
          return subsystems.find((item) => item.id === id);
        case 'module':
          return modules.find((item) => item.id === id);
        case 'unit':
          return units.find((item) => item.id === id);
        case 'component':
          return components.find((item) => item.id === id);
        default:
          return undefined;
      }
    },
    [effectiveSystems, subsystems, modules, units, components]
  );

  const getParentEntity = useCallback(
    (type: DashboardEntityType, parentId: number) => {
      switch (type) {
        case 'system':
          return undefined;
        case 'subsystem':
          return effectiveSystems.find((item) => item.id === parentId);
        case 'module':
          return subsystems.find((item) => item.id === parentId);
        case 'unit':
          return modules.find((item) => item.id === parentId);
        case 'component':
          return units.find((item) => item.id === parentId);
        default:
          return undefined;
      }
    },
    [effectiveSystems, subsystems, modules, units]
  );

  const loadInventoryOptions = useCallback(
    async (entityType: DashboardEntityType, allowedNames: string[]) => {
      if (allowedNames.length === 0) {
        setInventoryItems([]);
        return;
      }

      const invRes = await api.inventory.list(0, 1000, entityType);
      setInventoryItems(
        filterInventoryForHierarchy(invRes.data ?? [], entityType, allowedNames)
      );
    },
    []
  );

  const loadFormData = useCallback(
    async (entityType: DashboardEntityType, parentId: number) => {
      const config = dashboardLevels.find((level) => level.entityType === entityType);
      if (!config?.statusType || !config.hierarchyType) {
        setStatuses([]);
        setHierarchyNames([]);
        setInventoryItems([]);
        return;
      }

      setLoadingFormData(true);
      try {
        const statusRes = await api.fetchStatusesByType(config.statusType);
        setStatuses(statusRes);

        if (entityType === 'system') {
          const hierarchyRes = await api.hierarchies.list('system');
          const names = hierarchyRes.data ?? [];
          setHierarchyNames(names);
          await loadInventoryOptions(
            'system',
            names.map((item) => item.name)
          );
          return;
        }

        const parentEntity = getParentEntity(entityType, parentId);
        if (!parentEntity || !config.parentHierarchyType) {
          setHierarchyNames([]);
          setInventoryItems([]);
          return;
        }

        const parentHierarchyRes = await api.hierarchies.list(config.parentHierarchyType);
        const parentHierarchyId = parentHierarchyRes.data.find(
          (item) => item.name === parentEntity.name
        )?.id;

        if (!parentHierarchyId) {
          setHierarchyNames([]);
          setInventoryItems([]);
          return;
        }

        const childRes = await api.hierarchies.list(config.hierarchyType, parentHierarchyId);
        const names = childRes.data ?? [];
        setHierarchyNames(names);
        await loadInventoryOptions(
          entityType,
          names.map((item) => item.name)
        );
      } catch (error) {
        console.error('Failed to load hierarchy form data', error);
        toast.error('Failed to load form options');
        setStatuses([]);
        setHierarchyNames([]);
        setInventoryItems([]);
      } finally {
        setLoadingFormData(false);
      }
    },
    [getParentEntity, loadInventoryOptions]
  );

  useEffect(() => {
    if (!dialogState) return;
    void loadFormData(dialogState.entityType, dialogState.parentId);
  }, [dialogState, loadFormData]);

  const openDialog = useCallback(
    (mode: DialogMode, entityType: DashboardEntityType, parentId: number, entityId?: number) => {
      setDialogState({ mode, entityType, parentId, entityId });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setDialogState(null);
    setPendingCreate(null);
    setStatuses([]);
    setHierarchyNames([]);
    setInventoryItems([]);
  }, []);

  const handleCreate = async (
    entityType: DashboardEntityType,
    parentId: number,
    formData: Record<string, unknown>,
    instanceId?: number
  ) => {
    const formWithInstance =
      instanceId != null
        ? { ...formData, inventory_instance_id: String(instanceId) }
        : formData;

    const created = await runSilentEntityBatch(async () => {
      return createHierarchyEntityFromForm({
        entityType,
        parentId,
        formData: formWithInstance,
        inventoryItems,
        createEntity: (data) => createEntityByType(entityType, data),
        createEntityByType,
        extraPayload:
          entityType === 'system'
            ? parseHierarchyInstallPayload(formWithInstance)
            : entityType === 'component'
              ? { sku: String(formWithInstance.sku || '') }
              : {},
      });
    });

    if (entityType === 'system') {
      await syncEntityPicture('system', created.id, formWithInstance);
    }

    if (created.childrenInstalled > 0) {
      toast.success(
        `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} added and ${created.childrenInstalled} child entit${created.childrenInstalled === 1 ? 'y' : 'ies'} installed from inventory`
      );
    } else {
      toast.success(
        `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} added successfully`
      );
    }

    updateSelection(SELECTION_KEY_BY_ENTITY[entityType], created.id);
    await notifyEntityChanged();
  };

  const handleUpdate = async (
    entityType: DashboardEntityType,
    entityId: number,
    parentId: number,
    formData: Record<string, unknown>
  ) => {
    const payload = {
      name: String(formData.name),
      description: String(formData.description || ''),
      status_id: Number(formData.id),
      part_number: String(formData.partnumber || ''),
      [PARENT_ID_FIELD[entityType]]: parentId,
    };

    switch (entityType) {
      case 'system': {
        const installPayload = parseHierarchyInstallPayload(formData);
        const pictureResult = await syncEntityPicture('system', entityId, formData);
        if (typeof pictureResult === 'string') {
          installPayload.picture_url = pictureResult;
        }
        await updateSystem(entityId, {
          ...payload,
          ...installPayload,
          ...(pictureResult === null ? { picture_url: null } : {}),
        } as Partial<System>);
        break;
      }
      case 'subsystem':
        await updateSubsystem(entityId, payload);
        break;
      case 'module':
        await updateModule(entityId, payload);
        break;
      case 'unit':
        await updateUnit(entityId, payload);
        break;
      case 'component':
        await updateComponent(entityId, {
          ...payload,
          sku: String(formData.sku || ''),
        });
        break;
    }

    await notifyEntityChanged();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const { entityType, entityId, selectionKey } = deleteTarget;

    try {
      switch (entityType) {
        case 'system':
          await deleteSystem(entityId);
          break;
        case 'subsystem':
          await deleteSubsystem(entityId);
          break;
        case 'module':
          await deleteModule(entityId);
          break;
        case 'unit':
          await deleteUnit(entityId);
          break;
        case 'component':
          await deleteComponent(entityId);
          break;
      }

      const next = { ...selection };
      delete next[selectionKey];
      const levelIndex = dashboardLevels.findIndex((level) => level.selectionKey === selectionKey);
      for (let index = levelIndex + 1; index < dashboardLevels.length; index += 1) {
        delete next[dashboardLevels[index].selectionKey];
      }
      onSelectionChange(next);
      await notifyEntityChanged();
    } catch (error) {
      toast.error(formatAxiosError(error, `Failed to delete ${entityType}`));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    if (!dialogState) return;

    if (dialogState.mode !== 'edit') {
      const name = String(formData.name || '');
      const partNumber = String(formData.partnumber || '').trim();
      const inventoryMatch =
        findInventoryByPartNumber(inventoryItems, partNumber) ??
        findInventoryByName(inventoryItems, name);
      const hasSerialSelection = Boolean(String(formData.inventory_instance_id || '').trim());
      if (inventoryMatch && needsSerialSelection(inventoryMatch) && !hasSerialSelection) {
        setPendingCreate({
          entityType: dialogState.entityType,
          parentId: dialogState.parentId,
          formData,
          inventoryItem: inventoryMatch,
        });
        return;
      }
    }

    setIsSubmitting(true);
    const currentDialog = dialogState;
    try {
      if (currentDialog.mode === 'edit' && currentDialog.entityId) {
        await handleUpdate(
          currentDialog.entityType,
          currentDialog.entityId,
          currentDialog.parentId,
          formData
        );
        closeDialog();
      } else {
        closeDialog();
        await handleCreate(currentDialog.entityType, currentDialog.parentId, formData);
      }
    } catch (error) {
      toast.error(
        formatAxiosError(
          error,
          currentDialog.mode === 'edit'
            ? `Failed to update ${currentDialog.entityType}`
            : `Failed to add ${currentDialog.entityType}`
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSerialConfirm = async (instanceId: number) => {
    if (!pendingCreate) return;

    const create = pendingCreate;
    setIsSubmitting(true);
    closeDialog();
    try {
      await handleCreate(
        create.entityType,
        create.parentId,
        create.formData,
        instanceId
      );
    } catch (error) {
      toast.error(
        formatAxiosError(error, `Failed to add ${create.entityType}`)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityActionHandlers = useMemo<HierarchyEntityActionHandlers>(
    () => ({
      onAddSibling: (entityId, type) => {
        const { siblingParentId } = resolveEntityParentIds(
          type,
          entityId,
          selection,
          effectiveSystems,
          subsystems,
          modules,
          units,
          components
        );
        if (!siblingParentId) {
          toast.error('Unable to resolve parent for new entity.');
          return;
        }
        openDialog('add-sibling', type, siblingParentId);
      },
      onAddChild: (entityId, type) => {
        const childType = CHILD_ENTITY_TYPE[type];
        if (!childType) return;
        openDialog('add-child', childType, entityId);
      },
      onEdit: (entityId, type) => {
        const { editParentId } = resolveEntityParentIds(
          type,
          entityId,
          selection,
          effectiveSystems,
          subsystems,
          modules,
          units,
          components
        );
        if (!editParentId) {
          toast.error('Unable to resolve parent for edit.');
          return;
        }
        openDialog('edit', type, editParentId, entityId);
      },
      onDelete: (entityId, type, label) => {
        setDeleteTarget({
          entityType: type,
          entityId,
          name: label,
          selectionKey: SELECTION_KEY_BY_ENTITY[type],
        });
      },
      onAddRootSystem: (projectId) => {
        openDialog('add-child', 'system', projectId);
      },
    }),
    [
      selection,
      effectiveSystems,
      subsystems,
      modules,
      units,
      components,
      openDialog,
    ]
  );

  const editingEntity = dialogState?.entityId
    ? getEntity(dialogState.entityType, dialogState.entityId)
    : undefined;

  const partNumberOptions = useMemo(
    () => buildPartNumberOptions(inventoryItems),
    [inventoryItems]
  );

  const parentDisplay = useMemo(() => {
    if (!dialogState || dialogState.mode === 'edit') return null;
    const { entityType, parentId } = dialogState;
    if (entityType === 'system') {
      const project = projects.find((item) => item.id === parentId);
      return project
        ? { fieldName: 'project_id', label: parentLabelFor('system'), id: project.id, name: project.name }
        : null;
    }
    const parentEntity = getParentEntity(entityType, parentId);
    if (!parentEntity) return null;
    return {
      fieldName: PARENT_ID_FIELD[entityType],
      label: parentLabelFor(entityType),
      id: parentEntity.id,
      name: parentEntity.name,
    };
  }, [dialogState, getParentEntity, projects]);

  const formFields = useMemo((): FormField[] => {
    if (!dialogState) return [];

    const isCreate = dialogState.mode !== 'edit';
    const fields: FormField[] = [
      {
        name: 'name',
        label: `${entityLabel(dialogState.entityType)} Name`,
        type: 'select',
        required: true,
        options: hierarchyNames.map((item) => ({ label: item.name, value: item.name })),
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        required: false,
        placeholder: `Enter ${dialogState.entityType} description`,
      },
    ];

    if (isCreate && parentDisplay) {
      fields.push(
        buildParentField({
          name: parentDisplay.fieldName,
          label: parentDisplay.label,
          parentId: parentDisplay.id,
          parentName: parentDisplay.name,
        })
      );
    }

    fields.push(buildPartNumberField(partNumberOptions));

    if (isCreate) {
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
    }

    fields.push({
      name: 'id',
      label: 'Status',
      type: 'select',
      required: true,
      options: statuses.map((status) => ({
        label: status.status_name,
        value: status.id,
      })),
    });

    if (dialogState.entityType === 'system' && dialogState.mode === 'edit' && dialogState.entityId) {
      return [
        ...fields,
        ...hierarchyInstallFormFields({
          users,
          ownerType: 'system',
          ownerId: dialogState.entityId,
        }),
      ];
    }

    if (dialogState.entityType === 'system' && dialogState.mode !== 'edit') {
      return [...fields, ...hierarchyInstallFormFields({ users })];
    }

    return fields;
  }, [
    dialogState,
    hierarchyNames,
    inventoryItems,
    parentDisplay,
    partNumberOptions,
    statuses,
    users,
  ]);

  const handleCreateFieldChange = useCallback(
    (fieldName: string, value: unknown, formData: Record<string, unknown>) => {
      if (dialogState?.mode === 'edit') return undefined;
      if (fieldName === 'name') {
        return patchFormFromNameSelection(String(value || ''), inventoryItems, formData);
      }
      if (fieldName === 'partnumber') {
        return patchFormFromPartNumberSelection(String(value || ''), inventoryItems);
      }
      return undefined;
    },
    [dialogState?.mode, inventoryItems]
  );

  const initialValues = useMemo(() => {
    if (editingEntity && dialogState?.mode === 'edit') {
      return {
        name: editingEntity.name,
        description: editingEntity.description || '',
        partnumber: editingEntity.part_number || '',
        id: editingEntity.status_id,
        sku: 'sku' in editingEntity ? editingEntity.sku || '' : '',
        ...(dialogState.entityType === 'system'
          ? hierarchyInstallInitialValues(editingEntity as System)
          : {}),
      };
    }

    if (dialogState && dialogState.mode !== 'edit' && parentDisplay) {
      return { [parentDisplay.fieldName]: parentDisplay.id };
    }

    return undefined;
  }, [editingEntity, dialogState, parentDisplay]);

  const entityActionDialogs = (
    <>
      <Dialog open={Boolean(dialogState)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === 'edit'
                ? `Edit ${entityLabel(dialogState.entityType)}`
                : dialogState?.mode === 'add-child'
                  ? `Add ${entityLabel(dialogState.entityType)}`
                  : dialogState
                    ? `Add sibling ${entityLabel(dialogState.entityType)}`
                    : 'Entity'}
            </DialogTitle>
            <DialogDescription>
              {dialogState?.mode === 'edit'
                ? 'Update the selected entity details.'
                : hierarchyNames.length === 0
                  ? 'No hierarchy templates are available for this parent. Configure them under Systems Hierarchy first.'
                  : partNumberOptions.length === 0
                    ? 'Choose a hierarchy name and enter a part number, or add matching inventory stock first.'
                    : 'Choose a hierarchy name and part number from inventory.'}
            </DialogDescription>
          </DialogHeader>

          {dialogState && !loadingFormData ? (
            <EntityForm
              key={`${dialogState.mode}-${dialogState.entityType}-${dialogState.parentId}-${dialogState.entityId ?? 'new'}`}
              fields={formFields}
              initialValues={initialValues}
              onFieldChange={handleCreateFieldChange}
              onSubmit={handleFormSubmit}
              isLoading={isSubmitting}
              onCancel={closeDialog}
              submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create'}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading form...</p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget ? entityLabel(deleteTarget.entityType) : 'entity'}?`}
        description={`Delete "${deleteTarget?.name ?? 'this entity'}" and its descendants from the hierarchy. This action cannot be undone.`}
        onConfirm={() => void handleDelete()}
      />

      <InventorySerialSelectDialog
        item={pendingCreate?.inventoryItem ?? null}
        open={pendingCreate != null}
        onOpenChange={(open) => {
          if (!open) setPendingCreate(null);
        }}
        confirming={isSubmitting}
        confirmLabel="Create"
        description={
          pendingCreate
            ? `${pendingCreate.inventoryItem.name} has ${pendingCreate.inventoryItem.quantity} units in stock. Choose which serial number to install (including its composed children).`
            : undefined
        }
        onConfirm={(instanceId) => {
          void handleSerialConfirm(instanceId);
        }}
      />
    </>
  );

  return { entityActionHandlers, entityActionDialogs };
}
