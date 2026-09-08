'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { EntityInstallMetadataCard } from '@/components/entity-install-metadata-card';
import { HierarchyEntityHeader } from '@/components/hierarchy-entity-header';
import {
  resolveCurrentInstallEntity,
  resolveProjectIdForHardwareEntity,
  resolveSystemIdForHardwareEntity,
  systemHierarchyPath,
} from '@/lib/entity-replacement';
import { useResolvedHardwareEntity } from '@/hooks/use-resolved-hardware-entity';
import { isProjectReadOnly } from '@/lib/workflow-status';
import { isExistingProject } from '@/lib/project-existing';

export default function ComponentDetailPage() {
  const { entityLabel } = useAppDefinitions();

  const params = useParams();
  const componentId = params.id as string;
  const { pageLoading } = useEntityHierarchyGate();
  const {
    components,
    units,
    modules,
    subsystems,
    systems,
    projects,
    updateComponent,
  } = useDataStore();
  
  const component = useResolvedHardwareEntity(componentId, 'component', components);
  const unit = component ? resolveCurrentInstallEntity(component.unit_id, units) : null;
  const module = unit ? resolveCurrentInstallEntity(unit.module_id, modules) : null;
  const projectId = component
    ? resolveProjectIdForHardwareEntity('component', component.id, {
        systems,
        subsystems,
        modules,
        units,
        components,
      })
    : null;
  const project = projects.find((p) => p.id === projectId);
  const hierarchyReadOnly = isProjectReadOnly(
    project?.status_name
  );
  const isExisting = isExistingProject(project);
  const systemId = component
    ? resolveSystemIdForHardwareEntity('component', component.id, {
        subsystems,
        modules,
        units,
        components,
      })
    : null;
  const hierarchyHref = component
    ? systemHierarchyPath(projectId, systemId, {
        rootType: 'component',
        rootId: component.id,
      })
    : undefined;

  if (pageLoading) {
    return <PageLoader />;
  }

  if (!component) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">{`${entityLabel('component')} Not Found`}</h2>
        <Link href="/components" className="mt-2 text-sm text-primary underline">
          Back to Components
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
            <BreadcrumbLink asChild>
              <Link href={`/units/${unit?.id}`}>{unit?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{component.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <HierarchyEntityHeader
        name={component.name}
        description={component.description}
        backHref={unit ? `/units/${unit.id}` : '/components'}
        projectName={project?.name}
        systemName={
          component && systemId != null
            ? systems.find((item) => item.id === systemId)?.name
            : undefined
        }
        sdlsNumber={
          component && systemId != null
            ? systems.find((item) => item.id === systemId)?.sdls_number
            : undefined
        }
      />

      <EntityInstallMetadataCard
        ownerType="component"
        entity={component}
        onUpdate={(data) => updateComponent(component.id, data)}
        projectId={projectId ?? undefined}
        parentId={unit?.id}
        isExistingProject={isExisting}
        allowReplace={!hierarchyReadOnly}
        hierarchyHref={hierarchyHref}
      />

      {/* Component Details */}
      <Card>
        <CardHeader>
          <CardTitle>Component Details</CardTitle>
          <CardDescription>Full information about this component</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-base font-medium mt-1">{component.name}</p>
              </div>
            </div>
            {component.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-base mt-1">{component.description}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Unit</p>
                <Link href={`/units/${unit?.id}`}>
                  <p className="text-base font-medium text-primary underline mt-1">{unit?.name}</p>
                </Link>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Module (Parent)</p>
                <Link href={`/modules/${module?.id}`}>
                  <p className="text-base font-medium text-primary underline mt-1">{module?.name}</p>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
