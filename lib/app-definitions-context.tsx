'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as api from '@/lib/api';
import type { AppDefinitions } from '@/lib/models';
import {
  DEFAULT_APP_DEFINITIONS,
  getEntityTypeLabel,
  setRuntimeAppDefinitions,
  type HierarchyEntityLevel,
} from '@/lib/app-definitions';
import { useAuth } from '@/lib/auth-context';

type AppDefinitionsContextValue = {
  definitions: AppDefinitions;
  loading: boolean;
  refresh: () => Promise<void>;
  entityLabel: (level: string, plural?: boolean) => string;
};

const FALLBACK: AppDefinitions = { id: 0, ...DEFAULT_APP_DEFINITIONS };

const AppDefinitionsContext = createContext<AppDefinitionsContextValue | null>(null);

export function AppDefinitionsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();
  const [definitions, setDefinitions] = useState<AppDefinitions>(FALLBACK);
  const [loading, setLoading] = useState(false);

  const applyDefinitions = useCallback((next: AppDefinitions) => {
    const merged = { ...FALLBACK, ...next };
    setRuntimeAppDefinitions(merged);
    setDefinitions(merged);
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      applyDefinitions(FALLBACK);
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth.getAppDefinitions();
      applyDefinitions(res.data);
    } catch {
      // Keep defaults / last known values if API is unavailable.
    } finally {
      setLoading(false);
    }
  }, [applyDefinitions, isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, refresh]);

  const entityLabel = useCallback(
    (level: string, plural = false) => getEntityTypeLabel(definitions, level, plural),
    [definitions]
  );

  const value = useMemo(
    () => ({ definitions, loading, refresh, entityLabel }),
    [definitions, loading, refresh, entityLabel]
  );

  return (
    <AppDefinitionsContext.Provider value={value}>{children}</AppDefinitionsContext.Provider>
  );
}

export function useAppDefinitions() {
  const ctx = useContext(AppDefinitionsContext);
  if (!ctx) {
    return {
      definitions: FALLBACK,
      loading: false,
      refresh: async () => undefined,
      entityLabel: (level: string, plural = false) =>
        getEntityTypeLabel(FALLBACK, level as HierarchyEntityLevel, plural),
    };
  }
  return ctx;
}
