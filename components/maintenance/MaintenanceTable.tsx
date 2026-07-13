'use client';

import React, { useState } from 'react';
import { Edit, Trash2, ChevronDown, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaintenanceCaseStatusBadge } from '@/components/maintenance/badges';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { MaintenanceCase, FaultyEntity, MaintenanceAction, MaintenanceDelivery } from '@/lib/models';
import { FaultyEntityTable } from './FaultyEntityTable';
import { MaintenanceActionTable } from './MaintenanceActionTable';
import { MaintenanceDeliveryTable } from './MaintenanceDeliveryTable';

interface MaintenanceTableProps {
  cases: MaintenanceCase[];
  onEdit?: (caseItem: MaintenanceCase) => void;
  onDelete?: (caseItem: MaintenanceCase) => void;
  onView?: (caseItem: MaintenanceCase) => void;
  isLoading?: boolean;
  getFaultyEntities?: (caseId: number) => Promise<FaultyEntity[]>;
  getMaintenanceActions?: (caseId: number, faultyEntityIds: number[]) => Promise<MaintenanceAction[]>;
  getMaintenanceDeliveries?: (caseId: number) => Promise<MaintenanceDelivery[]>;
}

interface ExpandedRow {
  id: number;
  faultyEntities: FaultyEntity[];
  maintenanceActions: MaintenanceAction[];
  maintenanceDeliveries: MaintenanceDelivery[];
  isLoading: boolean;
}

export function MaintenanceTable({
  cases,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  getFaultyEntities,
  getMaintenanceActions,
  getMaintenanceDeliveries,
}: MaintenanceTableProps) {
  const [expandedRows, setExpandedRows] = useState<Map<number, ExpandedRow>>(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  const toggleExpand = async (id: number) => {
    const current = expandedRows.get(id);

    if (current) {
      setExpandedRows((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    setExpandedRows((prev) =>
      new Map(prev).set(id, {
        id,
        faultyEntities: [],
        maintenanceActions: [],
        maintenanceDeliveries: [],
        isLoading: true,
      })
    );

    const patchExpanded = (partial: Partial<ExpandedRow>) => {
      setExpandedRows((prev) => {
        const next = new Map(prev);
        const row = next.get(id);
        if (!row) return prev;
        next.set(id, { ...row, ...partial, isLoading: false });
        return next;
      });
    };

    try {
      // Load all tab data in parallel; show tabs as soon as the first response arrives.
      await Promise.all([
        (getFaultyEntities ? getFaultyEntities(id) : Promise.resolve([])).then((faultyEntities) => {
          patchExpanded({ faultyEntities });
          return faultyEntities;
        }),
        (getMaintenanceActions
          ? getMaintenanceActions(id, [])
          : Promise.resolve([])
        ).then((maintenanceActions) => {
          patchExpanded({ maintenanceActions });
          return maintenanceActions;
        }),
        (getMaintenanceDeliveries
          ? getMaintenanceDeliveries(id)
          : Promise.resolve([])
        ).then((maintenanceDeliveries) => {
          patchExpanded({ maintenanceDeliveries });
          return maintenanceDeliveries;
        }),
      ]);
    } catch (error) {
      console.error('Failed to fetch expanded data:', error);
      patchExpanded({
        faultyEntities: [],
        maintenanceActions: [],
        maintenanceDeliveries: [],
      });
    }
  };

  const handleDelete = (caseItem: MaintenanceCase) => {
    setDeleteConfirm({ open: true, id: caseItem.id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.id !== null) {
      const caseItem = cases.find((c) => c.id === deleteConfirm.id);
      if (caseItem && onDelete) {
        onDelete(caseItem);
      }
    }
    setDeleteConfirm({ open: false, id: null });
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading maintenance cases...
      </div>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No maintenance cases found.
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12"></TableHead>
              <TableHead>Case Number</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reported At</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((caseItem) => {
              const isExpanded = expandedRows.has(caseItem.id);
              const expanded = expandedRows.get(caseItem.id);

              return (
                <React.Fragment key={caseItem.id}>
                  <TableRow
                    className={cn(
                      'hover:bg-muted/50',
                      isExpanded && 'bg-muted/30'
                    )}
                  >
                    <TableCell className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleExpand(caseItem.id)}
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {caseItem.case_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {caseItem.project_id}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {caseItem.description}
                    </TableCell>
                    <TableCell>
                      <MaintenanceCaseStatusBadge apiStatus={caseItem.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(caseItem.reported_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(caseItem)}
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(caseItem)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && caseItem.status === 'open' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(caseItem)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && expanded && (
                    <TableRow className="bg-muted/30 border-b">
                      <TableCell colSpan={7} className="p-0">
                        <div className="px-6 py-4">
                          {expanded.isLoading ? (
                            <div className="text-sm text-muted-foreground">
                              Loading details...
                            </div>
                          ) : (
                            <Tabs defaultValue="faulty-entities" className="w-full">
                              <TabsList>
                                <TabsTrigger value="faulty-entities">
                                  Faulty Entities ({expanded.faultyEntities.length})
                                </TabsTrigger>
                                <TabsTrigger value="actions">
                                  Actions ({expanded.maintenanceActions.length})
                                </TabsTrigger>
                                <TabsTrigger value="deliveries">
                                  Deliveries ({expanded.maintenanceDeliveries.length})
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="faulty-entities" className="mt-4">
                                <FaultyEntityTable
                                  entities={expanded.faultyEntities}
                                />
                              </TabsContent>

                              <TabsContent value="actions" className="mt-4">
                                <MaintenanceActionTable
                                  actions={expanded.maintenanceActions}
                                  entities={expanded.faultyEntities}
                                />
                              </TabsContent>

                              <TabsContent value="deliveries" className="mt-4">
                                <MaintenanceDeliveryTable
                                  deliveries={expanded.maintenanceDeliveries}
                                />
                              </TabsContent>
                            </Tabs>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm({ ...deleteConfirm, open })
        }
        title="Delete Maintenance Case"
        description="Are you sure you want to delete this maintenance case? This action cannot be undone."
        // actionLabel="Delete"
        // variant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}
