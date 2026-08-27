'use client';

import {
  INVENTORY_SOURCE,
  type InventorySource,
} from '@/lib/hierarchy-config';
import { cn } from '@/lib/utils';

type Props = {
  value: InventorySource | string | null | undefined;
  /** True when this node currently has children (must be Build). */
  canBuild: boolean;
  disabled?: boolean;
  size?: 'node' | 'dialog';
  className?: string;
  /** Called when the user tries to pick a mode that children don't allow. */
  onDenied?: (source: InventorySource, reason: string) => void;
};

export function InventorySourceToggle({
  value,
  canBuild,
  disabled,
  size = 'dialog',
  className,
  onDenied,
}: Props) {
  const compact = size === 'node';
  const isBuild = canBuild;

  const turnkeyHint = canBuild
    ? 'Has children — locked to Build. Remove all children to use Turnkey.'
    : 'Turnkey / Procured';
  const buildHint = canBuild
    ? 'Build from children'
    : 'Add child nodes to switch this node to Build.';

  const deny = (source: InventorySource, reason: string) => {
    if (disabled) return;
    onDenied?.(source, reason);
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
      aria-label="Inventory source (set automatically from children)"
    >
      <button
        type="button"
        title={turnkeyHint}
        className={cn(
          'nodrag nopan flex-1 rounded-full font-semibold leading-none tracking-tight',
          compact ? 'text-[8px]' : 'text-xs',
          !isBuild
            ? 'bg-background text-foreground shadow-sm'
            : 'cursor-not-allowed text-current opacity-40'
        )}
        aria-pressed={!isBuild}
        aria-disabled={canBuild}
        onClick={() => {
          if (canBuild) {
            deny(INVENTORY_SOURCE.TURNKEY, turnkeyHint);
          }
        }}
      >
        Turnkey
      </button>
      <button
        type="button"
        title={buildHint}
        className={cn(
          'nodrag nopan flex-1 rounded-full font-semibold leading-none tracking-tight',
          compact ? 'text-[8px]' : 'text-xs',
          isBuild
            ? 'bg-background text-foreground shadow-sm'
            : 'cursor-not-allowed text-current opacity-40'
        )}
        aria-pressed={isBuild}
        aria-disabled={!canBuild}
        onClick={() => {
          if (!canBuild) {
            deny(INVENTORY_SOURCE.BUILD_FROM_CHILDREN, buildHint);
          }
        }}
      >
        Build
      </button>
    </div>
  );
}
