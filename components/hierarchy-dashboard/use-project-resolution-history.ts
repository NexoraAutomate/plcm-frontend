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
import { LruMap } from '@/lib/lru-map';

const EMPTY_DATA: ProjectResolutionHistoryData = {
  records: [],
  matchContext: { refs: [], entityKeys: new Set(), partNumbers: new Set(), serialNumbers: new Set() },
  resolvedEntityIds: new Set(),
  subtreeByEntityId: new Map<number, SubtreeEntityRef>(),
  nodesWithHistory: new Set(),
};

/** Keep a few project histories in memory; evict least-recently used. */
const PROJECT_CACHE_MAX = 8;
const projectCache = new LruMap<
  number,
  { version: number; fingerprint: string; data: ProjectResolutionHistoryData }
>(PROJECT_CACHE_MAX);

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
  const dataRef = useRef(data);
  dataRef.current = data;

  const hierarchyRef = useRef({ systems, subsystems, modules, units, components });
  hierarchyRef.current = { systems, subsystems, modules, units, components };

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
    if (
      cached &&
      cached.version === PROJECT_RESOLUTION_CACHE_VERSION &&
      cached.fingerprint === hardwareFingerprint
    ) {
      if (dataRef.current !== cached.data) {
        setData(cached.data);
      }
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

    const {
      systems: systemsSnapshot,
      subsystems: subsystemsSnapshot,
      modules: modulesSnapshot,
      units: unitsSnapshot,
      components: componentsSnapshot,
    } = hierarchyRef.current;

    void loadResolutionHistoryForProject(
      projectId,
      systemsSnapshot,
      subsystemsSnapshot,
      modulesSnapshot,
      unitsSnapshot,
      componentsSnapshot
    )
      .then((result) => {
        if (cancelled) return;
        projectCache.set(projectId, {
          version: PROJECT_RESOLUTION_CACHE_VERSION,
          fingerprint: hardwareFingerprint,
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
        if (loadInFlightRef.current === projectId) {
          loadInFlightRef.current = null;
        }
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (loadInFlightRef.current === projectId) {
        loadInFlightRef.current = null;
      }
    };
    // Hierarchy arrays are read via hierarchyRef; fingerprint covers structural changes.
  }, [projectId, hardwareFingerprint, refreshKey]);

  const refresh = () => {
    if (projectId != null) {
      invalidateProjectResolutionCache(projectId);
    }
    setRefreshKey((key) => key + 1);
  };

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
