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
import { usePathname } from 'next/navigation';

type ExecutivePresentationContextValue = {
  /** True when sidebar/navbar are hidden and (when allowed) browser chrome is fullscreen. */
  active: boolean;
  enter: () => void;
  exit: () => void;
};

const ExecutivePresentationContext =
  createContext<ExecutivePresentationContextValue | null>(null);

async function requestBrowserFullscreen() {
  const root = document.documentElement;
  if (document.fullscreenElement) return;
  try {
    await root.requestFullscreen?.();
  } catch {
    // Browser may block without a fresh user gesture — app chrome still hides.
  }
}

async function exitBrowserFullscreen() {
  if (!document.fullscreenElement) return;
  try {
    await document.exitFullscreen?.();
  } catch {
    // ignore
  }
}

export function ExecutivePresentationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExecutiveRoute = pathname?.startsWith('/executive-dashboard') ?? false;
  const [active, setActive] = useState(false);

  const exit = useCallback(() => {
    setActive(false);
    void exitBrowserFullscreen();
  }, []);

  const enter = useCallback(() => {
    setActive(true);
    void requestBrowserFullscreen();
  }, []);

  // Leave presentation when navigating away from the executive dashboard.
  useEffect(() => {
    if (!isExecutiveRoute && active) {
      setActive(false);
      void exitBrowserFullscreen();
    }
  }, [isExecutiveRoute, active]);

  // Sync when user exits browser fullscreen (Esc / browser UI).
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && active) {
        setActive(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [active]);

  // Escape restores normal view when browser fullscreen was denied / unavailable.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // If browser still owns fullscreen, it will exit FS first; fullscreenchange handles sync.
      if (document.fullscreenElement) return;
      event.preventDefault();
      exit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, exit]);

  const value = useMemo(
    () => ({
      active: active && isExecutiveRoute,
      enter,
      exit,
    }),
    [active, isExecutiveRoute, enter, exit]
  );

  return (
    <ExecutivePresentationContext.Provider value={value}>
      {children}
    </ExecutivePresentationContext.Provider>
  );
}

export function useExecutivePresentation() {
  const ctx = useContext(ExecutivePresentationContext);
  if (!ctx) {
    return {
      active: false,
      enter: () => undefined,
      exit: () => undefined,
    };
  }
  return ctx;
}
