'use client';

import { useEffect, useMemo, useState } from 'react';
import { History, Replace } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';
import {
  filterReplacementRowsForEntity,
  type SubtreeMatchContext,
} from '@/lib/resolution-history-matching';
import type { ConfigurationHistory, Inventory, MaintenanceDelivery } from '@/lib/models';
import type { SubtreeEntityRef } from '@/lib/project-hierarchy-dashboard';
import type { HierarchyEntityType } from '@/lib/system-hierarchy-graph';
import { ReplacementHistoryDialog } from '@/components/hierarchy-dashboard/replacement-history-dialog';
import { maintenanceService } from '@/services/maintenance';
import { filterInventoryForReplacement } from '@/lib/inventory-filter';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { invalidateProjectResolutionCache } from '@/components/hierarchy-dashboard/use-project-resolution-history';
import * as api from '@/lib/api';
import { toast } from 'sonner';

interface EntityResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  entityRef: SubtreeEntityRef;
  entityType: HierarchyEntityType;
  entityPk: number;
  entityLabel: string;
  records: ConfigurationHistory[];
  matchContext: SubtreeMatchContext;
  subtreeByEntityId: Map<number, SubtreeEntityRef>;
  deliveries?: MaintenanceDelivery[];
  onCompleted?: () => void;
}

function canAdminReplace(
  user: { roles?: string[] } | null,
  hasAccess: (roles?: string[], permissions?: string[]) => boolean
) {
  if (!user) return false;
  const roles = user.roles ?? [];
  if (roles.some((role) => role.toLowerCase() === 'admin')) return true;
  return (
    hasAccess(undefined, ['edit_maintenance_cases']) &&
    hasAccess(undefined, ['create_faulty_entities'])
  );
}

export function EntityResolutionDialog({
  open,
  onOpenChange,
  projectId,
  entityRef,
  entityType,
  entityPk,
  entityLabel,
  records,
  matchContext,
  subtreeByEntityId,
  deliveries = [],
  onCompleted,
}: EntityResolutionDialogProps) {
  const { user, hasAccess } = useAuth();
  const { users, refreshData } = useDataStore();
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [replaceFormOpen, setReplaceFormOpen] = useState(false);
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const installerLabel = useMemo(() => {
    if (!entityRef.installed_by_id) return '—';
    const installer = users.find((item) => item.id === entityRef.installed_by_id);
    return installer ? formatUserRef(installer) : `User #${entityRef.installed_by_id}`;
  }, [entityRef.installed_by_id, users]);

  const originalPart = entityRef.original_part_number ?? entityRef.part_number ?? '—';
  const originalSerial = entityRef.original_serial_number ?? entityRef.serial_number ?? '—';
  const currentPart = entityRef.part_number ?? '—';
  const currentSerial = entityRef.serial_number ?? '—';

  const entityReplacementRows = useMemo(
    () =>
      filterReplacementRowsForEntity(
        records,
        entityType,
        entityPk,
        matchContext,
        subtreeByEntityId,
        deliveries
      ),
    [records, entityType, entityPk, matchContext, subtreeByEntityId, deliveries]
  );

  useEffect(() => {
    if (!replaceFormOpen) {
      setNewPartNumber('');
      setNewSerialNumber('');
      setNotes('');
      setSelectedInventoryId('');
      setInventoryItems([]);
      return;
    }

    let cancelled = false;
    void api.inventory.list(0, 1000, entityType).then((res) => {
      if (cancelled) return;
      const items = filterInventoryForReplacement(res.data ?? [], entityType, entityLabel);
      setInventoryItems(items);
    });

    return () => {
      cancelled = true;
    };
  }, [replaceFormOpen, entityType, entityLabel]);

  useEffect(() => {
    if (!selectedInventoryId) return;
    const item = inventoryItems.find((entry) => String(entry.id) === selectedInventoryId);
    if (item) {
      const part = inventoryPartNumber(item);
      if (part) setNewPartNumber(part);
    }
  }, [selectedInventoryId, inventoryItems]);

  const handleAdminReplace = async () => {
    if (!newPartNumber.trim()) {
      toast.error('Enter a replacement part number.');
      return;
    }

    setSubmitting(true);
    try {
      await maintenanceService.adminHierarchyReplace({
        project_id: projectId,
        entity_type: entityType,
        entity_id: entityPk,
        new_part_number: newPartNumber.trim(),
        new_serial_number: newSerialNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        inventory_item_id: selectedInventoryId ? Number(selectedInventoryId) : undefined,
        inventory_instance_id: undefined,
      });
      invalidateProjectResolutionCache(projectId);
      await refreshData({ silent: true });
      toast.success('Replacement completed and maintenance case closed.');
      setReplaceFormOpen(false);
      onCompleted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to perform admin replacement.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const showAdminReplace = canAdminReplace(user, hasAccess);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {entityType.charAt(0).toUpperCase()}
              {entityType.slice(1)} — {entityLabel}
            </DialogTitle>
            <DialogDescription>
              Installation identity and replacement history for this entity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Original Part #</p>
                <p className="font-medium">{originalPart}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Original Serial #</p>
                <p className="font-medium">{originalSerial}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Part #</p>
                <p className="font-medium">{currentPart}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Serial #</p>
                <p className="font-medium">{currentSerial}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Installation Date</p>
                <p className="font-medium">
                  {entityRef.installation_date || entityRef.created_at
                    ? new Date(
                        entityRef.installation_date ?? entityRef.created_at!
                      ).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Installed By</p>
                <p className="font-medium">{installerLabel}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {entityReplacementRows.length} replacement
              {entityReplacementRows.length === 1 ? '' : 's'} recorded for this entity.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setReplacementOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              View Replacement History
            </Button>
            {showAdminReplace ? (
              <Button type="button" size="sm" onClick={() => setReplaceFormOpen(true)}>
                <Replace className="mr-2 h-4 w-4" />
                Perform Replacement
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ReplacementHistoryDialog
        open={replacementOpen}
        onOpenChange={setReplacementOpen}
        title={`Replacement History — ${entityLabel}`}
        rows={entityReplacementRows}
      />

      <Dialog open={replaceFormOpen} onOpenChange={setReplaceFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Replacement</DialogTitle>
            <DialogDescription>
              Creates and closes a full maintenance case automatically for{' '}
              <strong>{entityLabel}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="new-part">New Part Number *</Label>
              <Input
                id="new-part"
                value={newPartNumber}
                onChange={(e) => setNewPartNumber(e.target.value)}
                placeholder="Replacement part number"
              />
            </div>

            {inventoryItems.length > 0 ? (
              <div>
                <Label>From Inventory (optional)</Label>
                <Select value={selectedInventoryId} onValueChange={setSelectedInventoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {inventoryPartNumber(item) || item.name} (qty {item.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <Label htmlFor="new-serial">New Serial Number</Label>
              <Input
                id="new-serial"
                value={newSerialNumber}
                onChange={(e) => setNewSerialNumber(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="replace-notes">Notes</Label>
              <Textarea
                id="replace-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional replacement notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplaceFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void handleAdminReplace()}>
              {submitting ? 'Processing…' : 'Replace & Close Case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
