'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import type { Hierarchy } from '@/lib/models';
import * as Models from '@/lib/models';
import { resolveStatusName } from '@/lib/entity-status';
import { getSubsystemCountBySystemId, getCount } from '@/lib/entity-counts';
import { parseHierarchyInstallPayload } from '@/lib/hierarchy-install-fields';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { useHierarchiesQuery, useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchSystemsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { SystemsListDashboard } from '@/components/systems/systems-list-dashboard';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { ParentEntityLink } from '@/components/entity-link';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import { canManageInstall, isOwnInstall } from '@/lib/install-ownership';
import { cn } from '@/lib/utils';
import { PageRefreshButton } from '@/components/page-data-refresh';
import {
  InstallerFilterSelect,
  resolveInstallerFilterId,
} from '@/components/installer-filter-select';



const SYSTEM_STATUS_NAMES = ['Design', 'Development', 'Testing', 'Operational', 'Retired'];

export default function SystemsPage() {
  const { entityLabel } = useAppDefinitions();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageLoading } = useEntityHierarchyGate();
  const { user, isInventoryManager } = useAuth();
  const inventoryManager = isInventoryManager();
  const { projects, subsystems, createSystem, updateSystem, deleteSystem, statuses: storeStatuses, users } = useDataStore();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const statusFilterParam = searchParams.get('status');
  const projectFilterParam = searchParams.get('project_id');
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'all');
  const [projectFilter, setProjectFilter] = useState<string>(projectFilterParam || 'all');
  const [installerFilter, setInstallerFilter] = useState('all');
  const { data: statuses = [] } = useStatusesByTypeQuery('systems');
  const { data: systemHierarchyNames = [] } = useHierarchiesQuery('system');

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusName: statusFilter,
        statuses,
        projectId: projectFilter !== 'all' ? Number(projectFilter) : null,
        installedById: resolveInstallerFilterId(installerFilter, {
          currentUserId: user?.id,
          isInventoryManager: inventoryManager,
        }),
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, statuses, projectFilter, installerFilter, user?.id, inventoryManager, listFilterPatch]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.systemsPage(listFilters),
    fetchPage: fetchSystemsPage,
    filters: listFilters,
  });
  const systems = pagination.items;
  const showLoader = useListPageLoader(pagination, {
    pageLoading,
    debouncedSearch,
    filtersActive: statusFilter !== 'all' || projectFilter !== 'all',
    hasData: systems.length > 0,
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project_id: 0,
    status_id: 0,
    installation_date: '',
    installed_by_id: '',
  });

  const subsystemCountBySystem = useMemo(
    () => getSubsystemCountBySystemId(subsystems),
    [subsystems]
  );

  const allStatuses = statuses.length ? statuses : storeStatuses;
  const getStatusName = (system: (typeof systems)[0]) =>
    resolveStatusName(system, allStatuses);

  const filteredProject = useMemo(
    () => (projectFilter === 'all' ? null : projects.find((p) => String(p.id) === projectFilter)),
    [projectFilter, projects]
  );

  const applyStatusFilter = (statusName: string) => {
    setStatusFilter(statusName);
    const params = new URLSearchParams();
    if (statusName !== 'all') params.set('status', statusName);
    if (projectFilter !== 'all') params.set('project_id', projectFilter);
    if (listFilterPatch.sort_by) params.set('sort_by', listFilterPatch.sort_by);
    if (listFilterPatch.sort_order) params.set('sort_order', listFilterPatch.sort_order);
    const qs = params.toString();
    router.push(qs ? `/systems?${qs}` : '/systems');
  };

  const applyProjectFilter = (projectId: string) => {
    setProjectFilter(projectId);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (projectId !== 'all') params.set('project_id', projectId);
    if (listFilterPatch.sort_by) params.set('sort_by', listFilterPatch.sort_by);
    if (listFilterPatch.sort_order) params.set('sort_order', listFilterPatch.sort_order);
    const qs = params.toString();
    router.push(qs ? `/systems?${qs}` : '/systems');
  };

  async function handleCreate() {
    if (!formData.name.trim() || !formData.project_id || !formData.status_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createSystem({
        name: formData.name,
        description: formData.description,
        project_id: formData.project_id,
        status_id: formData.status_id,
        ...parseHierarchyInstallPayload(formData),
      });
      pagination.invalidate();
      setFormData({
        name: '',
        description: '',
        project_id: 0,
        status_id: statuses[0]?.id ?? 0,
        installation_date: '',
        installed_by_id: '',
      });
      setIsCreateOpen(false);
    } catch {
      // Error handled by DataStore
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.project_id || !formData.status_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateSystem(editingId, {
        name: formData.name,
        description: formData.description,
        project_id: formData.project_id,
        status_id: formData.status_id,
        ...parseHierarchyInstallPayload(formData),
      });
      pagination.invalidate();
      setFormData({
        name: '',
        description: '',
        project_id: 0,
        status_id: statuses[0]?.id ?? 0,
        installation_date: '',
        installed_by_id: '',
      });
      setEditingId(null);
      setIsEditOpen(false);
    } catch {
      // Error handled by DataStore
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSystem(id);
      pagination.invalidate();
      toast.success(`${entityLabel('system')} deleted successfully`);
    } catch {
      toast.error('Failed to delete system');
    }
  }

  function openEdit(system: typeof systems[0]) {
    setEditingId(system.id);
    setFormData({
      name: system.name ?? '',
      description: system.description ?? '',
      project_id: system.project_id,
      status_id: system.status_id ?? 0,
      installation_date: system.installation_date
        ? system.installation_date.slice(0, 10)
        : '',
      installed_by_id: system.installed_by_id ? String(system.installed_by_id) : '',
    });
    setIsEditOpen(true);
  }

  const installerLabel = (userId?: number) => {
    if (!userId) return '—';
    const user = users.find((item) => item.id === userId);
    return user?.full_name || user?.username || `User #${userId}`;
  };

  const statusDefaultAppliedRef = useRef(false);

  useEffect(() => {
    setStatusFilter(statusFilterParam || 'all');
    setProjectFilter(projectFilterParam || 'all');
  }, [statusFilterParam, projectFilterParam]);

  useEffect(() => {
    if (statusDefaultAppliedRef.current || statuses.length === 0) return;
    const defaultStatus = statuses.find((s) => s.status_name === 'Design') ?? statuses[0];
    if (!defaultStatus) return;
    statusDefaultAppliedRef.current = true;
    setFormData((prev) =>
      prev.status_id !== 0 ? prev : { ...prev, status_id: defaultStatus.id }
    );
  }, [statuses]);

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
          <h1 className="text-2xl font-semibold tracking-tight">{entityLabel('system', true)}</h1>
          <p className="text-sm text-muted-foreground">Manage satellite systems hierarchy</p>
        </div>
        <PageRefreshButton onRefresh={pagination.refetch} />
      </div>

      <ListContentSuspense loading={pagination.fetching}>
      <SystemsListDashboard
        systems={systems}
        projects={projects}
        subsystems={subsystems}
        systemStatuses={allStatuses}
        faultMap={faultMap}
        activeStatusName={statusFilter}
        activeProjectId={projectFilter}
        onStatusFilter={applyStatusFilter}
        onProjectFilter={applyProjectFilter}
        getStatusName={getStatusName}
        totalCount={pagination.total}
      />
      </ListContentSuspense>

      {(statusFilter !== 'all' || projectFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter !== 'all' && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Status: <strong>{statusFilter}</strong>
            </span>
          )}
          {filteredProject && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Project: <strong>{filteredProject.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setProjectFilter('all');
              router.push('/systems');
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
            placeholder="Search systems..."
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
            {SYSTEM_STATUS_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={applyProjectFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InstallerFilterSelect
          value={installerFilter}
          onValueChange={setInstallerFilter}
          users={users as Models.User[]}
          currentUserId={user?.id}
          isInventoryManager={inventoryManager}
          showLabel={false}
        />
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Can permission={P.create_systems}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {`New ${entityLabel('system')}`}
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{`Create ${entityLabel('system')}`}</DialogTitle>
              <DialogDescription>Add a new satellite system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{`${entityLabel('system')} Name *`}</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => setFormData({ ...formData, name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select system from hierarchy" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemHierarchyNames.map((hierarchy) => (
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
                  placeholder={`${entityLabel('system')} details`}
                />
              </div>
              <div>
                <Label>Project *</Label>
                <Select
                  value={formData.project_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, project_id: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status *</Label>
                <Select
                  value={formData.status_id ? formData.status_id.toString() : ''}
                  onValueChange={(v) => setFormData({ ...formData, status_id: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.status_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Installation Date</Label>
                <Input
                  type="date"
                  value={formData.installation_date ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, installation_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Installed By</Label>
                <Select
                  value={formData.installed_by_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, installed_by_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select installer" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.full_name || user.username}
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
          <CardTitle>{`All ${entityLabel('system', true)}`}</CardTitle>
          <CardDescription>
            Showing {systems.length} on this page · {pagination.total} matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="project_id" sort={sort} onSort={cycleSort}>Project</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <SortableTableHead column="installation_date" sort={sort} onSort={cycleSort}>Install Date</SortableTableHead>
                  <SortableTableHead column="installed_by_id" sort={sort} onSort={cycleSort}>Installer</SortableTableHead>
                  <TableHead>{entityLabel('subsystem', true)}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No systems found
                    </TableCell>
                  </TableRow>
                ) : (
                  systems.map((system) => {
                    const project = projects.find((p) => p.id === system.project_id);
                    const ownsInstall = canManageInstall({
                      isInventoryManager: inventoryManager,
                      currentUserId: user?.id,
                      installedById: system.installed_by_id,
                    });
                    const mine = isOwnInstall({
                      currentUserId: user?.id,
                      installedById: system.installed_by_id,
                    });
                    return (
                      <TableRow
                        key={system.id}
                        className={cn(
                          'cursor-pointer',
                          !inventoryManager &&
                            mine &&
                            system.is_current_install !== false &&
                            'bg-emerald-50/70 dark:bg-emerald-950/25'
                        )}
                        onClick={() => router.push(`/systems/${system.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={system.name}
                            entityType="system"
                            entityId={system.id}
                            faultMap={faultMap}
                          />
                          {!inventoryManager && mine && system.is_current_install !== false ? (
                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              Installed by you
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {project ? (
                            <ParentEntityLink
                              href={`/projects/${project.id}`}
                              label={project.name}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusName(system)} />
                        </TableCell>
                        <TableCell>
                          {system.installation_date
                            ? new Date(system.installation_date).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell>{installerLabel(system.installed_by_id)}</TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(subsystemCountBySystem, system.id)}
                            label="Total subsystems"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/systems/${system.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            {ownsInstall ? (
                              <Can permission={P.edit_systems}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(system);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Can>
                            ) : null}
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
            <DialogTitle>{`Edit ${entityLabel('system')}`}</DialogTitle>
            <DialogDescription>Update system details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{`${entityLabel('system')} Name`}</Label>
              <Select
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select system from hierarchy" />
                </SelectTrigger>
                <SelectContent>
                  {systemHierarchyNames.map((hierarchy) => (
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
                placeholder={`${entityLabel('system')} details`}
              />
            </div>
            <div>
              <Label>Project</Label>
              <Select
                value={formData.project_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, project_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status_id ? formData.status_id.toString() : ''}
                onValueChange={(v) => setFormData({ ...formData, status_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.status_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Installation Date</Label>
              <Input
                type="date"
                value={formData.installation_date ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, installation_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Installed By</Label>
              <Select
                value={formData.installed_by_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, installed_by_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select installer" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.full_name || user.username}
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
