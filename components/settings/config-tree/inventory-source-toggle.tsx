'use client';

import {
  INVENTORY_SOURCE,
  normalizeInventorySource,
  type InventorySource,
} from '@/lib/hierarchy-config';
import { cn } from '@/lib/utils';

type Props = {
  value: InventorySource | string | null | undefined;
  /** True when this node currently has children (Build / Group allowed). */
  canBuild: boolean;
  disabled?: boolean;
  size?: 'node' | 'dialog';
  className?: string;
  onChange?: (source: InventorySource) => void;
  /** Called when the user tries to pick a mode that children don't allow. */
  onDenied?: (source: InventorySource, reason: string) => void;
};

const OPTIONS: Array<{
  value: InventorySource;
  label: string;
  requiresChildren: boolean;
}> = [
  {
    value: INVENTORY_SOURCE.TURNKEY,
    label: 'Turnkey',
    requiresChildren: false,
  },
  {
    value: INVENTORY_SOURCE.BUILD_FROM_CHILDREN,
    label: 'Build',
    requiresChildren: true,
  },
  {
    value: INVENTORY_SOURCE.GROUP,
    label: 'Group',
    requiresChildren: true,
  },
];

export function InventorySourceToggle({
  value,
  canBuild,
  disabled,
  size = 'dialog',
  className,
  onChange,
  onDenied,
}: Props) {
  const compact = size === 'node';
  const current = normalizeInventorySource(value);

  const hintFor = (source: InventorySource, requiresChildren: boolean) => {
    if (requiresChildren && !canBuild) {
      return 'Add child nodes before selecting Build or Group.';
    }
    if (source === INVENTORY_SOURCE.TURNKEY) {
      return canBuild
        ? 'Turnkey / Procured — reserved from inventory even with children'
        : 'Turnkey / Procured';
    }
    if (source === INVENTORY_SOURCE.GROUP) {
      return 'Group — logical only; install verified when all children are verified';
    }
    return 'Build from children — inventory created when children are verified';
  };

  const select = (source: InventorySource, requiresChildren: boolean) => {
    if (disabled) return;
    if (requiresChildren && !canBuild) {
      onDenied?.(source, hintFor(source, requiresChildren));
      return;
    }
    onChange?.(source);
  };

  return (
    <div
      className={cn(
        'nodrag nopan nowheel relative z-30 flex rounded-full bg-black/10 p-px dark:bg-white/10',
        compact ? 'mt-0.5 h-5 w-full' : 'h-9 w-full',
        disabled && 'opacity-70',
        className
      )}
      role="group"
      aria-label="Inventory source"
    >
      {OPTIONS.map((option) => {
        const allowed = !option.requiresChildren || canBuild;
        const active = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={hintFor(option.value, option.requiresChildren)}
            className={cn(
              'nodrag nopan flex-1 rounded-full font-semibold leading-none tracking-tight',
              compact ? 'text-[8px]' : 'text-xs',
              active
                ? 'bg-background text-foreground shadow-sm'
                : allowed
                  ? 'text-current opacity-70 hover:opacity-100'
                  : 'cursor-not-allowed text-current opacity-40'
            )}
            aria-pressed={active}
            aria-disabled={!allowed || disabled}
            onClick={(e) => {
              e.stopPropagation();
              select(option.value, option.requiresChildren);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
