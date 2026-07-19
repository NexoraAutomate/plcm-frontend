'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { Inventory } from '@/lib/models';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import { AccessRestricted } from '@/components/auth/access-restricted';
import {
  getChildInventoryType,
  getInventoryTypeLabel,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import { needsSerialSelection, getSelectableInstances } from '@/lib/inventory-install';
import { InventorySerialSelectDialog } from '@/components/inventory-serial-select-dialog';
import {
  buildInitialChildSlots,
  canAddInventoryChildren,
  childTypeLabel,
  filterInventoryForChildCategory,
  inventoryStockLabel,
  loadAllowedChildHierarchyNames,
  resolveInventoryInstanceSerial,
  type ChildInstallSlot,
} from '@/lib/inventory-child-install';

export default function InventoryAddChildrenPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const inventoryId = Number(params.id);
  const instanceIdFromQuery = searchParams.get('instanceId');
  const serialFromQuery = searchParams.get('serial')?.trim() || null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inventoryItem, setInventoryItem] = useState<Inventory | null>(null);
  const [childInventory, setChildInventory] = useState<Inventory[]>([]);
  const [childHierarchies, setChildHierarchies] = useState<ChildInstallSlot[]>([]);

  const [skipAllChildren, setSkipAllChildren] = useState(false);
  const [stopAtThisLevel, setStopAtThisLevel] = useState(false);
  const [parentInstanceId, setParentInstanceId] = useState<number | null>(null);
  const [parentSerialOverride, setParentSerialOverride] = useState<string | null>(null);
  const [serialDialogOpen, setSerialDialogOpen] = useState(false);

  const parentType = inventoryItem?.inventory_type as HierarchyEntityType | undefined;
  const childType = parentType && parentType !== 'component'
    ? getChildInventoryType(parentType)
    : null;

  const parentInstanceSerial = useMemo(() => {
    if (parentSerialOverride) return parentSerialOverride;
    if (!inventoryItem) return undefined;
    return resolveInventoryInstanceSerial(inventoryItem, parentInstanceId);
  }, [inventoryItem, parentInstanceId, parentSerialOverride]);

  useEffect(() => {
    if (!Number.isFinite(inventoryId)) {
      router.replace('/inventory');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const res = await api.inventory.get(inventoryId);
        const item = res.data;
        if (!item) {
          toast.error('Inventory item not found');
          router.replace('/inventory');
          return;
        }
        if (!canAddInventoryChildren(item.inventory_type)) {
          toast.error('Components cannot have child entities');
          router.replace('/inventory');
          return;
        }

        setInventoryItem(item);
        const type = item.inventory_type as HierarchyEntityType;
        const childEntityType = getChildInventoryType(type);

        const parsedInstanceId = instanceIdFromQuery ? Number(instanceIdFromQuery) : null;
        const validInstanceId =
          parsedInstanceId != null &&
          item.instances?.some((instance) => instance.id === parsedInstanceId)
            ? parsedInstanceId
            : null;

        let resolvedInstanceId = validInstanceId;
        let resolvedSerialOverride: string | null = null;

        if (resolvedInstanceId == null && serialFromQuery) {
          const matchBySerial = item.instances?.find((instance) => {
            const serial =
              instance.original_serial_number?.trim() || instance.serial_number?.trim();
            return serial?.toLowerCase() === serialFromQuery.toLowerCase();
          });
          if (matchBySerial?.id) {
            resolvedInstanceId = matchBySerial.id;
          } else {
            // Serial belongs to a composed unit no longer in free stock.
            resolvedSerialOverride = serialFromQuery;
          }
        }

        if (resolvedInstanceId == null && !resolvedSerialOverride && needsSerialSelection(item)) {
          setSerialDialogOpen(true);
        } else if (resolvedInstanceId == null && !resolvedSerialOverride && item.instances?.length === 1) {
          resolvedInstanceId = item.instances[0].id;
        }
        setParentInstanceId(resolvedInstanceId);
        setParentSerialOverride(resolvedSerialOverride);

        const instanceSerial =
          resolvedSerialOverride ||
          resolveInventoryInstanceSerial(item, resolvedInstanceId);

        const [hierarchies, inventoryList, savedChildrenRes] = await Promise.all([
          loadAllowedChildHierarchyNames(item.name, type),
          api.inventory.list(0, 1000, childEntityType),
          api.inventory.getChildren(inventoryId, {
            parentInstanceId: resolvedInstanceId ?? undefined,
            parentInstanceSerial: instanceSerial,
          }),
        ]);

        setChildHierarchies(
          buildInitialChildSlots(hierarchies, savedChildrenRes.data ?? [])
        );
        setChildInventory(inventoryList.data ?? []);
      } catch (err) {
        console.error('Failed to load inventory add-children page:', err);
        toast.error('Failed to load inventory item');
        router.replace('/inventory');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [inventoryId, instanceIdFromQuery, serialFromQuery, router]);

  async function reloadSavedChildren(instanceId: number | null) {
    if (!inventoryItem) return;
    const instanceSerial = resolveInventoryInstanceSerial(inventoryItem, instanceId);
    const savedChildrenRes = await api.inventory.getChildren(inventoryId, {
      parentInstanceId: instanceId ?? undefined,
      parentInstanceSerial: instanceSerial,
    });
    const hierarchies = await loadAllowedChildHierarchyNames(
      inventoryItem.name,
      inventoryItem.inventory_type as HierarchyEntityType
    );
    setChildHierarchies(buildInitialChildSlots(hierarchies, savedChildrenRes.data ?? []));
  }

  function handleParentSerialConfirm(instanceId: number) {
    setParentInstanceId(instanceId);
    setParentSerialOverride(null);
    setSerialDialogOpen(false);
    router.replace(`/inventory/${inventoryId}/add-children?instanceId=${instanceId}`);
    void reloadSavedChildren(instanceId);
  }

  async function invalidateInventoryCaches() {
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
  }

  async function handleSubmit() {
    if (!inventoryItem || !parentType || !childType) return;

    if (
      needsSerialSelection(inventoryItem) &&
      parentInstanceId == null &&
      !parentSerialOverride
    ) {
      setSerialDialogOpen(true);
      return;
    }

    if (skipAllChildren) {
      try {
        setSubmitting(true);
        await api.inventory.replaceChildren(inventoryId, {
          parent_instance_id: parentInstanceId ?? undefined,
          parent_instance_serial: parentInstanceSerial,
          children: [],
        });
        await invalidateInventoryCaches();
        toast.success('Child configuration cleared');
        router.push('/inventory');
      } catch (err) {
        console.error('Failed to clear inventory children:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const activeSlots = childHierarchies.filter((slot) => !slot.skipped);
    if (activeSlots.length === 0) {
      toast.error('Select at least one child or enable "Skip adding children"');
      return;
    }

    setSubmitting(true);
    try {
      for (const slot of activeSlots) {
        if (!slot.selectedInventoryId) {
          toast.error(`Select inventory stock for "${slot.childName}" or mark it as skipped`);
          return;
        }
        const stock = childInventory.find((item) => String(item.id) === slot.selectedInventoryId);
        if (!stock) continue;

        if (
          needsSerialSelection(stock) &&
          !slot.selectedInstanceId &&
          !slot.selectedInstanceSerial
        ) {
          toast.error(`Select a serial number for "${slot.childName}" inventory stock`);
          return;
        }
      }

      const children = activeSlots.map((slot) => {
        const stock = childInventory.find((item) => String(item.id) === slot.selectedInventoryId);
        const instance = slot.selectedInstanceId
          ? stock?.instances?.find((entry) => entry.id === Number(slot.selectedInstanceId))
          : undefined;
        const serial =
          instance?.original_serial_number?.trim() ||
          instance?.serial_number?.trim() ||
          slot.selectedInstanceSerial ||
          undefined;
        return {
          child_category_name: slot.childName,
          child_inventory_id: Number(slot.selectedInventoryId),
          child_instance_id: instance?.id,
          child_instance_serial: serial,
        };
      });

      await api.inventory.replaceChildren(inventoryId, {
        parent_instance_id: parentInstanceId ?? undefined,
        parent_instance_serial: parentInstanceSerial,
        children,
      });
      await invalidateInventoryCaches();

      toast.success(
        `Saved ${children.length} child ${children.length === 1 ? 'item' : 'items'} for this inventory stock`
      );

      if (!stopAtThisLevel && childType !== 'component' && canAddInventoryChildren(childType)) {
        const lastChild = activeSlots[activeSlots.length - 1];
        const lastStock = childInventory.find(
          (item) => String(item.id) === lastChild.selectedInventoryId
        );
        if (lastStock) {
          const lastSerial =
            lastChild.selectedInstanceSerial ||
            (() => {
              const instance = lastChild.selectedInstanceId
                ? lastStock.instances?.find(
                    (entry) => entry.id === Number(lastChild.selectedInstanceId)
                  )
                : undefined;
              return (
                instance?.original_serial_number?.trim() ||
                instance?.serial_number?.trim() ||
                undefined
              );
            })();
          const childQuery = lastSerial
            ? `?serial=${encodeURIComponent(lastSerial)}`
            : lastChild.selectedInstanceId
              ? `?instanceId=${lastChild.selectedInstanceId}`
              : '';
          router.push(`/inventory/${lastStock.id}/add-children${childQuery}`);
          return;
        }
      }

      router.push('/inventory');
    } catch (err) {
      console.error('Failed to save inventory children:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save inventory children');
    } finally {
      setSubmitting(false);
    }
  }

  if (!can([P.create_inventory, P.edit_inventory])) {
    return (
      <AccessRestricted message="You do not have permission to configure inventory child entities." />
    );
  }

  if (loading || !inventoryItem || !parentType || !childType) {
    return <PageLoader />;
  }

  const parentLabel = getInventoryTypeLabel(parentType);
  const childrenLabel = childTypeLabel(parentType);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/inventory">Inventory</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Add Child Entities</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Child Entities</h1>
          <p className="mt-1 text-muted-foreground">
            Configure {childrenLabel.toLowerCase()} for inventory stock{' '}
            <span className="font-medium text-foreground">{inventoryItem.name}</span> ({parentLabel}
            ). Selected children are removed from available inventory and install automatically when
            this item is used in a project.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/inventory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent Inventory Item</CardTitle>
          <CardDescription>
            Part # {inventoryPartNumber(inventoryItem) || '—'} · Qty {inventoryItem.quantity}
            {parentInstanceSerial ? ` · Serial ${parentInstanceSerial}` : ''}
          </CardDescription>
        </CardHeader>
      </Card>

      {!skipAllChildren ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  {childrenLabel} from Inventory
                </CardTitle>
                <CardDescription>
                  Expected child categories for {inventoryItem.name}. Pick stock or skip each row.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="skipAllChildren"
                checked={skipAllChildren}
                onCheckedChange={(checked) => setSkipAllChildren(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="skipAllChildren" className="cursor-pointer">
                  Skip adding children
                </Label>
                <p className="text-xs text-muted-foreground">
                  Save without assigning child inventory for this stock item.
                </p>
              </div>
            </div>

            {childHierarchies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No child categories are defined in the hierarchy for this item.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Child Category</TableHead>
                      <TableHead>Inventory Stock</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead className="w-24 text-center">Skip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childHierarchies.map((slot, index) => {
                      const options = filterInventoryForChildCategory(
                        childInventory,
                        childType,
                        slot.childName,
                        slot.selectedInventoryId ? [Number(slot.selectedInventoryId)] : []
                      );
                      const selectedStock =
                        options.find((item) => String(item.id) === slot.selectedInventoryId) ||
                        childInventory.find((item) => String(item.id) === slot.selectedInventoryId);
                      const stockInstances = selectedStock
                        ? getSelectableInstances(selectedStock)
                        : [];
                      const composedSerialOnly =
                        Boolean(slot.selectedInstanceSerial) &&
                        !stockInstances.some(
                          (instance) => String(instance.id) === slot.selectedInstanceId
                        );
                      const stockNeedsSerial =
                        selectedStock != null &&
                        (needsSerialSelection(selectedStock) || composedSerialOnly);

                      return (
                        <TableRow key={slot.hierarchyId}>
                          <TableCell className="font-medium">{slot.childName}</TableCell>
                          <TableCell>
                            <Select
                              value={slot.selectedInventoryId}
                              onValueChange={(value) => {
                                const stock = options.find((item) => String(item.id) === value);
                                const instances = stock ? getSelectableInstances(stock) : [];
                                setChildHierarchies((prev) =>
                                  prev.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          selectedInventoryId: value,
                                          selectedInstanceId:
                                            instances.length === 1
                                              ? String(instances[0].id)
                                              : '',
                                          selectedInstanceSerial:
                                            instances.length === 1
                                              ? instances[0].original_serial_number?.trim() ||
                                                instances[0].serial_number?.trim() ||
                                                undefined
                                              : undefined,
                                        }
                                      : row
                                  )
                                );
                              }}
                              disabled={slot.skipped}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select inventory item" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.length === 0 ? (
                                  <SelectItem value="__none__" disabled>
                                    No stock available
                                  </SelectItem>
                                ) : (
                                  options.map((item) => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                      {inventoryStockLabel(item)}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {stockNeedsSerial ? (
                              composedSerialOnly ? (
                                <span className="text-sm">
                                  {slot.selectedInstanceSerial}
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (composed)
                                  </span>
                                </span>
                              ) : (
                                <Select
                                  value={slot.selectedInstanceId}
                                  onValueChange={(value) => {
                                    const instance = stockInstances.find(
                                      (entry) => String(entry.id) === value
                                    );
                                    setChildHierarchies((prev) =>
                                      prev.map((row, rowIndex) =>
                                        rowIndex === index
                                          ? {
                                              ...row,
                                              selectedInstanceId: value,
                                              selectedInstanceSerial:
                                                instance?.original_serial_number?.trim() ||
                                                instance?.serial_number?.trim() ||
                                                undefined,
                                            }
                                          : row
                                      )
                                    );
                                  }}
                                  disabled={slot.skipped}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select serial" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stockInstances.map((instance, instanceIndex) => (
                                      <SelectItem key={instance.id} value={String(instance.id)}>
                                        {instance.serial_number?.trim() ||
                                          `Unit ${instanceIndex + 1}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={slot.skipped}
                              onCheckedChange={(checked) => {
                                setChildHierarchies((prev) =>
                                  prev.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          skipped: checked === true,
                                          selectedInventoryId:
                                            checked === true ? '' : row.selectedInventoryId,
                                          selectedInstanceId:
                                            checked === true ? '' : row.selectedInstanceId,
                                          selectedInstanceSerial:
                                            checked === true ? undefined : row.selectedInstanceSerial,
                                        }
                                      : row
                                  )
                                );
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {childType !== 'component' && getChildInventoryType(childType) ? (
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="stopAtThisLevel"
                  checked={stopAtThisLevel}
                  onCheckedChange={(checked) => setStopAtThisLevel(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="stopAtThisLevel" className="cursor-pointer">
                    Stop at this level — do not continue further down the hierarchy
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    After saving {childrenLabel.toLowerCase()}, do not open the next add-children
                    screen for nested stock.
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="skipAllChildrenAlt"
                checked={skipAllChildren}
                onCheckedChange={(checked) => setSkipAllChildren(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="skipAllChildrenAlt" className="cursor-pointer">
                  Skip adding children
                </Label>
                <p className="text-xs text-muted-foreground">
                  Clear any saved child inventory configuration for this stock item.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/inventory">Cancel</Link>
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Saving...' : skipAllChildren ? 'Clear Children' : 'Save Children'}
        </Button>
      </div>

      <InventorySerialSelectDialog
        item={inventoryItem}
        open={serialDialogOpen}
        onOpenChange={(open) => {
          setSerialDialogOpen(open);
          if (!open && parentInstanceId == null) {
            router.push('/inventory');
          }
        }}
        confirmLabel="Continue"
        description={`${inventoryItem.name} has ${inventoryItem.quantity} units in stock. Choose which serial number to configure children for.`}
        onConfirm={handleParentSerialConfirm}
      />
    </div>
  );
}
