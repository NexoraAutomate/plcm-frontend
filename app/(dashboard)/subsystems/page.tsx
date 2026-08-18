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
import type { Hierarchy, Subsystem } from '@/lib/models';
import { getModuleCountBySubsystemId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { useHierarchiesQuery, useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchSubsystemsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { HierarchyListDashboard } from '@/components/hierarchy/hierarchy-list-dashboard';
import { ParentEntityLink } from '@/components/entity-link';
import { buildHierarchyPageUrl } from '@/lib/hierarchy-page-filters';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import {
  getSubsystemsDashboardConfig,
  SUBSYSTEM_STATUS_NAMES,
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

export default function SubsystemsPage() {
  const { entityLabel } = useAppDefinitions();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageLoading } = useEntityHierarchyGate();
  const { user, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const { systems, modules, createSubsystem, updateSubsystem, deleteSubsystem, users } = useDataStore();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const statusFilterParam = searchParams.get('status');
  const parentFilterParam = searchParams.get('system_id');
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'all');
  const [parentFilter, setParentFilter] = useState<string>(parentFilterParam || 'all');
  const [installerFilter, setInstallerFilter] = useState('all');
  const { data: systemHierarchyNames = [] } = useHierarchiesQuery('system');
  const { data: subsystemHierarchyNamesAll = [] } = useHierarchiesQuery('subsystem');
  const { data: statuses = [] } = useStatusesByTypeQuery('subsystems');

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusName: statusFilter,
        statuses,
        systemId: parentFilter !== 'all' ? Number(parentFilter) : null,
        installedById: resolveInstallerFilterId(installerFilter, {
          currentUserId: user?.id,
          isInventoryManager: inventoryManager,
        }),
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, statuses, parentFilter, installerFilter, user?.id, inventoryManager, listFilterPatch]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.subsystemsPage(listFilters),
    fetchPage: fetchSubsystemsPage,
    filters: listFilters,
  });
  const subsystems = pagination.items;
  const showLoader = useListPageLoader(pagination, {
    pageLoading,
    debouncedSearch,
    filtersActive: statusFilter !== 'all' || parentFilter !== 'all',
    hasData: subsystems.length > 0,
  });
  const [parentScopedSubsystemNames, setParentScopedSubsystemNames] = useState<Hierarchy[] | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_id: 0,
  });

  useEffect(() => {
    if (!formData.system_id) {
      setParentScopedSubsystemNames(null);
      return;
    }

    const selectedSystem = systems.find((s) => s.id === formData.system_id);
    if (!selectedSystem) {
      setParentScopedSubsystemNames(null);
      return;
    }

    let cancelled = false;
    void listTemplateNames({
      level: 'subsystem',
      parentName: selectedSystem.name,
    }).then((names) => {
      if (!cancelled) setParentScopedSubsystemNames(names as Hierarchy[]);
    }).catch((err) => {
      console.error('Failed to load subsystem hierarchy names', err);
      if (!cancelled) setParentScopedSubsystemNames(null);
    });

    return () => {
      cancelled = true;
    };
  }, [formData.system_id, systems]);

  const subsystemHierarchyNames =
    formData.system_id && parentScopedSubsystemNames
      ? parentScopedSubsystemNames
      : subsystemHierarchyNamesAll;

  const moduleCountBySubsystem = useMemo(
    () => getModuleCountBySubsystemId(modules),
    [modules]
  );

  const getStatusName = (subsystem: Subsystem) => subsystem.status?.status_name || 'Unknown';

  const filteredParent = useMemo(
    () => (parentFilter === 'all' ? null : systems.find((s) => String(s.id) === parentFilter)),
    [parentFilter, systems]
  );

  const applyStatusFilter = (statusName: string) => {
    setStatusFilter(statusName);
    router.push(buildHierarchyPageUrl('/subsystems', statusName, parentFilter, 'system_id', listFilterPatch));
  };

  const applyParentFilter = (parentId: string) => {
    setParentFilter(parentId);
    router.push(buildHierarchyPageUrl('/subsystems', statusFilter, parentId, 'system_id', listFilterPatch));
  };

  useEffect(() => {
    setStatusFilter(statusFilterParam || 'all');
    setParentFilter(parentFilterParam || 'all');
  }, [statusFilterParam, parentFilterParam]);

  async function handleCreate() {
    if (!formData.name.trim() || !formData.system_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createSubsystem(formData);
      pagination.invalidate();
      setFormData({ name: '', description: '', system_id: 0 });
      setIsCreateOpen(false);
      toast.success(`${entityLabel('subsystem')} created successfully`);
    } catch {
      toast.error('Failed to create subsystem');
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.system_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateSubsystem(editingId, formData);
      pagination.invalidate();
      setFormData({ name: '', description: '', system_id: 0 });
      setEditingId(null);
      setIsEditOpen(false);
      toast.success(`${entityLabel('subsystem')} updated successfully`);
    } catch {
      toast.error('Failed to update subsystem');
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSubsystem(id);
      pagination.invalidate();
      toast.success(`${entityLabel('subsystem')} deleted successfully`);
    } catch {
      toast.error('Failed to delete subsystem');
    }
  }

  function openEdit(subsystem: typeof subsystems[0]) {
    setEditingId(subsystem.id);
    setFormData({
      name: subsystem.name,
      description: subsystem.description,
      system_id: subsystem.system_id,
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{entityLabel('subsystem', true)}</h1>
        <p className="text-muted-foreground mt-2">Manage system subsystems</p>
      </div>

      <ListContentSuspense loading={pagination.fetching}>
      <HierarchyListDashboard
        config={getSubsystemsDashboardConfig(entityLabel)}
        items={subsystems}
        parents={systems}
        children={modules}
        getChildParentId={(module) => module.subsystem_id}
        getStatusName={getStatusName}
        getParentId={(subsystem) => subsystem.system_id}
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
              System: <strong>{filteredParent.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setParentFilter('all');
              router.push('/subsystems');
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
            placeholder="Search subsystems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={applyStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {SUBSYSTEM_STATUS_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentFilter} onValueChange={applyParentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by system" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{`All ${entityLabel('system', true)}`}</SelectItem>
            {systems.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
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
          <Can permission={P.create_subsystems}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {`New ${entityLabel('subsystem')}`}
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{`Create ${entityLabel('subsystem')}`}</DialogTitle>
              <DialogDescription>Add a new subsystem</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Choose subsystem from hierarchy</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => setFormData({ ...formData, name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subsystem name" />
                  </SelectTrigger>
                  <SelectContent>
                    {subsystemHierarchyNames.map((hierarchy) => (
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
                <Label>{`${entityLabel('system')} *`}</Label>
                <Select
                  value={formData.system_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, system_id: parseInt(v), name: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${entityLabel('system').toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {systems.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
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
          <CardTitle>{`All ${entityLabel('subsystem', true)}`}</CardTitle>
          <CardDescription>
            Showing {subsystems.length} on this page · {pagination.total} matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="system_id" sort={sort} onSort={cycleSort}>{entityLabel('system')}</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <TableHead>{entityLabel('module', true)}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subsystems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {`No ${entityLabel('subsystem', true).toLowerCase()} found`}
                    </TableCell>
                  </TableRow>
                ) : (
                  subsystems.map((subsystem) => {
                    const system = systems.find((s) => s.id === subsystem.system_id);
                    const ownsInstall = canManageInstall({
                      isInventoryManager: inventoryManager,
                      currentUserId: user?.id,
                      installedById: subsystem.installed_by_id,
                    });
                    return (
                      <TableRow
                        key={subsystem.id}
                        className={cn(
                          'cursor-pointer',
                          ownInstallRowClass({
                            isInventoryManager: inventoryManager,
                            currentUserId: user?.id,
                            installedById: subsystem.installed_by_id,
                            isCurrentInstall: subsystem.is_current_install,
                          })
                        )}
                        onClick={() => router.push(`/subsystems/${subsystem.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={subsystem.name}
                            entityType="subsystem"
                            entityId={subsystem.id}
                            faultMap={faultMap}
                          />
                          {showOwnInstallBadge({
                            isInventoryManager: inventoryManager,
                            currentUserId: user?.id,
                            installedById: subsystem.installed_by_id,
                            isCurrentInstall: subsystem.is_current_install,
                          }) ? (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              Installed by you
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {system ? (
                            <ParentEntityLink
                              href={`/systems/${system.id}`}
                              label={system.name}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusName(subsystem)} />
                        </TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(moduleCountBySubsystem, subsystem.id)}
                            label="Total modules"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/subsystems/${subsystem.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            {ownsInstall ? (
                              <Can permission={P.edit_subsystems}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => { e.stopPropagation(); openEdit(subsystem)}}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Can>
                            ) : null}
                            {/* <ConfirmDialog
                              title={`Delete ${entityLabel('subsystem')}`}
                              description="Are you sure you want to delete this subsystem?"
                              onConfirm={() => handleDelete(subsystem.id)}
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
            <DialogTitle>{`Edit ${entityLabel('subsystem')}`}</DialogTitle>
            <DialogDescription>Update subsystem details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Choose subsystem from hierarchy</Label>
              <Select
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subsystem name" />
                </SelectTrigger>
                <SelectContent>
                  {subsystemHierarchyNames.map((hierarchy) => (
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
              <Label>{entityLabel('system')}</Label>
              <Select
                value={formData.system_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, system_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
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
