'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Calendar, Layers } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { EntityCards } from '@/components/entity-cards';
import { EntityForm } from '@/components/entity-form';
import { EntityInventorySearch } from '@/components/entity-inventory-search';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import * as api from '@/lib/api';
import { fetchStatusesByType } from '@/lib/api';
import * as Models from '@/lib/models';
import type { Inventory } from '@/lib/models';
import { getChildInventoryType } from '@/lib/entity-hierarchy';
import { resolveStatusName } from '@/lib/entity-status';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';
import {
  buildCreateEntityByType,
  installEntityFromInventoryWithChildren,
} from '@/lib/inventory-child-install';
import {
  ReplaceFromInventoryDialog,
  type ReplaceFromInventoryTarget,
} from '@/components/replace-from-inventory-dialog';
import {
  filterChildrenForParentSlot,
  systemHierarchyPath,
} from '@/lib/entity-replacement';
import { useResolvedHardwareEntity } from '@/hooks/use-resolved-hardware-entity';

export default function SystemDetailPage() {
  const params = useParams();
  const systemId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    systems,
    projects,
    subsystems,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
    deleteSubsystem,
    updateSubsystem,
    updateSystem,
    statuses: storeStatuses,
  } = useDataStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceFromInventoryTarget | null>(null);

  const system = useResolvedHardwareEntity(systemId, 'system', systems);
  const project = system ? projects.find((p) => p.id === system.project_id) : null;
  const systemSubsystems = system
    ? filterChildrenForParentSlot(subsystems, system, systems, (sub) => sub.system_id)
    : [];
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [systemHierarchyNames, setSystemHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const [subsystemHierarchyNames, setSubsystemHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const subsystemFormFields = [
    {
      name: 'name',
      label: 'Subsystem Name',
      type: 'select' as const,
      required: true,
      options: subsystemHierarchyNames.map((hierarchy) => ({ label: hierarchy.name, value: hierarchy.name })),
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const,
      required: false,
      placeholder: 'Enter subsystem description',
    },
    {
      name: 'partnumber',
      label: 'Part #',
      type: 'text' as const,
      required: false,
      placeholder: 'Enter Part Number of SubSystem',
    },
    {
      name: 'id',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: statuses.map(s => ({ label: s.status_name, value: s.id })),
    },

  ];

  async function handleAddSubsystem(formData: Record<string, any>) {
    if (!system) {
      toast.error('System not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await createSubsystem({
        name: formData.name,
        description: formData.description || '',
        system_id: system.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
        serial_number: formData.name && formData.partnumber
          ? `${formData.name}-${formData.partnumber}`
          : formData.name || formData.partnumber || "",
        configuration_item: formData.partnumber || formData.name,
      });
      setIsAddOpen(false);
      toast.success('Subsystem added successfully');
    } catch (error) {
      console.error('[v0] Subsystem creation error:', error);
      let errorMessage = 'Failed to add subsystem';
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((item) => item.msg || JSON.stringify(item)).join(', ');
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSubsystem(id: number) {
    try {
      await deleteSubsystem(id);
      toast.success('Subsystem deleted successfully');
    } catch {
      toast.error('Failed to delete subsystem');
    }
  }

  function openEditSubsystem(id: number) {
    setEditingId(id);
    setIsEditOpen(true);
  }

  const editingSubsystem = editingId
    ? systemSubsystems.find((s) => s.id === editingId)
    : null;

  async function handleEditSubsystem(formData: Record<string, any>) {
    if (!system || !editingId) {
      toast.error('Subsystem not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateSubsystem(editingId, {
        name: formData.name,
        description: formData.description || '',
        system_id: system.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
      });
      setIsEditOpen(false);
      setEditingId(null);
      toast.success('Subsystem updated successfully');
    } catch (error) {
      console.error('Subsystem update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update subsystem';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUseInventory(item: Inventory, instanceId?: number) {
    if (!system) {
      throw new Error('System not found');
    }

    const defaultStatus = statuses[0];
    if (!defaultStatus) {
      throw new Error('No subsystem status available');
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
      parentEntityId: system.id,
      entityType: 'subsystem',
      existingChildren: systemSubsystems,
      defaultStatus,
      createEntity: (data) => createEntityByType('subsystem', data),
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
        const [statusResult, hierarchyResult] = await Promise.allSettled([
          fetchStatusesByType('subsystems'),
          api.hierarchies.list('system'),
        ]);

        if (statusResult.status === 'fulfilled') {
          setStatuses(statusResult.value);
        }

        if (hierarchyResult.status === 'fulfilled') {
          setSystemHierarchyNames(hierarchyResult.value.data);

          if (system) {
            const parentHierarchyId = hierarchyResult.value.data.find(
              (hierarchy) => hierarchy.name === system.name
            )?.id;

            if (parentHierarchyId) {
              try {
                const childRes = await api.hierarchies.list('subsystem', parentHierarchyId);
                setSubsystemHierarchyNames(childRes.data);
              } catch (childError) {
                console.error('Failed to fetch subsystem hierarchy names', childError);
                setSubsystemHierarchyNames([]);
              }
            } else {
              setSubsystemHierarchyNames([]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch statuses or hierarchy names', err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [system]);

  if (pageLoading) return <PageLoader />;

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">System Not Found</h2>
        <Link href="/systems" className="mt-2 text-sm text-primary underline">
          Back to Systems
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
              <Link href="/systems">Systems</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{system.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href={project ? `/projects/${project.id}` : '/systems'}>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{system.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{system.description}</p>
        </div>
      </div>

      {/* System Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Project</p>
              <p className="text-sm font-medium">{project?.name || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-1">
                <StatusBadge status={resolveStatusName(system, storeStatuses.length ? storeStatuses : statuses)} />
                <EntityStatusHistorySheet
                  entityType="system"
                  entityPk={system.id}
                  entityName={system.name}
                  statuses={storeStatuses.length ? storeStatuses : statuses}
                  triggerVariant="icon"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subsystems</p>
              <p className="text-sm font-medium">{systemSubsystems.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityInstallMetadataCard
        ownerType="system"
        entity={system}
        onUpdate={(data) => updateSystem(system.id, data)}
        projectId={project?.id}
        allowReplace
        hierarchyHref={systemHierarchyPath(project?.id, system.id)}
      />

      {/* Subsystems Cards */}
      <EntityCards
        title="Subsystems"
        description={`Manage subsystems for ${system.name}`}
        entities={systemSubsystems}
        statuses={storeStatuses.length ? storeStatuses : statuses}
        onAdd={() => setIsAddOpen(true)}
        onEdit={openEditSubsystem}
        onReplace={(entity) => {
          setReplaceTarget({
            entityType: 'subsystem',
            entityId: entity.id,
            entityName: entity.name,
            partNumber: entity.part_number,
            serialNumber: entity.serial_number,
            replacementSequence: entity.replacement_sequence,
          });
          setReplaceOpen(true);
        }}
        onDelete={handleDeleteSubsystem}
        detailPath={(id) => `/subsystems/${id}`}
        secondaryPath={
          project
            ? (id) =>
                systemHierarchyPath(project.id, system.id, {
                  rootType: 'subsystem',
                  rootId: id,
                }) ?? '#'
            : undefined
        }
        addButtonLabel="Add Subsystem"
        emptyMessage="No subsystems yet. Click 'Add Subsystem' to create one."
        childEntityType="subsystem"
      />

      {/* Inventory Items */}
      <EntityInventorySearch
        parentEntityName={system.name}
        inventoryType={getChildInventoryType('system')}
        allowedInventoryNames={subsystemHierarchyNames.map((hierarchy) => hierarchy.name)}
        onUseInventory={handleUseInventory}
      />

      {/* Add Subsystem Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subsystem</DialogTitle>
            <DialogDescription>Create a new subsystem for {system.name}</DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={subsystemFormFields}
            onSubmit={handleAddSubsystem}
            isLoading={isSubmitting}
            onCancel={() => setIsAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Subsystem Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subsystem</DialogTitle>
            <DialogDescription>Update subsystem details</DialogDescription>
          </DialogHeader>
          {editingSubsystem ? (
            <EntityForm
              key={editingSubsystem.id}
              fields={subsystemFormFields}
              initialValues={{
                name: editingSubsystem.name,
                description: editingSubsystem.description || '',
                partnumber: editingSubsystem.part_number || '',
                id: editingSubsystem.status_id,
              }}
              onSubmit={handleEditSubsystem}
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

      {project ? (
        <ReplaceFromInventoryDialog
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
          projectId={project.id}
          target={replaceTarget}
        />
      ) : null}
    </div>
  );
}
