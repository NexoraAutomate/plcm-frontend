'use client';

import { Group, KeyRound, Wrench, type LucideIcon } from 'lucide-react';
import {
  INVENTORY_SOURCE,
  inventorySourceLabel,
  normalizeInventorySource,
  type InventorySource,
} from '@/lib/hierarchy-config';
import { cn } from '@/lib/utils';

const SOURCE_ICON: Record<
  InventorySource,
  { Icon: LucideIcon; className: string; title: string }
> = {
  [INVENTORY_SOURCE.TURNKEY]: {
    Icon: KeyRound,
    className: 'text-teal-600 dark:text-teal-400',
    title: 'Turnkey / Procured',
  },
  [INVENTORY_SOURCE.BUILD_FROM_CHILDREN]: {
    Icon: Wrench,
    className: 'text-violet-600 dark:text-violet-400',
    title: 'Build from Children',
  },
  [INVENTORY_SOURCE.GROUP]: {
    Icon: Group,
    className: 'text-sky-600 dark:text-sky-400',
    title: 'Group (logical)',
  },
};

type Props = {
  source?: string | null;
  className?: string;
  /** Icon size classes; default fits card/shell titles. */
  iconClassName?: string;
};

/** Small leading icon for Turnkey / Build / Group on hierarchy entity shells. */
export function EntityInventorySourceIcon({
  source,
  className,
  iconClassName,
}: Props) {
  const normalized = normalizeInventorySource(source);
  const meta = SOURCE_ICON[normalized];
  const { Icon } = meta;
  const label = inventorySourceLabel(normalized);

  return (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      title={meta.title}
      aria-label={label}
    >
      <Icon
        className={cn('h-3.5 w-3.5', meta.className, iconClassName)}
        aria-hidden
      />
    </span>
  );
}
