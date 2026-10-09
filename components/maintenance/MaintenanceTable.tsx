'use client';

import React, { useMemo, useState } from 'react';
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
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import type { MaintenanceCase, FaultyEntity, MaintenanceAction, MaintenanceDelivery } from '@/lib/models';
import { FaultyEntityTable } from './FaultyEntityTable';
import { MaintenanceActionTable } from './MaintenanceActionTable';
import { MaintenanceDeliveryTable } from './MaintenanceDeliveryTable';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { ColumnVisibilityMenu } from '@/components/data-table/column-visibility-menu';
import { useColumnVisibility, type ColumnVisibilityDef } from '@/hooks/use-column-visibility';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EMPTY_SORT, sortRowsByState, type TableSortState } from '@/lib/sorting';

interface MaintenanceTableProps {
  cases: MaintenanceCase[];
  onEdit?: (caseItem: MaintenanceCase) => void;
  onDelete?: (caseItem: MaintenanceCase) => void;
  onView?: (caseItem: MaintenanceCase) => void;
  isLoading?: boolean;
  getFaultyEntities?: (caseId: number) => Promise<FaultyEntity[]>;
  getMaintenanceActions?: (caseId: number, faultyEntityIds: number[]) => Promise<MaintenanceAction[]>;
  getMaintenanceDeliveries?: (caseId: number) => Promise<MaintenanceDelivery[]>;
  sort?: TableSortState;
  onSort?: (column: string) => void;
}

interface ExpandedRow {
  id: number;
  faultyEntities: FaultyEntity[];
  maintenanceActions: MaintenanceAction[];
  maintenanceDeliveries: MaintenanceDelivery[];
  isLoading: boolean;
}

const COLUMN_DEFS: ColumnVisibilityDef[] = [
  { id: 'case_number', label: 'Case Number', alwaysVisible: true },
  { id: 'project_id', label: 'Project' },
  { id: 'description', label: 'Description' },
  { id: 'status', label: 'Status' },
  { id: 'reported_at', label: 'Reported At' },
];

export function MaintenanceTable({
  cases,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  getFaultyEntities,
  getMaintenanceActions,
  getMaintenanceDeliveries,
  sort = EMPTY_SORT,
  onSort,
}: MaintenanceTableProps) {
  const { visibleIds, isVisible, toggleColumn, resetColumns } = useColumnVisibility('maintenance-cases-list', COLUMN_DEFS);
  const internalSorting = useTableSorting();
  const parentControlsSort = onSort != null;
  const effectiveSort = parentControlsSort ? sort : internalSorting.sort;
  const effectiveOnSort = parentControlsSort ? onSort : internalSorting.cycleSort;
  const displayCases = useMemo(() => {
    if (parentControlsSort) return cases;
    return sortRowsByState(
      cases as unknown as Record<string, unknown>[],
      internalSorting.sort
    ) as unknown as MaintenanceCase[];
  }, [cases, internalSorting.sort, parentControlsSort]);

  const { can } = useAuth();
  const canEditCase = can(P.edit_maintenance_cases);
  const canDeleteCase = can(P.delete_maintenance_cases);
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
      <div className="mb-2 flex justify-end">
        <ColumnVisibilityMenu
          columns={COLUMN_DEFS}
          visibleIds={visibleIds}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>
      <div className="overflow-x-visible rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              {isVisible('case_number') && (
                <SortableTableHead column="case_number" sort={effectiveSort} onSort={effectiveOnSort}>
                  Case Number
                </SortableTableHead>
              )}
              {isVisible('project_id') && (
                <SortableTableHead column="project_id" sort={effectiveSort} onSort={effectiveOnSort}>
                  Project
                </SortableTableHead>
              )}
              {isVisible('description') && (
                <SortableTableHead column="description" sort={effectiveSort} onSort={effectiveOnSort}>
                  Description
                </SortableTableHead>
              )}
              {isVisible('status') && (
                <SortableTableHead column="status" sort={effectiveSort} onSort={effectiveOnSort}>
                  Status
                </SortableTableHead>
              )}
              {isVisible('reported_at') && (
                <SortableTableHead column="reported_at" sort={effectiveSort} onSort={effectiveOnSort}>
                  Reported At
                </SortableTableHead>
              )}
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayCases.map((caseItem) => {
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
                    {isVisible('case_number') && (
                      <TableCell className="text-sm font-medium">
                        {caseItem.case_number}
                      </TableCell>
                    )}
                    {isVisible('project_id') && (
                      <TableCell className="text-sm">
                        {caseItem.project_id}
                      </TableCell>
                    )}
                    {isVisible('description') && (
                      <TableCell className="text-sm max-w-xs truncate">
                        {caseItem.description}
                      </TableCell>
                    )}
                    {isVisible('status') && (
                      <TableCell>
                        <MaintenanceCaseStatusBadge apiStatus={caseItem.status} />
                      </TableCell>
                    )}
                    {isVisible('reported_at') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(caseItem.reported_at).toLocaleDateString()}
                      </TableCell>
                    )}
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
                        {onEdit && canEditCase && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(caseItem)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && canDeleteCase && caseItem.status === 'open' && (
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
                      <TableCell colSpan={visibleIds.length + 2} className="p-0">
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
