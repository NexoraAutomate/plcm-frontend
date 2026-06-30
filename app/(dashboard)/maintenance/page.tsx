'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EntityLookupNode, FaultType, FaultyEntityStatus } from '@/lib/models';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import * as maintenanceApi from '@/lib/api';
import * as MaintenanceTypes from '@/lib/models';
import { maintenanceService } from '@/services/maintenance';
import { MaintenanceMiniDashboard } from '@/components/maintenance/MaintenanceMiniDashboard';
import { MaintenanceLookupDialog } from '@/components/maintenance/MaintenanceLookupDialog';
import { MaintenanceCaseDialog } from '@/components/maintenance/MaintenanceCaseDialog';
import { MaintenanceTable } from '@/components/maintenance/MaintenanceTable';
import { loadAllPartNumbers } from '@/lib/part-numbers';

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {maintenanceCases,projects,loading,createMaintenanceCase,updateMaintenanceCase,deleteMaintenanceCase,lookupEntityByPartNumber,suspectChildren,confirmFault} = useDataStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<MaintenanceTypes.MaintenanceCase | null>(null);
  const [partNumber, setPartNumber] = useState('');
  const [partNumbers, setPartNumbers] = useState<string[]>([]);
  const [lookupResponses, setLookupResponse] = useState<MaintenanceTypes.lookUpResponse | null>(null);
  const [lookupCaseId, setLookupCaseId] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [faultyEntities, setFaultyEntities] = useState<MaintenanceTypes.FaultyEntity[]>([]);
  const [maintenanceActions, setMaintenanceActions] = useState<MaintenanceTypes.MaintenanceAction[]>([]);
  const [maintenanceDeliveries, setMaintenanceDeliveries] = useState<MaintenanceTypes.MaintenanceDelivery[]>([]);
  // const [statuses, setStatuses] = useState<Models.Status[]>([]);


  // Load maintenance cases on mount
  useEffect(() => {
    loadMaintenanceCases();
    loadPartNumber();
  }, []);

  useEffect(() => {
    if (!isLookupOpen) return;
    loadPartNumber();
  }, [isLookupOpen]);

  const loadMaintenanceCases = async () => {
    try {
      setIsLoadingData(true);
      const res = await maintenanceApi.maintenanceCases.list(0, 100);
      // console.log('Loaded maintenance cases:', res.data);
      // Note: This data would typically be managed by the data store
      // For now, we're managing it locally in the component
    } catch (err) {
      console.error('Failed to load maintenance cases:', err);
      toast.error('Failed to load maintenance cases');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadPartNumber = async () => {
    try {
      const allPartNumbers = await loadAllPartNumbers();
      setPartNumbers(allPartNumbers);
    } catch (err) {
      console.error('Failed to load PartNumbers:', err);
      toast.error('Failed to load PartNumbers');
    }
  };


  const filtered = maintenanceCases.filter((c) => {
    const matchesSearch =
      c.case_number.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    
      // console.log('filtered Case description:', c.description);
      // console.log('filtered Case description:', c.case_number);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      // console.log('filtered Case matchesStatus', matchesStatus);
      const matchesProject = projectFilter === 'all' || c.project_id.toString() === projectFilter;
      // console.log('filtered Case matchesProject:',matchesProject);
    return matchesSearch && matchesStatus && matchesProject;
  });

  const handleCreate = async (data: MaintenanceTypes.CreateMaintenanceCasePayload) => {
    try {
      // console.log('Creating case with data:', data);
      await createMaintenanceCase(data);
      await loadMaintenanceCases();
    } catch (err) {
      // Error handled by data store
    }
  };

  const handleUpdate = async (data: MaintenanceTypes.UpdateMaintenanceCasePayload) => {
    if (!editingCase) return;
    try {
      await updateMaintenanceCase(editingCase.id, data);
      setEditingCase(null);
      await loadMaintenanceCases();
    } catch (err) {
      // Error handled by data store
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

  const handleLookup = async (partNumberValue: string) => {
    setLookupError(null);
    setLookupLoading(true);
    setLookupResponse(null);
    setLookupCaseId(null);

    try {
      const response = await lookupEntityByPartNumber(partNumberValue);
      // console.log('Lookup response:', response);
      setLookupResponse(response);
      // console.log('Lookup response:', lookupResponses);
      // console.log(JSON.stringify(lookupResponses?.descendants, null, 2));
    } catch (err) {
      console.error('Lookup failed:', err);
      setLookupError('No entity found for that part number.');
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
      part_number:lookupResponses.matched_entity_PartNumber
    };
    // console.log('Creating case with payload:', payload)
    try {
      const created = await createMaintenanceCase(payload);
      setLookupCaseId(created.id);
      // console.log(lookupCaseId);
      await loadMaintenanceCases();
      toast.success(`Created maintenance case #${created.id}`);
    } catch (err) {
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
      console.log('Lookup Response Children', lookupResponses.descendants)
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
      await deleteMaintenanceCase(caseItem.id);
      await loadMaintenanceCases();
    } catch (err) {
      // Error handled by data store
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
      console.log("Faulty entities for case", caseId, res.data)
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

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
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
            Lookup by Part Number
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add New Case
          </Button>
        </div>
      </div>

      {/* Mini Dashboard */}
      <MaintenanceMiniDashboard
        cases={maintenanceCases}
        onStatusFilter={handleStatusFilter}
      />

      {/* Filter Bar */}
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
            onClick={loadMaintenanceCases}
            disabled={isLoadingData}
            className="w-full"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <MaintenanceTable
        cases={filtered}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
        isLoading={isLoadingData}
        getFaultyEntities={getFaultyEntities}
        getMaintenanceActions={getMaintenanceActions}
        getMaintenanceDeliveries={getMaintenanceDeliveries}
      />

      {/* Lookup Dialog */}
      <MaintenanceLookupDialog
        isOpen={isLookupOpen}
        onOpenChange={(open) => {
          setIsLookupOpen(open);
          if (!open) {
            setLookupResponse(null);
            setLookupError(null);
            setLookupCaseId(null);
            setPartNumber('');
          }
        }}
        partNumber={partNumber}
        setPartNumber={setPartNumber}
        partNumbers={partNumbers}
        onLookup={handleLookup}
        onCreateCase={handleCreateCaseFromLookup}
        lookupResponse={lookupResponses}
        caseId={lookupCaseId}
        lookupLoading={lookupLoading}
        lookupError={lookupError}
        onSuspectChildren={handleSuspectChildren}
        onConfirmFault={handleConfirmFault}
      />

      {/* Create/Edit Dialog */}
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
        isLoading={isLoadingData}
      />
    </div>
  );
}
