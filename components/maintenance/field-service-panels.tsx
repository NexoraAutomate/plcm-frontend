'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  EntityAttachmentsSection,
  type PendingAttachmentUpload,
} from '@/components/entity-attachments-section';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadedFileRow } from '@/components/ui/file-drop-zone';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { attachments as attachmentsApi, maintenanceCases, oemWarrantyClaims } from '@/lib/api';
import { attachmentTypeLabel } from '@/lib/attachment-types';
import { FaultType } from '@/lib/models';
import type {
  ConfirmationChannel,
  MaintenanceCase,
  OccurrenceAttachment,
  OccurrenceOfficer,
  OnsiteOutcome,
  OemWarrantyClaim,
  ReturnedUnit,
  SoftFixMethod,
} from '@/lib/models';
import { formatMaintenanceApiError } from '@/services/maintenance';
import { cn } from '@/lib/utils';

function SupportBadge({ maintenanceCase }: { maintenanceCase: MaintenanceCase }) {
  const inSupport = maintenanceCase.in_production_support;
  if (inSupport == null && !maintenanceCase.production_support_date) {
    return (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Support date unset
      </Badge>
    );
  }
  if (inSupport) {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        In production support
        {maintenanceCase.production_support_date
          ? ` · until ${maintenanceCase.production_support_date}`
          : ''}
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Out of production support
      {maintenanceCase.support_override_reason
        ? ` · override: ${maintenanceCase.support_override_reason}`
        : ''}
    </Badge>
  );
}

const OUTCOME_OPTIONS: Array<{ value: OnsiteOutcome; label: string }> = [
  { value: 'soft_fix', label: 'Soft fix' },
  { value: 'fault_identified', label: 'Fault identified' },
  { value: 'inconclusive', label: 'Inconclusive' },
  { value: 'no_fault_found', label: 'No fault found' },
];

const METHOD_OPTIONS: Array<{ value: SoftFixMethod; label: string }> = [
  { value: 'reboot', label: 'Reboot' },
  { value: 'hard_reset', label: 'Hard reset' },
  { value: 'reconnect', label: 'Reconnect' },
  { value: 'other', label: 'Other' },
];

const CHANNEL_OPTIONS: Array<{ value: ConfirmationChannel; label: string }> = [
  { value: 'email', label: 'Email' },
  { value: 'letter', label: 'Letter' },
  { value: 'call', label: 'Call' },
];

const FAULT_TYPE_OPTIONS = Object.values(FaultType).map((value) => ({
  value,
  label: value.replace(/_/g, ' '),
}));

const OFFICER_ROLE_OPTIONS = [
  { value: 'FSE', label: 'FSE' },
  { value: 'ME', label: 'ME' },
  { value: 'Guest', label: 'Guest' },
  { value: 'Other', label: 'Other' },
] as const;

interface FieldServicePanelsProps {
  maintenanceCase: MaintenanceCase;
  onCaseUpdated: (next: MaintenanceCase) => void;
  /** Called after a ReplacementRequest is created (P2 dual-track). */
  onReplacementRequested?: () => void;
  /** True when an open Track A replacement request already exists. */
  hasOpenReplacementRequest?: boolean;
  /** PD sent the replacement back for modification — reopen occurrence as editable. */
  modificationRequired?: boolean;
  /** Refresh dual-track after occurrence is updated in modification mode. */
  onOccurrenceUpdated?: () => void;
  /** Which panels to render (default both). */
  sections?: Array<'occurrence' | 'returned'>;
}

type DraftOfficer = {
  key: string;
  guest_name: string;
  role_onsite: string;
  contact: string;
};

type KeptAttachment = {
  key: string;
  display_name: string;
  file_id?: number | null;
  category?: string | null;
};

type OfficerFormState = {
  guest_name: string;
  role_onsite: string;
  contact: string;
};

const EMPTY_OFFICER_FORM: OfficerFormState = {
  guest_name: '',
  role_onsite: 'FSE',
  contact: '',
};

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function FieldServicePanels({
  maintenanceCase,
  onCaseUpdated,
  onReplacementRequested,
  hasOpenReplacementRequest = false,
  modificationRequired = false,
  onOccurrenceUpdated,
  sections = ['occurrence', 'returned'],
}: FieldServicePanelsProps) {
  const showOccurrence = sections.includes('occurrence');
  const showReturned = sections.includes('returned');
  const [outcome, setOutcome] = useState<OnsiteOutcome | ''>('');
  const [method, setMethod] = useState<SoftFixMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [occurrenceDate, setOccurrenceDate] = useState('');
  const [faultType, setFaultType] = useState('');
  const [channel, setChannel] = useState<ConfirmationChannel | ''>('');
  const [confirmationRef, setConfirmationRef] = useState('');
  const [officers, setOfficers] = useState<DraftOfficer[]>([]);
  const [keptAttachments, setKeptAttachments] = useState<KeptAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [officerDialogOpen, setOfficerDialogOpen] = useState(false);
  const [editingOfficerKey, setEditingOfficerKey] = useState<string | null>(null);
  const [officerForm, setOfficerForm] = useState<OfficerFormState>(EMPTY_OFFICER_FORM);
  const [deleteOfficerKey, setDeleteOfficerKey] = useState<string | null>(null);
  const [deleteAttachmentKey, setDeleteAttachmentKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [claimBusyId, setClaimBusyId] = useState<number | null>(null);
  const [nffDialogOpen, setNffDialogOpen] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [localRequestCreated, setLocalRequestCreated] = useState(false);
  const [editHydrated, setEditHydrated] = useState(false);

  const replacementRequestLocked =
    hasOpenReplacementRequest || localRequestCreated;
  const showOccurrenceEditor = !maintenanceCase.onsite_outcome || modificationRequired;

  useEffect(() => {
    if (!hasOpenReplacementRequest) {
      setLocalRequestCreated(false);
    }
  }, [hasOpenReplacementRequest]);

  const returnedUnits = maintenanceCase.returned_units ?? [];
  const claims = maintenanceCase.warranty_claims ?? [];
  const recordedAttachments = maintenanceCase.occurrence_attachments ?? [];
  const recordedOfficers = maintenanceCase.occurrence_officers ?? [];

  useEffect(() => {
    if (!modificationRequired || !maintenanceCase.onsite_outcome) {
      setEditHydrated(false);
      return;
    }
    if (editHydrated) return;

    setOutcome((maintenanceCase.onsite_outcome as OnsiteOutcome) || '');
    setMethod((maintenanceCase.onsite_soft_fix_method as SoftFixMethod) || '');
    setNotes(maintenanceCase.onsite_notes || '');
    setOccurrenceDate(toDateInputValue(maintenanceCase.occurrence_date));
    setFaultType(
      String(
        maintenanceCase.fault_type || maintenanceCase.occurrence_fault_type || ''
      )
    );
    setChannel((maintenanceCase.confirmation_channel as ConfirmationChannel) || '');
    setConfirmationRef(maintenanceCase.confirmation_reference || '');
    setOfficers(
      (maintenanceCase.occurrence_officers ?? []).map((o, idx) => ({
        key: `o-edit-${o.id ?? idx}`,
        guest_name: o.guest_name || '',
        role_onsite: o.role_onsite || 'FSE',
        contact: o.contact || '',
      }))
    );
    setKeptAttachments(
      (maintenanceCase.occurrence_attachments ?? []).map((a, idx) => ({
        key: `a-edit-${a.id ?? idx}`,
        display_name: a.display_name,
        file_id: a.file_id,
        category: a.category,
      }))
    );
    setPendingAttachments([]);
    setEditHydrated(true);
  }, [modificationRequired, maintenanceCase, editHydrated]);

  const claimsByRework = useMemo(() => {
    const map = new Map<number, OemWarrantyClaim>();
    for (const claim of claims) {
      if (claim.rework_case_id != null) map.set(claim.rework_case_id, claim);
    }
    return map;
  }, [claims]);

  const resetForm = () => {
    setOutcome('');
    setMethod('');
    setNotes('');
    setOccurrenceDate('');
    setFaultType('');
    setChannel('');
    setConfirmationRef('');
    setOfficers([]);
    setKeptAttachments([]);
    setPendingAttachments([]);
    setOfficerDialogOpen(false);
    setEditingOfficerKey(null);
    setOfficerForm(EMPTY_OFFICER_FORM);
    setDeleteOfficerKey(null);
    setDeleteAttachmentKey(null);
    setEditHydrated(false);
  };

  const buildPayload = (
    confirmCloseNff: boolean,
    uploadedAttachments: Array<{
      display_name: string;
      file_id?: number | null;
      category?: string | null;
    }>
  ) => ({
    onsite_outcome: outcome as OnsiteOutcome,
    onsite_soft_fix_method: outcome === 'soft_fix' ? method || undefined : undefined,
    notes: notes.trim() || undefined,
    // While PD asked for modification, only refresh the report — do not auto-close.
    resolve_soft_fixed: outcome === 'soft_fix' && !modificationRequired,
    confirm_close_nff: modificationRequired ? false : confirmCloseNff,
    occurrence_date: occurrenceDate || undefined,
    fault_type: outcome === 'fault_identified' ? faultType || undefined : undefined,
    confirmation_channel:
      outcome === 'fault_identified' ? channel || undefined : undefined,
    confirmation_reference:
      outcome === 'fault_identified' ? confirmationRef.trim() || undefined : undefined,
    attachments: uploadedAttachments,
    officers: officers
      .filter((o) => o.guest_name.trim() && o.role_onsite.trim())
      .map((o) => ({
        guest_name: o.guest_name.trim(),
        role_onsite: o.role_onsite.trim(),
        contact: o.contact.trim() || undefined,
      })),
  });

  const uploadPendingAttachments = async () => {
    const uploaded: Array<{
      display_name: string;
      file_id?: number | null;
      category?: string | null;
    }> = keptAttachments.map((a) => ({
      display_name: a.display_name,
      file_id: a.file_id,
      category: a.category || undefined,
    }));
    for (const item of pendingAttachments) {
      const displayName = item.description?.trim() || item.file.name;
      const { data } = await attachmentsApi.upload(
        'maintenance_case',
        maintenanceCase.id,
        item.file,
        {
          attachment_type: item.attachment_type,
          description: displayName,
        }
      );
      uploaded.push({
        display_name: displayName,
        file_id: data.id,
        category: item.attachment_type || undefined,
      });
    }
    return uploaded;
  };

  const submitOccurrence = async (confirmCloseNff: boolean) => {
    if (!outcome) {
      toast.error('Select an occurrence outcome');
      return;
    }
    if (outcome === 'soft_fix' && !method) {
      toast.error('Select a soft-fix method');
      return;
    }
    if (outcome === 'fault_identified') {
      if (!faultType) {
        toast.error('Select a fault type');
        return;
      }
      if (!channel) {
        toast.error('Select a confirmation channel');
        return;
      }
      if (!confirmationRef.trim()) {
        toast.error('Enter confirmation reference / evidence');
        return;
      }
    }
    setSaving(true);
    try {
      if (!Number.isFinite(maintenanceCase.id)) {
        toast.error('Case id is missing — refresh the page and try again.');
        return;
      }
      const uploadedAttachments = await uploadPendingAttachments();
      const { data: updated } = await maintenanceCases.recordOnsiteOutcome(
        maintenanceCase.id,
        buildPayload(confirmCloseNff, uploadedAttachments)
      );
      onCaseUpdated(updated);
      if (modificationRequired) {
        toast.success(
          'Occurrence Report updated — re-submit for PD approval on the dual-track board'
        );
        onOccurrenceUpdated?.();
        setEditHydrated(false);
      } else if (outcome === 'soft_fix') {
        toast.success('Soft fix recorded — case resolved without inventory replace');
        resetForm();
      } else if (outcome === 'no_fault_found' && confirmCloseNff) {
        toast.success('No fault found — case closed');
        resetForm();
      } else if (outcome === 'no_fault_found') {
        toast.success('No fault found noted — case remains open');
        resetForm();
      } else {
        toast.success('Occurrence Report recorded');
        resetForm();
      }
    } catch (err) {
      toast.error(
        formatMaintenanceApiError(
          err,
          modificationRequired
            ? 'Failed to update Occurrence Report'
            : 'Failed to record Occurrence Report'
        )
      );
    } finally {
      setSaving(false);
      setNffDialogOpen(false);
    }
  };

  const handleRecordOccurrence = async () => {
    if (outcome === 'no_fault_found' && !modificationRequired) {
      setNffDialogOpen(true);
      return;
    }
    await submitOccurrence(false);
  };

  const handleRequestReplacement = async () => {
    if (maintenanceCase.onsite_outcome !== 'fault_identified') {
      toast.error('Record fault_identified Occurrence Report first');
      return;
    }
    if (replacementRequestLocked) {
      toast.error('A replacement request is already open for this case');
      return;
    }
    setCreatingRequest(true);
    try {
      const primaryFe = maintenanceCase.faulty_entities?.[0];
      await maintenanceCases.createReplacementRequest(maintenanceCase.id, {
        faulty_entity_id: primaryFe?.id ?? null,
      });
      setLocalRequestCreated(true);
      toast.success('Replacement request created — Track A started');
      onReplacementRequested?.();
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to create replacement request'));
    } finally {
      setCreatingRequest(false);
    }
  };

  const openClaim = async (unit: ReturnedUnit) => {
    setClaimBusyId(unit.id);
    try {
      await oemWarrantyClaims.create({
        rework_case_id: unit.id,
        notes: 'Opened from maintenance case returned-unit panel',
      });
      const { data: refreshed } = await maintenanceCases.get(maintenanceCase.id);
      onCaseUpdated(refreshed);
      toast.success('OEM warranty claim opened');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Could not open warranty claim'));
    } finally {
      setClaimBusyId(null);
    }
  };

  const openAddOfficer = () => {
    setEditingOfficerKey(null);
    setOfficerForm(EMPTY_OFFICER_FORM);
    setOfficerDialogOpen(true);
  };

  const openEditOfficer = (officer: DraftOfficer) => {
    setEditingOfficerKey(officer.key);
    setOfficerForm({
      guest_name: officer.guest_name,
      role_onsite: officer.role_onsite || 'FSE',
      contact: officer.contact,
    });
    setOfficerDialogOpen(true);
  };

  const saveOfficer = () => {
    const guest_name = officerForm.guest_name.trim();
    const role_onsite = officerForm.role_onsite.trim();
    if (!guest_name) {
      toast.error('Officer name is required');
      return;
    }
    if (!role_onsite) {
      toast.error('Officer role is required');
      return;
    }
    const nextOfficer = {
      guest_name,
      role_onsite,
      contact: officerForm.contact.trim(),
    };
    if (editingOfficerKey) {
      setOfficers((prev) =>
        prev.map((o) => (o.key === editingOfficerKey ? { ...o, ...nextOfficer } : o))
      );
    } else {
      setOfficers((prev) => [
        ...prev,
        {
          key: `o-${Date.now()}-${prev.length}`,
          ...nextOfficer,
        },
      ]);
    }
    setOfficerDialogOpen(false);
    setEditingOfficerKey(null);
    setOfficerForm(EMPTY_OFFICER_FORM);
  };

  const confirmDeleteOfficer = () => {
    if (!deleteOfficerKey) return;
    setOfficers((prev) => prev.filter((o) => o.key !== deleteOfficerKey));
    setDeleteOfficerKey(null);
  };

  const confirmDeleteAttachment = () => {
    if (!deleteAttachmentKey) return;
    setKeptAttachments((prev) => prev.filter((a) => a.key !== deleteAttachmentKey));
    setDeleteAttachmentKey(null);
  };

  const officerPendingDelete = officers.find((o) => o.key === deleteOfficerKey);
  const attachmentPendingDelete = keptAttachments.find(
    (a) => a.key === deleteAttachmentKey
  );

  const occurrenceHeading = modificationRequired
    ? 'Occurrence Report (edit)'
    : 'Occurrence Report';
  const occurrenceHoverSummary = useMemo(() => {
    if (!maintenanceCase.onsite_outcome) return null;
    const recordedParts = ['Recorded'];
    if (maintenanceCase.onsite_recorded_at) {
      recordedParts.push(
        new Date(maintenanceCase.onsite_recorded_at).toLocaleString()
      );
    }
    let firstLine = recordedParts.join(' ');
    if (maintenanceCase.occurrence_date) {
      firstLine += ` · occurrence date ${new Date(
        maintenanceCase.occurrence_date
      ).toLocaleDateString()}`;
    }
    if (maintenanceCase.onsite_notes?.trim()) {
      firstLine += ` — ${maintenanceCase.onsite_notes.trim()}`;
    }

    const lines = [firstLine];
    const faultType =
      maintenanceCase.fault_type || maintenanceCase.occurrence_fault_type;
    if (faultType) {
      const faultBits = [
        `Fault type: ${String(faultType).replace(/_/g, ' ')}`,
        maintenanceCase.confirmation_channel
          ? `via ${maintenanceCase.confirmation_channel}`
          : null,
        maintenanceCase.confirmation_reference
          ? `ref ${maintenanceCase.confirmation_reference}`
          : null,
      ].filter(Boolean);
      lines.push(faultBits.join(' · '));
    }
    return lines.join('\n');
  }, [maintenanceCase]);

  return (
    <div className="space-y-4">
      {showOccurrence ? (
      <div className="flex flex-wrap items-center gap-2">
        <SupportBadge maintenanceCase={maintenanceCase} />
        {maintenanceCase.onsite_outcome ? (
          <Badge variant="secondary" className="font-normal capitalize">
            Occurrence:{' '}
            {String(maintenanceCase.onsite_outcome).replace(/_/g, ' ')}
            {maintenanceCase.onsite_soft_fix_method
              ? ` (${String(maintenanceCase.onsite_soft_fix_method).replace(/_/g, ' ')})`
              : ''}
          </Badge>
        ) : null}
      </div>
      ) : null}

      {showOccurrence ? (
      <Card>
        <CardHeader className="pb-3">
          {occurrenceHoverSummary && !modificationRequired ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <CardTitle className="w-fit cursor-help text-base">
                  {occurrenceHeading}
                </CardTitle>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                className="max-w-sm whitespace-pre-line text-left"
              >
                {occurrenceHoverSummary}
              </TooltipContent>
            </Tooltip>
          ) : (
            <CardTitle className="text-base">{occurrenceHeading}</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!showOccurrenceEditor ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              {recordedOfficers.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Field officers</p>
                  <div className="space-y-2">
                    {recordedOfficers.map((o: OccurrenceOfficer) => {
                      const name =
                        o.guest_name ||
                        (o.user_id != null ? `User #${o.user_id}` : 'Officer');
                      return (
                        <div
                          key={o.id ?? `${name}-${o.role_onsite}`}
                          className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {o.role_onsite}
                              {o.contact ? ` · ${o.contact}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="font-medium text-foreground">Attachments</p>
                {recordedAttachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attachments.</p>
                ) : (
                  <div className="space-y-2">
                    {recordedAttachments.map((a: OccurrenceAttachment) => (
                      <UploadedFileRow
                        key={a.id ?? a.display_name}
                        name={a.display_name}
                        subtitle={
                          a.category ? attachmentTypeLabel(a.category) : null
                        }
                        onView={
                          a.file_id
                            ? () =>
                                void attachmentsApi
                                  .download(a.file_id!, a.display_name)
                                  .catch(() =>
                                    toast.error('Unable to open attachment')
                                  )
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
              {maintenanceCase.onsite_outcome === 'fault_identified' &&
              !replacementRequestLocked ? (
                <div className="space-y-1.5 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={creatingRequest}
                    onClick={() => void handleRequestReplacement()}
                  >
                    {creatingRequest ? 'Creating…' : 'Request immediate replacement'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {modificationRequired ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  PD requested modification. Update occurrence details below, save, then
                  re-submit for PD approval on the dual-track board.
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Occurrence date</Label>
                  <Input
                    type="date"
                    value={occurrenceDate}
                    onChange={(e) => setOccurrenceDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Outcome</Label>
                  <Select
                    value={outcome}
                    onValueChange={(v) => setOutcome(v as OnsiteOutcome)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {outcome === 'soft_fix' ? (
                  <div className="space-y-1.5">
                    <Label>Soft-fix method</Label>
                    <Select
                      value={method}
                      onValueChange={(v) => setMethod(v as SoftFixMethod)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {METHOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {outcome === 'fault_identified' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Fault type</Label>
                      <Select value={faultType} onValueChange={setFaultType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fault type" />
                        </SelectTrigger>
                        <SelectContent>
                          {FAULT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="capitalize">{opt.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Confirmation channel</Label>
                      <Select
                        value={channel}
                        onValueChange={(v) => setChannel(v as ConfirmationChannel)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Email / letter / call" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Confirmation reference</Label>
                      <Input
                        value={confirmationRef}
                        onChange={(e) => setConfirmationRef(e.target.value)}
                        placeholder="Email subject, letter ref, call log id…"
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="What happened in the field…"
                />
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-sm font-medium">Field officers</Label>
                    <p className="text-xs text-muted-foreground">
                      Optional. Add FSE / ME / guest names present on site.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={openAddOfficer}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add officer
                  </Button>
                </div>
                {officers.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-background/60 px-4 py-6 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-muted-foreground">No officers added yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {officers.map((o) => (
                      <div
                        key={o.key}
                        className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg border bg-background px-3 py-2.5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="truncate text-sm font-medium text-foreground">
                              {o.guest_name || 'Unnamed officer'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {o.contact || 'No contact provided'}
                            </p>
                          </div>
                          {o.role_onsite ? (
                            <Badge variant="secondary" className="shrink-0 font-normal">
                              {o.role_onsite}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditOfficer(o)}
                            title="Edit officer"
                            aria-label={`Edit ${o.guest_name || 'officer'}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteOfficerKey(o.key)}
                            title="Delete officer"
                            aria-label={`Delete ${o.guest_name || 'officer'}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium">Named attachments</Label>
                  <p className="text-xs text-muted-foreground">
                    {modificationRequired
                      ? 'Keep, remove, or add files. New files upload when you save.'
                      : 'Optional. Files upload when you record the Occurrence Report.'}
                  </p>
                </div>
                {keptAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {keptAttachments.map((a) => (
                      <UploadedFileRow
                        key={a.key}
                        name={a.display_name}
                        subtitle={
                          a.category ? attachmentTypeLabel(a.category) : null
                        }
                        onView={
                          a.file_id
                            ? () =>
                                void attachmentsApi
                                  .download(a.file_id!, a.display_name)
                                  .catch(() =>
                                    toast.error('Unable to open attachment')
                                  )
                            : undefined
                        }
                        onDelete={() => setDeleteAttachmentKey(a.key)}
                      />
                    ))}
                  </div>
                ) : null}
                <EntityAttachmentsSection
                  ownerType="maintenance_case"
                  ownerId={null}
                  pendingAttachments={pendingAttachments}
                  onPendingAttachmentsChange={setPendingAttachments}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={handleRecordOccurrence} disabled={saving}>
                  {saving
                    ? 'Saving…'
                    : modificationRequired
                      ? 'Update Occurrence Report'
                      : 'Record Occurrence Report'}
                </Button>
                {!modificationRequired && outcome === 'fault_identified' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled
                    title="Enabled after recording the Occurrence Report"
                  >
                    Request immediate replacement
                  </Button>
                ) : null}
              </div>
              {!modificationRequired && outcome === 'fault_identified' ? (
                <p className="text-xs text-muted-foreground">
                  After recording, investigation continues in parallel. The replacement
                  request CTA activates once the report is saved (starts Track A).
                </p>
              ) : null}
              {modificationRequired ? (
                <p className="text-xs text-muted-foreground">
                  After saving, use Re-submit for PD approval on the dual-track board.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      ) : null}

      {showOccurrence ? (
      <>
      <AlertDialog open={nffDialogOpen} onOpenChange={setNffDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close case as No Fault Found?</AlertDialogTitle>
            <AlertDialogDescription>
              Yes resolves and closes the case as NFF. No saves the note and keeps the
              case open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void submitOccurrence(false);
              }}
            >
              No — note only
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void submitOccurrence(true);
              }}
            >
              Yes — close as NFF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={officerDialogOpen}
        onOpenChange={(open) => {
          setOfficerDialogOpen(open);
          if (!open) {
            setEditingOfficerKey(null);
            setOfficerForm(EMPTY_OFFICER_FORM);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOfficerKey ? 'Edit officer' : 'Add officer'}</DialogTitle>
            <DialogDescription>
              Capture who was present on site for this occurrence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="officer-name">Name</Label>
              <Input
                id="officer-name"
                value={officerForm.guest_name}
                onChange={(e) =>
                  setOfficerForm((prev) => ({ ...prev, guest_name: e.target.value }))
                }
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="officer-role">Role onsite</Label>
              <Select
                value={officerForm.role_onsite}
                onValueChange={(value) =>
                  setOfficerForm((prev) => ({ ...prev, role_onsite: value }))
                }
              >
                <SelectTrigger id="officer-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {OFFICER_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="officer-contact">Contact</Label>
              <Input
                id="officer-contact"
                value={officerForm.contact}
                onChange={(e) =>
                  setOfficerForm((prev) => ({ ...prev, contact: e.target.value }))
                }
                placeholder="Phone or email (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOfficerDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveOfficer}>
              {editingOfficerKey ? 'Save changes' : 'Add officer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOfficerKey != null}
        onOpenChange={(open) => {
          if (!open) setDeleteOfficerKey(null);
        }}
        title="Delete field officer"
        description={
          officerPendingDelete
            ? `Remove ${officerPendingDelete.guest_name || 'this officer'} from the Occurrence Report?`
            : 'Remove this officer from the Occurrence Report?'
        }
        onConfirm={confirmDeleteOfficer}
      />

      <ConfirmDialog
        open={deleteAttachmentKey != null}
        onOpenChange={(open) => {
          if (!open) setDeleteAttachmentKey(null);
        }}
        title="Remove attachment"
        description={
          attachmentPendingDelete
            ? `Remove ${attachmentPendingDelete.display_name} from the Occurrence Report?`
            : 'Remove this attachment from the Occurrence Report?'
        }
        onConfirm={confirmDeleteAttachment}
      />
      </>
      ) : null}

      {showReturned ? (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Returned units (IM)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {returnedUnits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No returned units yet. Resolving a faulty entity as replaced opens an IM
              return linked to this case.
            </p>
          ) : (
            returnedUnits.map((unit) => {
              const claim = claimsByRework.get(unit.id);
              const canClaim =
                unit.warranty_active &&
                (unit.disposition === 'scrapped' || unit.stage === 'scrapped') &&
                !claim;
              return (
                <div
                  key={unit.id}
                  className={cn(
                    'rounded-md border border-border/70 px-3 py-2.5 text-sm',
                    'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'
                  )}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-medium">
                      {unit.part_number || 'Unit'}
                      {unit.serial_number ? ` · SN ${unit.serial_number}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stage {unit.stage}
                      {unit.disposition ? ` · ${unit.disposition}` : ''}
                      {unit.investigating_pd_name
                        ? ` · PD ${unit.investigating_pd_name}`
                        : unit.investigating_pd_id
                          ? ` · PD #${unit.investigating_pd_id}`
                          : ''}
                      {unit.warranty_active
                        ? ' · warranty active'
                        : unit.warranty_expires_at
                          ? ' · warranty expired'
                          : ''}
                      {claim ? ` · claim #${claim.id} (${claim.status})` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/inspect-queue">Inspect queue</Link>
                    </Button>
                    {canClaim ? (
                      <Button
                        size="sm"
                        disabled={claimBusyId === unit.id}
                        onClick={() => openClaim(unit)}
                      >
                        {claimBusyId === unit.id ? 'Opening…' : 'Open OEM claim'}
                      </Button>
                    ) : null}
                    {claim ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href="/maintenance/warranty-claims">Warranty claims</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
