'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, InspectionPanel, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { maintenanceService, formatMaintenanceApiError } from '@/services/maintenance';
import { MaintenanceCaseSummary } from '@/components/maintenance/maintenance-case-summary';
import { InvestigationTree } from '@/components/maintenance/investigation-tree';
import { MaintenanceFaultyEntitiesTable } from '@/components/maintenance/maintenance-faulty-entities-table';
import { ResolveFaultDialog, type ReplacementSelection } from '@/components/maintenance/resolve-fault-dialog';
import { CaseTimelineTree } from '@/components/maintenance/case-timeline-tree';
import { MaintenanceActionTable } from '@/components/maintenance/MaintenanceActionTable';
import { BulkActionsToolbar } from '@/components/maintenance/bulk-actions-toolbar';
import { EntityDetailSheet } from '@/components/maintenance/entity-detail-sheet';
import { CaseDetailCards } from '@/components/maintenance/case-detail-cards';
import { WorkflowTransitionDialog } from '@/components/maintenance/workflow-transition-dialog';
import { useAuth } from '@/lib/auth-context';
import {
  FaultyEntity,
  MaintenanceCase,
  FaultyEntityStatus,
  MaintenanceAction,
  FaultType,
  ResolutionType,
  ActionType,
  ActionOutcome,
  CaseStatus,
} from '@/lib/models';
import { buildInvestigationTree } from '@/lib/maintenance-tree';
import { buildCaseTimelineEvents } from '@/lib/maintenance-timeline';
import { shouldSuggestResolveCase } from '@/lib/maintenance-case-status';
import {
  buildEntityDisplayContexts,
  countEntitiesByDisplayStatus,
  buildResolveFaultUpdatePayload,
  isClassifiedFaultType,
  resolutionRequiresClassifiedFaultType,
  FaultyEntityWorkflowStatus,
  getWorkflowSuggestion,
  mapCaseStatusToApi,
  MaintenanceCaseWorkflowStatus,
  resolveTriggerFromAction,
  resolveTriggerFromResolution,
} from '@/lib/maintenance-workflow';

function bulkActionTypeForStatus(status: FaultyEntityStatus): ActionType {
  switch (status) {
    case FaultyEntityStatus.CONFIRMED_FAULTY:
      return ActionType.Inspection;
    case FaultyEntityStatus.UNDER_INSPECTION:
      return ActionType.Inspection;
    case FaultyEntityStatus.NO_FAULT_FOUND:
      return ActionType.Testing;
    case FaultyEntityStatus.RESOLVED:
      return ActionType.Repair;
    default:
      return ActionType.Inspection;
  }
}

interface PendingWorkflowAction {
  message: string;
  suggestedCaseStatus?: MaintenanceCaseWorkflowStatus;
  suggestedEntityStatus?: FaultyEntityWorkflowStatus;
  execute: () => Promise<void>;
}

export default function MaintenanceCaseInvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const resolvedParams = use(params);
  const caseId = Number(resolvedParams.id);

  const [maintenanceCase, setMaintenanceCase] = useState<MaintenanceCase | null>(null);
  const [entities, setEntities] = useState<FaultyEntity[]>([]);
  const [maintenanceActions, setMaintenanceActions] = useState<MaintenanceAction[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeEntity, setActiveEntity] = useState<FaultyEntity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [caseStatusLoading, setCaseStatusLoading] = useState(false);
  const [resolveEntity, setResolveEntity] = useState<FaultyEntity | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<PendingWorkflowAction | null>(null);

  const treeNodes = useMemo(() => buildInvestigationTree(entities), [entities]);

  const timelineEventsView = useMemo(
    () => buildCaseTimelineEvents(maintenanceCase, entities, maintenanceActions),
    [maintenanceCase, entities, maintenanceActions]
  );

  const counts = useMemo(() => {
    const byStatus = countEntitiesByDisplayStatus(
      buildEntityDisplayContexts(entities, maintenanceActions)
    );
    return {
      total: entities.length,
      identified: byStatus[FaultyEntityWorkflowStatus.IDENTIFIED],
      under_inspection: byStatus[FaultyEntityWorkflowStatus.UNDER_INSPECTION],
      confirmed_faulty: byStatus[FaultyEntityWorkflowStatus.CONFIRMED_FAULTY],
      under_repair: byStatus[FaultyEntityWorkflowStatus.UNDER_REPAIR],
      repaired: byStatus[FaultyEntityWorkflowStatus.REPAIRED],
      replaced: byStatus[FaultyEntityWorkflowStatus.REPLACED],
      no_fault_found: byStatus[FaultyEntityWorkflowStatus.NO_FAULT_FOUND],
    };
  }, [entities, maintenanceActions]);

  useEffect(() => {
    if (!Number.isFinite(caseId) || caseId <= 0) return;
    loadInvestigationData();
  }, [caseId]);

  const appendMaintenanceAction = (action: MaintenanceAction) => {
    setMaintenanceActions((current) => {
      if (current.some((item) => item.id === action.id)) {
        return current;
      }
      return [action, ...current];
    });
  };

  const applyCaseStatus = async (displayStatus: MaintenanceCaseWorkflowStatus) => {
    const res = await maintenanceService.updateMaintenanceCase(caseId, {
      status: mapCaseStatusToApi(displayStatus),
    });
    setMaintenanceCase(res.data);
  };

  const promptWorkflow = useCallback((pending: PendingWorkflowAction) => {
    setPendingWorkflow(pending);
    setWorkflowDialogOpen(true);
  }, []);

  const logEngineerAction = async (
    faultyEntityId: number,
    actionType: ActionType,
    outcome: ActionOutcome,
    notes?: string,
    replacementEntityType?: FaultyEntity['entity_type'],
    replacementEntityId?: number,
    options?: { skipSuggestion?: boolean }
  ) => {
    const isFirstInspection =
      !maintenanceActions.some((a) => a.action_type === ActionType.Inspection) &&
      actionType === ActionType.Inspection;

    const action = await maintenanceService.recordEngineerAction({
      faultyEntityId,
      actionType,
      outcome,
      notes,
      performedBy: user?.id,
      replacementEntityType,
      replacementEntityId,
    });
    appendMaintenanceAction(action);

    if (!options?.skipSuggestion) {
      const trigger = resolveTriggerFromAction(actionType, outcome, isFirstInspection);
      if (trigger) {
        const suggestion = getWorkflowSuggestion({
          maintenanceCase,
          entities,
          actions: [...maintenanceActions, action],
          trigger,
          entityId: faultyEntityId,
          actionType,
          actionOutcome: outcome,
        });
        if (suggestion) {
          promptWorkflow({
            message: suggestion.message,
            suggestedCaseStatus: suggestion.suggestedCaseStatus,
            suggestedEntityStatus: suggestion.suggestedEntityStatus,
            execute: async () => {
              if (suggestion.suggestedCaseStatus) {
                await applyCaseStatus(suggestion.suggestedCaseStatus);
              }
            },
          });
        }
      }
    }

    return action;
  };

  const reloadCaseState = async () => {
    const [caseRes, entitiesRes] = await Promise.all([
      maintenanceService.getCase(caseId),
      maintenanceService.getFaultyEntitiesByCaseId(caseId),
    ]);

    const updatedEntities = entitiesRes.data || [];

    const timelineRes = await maintenanceService.getCaseTimeline(
      caseId,
      updatedEntities.map((entity) => entity.id)
    );

    setMaintenanceCase(caseRes.data);
    setEntities(updatedEntities);
    setMaintenanceActions(timelineRes.data || []);
    return { caseData: caseRes.data, updatedEntities, actions: timelineRes.data || [] };
  };

  const suggestResolveCaseIfReady = (
    updatedEntities: FaultyEntity[],
    currentCase: MaintenanceCase | null = maintenanceCase,
    actions: MaintenanceAction[] = maintenanceActions
  ) => {
    if (!currentCase || !shouldSuggestResolveCase(updatedEntities, currentCase.status)) {
      return;
    }

    const suggestion = getWorkflowSuggestion({
      maintenanceCase: currentCase,
      entities: updatedEntities,
      actions,
      trigger: 'verification_approved',
    });

    if (suggestion) {
      promptWorkflow({
        message: suggestion.message,
        suggestedCaseStatus: MaintenanceCaseWorkflowStatus.RESOLVED,
        execute: async () => {
          const res = await maintenanceService.updateMaintenanceCase(caseId, {
            status: CaseStatus.Resolved,
            resolution_notes: 'All faulty entities resolved or cleared.',
          });
          setMaintenanceCase(res.data);
          toast.success('Maintenance case marked as resolved.');
        },
      });
    }
  };

  const loadInvestigationData = async () => {
    if (!caseId) return;

    setIsLoading(true);
    setTimelineLoading(true);

    let loadedEntities: FaultyEntity[] = [];

    try {
      const [caseRes, entitiesRes] = await Promise.all([
        maintenanceService.getCase(caseId),
        maintenanceService.getFaultyEntitiesByCaseId(caseId),
      ]);

      loadedEntities = entitiesRes.data || [];
      setMaintenanceCase(caseRes.data);
      setEntities(loadedEntities);
    } catch (error) {
      console.error('Unable to load investigation data', error);
      toast.error('Failed to load maintenance investigation details.');
    } finally {
      setIsLoading(false);
    }

    try {
      const timelineRes = await maintenanceService.getCaseTimeline(
        caseId,
        loadedEntities.map((entity) => entity.id)
      );
      setMaintenanceActions(timelineRes.data || []);
    } catch (error) {
      console.error('Unable to load case timeline', error);
      setMaintenanceActions([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const refresh = async () => {
    await loadInvestigationData();
    setSelectedIds([]);
    setActiveEntity(null);
  };

  const handleToggleSelect = (entityId: number) => {
    setSelectedIds((current) =>
      current.includes(entityId) ? current.filter((id) => id !== entityId) : [...current, entityId]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((current) =>
      current.length === entities.length ? [] : entities.map((entity) => entity.id)
    );
  };

  const updateSelectedStatus = async (status: FaultyEntityStatus, notes?: string) => {
    if (selectedIds.length === 0) return;

    const idsToUpdate = selectedIds;

    if (status === FaultyEntityStatus.RESOLVED) {
      const missingFaultType = idsToUpdate.filter((id) => {
        const entity = entities.find((e) => e.id === id);
        return !isClassifiedFaultType(entity?.fault_type);
      });

      if (missingFaultType.length > 0) {
        toast.error(
          `Cannot resolve: ${missingFaultType.length} entity(ies) need a classified fault type before resolving.`
        );
        return;
      }
    }

    const runBulkUpdate = async () => {
      setActionLoading(true);
      try {
        await maintenanceService.bulkUpdateFaultyEntities(caseId, {
          entity_ids: idsToUpdate,
          status,
          notes,
        });

        await Promise.all(
          idsToUpdate.map((entityId) =>
            logEngineerAction(
              entityId,
              bulkActionTypeForStatus(status),
              status === FaultyEntityStatus.UNDER_INSPECTION
                ? ActionOutcome.Pending
                : ActionOutcome.Pass,
              notes || `Bulk status updated to ${status}`,
              undefined,
              undefined,
              { skipSuggestion: true }
            )
          )
        );

        toast.success('Selected entities updated successfully.');
        const { caseData, updatedEntities, actions } = await reloadCaseState();
        suggestResolveCaseIfReady(updatedEntities, caseData, actions);
        setSelectedIds([]);
      } catch (error) {
        console.error('Bulk update failed', error);
        toast.error('Unable to update selected entities.');
      } finally {
        setActionLoading(false);
      }
    };

    if (status === FaultyEntityStatus.CONFIRMED_FAULTY) {
      const suggestion = getWorkflowSuggestion({
        maintenanceCase,
        entities,
        actions: maintenanceActions,
        trigger: 'confirm_faulty',
      });
      if (suggestion) {
        promptWorkflow({
          message: suggestion.message,
          suggestedCaseStatus: suggestion.suggestedCaseStatus,
          suggestedEntityStatus: suggestion.suggestedEntityStatus,
          execute: runBulkUpdate,
        });
        return;
      }
    }

    if (status === FaultyEntityStatus.UNDER_INSPECTION) {
      const suggestion = getWorkflowSuggestion({
        maintenanceCase,
        entities,
        actions: maintenanceActions,
        trigger: 'first_inspection',
        entityId: idsToUpdate[0],
      });
      if (suggestion) {
        promptWorkflow({
          message: suggestion.message,
          suggestedCaseStatus: suggestion.suggestedCaseStatus,
          suggestedEntityStatus: suggestion.suggestedEntityStatus,
          execute: runBulkUpdate,
        });
        return;
      }
    }

    await runBulkUpdate();
  };

  const handleConfirmFaulty = async (entity: FaultyEntity) => {
    const runConfirm = async () => {
      setActionLoading(true);
      try {
        await maintenanceService.confirmFaultyEntity(entity.id);
        await logEngineerAction(
          entity.id,
          ActionType.Inspection,
          ActionOutcome.Pass,
          'Entity marked as confirmed faulty',
          undefined,
          undefined,
          { skipSuggestion: true }
        );
        toast.success('Entity marked as confirmed faulty.');
        await loadInvestigationData();
      } catch (error) {
        console.error('Confirm faulty failed', error);
        toast.error('Unable to confirm faulty entity.');
      } finally {
        setActionLoading(false);
      }
    };

    const suggestion = getWorkflowSuggestion({
      maintenanceCase,
      entities,
      actions: maintenanceActions,
      trigger: 'confirm_faulty',
      entityId: entity.id,
    });

    if (suggestion) {
      promptWorkflow({
        message: suggestion.message,
        suggestedCaseStatus: suggestion.suggestedCaseStatus,
        suggestedEntityStatus: suggestion.suggestedEntityStatus,
        execute: runConfirm,
      });
      return;
    }

    await runConfirm();
  };

  const handleNoFaultFound = async (entity: FaultyEntity) => {
    setActionLoading(true);
    try {
      await maintenanceService.updateFaultyEntity(
        entity.id,
        buildResolveFaultUpdatePayload(ResolutionType.NO_FAULT_FOUND, {
          remarks: 'No fault found during inspection',
        })
      );
      await logEngineerAction(
        entity.id,
        ActionType.Testing,
        ActionOutcome.Pass,
        'No fault found during inspection'
      );
      toast.success('Entity marked as no fault found.');
      const { caseData, updatedEntities, actions } = await reloadCaseState();
      suggestResolveCaseIfReady(updatedEntities, caseData, actions);
    } catch (error) {
      console.error('No fault found update failed', error);
      toast.error('Unable to update entity.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFaultTypeChange = async (entityId: number, faultType: string) => {
    try {
      const typedFaultType = faultType as FaultType;
      await maintenanceService.updateFaultyEntity(entityId, { fault_type: typedFaultType });
      await logEngineerAction(
        entityId,
        ActionType.Inspection,
        ActionOutcome.Pending,
        `Fault type updated to ${typedFaultType}`
      );
      setEntities((prev) =>
        prev.map((entity) =>
          entity.id === entityId ? { ...entity, fault_type: typedFaultType } : entity
        )
      );
      toast.success('Fault type updated successfully.');
    } catch (error) {
      console.error('Failed to update fault type', error);
      toast.error('Unable to update fault type.');
    }
  };

  const handleViewEntity = (entity: FaultyEntity) => {
    setActiveEntity(entity);
    setSheetOpen(true);
  };

  const handleOpenResolveDialog = (entity: FaultyEntity) => {
    setResolveEntity(entity);
    setResolveDialogOpen(true);
  };

  const handleCaseStatusChange = async (displayStatus: MaintenanceCaseWorkflowStatus) => {
    const suggestion = getWorkflowSuggestion({
      maintenanceCase,
      entities,
      actions: maintenanceActions,
      trigger: displayStatus === MaintenanceCaseWorkflowStatus.CLOSED ? 'close_case' : 'verification_approved',
    });

    const applyStatus = async () => {
      setCaseStatusLoading(true);
      try {
        await applyCaseStatus(displayStatus);
        toast.success('Case status updated.');
        await reloadCaseState();
      } catch (error) {
        console.error('Case status update failed', error);
        toast.error('Unable to update case status.');
      } finally {
        setCaseStatusLoading(false);
      }
    };

    if (suggestion && suggestion.suggestedCaseStatus === displayStatus) {
      promptWorkflow({
        message: suggestion.message,
        suggestedCaseStatus: displayStatus,
        execute: applyStatus,
      });
      return;
    }

    await applyStatus();
  };

  const handleResolveFault = async (
    resolutionType: ResolutionType,
    replacement?: ReplacementSelection,
    notes?: string
  ) => {
    if (!resolveEntity) return;
    if (
      resolutionRequiresClassifiedFaultType(resolutionType) &&
      !isClassifiedFaultType(resolveEntity.fault_type)
    ) {
      toast.error('Select a classified fault type before resolving this entity.');
      return;
    }

    const runResolve = async () => {
      setResolveLoading(true);

      const oldPartNumber = resolveEntity.part_number;
      const oldSerialNumber = resolveEntity.serial_number;
      const replacementPartNumber = replacement?.partNumber;

      try {
        const changes = buildResolveFaultUpdatePayload(resolutionType, {
          old_part_number: oldPartNumber,
          new_part_number: replacementPartNumber,
          old_serial_number: oldSerialNumber,
          new_serial_number: replacement?.serialNumber,
          remarks: notes,
        });

        await maintenanceService.updateFaultyEntity(resolveEntity.id, changes);

        if (replacementPartNumber) {
          await maintenanceService.updateEntityPartNumber(
            resolveEntity.entity_type,
            resolveEntity.entity_id,
            replacementPartNumber
          );

          if (replacement?.inventoryItemId != null && replacement.inventoryQuantity != null) {
            await maintenanceService.decrementInventoryItem(
              replacement.inventoryItemId,
              replacement.inventoryQuantity
            );
          }
        }

        const actionType =
          resolutionType === ResolutionType.REPAIRED
            ? ActionType.Repair
            : resolutionType === ResolutionType.REPLACED
            ? ActionType.Replacement
            : resolutionType === ResolutionType.NO_FAULT_FOUND
            ? ActionType.Testing
            : resolutionType === ResolutionType.DECOMMISSIONED
            ? ActionType.Disassembly
            : ActionType.Inspection;

        const replacementNote =
          resolutionType === ResolutionType.REPLACED && replacementPartNumber
            ? `Replaced ${oldPartNumber || 'unknown'} with ${replacementPartNumber}`
            : undefined;

        await logEngineerAction(
          resolveEntity.id,
          actionType,
          ActionOutcome.Pass,
          notes || replacementNote || `Resolved via ${resolutionType}`,
          resolveEntity.entity_type,
          resolveEntity.entity_id,
          { skipSuggestion: true }
        );

        toast.success('Fault resolved successfully.');
        setResolveDialogOpen(false);
        setResolveEntity(null);

        const { caseData, updatedEntities, actions } = await reloadCaseState();

        const testingSuggestion = getWorkflowSuggestion({
          maintenanceCase: caseData,
          entities: updatedEntities,
          actions,
          trigger: 'testing_pass',
        });
        if (testingSuggestion) {
          promptWorkflow({
            message: testingSuggestion.message,
            suggestedCaseStatus: testingSuggestion.suggestedCaseStatus,
            execute: async () => {
              if (testingSuggestion.suggestedCaseStatus) {
                await applyCaseStatus(testingSuggestion.suggestedCaseStatus);
              }
            },
          });
        } else {
          suggestResolveCaseIfReady(updatedEntities, caseData, actions);
        }
      } catch (error) {
        console.error('Resolve fault failed', error);
        toast.error(formatMaintenanceApiError(error, 'Unable to resolve faulty entity.'));
      } finally {
        setResolveLoading(false);
      }
    };

    const trigger = resolveTriggerFromResolution(resolutionType);
    const suggestion = getWorkflowSuggestion({
      maintenanceCase,
      entities,
      actions: maintenanceActions,
      trigger,
      entityId: resolveEntity.id,
      resolutionType,
    });

    if (suggestion) {
      promptWorkflow({
        message: suggestion.message,
        suggestedEntityStatus: suggestion.suggestedEntityStatus,
        execute: runResolve,
      });
      return;
    }

    await runResolve();
  };

  if (!Number.isFinite(caseId) || caseId <= 0) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        Invalid maintenance case ID.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/maintenance"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to maintenance cases
          </Link>
          <div className="pt-4 flex flex-col w-4xl">
            <div className="flex px-1 items-center w-2xl h-10">
              <InspectionPanel className="w-1/12 h-full" />
              <h1 className="text-2xl font-bold tracking-tight w-11/12 h-full">
                Maintenance Case Investigation
              </h1>
            </div>
            <p className="pl-16 text-sm text-muted-foreground">
              Inspect potentially affected or confirmed faulty entities and manage the
              investigation lifecycle for this case.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            Back
          </Button>
          <Button onClick={refresh} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {maintenanceCase ? (
        <>
          <MaintenanceCaseSummary
            maintenanceCase={maintenanceCase}
            entities={entities}
            actions={maintenanceActions}
            counts={counts}
          />
          <CaseDetailCards
            maintenanceCase={maintenanceCase}
            entities={entities}
            actions={maintenanceActions}
            onCaseStatusChange={handleCaseStatusChange}
            isUpdatingCase={caseStatusLoading}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          Loading maintenance case details...
        </div>
      )}

      <Separator />

      <div className="space-y-6">
        <Tabs defaultValue="tree">
          <TabsList>
            <TabsTrigger value="tree">Investigation Tree</TabsTrigger>
            <TabsTrigger value="entities">Faulty Entities</TabsTrigger>
            <TabsTrigger value="actions">Maintenance Actions</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="tree">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use the hierarchy tree to inspect entity relationships and confirm whether a
                specific part is faulty.
              </p>
              <InvestigationTree
                nodes={treeNodes}
                entities={entities}
                actions={maintenanceActions}
                caseStatus={maintenanceCase?.status}
                onSelect={(node) => {
                  const selected = entities.find((entity) => entity.id === node.id);
                  if (selected) {
                    handleViewEntity(selected);
                  }
                }}
                onNoFaultFound={(node) => {
                  const selected = entities.find((entity) => entity.id === node.id);
                  if (selected) {
                    handleNoFaultFound(selected);
                  }
                }}
                onFaultTypeChange={handleFaultTypeChange}
              />
            </div>
          </TabsContent>
          <TabsContent value="entities">
            <div className="space-y-4">
              <MaintenanceFaultyEntitiesTable
                entities={entities}
                actions={maintenanceActions}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleSelectAll={handleToggleSelectAll}
                onView={handleViewEntity}
                onConfirmFaulty={handleConfirmFaulty}
                onNoFaultFound={handleNoFaultFound}
                onResolve={handleOpenResolveDialog}
                isLoading={isLoading}
              />
              <BulkActionsToolbar
                selectedCount={selectedIds.length}
                isLoading={actionLoading}
                onStartInspection={() =>
                  updateSelectedStatus(
                    FaultyEntityStatus.UNDER_INSPECTION,
                    'Bulk set under inspection'
                  )
                }
                onConfirmFaulty={() =>
                  updateSelectedStatus(
                    FaultyEntityStatus.CONFIRMED_FAULTY,
                    'Bulk confirmed during investigation'
                  )
                }
                onNoFaultFound={() =>
                  updateSelectedStatus(
                    FaultyEntityStatus.NO_FAULT_FOUND,
                    'Bulk marked no fault found'
                  )
                }
                onResolve={() =>
                  updateSelectedStatus(
                    FaultyEntityStatus.RESOLVED,
                    'Bulk resolved during investigation'
                  )
                }
              />
            </div>
          </TabsContent>
          <TabsContent value="actions">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Structured audit log of all engineer actions recorded for this case.
              </p>
              <MaintenanceActionTable
                actions={maintenanceActions}
                entities={entities}
                isLoading={timelineLoading}
              />
            </div>
          </TabsContent>
          <TabsContent value="timeline">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Review investigation actions grouped by parent and child entities.
              </p>
              <CaseTimelineTree
                entities={entities}
                events={timelineEventsView}
                isLoading={timelineLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EntityDetailSheet
        entity={activeEntity}
        allEntities={entities}
        actions={maintenanceActions}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onConfirmFaulty={() => activeEntity && handleConfirmFaulty(activeEntity)}
        onNoFaultFound={() => activeEntity && handleNoFaultFound(activeEntity)}
        onResolve={() => activeEntity && handleOpenResolveDialog(activeEntity)}
        onFaultTypeChange={(faultType) =>
          activeEntity && handleFaultTypeChange(activeEntity.id, faultType)
        }
      />

      <ResolveFaultDialog
        entity={resolveEntity}
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        onResolve={handleResolveFault}
        isProcessing={resolveLoading}
      />

      <WorkflowTransitionDialog
        open={workflowDialogOpen}
        onOpenChange={setWorkflowDialogOpen}
        message={pendingWorkflow?.message ?? ''}
        suggestedCaseStatus={pendingWorkflow?.suggestedCaseStatus}
        suggestedEntityStatus={pendingWorkflow?.suggestedEntityStatus}
        isLoading={actionLoading || resolveLoading || caseStatusLoading}
        onConfirm={async () => {
          if (pendingWorkflow) {
            await pendingWorkflow.execute();
            setPendingWorkflow(null);
          }
        }}
        onCancel={() => setPendingWorkflow(null)}
      />
    </div>
  );
}
