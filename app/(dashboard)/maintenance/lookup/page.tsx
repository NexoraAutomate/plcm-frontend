'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDataStore } from '@/lib/data-store';
import { FaultType, FaultyEntityStatus } from '@/lib/models';
import * as maintenanceApi from '@/lib/api';
import * as MaintenanceTypes from '@/lib/models';
import { formatMaintenanceApiError } from '@/services/maintenance';
import { MaintenanceLookupPanel } from '@/components/maintenance/maintenance-lookup-panel';
import { queryKeys } from '@/hooks/queries/query-keys';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';

export default function MaintenanceLookupPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canSuspectChildren = can(P.suspect_children);
  const {
    createMaintenanceCase,
    lookupEntityBySerialNumber,
    suspectChildren,
    confirmFault,
  } = useDataStore();

  const [serialNumber, setSerialNumber] = useState('');
  const [lookupResponses, setLookupResponse] =
    useState<MaintenanceTypes.lookUpResponse | null>(null);
  const [lookupCaseId, setLookupCaseId] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const invalidateCaseQueries = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceCasesPage() });
    void queryClient.invalidateQueries({ queryKey: ['maintenanceCases'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceCaseStatusCounts() });
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
      setLookupError(
        formatMaintenanceApiError(
          err,
          `No entity found with serial number '${serialNumberValue}'.`
        )
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const autoSuspectChildren = async (
    caseId: number,
    lookup: MaintenanceTypes.lookUpResponse
  ) => {
    if (!canSuspectChildren) return;
    await suspectChildren(caseId, {
      entity_type: lookup.matched_entity_type.toLowerCase(),
      entity_id: lookup.matched_entity_id,
      fault_type: FaultType.UNCLASSIFIED,
      entity_status: FaultyEntityStatus.SUSPECTED,
      fault_description: `Suspected issue on ${lookup.matched_label}`,
      entity_name: lookup.matched_label,
      serial_number: lookup.matched_entity_serialNumber,
      part_number: lookup.matched_entity_PartNumber,
      children: lookup.descendants,
    });
  };

  const handleCreateCaseFromLookup = async () => {
    if (!lookupResponses) {
      toast.error('No lookup result available to create a case.');
      return;
    }
    if (!lookupResponses.project_id) {
      toast.error('Lookup result has no project — cannot open a case.');
      return;
    }

    let supportOverride: string | undefined;
    try {
      const { data: support } =
        await maintenanceApi.maintenanceCases.getProductionSupport(
          lookupResponses.project_id
        );
      if (support.requires_override) {
        const reason = window.prompt(
          `Production support ended${
            support.production_support_date ? ` on ${support.production_support_date}` : ''
          }. Enter an override reason to open the case anyway:`
        );
        if (!reason?.trim()) {
          setLookupError('Override reason is required when production support has ended.');
          return;
        }
        supportOverride = reason.trim();
      }
    } catch {
      // If preview fails, allow create and let the API enforce the gate.
    }

    const payload: MaintenanceTypes.CreateMaintenanceCasePayload = {
      project_id: lookupResponses.project_id,
      description: `Maintenance case for ${lookupResponses.matched_label}`,
      status: MaintenanceTypes.CaseStatus.Open,
      entity_id: lookupResponses.matched_entity_id,
      entity_type: lookupResponses.matched_entity_type.toLowerCase(),
      part_number: lookupResponses.matched_entity_PartNumber,
      support_override_reason: supportOverride,
    };

    setCreateCaseLoading(true);
    try {
      const created = await createMaintenanceCase(payload);
      invalidateCaseQueries();
      setLookupCaseId(created.id);
      setLookupError(null);

      try {
        await autoSuspectChildren(created.id, lookupResponses);
        toast.success(
          canSuspectChildren
            ? `Created case #${created.id} and suspected children`
            : `Created maintenance case #${created.id}`
        );
      } catch (err) {
        console.error('Auto suspect children failed:', err);
        toast.success(`Created maintenance case #${created.id}`);
        toast.error(
          formatMaintenanceApiError(err, 'Case created, but suspecting children failed.')
        );
      }
    } catch (err) {
      setLookupError(
        formatMaintenanceApiError(
          err,
          'An open maintenance case already exists for this serial number.'
        )
      );
    } finally {
      setCreateCaseLoading(false);
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

  return (
    <MaintenanceLookupPanel
      serialNumber={serialNumber}
      setSerialNumber={setSerialNumber}
      onLookup={handleLookup}
      onClearLookup={() => {
        setLookupResponse(null);
        setLookupError(null);
        setLookupCaseId(null);
        setSerialNumber('');
      }}
      onCreateCase={handleCreateCaseFromLookup}
      lookupResponse={lookupResponses}
      caseId={lookupCaseId}
      lookupLoading={lookupLoading}
      createCaseLoading={createCaseLoading}
      lookupError={lookupError}
      onConfirmFault={handleConfirmFault}
    />
  );
}
