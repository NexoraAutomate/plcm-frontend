'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Component, ConfigurationHistory, Module, Subsystem, System, Unit } from '@/lib/models';
import { getSystemsForProject } from '@/lib/project-hierarchy-dashboard';
import {
  loadResolutionHistoryForProject,
  PROJECT_RESOLUTION_CACHE_VERSION,
  type ProjectResolutionHistoryData,
} from '@/lib/resolution-history-matching';
import type { SubtreeEntityRef } from '@/lib/project-hierarchy-dashboard';

const EMPTY_DATA: ProjectResolutionHistoryData = {
  records: [],
  matchContext: { refs: [], entityKeys: new Set(), partNumbers: new Set(), serialNumbers: new Set() },
  resolvedEntityIds: new Set(),
  subtreeByEntityId: new Map<number, SubtreeEntityRef>(),
  nodesWithHistory: new Set(),
};

const projectCache = new Map<
  number,
  { version: number; data: ProjectResolutionHistoryData }
>();

export function invalidateProjectResolutionCache(projectId?: number) {
  if (projectId != null) {
    projectCache.delete(projectId);
    return;
  }
  projectCache.clear();
}

interface UseProjectResolutionHistoryArgs {
  projectId?: number;
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}

export function useProjectResolutionHistory({
  projectId,
  systems,
  subsystems,
  modules,
  units,
  components,
}: UseProjectResolutionHistoryArgs) {
  const [data, setData] = useState<ProjectResolutionHistoryData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadInFlightRef = useRef<number | null>(null);

  const hardwareFingerprint = useMemo(() => {
    if (!projectId) return '';
    return getSystemsForProject(systems, projectId)
      .map((system) => system.id)
      .sort((a, b) => a - b)
      .join(',');
  }, [projectId, systems]);

  useEffect(() => {
    if (!projectId) {
      loadInFlightRef.current = null;
      setData(EMPTY_DATA);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    if (!hardwareFingerprint) {
      return;
    }

    const cached = projectCache.get(projectId);
    if (cached && cached.version === PROJECT_RESOLUTION_CACHE_VERSION) {
      setData(cached.data);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    if (loadInFlightRef.current === projectId) {
      return;
    }

    let cancelled = false;
    loadInFlightRef.current = projectId;
    setLoading(true);
    setErrorMessage(null);

    void loadResolutionHistoryForProject(
      projectId,
      systems,
      subsystems,
      modules,
      units,
      components
    )
      .then((result) => {
        if (cancelled) return;
        projectCache.set(projectId, {
          version: PROJECT_RESOLUTION_CACHE_VERSION,
          data: result,
        });
        setData(result);
      })
      .catch(() => {
        if (cancelled) return;
        setData(EMPTY_DATA);
        setErrorMessage('Unable to load resolution history.');
      })
      .finally(() => {
        if (cancelled) return;
        if (loadInFlightRef.current === projectId) {
          loadInFlightRef.current = null;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, hardwareFingerprint, systems, subsystems, modules, units, components, refreshKey]);

  const refresh = () => setRefreshKey((key) => key + 1);

  return {
    records: data.records as ConfigurationHistory[],
    matchContext: data.matchContext,
    resolvedEntityIds: data.resolvedEntityIds,
    subtreeByEntityId: data.subtreeByEntityId,
    nodesWithHistory: data.nodesWithHistory,
    loading,
    errorMessage,
    refresh,
  };
}
