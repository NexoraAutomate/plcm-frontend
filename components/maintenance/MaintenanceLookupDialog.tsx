'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { EntityLookupTree } from './EntityLookupTree';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';

interface MaintenanceLookupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  partNumber: string;
  setPartNumber: (value: string) => void;
  partNumbers: string[];
  onLookup: (partNumber: string) => Promise<void>;
  onCreateCase: () => Promise<void>;
  lookupResponse: lookUpResponse | null;
  caseId?: number | null;
  lookupLoading?: boolean;
  lookupError?: string | null;
  onSuspectChildren?: () => Promise<void>;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
}

interface PartNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

function PartNumberField({ value, onChange, options }: PartNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((partNumber) =>
      partNumber.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  return (
    <div className="space-y-2">
      <Label htmlFor="part-number">Part Number</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearchQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="part-number"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate">{value || 'Select part number'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search part number..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No part number found.</CommandEmpty>
              <CommandGroup className="max-h-72 overflow-auto">
                {filteredOptions.map((partNumber) => (
                  <CommandItem
                    key={partNumber}
                    value={partNumber}
                    onSelect={() => {
                      onChange(partNumber);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === partNumber ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {partNumber}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        {options.length} part number{options.length === 1 ? '' : 's'} available
      </p>
    </div>
  );
}

export function MaintenanceLookupDialog({
  isOpen,
  onOpenChange,
  partNumber,
  setPartNumber,
  partNumbers,
  onLookup,
  onCreateCase,
  lookupResponse,
  caseId,
  lookupLoading,
  lookupError,
  onSuspectChildren,
  onConfirmFault,
}: MaintenanceLookupDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl lg:max-w-7xl',
          lookupResponse ? '' : 'sm:max-w-lg'
        )}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Maintenance Entity Lookup</DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <aside className="space-y-4 border-b bg-muted/20 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <PartNumberField
              value={partNumber}
              onChange={setPartNumber}
              options={partNumbers}
            />

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => onLookup(partNumber)}
                disabled={lookupLoading || partNumber.trim().length === 0}
                className="w-full"
              >
                {lookupLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Lookup
              </Button>

              {lookupResponse && !caseId ? (
                <Button onClick={onCreateCase} variant="secondary" className="w-full">
                  Create Maintenance Case
                </Button>
              ) : null}

              {lookupResponse && caseId ? (
                <Button onClick={onSuspectChildren} variant="secondary" className="w-full">
                  Suspect Children
                </Button>
              ) : null}
            </div>

            {lookupError ? (
              <p className="text-sm text-destructive">{lookupError}</p>
            ) : null}

            {!lookupResponse ? (
              <p className="text-sm text-muted-foreground">
                Select a part number, then run lookup to load the entity hierarchy.
              </p>
            ) : null}
          </aside>

          <section className="min-h-[360px] overflow-auto p-4 sm:p-6">
            {lookupResponse ? (
              <EntityLookupTree
                response={lookupResponse}
                caseId={caseId}
                onSuspectChildren={onSuspectChildren}
                onConfirmFault={onConfirmFault}
              />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Hierarchy results will appear here after lookup.
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
