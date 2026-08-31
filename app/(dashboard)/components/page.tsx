'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';
import { Fragment, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, Plus, Edit, Search } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';
import * as api from '@/lib/api';
import { listTemplateNames } from '@/lib/hierarchy-template-names';
import type { Component, Hierarchy } from '@/lib/models';
import { getInventoryQuantityByComponentId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { useHierarchiesQuery, useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchAllComponents, fetchComponentsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { ListPageError } from '@/components/list-page-error';
import { HierarchyListDashboard } from '@/components/hierarchy/hierarchy-list-dashboard';
import { ParentEntityLink } from '@/components/entity-link';
import { buildHierarchyPageUrl } from '@/lib/hierarchy-page-filters';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import {
  getComponentsDashboardConfig,
  COMPONENT_STATUS_NAMES,
} from '@/lib/hierarchy-dashboard-configs';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import { canManageInstall, ownInstallRowClass, showOwnInstallBadge } from '@/lib/install-ownership';
import { cn } from '@/lib/utils';
import { PageRefreshButton } from '@/components/page-data-refresh';
import {
  InstallerFilterSelect,
  resolveInstallerFilterId,
} from '@/components/installer-filter-select';

interface ComponentPartNumberGroup {
  key: string;
  partNumber: string;
  components: Component[];
}

interface ComponentTableRow {
  key: string;
  grouped: boolean;
  components: Component[];
}

function componentPartNumberKey(component: Component): string {
  const partNumber = component.part_number?.trim().toLowerCase();
  return partNumber ? `part:${partNumber}` : `component:${component.id}`;
}

function groupComponentsByPartNumber(components: Component[]): ComponentPartNumberGroup[] {
  const groups = new Map<string, ComponentPartNumberGroup>();

  for (const component of components) {
    const key = componentPartNumberKey(component);
    const existing = groups.get(key);
    if (existing) {
      existing.components.push(component);
      continue;
    }

    groups.set(key, {
      key,
      partNumber: component.part_number?.trim() || '',
      components: [component],
    });
  }

  return Array.from(groups.values());
}

export default function ComponentsPage() {
  const { entityLabel } = useAppDefinitions();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageLoading } = useEntityHierarchyGate();
  const { user, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const { units, inventory, createComponent, updateComponent, deleteComponent, users } = useDataStore();
  const faultMap = useEntityFaultMap();
  const statusFilterParam = searchParams.get('status');
  const parentFilterParam = searchParams.get('unit_id');
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'all');
  const [parentFilter, setParentFilter] = useState<string>(parentFilterParam || 'all');
  const [installerFilter, setInstallerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data: unitHierarchyNames = [] } = useHierarchiesQuery('unit');
  const { data: componentHierarchyNamesAll = [] } = useHierarchiesQuery('component');
  const { data: statuses = [] } = useStatusesByTypeQuery('components');

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusName: statusFilter,
        statuses,
        unitId: parentFilter !== 'all' ? Number(parentFilter) : null,
        installedById: resolveInstallerFilterId(installerFilter, {
          currentUserId: user?.id,
          isInventoryManager: inventoryManager,
        }),
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, statuses, parentFilter, installerFilter, user?.id, inventoryManager, listFilterPatch]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.componentsPage(listFilters),
    fetchPage: fetchComponentsPage,
    filters: listFilters,
  });
  const components = pagination.items;
  const allComponentsQuery = useQuery({
    queryKey: queryKeys.componentsAll(listFilters),
    queryFn: () => fetchAllComponents(listFilters),
    enabled: !pageLoading && pagination.total > 0,
  });
  const allComponents = allComponentsQuery.data ?? components;
  const componentGroups = useMemo(
    () => groupComponentsByPartNumber(allComponents),
    [allComponents]
  );
  const componentTableRows = useMemo<ComponentTableRow[]>(() => {
    const groupsByKey = new Map(componentGroups.map((group) => [group.key, group]));
    const emittedKeys = new Set<string>();
    const rows: ComponentTableRow[] = [];

    for (const component of components) {
      const key = componentPartNumberKey(component);
      if (emittedKeys.has(key)) continue;

      const group = groupsByKey.get(key);
      if (group && group.components.length > 1) {
        rows.push({ key, grouped: true, components: group.components });
      } else {
        rows.push({ key, grouped: false, components: [component] });
      }
      emittedKeys.add(key);
    }

    return rows;
  }, [componentGroups, components]);
  const [parentScopedComponentNames, setParentScopedComponentNames] = useState<Hierarchy[] | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serial_number: '',
    unit_id: 0,
  });

  useEffect(() => {
    const visibleGroupedKeys = new Set(
      componentTableRows.filter((row) => row.grouped).map((row) => row.key)
    );
    setExpandedRows((previous) => {
      const next = new Set(
        Array.from(previous).filter((key) => visibleGroupedKeys.has(key))
      );
      return next.size === previous.size ? previous : next;
    });
  }, [componentTableRows]);

  useEffect(() => {
    if (!formData.unit_id) {
      setParentScopedComponentNames(null);
      return;
    }

    const selectedUnit = units.find((u) => u.id === formData.unit_id);
    if (!selectedUnit) {
      setParentScopedComponentNames(null);
      return;
    }

    let cancelled = false;
    void listTemplateNames({
      level: 'component',
      parentName: selectedUnit.name,
    }).then((names) => {
      if (!cancelled) setParentScopedComponentNames(names as Hierarchy[]);
    }).catch((err) => {
      console.error('Failed to load component hierarchy names', err);
      if (!cancelled) setParentScopedComponentNames(null);
    });

    return () => {
      cancelled = true;
    };
  }, [formData.unit_id, units]);

  const componentHierarchyNames =
    formData.unit_id && parentScopedComponentNames
      ? parentScopedComponentNames
      : componentHierarchyNamesAll;

  const inventoryQtyByComponent = useMemo(
    () => getInventoryQuantityByComponentId(inventory),
    [inventory]
  );

  const getStatusName = (component: Component) => component.status?.status_name || 'Unknown';

  const filteredParent = useMemo(
    () => (parentFilter === 'all' ? null : units.find((u) => String(u.id) === parentFilter)),
    [parentFilter, units]
  );

  const applyStatusFilter = (statusName: string) => {
    setStatusFilter(statusName);
    router.push(buildHierarchyPageUrl('/components', statusName, parentFilter, 'unit_id', listFilterPatch));
  };

  const applyParentFilter = (parentId: string) => {
    setParentFilter(parentId);
    router.push(buildHierarchyPageUrl('/components', statusFilter, parentId, 'unit_id', listFilterPatch));
  };

  useEffect(() => {
    setStatusFilter(statusFilterParam || 'all');
    setParentFilter(parentFilterParam || 'all');
  }, [statusFilterParam, parentFilterParam]);

  async function handleCreate() {
    if (!formData.name.trim() || !formData.unit_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createComponent({
        ...formData,
        serial_number: formData.serial_number.trim() || undefined,
      });
      pagination.invalidate();
      await allComponentsQuery.refetch();
      setFormData({ name: '', description: '', serial_number: '', unit_id: 0 });
      setIsCreateOpen(false);
    } catch {
      // Error handled
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.unit_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateComponent(editingId, {
        ...formData,
        serial_number: formData.serial_number.trim() || undefined,
      });
      pagination.invalidate();
      await allComponentsQuery.refetch();
      setFormData({ name: '', description: '', serial_number: '', unit_id: 0 });
      setEditingId(null);
      setIsEditOpen(false);
    } catch {
      // Error handled
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteComponent(id);
      pagination.invalidate();
      toast.success(`${entityLabel('component')} deleted successfully`);
    } catch {
      toast.error('Failed to delete component');
    }
  }

  function openEdit(component: typeof components[0]) {
    setEditingId(component.id);
    setFormData({
      name: component.name ?? '',
      description: component.description ?? '',
      serial_number: component.serial_number ?? '',
      unit_id: component.unit_id,
    });
    setIsEditOpen(true);
  }

  const toggleExpandedRow = (key: string) => {
    setExpandedRows((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderComponentActions = (component: Component) => {
    const ownsInstall = canManageInstall({
      isInventoryManager: inventoryManager,
      currentUserId: user?.id,
      installedById: component.installed_by_id,
    });

    return (
      <div className="flex gap-2 justify-end">
        <Link href={`/components/${component.id}`} onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm">
            View
          </Button>
        </Link>
        {ownsInstall ? (
          <Can permission={P.edit_components}>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(component);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </Can>
        ) : null}
      </div>
    );
  };

  if (pageLoading || (pagination.loading && components.length === 0)) return <PageLoader />;

  if (pagination.error) {
    return (
      <ListPageError
        message={pagination.error instanceof Error ? pagination.error.message : undefined}
        onRetry={() => void pagination.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{entityLabel('component', true)}</h1>
          <p className="text-sm text-muted-foreground">Manage unit components and parts</p>
        </div>
        <PageRefreshButton onRefresh={pagination.refetch} />
      </div>

      <ListContentSuspense loading={pagination.fetching}>
      <HierarchyListDashboard
        config={getComponentsDashboardConfig(entityLabel)}
        items={components}
        parents={units}
        children={inventory}
        getChildParentId={(item) => item.component_id}
        getStatusName={getStatusName}
        getParentId={(component) => component.unit_id}
        faultMap={faultMap}
        activeStatusName={statusFilter}
        activeParentId={parentFilter}
        onStatusFilter={applyStatusFilter}
        onParentFilter={applyParentFilter}
        totalCount={pagination.total}
      />
      </ListContentSuspense>

      {(statusFilter !== 'all' || parentFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter !== 'all' && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Status: <strong>{statusFilter}</strong>
            </span>
          )}
          {filteredParent && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Unit: <strong>{filteredParent.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setParentFilter('all');
              router.push('/components');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={applyStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {COMPONENT_STATUS_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentFilter} onValueChange={applyParentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{`All ${entityLabel('unit', true)}`}</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id.toString()}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InstallerFilterSelect
          value={installerFilter}
          onValueChange={setInstallerFilter}
          users={users}
          currentUserId={user?.id}
          isInventoryManager={inventoryManager}
          showLabel={false}
        />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Can permission={P.create_components}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {`New ${entityLabel('component')}`}
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{`Create ${entityLabel('component')}`}</DialogTitle>
              <DialogDescription>Add a new component</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Choose component from hierarchy</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => setFormData({ ...formData, name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select component name" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentHierarchyNames.map((hierarchy) => (
                      <SelectItem key={hierarchy.id} value={hierarchy.name}>
                        {hierarchy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description ?? ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details"
                />
              </div>
              <div>
                <Label>Serial Number (optional)</Label>
                <Input
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  placeholder="Enter serial number"
                />
              </div>
              <div>
                <Label>{`${entityLabel('unit')} *`}</Label>
                <Select
                  value={formData.unit_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, unit_id: parseInt(v), name: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${entityLabel('unit').toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{`All ${entityLabel('component', true)}`}</CardTitle>
          <CardDescription>
            Showing {components.length} on this page · {pagination.total} matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching || allComponentsQuery.isFetching}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="part_number" sort={sort} onSort={cycleSort}>Part Number</SortableTableHead>
                  <TableHead>Serial Number</TableHead>
                  <SortableTableHead column="unit_id" sort={sort} onSort={cycleSort}>{entityLabel('unit')}</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <TableHead>Inventory Qty</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {`No ${entityLabel('component', true).toLowerCase()} found`}
                    </TableCell>
                  </TableRow>
                ) : (
                  componentTableRows.map((row) => {
                    if (row.grouped) {
                      const group = row.components;
                      const firstComponent = group[0];
                      const groupUnitIds = new Set(group.map((component) => component.unit_id));
                      const groupStatusNames = new Set(group.map(getStatusName));
                      const groupUnit = units.find((u) => u.id === firstComponent.unit_id);
                      const groupInventoryQuantity = group.reduce(
                        (total, component) =>
                          total + getCount(inventoryQtyByComponent, component.id),
                        0
                      );
                      const isExpanded = expandedRows.has(row.key);

                      return (
                        <Fragment key={row.key}>
                          <TableRow
                            className={cn('cursor-pointer', isExpanded && 'bg-muted/30')}
                            onClick={() => toggleExpandedRow(row.key)}
                          >
                            <TableCell className="p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleExpandedRow(row.key);
                                }}
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? `Collapse ${group.length} components with part number ${group[0].part_number || '—'}`
                                    : `Expand ${group.length} components with part number ${group[0].part_number || '—'}`
                                }
                                title={isExpanded ? 'Collapse' : 'Show component serials'}
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-4 w-4 transition-transform',
                                    isExpanded && 'rotate-180'
                                  )}
                                />
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium">
                              {group.length} {entityLabel('component', true).toLowerCase()}
                            </TableCell>
                            <TableCell>{firstComponent.part_number?.trim() || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {group.length} serial numbers
                            </TableCell>
                            <TableCell>
                              {groupUnitIds.size === 1 && groupUnit ? (
                                <ParentEntityLink href={`/units/${groupUnit.id}`} label={groupUnit.name} />
                              ) : (
                                'Multiple units'
                              )}
                            </TableCell>
                            <TableCell>
                              {groupStatusNames.size === 1 ? (
                                <StatusBadge status={getStatusName(firstComponent)} />
                              ) : (
                                'Multiple'
                              )}
                            </TableCell>
                            <TableCell>
                              <EntityCountCell
                                count={groupInventoryQuantity}
                                label="Inventory quantity for this part number"
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {isExpanded ? 'Hide details' : 'View details'}
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={8} className="p-0">
                                <div className="px-6 py-3">
                                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                                    Components with part number {firstComponent.part_number?.trim() || '—'}
                                  </p>
                                  <div className="overflow-x-auto rounded-md border bg-background">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Name</TableHead>
                                          <TableHead>Serial Number</TableHead>
                                          <TableHead>{entityLabel('unit')}</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Inventory Qty</TableHead>
                                          <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {group.map((component) => {
                                          const unit = units.find((u) => u.id === component.unit_id);
                                          return (
                                            <TableRow
                                              key={component.id}
                                              className="cursor-pointer"
                                              onClick={() => router.push(`/components/${component.id}`)}
                                            >
                                              <TableCell className="font-medium">
                                                <EntityNameWithFault
                                                  name={component.name}
                                                  entityType="component"
                                                  entityId={component.id}
                                                  faultMap={faultMap}
                                                />
                                              </TableCell>
                                              <TableCell className="font-mono text-sm">
                                                {component.serial_number?.trim() || '—'}
                                              </TableCell>
                                              <TableCell>
                                                {unit ? (
                                                  <ParentEntityLink
                                                    href={`/units/${unit.id}`}
                                                    label={unit.name}
                                                  />
                                                ) : (
                                                  'N/A'
                                                )}
                                              </TableCell>
                                              <TableCell>
                                                <StatusBadge status={getStatusName(component)} />
                                              </TableCell>
                                              <TableCell>
                                                <EntityCountCell
                                                  count={getCount(inventoryQtyByComponent, component.id)}
                                                  label="Inventory quantity"
                                                />
                                              </TableCell>
                                              <TableCell className="text-right">
                                                {renderComponentActions(component)}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    }
                    const component = row.components[0];
                    const unit = units.find((u) => u.id === component.unit_id);
                    return (
                      <TableRow
                        key={component.id}
                        className={cn(
                          'cursor-pointer',
                          ownInstallRowClass({
                            isInventoryManager: inventoryManager,
                            currentUserId: user?.id,
                            installedById: component.installed_by_id,
                            isCurrentInstall: component.is_current_install,
                          })
                        )}
                        onClick={() => router.push(`/components/${component.id}`)}
                      >
                        <TableCell />
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={component.name}
                            entityType="component"
                            entityId={component.id}
                            faultMap={faultMap}
                          />
                          {showOwnInstallBadge({
                            isInventoryManager: inventoryManager,
                            currentUserId: user?.id,
                            installedById: component.installed_by_id,
                            isCurrentInstall: component.is_current_install,
                          }) ? (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              Installed by you
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>{component.part_number?.trim() || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {component.serial_number?.trim() || '—'}
                        </TableCell>
                        <TableCell>
                          {unit ? (
                            <ParentEntityLink
                              href={`/units/${unit.id}`}
                              label={unit.name}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusName(component)} />
                        </TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(inventoryQtyByComponent, component.id)}
                            label="Inventory quantity"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {renderComponentActions(component)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </ListContentSuspense>
          <EntityListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            rangeLabel={pagination.rangeLabel}
            hasPrev={pagination.hasPrev}
            hasNext={pagination.hasNext}
            onPrev={pagination.prevPage}
            onNext={pagination.nextPage}
            loading={pagination.fetching}
          />
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Edit ${entityLabel('component')}`}</DialogTitle>
            <DialogDescription>Update component details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Choose component from hierarchy</Label>
              <Select
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select component name" />
                </SelectTrigger>
                <SelectContent>
                  {componentHierarchyNames.map((hierarchy) => (
                    <SelectItem key={hierarchy.id} value={hierarchy.name}>
                      {hierarchy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description ?? ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Serial Number (optional)</Label>
              <Input
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="Enter serial number"
              />
            </div>
            <div>
              <Label>{entityLabel('unit')}</Label>
              <Select
                value={formData.unit_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, unit_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}