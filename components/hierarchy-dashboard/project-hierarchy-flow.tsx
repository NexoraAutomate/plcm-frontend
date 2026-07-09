'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHierarchyEntityActions } from '@/components/hierarchy-dashboard/use-hierarchy-entity-actions';
import type { DashboardLevelKey } from '@/lib/hierarchy-dashboard-entity-config';
import {
  buildProjectHierarchyFlow,
  collectSubtreeFromNode,
  type HierarchyDashboardSelection,
} from '@/lib/project-hierarchy-dashboard';
import {
  DEFAULT_NODE_FIELD_VISIBILITY,
  type HierarchyEntityType,
  type HierarchyNodeFieldVisibility,
} from '@/lib/system-hierarchy-graph';
import {
  HierarchyEntityDetailPanel,
  type HierarchyEntitySelection,
} from '@/components/hierarchy-entity-detail-panel';
import { HierarchyNodeLegend } from '@/components/hierarchy-node-legend';
import { BuildTimelineDialog } from '@/components/hierarchy-dashboard/build-timeline-dialog';
import { ReplacementHistoryDialog } from '@/components/hierarchy-dashboard/replacement-history-dialog';
import { MmhdMaintenanceSummary } from '@/components/hierarchy-dashboard/mmhd-maintenance-summary';
import { HierarchyExpandToggle } from '@/components/hierarchy-dashboard/hierarchy-expand-toggle';
import type { HierarchyDossierMode } from '@/lib/hierarchy-dossier-mode';
import {
  collectProjectReplacedEntities,
  isReplacedHardwareEntity,
} from '@/lib/project-maintenance-stats';
import {
  invalidateProjectResolutionCache,
  useProjectResolutionHistory,
} from '@/components/hierarchy-dashboard/use-project-resolution-history';
import {
  filterRecordsForNode,
  loadDeliveriesForCases,
  makeEntityKey,
  buildReplacementHistoryRows,
  filterReplacementRecords,
  subtreeRefForRecord,
} from '@/lib/resolution-history-matching';
import type { MaintenanceDelivery } from '@/lib/models';
import {
  HIERARCHY_FLOW_NODE_TYPES,
  HierarchyFlowActionsProvider,
} from '@/components/hierarchy/hierarchy-flow-node';
import type {
  Component,
  Module,
  Project,
  Status,
  Subsystem,
  System,
  Unit,
} from '@/lib/models';

interface ProjectHierarchyFlowProps {
  selection: HierarchyDashboardSelection;
  onSelectionChange: (selection: HierarchyDashboardSelection) => void;
  updateSelection: (key: DashboardLevelKey, value?: number) => void;
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
  project?: Project;
  statuses?: Status[];
  className?: string;
  onNodeSelect?: (entityId: number, type: HierarchyEntityType) => void;
  systemsLoading?: boolean;
  onEntityChanged?: () => void | Promise<void>;
  dossierMode?: HierarchyDossierMode;
}

function FitViewOnSelectionChange({ dependencyKey }: { dependencyKey: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!dependencyKey) return;

    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 250 });
    });

    return () => cancelAnimationFrame(frame);
  }, [dependencyKey, fitView]);

  return null;
}

export function ProjectHierarchyFlow({
  selection,
  onSelectionChange,
  updateSelection,
  systems,
  subsystems,
  modules,
  units,
  components,
  project,
  statuses = [],
  className,
  onNodeSelect,
  systemsLoading = false,
  onEntityChanged,
  dossierMode = 'bhd',
}: ProjectHierarchyFlowProps) {
  const { entityActionHandlers, entityActionDialogs } = useHierarchyEntityActions({
    selection,
    onSelectionChange,
    updateSelection,
    systemsOverride: systems,
    onEntityChanged,
  });

  const [panel, setPanel] = useState<{
    open: boolean;
    selection: HierarchyEntitySelection | null;
  }>({ open: false, selection: null });
  const [resolutionDialog, setResolutionDialog] = useState<{
    open: boolean;
    entityId: number;
    type: HierarchyEntityType;
    label: string;
  } | null>(null);
  const [fieldVisibility, setFieldVisibility] = useState<HierarchyNodeFieldVisibility>(
    DEFAULT_NODE_FIELD_VISIBILITY
  );
  const [expandFullHierarchy, setExpandFullHierarchy] = useState(false);
  const [resolutionDeliveries, setResolutionDeliveries] = useState<MaintenanceDelivery[]>([]);

  const {
    records: projectResolutionRecords,
    matchContext,
    resolvedEntityIds,
    subtreeByEntityId,
    nodesWithHistory,
    refresh: refreshResolutionHistory,
  } = useProjectResolutionHistory({
    projectId: selection.projectId,
    systems,
    subsystems,
    modules,
    units,
    components,
  });

  const isMmhdMode = dossierMode === 'mmhd';

  const replacedEntities = useMemo(() => {
    if (!selection.projectId || !isMmhdMode) return [];
    return collectProjectReplacedEntities(
      selection.projectId,
      systems,
      subsystems,
      modules,
      units,
      components
    );
  }, [
    selection.projectId,
    isMmhdMode,
    systems,
    subsystems,
    modules,
    units,
    components,
  ]);

  const replacedEntityKeys = useMemo(
    () => new Set(replacedEntities.map((entity) => makeEntityKey(entity.type, entity.entityId))),
    [replacedEntities]
  );

  useEffect(() => {
    setExpandFullHierarchy(false);
  }, [selection.projectId, dossierMode]);

  useEffect(() => {
    if (dossierMode === 'bhd') {
      setFieldVisibility((current) => ({
        ...current,
        partNumber: true,
        serialNumber: true,
        replacementDate: false,
      }));
    }
  }, [dossierMode]);

  const replacementDateByEntityKey = useMemo(() => {
    if (!isMmhdMode) return new Map<string, string>();

    const dates = new Map<string, string>();
    for (const record of filterReplacementRecords(projectResolutionRecords)) {
      const ref = subtreeRefForRecord(record, matchContext, subtreeByEntityId);
      if (!ref || !record.change_date) continue;

      const key = makeEntityKey(ref.type, ref.pk);
      const existing = dates.get(key);
      if (!existing || new Date(record.change_date).getTime() > new Date(existing).getTime()) {
        dates.set(key, record.change_date);
      }
    }
    return dates;
  }, [isMmhdMode, projectResolutionRecords, matchContext, subtreeByEntityId]);

  const handleToggleDetails = useCallback((entityId: number, type: HierarchyEntityType) => {
    setPanel((prev) => {
      const isSameEntity =
        prev.selection?.entityId === entityId && prev.selection?.type === type;
      if (prev.open && isSameEntity) {
        return { ...prev, open: false };
      }
      return { open: true, selection: { entityId, type } };
    });
  }, []);

  const handleNavigate = useCallback(
    (entityId: number, type: HierarchyEntityType) => {
      onNodeSelect?.(entityId, type);
    },
    [onNodeSelect]
  );

  const handleViewResolutionHistory = useCallback(
    (entityId: number, type: HierarchyEntityType) => {
      const label =
        systems.find((system) => type === 'system' && system.id === entityId)?.name ??
        subsystems.find((subsystem) => type === 'subsystem' && subsystem.id === entityId)?.name ??
        modules.find((module) => type === 'module' && module.id === entityId)?.name ??
        units.find((unit) => type === 'unit' && unit.id === entityId)?.name ??
        components.find((component) => type === 'component' && component.id === entityId)?.name ??
        'Entity';

      setResolutionDialog({
        open: true,
        entityId,
        type,
        label,
      });
    },
    [systems, subsystems, modules, units, components]
  );

  const resolutionDialogInstallationRefs = useMemo(() => {
    if (!resolutionDialog?.open) return [];
    return collectSubtreeFromNode(
      resolutionDialog.type,
      resolutionDialog.entityId,
      systems,
      subsystems,
      modules,
      units,
      components
    );
  }, [
    resolutionDialog,
    systems,
    subsystems,
    modules,
    units,
    components,
  ]);

  const resolutionDialogRecords = useMemo(() => {
    if (!resolutionDialog?.open) return [];
    return filterRecordsForNode(
      projectResolutionRecords,
      resolutionDialog.type,
      resolutionDialog.entityId,
      systems,
      subsystems,
      modules,
      units,
      components,
      resolvedEntityIds,
      subtreeByEntityId
    );
  }, [
    resolutionDialog,
    projectResolutionRecords,
    systems,
    subsystems,
    modules,
    units,
    components,
    resolvedEntityIds,
  ]);

  useEffect(() => {
    if (!resolutionDialog?.open) {
      setResolutionDeliveries([]);
      return;
    }

    const caseIds = resolutionDialogRecords
      .map((record) => record.maintenance_case_id)
      .filter((id): id is number => typeof id === 'number' && id > 0);

    let cancelled = false;
    void loadDeliveriesForCases(caseIds).then((deliveries) => {
      if (!cancelled) setResolutionDeliveries(deliveries);
    });

    return () => {
      cancelled = true;
    };
  }, [resolutionDialog?.open, resolutionDialogRecords]);

  const { nodes, edges } = useMemo(() => {
    const flow = buildProjectHierarchyFlow(
      selection,
      systems,
      subsystems,
      modules,
      units,
      components,
      statuses,
      {
        expandAll: expandFullHierarchy,
        preferOriginalBuild: dossierMode === 'bhd',
      }
    );

    return {
      nodes: flow.nodes.map((node) => {
        const entityKey = makeEntityKey(node.data.type, node.data.entityId);
        const isReplacedEntity =
          isMmhdMode &&
          (replacedEntityKeys.has(entityKey) ||
            isReplacedHardwareEntity({
              replacement_sequence: node.data.replacementSequence,
            }));

        const replacementDate =
          node.data.replacementDate ?? replacementDateByEntityKey.get(entityKey);

        return {
          ...node,
          data: {
            ...node.data,
            fieldVisibility,
            hasResolutionHistory: nodesWithHistory.has(entityKey),
            isReplacedEntity,
            dossierMode,
            replacementDate,
          },
        };
      }),
      edges: flow.edges,
    };
  }, [
    selection,
    systems,
    subsystems,
    modules,
    units,
    components,
    statuses,
    fieldVisibility,
    nodesWithHistory,
    isMmhdMode,
    expandFullHierarchy,
    replacedEntityKeys,
    dossierMode,
    replacementDateByEntityKey,
  ]);

  const fitViewKey = useMemo(
    () =>
      [
        dossierMode,
        expandFullHierarchy ? 'expanded' : 'collapsed',
        selection.projectId,
        selection.systemId,
        selection.subsystemId,
        selection.moduleId,
        selection.unitId,
        selection.componentId,
      ]
        .filter(Boolean)
        .join(':'),
    [dossierMode, expandFullHierarchy, selection]
  );

  useEffect(() => {
    if (!selection.projectId) {
      setPanel({ open: false, selection: null });
    }
  }, [selection.projectId]);

  if (!selection.projectId) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed bg-muted/20',
          className
        )}
      >
        <p className="text-sm text-muted-foreground">
          Select a running project to view its hierarchy.
        </p>
      </div>
    );
  }

  if (systemsLoading) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20',
          className
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading project systems…</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <>
        <div
          className={cn(
            'flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20',
            className
          )}
        >
          <p className="text-sm text-muted-foreground">
            No systems found for this project. Add a system to build the hierarchy graph.
          </p>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => entityActionHandlers.onAddRootSystem(selection.projectId!)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add system
          </Button>
        </div>
        {entityActionDialogs}
      </>
    );
  }

  return (
    <>
    <div
      className={cn(
        'flex h-full min-h-[420px] w-full overflow-hidden rounded-lg border bg-muted/10',
        className
      )}
    >
      <div className="relative min-w-0 flex-1">
        {!isMmhdMode ? (
          <HierarchyExpandToggle
            expanded={expandFullHierarchy}
            onToggle={() => setExpandFullHierarchy((current) => !current)}
          />
        ) : null}
        {isMmhdMode ? (
          <MmhdMaintenanceSummary
            replacedCount={replacedEntities.length}
            onShowReplacedParts={() => setExpandFullHierarchy(true)}
          />
        ) : null}
        <HierarchyNodeLegend
          visibility={fieldVisibility}
          onChange={setFieldVisibility}
          dossierMode={dossierMode}
          className={isMmhdMode ? 'top-14' : undefined}
        />
        <ReactFlowProvider>
          <HierarchyFlowActionsProvider
            onToggleDetails={handleToggleDetails}
            onNavigate={handleNavigate}
            onViewResolutionHistory={handleViewResolutionHistory}
            entityActions={entityActionHandlers}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={HIERARCHY_FLOW_NODE_TYPES}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll
              onNodeClick={() => undefined}
              proOptions={{ hideAttribution: true }}
            >
              <FitViewOnSelectionChange dependencyKey={fitViewKey} />
              <Background gap={16} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeStrokeWidth={3}
                pannable
                zoomable
                className="bg-background/80!"
              />
            </ReactFlow>
          </HierarchyFlowActionsProvider>
        </ReactFlowProvider>
      </div>

      <HierarchyEntityDetailPanel
        selection={panel.selection}
        open={panel.open}
        onClose={() => setPanel((prev) => ({ ...prev, open: false }))}
        systems={systems}
        subsystems={subsystems}
        modules={modules}
        units={units}
        components={components}
        project={project}
        statuses={statuses}
        dossierMode={dossierMode}
      />

      {resolutionDialog && selection.projectId ? (
        isMmhdMode ? (
          <ReplacementHistoryDialog
            open={resolutionDialog.open}
            onOpenChange={(open) => {
              if (!open) {
                setResolutionDialog(null);
              }
            }}
            title={`Replacement history — ${resolutionDialog.label}`}
            rows={buildReplacementHistoryRows(
              resolutionDialogRecords,
              matchContext,
              subtreeByEntityId,
              resolutionDeliveries
            )}
          />
        ) : (
          <BuildTimelineDialog
            open={resolutionDialog.open}
            onOpenChange={(open) => {
              if (!open) {
                setResolutionDialog(null);
              }
            }}
            nodeLabel={resolutionDialog.label}
            projectId={selection.projectId}
            records={resolutionDialogRecords}
            matchContext={matchContext}
            subtreeByEntityId={subtreeByEntityId}
            installationRefs={resolutionDialogInstallationRefs}
            deliveries={resolutionDeliveries}
            onHistoryRefresh={() => {
              invalidateProjectResolutionCache(selection.projectId!);
              refreshResolutionHistory();
              void onEntityChanged?.();
            }}
          />
        )
      ) : null}
    </div>
    {entityActionDialogs}
    </>
  );
}
