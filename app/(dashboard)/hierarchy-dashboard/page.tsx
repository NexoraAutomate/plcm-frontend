'use client';

import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HierarchyDashboardControls } from '@/components/hierarchy-dashboard/hierarchy-dashboard-controls';
import { ProjectHierarchyFlow } from '@/components/hierarchy-dashboard/project-hierarchy-flow';
import {
  getComponentsForUnit,
  getModulesForSubsystem,
  getRunningProjects,
  getSubsystemsForSystem,
  getSystemsForProject,
  getUnitsForModule,
  resolveSelectionFromEntity,
  searchEntityBySerialNumber,
  type HierarchyDashboardSelection,
} from '@/lib/project-hierarchy-dashboard';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';

const CHILD_CLEAR_MAP: Record<
  keyof HierarchyDashboardSelection,
  (keyof HierarchyDashboardSelection)[]
> = {
  projectId: ['systemId', 'subsystemId', 'moduleId', 'unitId', 'componentId'],
  systemId: ['subsystemId', 'moduleId', 'unitId', 'componentId'],
  subsystemId: ['moduleId', 'unitId', 'componentId'],
  moduleId: ['unitId', 'componentId'],
  unitId: ['componentId'],
  componentId: [],
};

function clearChildSelections(
  selection: HierarchyDashboardSelection,
  changedKey: keyof HierarchyDashboardSelection
): HierarchyDashboardSelection {
  const next = { ...selection };
  for (const key of CHILD_CLEAR_MAP[changedKey] ?? []) {
    delete next[key];
  }
  return next;
}

export default function HierarchyDashboardPage() {
  const { pageLoading } = useEntityHierarchyGate();
  const {
    projects,
    systems,
    subsystems,
    modules,
    units,
    components,
    statuses,
  } = useDataStore();

  const [selection, setSelection] = useState<HierarchyDashboardSelection>({});
  const [serialQuery, setSerialQuery] = useState('');
  const [serialSearching, setSerialSearching] = useState(false);

  const runningProjects = useMemo(() => getRunningProjects(projects), [projects]);
  const runningProjectIds = useMemo(
    () => new Set(runningProjects.map((project) => project.id)),
    [runningProjects]
  );

  const selectedProject = runningProjects.find((project) => project.id === selection.projectId);

  const projectOptions = useMemo(
    () =>
      runningProjects.map((project) => ({
        value: String(project.id),
        label: project.name,
        description: project.status_name,
      })),
    [runningProjects]
  );

  const systemOptions = useMemo(() => {
    if (!selection.projectId) return [];
    return getSystemsForProject(systems, selection.projectId).map((system) => ({
      value: String(system.id),
      label: system.name,
      description: system.serial_number || system.part_number,
    }));
  }, [selection.projectId, systems]);

  const subsystemOptions = useMemo(() => {
    if (!selection.systemId) return [];
    return getSubsystemsForSystem(subsystems, selection.systemId).map((subsystem) => ({
      value: String(subsystem.id),
      label: subsystem.name,
      description: subsystem.serial_number || subsystem.part_number,
    }));
  }, [selection.systemId, subsystems]);

  const moduleOptions = useMemo(() => {
    if (!selection.subsystemId) return [];
    return getModulesForSubsystem(modules, selection.subsystemId).map((module) => ({
      value: String(module.id),
      label: module.name,
      description: module.serial_number || module.part_number,
    }));
  }, [selection.subsystemId, modules]);

  const unitOptions = useMemo(() => {
    if (!selection.moduleId) return [];
    return getUnitsForModule(units, selection.moduleId).map((unit) => ({
      value: String(unit.id),
      label: unit.name,
      description: unit.serial_number || unit.part_number,
    }));
  }, [selection.moduleId, units]);

  const componentOptions = useMemo(() => {
    if (!selection.unitId) return [];
    return getComponentsForUnit(components, selection.unitId).map((component) => ({
      value: String(component.id),
      label: component.name,
      description: component.serial_number || component.part_number,
    }));
  }, [selection.unitId, components]);

  const updateSelection = useCallback(
    (key: keyof HierarchyDashboardSelection, value?: number) => {
      setSelection((current) => {
        const next = { ...current, [key]: value };
        if (!value) {
          delete next[key];
        }
        return clearChildSelections(next, key);
      });
    },
    []
  );

  const handleNodeSelect = useCallback(
    (entityId: number, type: HierarchyEntityType) => {
      const resolved = resolveSelectionFromEntity(
        type,
        entityId,
        systems,
        subsystems,
        modules,
        units,
        components
      );
      if (!resolved?.projectId || !runningProjectIds.has(resolved.projectId)) {
        toast.error('Selected entity is not part of a running project.');
        return;
      }
      setSelection(resolved);
    },
    [systems, subsystems, modules, units, components, runningProjectIds]
  );

  const handleClearSelection = () => {
    setSelection({});
    setSerialQuery('');
  };

  const handleSerialSearch = async () => {
    if (!serialQuery.trim()) {
      toast.error('Enter a serial number to search.');
      return;
    }

    setSerialSearching(true);
    try {
      const match = searchEntityBySerialNumber(
        serialQuery,
        systems,
        subsystems,
        modules,
        units,
        components,
        runningProjectIds
      );

      if (!match) {
        toast.error('No entity found with that serial number in a running project.');
        return;
      }

      setSelection(match.selection);
      toast.success(`Found ${match.type}: ${match.name}`);
    } finally {
      setSerialSearching(false);
    }
  };

  if (pageLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hierarchy Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Navigate project hardware hierarchies with cascading selectors and an interactive graph.
          </p>
        </div>

        <div className="flex w-full max-w-md items-end gap-2 lg:justify-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="serial-search" className="text-sm font-medium">
              Serial Number Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="serial-search"
                value={serialQuery}
                onChange={(event) => setSerialQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSerialSearch();
                  }
                }}
                placeholder="Search by serial number..."
                className="pl-9"
              />
            </div>
          </div>
          <Button onClick={() => void handleSerialSearch()} disabled={serialSearching}>
            {serialSearching ? 'Searching...' : 'Find'}
          </Button>
        </div>
      </div>

      <HierarchyDashboardControls
        selection={selection}
        onSelectionChange={setSelection}
        onClearAll={handleClearSelection}
        updateSelection={updateSelection}
        projectOptions={projectOptions}
        systemOptions={systemOptions}
        subsystemOptions={subsystemOptions}
        moduleOptions={moduleOptions}
        unitOptions={unitOptions}
        componentOptions={componentOptions}
        selectedProject={selectedProject}
      />

      <ProjectHierarchyFlow
        selection={selection}
        onSelectionChange={setSelection}
        updateSelection={updateSelection}
        systems={systems}
        subsystems={subsystems}
        modules={modules}
        units={units}
        components={components}
        project={selectedProject}
        statuses={statuses}
        onNodeSelect={handleNodeSelect}
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
