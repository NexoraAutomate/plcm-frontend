'use client';

import { useEffect } from 'react';
import { useDataStore } from '@/lib/data-store';

/** Load full hierarchy into the store when a page needs it (dashboard, search, etc.). */
export function useEnsureHierarchy() {
  const { ensureHierarchyLoaded, hierarchyLoading, hierarchyReady, hierarchyAttempted } =
    useDataStore();

  useEffect(() => {
    void ensureHierarchyLoaded();
  }, [ensureHierarchyLoaded]);

  return { hierarchyLoading, hierarchyReady, hierarchyAttempted };
}

/**
 * For list/detail pages that depend on systems → components in the store.
 * Blocks render until store bootstrap completes; hierarchy loads in background.
 */
export function useEntityHierarchyGate() {
  const { loading, hierarchyLoading, hierarchyReady, hierarchyAttempted, ensureHierarchyLoaded } =
    useDataStore();

  useEffect(() => {
    void ensureHierarchyLoaded();
  }, [ensureHierarchyLoaded]);

  const pageLoading = loading;

  return { pageLoading, loading, hierarchyLoading, hierarchyReady, hierarchyAttempted };
}
