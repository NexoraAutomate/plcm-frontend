'use client';

import { useEffect } from 'react';
import { useDataStoreDomain, useDataStoreHierarchy } from '@/lib/data-store';
import type { HierarchyEntityTypeKey } from '@/hooks/queries/fetchers';

/** Load full hierarchy into the store when a page needs it (dashboard, search, etc.). */
export function useEnsureHierarchy() {
  const { ensureHierarchyLoaded, hierarchyLoading, hierarchyReady, hierarchyAttempted } =
    useDataStoreHierarchy();

  useEffect(() => {
    void ensureHierarchyLoaded();
  }, [ensureHierarchyLoaded]);

  return { hierarchyLoading, hierarchyReady, hierarchyAttempted };
}

export type EntityHierarchyGateOptions = {
  /**
   * When set, only these hierarchy types are loaded (list-page parent/child counts).
   * Omit for a full systems→components load (detail / dashboard).
   */
  types?: HierarchyEntityTypeKey[];
};

/**
 * For list/detail pages that depend on hierarchy rows in the store.
 * Blocks render until store bootstrap completes; hierarchy loads in background.
 */
export function useEntityHierarchyGate(options?: EntityHierarchyGateOptions) {
  const { loading } = useDataStoreDomain();
  const {
    hierarchyLoading,
    hierarchyReady,
    hierarchyAttempted,
    ensureHierarchyLoaded,
    ensureHierarchyTypesLoaded,
  } = useDataStoreHierarchy();

  const typesKey = options?.types?.slice().sort().join(',') ?? '';

  useEffect(() => {
    if (options?.types && options.types.length > 0) {
      void ensureHierarchyTypesLoaded(options.types);
      return;
    }
    void ensureHierarchyLoaded();
  }, [ensureHierarchyLoaded, ensureHierarchyTypesLoaded, typesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageLoading = loading;

  return { pageLoading, loading, hierarchyLoading, hierarchyReady, hierarchyAttempted };
}
