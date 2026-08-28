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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Search } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';
import * as api from '@/lib/api';
import { listTemplateNames } from '@/lib/hierarchy-template-names';
import type { Hierarchy, Unit } from '@/lib/models';
import { getComponentCountByUnitId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { useStatusesByTypeQuery } from '@/hooks/queries';
import { HierarchyListDashboard } from '@/components/hierarchy/hierarchy-list-dashboard';
import { fetchUnitsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { ParentEntityLink } from '@/components/entity-link';
import { buildHierarchyPageUrl } from '@/lib/hierarchy-page-filters';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { getUnitsDashboardConfig, UNIT_STATUS_NAMES } from '@/lib/hierarchy-dashboard-configs';
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

export default function UnitsPage() {
  const { entityLabel } = useAppDefinitions();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageLoading } = useEntityHierarchyGate();
  const { user, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const { modules, components, createUnit, updateUnit, deleteUnit, users } = useDataStore();
  const faultMap = useEntityFaultMap();
  const statusFilterParam = searchParams.get('status');
  const parentFilterParam = searchParams.get('module_id');
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'all');
  const [parentFilter, setParentFilter] = useState<string>(parentFilterParam || 'all');
  const [installerFilter, setInstallerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const { data: statuses = [] } = useStatusesByTypeQuery('units');

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusName: statusFilter,
        statuses,
        moduleId: parentFilter !== 'all' ? Number(parentFilter) : null,
        installedById: resolveInstallerFilterId(installerFilter, {
          currentUserId: user?.id,
          isInventoryManager: inventoryManager,
        }),
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, statuses, parentFilter, installerFilter, user?.id, inventoryManager, listFilterPatch]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.unitsPage(listFilters),
    fetchPage: fetchUnitsPage,
    filters: listFilters,
  });
  const units = pagination.items;
  const showLoader = useListPageLoader(pagination, {
    pageLoading,
    debouncedSearch,
    filtersActive: statusFilter !== 'all' || parentFilter !== 'all',
    hasData: units.length > 0,
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [moduleHierarchyNames, setModuleHierarchyNames] = useState<Hierarchy[]>([]);
  const [unitHierarchyNames, setUnitHierarchyNames] = useState<Hierarchy[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    module_id: 0,
  });

  useEffect(() => {
    const fetchHierarchyNames = async () => {
      try {
        const modulesRes = await listTemplateNames({ level: 'module' });
        setModuleHierarchyNames(modulesRes as Hierarchy[]);
      } catch (err) {
        console.error('Failed to load module hierarchy names', err);
      }
    };

    fetchHierarchyNames();
  }, []);

  useEffect(() => {
    const fetchUnitNames = async () => {
      if (!formData.module_id) {
        setUnitHierarchyNames([]);
        return;
      }

      const selectedModule = modules.find((m) => m.id === formData.module_id);
      if (!selectedModule) {
        setUnitHierarchyNames([]);
        return;
      }

      try {
        const names = await listTemplateNames({
          level: 'unit',
          parentName: selectedModule.name,
        });
        setUnitHierarchyNames(names as Hierarchy[]);
      } catch (err) {
        console.error('Failed to load unit hierarchy names', err);
      }
    };

    fetchUnitNames();
  }, [formData.module_id, modules]);

  const componentCountByUnit = useMemo(
    () => getComponentCountByUnitId(components),
    [components]
  );

  const getStatusName = (unit: Unit) => unit.status?.status_name || 'Unknown';

  const filteredParent = useMemo(
    () => (parentFilter === 'all' ? null : modules.find((m) => String(m.id) === parentFilter)),
    [parentFilter, modules]
  );

  const applyStatusFilter = (statusName: string) => {
    setStatusFilter(statusName);
    router.push(buildHierarchyPageUrl('/units', statusName, parentFilter, 'module_id', listFilterPatch));
  };

  const applyParentFilter = (parentId: string) => {
    setParentFilter(parentId);
    router.push(buildHierarchyPageUrl('/units', statusFilter, parentId, 'module_id', listFilterPatch));
  };

  useEffect(() => {
    setStatusFilter(statusFilterParam || 'all');
    setParentFilter(parentFilterParam || 'all');
  }, [statusFilterParam, parentFilterParam]);

  async function handleCreate() {
    if (!formData.name.trim() || !formData.module_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createUnit(formData);
      pagination.invalidate();
      setFormData({ name: '', description: '', module_id: 0 });
      setIsCreateOpen(false);
    } catch {
      // Error handled
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.module_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateUnit(editingId, formData);
      pagination.invalidate();
      setFormData({ name: '', description: '', module_id: 0 });
      setEditingId(null);
      setIsEditOpen(false);
    } catch {
      // Error handled
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteUnit(id);
      pagination.invalidate();
      toast.success(`${entityLabel('unit')} deleted successfully`);
    } catch {
      toast.error('Failed to delete unit');
    }
  }

  function openEdit(unit: typeof units[0]) {
    setEditingId(unit.id);
    setFormData({
      name: unit.name ?? '',
      description: unit.description ?? '',
      module_id: unit.module_id,
    });
    setIsEditOpen(true);
  }


  if (showLoader) return <PageLoader />;

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
          <h1 className="text-2xl font-semibold tracking-tight">{entityLabel('unit', true)}</h1>
          <p className="text-sm text-muted-foreground">Manage module units and assemblies</p>
        </div>
        <PageRefreshButton onRefresh={pagination.refetch} />
      </div>

      <ListContentSuspense loading={pagination.fetching}>
      <HierarchyListDashboard
        config={getUnitsDashboardConfig(entityLabel)}
        items={units}
        parents={modules}
        children={components}
        getChildParentId={(component) => component.unit_id}
        getStatusName={getStatusName}
        getParentId={(unit) => unit.module_id}
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
              Module: <strong>{filteredParent.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setParentFilter('all');
              router.push('/units');
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
            placeholder="Search units..."
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
            {UNIT_STATUS_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentFilter} onValueChange={applyParentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{`All ${entityLabel('module', true)}`}</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()}>
                {m.name}
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
          <Can permission={P.create_units}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {`New ${entityLabel('unit')}`}
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{`Create ${entityLabel('unit')}`}</DialogTitle>
              <DialogDescription>Add a new unit</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Choose unit from hierarchy</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => setFormData({ ...formData, name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit name" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitHierarchyNames.map((hierarchy) => (
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
                <Label>{`${entityLabel('module')} *`}</Label>
                <Select
                  value={formData.module_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, module_id: parseInt(v), name: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${entityLabel('module').toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.name}
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
          <CardTitle>{`All ${entityLabel('unit', true)}`}</CardTitle>
          <CardDescription>
            Showing {units.length} on this page · {pagination.total} matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="module_id" sort={sort} onSort={cycleSort}>{entityLabel('module')}</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <TableHead>{entityLabel('component', true)}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {`No ${entityLabel('unit', true).toLowerCase()} found`}
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((unit) => {
                    const module = modules.find((m) => m.id === unit.module_id);
                    const ownsInstall = canManageInstall({
                      isInventoryManager: inventoryManager,
                      currentUserId: user?.id,
                      installedById: unit.installed_by_id,
                    });
                    return (
                      <TableRow
                        key={unit.id}
                        className={cn(
                          'cursor-pointer',
                          ownInstallRowClass({
                            isInventoryManager: inventoryManager,
                            currentUserId: user?.id,
                            installedById: unit.installed_by_id,
                            isCurrentInstall: unit.is_current_install,
                          })
                        )}
                        onClick={() => router.push(`/units/${unit.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={unit.name}
                            entityType="unit"
                            entityId={unit.id}
                            faultMap={faultMap}
                          />
                          {showOwnInstallBadge({
                            isInventoryManager: inventoryManager,
                            currentUserId: user?.id,
                            installedById: unit.installed_by_id,
                            isCurrentInstall: unit.is_current_install,
                          }) ? (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              Installed by you
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {module ? (
                            <ParentEntityLink
                              href={`/modules/${module.id}`}
                              label={module.name}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusName(unit)} />
                        </TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(componentCountByUnit, unit.id)}
                            label="Total components"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/units/${unit.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            {ownsInstall ? (
                              <Can permission={P.edit_units}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); openEdit(unit)}}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Can>
                            ) : null}
                            {/* <ConfirmDialog
                              title={`Delete ${entityLabel('unit')}`}
                              description="Are you sure you want to delete this unit?"
                              onConfirm={() => handleDelete(unit.id)}
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
            <DialogTitle>{`Edit ${entityLabel('unit')}`}</DialogTitle>
            <DialogDescription>Update unit details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Choose unit from hierarchy</Label>
              <Select
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit name" />
                </SelectTrigger>
                <SelectContent>
                  {unitHierarchyNames.map((hierarchy) => (
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
              <Label>{entityLabel('module')}</Label>
              <Select
                value={formData.module_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, module_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.name}
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
