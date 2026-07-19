'use client';

import { useEffect, useRef, useState } from 'react';
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
import { searchProjectSerialNumbers } from '@/lib/serial-numbers';
import { EntityLookupTree } from './EntityLookupTree';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

interface MaintenanceLookupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serialNumber: string;
  setSerialNumber: (value: string) => void;
  onLookup: (serialNumber: string) => Promise<void>;
  onCreateCase: () => Promise<void>;
  lookupResponse: lookUpResponse | null;
  caseId?: number | null;
  lookupLoading?: boolean;
  lookupError?: string | null;
  onSuspectChildren?: () => Promise<void>;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
}

interface SerialNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function SerialNumberField({ value, onChange }: SerialNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    const q = searchQuery.trim();
    if (q.length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setSearching(true);
    const timeoutId = window.setTimeout(() => {
      void searchProjectSerialNumbers(q, 25)
        .then((results) => {
          if (requestIdRef.current !== requestId) return;
          setOptions(results);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          setOptions([]);
        })
        .finally(() => {
          if (requestIdRef.current !== requestId) return;
          setSearching(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, searchQuery]);

  return (
    <div className="space-y-2">
      <Label htmlFor="serial-number">Serial Number</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchQuery('');
            setOptions([]);
            setSearching(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="serial-number"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-10 w-full justify-between font-normal"
          >
            <span className="truncate">{value || 'Search serial number'}</span>
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
              placeholder="Type at least 2 characters..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : searchQuery.trim().length < 2 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  Type at least 2 characters to search project-installed serials.
                </div>
              ) : (
                <>
                  <CommandEmpty>No matching project-installed serial.</CommandEmpty>
                  <CommandGroup className="max-h-72 overflow-auto">
                    {options.map((serialNumber) => (
                      <CommandItem
                        key={serialNumber}
                        value={serialNumber}
                        onSelect={() => {
                          onChange(serialNumber);
                          setOpen(false);
                          setSearchQuery('');
                          setOptions([]);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === serialNumber ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {serialNumber}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Searches only serials installed under a project (not inventory stock).
      </p>
    </div>
  );
}

export function MaintenanceLookupDialog({
  isOpen,
  onOpenChange,
  serialNumber,
  setSerialNumber,
  onLookup,
  onCreateCase,
  lookupResponse,
  caseId,
  lookupLoading,
  lookupError,
  onSuspectChildren,
  onConfirmFault,
}: MaintenanceLookupDialogProps) {
  const { can } = useAuth();
  const canSuspectChildren = can(P.suspect_children);
  const canCreateCase = can(P.create_maintenance_cases);

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
            <SerialNumberField value={serialNumber} onChange={setSerialNumber} />

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => onLookup(serialNumber)}
                disabled={lookupLoading || serialNumber.trim().length === 0}
                className="w-full"
              >
                {lookupLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Lookup
              </Button>

              {lookupResponse && !caseId && canCreateCase ? (
                <Button onClick={onCreateCase} variant="secondary" className="w-full">
                  Create Maintenance Case
                </Button>
              ) : null}

              {lookupResponse && caseId && canSuspectChildren ? (
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
                Type a serial to search project-installed hardware, then run lookup.
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
