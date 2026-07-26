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

type AppFullscreenContextValue = {
  /**
   * True when browser fullscreen is requested and the top navbar is hidden.
   * Sidebar is also hidden only on executive / hierarchy dashboard routes.
   */
  active: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
};

const AppFullscreenContext = createContext<AppFullscreenContextValue | null>(null);

async function requestBrowserFullscreen() {
  const root = document.documentElement;
  if (document.fullscreenElement) return;
  try {
    await root.requestFullscreen?.();
  } catch {
    // Browser may block without a user gesture — app chrome still hides.
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

export function AppFullscreenProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  const exit = useCallback(() => {
    setActive(false);
    void exitBrowserFullscreen();
  }, []);

  const enter = useCallback(() => {
    setActive(true);
    void requestBrowserFullscreen();
  }, []);

  const toggle = useCallback(() => {
    if (active) exit();
    else enter();
  }, [active, enter, exit]);

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
      if (document.fullscreenElement) return;
      event.preventDefault();
      exit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, exit]);

  const value = useMemo(
    () => ({
      active,
      enter,
      exit,
      toggle,
    }),
    [active, enter, exit, toggle]
  );

  return (
    <AppFullscreenContext.Provider value={value}>{children}</AppFullscreenContext.Provider>
  );
}

export function useAppFullscreen() {
  const ctx = useContext(AppFullscreenContext);
  if (!ctx) {
    return {
      active: false,
      enter: () => undefined,
      exit: () => undefined,
      toggle: () => undefined,
    };
  }
  return ctx;
}

/** @deprecated Use useAppFullscreen — kept for existing executive imports. */
export function useExecutivePresentation() {
  return useAppFullscreen();
}
