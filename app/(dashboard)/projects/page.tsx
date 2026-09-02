'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Search, GitBranch, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  groupProjectsByName,
  shouldShowProjectGroup,
} from '@/lib/project-name-grouping';
import Link from 'next/link';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import * as Models from '@/lib/models';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchProjectsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { ProjectsMiniDashboard } from '@/components/projects/projects-mini-dashboard';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { toDateInputValue } from '@/lib/hierarchy-install-fields';
import { workflowStatusLabel } from '@/lib/workflow-status';
import { getSystemCountByProjectId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import {
  ListStatsVisibilityControls,
  useListStatsVisibility,
} from '@/components/list-stats-visibility';
import * as api from '@/lib/api';
import type { HierarchyConfigurationSummary } from '@/lib/models';
import { useAppDefinitions } from '@/lib/app-definitions-context';

export default function ProjectsPage(){
  const router = useRouter();
  const { entityLabel } = useAppDefinitions();
  const { showStats, setShowStats } = useListStatsVisibility();
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });
  const searchParams = useSearchParams();
  const {
    users,
    orders,
    systems,
    projects: storeProjects,
    createProject,
    updateProject,
    deleteProject,
    ensureHierarchyLoaded,
  } = useDataStore();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  
  const statusFilterParam = searchParams.get('status');
  const orderFilterParam = searchParams.get('order_id');
  const orderFilterId = orderFilterParam ? Number(orderFilterParam) : null;
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'Total');
  const [groupByProjectName, setGroupByProjectName] = useState(false);
  const [expandedProjectGroups, setExpandedProjectGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [availableConfigs, setAvailableConfigs] = useState<HierarchyConfigurationSummary[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    owner_id: 0,
    order_id: 0,
    status_id: 0,
    hierarchy_config_id: 0,
    product_type: '',
    flight_count: 1,
    sdls_per_flight: 1,
    sdls_counts_by_flight: [1],
    is_existing_project: false,
  });
  const { data: statuses = [] } = useStatusesByTypeQuery('projects');

  function resetCreateForm() {
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      owner_id: 0,
      order_id: 0,
      status_id: statuses[0]?.id ?? 0,
      hierarchy_config_id: 0,
      product_type: '',
      flight_count: 1,
      sdls_per_flight: 1,
      sdls_counts_by_flight: [1],
      is_existing_project: false,
    });
  }

  useEffect(() => {
    if (!isCreateOpen) return;
    void api.hierarchyConfigurations
      .listAvailable()
      .then((res) => setAvailableConfigs(res.data ?? []))
      .catch(() => setAvailableConfigs([]));
  }, [isCreateOpen]);

  useEffect(() => {
    if (isCreateOpen && formData.status_id === 0 && statuses[0]?.id) {
      setFormData((prev) => ({ ...prev, status_id: statuses[0].id }));
    }
  }, [isCreateOpen, statuses, formData.status_id]);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setFormData((previous) => ({
        ...previous,
        order_id: orderFilterId ?? previous.order_id,
      }));
      setIsCreateOpen(true);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('action');
      const query = nextParams.toString();
      router.replace(query ? `/projects?${query}` : '/projects', { scroll: false });
    }
  }, [searchParams, router, orderFilterId]);

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusName: statusFilter,
        statuses,
        allStatusValue: 'Total',
        orderId: orderFilterId,
        ...listFilterPatch,
      }),
    [debouncedSearch, statusFilter, statuses, orderFilterId, listFilterPatch]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.projectsPage(listFilters),
    fetchPage: fetchProjectsPage,
    filters: listFilters,
  });
  const projects =
    pagination.items.length > 0
      ? pagination.items
      : storeProjects.length > 0 && !pagination.loading
        ? storeProjects
        : pagination.items;
  const showLoader = useListPageLoader(pagination, {
    debouncedSearch,
    filtersActive: statusFilter !== 'Total' || orderFilterId != null,
    hasData: projects.length > 0 || storeProjects.length > 0,
  });

  const orderScopedProjects = projects;

  const systemCountByProject = useMemo(
    () => getSystemCountByProjectId(systems),
    [systems]
  );

  const projectGroups = useMemo(
    () => groupProjectsByName(projects),
    [projects]
  );

  function toggleProjectGroup(key: string) {
    setExpandedProjectGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderProjectRow(
    project: (typeof projects)[0],
    options?: { indented?: boolean }
  ) {
    const owner = users.find((u) => u.id === project.owner_id);
    const status = statuses.find((s) => s.id === project.status_id);
    return (
      <TableRow
        key={project.id}
        className="cursor-pointer"
        onClick={() => router.push(`/projects/${project.id}`)}
      >
        <TableCell className={cn('font-medium', options?.indented && 'pl-10')}>
          <EntityNameWithFault
            name={project.name}
            entityType="project"
            entityId={project.id}
            faultMap={faultMap}
          />
        </TableCell>
        <TableCell>{owner?.full_name || 'N/A'}</TableCell>
        <TableCell>
          <StatusBadge status={status?.status_name || 'Unknown'} />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(project.start_date).toLocaleDateString()}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(project.end_date).toLocaleDateString()}
        </TableCell>
        <TableCell>
          <EntityCountCell
            count={getCount(systemCountByProject, project.id)}
            label="Total systems"
          />
        </TableCell>
        <TableCell className="min-w-35">
          <div className="flex items-center gap-2 rounded-md p-1">
            <Progress value={project.progress ?? 0} className="h-2 flex-1" />
            <span className="w-10 text-right text-xs font-medium tabular-nums">
              {project.progress ?? 0}%
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex gap-2 justify-end">
            <Link href={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
            <Can permission={P.edit_projects}>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(project);
                }}
              >
                <Edit className="h-4 w-4 text-accent-foreground hover:text-blue-600" />
              </button>
            </Can>
            <Can permission={P.delete_projects}>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm({ open: true, id: project.id });
                }}
              >
                <Trash2 className="h-4 w-4 text-accent-foreground hover:text-red-600" />
              </button>
            </Can>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  async function handleCreate() {
    const sdlsCounts = formData.sdls_counts_by_flight
      .slice(0, Number(formData.flight_count))
      .map((count) => Number(count));
    if (
      !formData.name.trim() ||
      !formData.hierarchy_config_id ||
      !formData.order_id ||
      !formData.flight_count ||
      sdlsCounts.length !== Number(formData.flight_count) ||
      sdlsCounts.some((count) => count < 1)
    ) {
      toast.error('Name, order, configuration, and scope counts are required');
      return;
    }
    setIsCreating(true);
    try {
      const res = await api.projects.createDraftsByFlight({
        name: formData.name.trim(),
        description: formData.description || null,
        start_date: formData.start_date
          ? `${formData.start_date}T00:00:00`
          : undefined,
        end_date: formData.end_date ? `${formData.end_date}T00:00:00` : undefined,
        owner_id: formData.owner_id || undefined,
        order_id: formData.order_id,
        hierarchy_config_id: formData.hierarchy_config_id,
        product_type: formData.product_type,
        flight_count: Number(formData.flight_count),
        // Keep the legacy field populated for older API consumers; generation
        // uses the per-flight values below.
        sdls_per_flight: Math.max(...sdlsCounts),
        sdls_counts_by_flight: sdlsCounts,
        is_existing_project: formData.is_existing_project,
      });
      const createdCount = res.data.count ?? res.data.projects.length;
      toast.success(
        formData.is_existing_project
          ? `${createdCount} existing ${entityLabel('project', createdCount === 1).toLowerCase()} created with hierarchy generated`
          : `${createdCount} draft ${entityLabel('project', true).toLowerCase()} created`
      );
      pagination.invalidate();
      resetCreateForm();
      setIsCreateOpen(false);
      router.push('/projects');
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Failed to create draft project';
      toast.error(typeof detail === 'string' ? detail : 'Failed to create draft project');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.owner_id || !formData.status_id || !formData.order_id || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateProject(editingId, formData);
      pagination.invalidate();
      resetCreateForm();
      setEditingId(null);
      setIsEditOpen(false);
    } catch {
      // Error handled by DataStore
    }
  }

  async function confirmDelete() {
    if (deleteConfirm.id === null) return;
    try {
      await deleteProject(deleteConfirm.id);
      pagination.invalidate();
    } catch {
      // Error handled by DataStore
    } finally {
      setDeleteConfirm({ open: false, id: null });
    }
  }

  function openEdit(project: typeof projects[0]) {
    setEditingId(project.id);
    setFormData({
      name: project.name ?? '',
      description: project.description ?? '',
      start_date: toDateInputValue(project.start_date),
      end_date: toDateInputValue(project.end_date),
      owner_id: project.owner_id,
      order_id: project.order_id,
      status_id: project.status_id,
      hierarchy_config_id: project.hierarchy_config_id ?? 0,
      product_type: project.product_type ?? '',
      flight_count: project.flight_count ?? 1,
      sdls_per_flight: project.sdls_per_flight ?? 1,
      sdls_counts_by_flight:
        project.sdls_counts_by_flight ??
        Array(project.flight_count ?? 1).fill(project.sdls_per_flight ?? 1),
      is_existing_project: project.is_existing_project ?? false,
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

  const filteredOrder = orderFilterId ? orders.find((o) => o.id === orderFilterId) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{entityLabel('project', true)}</h1>
          <p className="text-muted-foreground mt-2 text-sm ">Manage satellite lifecycle {entityLabel('project', true).toLowerCase()}</p>
        </div>
        <ListStatsVisibilityControls
          showStats={showStats}
          onShowStatsChange={setShowStats}
          onRefresh={pagination.refetch}
        />
      </div>
      <div>
        {filteredOrder ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Filtered by order: <strong>{filteredOrder.order_number}</strong> — {filteredOrder.title}
            </span>
            <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
              Clear order filter
            </Button>
          </div>
        ) : null}
      </div>

      {showStats && (
        <ListContentSuspense loading={pagination.fetching}>
          <ProjectsMiniDashboard
            projects={orderScopedProjects}
            systems={systems}
            projectStatuses={statuses}
            activeStatusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            filteredOrder={filteredOrder}
            totalCount={pagination.total}
          />
        </ListContentSuspense>
      )}

      {statusFilter !== 'Total' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border bg-muted px-3 py-1 text-sm">
            Status: <strong>{workflowStatusLabel(statusFilter)}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter('Total')}>
            Clear status filter
          </Button>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {/* Create New Project PoP up Window */}
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            if (isCreating) return;
            setIsCreateOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <Can permission={[P.project_create_draft, P.create_projects]}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Draft {entityLabel('project')}
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Draft {entityLabel('project')}</DialogTitle>
              <DialogDescription>
                Select an available Smart SDLS configuration and project scope. Status starts as
                DRAFT until Project Director or Admin approval.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{entityLabel('project')} Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Flight Program Alpha"
                  disabled={isCreating}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description ?? ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Project details"
                  disabled={isCreating}
                />
              </div>
              <div>
                <Label>Hierarchy Configuration *</Label>
                <Select
                  value={formData.hierarchy_config_id ? String(formData.hierarchy_config_id) : ''}
                  onValueChange={(v) => {
                    const id = parseInt(v, 10);
                    const cfg = availableConfigs.find((c) => c.id === id);
                    setFormData({
                      ...formData,
                      hierarchy_config_id: id,
                      product_type: cfg?.product_type_codes?.[0] || '',
                    });
                  }}
                  disabled={isCreating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select available configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableConfigs.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Flight count *</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.flight_count}
                  onChange={(e) => {
                    const flightCount = Math.max(1, Number(e.target.value) || 1);
                    setFormData((prev) => ({
                      ...prev,
                      flight_count: flightCount,
                      sdls_counts_by_flight: Array.from(
                        { length: flightCount },
                        (_, index) => prev.sdls_counts_by_flight[index] ?? 1
                      ),
                    }));
                  }}
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div>
                  <Label>SDLS count for each flight *</Label>
                  <p className="text-xs text-muted-foreground">
                    Set the SDLS count independently for every flight.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {formData.sdls_counts_by_flight.map((count, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Label htmlFor={`flight-sdls-${index}`} className="min-w-20">
                        Flight {index + 1}
                      </Label>
                      <Input
                        id={`flight-sdls-${index}`}
                        type="number"
                        min={1}
                        value={count}
                        onChange={(e) => {
                          const nextCount = Math.max(1, Number(e.target.value) || 1);
                          setFormData((prev) => {
                            const counts = [...prev.sdls_counts_by_flight];
                            counts[index] = nextCount;
                            return {
                              ...prev,
                              sdls_per_flight: Math.max(...counts),
                              sdls_counts_by_flight: counts,
                            };
                          });
                        }}
                        disabled={isCreating}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    disabled={isCreating}
                  />
                </div>
              </div>
              <div>
                <Label>Order *</Label>
                <Select
                  value={formData.order_id ? formData.order_id.toString() : ''}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      order_id: parseInt(v, 10),
                    })
                  }
                  disabled={isCreating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id.toString()}>
                        {o.order_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-as-existing-project"
                  checked={formData.is_existing_project}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_existing_project: checked === true,
                    }))
                  }
                  disabled={isCreating}
                />
                <Label
                  htmlFor="add-as-existing-project"
                  className="cursor-pointer text-sm font-normal"
                >
                  Add as Existing Project
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {formData.is_existing_project
                  ? 'The project will be auto-approved, you will be assigned as Hierarchy Manager, and the hierarchy shells will be generated from the selected configuration.'
                  : 'Status will be set to DRAFT. Generate Hierarchy stays disabled until Project Director or Admin approval (Spec 03).'}
              </p>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleCreate()} disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create Draft'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>All {entityLabel('project', true)}</CardTitle>
            <CardDescription>
              Showing {projects.length} on this page · {pagination.total} matching
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="group-by-project-name"
                checked={groupByProjectName}
                onCheckedChange={(checked) => {
                  setGroupByProjectName(checked === true);
                  setExpandedProjectGroups(new Set());
                }}
              />
              <Label
                htmlFor="group-by-project-name"
                className="cursor-pointer text-sm font-normal whitespace-nowrap"
              >
                Group by {entityLabel('project').toLowerCase()} name
              </Label>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <Link href="/hierarchy-dashboard">
                <GitBranch className="mr-2 h-4 w-4" />
                Hierarchy Dashboard
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ListContentSuspense loading={pagination.fetching}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="owner_id" sort={sort} onSort={cycleSort}>Owner</SortableTableHead>
                  <SortableTableHead column="status_id" sort={sort} onSort={cycleSort}>Status</SortableTableHead>
                  <SortableTableHead column="start_date" sort={sort} onSort={cycleSort}>Start Date</SortableTableHead>
                  <SortableTableHead column="end_date" sort={sort} onSort={cycleSort}>End Date</SortableTableHead>
                  <TableHead>Systems</TableHead>
                  <SortableTableHead column="progress" sort={sort} onSort={cycleSort}>% Progress</SortableTableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No projects found
                    </TableCell>
                  </TableRow>
                ) : groupByProjectName ? (
                  projectGroups.flatMap((group) => {
                    if (!shouldShowProjectGroup(group)) {
                      return group.projects.map((project) => renderProjectRow(project));
                    }

                    const isExpanded = expandedProjectGroups.has(group.key);
                    const rows = [
                      <TableRow
                        key={`group-${group.key}`}
                        className="bg-muted/30 hover:bg-muted/50"
                      >
                        <TableCell colSpan={8} className="p-0">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium"
                            onClick={() => toggleProjectGroup(group.key)}
                            aria-expanded={isExpanded}
                          >
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                isExpanded && 'rotate-180'
                              )}
                            />
                            <span>{group.displayName}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {group.projects.length}{' '}
                              {group.projects.length === 1 ? 'flight' : 'flights'}
                            </span>
                          </button>
                        </TableCell>
                      </TableRow>,
                    ];

                    if (isExpanded) {
                      rows.push(
                        ...group.projects.map((project) =>
                          renderProjectRow(project, { indented: true })
                        )
                      );
                    }

                    return rows;
                  })
                ) : (
                  projects.map((project) => renderProjectRow(project))
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
            <DialogTitle>Edit {entityLabel('project')}</DialogTitle>
            <DialogDescription>Update {entityLabel('project').toLowerCase()} details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{entityLabel('project')} Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`${entityLabel('project')} name`}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description ?? ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Project details"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Owner</Label>
              <Select
                value={formData.owner_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, owner_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, status_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {workflowStatusLabel(s.status_name)}
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

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({ ...prev, open, id: open ? prev.id : null }))
        }
        title="Delete Project"
        description="Are you sure? Reserved inventory will be released back to stock. Projects past issue-to-developer cannot be deleted. This action cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
