'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, FolderOpen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/lib/data-store';

type Props = {
  name: string;
  description?: string | null;
  backHref: string;
  projectId?: number | null;
  projectName?: string | null;
  systemName?: string | null;
  sdlsNumber?: number | null;
  /** Optional page-specific reload after hierarchy refresh. */
  onRefresh?: () => void | Promise<unknown>;
};

export function HierarchyEntityHeader({
  name,
  description,
  backHref,
  projectId,
  projectName,
  systemName,
  sdlsNumber,
  onRefresh,
}: Props) {
  const router = useRouter();
  const { ensureHierarchyLoaded } = useDataStore();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await ensureHierarchyLoaded({ force: true });
      await onRefresh?.();
      router.refresh();
      toast.success('Refreshed');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <Link href={backHref}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label={`Back from ${name}`}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Project: {projectName || '—'}
            {systemName ? ` · System: ${systemName}` : ''}
            {` · SDLS-${sdlsNumber ?? '—'}`}
          </p>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          aria-label="Refresh data"
          title="Refresh data"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        {projectId != null ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`/projects/${projectId}`}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Go to Project Page
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
