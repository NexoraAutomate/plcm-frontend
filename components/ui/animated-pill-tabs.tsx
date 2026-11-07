'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { TabsList } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * App-wide accent for segmented pill tabs (matches Create Inventory dialog).
 * Prefer importing tab primitives from this module when adding multitabs elsewhere.
 */
export const PILL_TABS_ACCENT = '#10A37F';

/** @deprecated Prefer PILL_TABS_ACCENT — kept for upload / legacy imports. */
export const UPLOAD_ACCENT = PILL_TABS_ACCENT;

/** Outer capsule for segmented controls. */
export const pillTabsListClassName =
  'flex h-auto w-full flex-wrap justify-start gap-0.5 rounded-full border bg-background p-1';

/** Static (non-animated) active fill — prefer AnimatedPillTabsList + animatedPillTabsTriggerClassName. */
export const pillTabsTriggerClassName =
  'flex-1 rounded-full px-3 py-1.5 text-sm font-medium text-foreground shadow-none data-[state=active]:bg-[var(--pill-tabs-accent,#10A37F)] data-[state=active]:text-white data-[state=active]:shadow-none';

/** Trigger styles for AnimatedPillTabsList (active fill comes from the sliding pill). */
export const animatedPillTabsTriggerClassName = cn(
  pillTabsTriggerClassName,
  'relative z-10 data-[state=active]:bg-transparent'
);

type AnimatedPillTabsListProps = {
  value: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * App template: pill tab list with a spring-animated indicator that slides
 * along the x-axis when the active tab changes.
 *
 * Usage:
 * ```tsx
 * <Tabs value={tab} onValueChange={setTab}>
 *   <AnimatedPillTabsList value={tab}>
 *     <TabsTrigger value="a" className={animatedPillTabsTriggerClassName}>A</TabsTrigger>
 *     <TabsTrigger value="b" className={animatedPillTabsTriggerClassName}>B</TabsTrigger>
 *   </AnimatedPillTabsList>
 *   <TabsContent value="a">…</TabsContent>
 * </Tabs>
 * ```
 */
export function AnimatedPillTabsList({
  value,
  className,
  style,
  children,
}: AnimatedPillTabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const updatePill = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    if (!active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setPill({
      x: activeRect.left - listRect.left + list.scrollLeft,
      y: activeRect.top - listRect.top + list.scrollTop,
      width: activeRect.width,
      height: activeRect.height,
      ready: true,
    });
  }, []);

  useLayoutEffect(() => {
    updatePill();
  }, [value, children, updatePill]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updatePill());
    observer.observe(list);
    for (const child of Array.from(list.children)) {
      if (child instanceof HTMLElement) observer.observe(child);
    }
    window.addEventListener('resize', updatePill);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePill);
    };
  }, [updatePill, children]);

  return (
    <TabsList
      ref={listRef}
      className={cn(pillTabsListClassName, 'relative overflow-hidden', className)}
      style={{
        borderColor: PILL_TABS_ACCENT,
        ['--pill-tabs-accent' as string]: PILL_TABS_ACCENT,
        ['--upload-accent' as string]: PILL_TABS_ACCENT,
        ...style,
      }}
    >
      {pill.ready ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full bg-[var(--pill-tabs-accent)]"
          initial={false}
          animate={{
            x: pill.x,
            y: pill.y,
            width: pill.width,
            height: pill.height,
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
        />
      ) : null}
      {children}
    </TabsList>
  );
}
