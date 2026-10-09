'use client';

import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnVisibilityDef } from '@/hooks/use-column-visibility';
import { cn } from '@/lib/utils';

type Props = {
  columns: ColumnVisibilityDef[];
  visibleIds: string[];
  onToggle: (id: string) => void;
  onReset?: () => void;
  className?: string;
  label?: string;
};

export function ColumnVisibilityMenu({
  columns,
  visibleIds,
  onToggle,
  onReset,
  className,
  label = 'Columns',
}: Props) {
  const visibleSet = new Set(visibleIds);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-8 gap-1.5', className)}
          aria-label={label}
        >
          <Columns3 className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={visibleSet.has(col.id)}
            disabled={col.alwaysVisible}
            onCheckedChange={() => onToggle(col.id)}
            onSelect={(e) => e.preventDefault()}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
        {onReset ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={onReset}
            >
              Reset to default
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
