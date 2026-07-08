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
import { Plus, Edit, Trash2, Search, BarChart3, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useStatusesByTypeQuery } from '@/hooks/queries';
import { fetchProjectsPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListPageError } from '@/components/list-page-error';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { ProjectsMiniDashboard } from '@/components/projects/projects-mini-dashboard';
import { buildListFilters } from '@/lib/list-page-filter-utils';
import { toDateInputValue } from '@/lib/hierarchy-install-fields';
import { getSystemCountByProjectId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { Progress } from '@/components/ui/progress';
import { ProjectProgressDialog } from '@/components/projects/project-progress-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function ProjectsPage(){
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });
  const searchParams = useSearchParams();
  const { users, orders, systems, projects: storeProjects, createProject, updateProject, deleteProject, getEntityMaintenanceLogs } = useDataStore();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  
  const statusFilterParam = searchParams.get('status');
  const orderFilterParam = searchParams.get('order_id');
  const orderFilterId = orderFilterParam ? Number(orderFilterParam) : null;
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'Total');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressProject, setProgressProject] = useState<Models.Project | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    owner_id: 0,
    order_id: 0,
    status_id: 0,
  });
  const { data: statuses = [] } = useStatusesByTypeQuery('projects');

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsCreateOpen(true);
      router.replace('/projects', { scroll: false });
    }
  }, [searchParams, router]);

  const listFilters = useMemo(
    () =>
      buildListFilters({
        search: debouncedSearch,
        statusName: statusFilter,
        statuses,
        allStatusValue: 'Total',
        orderId: orderFilterId,
      }),
    [debouncedSearch, statusFilter, statuses, orderFilterId]
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

  async function handleCreate() {
    if (!formData.name.trim() || !formData.owner_id  || !formData.order_id || !formData.start_date || !formData.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createProject(formData);
      pagination.invalidate();
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        owner_id: 0,
        order_id: 0,
        status_id: 0,
      });
      setIsCreateOpen(false);
    } catch {
      // Error handled by DataStore
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
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        owner_id: 0,
        order_id: 0,
        status_id: 0,
      });
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

  function openProgressEdit(project: Models.Project) {
    setProgressProject(project);
    setIsProgressOpen(true);
  }

  async function handleProgressSave(
    projectId: number,
    data: { progress: number; status_id?: number }
  ) {
    await updateProject(projectId, data);
    pagination.invalidate();
  }

  function openEdit(project: typeof projects[0]) {
    setEditingId(project.id);
    setFormData({
      name: project.name,
      description: project.description,
      start_date: toDateInputValue(project.start_date),
      end_date: toDateInputValue(project.end_date),
      owner_id: project.owner_id,
      order_id: project.order_id,
      status_id: project.status_id,
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-2 text-sm ">Manage satellite lifecycle projects</p>
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

      <ProjectsMiniDashboard
        projects={orderScopedProjects}
        systems={systems}
        projectStatuses={statuses}
        activeStatusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        filteredOrder={filteredOrder}
        totalCount={pagination.total}
      />

      {statusFilter !== 'Total' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border bg-muted px-3 py-1 text-sm">
            Status: <strong>{statusFilter}</strong>
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>Set up a new satellite project</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Project Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sat-A Lifecycle"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
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
                <Label>Owner *</Label>
                <Select
                  value={formData.owner_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, owner_id: parseInt(v) })}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.full_name}
                      </SelectItem>
                    ))
                  }
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Order</Label>
                <Select
                  value={formData.order_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, order_id: parseInt(v) })}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder="Select order (optional)" />
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
              <div>
                <Label>Status *</Label>
                <Select
                  value={formData.status_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, status_id: parseInt(v) })}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.status_name}
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
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>All Projects</CardTitle>
            <CardDescription>
              Showing {projects.length} on this page · {pagination.total} matching
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/hierarchy-dashboard">
              <GitBranch className="mr-2 h-4 w-4" />
              Hierarchy Dashboard
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Systems</TableHead>
                  <TableHead>% Progress</TableHead>
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
                ) : (
                  projects.map((project) => {
                    const owner = users.find((u) => u.id === project.owner_id);
                    const status = statuses.find((s) => s.id === project.status_id);
                    return (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={project.name}
                            entityType="project"
                            entityId={project.id}
                            faultMap={faultMap}
                          />
                        </TableCell>
                        <TableCell>{owner?.full_name || 'N/A'}</TableCell>
                        <TableCell><StatusBadge status={status?.status_name || 'Unknown'} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(project.start_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(project.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(systemCountByProject, project.id)}
                            label="Total systems"
                          />
                        </TableCell>
                        <TableCell
                          className="min-w-[140px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProgressEdit(project);
                          }}
                        >
                          <div className="flex cursor-pointer items-center gap-2 rounded-md p-1 hover:bg-muted/50">
                            <Progress value={project.progress ?? 0} className="h-2 flex-1" />
                            <span className="w-10 text-right text-xs font-medium tabular-nums">
                              {project.progress ?? 0}%
                            </span>
                            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
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

      <ProjectProgressDialog
        open={isProgressOpen}
        onOpenChange={setIsProgressOpen}
        project={progressProject}
        statuses={statuses}
        onSave={handleProgressSave}
      />

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Project name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
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
                      {s.status_name}
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
        description="Are you sure? This will delete associated systems. This action cannot be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
