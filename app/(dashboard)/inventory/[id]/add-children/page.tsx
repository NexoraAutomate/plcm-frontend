'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Layers } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { useDataStore } from '@/lib/data-store';
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
import type { Inventory, Status } from '@/lib/models';
import {
  getChildInventoryType,
  getInventoryTypeLabel,
  type HierarchyEntityType,
} from '@/lib/entity-hierarchy';
import { inventoryPartNumber } from '@/lib/inventory-entity-fields';
import {
  buildInitialChildSlots,
  canAddInventoryChildren,
  childTypeLabel,
  filterInventoryForChildCategory,
  findInstalledParentOptions,
  installEntityFromInventory,
  listParentFkTargets,
  loadAllowedChildHierarchyNames,
  inventoryStockLabel,
  PARENT_FK_ENTITY_TYPE,
  STATUS_TYPE_BY_ENTITY,
  type ChildInstallSlot,
} from '@/lib/inventory-child-install';

type ParentMode = 'existing' | 'install';

export default function InventoryAddChildrenPage() {
  const params = useParams();
  const router = useRouter();
  const inventoryId = Number(params.id);

  const {
    projects,
    systems,
    subsystems,
    modules,
    units,
    components,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
  } = useDataStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inventoryItem, setInventoryItem] = useState<Inventory | null>(null);
  const [childInventory, setChildInventory] = useState<Inventory[]>([]);
  const [childHierarchies, setChildHierarchies] = useState<ChildInstallSlot[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);

  const [parentMode, setParentMode] = useState<ParentMode>('existing');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [parentFkTargetId, setParentFkTargetId] = useState('');
  const [skipAllChildren, setSkipAllChildren] = useState(false);
  const [stopAtThisLevel, setStopAtThisLevel] = useState(false);

  const hierarchyContext = useMemo(
    () => ({ projects, systems, subsystems, modules, units, components }),
    [projects, systems, subsystems, modules, units, components]
  );

  const parentType = inventoryItem?.inventory_type as HierarchyEntityType | undefined;
  const childType = parentType && parentType !== 'component'
    ? getChildInventoryType(parentType)
    : null;

  const installedParentOptions = useMemo(() => {
    if (!inventoryItem) return [];
    return findInstalledParentOptions(inventoryItem, hierarchyContext);
  }, [inventoryItem, hierarchyContext]);

  const parentFkTargets = useMemo(() => {
    if (!parentType) return [];
    return listParentFkTargets(parentType, hierarchyContext);
  }, [parentType, hierarchyContext]);

  const createEntityByType = useCallback(
    (type: HierarchyEntityType) => {
      switch (type) {
        case 'system':
          return createSystem;
        case 'subsystem':
          return createSubsystem;
        case 'module':
          return createModule;
        case 'unit':
          return createUnit;
        case 'component':
          return createComponent;
        default:
          throw new Error(`Unsupported entity type: ${type}`);
      }
    },
    [createSystem, createSubsystem, createModule, createUnit, createComponent]
  );

  const existingChildrenForParent = useCallback(
    (parentId: number) => {
      if (!childType) return [];
      switch (childType) {
        case 'subsystem':
          return subsystems.filter((item) => item.system_id === parentId);
        case 'module':
          return modules.filter((item) => item.subsystem_id === parentId);
        case 'unit':
          return units.filter((item) => item.module_id === parentId);
        case 'component':
          return components.filter((item) => item.unit_id === parentId);
        default:
          return [];
      }
    },
    [childType, subsystems, modules, units, components]
  );

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

        const [hierarchies, inventoryList, statusRes] = await Promise.all([
          loadAllowedChildHierarchyNames(item.name, type),
          api.inventory.list(0, 1000, childEntityType),
          api.statuses.list(STATUS_TYPE_BY_ENTITY[childEntityType]),
        ]);

        setChildHierarchies(buildInitialChildSlots(hierarchies));
        setChildInventory(inventoryList.data ?? []);
        setStatuses(statusRes.data ?? []);

        const installed = findInstalledParentOptions(item, {
          projects,
          systems,
          subsystems,
          modules,
          units,
          components,
        });
        if (installed.length > 0) {
          setParentMode('existing');
          setSelectedParentId(String(installed[0].id));
        } else {
          setParentMode('install');
        }
      } catch (err) {
        console.error('Failed to load inventory add-children page:', err);
        toast.error('Failed to load inventory item');
        router.replace('/inventory');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [inventoryId, router, projects, systems, subsystems, modules, units, components]);

  async function resolveParentEntityId(): Promise<number> {
    if (!inventoryItem || !parentType) {
      throw new Error('Inventory item not loaded');
    }

    if (parentMode === 'existing') {
      const parentId = Number(selectedParentId);
      if (!Number.isFinite(parentId)) {
        throw new Error('Select an installed parent entity');
      }
      return parentId;
    }

    const fkTargetId = Number(parentFkTargetId);
    if (!Number.isFinite(fkTargetId)) {
      const fkLabel = PARENT_FK_ENTITY_TYPE[parentType];
      throw new Error(
        `Select a ${fkLabel === 'project' ? 'project' : getInventoryTypeLabel(fkLabel as HierarchyEntityType)} to install under`
      );
    }

    const defaultStatus =
      (await api.statuses.list(STATUS_TYPE_BY_ENTITY[parentType])).data?.[0];

    if (!defaultStatus) {
      throw new Error(`No status available for ${getInventoryTypeLabel(parentType)}`);
    }

    const siblings =
      parentType === 'system'
        ? systems.filter((s) => s.project_id === fkTargetId)
        : parentType === 'subsystem'
          ? subsystems.filter((s) => s.system_id === fkTargetId)
          : parentType === 'module'
            ? modules.filter((m) => m.subsystem_id === fkTargetId)
            : parentType === 'unit'
              ? units.filter((u) => u.module_id === fkTargetId)
              : [];

    const created = await installEntityFromInventory({
      inventoryItem,
      parentEntityId: fkTargetId,
      entityType: parentType,
      existingChildren: siblings,
      defaultStatus,
      createEntity: createEntityByType(parentType),
    });

    return created.id;
  }

  async function handleSubmit() {
    if (!inventoryItem || !parentType || !childType) return;

    setSubmitting(true);
    try {
      let parentEntityId: number;

      if (parentMode === 'install' && skipAllChildren) {
        const fkTargetId = Number(parentFkTargetId);
        if (!Number.isFinite(fkTargetId)) {
          toast.error(`Select where to install this ${getInventoryTypeLabel(parentType)}`);
          return;
        }
        const parentStatus =
          (await api.statuses.list(STATUS_TYPE_BY_ENTITY[parentType])).data?.[0];
        if (!parentStatus) {
          toast.error('No status available for parent entity');
          return;
        }
        const siblings =
          parentType === 'system'
            ? systems.filter((s) => s.project_id === fkTargetId)
            : parentType === 'subsystem'
              ? subsystems.filter((s) => s.system_id === fkTargetId)
              : parentType === 'module'
                ? modules.filter((m) => m.subsystem_id === fkTargetId)
                : parentType === 'unit'
                  ? units.filter((u) => u.module_id === fkTargetId)
                  : [];

        await installEntityFromInventory({
          inventoryItem,
          parentEntityId: fkTargetId,
          entityType: parentType,
          existingChildren: siblings,
          defaultStatus: parentStatus,
          createEntity: createEntityByType(parentType),
        });
        toast.success(`${getInventoryTypeLabel(parentType)} installed without children`);
        router.push('/inventory');
        return;
      }

      parentEntityId = await resolveParentEntityId();

      if (skipAllChildren) {
        toast.success('Parent ready — no children were added');
        router.push('/inventory');
        return;
      }

      const childStatus = statuses[0];
      if (!childStatus) {
        toast.error(`No status available for ${getInventoryTypeLabel(childType)}`);
        return;
      }

      const activeSlots = childHierarchies.filter((slot) => !slot.skipped);
      if (activeSlots.length === 0) {
        toast.error('Select at least one child or enable "Create without children"');
        return;
      }

      let created = 0;
      let createdChildren = [...existingChildrenForParent(parentEntityId)];
      let lastChildInventoryId: number | null = null;

      for (const slot of activeSlots) {
        if (!slot.selectedInventoryId) {
          toast.error(`Select inventory stock for "${slot.childName}" or mark it as skipped`);
          return;
        }
        const stock = childInventory.find((item) => String(item.id) === slot.selectedInventoryId);
        if (!stock) continue;

        await installEntityFromInventory({
          inventoryItem: stock,
          parentEntityId,
          entityType: childType,
          existingChildren: createdChildren,
          defaultStatus: childStatus,
          createEntity: createEntityByType(childType),
        });
        createdChildren = [...createdChildren, { name: stock.name }];
        lastChildInventoryId = stock.id;
        created += 1;
      }

      toast.success(
        created > 0
          ? `Added ${created} ${getInventoryTypeLabel(childType)}${created === 1 ? '' : 's'} from inventory`
          : 'No children were added'
      );

      if (
        !stopAtThisLevel &&
        childType !== 'component' &&
        lastChildInventoryId &&
        canAddInventoryChildren(childType)
      ) {
        router.push(`/inventory/${lastChildInventoryId}/add-children`);
        return;
      }

      router.push('/inventory');
    } catch (err) {
      console.error('Failed to add child entities:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add child entities');
    } finally {
      setSubmitting(false);
    }
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
            Install {childrenLabel.toLowerCase()} from inventory under{' '}
            <span className="font-medium text-foreground">{inventoryItem.name}</span> ({parentLabel})
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
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent Entity Target</CardTitle>
          <CardDescription>
            Choose an installed {parentLabel.toLowerCase()} or install this stock item first
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="parentMode"
                checked={parentMode === 'existing'}
                onChange={() => setParentMode('existing')}
                disabled={installedParentOptions.length === 0}
              />
              Use installed {parentLabel.toLowerCase()}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="parentMode"
                checked={parentMode === 'install'}
                onChange={() => setParentMode('install')}
              />
              Install from this inventory stock
            </label>
          </div>

          {parentMode === 'existing' ? (
            <div>
              <Label>Installed {parentLabel}</Label>
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select installed ${parentLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {installedParentOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label} — {option.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {installedParentOptions.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No installed {parentLabel.toLowerCase()} matches this category. Install from stock instead.
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <Label>Install under</Label>
              <Select value={parentFkTargetId} onValueChange={setParentFkTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent in project hierarchy" />
                </SelectTrigger>
                <SelectContent>
                  {parentFkTargets.map((target) => (
                    <SelectItem key={target.id} value={String(target.id)}>
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id="skipAllChildren"
              checked={skipAllChildren}
              onCheckedChange={(checked) => setSkipAllChildren(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="skipAllChildren" className="cursor-pointer">
                Create {parentLabel.toLowerCase()} without children
              </Label>
              <p className="text-xs text-muted-foreground">
                Install or confirm the parent only — skip adding {childrenLabel.toLowerCase()} from
                inventory on this screen.
              </p>
            </div>
          </div>
        </CardContent>
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
                      <TableHead className="w-24 text-center">Skip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childHierarchies.map((slot, index) => {
                      const options = filterInventoryForChildCategory(
                        childInventory,
                        childType,
                        slot.childName
                      );
                      return (
                        <TableRow key={slot.hierarchyId}>
                          <TableCell className="font-medium">{slot.childName}</TableCell>
                          <TableCell>
                            <Select
                              value={slot.selectedInventoryId}
                              onValueChange={(value) => {
                                setChildHierarchies((prev) =>
                                  prev.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? { ...row, selectedInventoryId: value }
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
                    After adding {childrenLabel.toLowerCase()}, do not prompt to add{' '}
                    {getInventoryTypeLabel(getChildInventoryType(childType)).toLowerCase()} children
                    under them.
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/inventory">Cancel</Link>
        </Button>
        <Button onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? 'Saving...' : skipAllChildren ? `Install ${parentLabel}` : 'Add Children'}
        </Button>
      </div>
    </div>
  );
}
