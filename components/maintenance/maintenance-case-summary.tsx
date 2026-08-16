'use client';

import { Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { KPICard } from '@/components/kpi-card';
import { MaintenanceCaseStatusBadge } from './badges';
import type { MaintenanceCase, MaintenanceAction, FaultyEntity } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';
import { FaultyEntityWorkflowStatus } from '@/lib/maintenance-workflow';

export interface EntityWorkflowCounts {
  total: number;
  identified: number;
  under_inspection: number;
  confirmed_faulty: number;
  under_repair: number;
  repaired: number;
  replaced: number;
  no_fault_found: number;
}

interface MaintenanceCaseSummaryProps {
  maintenanceCase: MaintenanceCase;
  entities?: FaultyEntity[];
  actions?: MaintenanceAction[];
  projectName?: string;
  counts: EntityWorkflowCounts;
}

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((100 * value) / total);
}

export function MaintenanceCaseSummary({
  maintenanceCase,
  entities = [],
  actions = [],
  projectName,
  counts,
}: MaintenanceCaseSummaryProps) {
  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{maintenanceCase.case_number}</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">{maintenanceCase.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MaintenanceCaseStatusBadge
              maintenanceCase={maintenanceCase}
              entities={entities}
              actions={actions}
              className="rounded-full px-3 py-1 text-xs"
            />
            <span className="text-sm text-muted-foreground">
              Reported {new Date(maintenanceCase.reported_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 rounded-lg border border-border p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Project</p>
            <p className="font-semibold">{projectName || maintenanceCase.project_name}</p>
          </div>
          <div className="space-y-1 rounded-lg border border-border p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Reported By</p>
            <p className="font-semibold">{formatUserRef(maintenanceCase.reported_by_user)}</p>
          </div>
        </div>
        <div className="flex justify-between">
          <div className="space-y-1 rounded-lg pl-2 w-fit">
            <p className="text-xs font-medium uppercase min-w-3/4 tracking-[0.2em] text-muted-foreground">
              Resolution Notes
            </p>
            <p className="text-sm text-muted-foreground wrap-break-word">
              {maintenanceCase.resolution_notes || 'No notes yet'}
            </p>
          </div>
          <div className="space-y-1 rounded-lg">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Resolved At</p>
            <p className="text-sm text-muted-foreground">
              {maintenanceCase.resolved_at
                ? new Date(maintenanceCase.resolved_at).toLocaleDateString()
                : 'Pending'}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <KPICard title="Total" value={counts.total} change={0} icon={Package} accentColor="blue" />
        <KPICard
          title="Identified"
          value={counts.identified}
          change={pct(counts.identified, counts.total)}
          icon={Package}
          accentColor="blue"
        />
        <KPICard
          title="Under Inspection"
          value={counts.under_inspection}
          change={pct(counts.under_inspection, counts.total)}
          icon={Package}
          accentColor="orange"
        />
        <KPICard
          title="Confirmed Faulty"
          value={counts.confirmed_faulty}
          change={pct(counts.confirmed_faulty, counts.total)}
          icon={Package}
          accentColor="red"
        />
        <KPICard
          title="Under Repair"
          value={counts.under_repair}
          change={pct(counts.under_repair, counts.total)}
          icon={Package}
          accentColor="purple"
        />
        <KPICard
          title="Repaired"
          value={counts.repaired}
          change={pct(counts.repaired, counts.total)}
          icon={Package}
          accentColor="green"
        />
        <KPICard
          title="Replaced"
          value={counts.replaced}
          change={pct(counts.replaced, counts.total)}
          icon={Package}
          accentColor="indigo"
        />
        <KPICard
          title="No Fault Found"
          value={counts.no_fault_found}
          change={pct(counts.no_fault_found, counts.total)}
          icon={Package}
          accentColor="slate"
        />
      </div>
    </div>
  );
}

export { FaultyEntityWorkflowStatus };
