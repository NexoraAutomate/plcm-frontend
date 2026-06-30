'use client';

import { useMemo } from 'react';
import { useDataStore } from '@/lib/data-store';
import { buildEntityFaultMap } from '@/lib/entity-fault-badges';
import type { FaultyEntityStatus } from '@/lib/models';

export function useEntityFaultMap() {
  const {
    faultyEntities,
    maintenanceCases,
    orders,
    projects,
    systems,
    subsystems,
    modules,
    units,
    components,
    hierarchyReady,
  } = useDataStore();

  return useMemo(() => {
    if (!hierarchyReady) {
      return new Map<string, FaultyEntityStatus>();
    }
    return buildEntityFaultMap({
      faultyEntities,
      maintenanceCases,
      hierarchy: { orders, projects, systems, subsystems, modules, units, components },
    });
  }, [
    hierarchyReady,
    faultyEntities,
    maintenanceCases,
    orders,
    projects,
    systems,
    subsystems,
    modules,
    units,
    components,
  ]);
}
