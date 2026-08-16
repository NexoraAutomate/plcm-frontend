'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import * as api from '@/lib/api';
import type { ConfigChangeRequest } from '@/lib/models';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export default function ConfigChangesPage() {
  const [rows, setRows] = useState<ConfigChangeRequest[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await api.configChanges.list();
      setRows(res.data ?? []);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Failed to load configuration changes'));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleApprove(id: number) {
    setBusyId(id);
    try {
      await api.configChanges.approve(id);
      toast.success('Configuration change approved');
      await load();
    } catch (error: unknown) {
      toast.error(apiError(error, 'Approve failed'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration changes</h1>
        <p className="text-sm text-muted-foreground">
          Review Spec 12 change requests. Inventory must be returned before
          approval. After approve, create the successor project from the source
          project page.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" />
            Change requests
          </CardTitle>
          <CardDescription>
            Source project stays traceable; desired config is applied on a new
            Project/Flight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No configuration changes.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/projects/${row.source_project_id}`}
                      className="font-medium hover:underline"
                    >
                      {row.source_project_name || `Project #${row.source_project_id}`}
                    </Link>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Target:{' '}
                    {row.target_hierarchy_config_name ||
                      row.target_hierarchy_config_code ||
                      'not submitted'}
                    {row.reason_remarks ? ` — ${row.reason_remarks}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/projects/${row.source_project_id}`}>Open project</Link>
                  </Button>
                  <Can permission={P.config_change_approve}>
                    {row.status === 'SUBMITTED' ? (
                      <Button
                        size="sm"
                        disabled={busyId === row.id || !row.inventory_cleared}
                        onClick={() => void handleApprove(row.id)}
                      >
                        Approve
                      </Button>
                    ) : null}
                  </Can>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
