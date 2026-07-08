'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/page-loader';
import { HierarchyDashboardControls } from '@/components/hierarchy-dashboard/hierarchy-dashboard-controls';
import { ProjectHierarchyFlow } from '@/components/hierarchy-dashboard/project-hierarchy-flow';
import { fetchAllProjects } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { LIST_BOOTSTRAP_SIZE } from '@/lib/data-loading';
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
import type { HierarchyDossierMode } from '@/lib/hierarchy-dossier-mode';
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
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project_id');
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
    queryKey: queryKeys.projects(0, LIST_BOOTSTRAP_SIZE),
    queryFn: fetchAllProjects,
    enabled: storeProjects.length === 0,
    staleTime: 30_000,
  });
  const allProjects =
    storeProjects.length > 0
      ? storeProjects
      : (fetchedProjects ?? []);

  const [selection, setSelection] = useState<HierarchyDashboardSelection>({});
  const [dossierMode, setDossierMode] = useState<HierarchyDossierMode>('bhd');
  const [serialQuery, setSerialQuery] = useState('');
  const [serialSearching, setSerialSearching] = useState(false);
  const [projectSystems, setProjectSystems] = useState<System[]>([]);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const loadedProjectIdRef = useRef<number | null>(null);

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

  const loadProjectSystems = useCallback(async (projectId: number, force = false) => {
    if (!force && loadedProjectIdRef.current === projectId) return;

    loadedProjectIdRef.current = projectId;
    setProjectSystems([]);
    setSystemsLoading(true);
    try {
      const res = await api.projects.getSystems(projectId);
      setProjectSystems(res.data ?? []);
    } catch {
      loadedProjectIdRef.current = null;
      setProjectSystems([]);
      toast.error('Failed to load systems for this project.');
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  const handleEntityChanged = useCallback(async () => {
    if (!selection.projectId) return;
    loadedProjectIdRef.current = null;
    await loadProjectSystems(selection.projectId, true);
  }, [loadProjectSystems, selection.projectId]);

  useEffect(() => {
    if (!projectIdParam) return;
    const projectId = Number(projectIdParam);
    if (!Number.isFinite(projectId) || projectId <= 0) return;

    setSelection((current) => {
      if (current.projectId === projectId) return current;
      return { projectId };
    });
    void loadProjectSystems(projectId);
  }, [projectIdParam, loadProjectSystems]);

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
        if (loadedProjectIdRef.current !== value) {
          loadedProjectIdRef.current = null;
          setProjectSystems([]);
          setSystemsLoading(true);
        }
        void loadProjectSystems(value);
      }
      if (key === 'projectId' && !value) {
        loadedProjectIdRef.current = null;
        setProjectSystems([]);
        setSystemsLoading(false);
      }
    },
    [loadProjectSystems]
  );

  const handleNodeSelect = useCallback(
    (entityId: number, type: HierarchyEntityType) => {
      const systemsPool = selection.projectId ? projectSystems : storeSystems;
      const resolved = resolveSelectionFromEntity(
        type,
        entityId,
        systemsPool,
        subsystems,
        modules,
        units,
        components
      );
      if (!resolved?.projectId) {
        toast.error('Selected entity is not linked to a project.');
        return;
      }
      if (resolved.projectId !== selection.projectId) {
        void loadProjectSystems(resolved.projectId);
      }
      setSelection(resolved);
    },
    [selection.projectId, projectSystems, storeSystems, subsystems, modules, units, components, loadProjectSystems]
  );

  const handleClearSelection = () => {
    setSelection({});
    setSerialQuery('');
    loadedProjectIdRef.current = null;
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
    (projectsQueryLoading && storeProjects.length === 0 && allProjects.length === 0) ||
    (hierarchyLoading && !hierarchyAttempted);

  if (dataLoading || serialSearching) {
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
        dossierMode={dossierMode}
        onDossierModeChange={setDossierMode}
      />

      <ProjectHierarchyFlow
        selection={selection}
        onSelectionChange={setSelection}
        updateSelection={updateSelection}
        systems={systemsForSelection}
        subsystems={subsystems}
        modules={modules}
        units={units}
        components={components}
        project={selectedProject}
        statuses={statuses}
        onNodeSelect={handleNodeSelect}
        systemsLoading={systemsLoading}
        onEntityChanged={handleEntityChanged}
        dossierMode={dossierMode}
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
