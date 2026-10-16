'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ReserveSerialComboboxProps {
  value?: string;
  options: string[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Normalize for smart match: strip SN prefix and ignore separators. */
function normalizeSerialToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^sn[\s-]*/i, '')
    .replace(/[\s_-]+/g, '');
}

function serialMatchesQuery(serial: string, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  if (serial.toLowerCase().includes(trimmed)) return true;
  if (`sn ${serial}`.toLowerCase().includes(trimmed)) return true;
  const normalizedQuery = normalizeSerialToken(query);
  if (!normalizedQuery) return true;
  return normalizeSerialToken(serial).includes(normalizedQuery);
}

export function ReserveSerialCombobox({
  value,
  options,
  onValueChange,
  disabled = false,
  className,
}: ReserveSerialComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(
    () => options.filter((serial) => serialMatchesQuery(serial, searchQuery)),
    [options, searchQuery]
  );

  return (
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
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Serial number"
          disabled={disabled}
          className={cn('w-38 justify-between font-normal', className)}
        >
          <span className="truncate">{value || 'Serial #'}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(var(--radix-popover-trigger-width)*1.25)] min-w-60 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search serial..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No serial found.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-auto">
              {filteredOptions.map((serial) => (
                <CommandItem
                  key={serial}
                  value={serial}
                  className="pr-8"
                  onSelect={() => {
                    onValueChange(serial);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <span className="truncate">{serial}</span>
                  <Check
                    className={cn(
                      'absolute right-2 h-4 w-4',
                      value === serial ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
