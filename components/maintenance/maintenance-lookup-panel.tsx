'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronsUpDown,
  Eraser,
  Loader2,
} from 'lucide-react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

export interface MaintenanceLookupPanelProps {
  serialNumber: string;
  setSerialNumber: (value: string) => void;
  onLookup: (serialNumber: string) => Promise<void>;
  onClearLookup: () => void;
  onCreateCase: () => Promise<void>;
  lookupResponse: lookUpResponse | null;
  caseId?: number | null;
  lookupLoading?: boolean;
  lookupError?: string | null;
  onConfirmFault?: (node: EntityLookupNode) => Promise<void>;
  /** Reset lock state when the host unmounts or closes (e.g. dialog). */
  active?: boolean;
  className?: string;
  createCaseLoading?: boolean;
}

interface SerialNumberFieldProps {
  value: string;
  onSelectSerial: (serialNumber: string) => void;
  disabled?: boolean;
}

function SerialNumberField({
  value,
  onSelectSerial,
  disabled,
}: SerialNumberFieldProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allOptions, setAllOptions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const requestIdRef = useRef(0);

  const selectSerial = (serialNumber: string) => {
    const next = serialNumber.trim();
    if (!next) return;
    setOpen(false);
    setSearchQuery('');
    setSearchError(false);
    onSelectSerial(next);
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
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
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
          disabled={disabled}
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
  );
}

export function MaintenanceLookupPanel({
  serialNumber,
  setSerialNumber,
  onLookup,
  onClearLookup,
  onCreateCase,
  lookupResponse,
  caseId,
  lookupLoading,
  lookupError,
  onConfirmFault,
  active = true,
  className,
  createCaseLoading = false,
}: MaintenanceLookupPanelProps) {
  const { can } = useAuth();
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
  const [qrOpen, setQrOpen] = useState(false);
  const serialRef = useRef(serialNumber);
  serialRef.current = serialNumber;

  useEffect(() => {
    if (!active) {
      setLockedLookupSerial(null);
      setQrOpen(false);
    }
  }, [active]);

  useEffect(() => {
    if (lookupResponse && !lookupLoading && !lookupError) {
      setLockedLookupSerial(serialRef.current.trim());
      return;
    }
    if (!lookupResponse && !lookupLoading) {
      setLockedLookupSerial(null);
    }
  }, [lookupResponse, lookupLoading, lookupError]);

  const handleSelectSerial = (value: string) => {
    const next = value.trim();
    setSerialNumber(next);
    if (!next) return;
    if (lockedLookupSerial !== null && next === lockedLookupSerial) return;
    void onLookup(next);
  };

  const handleClearLookup = () => {
    setLockedLookupSerial(null);
    setQrOpen(false);
    onClearLookup();
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

  const showCreateCase = Boolean(lookupResponse) && !caseId && canCreateCase;
  const busy = Boolean(lookupLoading) || createCaseLoading;

  return (
    <>
      <div className={cn('space-y-3', className)}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[16rem] flex-1">
              <SerialNumberField
                value={serialNumber}
                onSelectSerial={handleSelectSerial}
                disabled={busy}
              />
            </div>

            <MaintenanceQrScanPlaceholder
              variant="icon"
              triggerOnly
              open={qrOpen}
              onOpenChange={setQrOpen}
              disabled={busy}
              onSerialDetected={async (scannedSerial) => {
                handleSelectSerial(scannedSerial);
              }}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  disabled={busy || !canClear}
                  onClick={handleClearLookup}
                  aria-label="Clear lookup"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear lookup</TooltipContent>
            </Tooltip>

            {lookupLoading ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Looking up…
              </span>
            ) : null}
          </div>

          <MaintenanceQrScanPlaceholder
            variant="icon"
            panelOnly
            open={qrOpen}
            onOpenChange={setQrOpen}
            disabled={busy}
            onSerialDetected={async (scannedSerial) => {
              handleSelectSerial(scannedSerial);
            }}
          />
        </div>

        {lookupError ? (
          <p className="text-sm text-destructive">{lookupError}</p>
        ) : null}

        <div
          className={cn(
            'min-h-[28rem] overflow-auto rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4'
          )}
        >
          {lookupResponse ? (
            <EntityLookupTree
              response={lookupResponse}
              caseId={caseId}
              onConfirmFault={onConfirmFault}
              onViewEntity={handleViewEntity}
              onCreateCase={onCreateCase}
              createCaseLoading={createCaseLoading}
              showCreateCase={showCreateCase}
            />
          ) : (
            <div className="flex h-full min-h-[24rem] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Hierarchy results appear here after lookup.
            </div>
          )}
        </div>
      </div>

      <MaintenanceEntityStockDetailDialog
        open={stockDetailOpen}
        onOpenChange={setStockDetailOpen}
        selection={stockSelection}
      />
    </>
  );
}
