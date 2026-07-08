'use client';

import { X } from 'lucide-react';
import {
  DASHBOARD_LEVELS,
  type DashboardLevelKey,
} from '@/lib/hierarchy-dashboard-entity-config';
import type { HierarchyDashboardSelection } from '@/lib/project-hierarchy-dashboard';
import type { Project } from '@/lib/models';
import type { HierarchyDossierMode } from '@/lib/hierarchy-dossier-mode';
import { Button } from '@/components/ui/button';
import { HierarchyDossierCombobox } from '@/components/hierarchy-dashboard/hierarchy-dossier-combobox';
import {
  HierarchySearchCombobox,
  type HierarchySearchOption,
} from '@/components/hierarchy-dashboard/hierarchy-search-combobox';

interface HierarchyDashboardControlsProps {
  selection: HierarchyDashboardSelection;
  onSelectionChange: (selection: HierarchyDashboardSelection) => void;
  onClearAll?: () => void;
  updateSelection: (key: DashboardLevelKey, value?: number) => void;
  projectOptions: HierarchySearchOption[];
  systemOptions: HierarchySearchOption[];
  subsystemOptions: HierarchySearchOption[];
  moduleOptions: HierarchySearchOption[];
  unitOptions: HierarchySearchOption[];
  componentOptions: HierarchySearchOption[];
  selectedProject?: Project;
  dossierMode: HierarchyDossierMode;
  onDossierModeChange: (mode: HierarchyDossierMode) => void;
}

export function HierarchyDashboardControls({
  selection,
  onSelectionChange,
  onClearAll,
  updateSelection,
  projectOptions,
  systemOptions,
  subsystemOptions,
  moduleOptions,
  unitOptions,
  componentOptions,
  selectedProject,
  dossierMode,
  onDossierModeChange,
}: HierarchyDashboardControlsProps) {
  const hasSelection = Boolean(
    selection.projectId ||
      selection.systemId ||
      selection.subsystemId ||
      selection.moduleId ||
      selection.unitId ||
      selection.componentId
  );

  const getSelectionValue = (key: DashboardLevelKey): number | undefined => selection[key];

  const getOptionsForLevel = (key: DashboardLevelKey): HierarchySearchOption[] => {
    switch (key) {
      case 'projectId':
        return projectOptions;
      case 'systemId':
        return systemOptions;
      case 'subsystemId':
        return subsystemOptions;
      case 'moduleId':
        return moduleOptions;
      case 'unitId':
        return unitOptions;
      case 'componentId':
        return componentOptions;
      default:
        return [];
    }
  };

  const visibleLevels = DASHBOARD_LEVELS.filter((level) => {
    if (level.selectionKey === 'projectId') return true;
    if (!level.parentSelectionKey) return false;
    return Boolean(getSelectionValue(level.parentSelectionKey));
  });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <HierarchyDossierCombobox
          value={dossierMode}
          onChange={onDossierModeChange}
          className="w-full min-w-[280px] sm:w-80"
        />

        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {visibleLevels.map((level) => (
            <HierarchySearchCombobox
              key={level.selectionKey}
              label={level.label}
              placeholder={
                level.selectionKey === 'projectId'
                  ? 'Select running project'
                  : `Select ${level.label.toLowerCase()}`
              }
              value={
                getSelectionValue(level.selectionKey)
                  ? String(getSelectionValue(level.selectionKey))
                  : undefined
              }
              options={getOptionsForLevel(level.selectionKey)}
              onChange={(value) => updateSelection(level.selectionKey, Number(value))}
              onClear={() => updateSelection(level.selectionKey, undefined)}
            />
          ))}
        </div>

        {hasSelection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => (onClearAll ? onClearAll() : onSelectionChange({}))}
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
    </>
  );
}
