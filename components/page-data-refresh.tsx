'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RefreshHandler = () => void | Promise<unknown>;

type PageDataRefreshContextValue = {
  register: (handler: RefreshHandler) => () => void;
  refreshAll: () => Promise<void>;
};

const PageDataRefreshContext = createContext<PageDataRefreshContextValue | null>(null);

export function PageDataRefreshProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef(new Set<RefreshHandler>());

  const register = useCallback((handler: RefreshHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all(Array.from(handlersRef.current, (handler) => handler()));
  }, []);

  const value = useMemo(() => ({ register, refreshAll }), [register, refreshAll]);

  return (
    <PageDataRefreshContext.Provider value={value}>
      {children}
    </PageDataRefreshContext.Provider>
  );
}

export function usePageDataRefresh(handler: RefreshHandler) {
  const context = useContext(PageDataRefreshContext);
  useEffect(() => {
    if (!context) return;
    return context.register(handler);
  }, [context, handler]);
}

type PageRefreshButtonProps = {
  onRefresh?: RefreshHandler;
  className?: string;
};

export function PageRefreshButton({ onRefresh, className }: PageRefreshButtonProps) {
  const context = useContext(PageDataRefreshContext);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else if (context) {
        await context.refreshAll();
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void handleRefresh()}
      disabled={refreshing}
      aria-label="Refresh data"
      title="Refresh data"
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );
}
