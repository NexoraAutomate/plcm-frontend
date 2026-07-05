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
import * as api from '@/lib/api';
import * as Models from '@/lib/models';
import type { Inventory } from '@/lib/models';
import { getChildInventoryType, nextSerialNumberFromInventory } from '@/lib/entity-hierarchy';
import { inventoryToHierarchyCreatePayload } from '@/lib/hierarchy-install-fields';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';

export default function UnitDetailPage() {
  const params = useParams();
  const unitId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const { units, modules, components, createComponent, deleteComponent, updateComponent, updateUnit } = useDataStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unit = units.find((u) => String(u.id) === unitId);
  const module = unit ? modules.find((m) => m.id === unit.module_id) : null;
  const unitComponents = unit ? components.filter((c) => c.unit_id === unit.id) : [];

  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [unitHierarchyNames, setUnitHierarchyNames] = useState<Models.Hierarchy[]>([]);
  const [componentHierarchyNames, setComponentHierarchyNames] = useState<Models.Hierarchy[]>([]);

  const componentFormFields = [
    {
      name: 'name',
      label: 'Component Name',
      type: 'select' as const,
      required: true,
      options: componentHierarchyNames.map((hierarchy) => ({ label: hierarchy.name, value: hierarchy.name })),
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea' as const,
      required: false,
      placeholder: 'Enter component description',
    },
    {
      name: 'partnumber',
      label: 'Part #',
      type: 'text' as const,
      required: false,
      placeholder: 'Enter Part Number of Component',
    },
    // {
    //   name: 'sku',
    //   label: 'SKU',
    //   type: 'text' as const,
    //   required: false,
    //   placeholder: 'Enter component SKU',
    // },
    {
      name: 'id',
      label: 'Status',
      type: 'select' as const,
      required: true,
      options: statuses.map(s => ({ label: s.status_name, value: s.id })),
    },
  ];

  async function handleAddComponent(formData: Record<string, any>) {
    if (!unit) {
      toast.error('Unit not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await createComponent({
        name: formData.name,
        description: formData.description || '',
        sku: formData.sku || '',
        unit_id: unit.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
        serial_number: formData.name && formData.partnumber
          ? `${formData.name}-${formData.partnumber}`
          : formData.name || formData.partnumber || ""
      });
      setIsAddOpen(false);
      toast.success('Component added successfully');
    } catch (error) {
      console.error('[v0] Component creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add component';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteComponent(id: number) {
    try {
      await deleteComponent(id);
      toast.success('Component deleted successfully');
    } catch {
      toast.error('Failed to delete component');
    }
  }

  function openEditComponent(id: number) {
    setEditingId(id);
    setIsEditOpen(true);
  }

  const editingComponent = editingId
    ? unitComponents.find((c) => c.id === editingId)
    : null;

  async function handleEditComponent(formData: Record<string, any>) {
    if (!unit || !editingId) {
      toast.error('Component not found');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateComponent(editingId, {
        name: formData.name,
        description: formData.description || '',
        unit_id: unit.id,
        status_id: Number(formData.id),
        part_number: formData.partnumber,
      });
      setIsEditOpen(false);
      setEditingId(null);
      toast.success('Component updated successfully');
    } catch (error) {
      console.error('Component update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update component';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }
  async function handleUseInventory(item: Inventory) {
    if (!unit) {
      throw new Error('Unit not found');
    }

    const defaultStatus = statuses[0];
    if (!defaultStatus) {
      throw new Error('No component status available');
    }

    await createComponent({
      name: item.name,
      description: item.description || '',
      sku: '',
      unit_id: unit.id,
      status_id: defaultStatus.id,
      ...inventoryToHierarchyCreatePayload(
        item,
        nextSerialNumberFromInventory(item, unitComponents)
      ),
    });
  }
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, unitHierarchyRes] = await Promise.all([
          api.statuses.list("components"),
          api.hierarchies.list("unit"),
        ]);
        setStatuses(statusRes.data);
        setUnitHierarchyNames(unitHierarchyRes.data);

        if (unit) {
          const parentHierarchyId = unitHierarchyRes.data.find(
            (hierarchy) => hierarchy.name === unit.name
          )?.id;

          if (parentHierarchyId) {
            const childRes = await api.hierarchies.list("component", parentHierarchyId);
            setComponentHierarchyNames(childRes.data);
          } else {
            setComponentHierarchyNames([]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch statuses or hierarchy names", err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [unit]);
  if (pageLoading) return <PageLoader />;


  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">Unit Not Found</h2>
        <Link href="/units" className="mt-2 text-sm text-primary underline">
          Back to Units
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
              <Link href="/modules">Modules</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/modules/${module?.id}`}>{module?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{unit.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Link href="/units">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{unit.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{unit.description}</p>
        </div>
      </div>

      {/* Unit Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Module</p>
              <p className="text-sm font-medium">{module?.name || 'N/A'}</p>
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
                <StatusBadge status={unit.status?.status_name || 'Unknown'} />
                <EntityStatusHistorySheet
                  entityType="unit"
                  entityPk={unit.id}
                  entityName={unit.name}
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
              <p className="text-xs text-muted-foreground">Components</p>
              <p className="text-sm font-medium">{unitComponents.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EntityInstallMetadataCard
        ownerType="unit"
        entity={unit}
        onUpdate={(data) => updateUnit(unit.id, data)}
      />

      {/* Components Cards */}
      <EntityCards
        title="Components"
        description={`Manage components for ${unit.name}`}
        entities={unitComponents}
        onAdd={() => setIsAddOpen(true)}
        onEdit={openEditComponent}
        onDelete={handleDeleteComponent}
        detailPath={(id) => `/components/${id}`}
        addButtonLabel="Add Component"
        emptyMessage="No components yet. Click 'Add Component' to create one."
        childEntityType="component"
      />

      {/* Inventory Items */}
      <EntityInventorySearch
        parentEntityName={unit.name}
        inventoryType={getChildInventoryType('unit')}
        allowedInventoryNames={componentHierarchyNames.map((hierarchy) => hierarchy.name)}
        onUseInventory={handleUseInventory}
      />

      {/* Add Component Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Component</DialogTitle>
            <DialogDescription>Create a new component for {unit.name}</DialogDescription>
          </DialogHeader>
          <EntityForm
            fields={componentFormFields}
            onSubmit={handleAddComponent}
            isLoading={isSubmitting}
            onCancel={() => setIsAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Component Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Component</DialogTitle>
            <DialogDescription>Update component details</DialogDescription>
          </DialogHeader>
          {editingComponent ? (
            <EntityForm
              key={editingComponent.id}
              fields={componentFormFields}
              initialValues={{
                name: editingComponent.name,
                description: editingComponent.description || '',
                partnumber: editingComponent.part_number || '',
                id: editingComponent.status_id,
              }}
              onSubmit={handleEditComponent}
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
