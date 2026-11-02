'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Eraser, Loader2 } from 'lucide-react';
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
import {
  MaintenanceEntityStockDetailDialog,
  type MaintenanceEntityStockSelection,
} from './maintenance-entity-stock-detail-dialog';
import { MaintenanceQrScanPlaceholder } from './maintenance-qr-scan-placeholder';
import type { EntityLookupNode, lookUpResponse } from '@/lib/models';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

interface MaintenanceLookupDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serialNumber: string;
  setSerialNumber: (value: string) => void;
  onLookup: (serialNumber: string) => Promise<void>;
  onClearLookup: () => void;
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
  const [allOptions, setAllOptions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const requestIdRef = useRef(0);

  const selectSerial = (serialNumber: string) => {
    const next = serialNumber.trim();
    if (!next) return;
    onChange(next);
    setOpen(false);
    setSearchQuery('');
    setSearchError(false);
  };

  useEffect(() => {
    if (!open) return;

    const requestId = ++requestIdRef.current;
    setSearching(true);
    setSearchError(false);

    void searchProjectSerialNumbers('', 500)
      .then((results) => {
        if (requestIdRef.current !== requestId) return;
        setAllOptions(results);
        setSearchError(false);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setAllOptions([]);
        setSearchError(true);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setSearching(false);
      });
  }, [open]);

  const trimmedQuery = searchQuery.trim();
  const options = trimmedQuery
    ? allOptions.filter((serial) =>
        serial.toLowerCase().includes(trimmedQuery.toLowerCase())
      )
    : allOptions;
  const showUseTyped =
    trimmedQuery.length > 0 &&
    !searching &&
    !options.some((option) => option.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div className="space-y-2">
      <Label htmlFor="serial-number">Serial Number</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setSearchQuery('');
            setSearching(false);
            setSearchError(false);
          } else {
            setSearchQuery(value || '');
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
            <span className="truncate">{value || 'Select serial number'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command
            shouldFilter={false}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && trimmedQuery.length > 0) {
                event.preventDefault();
                selectSerial(trimmedQuery);
              }
            }}
          >
            <CommandInput
              placeholder="Filter serial numbers..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading serials…
                </div>
              ) : (
                <>
                  {searchError ? (
                    <div className="px-3 py-2 text-sm text-destructive">
                      Serial list failed to load. You can still press Enter to use a typed value.
                    </div>
                  ) : null}
                  {!searchError && options.length === 0 && !showUseTyped ? (
                    <CommandEmpty>
                      No verified serials found on completed projects.
                    </CommandEmpty>
                  ) : null}
                  <CommandGroup className="max-h-72 overflow-auto">
                    {showUseTyped ? (
                      <CommandItem
                        value={`use-typed:${trimmedQuery}`}
                        onSelect={() => selectSerial(trimmedQuery)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            value === trimmedQuery ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        Use “{trimmedQuery}”
                      </CommandItem>
                    ) : null}
                    {options.map((serialNumber) => (
                      <CommandItem
                        key={serialNumber}
                        value={serialNumber}
                        onSelect={() => selectSerial(serialNumber)}
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
        Lists all installed and verified serials from completed (shipped) projects.
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
  onClearLookup,
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
  const canClear =
    Boolean(serialNumber.trim()) ||
    Boolean(lookupResponse) ||
    Boolean(lookupError) ||
    Boolean(caseId);
  const [stockDetailOpen, setStockDetailOpen] = useState(false);
  const [stockSelection, setStockSelection] =
    useState<MaintenanceEntityStockSelection | null>(null);
  const [lockedLookupSerial, setLockedLookupSerial] = useState<string | null>(null);
  const [suspectChildrenDone, setSuspectChildrenDone] = useState(false);
  const [suspectChildrenBusy, setSuspectChildrenBusy] = useState(false);
  const serialRef = useRef(serialNumber);
  serialRef.current = serialNumber;

  useEffect(() => {
    if (!isOpen) {
      setLockedLookupSerial(null);
      setSuspectChildrenDone(false);
      setSuspectChildrenBusy(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (lookupResponse && !lookupLoading && !lookupError) {
      setLockedLookupSerial(serialRef.current.trim());
      return;
    }
    if (!lookupResponse && !lookupLoading) {
      setLockedLookupSerial(null);
    }
  }, [lookupResponse, lookupLoading, lookupError]);

  useEffect(() => {
    setSuspectChildrenDone(false);
    setSuspectChildrenBusy(false);
  }, [caseId, lookupResponse?.matched_entity_id, lookupResponse?.matched_entity_type]);

  const handleSerialChange = (value: string) => {
    setSerialNumber(value);
  };

  const handleClearLookup = () => {
    setLockedLookupSerial(null);
    setSuspectChildrenDone(false);
    setSuspectChildrenBusy(false);
    onClearLookup();
  };

  const handleSuspectChildren = async () => {
    if (!onSuspectChildren || suspectChildrenDone || suspectChildrenBusy) return;
    setSuspectChildrenBusy(true);
    // Hide immediately to block duplicate clicks while the request runs.
    setSuspectChildrenDone(true);
    try {
      await onSuspectChildren();
    } catch {
      setSuspectChildrenDone(false);
    } finally {
      setSuspectChildrenBusy(false);
    }
  };

  const handleViewEntity = (node: EntityLookupNode) => {
    setStockSelection({
      entityType: node.entity_type,
      entityId: node.entity_id,
      label: node.label || node.entity_name,
      partNumber: node.entity_PartNumber,
      serialNumber: node.entity_SerialNumber,
    });
    setStockDetailOpen(true);
  };

  const trimmedSerial = serialNumber.trim();
  const lookupDisabled =
    Boolean(lookupLoading) ||
    trimmedSerial.length === 0 ||
    (lockedLookupSerial !== null && trimmedSerial === lockedLookupSerial);

  const showSuspectChildren =
    Boolean(lookupResponse) &&
    Boolean(caseId) &&
    canSuspectChildren &&
    Boolean(onSuspectChildren) &&
    !suspectChildrenDone;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl sm:max-w-6xl lg:max-w-7xl',
          lookupResponse ? '' : 'sm:max-w-lg'
        )}
      >
        <DialogHeader className="border-b border-border/70 px-5 py-3">
          <DialogTitle className="text-base tracking-tight">
            Maintenance Entity Lookup
          </DialogTitle>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
          <aside className="space-y-3 border-b border-border/70 bg-muted/15 p-4 lg:border-b-0 lg:border-r">
            <SerialNumberField value={serialNumber} onChange={handleSerialChange} />

            <MaintenanceQrScanPlaceholder
              disabled={lookupLoading}
              onSerialDetected={async (scannedSerial) => {
                handleSerialChange(scannedSerial);
                await onLookup(scannedSerial);
              }}
            />

            <div className="flex flex-col gap-1.5">
              <Button
                onClick={() => onLookup(serialNumber)}
                disabled={lookupDisabled}
                className="w-full"
                size="sm"
              >
                {lookupLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Lookup
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={lookupLoading || !canClear}
                onClick={handleClearLookup}
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear lookup
              </Button>

              {lookupResponse && !caseId && canCreateCase ? (
                <Button
                  onClick={onCreateCase}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  Create Maintenance Case
                </Button>
              ) : null}

              {showSuspectChildren ? (
                <Button
                  onClick={() => void handleSuspectChildren()}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={suspectChildrenBusy}
                >
                  {suspectChildrenBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Suspect Children
                </Button>
              ) : null}
            </div>

            {lookupError ? (
              <p className="text-sm text-destructive">{lookupError}</p>
            ) : null}

            {!lookupResponse ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Select a serial or scan a QR to locate verified hardware on completed
                projects.
              </p>
            ) : null}
          </aside>

          <section className="min-h-[360px] overflow-auto bg-background p-3 sm:p-4">
            {lookupResponse ? (
              <EntityLookupTree
                response={lookupResponse}
                caseId={caseId}
                onSuspectChildren={handleSuspectChildren}
                onConfirmFault={onConfirmFault}
                onViewEntity={handleViewEntity}
                suspectChildrenDone={suspectChildrenDone}
              />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                Hierarchy results appear here after lookup.
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="border-t border-border/70 px-5 py-2.5">
          <Button
            variant="outline"
            size="sm"
            disabled={lookupLoading || !canClear}
            onClick={handleClearLookup}
            className="gap-2"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <MaintenanceEntityStockDetailDialog
      open={stockDetailOpen}
      onOpenChange={setStockDetailOpen}
      selection={stockSelection}
    />
    </>
  );
}
