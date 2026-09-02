'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Percent } from 'lucide-react';
import type { ProjectProgress } from '@/lib/models';
import { workflowStatusLabel } from '@/lib/workflow-status';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/status-badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function statusLabel(code?: string | null) {
  if (!code) return 'Not started';
  return workflowStatusLabel(code);
}

function reasonLabel(reason: string) {
  if (reason === 'fail_loop') return 'Fail / defect pending';
  if (reason === 'reserved') return 'Reserved';
  if (reason === 'not_started') return 'Not started';
  return statusLabel(reason.toUpperCase());
}

function ProgressRow({
  label,
  pct,
  weight,
  verified,
  status,
}: {
  label: string;
  pct: number;
  weight: number;
  verified: number;
  status?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground shrink-0">
          {pct}% · {verified}/{weight}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={pct} className="h-2 flex-1" />
        {status ? <StatusBadge status={status} /> : null}
      </div>
    </div>
  );
}

export function ProjectProgressPanel({
  data,
  loading,
  configurationLabel,
  details,
}: {
  data?: ProjectProgress;
  loading?: boolean;
  configurationLabel?: string | null;
  details?: ReactNode;
}) {
  const [systemsOpen, setSystemsOpen] = useState(false);

  const overallCard =
    loading && !data ? (
      <Card className="shadow-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Calculating project progress…
        </CardContent>
      </Card>
    ) : !data ? null : (
      <Card className="shadow-sm h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Percent className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Overall Progress</p>
                  <p className="text-2xl font-semibold tabular-nums">{data.progress_pct}%</p>
                </div>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Individual Systems&apos; Progress
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform',
                        systemsOpen && 'rotate-180'
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
              </div>
              <Progress value={data.progress_pct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {data.verified_leaves}/{data.weight} required items verified
              </p>
              <div className="flex items-center gap-2 text-sm">
                {data.can_complete ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>All required items are verified.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      {Math.max(data.weight - data.verified_leaves, 0)} required item
                      {data.weight - data.verified_leaves === 1 ? '' : 's'} still unverified.
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );

  return (
    <Collapsible open={systemsOpen} onOpenChange={setSystemsOpen} className="space-y-3">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        {details}
        {overallCard}
      </div>

      {data ? (
        <CollapsibleContent>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {configurationLabel || 'Configuration'} → Flight → System
              </CardTitle>
              <CardDescription>
                Weighted by required leaf count. Uneven trees do not split progress equally.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.flights.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Generate the hierarchy to see subtree progress.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {data.flights.map((flight) => (
                    <AccordionItem
                      key={`flight-${flight.entity_id}`}
                      value={`flight-${flight.entity_id}`}
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <span className="flex flex-1 items-center justify-between gap-3 pr-4 text-sm">
                          <span className="font-medium truncate">{flight.name}</span>
                          <span className="tabular-nums text-muted-foreground shrink-0">
                            {flight.progress_pct}% · {flight.verified_leaves}/{flight.weight}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <Progress value={flight.progress_pct} className="h-2" />
                        <div className="space-y-3 pl-2">
                          {flight.sdls
                            .flatMap((sdls) => sdls.systems)
                            .map((system) => (
                              <ProgressRow
                                key={`system-${system.entity_id}`}
                                label={system.name}
                                pct={system.progress_pct}
                                weight={system.weight}
                                verified={system.verified_leaves}
                                status={system.status}
                              />
                            ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export function ProjectBottlenecksPanel({
  data,
  loading,
}: {
  data?: ProjectProgress;
  loading?: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Loading bottlenecks…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Progress data is not available yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        Top blockers still keeping the project from 100%.
      </p>
      {data.bottlenecks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open blockers.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Leaves</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.bottlenecks.map((row) => (
              <TableRow key={`${row.entity_type}-${row.entity_id}-${row.reason}`}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{row.path}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status || reasonLabel(row.reason)} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.weight}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
