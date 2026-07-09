'use client';

import { useEffect, useMemo, useState } from 'react';
import { Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDataStore } from '@/lib/data-store';
import { filterInventoryForReplacement } from '@/lib/inventory-filter';
import { buildReplacementStockRows, type ReplacementStockRow } from '@/lib/entity-replacement';
import type { HierarchyEntityType } from '@/lib/entity-hierarchy';
import { maintenanceService } from '@/services/maintenance';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import { clearEntityCache } from '@/lib/entity-resolver';
import { invalidateProjectResolutionCache } from '@/components/hierarchy-dashboard/use-project-resolution-history';
import type { AdminHierarchyReplaceResponse } from '@/lib/models';

export interface ReplaceFromInventoryTarget {
  entityType: HierarchyEntityType;
  entityId: number;
  entityName: string;
  partNumber?: string;
  serialNumber?: string;
  replacementSequence?: number;
}

interface ReplaceFromInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  target: ReplaceFromInventoryTarget | null;
  onCompleted?: (result: AdminHierarchyReplaceResponse) => void;
}

export function ReplaceFromInventoryDialog({
  open,
  onOpenChange,
  projectId,
  target,
  onCompleted,
}: ReplaceFromInventoryDialogProps) {
  const { refreshData, ensureHierarchyLoaded } = useDataStore();
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [stockRows, setStockRows] = useState<ReplacementStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReplacementStockRow | null>(null);

  useEffect(() => {
    if (!open || !target) {
      setNotes('');
      setSearch('');
      setStockRows([]);
      setSelectedRow(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void api.inventory
      .list(0, 1000, target.entityType)
      .then(async (res) => {
        if (cancelled) return;
        const filtered = filterInventoryForReplacement(
          res.data ?? [],
          target.entityType,
          target.entityName
        );

        const withInstances = await Promise.all(
          filtered.map(async (item) => {
            if ((item.instances ?? []).length > 0 || item.quantity <= 1) {
              return item;
            }
            try {
              const instanceRes = await api.inventory.listInstances(item.id);
              return { ...item, instances: instanceRes.data ?? [] };
            } catch {
              return item;
            }
          })
        );

        if (cancelled) return;
        setStockRows(buildReplacementStockRows(withInstances));
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load replacement inventory.');
          setStockRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stockRows;
    return stockRows.filter((row) =>
      [row.name, row.partNumber, row.serialNumber, row.configurationItem, row.oemName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, stockRows]);

  const handleReplace = async () => {
    if (!target || !selectedRow) {
      toast.error('Select a replacement item from stock.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await maintenanceService.adminHierarchyReplace({
        project_id: projectId,
        entity_type: target.entityType,
        entity_id: target.entityId,
        new_part_number: selectedRow.partNumber,
        new_serial_number:
          selectedRow.serialNumber && selectedRow.serialNumber !== '—'
            ? selectedRow.serialNumber
            : undefined,
        notes: notes.trim() || undefined,
        inventory_item_id: selectedRow.inventoryId,
        inventory_instance_id: selectedRow.instanceId,
      });
      clearEntityCache();
      invalidateProjectResolutionCache(projectId);
      await ensureHierarchyLoaded({ force: true });
      await refreshData({ silent: true });
      toast.success('Replacement completed and maintenance case closed.');
      onOpenChange(false);
      onCompleted?.(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to perform replacement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Replace className="h-5 w-5" />
            Replace from Inventory
          </DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Select a replacement <strong>{target.entityType}</strong> for{' '}
                <strong>{target.entityName}</strong>. A maintenance case will be created and closed
                automatically. The original install is preserved for build history.
              </>
            ) : (
              'Select a replacement part from inventory.'
            )}
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Current Part #</p>
                <p className="font-medium">{target.partNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Serial #</p>
                <p className="font-medium">{target.serialNumber || '—'}</p>
              </div>
            </div>
            {(target.replacementSequence ?? 0) > 0 ? (
              <Badge variant="secondary" className="mt-2">
                Replacement #{target.replacementSequence}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <Input
            placeholder="Search part number, serial, name, OEM..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading stock…</p>
          ) : filteredRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching items in stock for this category.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Sr.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Part #</TableHead>
                    <TableHead>Serial #</TableHead>
                    <TableHead>Config Item</TableHead>
                    <TableHead>OEM</TableHead>
                    <TableHead className="text-right">Select</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const isSelected =
                      selectedRow?.srNo === row.srNo &&
                      selectedRow.inventoryId === row.inventoryId &&
                      selectedRow.instanceId === row.instanceId;

                    return (
                      <TableRow
                        key={`${row.inventoryId}-${row.instanceId ?? 'catalog'}-${row.srNo}`}
                        className={isSelected ? 'bg-primary/5' : undefined}
                      >
                        <TableCell>{row.srNo}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.partNumber}</TableCell>
                        <TableCell>{row.serialNumber}</TableCell>
                        <TableCell>{row.configurationItem || '—'}</TableCell>
                        <TableCell>{row.oemName || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => setSelectedRow(row)}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedRow ? (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedRow.partNumber} · {selectedRow.serialNumber}
            </p>
          ) : null}

          <div>
            <Label htmlFor="replacement-notes">Notes (optional)</Label>
            <Textarea
              id="replacement-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Reason or work order notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitting || !selectedRow}
            onClick={() => void handleReplace()}
          >
            {submitting ? 'Replacing…' : 'Replace & Close Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
