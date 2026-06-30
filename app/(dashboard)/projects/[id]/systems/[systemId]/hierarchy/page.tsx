'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/lib/data-store';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { SystemHierarchyFlow } from '@/components/system-hierarchy-flow';

export default function SystemHierarchyPage() {
  const params = useParams();
  const projectId = params.id as string;
  const systemId = params.systemId as string;

  const { pageLoading } = useEntityHierarchyGate();
  const { projects, systems, subsystems, modules, units, components, statuses } =
    useDataStore();

  const project = projects.find((p) => String(p.id) === projectId);
  const system = systems.find(
    (s) => String(s.id) === systemId && s.project_id === project?.id
  );

  if (pageLoading) {
    return <div className="p-8 text-center">Loading...</div>;
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

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{system.name}</h1>
          <p className="text-sm text-muted-foreground">
            System hierarchy for {project.name}
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
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
