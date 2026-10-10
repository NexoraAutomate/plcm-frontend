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
import {
  pillTabsListClassName,
  pillTabsTriggerClassName,
  UPLOAD_ACCENT,
} from '@/components/ui/file-drop-zone';

export { pillTabsListClassName, pillTabsTriggerClassName, UPLOAD_ACCENT };

/** Trigger styles for use with AnimatedPillTabsList (active fill comes from the sliding pill). */
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
 * Pill tab list with a spring-animated indicator that slides along the x-axis
 * when the active tab changes.
 */
export function AnimatedPillTabsList({
  value,
  className,
  style,
  children,
}: AnimatedPillTabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, width: 0, ready: false });

  const updatePill = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    if (!active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setPill({
      x: activeRect.left - listRect.left + list.scrollLeft,
      width: activeRect.width,
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
    window.addEventListener('resize', updatePill);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePill);
    };
  }, [updatePill]);

  return (
    <TabsList
      ref={listRef}
      className={cn(pillTabsListClassName, 'relative overflow-hidden', className)}
      style={{
        borderColor: UPLOAD_ACCENT,
        ['--upload-accent' as string]: UPLOAD_ACCENT,
        ...style,
      }}
    >
      {pill.ready ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-[var(--upload-accent)]"
          initial={false}
          animate={{ x: pill.x, width: pill.width }}
          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
        />
      ) : null}
      {children}
    </TabsList>
  );
}
