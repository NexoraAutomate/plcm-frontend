'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FaultyEntityStatus, FaultType, type FaultyEntity, type MaintenanceAction } from '@/lib/models';
import {
  FaultyEntityStatusBadge,
  ResolutionTypeBadge,
} from '@/components/maintenance/badges';
import {
  FaultyEntityWorkflowStatus,
  isTerminalDisplayStatus,
  mapFaultyEntityStatusFromApi,
} from '@/lib/maintenance-workflow';

interface EntityDetailSheetProps {
  entity: FaultyEntity | null;
  allEntities?: FaultyEntity[];
  actions?: MaintenanceAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmFaulty?: () => void;
  onNoFaultFound?: () => void;
  onFaultTypeChange?: (faultType: string) => void;
  onResolve?: () => void;
}

export function EntityDetailSheet({
  entity,
  allEntities = [],
  actions = [],
  open,
  onOpenChange,
  onConfirmFaulty,
  onNoFaultFound,
  onFaultTypeChange,
  onResolve,
}: EntityDetailSheetProps) {
  const [selectedFaultType, setSelectedFaultType] = useState<string>('');

  useEffect(() => {
    if (entity?.fault_type) {
      setSelectedFaultType(entity.fault_type);
    } else {
      setSelectedFaultType('');
    }
  }, [entity?.id, entity?.fault_type]);

  const handleFaultTypeChange = (value: string) => {
    setSelectedFaultType(value);
    onFaultTypeChange?.(value);
  };

  const displayStatus = entity
    ? mapFaultyEntityStatusFromApi(
        entity,
        actions.filter((a) => a.faulty_entity_id === entity.id)
      )
    : null;
  const isTerminal = displayStatus ? isTerminalDisplayStatus(displayStatus) : false;

  const details = useMemo(
    () => [
      { label: 'Part Number', value: entity?.part_number || 'N/A' },
      { label: 'Serial Number', value: entity?.serial_number || 'N/A' },
      {
        label: 'Identified At',
        value: entity?.identified_at
          ? new Date(entity.identified_at).toLocaleString()
          : 'Unknown',
      },
      {
        label: 'Assigned Engineer',
        value: entity?.identified_by ? `User #${entity.identified_by}` : 'Unassigned',
      },
    ],
    [entity]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Faulty Entity Details</SheetTitle>
          <SheetDescription>
            Review the investigation details and update the status if needed.
          </SheetDescription>
        </SheetHeader>

        {!entity ? (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            Select an entity to see investigation details.
          </div>
        ) : (
          <div className="p-3 py-4 h-full flex flex-col justify-between">
            <div className="rounded-lg p-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Faulty Entity</p>
                  <h2 className="text-xl font-semibold">{entity.entity_name}</h2>
                </div>
                <FaultyEntityStatusBadge
                  entity={entity}
                  allEntities={allEntities}
                  actions={actions}
                />
              </div>

              <div className="mt-3">
                <ResolutionTypeBadge resolutionType={entity.resolution_type} />
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-1">
                {details.map((item) => (
                  <div key={item.label} className="rounded-lg border border-border p-3">
                    <p className="text-xs font-light uppercase text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>

              {entity.status === FaultyEntityStatus.CONFIRMED_FAULTY && (
                <div className="mt-6 flex flex-col gap-2">
                  <label className="text-xs font-light uppercase text-muted-foreground">
                    Fault Type
                  </label>
                  <Select value={selectedFaultType} onValueChange={handleFaultTypeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select fault type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FaultType.ELECTRICAL}>Electrical</SelectItem>
                      <SelectItem value={FaultType.MECHANICAL}>Mechanical</SelectItem>
                      <SelectItem value={FaultType.SOFTWARE}>Software</SelectItem>
                      <SelectItem value={FaultType.ENVIRONMENTAL}>Environmental</SelectItem>
                      <SelectItem value={FaultType.HARDWARE}>Hardware</SelectItem>
                      <SelectItem value={FaultType.MANUFACTURING_DEFECT}>
                        Manufacturing Defect
                      </SelectItem>
                      <SelectItem value={FaultType.PHYSICAL_DAMAGE}>Physical Damage</SelectItem>
                      <SelectItem value={FaultType.UNCLASSIFIED}>Unclassified</SelectItem>
                      <SelectItem value={FaultType.WEAR}>Wear</SelectItem>
                      <SelectItem value={FaultType.OTHER}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={onConfirmFaulty}
                disabled={
                  !entity ||
                  displayStatus === FaultyEntityWorkflowStatus.CONFIRMED_FAULTY ||
                  isTerminal
                }
              >
                Confirm Fault
              </Button>
              <Button
                variant="secondary"
                onClick={onNoFaultFound}
                disabled={!entity || isTerminal}
              >
                No Fault Found
              </Button>
              <Button variant="default" onClick={onResolve} disabled={!entity || isTerminal}>
                Resolve
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
