'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronDown, Network, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { useDataStore } from '@/lib/data-store';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  isInventoryInStock,
  isInventoryReturnPendingOnly,
  isInventoryVisibleForInstall,
} from '@/lib/inventory-filter';
import {
  getSelectableInstances,
  needsSerialSelection,
} from '@/lib/inventory-install';
import { formatUserRef } from '@/lib/user-display';
import { InventorySerialSelectDialog } from '@/components/inventory-serial-select-dialog';
import { InventoryHierarchyDialog } from '@/components/inventory-hierarchy-dialog';
import type { Inventory } from '@/lib/models';
import { getInventoryTypeLabel, type HierarchyEntityType } from '@/lib/entity-hierarchy';

interface EntityInventorySearchProps {
  parentEntityName: string;
  inventoryType: HierarchyEntityType;
  allowedInventoryNames: string[];
  onUseInventory: (item: Inventory, instanceId?: number) => Promise<Inventory | void>;
}

function resolveInventoryHolderId(item: Inventory): number | undefined {
  if (item.holder_user_id) return item.holder_user_id;
  return item.instances?.find((instance) => instance.holder_user_id)?.holder_user_id;
}

function resolveInventoryLocation(item: Inventory): string {
  if (item.location?.trim()) return item.location;
  const locations = (item.instances ?? [])
    .map((instance) => instance.location?.trim())
    .filter((location): location is string => Boolean(location));
  if (locations.length === 0) return '—';
  return [...new Set(locations)].join(', ');
}

function displayQty(item: Inventory): number {
  const installable = getSelectableInstances(item).length;
  if (installable > 0) return installable;
  return Number(item.available_quantity ?? item.quantity) || 0;
}

export function EntityInventorySearch({
  parentEntityName,
  inventoryType,
  allowedInventoryNames,
  onUseInventory,
}: EntityInventorySearchProps) {
  const { users } = useDataStore();
  const [inventoryItems, setInventoryItems] = useState<Inventory[]>([]);
  const [filteredItems, setFilteredItems] = useState<Inventory[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [usingItemId, setUsingItemId] = useState<number | null>(null);
  const [serialDialogItem, setSerialDialogItem] = useState<Inventory | null>(null);
  const [hierarchySerialSelectItem, setHierarchySerialSelectItem] = useState<Inventory | null>(
    null
  );
  const [hierarchyView, setHierarchyView] = useState<{
    item: Inventory;
    instanceId?: number;
  } | null>(null);

  const inventoryTypeLabel = getInventoryTypeLabel(inventoryType);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  function getHolderName(item: Inventory): string {
    const holderId = resolveInventoryHolderId(item);
    const holder = holderId != null ? usersById.get(holderId) : undefined;
    return holder ? formatUserRef(holder) : '—';
  }

  const fetchInventory = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (allowedInventoryNames.length === 0) {
        setInventoryItems([]);
        setFilteredItems([]);
        setLoading(false);
        return;
      }

      try {
        if (opts?.silent) setRefreshing(true);
        else setLoading(true);
        const res = await api.inventory.list(0, 1000, inventoryType);
        const allowedNames = new Set(allowedInventoryNames.map((name) => name.toLowerCase()));
        const rawItems = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as { items?: Inventory[] } | undefined)?.items)
            ? ((res.data as { items: Inventory[] }).items ?? [])
            : [];
        const items = rawItems.filter(
          (item) =>
            item.inventory_type === inventoryType &&
            allowedNames.has(item.name?.toLowerCase() ?? '') &&
            isInventoryVisibleForInstall(item)
        );

        // Ensure serial rows are present for installable groups (list payloads can omit them).
        const hydrated = await Promise.all(
          items.map(async (item) => {
            if ((item.instances ?? []).length > 0) return item;
            if (Number(item.available_quantity ?? item.quantity ?? 0) <= 0) return item;
            try {
              const instRes = await api.inventory.listInstances(item.id);
              return { ...item, instances: instRes.data ?? [] };
            } catch {
              return item;
            }
          })
        );

        setInventoryItems(hydrated);
        setFilteredItems(hydrated);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
        toast.error('Failed to load inventory items');
        setInventoryItems([]);
        setFilteredItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [inventoryType, allowedInventoryNames]
  );

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    const searchLower = search.toLowerCase();
    const filtered = inventoryItems.filter((item) => {
      const holderName = getHolderName(item).toLowerCase();
      const location = resolveInventoryLocation(item).toLowerCase();
      return (
        item.name?.toLowerCase().includes(searchLower) ||
        item.serial_number?.toLowerCase().includes(searchLower) ||
        item.part_number?.toLowerCase().includes(searchLower) ||
        item.oem_name?.toLowerCase().includes(searchLower) ||
        holderName.includes(searchLower) ||
        (location !== '—' && location.includes(searchLower))
      );
    });
    setFilteredItems(filtered);
  }, [search, inventoryItems, usersById]);

  function updateInventoryRow(itemId: number, updatedInventory: Inventory) {
    if (!isInventoryVisibleForInstall(updatedInventory)) {
      setInventoryItems((items) => items.filter((invItem) => invItem.id !== itemId));
      return;
    }

    setInventoryItems((items) =>
      items.map((invItem) => (invItem.id === itemId ? { ...invItem, ...updatedInventory } : invItem))
    );
  }

  async function performUse(item: Inventory, instanceId?: number) {
    if (!isInventoryInStock(item)) {
      toast.error(
        isInventoryReturnPendingOnly(item)
          ? 'Return under progress — waiting for admin acceptance'
          : 'This item is out of stock'
      );
      return;
    }

    // Close serial dialog before the recursive install so it does not flicker
    // while each child entity is created.
    setSerialDialogItem(null);
    setUsingItemId(item.id);
    try {
      const updatedInventory = await onUseInventory(item, instanceId);
      if (updatedInventory) {
        updateInventoryRow(item.id, updatedInventory);
      }
    } catch (err) {
      console.error('Failed to use inventory item:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to use inventory item');
    } finally {
      setUsingItemId(null);
    }
  }

  function handleUseItem(item: Inventory) {
    if (isInventoryReturnPendingOnly(item)) return;
    if (needsSerialSelection(item)) {
      setSerialDialogItem(item);
      return;
    }
    void performUse(item);
  }

  function openHierarchyView(item: Inventory, instanceId?: number) {
    setHierarchyView({ item, instanceId });
  }

  function handleViewHierarchyClick(item: Inventory) {
    if (needsSerialSelection(item)) {
      setHierarchySerialSelectItem(item);
      return;
    }
    const instances = getSelectableInstances(item);
    const instanceId = instances.length === 1 ? instances[0].id : undefined;
    openHierarchyView(item, instanceId);
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory — {inventoryTypeLabel}s</CardTitle>
          <CardDescription>Loading available {inventoryType} inventory...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const emptyMessage =
    allowedInventoryNames.length === 0
      ? `No hierarchy template for ${parentEntityName}. Ask an admin to define allowed ${inventoryType} names.`
      : inventoryItems.length === 0
        ? `No issued ${inventoryType} inventory matching ${parentEntityName}'s hierarchy`
        : 'No matching inventory items';

  return (
    <>
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Inventory — {inventoryTypeLabel}s</CardTitle>
              <CardDescription>
                {parentEntityName} — {filteredItems.length} available {inventoryType} item
                {filteredItems.length === 1 ? '' : 's'} in stock
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={refreshing}
                title="Refresh inventory"
                aria-label="Refresh inventory"
                onClick={(e) => {
                  e.stopPropagation();
                  void fetchInventory({ silent: true });
                }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, serial, part number, OEM, holder, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>OEM</TableHead>
                      <TableHead>Inventory Holder</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const qty = displayQty(item);
                      const pendingOnly = isInventoryReturnPendingOnly(item);

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm">{item.serial_number || '—'}</TableCell>
                          <TableCell className="text-sm">{inventoryPartNumber(item) || '—'}</TableCell>
                          <TableCell className="text-sm">{item.oem_name || '—'}</TableCell>
                          <TableCell className="text-sm">{getHolderName(item)}</TableCell>
                          <TableCell className="text-sm">{resolveInventoryLocation(item)}</TableCell>
                          <TableCell className="text-right font-medium">
                            <span
                              className={`px-2 py-1 rounded ${
                                pendingOnly
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : qty <= 5
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {pendingOnly ? item.quantity || qty || 1 : qty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {!pendingOnly ? (
                                <Button
                                  size="icon-sm"
                                  variant="secondary"
                                  onClick={() => handleViewHierarchyClick(item)}
                                  title="View Hierarchy"
                                  aria-label="View Hierarchy"
                                >
                                  <Network className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {pendingOnly ? (
                                <Button size="sm" variant="outline" disabled>
                                  Return under progress
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleUseItem(item)}
                                  disabled={usingItemId === item.id}
                                >
                                  {usingItemId === item.id ? 'Adding...' : 'Use'}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <InventorySerialSelectDialog
        item={serialDialogItem}
        open={serialDialogItem != null}
        onOpenChange={(open) => {
          if (!open) setSerialDialogItem(null);
        }}
        confirming={serialDialogItem != null && usingItemId === serialDialogItem.id}
        onConfirm={(instanceId) => {
          if (serialDialogItem) {
            void performUse(serialDialogItem, instanceId);
          }
        }}
      />

      <InventorySerialSelectDialog
        item={hierarchySerialSelectItem}
        open={hierarchySerialSelectItem != null}
        onOpenChange={(open) => {
          if (!open) setHierarchySerialSelectItem(null);
        }}
        confirmLabel="View Hierarchy"
        description={
          hierarchySerialSelectItem
            ? `${hierarchySerialSelectItem.name} has ${getSelectableInstances(hierarchySerialSelectItem).length} installable unit(s). Choose which serial number to view in the hierarchy graph.`
            : undefined
        }
        onConfirm={(instanceId) => {
          if (hierarchySerialSelectItem) {
            openHierarchyView(hierarchySerialSelectItem, instanceId);
            setHierarchySerialSelectItem(null);
          }
        }}
      />

      <InventoryHierarchyDialog
        item={hierarchyView?.item ?? null}
        instanceId={hierarchyView?.instanceId}
        open={hierarchyView != null}
        onOpenChange={(open) => {
          if (!open) setHierarchyView(null);
        }}
      />
    </>
  );
}
