'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { useDataStore } from '@/lib/data-store';
import {
  CHILD_ENTITY_TYPE,
  DASHBOARD_LEVELS,
  getEntityLabel,
  PARENT_ID_FIELD,
  resolveEntityParentIds,
  SELECTION_KEY_BY_ENTITY,
  type DashboardEntityType,
  type DashboardLevelKey,
} from '@/lib/hierarchy-dashboard-entity-config';
import {
  hierarchyInstallFormFields,
  hierarchyInstallInitialValues,
  parseHierarchyInstallPayload,
} from '@/lib/hierarchy-install-fields';
import type { HierarchyDashboardSelection } from '@/lib/project-hierarchy-dashboard';
import { syncEntityPicture } from '@/lib/entity-picture-upload';
import type { Hierarchy, Status, System } from '@/lib/models';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EntityForm } from '@/components/entity-form';

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

function buildSerialNumber(name: string, partNumber: string): string {
  if (name && partNumber) return `${name}-${partNumber}`;
  return name || partNumber || '';
}

export function useHierarchyEntityActions({
  selection,
  onSelectionChange,
  updateSelection,
}: UseHierarchyEntityActionsOptions) {
  const {
    systems,
    subsystems,
    modules,
    units,
    components,
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
  } = useDataStore();

  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    entityType: DashboardEntityType;
    entityId: number;
    name: string;
    selectionKey: DashboardLevelKey;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [hierarchyNames, setHierarchyNames] = useState<Hierarchy[]>([]);
  const [loadingFormData, setLoadingFormData] = useState(false);

  const getEntity = useCallback(
    (type: DashboardEntityType, id: number) => {
      switch (type) {
        case 'system':
          return systems.find((item) => item.id === id);
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
    [systems, subsystems, modules, units, components]
  );

  const getParentEntity = useCallback(
    (type: DashboardEntityType, parentId: number) => {
      switch (type) {
        case 'system':
          return undefined;
        case 'subsystem':
          return systems.find((item) => item.id === parentId);
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
    [systems, subsystems, modules, units]
  );

  const loadFormData = useCallback(
    async (entityType: DashboardEntityType, parentId: number) => {
      const config = DASHBOARD_LEVELS.find((level) => level.entityType === entityType);
      if (!config?.statusType || !config.hierarchyType) {
        setStatuses([]);
        setHierarchyNames([]);
        return;
      }

      setLoadingFormData(true);
      try {
        const statusRes = await api.fetchStatusesByType(config.statusType);
        setStatuses(statusRes);

        if (entityType === 'system') {
          const hierarchyRes = await api.hierarchies.list('system');
          setHierarchyNames(hierarchyRes.data);
          return;
        }

        const parentEntity = getParentEntity(entityType, parentId);
        if (!parentEntity || !config.parentHierarchyType) {
          setHierarchyNames([]);
          return;
        }

        const parentHierarchyRes = await api.hierarchies.list(config.parentHierarchyType);
        const parentHierarchyId = parentHierarchyRes.data.find(
          (item) => item.name === parentEntity.name
        )?.id;

        if (!parentHierarchyId) {
          setHierarchyNames([]);
          return;
        }

        const childRes = await api.hierarchies.list(config.hierarchyType, parentHierarchyId);
        setHierarchyNames(childRes.data);
      } catch (error) {
        console.error('Failed to load hierarchy form data', error);
        toast.error('Failed to load form options');
        setStatuses([]);
        setHierarchyNames([]);
      } finally {
        setLoadingFormData(false);
      }
    },
    [getParentEntity]
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
    setStatuses([]);
    setHierarchyNames([]);
  }, []);

  const handleCreate = async (
    entityType: DashboardEntityType,
    parentId: number,
    formData: Record<string, unknown>
  ) => {
    const payload = {
      name: String(formData.name),
      description: String(formData.description || ''),
      status_id: Number(formData.id),
      part_number: String(formData.partnumber || ''),
      serial_number: buildSerialNumber(String(formData.name || ''), String(formData.partnumber || '')),
      configuration_item: String(formData.partnumber || formData.name || ''),
    };

    switch (entityType) {
      case 'system': {
        const created = await createSystem({
          ...payload,
          project_id: parentId,
          ...parseHierarchyInstallPayload(formData),
        });
        await syncEntityPicture('system', created.id, formData);
        updateSelection('systemId', created.id);
        break;
      }
      case 'subsystem': {
        const created = await createSubsystem({ ...payload, system_id: parentId });
        updateSelection('subsystemId', created.id);
        break;
      }
      case 'module': {
        const created = await createModule({ ...payload, subsystem_id: parentId });
        updateSelection('moduleId', created.id);
        break;
      }
      case 'unit': {
        const created = await createUnit({ ...payload, module_id: parentId });
        updateSelection('unitId', created.id);
        break;
      }
      case 'component': {
        const created = await createComponent({
          name: payload.name,
          description: payload.description,
          status_id: payload.status_id,
          part_number: payload.part_number,
          serial_number: payload.serial_number,
          sku: String(formData.sku || ''),
          unit_id: parentId,
        });
        updateSelection('componentId', created.id);
        break;
      }
    }
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
      const levelIndex = DASHBOARD_LEVELS.findIndex((level) => level.selectionKey === selectionKey);
      for (let index = levelIndex + 1; index < DASHBOARD_LEVELS.length; index += 1) {
        delete next[DASHBOARD_LEVELS[index].selectionKey];
      }
      onSelectionChange(next);
    } catch (error) {
      toast.error(formatAxiosError(error, `Failed to delete ${entityType}`));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    if (!dialogState) return;

    setIsSubmitting(true);
    try {
      if (dialogState.mode === 'edit' && dialogState.entityId) {
        await handleUpdate(
          dialogState.entityType,
          dialogState.entityId,
          dialogState.parentId,
          formData
        );
      } else {
        await handleCreate(dialogState.entityType, dialogState.parentId, formData);
      }
      closeDialog();
    } catch (error) {
      toast.error(
        formatAxiosError(
          error,
          dialogState.mode === 'edit'
            ? `Failed to update ${dialogState.entityType}`
            : `Failed to add ${dialogState.entityType}`
        )
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
          systems,
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
          systems,
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
      systems,
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

  const formFields = useMemo(() => {
    if (!dialogState) return [];

    const baseFields = [
      {
        name: 'name',
        label: `${getEntityLabel(dialogState.entityType)} Name`,
        type: 'select' as const,
        required: true,
        options: hierarchyNames.map((item) => ({ label: item.name, value: item.name })),
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea' as const,
        required: false,
        placeholder: `Enter ${dialogState.entityType} description`,
      },
      {
        name: 'partnumber',
        label: 'Part #',
        type: 'text' as const,
        required: false,
        placeholder: 'Enter part number',
      },
      {
        name: 'id',
        label: 'Status',
        type: 'select' as const,
        required: true,
        options: statuses.map((status) => ({
          label: status.status_name,
          value: status.id,
        })),
      },
    ];

    if (dialogState.entityType === 'system' && dialogState.mode === 'edit' && dialogState.entityId) {
      return [
        ...baseFields,
        ...hierarchyInstallFormFields({
          users,
          ownerType: 'system',
          ownerId: dialogState.entityId,
        }),
      ];
    }

    if (dialogState.entityType === 'system' && dialogState.mode !== 'edit') {
      return [...baseFields, ...hierarchyInstallFormFields({ users })];
    }

    return baseFields;
  }, [dialogState, hierarchyNames, statuses, users]);

  const initialValues = useMemo(() => {
    if (!editingEntity || dialogState?.mode !== 'edit') return undefined;

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
  }, [editingEntity, dialogState]);

  const entityActionDialogs = (
    <>
      <Dialog open={Boolean(dialogState)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === 'edit'
                ? `Edit ${getEntityLabel(dialogState.entityType)}`
                : dialogState?.mode === 'add-child'
                  ? `Add ${getEntityLabel(dialogState.entityType)}`
                  : dialogState
                    ? `Add sibling ${getEntityLabel(dialogState.entityType)}`
                    : 'Entity'}
            </DialogTitle>
            <DialogDescription>
              {dialogState?.mode === 'edit'
                ? 'Update the selected entity details.'
                : 'Create a new entity in the hierarchy.'}
            </DialogDescription>
          </DialogHeader>

          {dialogState && !loadingFormData ? (
            <EntityForm
              fields={formFields}
              initialValues={initialValues}
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
        title={`Delete ${deleteTarget ? getEntityLabel(deleteTarget.entityType) : 'entity'}?`}
        description={`Delete "${deleteTarget?.name ?? 'this entity'}" and its descendants from the hierarchy. This action cannot be undone.`}
        onConfirm={() => void handleDelete()}
      />
    </>
  );

  return { entityActionHandlers, entityActionDialogs };
}
