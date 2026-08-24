'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';
import { StatusBadge } from '@/components/status-badge';
import { ConfigChangeWizard } from '@/components/projects/config-change-wizard';
import * as api from '@/lib/api';
import type { Project } from '@/lib/models';
import { CONTROL_RULE } from '@/lib/config-change';

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function ProjectConfigurationChangePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    try {
      const res = await api.projects.get(projectId);
      setProject(res.data);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Failed to load project'));
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!Number.isFinite(projectId)) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold">Invalid project</h2>
        <Link href="/projects" className="mt-2 text-sm text-primary underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  if (loading && !project) {
    return <PageLoader />;
  }

  if (!project) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold">Project not found</h2>
        <Link href="/projects" className="mt-2 text-sm text-primary underline">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
      <div className="flex flex-wrap items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Configuration change
            </h1>
            <StatusBadge status={project.status_name || 'Unknown'} />
          </div>
          <p className="text-sm text-muted-foreground">{project.name}</p>
          <p className="text-xs text-muted-foreground">{CONTROL_RULE}</p>
        </div>
      </div>

      <ConfigChangeWizard
        project={project}
        asPage
        onUpdated={(next) => {
          setProject(next);
        }}
      />
    </div>
  );
}
