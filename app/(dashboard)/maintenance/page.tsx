'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FaultType, FaultyEntityStatus } from '@/lib/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import * as maintenanceApi from '@/lib/api';
import * as MaintenanceTypes from '@/lib/models';
import { maintenanceService } from '@/services/maintenance';
import { MaintenanceMiniDashboard } from '@/components/maintenance/MaintenanceMiniDashboard';
import { MaintenanceLookupDialog } from '@/components/maintenance/MaintenanceLookupDialog';
import { MaintenanceCaseDialog } from '@/components/maintenance/MaintenanceCaseDialog';
import { MaintenanceTable } from '@/components/maintenance/MaintenanceTable';
import { fetchMaintenanceCasesPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useListPageLoader } from '@/hooks/use-list-page-loader';
import { useMaintenanceCaseStatusCounts } from '@/hooks/use-maintenance-case-status-counts';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import type { ListFilterParams } from '@/lib/list-filters';

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {
    projects,
    createMaintenanceCase,
    updateMaintenanceCase,
    deleteMaintenanceCase,
    lookupEntityBySerialNumber,
    suspectChildren,
    confirmFault,
  } = useDataStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<MaintenanceTypes.MaintenanceCase | null>(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [lookupResponses, setLookupResponse] = useState<MaintenanceTypes.lookUpResponse | null>(null);
  const [lookupCaseId, setLookupCaseId] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [faultyEntities, setFaultyEntities] = useState<MaintenanceTypes.FaultyEntity[]>([]);
  const [maintenanceActions, setMaintenanceActions] = useState<MaintenanceTypes.MaintenanceAction[]>([]);
  const [maintenanceDeliveries, setMaintenanceDeliveries] = useState<MaintenanceTypes.MaintenanceDelivery[]>([]);

  const listFilters = useMemo((): ListFilterParams | undefined => {
    const filters: ListFilterParams = {};
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (projectFilter !== 'all') filters.project_id = Number(projectFilter);
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [statusFilter, projectFilter]);

  const pagination = usePaginatedList({
    queryKey: queryKeys.maintenanceCasesPage(listFilters),
    fetchPage: fetchMaintenanceCasesPage,
    filters: listFilters,
  });
  const paginatedCases = pagination.items;
  const { data: statusCounts, refetch: refetchStatusCounts } = useMaintenanceCaseStatusCounts();

  const showLoader = useListPageLoader(pagination, {
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
      setIsLookupOpen(true);
      router.replace('/maintenance', { scroll: false });
    }
  }, [searchParams, router]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return paginatedCases;
    return paginatedCases.filter(
      (c) =>
        c.case_number.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
    );
  }, [paginatedCases, search]);

  const handleCreate = async (data: MaintenanceTypes.CreateMaintenanceCasePayload) => {
    try {
      setIsMutating(true);
      await createMaintenanceCase(data);
      invalidateCaseQueries();
    } catch {
      // Error handled by data store
    } finally {
      setIsMutating(false);
    }
  };

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
    if (editingCase) {
      await handleUpdate(data as MaintenanceTypes.UpdateMaintenanceCasePayload);
    } else {
      await handleCreate(data as MaintenanceTypes.CreateMaintenanceCasePayload);
    }
  };

  const handleLookup = async (serialNumberValue: string) => {
    setLookupError(null);
    setLookupLoading(true);
    setLookupResponse(null);
    setLookupCaseId(null);

    try {
      const response = await lookupEntityBySerialNumber(serialNumberValue);
      setLookupResponse(response);
    } catch (err) {
      console.error('Lookup failed:', err);
      setLookupError('No entity found for that serial number.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateCaseFromLookup = async () => {
    if (!lookupResponses) {
      toast.error('No lookup result available to create a case.');
      return;
    }

    const payload: MaintenanceTypes.CreateMaintenanceCasePayload = {
      project_id: lookupResponses.project_id,
      description: `Maintenance case for ${lookupResponses.matched_label}`,
      status: MaintenanceTypes.CaseStatus.Open,
      entity_id: lookupResponses.matched_entity_id,
      entity_type: lookupResponses.matched_entity_type.toLowerCase(),
      part_number: lookupResponses.matched_entity_PartNumber,
    };
    try {
      const created = await createMaintenanceCase(payload);
      invalidateCaseQueries();
      setLookupCaseId(created.id);
      toast.success(`Created maintenance case #${created.id}`);
    } catch {
      // Error handled by data store
    }
  };

  const handleSuspectChildren = async () => {
    if (!lookupResponses || !lookupCaseId) return;

    try {
      await suspectChildren(lookupCaseId, {
        entity_type: lookupResponses.matched_entity_type.toLowerCase(),
        entity_id: lookupResponses.matched_entity_id,
        fault_type: FaultType.UNCLASSIFIED,
        entity_status: FaultyEntityStatus.SUSPECTED,
        fault_description: `Suspected issue on ${lookupResponses.matched_label}`,
        entity_name: lookupResponses.matched_label,
        serial_number: lookupResponses.matched_entity_serialNumber,
        part_number: lookupResponses.matched_entity_PartNumber,
        children: lookupResponses.descendants,
      });
      toast.success('Children suspicion workflow started.');
    } catch (err) {
      console.error('Suspect children failed:', err);
    }
  };

  const handleConfirmFault = async (node: MaintenanceTypes.EntityLookupNode) => {
    if (!lookupResponses || !lookupCaseId) return;

    try {
      await confirmFault(lookupCaseId, {
        confirmed_entity_type: node.entity_type.toLowerCase(),
        confirmed_entity_id: node.entity_id,
        fault_type: 'confirmed',
        fault_description: `Fault confirmed for ${node.label}`,
        parent_faulty_entity_id: lookupResponses.matched_entity_id,
      });
      toast.success(`Confirmed fault for ${node.label}`);
    } catch (err) {
      console.error('Confirm fault failed:', err);
    }
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
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Maintenance Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Track maintenance cases, faulty entities, repairs, and deliveries
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsLookupOpen(true)} variant="secondary" className="gap-2">
            <Search className="h-4 w-4" />
            Lookup by Serial Number
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Case
          </Button>
        </div>
      </div>

      <MaintenanceMiniDashboard
        counts={statusCounts}
        onStatusFilter={handleStatusFilter}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
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

        <div className="space-y-2">
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

        <div className="space-y-2">
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

        <div className="space-y-2 flex items-end">
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
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} on this page · {pagination.total} total in database
        </p>
        <MaintenanceTable
          cases={filtered}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
          isLoading={isMutating || pagination.loading}
          getFaultyEntities={getFaultyEntities}
          getMaintenanceActions={getMaintenanceActions}
          getMaintenanceDeliveries={getMaintenanceDeliveries}
        />
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

      <MaintenanceLookupDialog
        isOpen={isLookupOpen}
        onOpenChange={(open) => {
          setIsLookupOpen(open);
          if (!open) {
            setLookupResponse(null);
            setLookupError(null);
            setLookupCaseId(null);
            setSerialNumber('');
          }
        }}
        serialNumber={serialNumber}
        setSerialNumber={setSerialNumber}
        onLookup={handleLookup}
        onCreateCase={handleCreateCaseFromLookup}
        lookupResponse={lookupResponses}
        caseId={lookupCaseId}
        lookupLoading={lookupLoading}
        lookupError={lookupError}
        onSuspectChildren={handleSuspectChildren}
        onConfirmFault={handleConfirmFault}
      />

      <MaintenanceCaseDialog
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setEditingCase(null);
        }}
        onSubmit={handleSubmit}
        editingCase={editingCase}
        projects={projects}
        isLoading={isMutating}
      />
    </div>
  );
}
