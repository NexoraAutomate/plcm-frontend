'use client';

import axios from 'axios';
import api, * as libApi from '@/lib/api';
import { resolveEntityId } from '@/lib/entity-resolver';
import type {
  MaintenanceCase,
  FaultyEntity,
  MaintenanceAction,
  ActionType,
  ActionOutcome,
  UpdateMaintenanceCasePayload,
  CreateConfigurationHistoryPayload,
  AdminHierarchyReplacePayload,
  AdminHierarchyReplaceResponse,
  FaultType,
  UpdateFaultyEntityPayload,
} from '@/lib/models';
import {
  CaseStatus,
  EntityType,
  FaultyEntityStatus,
  ResolutionType,
} from '@/lib/models';
import { toApiActionType, toApiActionOutcome } from '@/lib/maintenance-workflow';

export interface RecordEngineerActionInput {
  faultyEntityId: number;
  actionType: ActionType;
  outcome: ActionOutcome;
  notes?: string;
  performedBy?: number;
  replacementEntityType?: EntityType;
  replacementEntityId?: number;
}

export interface RecordConfigurationChangeInput {
  entityType: EntityType | string;
  entityPk: number;
  maintenanceCaseId: number;
  performedBy: number;
  resolutionType: ResolutionType;
  faultType?: FaultType;
  oldPartNumber?: string;
  newPartNumber?: string;
  oldSerialNumber?: string;
  newSerialNumber?: string;
  remarks?: string;
}

export function formatMaintenanceApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const detail = (error.response.data as { detail?: string | { msg?: string }[] })?.detail;
      const detailText = Array.isArray(detail)
        ? detail.map((item) => item.msg ?? JSON.stringify(item)).join(', ')
        : typeof detail === 'string'
        ? detail
        : undefined;

      if (status === 403) {
        return detailText || 'You do not have permission to perform this action.';
      }
      if (status === 404) {
        return detailText || 'The requested record was not found.';
      }
      if (status === 400) {
        return detailText || 'The request could not be processed.';
      }
      return detailText || `${fallback} (HTTP ${status})`;
    }

    if (error.code === 'ERR_NETWORK') {
      return 'Unable to reach the API server. Confirm the PLCM backend is running on port 8000.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export const maintenanceService = {
  getCase: (id: number) => libApi.maintenanceCases.get(id),
  updateMaintenanceCase: (id: number, data: UpdateMaintenanceCasePayload) =>
    libApi.maintenanceCases.update(id, data),
  getFaultyEntitiesByCaseId: (caseId: number, skip = 0, limit = 100) => libApi.faultyEntities.listByCaseId(caseId, skip, limit),
  updateFaultyEntity: (entityId: number, data: Partial<FaultyEntity> & {
    old_part_number?: string;
    new_part_number?: string;
    old_serial_number?: string;
    new_serial_number?: string;
    remarks?: string;
  }) => {
    const { part_number: _ignoredPartNumber, ...apiPayload } = data;
    return libApi.faultyEntities.update(entityId, apiPayload);
  },
  updateEntityPartNumber: async (entityType: EntityType, entityId: number, partNumber: string) => {
    switch (entityType) {
      case EntityType.System:
        return libApi.systems.update(entityId, { part_number: partNumber });
      case EntityType.Subsystem:
        return libApi.subsystems.update(entityId, { part_number: partNumber });
      case EntityType.Module:
        return libApi.modules.update(entityId, { part_number: partNumber });
      case EntityType.Unit:
        return libApi.units.update(entityId, { part_number: partNumber });
      case EntityType.Component:
        return libApi.components.update(entityId, { part_number: partNumber });
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  },
  createMaintenanceAction: (data: Partial<MaintenanceAction>) => libApi.maintenanceActions.create(data as any),

  recordEngineerAction: async (input: RecordEngineerActionInput) => {
    const res = await libApi.maintenanceActions.create({
      faulty_entity_id: input.faultyEntityId,
      action_type: toApiActionType(input.actionType),
      outcome: toApiActionOutcome(input.outcome),
      notes: input.notes,
      performed_by: input.performedBy,
      performed_at: new Date().toISOString(),
      replacement_entity_type: input.replacementEntityType,
      replacement_entity_id: input.replacementEntityId,
    } as any);

    return res.data;
  },

  recordConfigurationChange: async (input: RecordConfigurationChangeInput) => {
    const genericEntityId = await resolveEntityId(input.entityType, input.entityPk);
    if (!genericEntityId) {
      throw new Error('Unable to resolve entity for configuration history.');
    }

    const payload: CreateConfigurationHistoryPayload = {
      entity_id: genericEntityId,
      maintenance_case_id: input.maintenanceCaseId,
      performed_by: input.performedBy,
      resolution_type: input.resolutionType,
      fault_type: input.faultType,
      old_part_number: input.oldPartNumber,
      new_part_number: input.newPartNumber,
      old_serial_number: input.oldSerialNumber,
      new_serial_number: input.newSerialNumber,
      remarks: input.remarks,
    };

    const res = await libApi.configurationHistory.create(payload);
    return res.data;
  },

  decrementInventoryItem: async (inventoryItemId: number, currentQuantity: number) => {
    const newQuantity = Math.max(0, currentQuantity - 1);
    return libApi.inventory.update(inventoryItemId, { quantity: newQuantity });
  },
  
  // Backend has no bulk-update route; apply individual PUT updates instead.
  bulkUpdateFaultyEntities: async (
    _caseId: number,
    payload: {
      entity_ids: number[];
      status: FaultyEntityStatus;
      notes?: string;
    }
  ) => {
    const updateBody: UpdateFaultyEntityPayload = {
      status: payload.status,
      remarks: payload.notes,
    };

    if (payload.status === FaultyEntityStatus.NO_FAULT_FOUND) {
      updateBody.resolution_type = ResolutionType.NO_FAULT_FOUND;
    } else if (payload.status === FaultyEntityStatus.RESOLVED) {
      updateBody.resolution_type = ResolutionType.REPAIRED;
    }

    await Promise.all(
      payload.entity_ids.map((entityId) => libApi.faultyEntities.update(entityId, updateBody))
    );

    return { data: payload.entity_ids };
  },
  getFaultyEntityHistory: (entityId: number) => libApi.faultyEntities.getMaintenanceHistory(entityId),
  getCaseTimeline: async (caseId: number, faultyEntityIds: number[] = []) => {
    const actions: MaintenanceAction[] = [];
    const faultyEntityIdSet = new Set(faultyEntityIds);

    const appendActions = (items: MaintenanceAction[] | undefined) => {
      if (!Array.isArray(items)) return;
      actions.push(...items);
    };

    try {
      const res = await api.get<MaintenanceAction[]>('/maintenance-actions/', {
        params: { case_id: caseId },
      });
      appendActions(res.data);
    } catch {
      // Continue with other sources.
    }

    if (faultyEntityIds.length > 0) {
      const entityResults = await Promise.allSettled(
        faultyEntityIds.map(async (entityId) => {
          const [actionsRes, historyRes] = await Promise.all([
            libApi.maintenanceActions.listByFaultyEntityId(entityId),
            libApi.faultyEntities.getMaintenanceHistory(entityId),
          ]);
          return [...(actionsRes.data ?? []), ...(historyRes.data ?? [])];
        })
      );

      for (const result of entityResults) {
        if (result.status === 'fulfilled') {
          appendActions(result.value);
        }
      }
    }

    if (actions.length === 0) {
      try {
        const res = await libApi.maintenanceActions.list(0, 1000);
        appendActions(
          (res.data ?? []).filter((action) => faultyEntityIdSet.has(action.faulty_entity_id))
        );
      } catch {
        // No global actions available.
      }
    }

    const uniqueActions = Array.from(
      new Map(actions.map((action) => [action.id, action])).values()
    );

    return { data: uniqueActions };
  },
  confirmFaultyEntity: (entityId: number) =>
    libApi.faultyEntities.update(entityId, { status: 'confirmed_faulty' as FaultyEntityStatus }),
  markEntityHealthy: (entityId: number) =>
    libApi.faultyEntities.update(entityId, { status: 'healthy' as FaultyEntityStatus, resolution_type: 'clear' as ResolutionType }),
  setEntityUnderInspection: (entityId: number) =>
    libApi.faultyEntities.update(entityId, { status: 'under_inspection' as FaultyEntityStatus }),
  resolveEntity: (entityId: number) =>
    libApi.faultyEntities.update(entityId, { status: 'resolved' as FaultyEntityStatus }),
  falsePositiveEntity: (entityId: number) =>
    libApi.faultyEntities.update(entityId, { status: 'false_positive' as FaultyEntityStatus }),
  update_faulty_Children: (entityId: number, data: Partial<FaultyEntity>)=> libApi.faultyEntities.updateChildren(entityId, data),

  adminHierarchyReplace: async (payload: AdminHierarchyReplacePayload) => {
    const res = await libApi.maintenanceCases.adminHierarchyReplace(payload);
    return res.data as AdminHierarchyReplaceResponse;
  },
};
