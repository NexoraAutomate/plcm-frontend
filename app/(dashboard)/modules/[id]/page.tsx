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
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import type { Inventory } from '@/lib/models';
import { getChildInventoryType } from '@/lib/entity-hierarchy';
import {
  buildCreateEntityByType,
  installEntityFromInventoryWithChildren,
} from '@/lib/inventory-child-install';
import { EntityInventorySearch } from '@/components/entity-inventory-search';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';
import {
  ReplaceFromInventoryDialog,
  type ReplaceFromInventoryTarget,
} from '@/components/replace-from-inventory-dialog';
import {
  filterCurrentInstallEntities,
  resolveProjectIdForHardwareEntity,
} from '@/lib/entity-replacement';

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    modules,
    subsystems,
    systems,
    units,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
    deleteUnit,
    updateUnit,
    updateModule,
  } = useDataStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceFromInventoryTarget | null>(null);

  const module = modules.find((m) => String(m.id) === moduleId);
  const subsystem = module ? subsystems.find((s) => s.id === module.subsystem_id) : null;
  const projectId = module
    ? resolveProjectIdForHardwareEntity('module', module.id, {
        systems,
        subsystems,
        modules,
        units: [],
        components: [],
      })
    : null;
  const moduleUnits = module
    ? filterCurrentInstallEntities(units.filter((u) => u.module_id === module.id))
    : [];

  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [moduleHierarchyNames, setModuleHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const [unitHierarchyNames, setUnitHierarchyNames] = useState<Models.Hierarchy[]>([]);

  const unitFormFields = [
    {
      name: 'name',
      label: 'Unit Name',
      type: 'select' as const,
      required: true,
      options: unitHierarchyNames.map((hierarchy) => ({ label: hierarchy.name, value: hierarchy.name })),
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const,
      required: false,
      placeholder: 'Enter unit description',
    },
    {
      name: 'partnumber',
      label: 'Part #',
      type: 'text' as const,
      required: false,
      placeholder: 'Enter Part Number of Unit',
    },
    {
      name: 'id',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: statuses.map(s => ({ label: s.status_name, value: s.id })),
    },
  ];

  async function handleAddUnit(formData: Record<string, any>) {
    if (!module) {
      toast.error('Module not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await createUnit({
        name: formData.name,
        description: formData.description || '',
        module_id: module.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
        serial_number: formData.name && formData.partnumber
          ? `${formData.name}-${formData.partnumber}`
          : formData.name || formData.partnumber || ""
      });
      setIsAddOpen(false);
      toast.success('Unit added successfully');
    } catch (error) {
      console.error('[v0] Unit creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add unit';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUnit(id: number) {
    try {
      await deleteUnit(id);
      toast.success('Unit deleted successfully');
    } catch {
      toast.error('Failed to delete unit');
    }
  }

  function openEditUnit(id: number) {
    setEditingId(id);
    setIsEditOpen(true);
  }

  const editingUnit = editingId
    ? moduleUnits.find((u) => u.id === editingId)
    : null;

  async function handleEditUnit(formData: Record<string, any>) {
    if (!module || !editingId) {
      toast.error('Unit not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateUnit(editingId, {
        name: formData.name,
        description: formData.description || '',
        module_id: module.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
      });
      setIsEditOpen(false);
      setEditingId(null);
      toast.success('Unit updated successfully');
    } catch (error) {
      console.error('Unit update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update unit';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUseInventory(item: Inventory, instanceId?: number) {
    if (!module) {
      throw new Error('Module not found');
    }

    const defaultStatus = statuses[0];
    if (!defaultStatus) {
      throw new Error('No unit status available');
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
      parentEntityId: module.id,
      entityType: 'unit',
      existingChildren: moduleUnits,
      defaultStatus,
      createEntity: (data) => createEntityByType('unit', data),
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
        const [statusRes, moduleHierarchyRes] = await Promise.all([
          api.statuses.list("units"),
          api.hierarchies.list("module"),
        ]);
        setStatuses(statusRes.data);
        setModuleHierarchyNames(moduleHierarchyRes.data);

        if (module) {
          const parentHierarchyId = moduleHierarchyRes.data.find(
            (hierarchy) => hierarchy.name === module.name
          )?.id;

          if (parentHierarchyId) {
            const childRes = await api.hierarchies.list("unit", parentHierarchyId);
            setUnitHierarchyNames(childRes.data);
          } else {
            setUnitHierarchyNames([]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch statuses or hierarchy names", err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [module]);
  if (pageLoading) return <PageLoader />;

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Module Not Found</h2>
        <Link href="/modules" className="mt-2 text-sm text-primary underline">
          Back to Modules
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
              <Link href="/subsystems">Subsystems</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/subsystems/${subsystem?.id}`}>{subsystem?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{module.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href={subsystem ? `/subsystems/${subsystem.id}` : '/modules'}>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{module.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
        </div>
      </div>

      {/* Module Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subsystem</p>
              <p className="text-sm font-medium">{subsystem?.name || 'N/A'}</p>
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
                <StatusBadge status={module.status?.status_name || 'Unknown'} />
                <EntityStatusHistorySheet
                  entityType="module"
                  entityPk={module.id}
                  entityName={module.name}
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
              <p className="text-xs text-muted-foreground">Units</p>
              <p className="text-sm font-medium">{moduleUnits.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityInstallMetadataCard
        ownerType="module"
        entity={module}
        onUpdate={(data) => updateModule(module.id, data)}
        projectId={projectId ?? undefined}
        allowReplace
      />

      {/* Units Cards */}
      <EntityCards
        title="Units"
        description={`Manage units for ${module.name}`}
        entities={moduleUnits}
        onAdd={() => setIsAddOpen(true)}
        onEdit={openEditUnit}
        onReplace={(entity) => {
          setReplaceTarget({
            entityType: 'unit',
            entityId: entity.id,
            entityName: entity.name,
            partNumber: entity.part_number,
            serialNumber: entity.serial_number,
            replacementSequence: entity.replacement_sequence,
          });
          setReplaceOpen(true);
        }}
        onDelete={handleDeleteUnit}
        detailPath={(id) => `/units/${id}`}
        addButtonLabel="Add Unit"
        emptyMessage="No units yet. Click 'Add Unit' to create one."
        childEntityType="unit"
      />

      {/* Inventory Items */}
      <EntityInventorySearch
        parentEntityName={module.name}
        inventoryType={getChildInventoryType('module')}
        allowedInventoryNames={unitHierarchyNames.map((hierarchy) => hierarchy.name)}
        onUseInventory={handleUseInventory}
      />
      
      {/* Add Unit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Unit</DialogTitle>
            <DialogDescription>Create a new unit for {module.name}</DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={unitFormFields}
            onSubmit={handleAddUnit}
            isLoading={isSubmitting}
            onCancel={() => setIsAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Unit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Update unit details</DialogDescription>
          </DialogHeader>
          {editingUnit ? (
            <EntityForm
              key={editingUnit.id}
              fields={unitFormFields}
              initialValues={{
                name: editingUnit.name,
                description: editingUnit.description || '',
                partnumber: editingUnit.part_number || '',
                id: editingUnit.status_id,
              }}
              onSubmit={handleEditUnit}
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

      {projectId ? (
        <ReplaceFromInventoryDialog
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
          projectId={projectId}
          target={replaceTarget}
        />
      ) : null}
    </div>
  );
}
