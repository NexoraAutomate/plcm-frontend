'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronDown, Network } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { useDataStore } from '@/lib/data-store';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { isInventoryInStock } from '@/lib/inventory-filter';
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

  useEffect(() => {
    const fetchInventory = async () => {
      if (allowedInventoryNames.length === 0) {
        setInventoryItems([]);
        setFilteredItems([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.inventory.list(0, 1000, inventoryType);
        const allowedNames = new Set(allowedInventoryNames.map((name) => name.toLowerCase()));
        const items = (res.data || []).filter(
          (item) =>
            item.inventory_type === inventoryType &&
            allowedNames.has(item.name?.toLowerCase() ?? '') &&
            isInventoryInStock(item)
        );
        setInventoryItems(items);
        setFilteredItems(items);
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
        toast.error('Failed to load inventory items');
        setInventoryItems([]);
        setFilteredItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [inventoryType, allowedInventoryNames]);

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
    if (!isInventoryInStock(updatedInventory)) {
      setInventoryItems((items) => items.filter((invItem) => invItem.id !== itemId));
      return;
    }

    setInventoryItems((items) =>
      items.map((invItem) => (invItem.id === itemId ? { ...invItem, ...updatedInventory } : invItem))
    );
  }

  async function performUse(item: Inventory, instanceId?: number) {
    if (!isInventoryInStock(item)) {
      toast.error('This item is out of stock');
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inventory — {inventoryTypeLabel}s</CardTitle>
              <CardDescription>
                {parentEntityName} — {filteredItems.length} available {inventoryType} item
                {filteredItems.length === 1 ? '' : 's'} in stock
              </CardDescription>
            </div>
            <ChevronDown
              className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
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
                      const qty = Number(item.quantity) || 0;

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
                                qty <= 5
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {qty}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="icon-sm"
                                variant="secondary"
                                onClick={() => handleViewHierarchyClick(item)}
                                title="View Hierarchy"
                                aria-label="View Hierarchy"
                              >
                                <Network className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleUseItem(item)}
                                disabled={usingItemId === item.id}
                              >
                                {usingItemId === item.id ? 'Adding...' : 'Use'}
                              </Button>
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
            ? `${hierarchySerialSelectItem.name} has ${hierarchySerialSelectItem.quantity} units in stock. Choose which serial number to view in the hierarchy graph.`
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
