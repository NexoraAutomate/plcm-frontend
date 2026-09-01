'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Layers } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { EntityCards } from '@/components/entity-cards';
import { P } from '@/lib/permission-codes';
import { EntityForm } from '@/components/entity-form';
import { HierarchyEntityInventoryDialog } from '@/components/hierarchy/hierarchy-entity-inventory-create-dialog';
import { isExistingProject } from '@/lib/project-existing';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { listTemplateNames } from '@/lib/hierarchy-template-names';
import * as Models from '@/lib/models';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';
import {
  ReplaceFromInventoryDialog,
  type ReplaceFromInventoryTarget,
} from '@/components/replace-from-inventory-dialog';
import {
  filterChildrenForParentSlot,
  resolveCurrentInstallEntity,
  resolveProjectIdForHardwareEntity,
  resolveSystemIdForHardwareEntity,
  systemHierarchyPath,
} from '@/lib/entity-replacement';
import { useResolvedHardwareEntity } from '@/hooks/use-resolved-hardware-entity';
import { isProjectReadOnly } from '@/lib/workflow-status';
import { resolveStatusName } from '@/lib/entity-status';
import { HierarchyEntityHeader } from '@/components/hierarchy-entity-header';

export default function UnitDetailPage() {
  const { entityLabel } = useAppDefinitions();

  const params = useParams();
  const unitId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    units,
    modules,
    subsystems,
    systems,
    components,
    projects,
    deleteComponent,
    updateComponent,
    updateUnit,
  } = useDataStore();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceFromInventoryTarget | null>(null);

  const unit = useResolvedHardwareEntity(unitId, 'unit', units);
  const module = unit ? resolveCurrentInstallEntity(unit.module_id, modules) : null;
  const projectId = unit
    ? resolveProjectIdForHardwareEntity('unit', unit.id, {
        systems,
        subsystems,
        modules,
        units,
        components: [],
      })
    : null;
  const project = projects.find((p) => p.id === projectId);
  const hierarchyReadOnly = isProjectReadOnly(
    project?.status_name
  );
  const isExisting = isExistingProject(project);
  const systemId = unit
    ? resolveSystemIdForHardwareEntity('unit', unit.id, {
        subsystems,
        modules,
        units,
        components: [],
      })
    : null;
  const hierarchyHref = unit
    ? systemHierarchyPath(projectId, systemId, {
        rootType: 'unit',
        rootId: unit.id,
      })
    : undefined;
  const unitComponents = unit
    ? filterChildrenForParentSlot(components, unit, units, (component) => component.unit_id)
    : [];

  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [componentHierarchyNames, setComponentHierarchyNames] = useState<Models.Hierarchy[]>([]);

  const nameOptions = useMemo(
    () =>
      componentHierarchyNames.map((hierarchy) => ({
        label: hierarchy.name,
        value: hierarchy.name,
      })),
    [componentHierarchyNames]
  );
  const statusOptions = useMemo(
    () => statuses.map((s) => ({ label: s.status_name, value: s.id })),
    [statuses]
  );
  const allowedNames = useMemo(
    () => componentHierarchyNames.map((hierarchy) => hierarchy.name),
    [componentHierarchyNames]
  );

  const componentEditFormFields = useMemo(
    () => [
      {
        name: 'name',
        label: `${entityLabel('component')} Name`,
        type: 'select' as const,
        required: true,
        options: nameOptions,
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
        placeholder: `Enter Part Number of ${entityLabel('component')}`,
      },
      {
        name: 'id',
        label: 'Status',
        type: 'select' as const,
        required: true,
        options: statusOptions,
      },
    ],
    [nameOptions, statusOptions, entityLabel]
  );

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
      toast.success(`${entityLabel('component')} updated successfully`);
    } catch (error) {
      console.error('Component update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update component';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }
  useEffect(() => {
    const fetchData = async () => {
      try {
        const configId = projects.find((p) => p.id === projectId)?.hierarchy_config_id;
        const [statusRes, childNames] = await Promise.all([
          api.statuses.list("components"),
          unit
            ? listTemplateNames({
                level: "component",
                parentName: unit.name,
                configId,
              })
            : Promise.resolve([]),
        ]);
        setStatuses(statusRes.data);
        setComponentHierarchyNames(childNames as Models.Hierarchy[]);
      } catch (err) {
        console.error("Failed to fetch statuses or hierarchy names", err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [unit, projectId, projects]);
  if (pageLoading) return <PageLoader />;


  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">{`${entityLabel('unit')} Not Found`}</h2>
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

      <HierarchyEntityHeader
        name={unit.name}
        description={unit.description}
        backHref={module ? `/modules/${module.id}` : '/units'}
        projectName={project?.name}
        systemName={
          unit && systemId != null
            ? systems.find((item) => item.id === systemId)?.name
            : undefined
        }
        sdlsNumber={
          unit && systemId != null
            ? systems.find((item) => item.id === systemId)?.sdls_number
            : undefined
        }
      />

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
                <StatusBadge status={resolveStatusName(unit, statuses)} />
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
        projectId={projectId ?? undefined}
        allowReplace
        hierarchyHref={hierarchyHref}
      />

      {/* Components Cards */}
      <EntityCards
        title="Components"
        description={`Manage components for ${unit.name}`}
        entities={unitComponents}
        onEdit={openEditComponent}
        onReplace={(entity) => {
          setReplaceTarget({
            entityType: 'component',
            entityId: entity.id,
            entityName: entity.name,
            partNumber: entity.part_number,
            serialNumber: entity.serial_number,
            replacementSequence: entity.replacement_sequence,
          });
          setReplaceOpen(true);
        }}
        onDelete={handleDeleteComponent}
        detailPath={(id) => `/components/${id}`}
        secondaryPath={
          projectId && systemId
            ? (id) =>
                systemHierarchyPath(projectId, systemId, {
                  rootType: 'component',
                  rootId: id,
                }) ?? '#'
            : undefined
        }
        emptyMessage={`No ${entityLabel('component', true).toLowerCase()} yet.`}
        childEntityType="component"
        createPermission={P.create_components}
        editPermission={P.edit_components}
        deletePermission={P.delete_components}
        readOnly={hierarchyReadOnly}
        projectId={projectId}
      />

      {isExisting ? (
        editingComponent ? (
          <HierarchyEntityInventoryDialog
            open={isEditOpen}
            onOpenChange={(open) => {
              setIsEditOpen(open);
              if (!open) setEditingId(null);
            }}
            entityType="component"
            entityId={editingComponent.id}
            entity={editingComponent}
            parentId={unit.id}
            title={`Edit ${entityLabel('component')}`}
            description={`Register details for ${editingComponent.name}`}
          />
        ) : null
      ) : (
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Component</DialogTitle>
            <DialogDescription>Update component details</DialogDescription>
          </DialogHeader>
          {editingComponent ? (
            <EntityForm
              key={editingComponent.id}
              fields={componentEditFormFields}
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
      )}

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
