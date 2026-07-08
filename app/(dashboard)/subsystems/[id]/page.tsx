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
import * as Models from '@/lib/models';
import type { Inventory } from '@/lib/models';
import { getChildInventoryType } from '@/lib/entity-hierarchy';
import {
  buildCreateEntityByType,
  installEntityFromInventoryWithChildren,
} from '@/lib/inventory-child-install';
import * as api from '@/lib/api';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';

export default function SubsystemDetailPage() {
  const params = useParams();
  const subsystemId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    subsystems,
    systems,
    modules,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
    deleteModule,
    updateModule,
    updateSubsystem,
  } = useDataStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subsystem = subsystems.find((s) => String(s.id) === subsystemId);
  const system = subsystem ? systems.find((s) => s.id === subsystem.system_id) : null;
  const subsystemModules = subsystem ? modules.filter((m) => m.subsystem_id === subsystem.id) : [];
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [subsystemHierarchyNames, setSubsystemHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const [moduleHierarchyNames, setModuleHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const moduleFormFields = [
    {
      name: 'name',
      label: 'Module Name',
      type: 'select' as const,
      required: true,
      options: moduleHierarchyNames.map((hierarchy) => ({ label: hierarchy.name, value: hierarchy.name })),
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const,
      required: false,
      placeholder: 'Enter module description',
    },
    {
      name: 'partnumber',
      label: 'Part #',
      type: 'text' as const,
      required: false,
      placeholder: 'Enter Part Number of Module',
    },
    {
      name: 'id',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: statuses.map(s => ({ label: s.status_name, value: s.id })),
    },
  ];

  async function handleAddModule(formData: Record<string, any>) {
    if (!subsystem) {
      toast.error('Subsystem not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await createModule({
        name: formData.name,
        description: formData.description || '',
        subsystem_id: subsystem.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
        serial_number: formData.name && formData.partnumber
          ? `${formData.name}-${formData.partnumber}`
          : formData.name || formData.partnumber || ""
      });
      setIsAddOpen(false);
      toast.success('Module added successfully');
    } catch (error) {
      console.error('Module creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add module';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteModule(id: number) {
    try {
      await deleteModule(id);
      toast.success('Module deleted successfully');
    } catch {
      toast.error('Failed to delete module');
    }
  }

  function openEditModule(id: number) {
    setEditingId(id);
    setIsEditOpen(true);
  }

  const editingModule = editingId
    ? subsystemModules.find((m) => m.id === editingId)
    : null;

  async function handleEditModule(formData: Record<string, any>) {
    if (!subsystem || !editingId) {
      toast.error('Module not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateModule(editingId, {
        name: formData.name,
        description: formData.description || '',
        subsystem_id: subsystem.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
      });
      setIsEditOpen(false);
      setEditingId(null);
      toast.success('Module updated successfully');
    } catch (error) {
      console.error('Module update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update module';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUseInventory(item: Inventory, instanceId?: number) {
    if (!subsystem) {
      throw new Error('Subsystem not found');
    }

    const defaultStatus = statuses[0];
    if (!defaultStatus) {
      throw new Error('No module status available');
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
      parentEntityId: subsystem.id,
      entityType: 'module',
      existingChildren: subsystemModules,
      defaultStatus,
      createEntity: (data) => createEntityByType('module', data),
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
        const [statusRes, subsystemHierarchyRes] = await Promise.all([
          api.statuses.list('modules'),
          api.hierarchies.list('subsystem'),
        ]);
        setStatuses(statusRes.data);
        setSubsystemHierarchyNames(subsystemHierarchyRes.data);

        if (subsystem) {
          const parentHierarchyId = subsystemHierarchyRes.data.find(
            (hierarchy) => hierarchy.name === subsystem.name
          )?.id;

          if (parentHierarchyId) {
            const childRes = await api.hierarchies.list('module', parentHierarchyId);
            setModuleHierarchyNames(childRes.data);
          } else {
            setModuleHierarchyNames([]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch statuses or hierarchy names', err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [subsystem]);

  if (pageLoading) return <PageLoader />;

  if (!subsystem) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Subsystem Not Found</h2>
        <Link href="/subsystems" className="mt-2 text-sm text-primary underline">
          Back to Subsystems
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
            <BreadcrumbLink asChild>
              <Link href={`/systems/${system?.id}`}>{system?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{subsystem.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href={system ? `/systems/${system.id}` : '/subsystems'}>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{subsystem.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subsystem.description}</p>
        </div>
      </div>

      {/* Subsystem Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">System</p>
              <p className="text-sm font-medium">{system?.name || 'N/A'}</p>
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
                <StatusBadge status={subsystem.status?.status_name || 'Unknown'} />
                <EntityStatusHistorySheet
                  entityType="subsystem"
                  entityPk={subsystem.id}
                  entityName={subsystem.name}
                  statuses={statuses}
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
              <p className="text-xs text-muted-foreground">Modules</p>
              <p className="text-sm font-medium">{subsystemModules.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityInstallMetadataCard
        ownerType="subsystem"
        entity={subsystem}
        onUpdate={(data) => updateSubsystem(subsystem.id, data)}
      />

      {/* Modules Cards */}
      <EntityCards
        title="Modules"
        description={`Manage modules for ${subsystem.name}`}
        entities={subsystemModules}
        onAdd={() => setIsAddOpen(true)}
        onEdit={openEditModule}
        onDelete={handleDeleteModule}
        detailPath={(id) => `/modules/${id}`}
        addButtonLabel="Add Module"
        emptyMessage="No modules yet. Click 'Add Module' to create one."
        childEntityType="module"
      />

      {/* Inventory Items */}
      <EntityInventorySearch
        parentEntityName={subsystem.name}
        inventoryType={getChildInventoryType('subsystem')}
        allowedInventoryNames={moduleHierarchyNames.map((hierarchy) => hierarchy.name)}
        onUseInventory={handleUseInventory}
      />

      {/* Add Module Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Module</DialogTitle>
            <DialogDescription>Create a new module for {subsystem.name}</DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={moduleFormFields}
            onSubmit={handleAddModule}
            isLoading={isSubmitting}
            onCancel={() => setIsAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Module Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Module</DialogTitle>
            <DialogDescription>Update module details</DialogDescription>
          </DialogHeader>
          {editingModule ? (
            <EntityForm
              key={editingModule.id}
              fields={moduleFormFields}
              initialValues={{
                name: editingModule.name,
                description: editingModule.description || '',
                partnumber: editingModule.part_number || '',
                id: editingModule.status_id,
              }}
              onSubmit={handleEditModule}
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
