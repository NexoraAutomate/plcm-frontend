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
import { ArrowLeft, Calendar, Layers } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/status-badge';
import { EntityCards } from '@/components/entity-cards';
import { P } from '@/lib/permission-codes';
import { EntityForm } from '@/components/entity-form';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import * as Models from '@/lib/models';
import { resolveStatusName } from '@/lib/entity-status';
import {
  buildCreateEntityByType,
} from '@/lib/inventory-child-install';
import * as api from '@/lib/api';
import { listTemplateNames } from '@/lib/hierarchy-template-names';
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
  systemHierarchyPath,
} from '@/lib/entity-replacement';
import { useResolvedHardwareEntity } from '@/hooks/use-resolved-hardware-entity';
import { useHierarchyCreateFormOptions } from '@/hooks/use-hierarchy-create-form-options';
import { createHierarchyEntityFromForm } from '@/lib/hierarchy-create-form';
import { isProjectReadOnly } from '@/lib/workflow-status';

export default function SubsystemDetailPage() {
  const { entityLabel } = useAppDefinitions();

  const params = useParams();
  const subsystemId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    subsystems,
    systems,
    modules,
    projects,
    createSystem,
    createSubsystem,
    createModule,
    createUnit,
    createComponent,
    deleteModule,
    updateModule,
    updateSubsystem,
    runSilentEntityBatch,
  } = useDataStore();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceFromInventoryTarget | null>(null);

  const subsystem = useResolvedHardwareEntity(subsystemId, 'subsystem', subsystems);
  const system = subsystem ? resolveCurrentInstallEntity(subsystem.system_id, systems) : null;
  const projectId = subsystem
    ? resolveProjectIdForHardwareEntity('subsystem', subsystem.id, {
        systems,
        subsystems,
        modules: [],
        units: [],
        components: [],
      })
    : null;
  const hierarchyReadOnly = isProjectReadOnly(
    projects.find((p) => p.id === projectId)?.status_name
  );
  const subsystemModules = subsystem
    ? filterChildrenForParentSlot(modules, subsystem, subsystems, (mod) => mod.subsystem_id)
    : [];
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [moduleHierarchyNames, setModuleHierarchyNames] = useState<Models.Hierarchy[]>([]);

  const nameOptions = useMemo(
    () =>
      moduleHierarchyNames.map((hierarchy) => ({
        label: hierarchy.name,
        value: hierarchy.name,
      })),
    [moduleHierarchyNames]
  );
  const statusOptions = useMemo(
    () => statuses.map((s) => ({ label: s.status_name, value: s.id })),
    [statuses]
  );
  const allowedNames = useMemo(
    () => moduleHierarchyNames.map((hierarchy) => hierarchy.name),
    [moduleHierarchyNames]
  );

  const {
    inventoryItems,
    createFormFields: moduleCreateFormFields,
    handleFieldChange: handleModuleCreateFieldChange,
    createInitialValues: moduleCreateInitialValues,
  } = useHierarchyCreateFormOptions({
    entityType: 'module',
    entityLabel: entityLabel('module'),
    nameOptions,
    statusOptions,
    allowedNames,
    parent: subsystem
      ? {
          fieldName: 'subsystem_id',
          label: 'Subsystem',
          id: subsystem.id,
          name: subsystem.name,
        }
      : undefined,
    enabled: isAddOpen,
  });

  const moduleEditFormFields = useMemo(
    () => [
      {
        name: 'name',
        label: `${entityLabel('module')} Name`,
        type: 'select' as const,
        required: true,
        options: nameOptions,
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
        placeholder: `Enter Part Number of ${entityLabel('module')}`,
      },
      {
        name: 'id',
        label: 'Status',
        type: 'select' as const,
        required: true,
        options: statusOptions,
      },
    ],
    [nameOptions, statusOptions]
  );

  async function handleAddModule(formData: Record<string, any>) {
    if (!subsystem) {
      toast.error(`${entityLabel('subsystem')} not found`);
      return;
    }
    setIsSubmitting(true);
    setIsAddOpen(false);
    try {
      const created = await runSilentEntityBatch(async () => {
        const createEntityByType = buildCreateEntityByType({
          createSystem,
          createSubsystem,
          createModule,
          createUnit,
          createComponent,
        }, { silent: true });

        return createHierarchyEntityFromForm({
          entityType: 'module',
          parentId: subsystem.id,
          formData,
          inventoryItems,
          createEntity: (data) => createEntityByType('module', data),
          createEntityByType,
        });
      });
      toast.success(
        created.childrenInstalled > 0
          ? `Module added and ${created.childrenInstalled} child entit${created.childrenInstalled === 1 ? 'y' : 'ies'} installed from inventory`
          : `${entityLabel('module')} added successfully`
      );
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
      toast.success(`${entityLabel('module')} updated successfully`);
    } catch (error) {
      console.error('Module update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update module';
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
          api.statuses.list('modules'),
          subsystem
            ? listTemplateNames({
                level: 'module',
                parentName: subsystem.name,
                configId,
              })
            : Promise.resolve([]),
        ]);
        setStatuses(statusRes.data);
        setModuleHierarchyNames(childNames as Models.Hierarchy[]);
      } catch (err) {
        console.error('Failed to fetch statuses or hierarchy names', err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [subsystem, projectId, projects]);

  if (pageLoading) return <PageLoader />;

  if (!subsystem) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">{`${entityLabel('subsystem')} Not Found`}</h2>
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
                <StatusBadge status={resolveStatusName(subsystem, statuses)} />
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
        projectId={projectId ?? undefined}
        allowReplace
        hierarchyHref={systemHierarchyPath(projectId, system?.id, {
          rootType: 'subsystem',
          rootId: subsystem.id,
        })}
      />

      {/* Modules Cards */}
      <EntityCards
        title="Modules"
        description={`Manage modules for ${subsystem.name}`}
        entities={subsystemModules}
        onAdd={() => setIsAddOpen(true)}
        onEdit={openEditModule}
        onReplace={(entity) => {
          setReplaceTarget({
            entityType: 'module',
            entityId: entity.id,
            entityName: entity.name,
            partNumber: entity.part_number,
            serialNumber: entity.serial_number,
            replacementSequence: entity.replacement_sequence,
          });
          setReplaceOpen(true);
        }}
        onDelete={handleDeleteModule}
        detailPath={(id) => `/modules/${id}`}
        secondaryPath={
          projectId && system
            ? (id) =>
                systemHierarchyPath(projectId, system.id, {
                  rootType: 'module',
                  rootId: id,
                }) ?? '#'
            : undefined
        }
        addButtonLabel={`Add ${entityLabel('module')}`}
        emptyMessage={`No ${entityLabel('module', true).toLowerCase()} yet. Click Add ${entityLabel('module')} to create one.`}
        childEntityType="module"
        createPermission={P.create_modules}
        editPermission={P.edit_modules}
        deletePermission={P.delete_modules}
        readOnly={hierarchyReadOnly}
        projectId={projectId}
      />

      {/* {`Add ${entityLabel('module')}`} Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{`Add ${entityLabel('module')}`}</DialogTitle>
            <DialogDescription>Create a new module for {subsystem.name}</DialogDescription>
          </DialogHeader>
          <EntityForm
            key={`add-module-${subsystem.id}`}
            fields={moduleCreateFormFields}
            initialValues={moduleCreateInitialValues}
            onFieldChange={handleModuleCreateFieldChange}
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
              fields={moduleEditFormFields}
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
