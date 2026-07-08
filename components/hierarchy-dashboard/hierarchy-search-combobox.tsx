'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface HierarchySearchOption {
  value: string;
  label: string;
  description?: string;
}

interface HierarchySearchComboboxProps {
  label: string;
  placeholder?: string;
  value?: string;
  options: HierarchySearchOption[];
  onChange: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  labelClassName?: string;
}

export function HierarchySearchCombobox({
  label,
  placeholder = 'Select...',
  value,
  options,
  onChange,
  onClear,
  disabled = false,
  className,
  triggerClassName,
  labelClassName,
}: HierarchySearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className={labelClassName}>{label}</Label>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!value}
            className="h-6 shrink-0 px-1.5 text-xs text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
            onClick={onClear}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        ) : null}
      </div>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (disabled) return;
          setOpen(nextOpen);
          if (!nextOpen) setSearchQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('h-10 w-full justify-between font-normal', triggerClassName)}
          >
            <span className="truncate">
              {selectedOption?.label || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}...`}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup className="max-h-72 overflow-auto">
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate">{option.label}</p>
                      {option.description ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
