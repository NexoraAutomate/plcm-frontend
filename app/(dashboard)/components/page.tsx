'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Search } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';
import * as api from '@/lib/api';
import type { Component, Hierarchy } from '@/lib/models';
import { getInventoryQuantityByComponentId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { useHierarchiesQuery, useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchComponentsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
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
import {
  InstallerFilterSelect,
  resolveInstallerFilterId,
} from '@/components/installer-filter-select';

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
  const [parentScopedComponentNames, setParentScopedComponentNames] = useState<Hierarchy[] | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit_id: 0,
  });

  useEffect(() => {
    if (!formData.unit_id) {
      setParentScopedComponentNames(null);
      return;
    }

    const selectedUnit = units.find((u) => u.id === formData.unit_id);
    const parentHierarchyId = selectedUnit
      ? unitHierarchyNames.find((hierarchy) => hierarchy.name === selectedUnit.name)?.id
      : undefined;

    if (!parentHierarchyId) {
      setParentScopedComponentNames(null);
      return;
    }

    let cancelled = false;
    void api.hierarchies.list('component', parentHierarchyId).then((res) => {
      if (!cancelled) setParentScopedComponentNames(res.data ?? []);
    }).catch((err) => {
      console.error('Failed to load component hierarchy names', err);
      if (!cancelled) setParentScopedComponentNames(null);
    });

    return () => {
      cancelled = true;
    };
  }, [formData.unit_id, unitHierarchyNames, units]);

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
      await createComponent(formData);
      pagination.invalidate();
      setFormData({ name: '', description: '', unit_id: 0 });
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
      await updateComponent(editingId, formData);
      pagination.invalidate();
      setFormData({ name: '', description: '', unit_id: 0 });
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
      name: component.name,
      description: component.description,
      unit_id: component.unit_id,
    });
    setIsEditOpen(true);
  }

  if (pageLoading || pagination.loading) return <PageLoader />;

  if (pagination.error) {
    return (
      <ListPageError
        message={pagination.error instanceof Error ? pagination.error.message : undefined}
        onRetry={() => void pagination.refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{entityLabel('component', true)}</h1>
        <p className="text-muted-foreground mt-2">Manage unit components and parts</p>
      </div>

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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details"
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="unit_id" sort={sort} onSort={cycleSort}>{entityLabel('unit')}</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <TableHead>Inventory Qty</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {`No ${entityLabel('component', true).toLowerCase()} found`}
                    </TableCell>
                  </TableRow>
                ) : (
                  components.map((component) => {
                    const unit = units.find((u) => u.id === component.unit_id);
                    const ownsInstall = canManageInstall({
                      isInventoryManager: inventoryManager,
                      currentUserId: user?.id,
                      installedById: component.installed_by_id,
                    });
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
                                  onClick={(e) => { e.stopPropagation(); openEdit(component)}}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Can>
                            ) : null}
                            {/* <ConfirmDialog
                              title={`Delete ${entityLabel('component')}`}
                              description="Are you sure you want to delete this component?"
                              onConfirm={() => handleDelete(component.id)}
                            >
                              <Button
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmDialog> */}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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