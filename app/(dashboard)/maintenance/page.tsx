'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as maintenanceApi from '@/lib/api';
import * as MaintenanceTypes from '@/lib/models';
import { maintenanceService, formatMaintenanceApiError } from '@/services/maintenance';
import { MaintenanceMiniDashboard } from '@/components/maintenance/MaintenanceMiniDashboard';
import { MaintenanceCaseDialog } from '@/components/maintenance/MaintenanceCaseDialog';
import { MaintenanceCaseHierarchyDialog } from '@/components/maintenance/MaintenanceCaseHierarchyDialog';
import { MaintenanceTable } from '@/components/maintenance/MaintenanceTable';
import { fetchMaintenanceCasesPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useMaintenanceCaseStatusCounts } from '@/hooks/use-maintenance-case-status-counts';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { ListContentSuspense } from '@/components/list-content-suspense';
import type { ListFilterParams } from '@/lib/list-filters';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { normalizeEntityType } from '@/lib/entity-lookup-flow';

async function fetchEntitySerialNumber(
  entityType: string,
  entityId: number
): Promise<string | null> {
  const type = normalizeEntityType(entityType);
  try {
    let entity:
      | {
          serial_number?: string | null;
          original_serial_number?: string | null;
        }
      | null = null;

    switch (type) {
      case 'system':
        entity = (await maintenanceApi.systems.get(entityId)).data;
        break;
      case 'subsystem':
        entity = (await maintenanceApi.subsystems.get(entityId)).data;
        break;
      case 'module':
        entity = (await maintenanceApi.modules.get(entityId)).data;
        break;
      case 'unit':
        entity = (await maintenanceApi.units.get(entityId)).data;
        break;
      case 'component':
        entity = (await maintenanceApi.components.get(entityId)).data;
        break;
      default:
        return null;
    }

    return (
      entity?.serial_number?.trim() ||
      entity?.original_serial_number?.trim() ||
      null
    );
  } catch {
    return null;
  }
}

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canEditCase = can(P.edit_maintenance_cases);
  const canDeleteCase = can(P.delete_maintenance_cases);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const {
    projects,
    updateMaintenanceCase,
    deleteMaintenanceCase,
    lookupEntityBySerialNumber,
  } = useDataStore();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isHierarchyOpen, setIsHierarchyOpen] = useState(false);
  const [hierarchyCase, setHierarchyCase] =
    useState<MaintenanceTypes.MaintenanceCase | null>(null);
  const [hierarchySerial, setHierarchySerial] = useState<string | null>(null);
  const [hierarchyResponse, setHierarchyResponse] =
    useState<MaintenanceTypes.lookUpResponse | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<MaintenanceTypes.MaintenanceCase | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [faultyEntities, setFaultyEntities] = useState<MaintenanceTypes.FaultyEntity[]>([]);
  const [maintenanceActions, setMaintenanceActions] = useState<MaintenanceTypes.MaintenanceAction[]>([]);
  const [maintenanceDeliveries, setMaintenanceDeliveries] = useState<MaintenanceTypes.MaintenanceDelivery[]>([]);

  const listFilters = useMemo((): ListFilterParams | undefined => {
    const filters: ListFilterParams = { ...listFilterPatch };
    if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (projectFilter !== 'all') filters.project_id = Number(projectFilter);
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [debouncedSearch, statusFilter, projectFilter, listFilterPatch]);

  const pagination = usePaginatedList({
    queryKey: queryKeys.maintenanceCasesPage(listFilters),
    fetchPage: fetchMaintenanceCasesPage,
    filters: listFilters,
  });
  const paginatedCases = pagination.items;
  const { data: statusCounts, refetch: refetchStatusCounts } = useMaintenanceCaseStatusCounts();

  const showLoader = useListPageLoader(pagination, {
    debouncedSearch,
    filtersActive: statusFilter !== 'all' || projectFilter !== 'all',
    hasData: paginatedCases.length > 0,
  });

  const invalidateCaseQueries = () => {
    pagination.invalidate();
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceCaseStatusCounts() });
    void refetchStatusCounts();
  };

  const handleRefresh = async () => {
    setIsMutating(true);
    try {
      await pagination.refetch();
      await refetchStatusCounts();
    } finally {
      setIsMutating(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('lookup') === 'true') {
      router.replace('/maintenance/lookup');
    }
  }, [searchParams, router]);

  const filtered = paginatedCases;

  const handleUpdate = async (data: MaintenanceTypes.UpdateMaintenanceCasePayload) => {
    if (!editingCase) return;
    try {
      setIsMutating(true);
      await updateMaintenanceCase(editingCase.id, data);
      setEditingCase(null);
      invalidateCaseQueries();
    } catch {
      // Error handled by data store
    } finally {
      setIsMutating(false);
    }
  };

  const handleSubmit = async (
    data: MaintenanceTypes.CreateMaintenanceCasePayload | MaintenanceTypes.UpdateMaintenanceCasePayload
  ) => {
    await handleUpdate(data as MaintenanceTypes.UpdateMaintenanceCasePayload);
  };

  const handleDelete = async (caseItem: MaintenanceTypes.MaintenanceCase) => {
    if (caseItem.status !== 'open') {
      toast.error('Can only delete cases with status "Open"');
      return;
    }
    try {
      setIsMutating(true);
      await deleteMaintenanceCase(caseItem.id);
      invalidateCaseQueries();
    } catch {
      // Error handled by data store
    } finally {
      setIsMutating(false);
    }
  };

  const handleEdit = (caseItem: MaintenanceTypes.MaintenanceCase) => {
    setEditingCase(caseItem);
    setIsEditOpen(true);
  };

  const handleView = (caseItem: MaintenanceTypes.MaintenanceCase) => {
    router.push(`/maintenance/cases/${caseItem.id}`);
  };

  const resolveCaseSerialNumber = async (
    caseItem: MaintenanceTypes.MaintenanceCase
  ): Promise<string | null> => {
    const caseEntityType = normalizeEntityType(String(caseItem.entity_type));
    try {
      const res = await maintenanceApi.faultyEntities.listByCaseId(caseItem.id);
      const withSerial = (res.data || []).filter((entity) => entity.serial_number?.trim());
      const matched =
        withSerial.find(
          (entity) =>
            entity.entity_id === caseItem.entity_id &&
            normalizeEntityType(String(entity.entity_type)) === caseEntityType
        ) ||
        withSerial.find((entity) => !entity.parent_faulty_entity_id) ||
        withSerial[0];
      if (matched?.serial_number?.trim()) {
        return matched.serial_number.trim();
      }
    } catch {
      // Fall through to hierarchy entity lookup.
    }

    if (caseItem.entity_id) {
      return fetchEntitySerialNumber(String(caseItem.entity_type), caseItem.entity_id);
    }
    return null;
  };

  const handleViewHierarchy = async (caseItem: MaintenanceTypes.MaintenanceCase) => {
    setHierarchyCase(caseItem);
    setHierarchyResponse(null);
    setHierarchySerial(null);
    setHierarchyError(null);
    setHierarchyLoading(true);
    setIsHierarchyOpen(true);

    try {
      const serial = await resolveCaseSerialNumber(caseItem);
      if (!serial) {
        setHierarchyError(
          'No serial number found for this case’s matched entity. Hierarchy requires the serial used at lookup.'
        );
        return;
      }

      setHierarchySerial(serial);
      const response = await lookupEntityBySerialNumber(serial);
      setHierarchyResponse(response);
    } catch (err) {
      setHierarchyError(
        formatMaintenanceApiError(
          err,
          'Unable to load the hierarchy for this case’s serial number.'
        )
      );
    } finally {
      setHierarchyLoading(false);
    }
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
  };

  const getFaultyEntities = async (caseId: number) => {
    try {
      const res = await maintenanceApi.faultyEntities.listByCaseId(caseId);
      setFaultyEntities(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch faulty entities:', err);
      return [];
    }
  };

  const getMaintenanceActions = async (caseId: number, faultyEntityIds: number[]) => {
    try {
      const res = await maintenanceService.getCaseTimeline(caseId, faultyEntityIds);
      setMaintenanceActions(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch maintenance actions:', err);
      return [];
    }
  };

  const getMaintenanceDeliveries = async (caseId: number) => {
    try {
      const res = await maintenanceApi.maintenanceDeliveries.listByCaseId(caseId);
      setMaintenanceDeliveries(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch deliveries:', err);
      return [];
    }
  };

  if (showLoader) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Cases</h2>
        <p className="text-sm text-muted-foreground">
          Track maintenance cases, faulty entities, repairs, and deliveries.
        </p>
      </div>

      <MaintenanceMiniDashboard
        counts={statusCounts}
        onStatusFilter={handleStatusFilter}
        activeStatus={statusFilter}
      />

      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search case number or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="under_inspection">Under Investigation</SelectItem>
              <SelectItem value="under_repair">Repair In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project-filter">Project</Label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger id="project-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          onClick={() => void handleRefresh()}
          disabled={isMutating || pagination.fetching}
          className="w-full"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isMutating || pagination.fetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} on this page · {pagination.total} total in database
        </p>
        <ListContentSuspense loading={pagination.fetching || isMutating}>
        <MaintenanceTable
          cases={filtered}
          onEdit={canEditCase ? handleEdit : undefined}
          onDelete={canDeleteCase ? handleDelete : undefined}
          onView={handleView}
          onViewHierarchy={handleViewHierarchy}
          isLoading={false}
          getFaultyEntities={getFaultyEntities}
          getMaintenanceActions={getMaintenanceActions}
          getMaintenanceDeliveries={getMaintenanceDeliveries}
          sort={sort}
          onSort={cycleSort}
        />
        </ListContentSuspense>
        <EntityListPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
          onPrev={pagination.prevPage}
          onNext={pagination.nextPage}
          loading={pagination.fetching}
        />
      </div>

      <MaintenanceCaseDialog
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingCase(null);
        }}
        onSubmit={handleSubmit}
        editingCase={editingCase}
        projects={projects}
        isLoading={isMutating}
      />

      <MaintenanceCaseHierarchyDialog
        open={isHierarchyOpen}
        onOpenChange={(open) => {
          setIsHierarchyOpen(open);
          if (!open) {
            setHierarchyCase(null);
            setHierarchySerial(null);
            setHierarchyResponse(null);
            setHierarchyError(null);
            setHierarchyLoading(false);
          }
        }}
        caseNumber={hierarchyCase?.case_number}
        serialNumber={hierarchySerial}
        lookupResponse={hierarchyResponse}
        loading={hierarchyLoading}
        error={hierarchyError}
        caseId={hierarchyCase?.id}
      />
    </div>
  );
}
