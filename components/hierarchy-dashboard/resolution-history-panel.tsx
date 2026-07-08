'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { ChevronDown, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { resolveEntityIds } from '@/lib/entity-resolver';
import { formatMaintenanceApiError } from '@/services/maintenance';
import {
  collectSubtreeEntities,
  type SubtreeEntityRef,
} from '@/lib/project-hierarchy-dashboard';
import {
  buildLifecycleTimelineEvents,
  buildSubtreeMatchContext,
  countReplacements,
  entityKeyForRecord,
  entityLabelForHistory,
  loadConfigurationHistoryForSubtree,
  makeEntityKey,
  type LifecycleTimelineEvent,
} from '@/lib/resolution-history-matching';
import type { ConfigurationHistory, Component, Module, Subsystem, System, Unit } from '@/lib/models';
import { ResolutionType } from '@/lib/models';
import { ResolutionHistoryTimelineDialog } from '@/components/hierarchy-dashboard/resolution-history-timeline-dialog';
import { useDataStore } from '@/lib/data-store';
import { formatUserRef } from '@/lib/user-display';

interface ResolutionHistoryPanelProps {
  systemId: number;
  projectId?: number;
  systems: System[];
  subsystems: Subsystem[];
  modules: Module[];
  units: Unit[];
  components: Component[];
}

function formatResolutionType(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ResolutionHistoryPanel({
  systemId,
  projectId,
  systems,
  subsystems,
  modules,
  units,
  components,
}: ResolutionHistoryPanelProps) {
  const { users } = useDataStore();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ConfigurationHistory[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subtreeByEntityId, setSubtreeByEntityId] = useState<Map<number, SubtreeEntityRef>>(
    new Map()
  );
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<LifecycleTimelineEvent[]>([]);
  const [timelineEntityFilter, setTimelineEntityFilter] = useState<string | undefined>();

  const matchContext = useMemo(
    () => buildSubtreeMatchContext(systemId, systems, subsystems, modules, units, components),
    [systemId, systems, subsystems, modules, units, components]
  );

  const subtree = useMemo(
    () => collectSubtreeEntities(systemId, systems, subsystems, modules, units, components),
    [systemId, systems, subsystems, modules, units, components]
  );

  const systemName = systems.find((system) => system.id === systemId)?.name ?? 'System';
  const replacementCount = useMemo(() => countReplacements(records), [records]);

  const labelForRecord = useCallback(
    (record: ConfigurationHistory) =>
      entityLabelForHistory(record, matchContext, subtreeByEntityId),
    [matchContext, subtreeByEntityId]
  );

  const resolvedProjectId =
    projectId ?? systems.find((system) => system.id === systemId)?.project_id;

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const entityIdByKey = await resolveEntityIds(subtree);

        const entityIdMap = new Map<number, SubtreeEntityRef>();
        const resolvedEntityIds = new Set<number>();

        for (const ref of subtree) {
          const entityId = entityIdByKey.get(makeEntityKey(ref.type, ref.pk));
          if (entityId == null) continue;
          entityIdMap.set(entityId, ref);
          resolvedEntityIds.add(entityId);
        }

        if (cancelled) return;
        setSubtreeByEntityId(entityIdMap);

        const filtered = await loadConfigurationHistoryForSubtree(
          matchContext,
          resolvedEntityIds,
          resolvedProjectId
        );

        if (!cancelled) {
          setRecords(filtered);
        }
      } catch (error) {
        if (!cancelled) {
          setRecords([]);
          if (axios.isAxiosError(error) && error.response?.status === 403) {
            setErrorMessage('You do not have permission to view configuration history.');
          } else {
            setErrorMessage(
              formatMaintenanceApiError(error, 'Unable to load configuration history.')
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [subtree, matchContext, resolvedProjectId]);

  const userLabelsById = useMemo(
    () => new Map(users.map((user) => [user.id, formatUserRef(user)])),
    [users]
  );

  const openTimeline = async (entityFilterLabel?: string) => {
    setTimelineEntityFilter(entityFilterLabel);
    setTimelineOpen(true);

    const entityFilterKey = entityFilterLabel
      ? records
          .map((record) => ({
            key: entityKeyForRecord(record, matchContext, subtreeByEntityId),
            label: entityLabelForHistory(record, matchContext, subtreeByEntityId),
          }))
          .find((entry) => entry.label === entityFilterLabel)?.key
      : undefined;

    setTimelineEvents(
      buildLifecycleTimelineEvents(records, matchContext, subtreeByEntityId, {
        installationRefs: subtree,
        entityFilterKey,
        userLabelsById,
      })
    );
    setTimelineLoading(false);
  };

  return (
    <>
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Resolution History</CardTitle>
              <CardDescription>
                Maintenance resolutions for {systemName} and its subtree
                {records.length > 0
                  ? ` · ${records.length} record${records.length === 1 ? '' : 's'}`
                  : ''}
                {replacementCount > 0
                  ? ` · ${replacementCount} replacement${replacementCount === 1 ? '' : 's'}`
                  : ''}
              </CardDescription>
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </CardHeader>

        {expanded ? (
          <CardContent className="space-y-4">
            {records.length > 0 ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void openTimeline();
                  }}
                >
                  <History className="mr-2 h-4 w-4" />
                  View lifecycle timeline
                </Button>
              </div>
            ) : null}

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading resolution history...</p>
            ) : errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resolution records found for this system.
                {subtree.length === 0
                  ? ' The selected system has no hardware entities in the current project data.'
                  : ' Resolved maintenance cases for this project will appear here after parts are repaired or replaced.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead>Old Part #</TableHead>
                      <TableHead>New Part #</TableHead>
                      <TableHead>Case</TableHead>
                      <TableHead className="w-[100px]">Timeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const entityLabel = labelForRecord(record);

                      return (
                        <TableRow key={record.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {new Date(record.change_date).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{entityLabel}</TableCell>
                          <TableCell className="text-sm capitalize">
                            {formatResolutionType(record.resolution_type)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.old_part_number || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.resolution_type === ResolutionType.REPLACED
                              ? record.new_part_number || '—'
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.maintenance_case_id ? (
                              <Link
                                href={`/maintenance/cases/${record.maintenance_case_id}`}
                                className="text-primary hover:underline"
                              >
                                Case #{record.maintenance_case_id}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => void openTimeline(entityLabel)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>

      <ResolutionHistoryTimelineDialog
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        systemName={systemName}
        entityFilter={timelineEntityFilter}
        events={timelineEvents}
        loading={timelineLoading}
      />
    </>
  );
}
