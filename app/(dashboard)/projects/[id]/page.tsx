'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, FileText, Calendar, Layers, Pencil, Network } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Search, Clock, AlertTriangle, Zap, Pause, CheckCircle } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { EntityCards } from '@/components/entity-cards';
import { EntityForm } from '@/components/entity-form';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import { EntityInventorySearch } from '@/components/entity-inventory-search';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import type { Inventory } from '@/lib/models';
import {
  buildCreateEntityByType,
  installEntityFromInventoryWithChildren,
} from '@/lib/inventory-child-install';
import {
  hierarchyInstallFormFields,
  hierarchyInstallInitialValues,
  parseHierarchyInstallPayload,
} from '@/lib/hierarchy-install-fields';
import { syncEntityPicture } from '@/lib/entity-picture-upload';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    projects,
    systems,
    orders,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
    deleteSystem,
    updateSystem,
    users,
  } = useDataStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [systemHierarchyNames, setSystemHierarchyNames] = useState<Models.Hierarchy[]>([]);

  const project = projects.find((p) => String(p.id) === projectId);
  const projectSystems = project ? systems.filter((s) => s.project_id === project.id) : [];
  const order = project ? orders.find((o) => o.id === project.order_id) : null;



  const systemFormFields = useMemo(
    () => [
      {
        name: 'name',
        label: 'System Name',
        type: 'select' as const,
        required: true,
        options: systemHierarchyNames.map((hierarchy) => ({
          label: hierarchy.name,
          value: hierarchy.name,
        })),
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
        placeholder: 'Enter Part Number of System',
      },
      {
        name: 'project_id',
        label: 'Project',
        type: 'select' as const,
        required: true,
        options: projects.map((p) => ({ label: p.name, value: p.id })),
      },
      {
        name: 'id',
        label: 'Status',
        type: 'select' as const,
        required: true,
        options: statuses.map((s) => ({ label: s.status_name, value: s.id })),
      },
      ...hierarchyInstallFormFields({
        users,
        ownerType: editingId ? 'system' : undefined,
        ownerId: editingId ?? undefined,
      }),
    ],
    [systemHierarchyNames, projects, statuses, users, editingId]
  );

  async function handleAddSystem(formData: Record<string, any>) {
    if (!project) {
      toast.error('Project not found');
      return;
    }
    if (!formData.name.trim() || !formData.description  || !formData.id) {
          toast.error('Please fill in all required fields');
          return;
        }
    setIsSubmitting(true);
    try {
      console.log("my project ID is ", project.id)
      const created = await createSystem({
        name: formData.name,
        description: formData.description || '',
        project_id: formData.project_id ? Number(formData.project_id) : project.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
        serial_number: formData.name && formData.partnumber
                        ? `${formData.name}-${formData.partnumber}`
                        : formData.name || formData.partnumber || "",
        configuration_item: formData.partnumber || formData.name,
        ...parseHierarchyInstallPayload(formData),
      });
      await syncEntityPicture('system', created.id, formData);
      setIsAddOpen(false);
      toast.success('System added successfully');
    } catch (error) {
      console.error('System creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add system';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

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
      toast.success('System updated successfully');
    } catch (error) {
      console.error('System update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update system';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUseInventory(item: Inventory, instanceId?: number) {
    if (!project) {
      throw new Error('Project not found');
    }

    const defaultStatus = statuses[0];
    if (!defaultStatus) {
      throw new Error('No system status available');
    }

    const createEntityByType = buildCreateEntityByType({
      createSystem: async (data) => ({ id: (await createSystem(data as any)).id }),
      createSubsystem: async (data) => ({ id: (await createSubsystem(data as any)).id }),
      createModule: async (data) => ({ id: (await createModule(data as any)).id }),
      createUnit: async (data) => ({ id: (await createUnit(data as any)).id }),
      createComponent: async (data) => ({ id: (await createComponent(data as any)).id }),
    });

    const result = await installEntityFromInventoryWithChildren({
      inventoryItem: item,
      instanceId,
      parentEntityId: project.id,
      entityType: 'system',
      existingChildren: projectSystems,
      defaultStatus,
      createEntity: (data) => createEntityByType('system', data),
      createEntityByType,
    });

    if (result.childrenInstalled > 0) {
      toast.success(
        `Installed ${item.name} and ${result.childrenInstalled} child entit${result.childrenInstalled === 1 ? 'y' : 'ies'} from inventory`
      );
    }

    return result.updatedInventory;
  }
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, hierarchyRes] = await Promise.all([
          api.statuses.list('systems'),
          api.hierarchies.list('system'),
        ]);
        setStatuses(statusRes.data);
        setSystemHierarchyNames(hierarchyRes.data);
      } catch (err) {
        console.error('Failed to fetch statuses or hierarchy names', err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, []);

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

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage systems and hierarchy</p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" asChild>
          <Link href={`/hierarchy-dashboard?project_id=${projectId}`}>
            <Network className="h-4 w-4" />
            Hierarchy
          </Link>
        </Button>
      </div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Order</p>
              <p className="text-sm font-medium">{order?.order_number || project.order_id}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delivery Date</p>
              <p className="text-sm font-medium">{project.end_date}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Systems</p>
              <p className="text-sm font-medium">{projectSystems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={project.status_name || 'Unknown'} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Systems Cards */}
      <EntityCards
        title="Systems"
        description={`Manage systems for ${project.name}`}
        entities={projectSystems}
        onAdd={() => setIsAddOpen(true)}
        onEdit={openEditSystem}
        onDelete={handleDeleteSystem}
        detailPath={(id) => `/systems/${id}`}
        secondaryPath={(id) => `/projects/${projectId}/systems/${id}/hierarchy`}
        addButtonLabel="Add System"
        emptyMessage="No systems yet. Click 'Add System' to create one."
        childEntityType="system"
      />

      {/* Inventory Items */}
      <EntityInventorySearch
        parentEntityName={project.name}
        inventoryType="system"
        allowedInventoryNames={systemHierarchyNames.map((hierarchy) => hierarchy.name)}
        onUseInventory={handleUseInventory}
      />

      {/* Add System Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        {/* <Button className="ml-auto" onClick={() => setIsAddOpen(true)}>
          + New System
        </Button> */}
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New System</DialogTitle>
            <DialogDescription>Create a new system for this project</DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={systemFormFields}
            onSubmit={handleAddSystem}
            isLoading={isSubmitting}
            onCancel={() => setIsAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit System Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit System</DialogTitle>
            <DialogDescription>Update system details</DialogDescription>
          </DialogHeader>
          {editingSystem ? (
            <EntityForm
              key={editingSystem.id}
              fields={systemFormFields}
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
    </div>
  );
}
