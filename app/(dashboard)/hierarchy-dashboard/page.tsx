'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/page-loader';
import { HierarchySearchCombobox } from '@/components/hierarchy-dashboard/hierarchy-search-combobox';
import { ProjectHierarchyFlow } from '@/components/hierarchy-dashboard/project-hierarchy-flow';
import { fetchAllProjects } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import * as api from '@/lib/api';
import {
  getComponentsForUnit,
  getModulesForSubsystem,
  getSubsystemsForSystem,
  getUnitsForModule,
  resolveSelectionFromEntity,
  searchEntityBySerialNumber,
  type HierarchyDashboardSelection,
} from '@/lib/project-hierarchy-dashboard';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import type { System } from '@/lib/models';

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
  const { pageLoading, hierarchyLoading, hierarchyAttempted } = useEntityHierarchyGate();
  const {
    projects: storeProjects,
    systems: storeSystems,
    subsystems,
    modules,
    units,
    components,
    statuses,
  } = useDataStore();

  const { data: fetchedProjects, isLoading: projectsQueryLoading } = useQuery({
    queryKey: queryKeys.allProjects(),
    queryFn: fetchAllProjects,
  });
  const allProjects =
    fetchedProjects && fetchedProjects.length > 0 ? fetchedProjects : storeProjects;

  const [selection, setSelection] = useState<HierarchyDashboardSelection>({});
  const [serialQuery, setSerialQuery] = useState('');
  const [serialSearching, setSerialSearching] = useState(false);
  const [projectSystems, setProjectSystems] = useState<System[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);

  const selectedProject = allProjects.find((project) => project.id === selection.projectId);

  const projectOptions = useMemo(
    () =>
      allProjects.map((project) => ({
        value: String(project.id),
        label: project.name,
        description: project.status_name,
      })),
    [allProjects]
  );

  const loadProjectSystems = useCallback(async (projectId: number) => {
    setSystemsLoading(true);
    try {
      const res = await api.projects.getSystems(projectId);
      setProjectSystems(res.data ?? []);
    } catch {
      setProjectSystems([]);
      toast.error('Failed to load systems for this project.');
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  const systemsForSelection = selection.projectId ? projectSystems : storeSystems;

  const systemOptions = useMemo(() => {
    if (!selection.projectId) return [];
    return systemsForSelection.map((system) => ({
      value: String(system.id),
      label: system.name,
      description: system.serial_number || system.part_number,
    }));
  }, [selection.projectId, systemsForSelection]);

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

      if (key === 'projectId' && value) {
        void loadProjectSystems(value);
      }
      if (key === 'projectId' && !value) {
        setProjectSystems([]);
      }
    },
    [loadProjectSystems]
  );

  const handleNodeSelect = useCallback(
    (entityId: number, type: HierarchyEntityType) => {
      const resolved = resolveSelectionFromEntity(
        type,
        entityId,
        storeSystems,
        subsystems,
        modules,
        units,
        components
      );
      if (!resolved?.projectId) {
        toast.error('Selected entity is not linked to a project.');
        return;
      }
      void loadProjectSystems(resolved.projectId);
      setSelection(resolved);
    },
    [storeSystems, subsystems, modules, units, components, loadProjectSystems]
  );

  const hasSelection = Boolean(
    selection.projectId ||
      selection.systemId ||
      selection.subsystemId ||
      selection.moduleId ||
      selection.unitId ||
      selection.componentId
  );

  const handleClearSelection = () => {
    setSelection({});
    setSerialQuery('');
    setProjectSystems([]);
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
        storeSystems,
        subsystems,
        modules,
        units,
        components
      );

      if (!match) {
        toast.error('No entity found with that serial number.');
        return;
      }

      if (match.selection.projectId) {
        await loadProjectSystems(match.selection.projectId);
      }
      setSelection(match.selection);
      toast.success(`Found ${match.type}: ${match.name}`);
    } finally {
      setSerialSearching(false);
    }
  };

  const dataLoading =
    pageLoading ||
    (projectsQueryLoading && allProjects.length === 0) ||
    (hierarchyLoading && !hierarchyAttempted);

  if (dataLoading || serialSearching || systemsLoading) {
    return <PageLoader />;
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <HierarchySearchCombobox
            label="Project"
            placeholder="Select project"
            value={selection.projectId ? String(selection.projectId) : undefined}
            options={projectOptions}
            onChange={(value) => updateSelection('projectId', Number(value))}
            onClear={() => updateSelection('projectId', undefined)}
          />

          {selection.projectId ? (
            <HierarchySearchCombobox
              label="System"
              placeholder={systemsLoading ? 'Loading systems...' : 'Select system'}
              value={selection.systemId ? String(selection.systemId) : undefined}
              options={systemOptions}
              onChange={(value) => updateSelection('systemId', Number(value))}
              onClear={() => updateSelection('systemId', undefined)}
              disabled={systemsLoading}
            />
          ) : null}

          {selection.systemId ? (
            <HierarchySearchCombobox
              label="Subsystem"
              placeholder="Select subsystem"
              value={selection.subsystemId ? String(selection.subsystemId) : undefined}
              options={subsystemOptions}
              onChange={(value) => updateSelection('subsystemId', Number(value))}
              onClear={() => updateSelection('subsystemId', undefined)}
            />
          ) : null}

          {selection.subsystemId ? (
            <HierarchySearchCombobox
              label="Module"
              placeholder="Select module"
              value={selection.moduleId ? String(selection.moduleId) : undefined}
              options={moduleOptions}
              onChange={(value) => updateSelection('moduleId', Number(value))}
              onClear={() => updateSelection('moduleId', undefined)}
            />
          ) : null}

          {selection.moduleId ? (
            <HierarchySearchCombobox
              label="Unit"
              placeholder="Select unit"
              value={selection.unitId ? String(selection.unitId) : undefined}
              options={unitOptions}
              onChange={(value) => updateSelection('unitId', Number(value))}
              onClear={() => updateSelection('unitId', undefined)}
            />
          ) : null}

          {selection.unitId ? (
            <HierarchySearchCombobox
              label="Component"
              placeholder="Select component"
              value={selection.componentId ? String(selection.componentId) : undefined}
              options={componentOptions}
              onChange={(value) => updateSelection('componentId', Number(value))}
              onClear={() => updateSelection('componentId', undefined)}
            />
          ) : null}
        </div>

        {hasSelection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleClearSelection}
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        ) : null}
      </div>

      {selectedProject ? (
        <p className="text-sm text-muted-foreground">
          Viewing <span className="font-medium text-foreground">{selectedProject.name}</span>
          {selectedProject.status_name ? ` · ${selectedProject.status_name}` : ''}
        </p>
      ) : null}

      <ProjectHierarchyFlow
        selection={selection}
        systems={systemsForSelection}
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
