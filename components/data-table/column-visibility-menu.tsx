'use client';

import { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  /** Show only the columns icon (keeps accessible label via aria-label). */
  iconOnly?: boolean;
  /** `dialog` opens a modal; `dropdown` keeps the compact menu. */
  variant?: 'dropdown' | 'dialog';
};

export function ColumnVisibilityMenu({
  columns,
  visibleIds,
  onToggle,
  onReset,
  className,
  label = 'Columns',
  iconOnly = false,
  variant = 'dropdown',
}: Props) {
  const visibleSet = new Set(visibleIds);
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('h-8 gap-1.5', iconOnly && 'w-8 px-0', className)}
      aria-label={label}
      title={label}
    >
      <Columns3 className="h-4 w-4" />
      {iconOnly ? null : label}
    </Button>
  );

  if (variant === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-sm gap-0 p-0 sm:max-w-sm">
          <DialogHeader className="border-b px-4 py-3 text-left sm:px-5">
            <DialogTitle>Show columns</DialogTitle>
            <DialogDescription>
              Choose which fields appear in the table.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto px-2 py-3 sm:px-3">
            {columns.map((col) => {
              const checked = visibleSet.has(col.id);
              const disabled = !!col.alwaysVisible;
              const inputId = `column-visibility-${col.id}`;
              return (
                <label
                  key={col.id}
                  htmlFor={inputId}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-muted/60',
                    disabled && 'cursor-default opacity-70'
                  )}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => {
                      if (!disabled) onToggle(col.id);
                    }}
                  />
                  <span className="min-w-0 flex-1">{col.label}</span>
                  {disabled ? (
                    <span className="text-[11px] text-muted-foreground">Required</span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between sm:space-x-0">
            {onReset ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={onReset}
              >
                Reset
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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
