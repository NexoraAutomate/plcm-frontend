'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, FileText, Calendar, Layers, Network, Ban, GitBranch, Package, AlertTriangle, Workflow } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { EntityCards } from '@/components/entity-cards';
import { EntityForm } from '@/components/entity-form';
import { HierarchyEntityInventoryDialog } from '@/components/hierarchy/hierarchy-entity-inventory-create-dialog';
import { isExistingProject } from '@/lib/project-existing';
import { P } from '@/lib/permission-codes';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import { listTemplateNames } from '@/lib/hierarchy-template-names';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import {
  hierarchyInstallFormFields,
  hierarchyInstallInitialValues,
  parseHierarchyInstallPayload,
} from '@/lib/hierarchy-install-fields';
import { syncEntityPicture } from '@/lib/entity-picture-upload';
import { ProjectWorkflowActions } from '@/components/projects/project-workflow-actions';
import { GeneratedHierarchyCard } from '@/components/projects/generated-hierarchy-card';
import { ProjectReservationsPanel } from '@/components/projects/project-reservations-panel';
import {
  ProjectBottlenecksPanel,
  ProjectProgressPanel,
} from '@/components/projects/project-progress-panel';
import { ShortageListPanel } from '@/components/shortages/shortage-list-panel';
import { useProjectProgressQuery } from '@/hooks/queries';
import { ConfigChangeBanner } from '@/components/projects/config-change-banner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectWorkflowStatus, isProjectReadOnly, workflowStatusLabel } from '@/lib/workflow-status';
import { isCurrentInstallEntity } from '@/lib/entity-replacement';
import {
  ListStatsVisibilityControls,
  useListStatsVisibility,
} from '@/components/list-stats-visibility';

export default function ProjectDetailPage() {
  const { entityLabel } = useAppDefinitions();

  const params = useParams();
  const projectId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    projects,
    systems,
    orders,
    users,
    deleteSystem,
    updateSystem,
    ensureHierarchyLoaded,
  } = useDataStore();
  const [workflowProject, setWorkflowProject] = useState<Models.Project | null>(null);
  const [scopedSystems, setScopedSystems] = useState<Models.System[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [systemHierarchyNames, setSystemHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const [configurationLabel, setConfigurationLabel] = useState<string | null>(null);
  const [hasProjectShortages, setHasProjectShortages] = useState<boolean | null>(null);
  const progressQuery = useProjectProgressQuery(
    Number.isFinite(Number(projectId)) ? Number(projectId) : null
  );
  const { showStats, setShowStats } = useListStatsVisibility();

  const project =
    workflowProject && String(workflowProject.id) === projectId
      ? workflowProject
      : projects.find((p) => String(p.id) === projectId);

  useEffect(() => {
    const configId = project?.hierarchy_config_id;
    if (!configId) {
      setConfigurationLabel(null);
      return;
    }
    let cancelled = false;
    void api.hierarchyConfigurations
      .get(configId)
      .then((res) => {
        if (!cancelled) setConfigurationLabel(res.data.name || res.data.code);
      })
      .catch(() => {
        if (!cancelled) setConfigurationLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.hierarchy_config_id, project?.updated_at]);

  useEffect(() => {
    const id = Number(projectId);
    if (!Number.isFinite(id)) return;
    void api.projects
      .get(id)
      .then((res) => setWorkflowProject(res.data))
      .catch(() => undefined);
  }, [projectId]);

  useEffect(() => {
    setHasProjectShortages(null);
  }, [projectId, project?.status_name]);

  const handleProjectShortagesChange = useCallback((rows: Models.InventoryShortage[]) => {
    setHasProjectShortages(rows.length > 0);
  }, []);

  // Project-scoped shells (only needs view_projects) — do not rely solely on the
  // global /systems dump, which can be empty for some roles or capped catalogs.
  useEffect(() => {
    const id = Number(projectId);
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    void api.projects
      .getSystems(id)
      .then((res) => {
        if (!cancelled) {
          const rows = res.data ?? [];
          setScopedSystems(rows);
          // Warm the global hierarchy store so Hierarchy / entity pages work too.
          if (rows.length > 0) {
            void ensureHierarchyLoaded({ force: true });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setScopedSystems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    workflowProject?.status_name,
    workflowProject?.hierarchy_config_version,
    ensureHierarchyLoaded,
  ]);

  useEffect(() => {
    const snap = progressQuery.data;
    if (!snap) return;
    setWorkflowProject((prev) => {
      if (!prev || prev.id !== snap.project_id) return prev;
      if (
        prev.progress === snap.progress_pct &&
        prev.status_name === (snap.project_status ?? prev.status_name)
      ) {
        return prev;
      }
      return {
        ...prev,
        progress: snap.progress_pct,
        status_name: snap.project_status ?? prev.status_name,
      };
    });
  }, [progressQuery.data]);
  const projectSystems = useMemo(() => {
    const scoped = scopedSystems.filter(isCurrentInstallEntity);
    if (scoped.length > 0) return scoped;
    if (!project) return [];
    return systems.filter((s) => s.project_id === project.id && isCurrentInstallEntity(s));
  }, [scopedSystems, systems, project]);
  const order = project ? orders.find((o) => o.id === project.order_id) : null;



  const nameOptions = useMemo(
    () =>
      systemHierarchyNames.map((hierarchy) => ({
        label: hierarchy.name,
        value: hierarchy.name,
      })),
    [systemHierarchyNames]
  );
  const statusOptions = useMemo(
    () => statuses.map((s) => ({ label: workflowStatusLabel(s.status_name), value: s.id })),
    [statuses]
  );
  const allowedSystemNames = useMemo(
    () => systemHierarchyNames.map((hierarchy) => hierarchy.name),
    [systemHierarchyNames]
  );
  const installFields = useMemo(
    () => hierarchyInstallFormFields({ users }),
    [users]
  );

  const systemEditFormFields = useMemo(
    () => [
      {
        name: 'name',
        label: `${entityLabel('system')} Name`,
        type: 'select' as const,
        required: true,
        options: nameOptions,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea' as const,
        required: false,
        placeholder: 'Enter system description',
      },
      {
        name: 'partnumber',
        label: 'Part #',
        type: 'text' as const,
        required: false,
        placeholder: `Enter Part Number of ${entityLabel('system')}`,
      },
      {
        name: 'project_id',
        label: entityLabel('project'),
        type: 'select' as const,
        required: true,
        options: projects.map((p) => ({ label: p.name, value: p.id })),
      },
      {
        name: 'id',
        label: 'Status',
        type: 'select' as const,
        required: true,
        options: statusOptions,
      },
      ...hierarchyInstallFormFields({
        users,
        ownerType: editingId ? 'system' : undefined,
        ownerId: editingId ?? undefined,
      }),
    ],
    [nameOptions, projects, statusOptions, users, editingId, entityLabel]
  );

  async function handleDeleteSystem(id: number) {
    try {
      await deleteSystem(id);
      toast.success('System deleted successfully');
    } catch {
      toast.error('Failed to delete system');
    }
  }

  function openEditSystem(id: number) {
    setEditingId(id);
    setIsEditOpen(true);
  }

  const editingSystem = editingId
    ? projectSystems.find((s) => s.id === editingId)
    : null;

  async function handleEditSystem(formData: Record<string, any>) {
    if (!project || !editingId) {
      toast.error('System not found');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = parseHierarchyInstallPayload(formData);
      const pictureResult = await syncEntityPicture('system', editingId, formData);
      if (pictureResult === null) {
        payload.picture_url = null;
      } else if (typeof pictureResult === 'string') {
        payload.picture_url = pictureResult;
      }
      await updateSystem(editingId, {
        name: formData.name,
        description: formData.description || '',
        project_id: formData.project_id ? Number(formData.project_id) : project.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
        ...payload,
      });
      setIsEditOpen(false);
      setEditingId(null);
      toast.success(`${entityLabel('system')} updated successfully`);
    } catch (error) {
      console.error('System update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update system';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      // Load independently — a 403 on statuses must not block config template names.
      const [statusResult, namesResult] = await Promise.allSettled([
        api.statuses.list('systems'),
        listTemplateNames({
          level: 'system',
          configId: project?.hierarchy_config_id,
        }),
      ]);
      if (statusResult.status === 'fulfilled') {
        setStatuses(statusResult.value.data);
      } else if (!api.isForbiddenError(statusResult.reason)) {
        console.error('Failed to fetch system statuses', statusResult.reason);
      }
      if (namesResult.status === 'fulfilled') {
        setSystemHierarchyNames(namesResult.value as Models.Hierarchy[]);
      } else if (!api.isForbiddenError(namesResult.reason)) {
        console.error('Failed to fetch hierarchy names', namesResult.reason);
      }
      setLoadingStatuses(false);
    };

    fetchData();
  }, [project?.hierarchy_config_id]);

  if (pageLoading) return <PageLoader />;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Project Not Found</h2>
        <Link href="/projects" className="mt-2 text-sm text-primary underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  const hierarchyReadOnly = isProjectReadOnly(project.status_name);
  const isExisting = isExistingProject(project);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects">{entityLabel('project', true)}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage {entityLabel('system', true).toLowerCase()} and hierarchy</p>
        </div>
        <ListStatsVisibilityControls
          showStats={showStats}
          onShowStatsChange={setShowStats}
          onRefresh={() => progressQuery.refetch()}
          checkboxLabel="Show KPIs"
        />
        <Button variant="outline" className="gap-2 shrink-0" asChild>
          <Link href={`/hierarchy-dashboard?project_id=${projectId}`}>
            <Network className="h-4 w-4" />
            Hierarchy
          </Link>
        </Button>
      </div>

      <ConfigChangeBanner project={project} />

      {project.status_name === ProjectWorkflowStatus.CANCELLED ? (
        <Alert variant="destructive">
          <Ban />
          <AlertTitle>Project cancelled</AlertTitle>
          <AlertDescription>
            Reserve, issue, and generate are blocked. Hierarchy is read-only for
            audit. Issued units follow the recall queue until IM dispositions them.
          </AlertDescription>
        </Alert>
      ) : null}

      {showStats ? (
        <ProjectProgressPanel
          data={progressQuery.data}
          loading={progressQuery.isLoading}
          configurationLabel={configurationLabel}
          details={
            <Card className="shadow-sm h-full">
              <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Order</p>
                    <p className="text-sm font-medium truncate">
                      {order?.order_number || project.order_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Delivery Date</p>
                    <p className="text-sm font-medium truncate">{project.end_date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Layers className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Systems</p>
                    <p className="text-sm font-medium">{projectSystems.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={project.status_name || 'Unknown'} />
                      <EntityStatusHistorySheet
                        entityType="project"
                        entityPk={project.id}
                        entityName={project.name}
                        statuses={statuses}
                        triggerVariant="icon"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          }
        />
      ) : null}

      <Tabs defaultValue="workflow" className="gap-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="workflow" className="gap-1.5">
            <Workflow className="h-4 w-4" />
            Workflow
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-1.5">
            <GitBranch className="h-4 w-4" />
            Generated Hierarchy
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-1.5">
            <Package className="h-4 w-4" />
            Inventory Reservations
          </TabsTrigger>
          <TabsTrigger value="bottlenecks" className="gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Bottlenecks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-0">
          <ProjectWorkflowActions
            project={project}
            users={users}
            onUpdated={(next) => setWorkflowProject(next)}
          />
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-0">
          <GeneratedHierarchyCard
            project={project}
            configurationLabel={configurationLabel}
          />
        </TabsContent>

        <TabsContent value="reservations" className="mt-0 space-y-4">
          <ProjectReservationsPanel project={project} />
          {project.status_name === 'READY_FOR_INVENTORY' ? (
            <div
              className={`space-y-2 rounded-lg border p-4 ${
                hasProjectShortages === false ? 'hidden' : ''
              }`}
            >
              <div>
                <h3 className="text-sm font-medium">Shortages</h3>
                <p className="text-xs text-muted-foreground">
                  Waiting demand for this project. Matching receipts auto-reserve FCFS.
                </p>
              </div>
              <ShortageListPanel
                projectId={project.id}
                pollMs={12_000}
                onRowsChange={handleProjectShortagesChange}
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="bottlenecks" className="mt-0">
          <ProjectBottlenecksPanel
            data={progressQuery.data}
            loading={progressQuery.isLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Systems Cards */}
      <EntityCards
        title={entityLabel('system', true)}
        description={
          hierarchyReadOnly
            ? `${entityLabel('system', true)} for ${project.name} (read-only)`
            : `Manage ${entityLabel('system', true).toLowerCase()} for ${project.name}`
        }
        entities={projectSystems}
        onEdit={openEditSystem}
        onDelete={handleDeleteSystem}
        detailPath={(id) => `/systems/${id}`}
        secondaryPath={(id) => `/projects/${projectId}/systems/${id}/hierarchy`}
        emptyMessage={
          hierarchyReadOnly
            ? `No ${entityLabel('system', true).toLowerCase()} on this cancelled project.`
            : `No ${entityLabel('system', true).toLowerCase()} in this project yet.`
        }
        childEntityType="system"
        createPermission={P.create_systems}
        editPermission={P.edit_systems}
        deletePermission={P.delete_systems}
        readOnly={hierarchyReadOnly}
        projectId={Number.isFinite(Number(projectId)) ? Number(projectId) : null}
      />

      {isExisting ? (
        editingSystem ? (
        <HierarchyEntityInventoryDialog
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) setEditingId(null);
          }}
          entityType="system"
          entityId={editingSystem.id}
          entity={editingSystem}
          parentId={project.id}
          title={`Edit ${entityLabel('system')}`}
          description={`Register details for ${editingSystem.name}`}
          onSaved={async () => {
            const id = Number(projectId);
            if (Number.isFinite(id)) {
              const res = await api.projects.getSystems(id);
              setScopedSystems(res.data ?? []);
              await ensureHierarchyLoaded({ force: true });
            }
          }}
        />
        ) : null
      ) : (
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit System</DialogTitle>
            <DialogDescription>Update system details</DialogDescription>
          </DialogHeader>
          {editingSystem ? (
            <EntityForm
              key={editingSystem.id}
              fields={systemEditFormFields}
              initialValues={{
                name: editingSystem.name,
                description: editingSystem.description || '',
                partnumber: editingSystem.part_number || '',
                project_id: editingSystem.project_id,
                id: editingSystem.status_id,
                ...hierarchyInstallInitialValues(editingSystem),
              }}
              onSubmit={handleEditSystem}
              isLoading={isSubmitting}
              onCancel={() => {
                setIsEditOpen(false);
                setEditingId(null);
              }}
              submitLabel="Update"
            />
          ) : null}
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
