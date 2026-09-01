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
import { isProjectReadOnly } from '@/lib/workflow-status';
import { EntityForm } from '@/components/entity-form';
import { HierarchyEntityInventoryDialog } from '@/components/hierarchy/hierarchy-entity-inventory-create-dialog';
import { isExistingProject } from '@/lib/project-existing';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import * as api from '@/lib/api';
import { listTemplateNames } from '@/lib/hierarchy-template-names';
import { fetchStatusesByType } from '@/lib/api';
import * as Models from '@/lib/models';
import { resolveStatusName } from '@/lib/entity-status';
import { EntityStatusHistorySheet } from '@/components/entity-status-history-sheet';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';
import {
  ReplaceFromInventoryDialog,
  type ReplaceFromInventoryTarget,
} from '@/components/replace-from-inventory-dialog';
import {
  filterChildrenForParentSlot,
  systemHierarchyPath,
} from '@/lib/entity-replacement';
import { useResolvedHardwareEntity } from '@/hooks/use-resolved-hardware-entity';
import { HierarchyEntityHeader } from '@/components/hierarchy-entity-header';

export default function SystemDetailPage() {
  const { entityLabel } = useAppDefinitions();

  const params = useParams();
  const systemId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    systems,
    projects,
    subsystems,
    deleteSubsystem,
    updateSubsystem,
    updateSystem,
    statuses: storeStatuses,
  } = useDataStore();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceFromInventoryTarget | null>(null);

  const system = useResolvedHardwareEntity(systemId, 'system', systems);
  const project = system ? projects.find((p) => p.id === system.project_id) : null;
  const hierarchyReadOnly = isProjectReadOnly(project?.status_name);
  const isExisting = isExistingProject(project);
  const systemSubsystems = system
    ? filterChildrenForParentSlot(subsystems, system, systems, (sub) => sub.system_id)
    : [];
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);
  const [subsystemHierarchyNames, setSubsystemHierarchyNames] = useState<Models.Hierarchy[]>([]);

  const nameOptions = useMemo(
    () =>
      subsystemHierarchyNames.map((hierarchy) => ({
        label: hierarchy.name,
        value: hierarchy.name,
      })),
    [subsystemHierarchyNames]
  );
  const statusOptions = useMemo(
    () => statuses.map((s) => ({ label: s.status_name, value: s.id })),
    [statuses]
  );
  const allowedNames = useMemo(
    () => subsystemHierarchyNames.map((hierarchy) => hierarchy.name),
    [subsystemHierarchyNames]
  );

  const subsystemEditFormFields = useMemo(
    () => [
      {
        name: 'name',
        label: `${entityLabel('subsystem')} Name`,
        type: 'select' as const,
        required: true,
        options: nameOptions,
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
        placeholder: `Enter Part Number of ${entityLabel('subsystem')}`,
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
      toast.success(`${entityLabel('subsystem')} updated successfully`);
    } catch (error) {
      console.error('Subsystem update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update subsystem';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusResult, childNames] = await Promise.all([
          fetchStatusesByType('subsystems'),
          system
            ? listTemplateNames({
                level: 'subsystem',
                parentName: system.name,
                configId: project?.hierarchy_config_id,
              })
            : Promise.resolve([]),
        ]);
        setStatuses(statusResult);
        setSubsystemHierarchyNames(childNames as Models.Hierarchy[]);
      } catch (err) {
        console.error('Failed to fetch statuses or hierarchy names', err);
      } finally {
        setLoadingStatuses(false);
      }
    };

    fetchData();
  }, [system, project?.hierarchy_config_id]);

  if (pageLoading) return <PageLoader />;

  if (!system) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">{`${entityLabel('system')} Not Found`}</h2>
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

      <HierarchyEntityHeader
        name={system.name}
        description={system.description}
        backHref={project ? `/projects/${project.id}` : '/systems'}
        projectName={project?.name}
        sdlsNumber={system.sdls_number}
      />

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
        emptyMessage={`No ${entityLabel('subsystem', true).toLowerCase()} yet.`}
        childEntityType="subsystem"
        createPermission={P.create_subsystems}
        editPermission={P.edit_subsystems}
        deletePermission={P.delete_subsystems}
        readOnly={hierarchyReadOnly}
        projectId={project?.id}
      />

      {isExisting ? (
        editingSubsystem ? (
          <HierarchyEntityInventoryDialog
            open={isEditOpen}
            onOpenChange={(open) => {
              setIsEditOpen(open);
              if (!open) setEditingId(null);
            }}
            entityType="subsystem"
            entityId={editingSubsystem.id}
            entity={editingSubsystem}
            parentId={system.id}
            title={`Edit ${entityLabel('subsystem')}`}
            description={`Register details for ${editingSubsystem.name}`}
          />
        ) : null
      ) : (
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subsystem</DialogTitle>
            <DialogDescription>Update subsystem details</DialogDescription>
          </DialogHeader>
          {editingSubsystem ? (
            <EntityForm
              key={editingSubsystem.id}
              fields={subsystemEditFormFields}
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
      )}

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
