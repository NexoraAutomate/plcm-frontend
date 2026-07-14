'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { PageLoader } from '@/components/page-loader';
import { SystemHierarchyFlow } from '@/components/system-hierarchy-flow';
import {
  isHierarchyEntityType,
  type HierarchyEntityType,
} from '@/lib/system-hierarchy-graph';
import { resolveCurrentInstallEntity } from '@/lib/entity-replacement';

function entityLabel(type: HierarchyEntityType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function SystemHierarchyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const systemId = params.systemId as string;

  const rootTypeParam = searchParams.get('rootType');
  const rootIdParam = searchParams.get('rootId');
  const rootType: HierarchyEntityType = isHierarchyEntityType(rootTypeParam)
    ? rootTypeParam
    : 'system';
  const rootEntityId = rootIdParam ? Number(rootIdParam) : undefined;

  const { pageLoading } = useEntityHierarchyGate();
  const { projects, systems, subsystems, modules, units, components, statuses } =
    useDataStore();

  const project = projects.find((p) => String(p.id) === projectId);
  const system = systems.find(
    (s) => String(s.id) === systemId && s.project_id === project?.id
  );

  const resolvedRootId =
    rootType === 'system' || rootEntityId == null || Number.isNaN(rootEntityId)
      ? system?.id
      : rootEntityId;

  const rootEntityName = (() => {
    if (!system || resolvedRootId == null) return null;
    if (rootType === 'system') return system.name;
    if (rootType === 'subsystem') {
      return resolveCurrentInstallEntity(resolvedRootId, subsystems)?.name ?? null;
    }
    if (rootType === 'module') {
      return resolveCurrentInstallEntity(resolvedRootId, modules)?.name ?? null;
    }
    if (rootType === 'unit') {
      return resolveCurrentInstallEntity(resolvedRootId, units)?.name ?? null;
    }
    return resolveCurrentInstallEntity(resolvedRootId, components)?.name ?? null;
  })();

  if (pageLoading) {
    return <PageLoader />;
  }

  if (!project || !system) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold">System Not Found</h2>
        <Link
          href={`/projects/${projectId}`}
          className="mt-2 text-sm text-primary underline"
        >
          Back to Project
        </Link>
      </div>
    );
  }

  const isSubtreeRoot = rootType !== 'system' || resolvedRootId !== system.id;
  const backHref = isSubtreeRoot
    ? (() => {
        if (rootType === 'subsystem') return `/subsystems/${resolvedRootId}`;
        if (rootType === 'module') return `/modules/${resolvedRootId}`;
        if (rootType === 'unit') return `/units/${resolvedRootId}`;
        if (rootType === 'component') return `/components/${resolvedRootId}`;
        return `/systems/${system.id}`;
      })()
    : `/projects/${projectId}`;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {rootEntityName ?? system.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSubtreeRoot
              ? `${entityLabel(rootType)} hierarchy under ${system.name} · ${project.name}`
              : `System hierarchy for ${project.name}`}
          </p>
        </div>
      </div>

      <SystemHierarchyFlow
        system={system}
        subsystems={subsystems}
        modules={modules}
        units={units}
        components={components}
        project={project}
        statuses={statuses}
        rootType={rootType}
        rootEntityId={resolvedRootId}
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
