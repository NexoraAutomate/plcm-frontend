'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { maintenanceCases, oemWarrantyClaims } from '@/lib/api';
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

interface FieldServicePanelsProps {
  maintenanceCase: MaintenanceCase;
  onCaseUpdated: (next: MaintenanceCase) => void;
  /** Called after a ReplacementRequest is created (P2 dual-track). */
  onReplacementRequested?: () => void;
}

type DraftOfficer = {
  key: string;
  guest_name: string;
  role_onsite: string;
  contact: string;
};

type DraftAttachment = {
  key: string;
  display_name: string;
  category: string;
};

export function FieldServicePanels({
  maintenanceCase,
  onCaseUpdated,
  onReplacementRequested,
}: FieldServicePanelsProps) {
  const [outcome, setOutcome] = useState<OnsiteOutcome | ''>('');
  const [method, setMethod] = useState<SoftFixMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [occurrenceDate, setOccurrenceDate] = useState('');
  const [faultType, setFaultType] = useState('');
  const [channel, setChannel] = useState<ConfirmationChannel | ''>('');
  const [confirmationRef, setConfirmationRef] = useState('');
  const [officers, setOfficers] = useState<DraftOfficer[]>([]);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [claimBusyId, setClaimBusyId] = useState<number | null>(null);
  const [nffDialogOpen, setNffDialogOpen] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);

  const returnedUnits = maintenanceCase.returned_units ?? [];
  const claims = maintenanceCase.warranty_claims ?? [];
  const recordedAttachments = maintenanceCase.occurrence_attachments ?? [];
  const recordedOfficers = maintenanceCase.occurrence_officers ?? [];

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
    setAttachments([]);
  };

  const buildPayload = (confirmCloseNff: boolean) => ({
    onsite_outcome: outcome as OnsiteOutcome,
    onsite_soft_fix_method: outcome === 'soft_fix' ? method || undefined : undefined,
    notes: notes.trim() || undefined,
    resolve_soft_fixed: outcome === 'soft_fix',
    confirm_close_nff: confirmCloseNff,
    occurrence_date: occurrenceDate || undefined,
    fault_type: outcome === 'fault_identified' ? faultType || undefined : undefined,
    confirmation_channel:
      outcome === 'fault_identified' ? channel || undefined : undefined,
    confirmation_reference:
      outcome === 'fault_identified' ? confirmationRef.trim() || undefined : undefined,
    attachments: attachments
      .filter((a) => a.display_name.trim())
      .map((a) => ({
        display_name: a.display_name.trim(),
        category: a.category.trim() || undefined,
      })),
    officers: officers
      .filter((o) => o.guest_name.trim() && o.role_onsite.trim())
      .map((o) => ({
        guest_name: o.guest_name.trim(),
        role_onsite: o.role_onsite.trim(),
        contact: o.contact.trim() || undefined,
      })),
  });

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
      const { data: updated } = await maintenanceCases.recordOnsiteOutcome(
        maintenanceCase.id,
        buildPayload(confirmCloseNff)
      );
      onCaseUpdated(updated);
      if (outcome === 'soft_fix') {
        toast.success('Soft fix recorded — case resolved without inventory replace');
      } else if (outcome === 'no_fault_found' && confirmCloseNff) {
        toast.success('No fault found — case closed');
      } else if (outcome === 'no_fault_found') {
        toast.success('No fault found noted — case remains open');
      } else {
        toast.success('Occurrence Report recorded');
      }
      resetForm();
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to record Occurrence Report'));
    } finally {
      setSaving(false);
      setNffDialogOpen(false);
    }
  };

  const handleRecordOccurrence = async () => {
    if (outcome === 'no_fault_found') {
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
    setCreatingRequest(true);
    try {
      const primaryFe = maintenanceCase.faulty_entities?.[0];
      await maintenanceCases.createReplacementRequest(maintenanceCase.id, {
        faulty_entity_id: primaryFe?.id ?? null,
      });
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

  const addOfficer = () => {
    setOfficers((prev) => [
      ...prev,
      {
        key: `o-${Date.now()}-${prev.length}`,
        guest_name: '',
        role_onsite: 'FSE',
        contact: '',
      },
    ]);
  };

  const addAttachment = () => {
    setAttachments((prev) => [
      ...prev,
      {
        key: `a-${Date.now()}-${prev.length}`,
        display_name: '',
        category: '',
      },
    ]);
  };

  return (
    <div className="space-y-4">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Occurrence Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {maintenanceCase.onsite_outcome ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Recorded
                {maintenanceCase.onsite_recorded_at
                  ? ` ${new Date(maintenanceCase.onsite_recorded_at).toLocaleString()}`
                  : ''}
                {maintenanceCase.occurrence_date
                  ? ` · occurrence date ${new Date(maintenanceCase.occurrence_date).toLocaleDateString()}`
                  : ''}
                {maintenanceCase.onsite_notes ? ` — ${maintenanceCase.onsite_notes}` : ''}
              </p>
              {(maintenanceCase.fault_type || maintenanceCase.occurrence_fault_type) && (
                <p className="capitalize">
                  Fault type:{' '}
                  {String(
                    maintenanceCase.fault_type || maintenanceCase.occurrence_fault_type
                  ).replace(/_/g, ' ')}
                  {maintenanceCase.confirmation_channel
                    ? ` · via ${maintenanceCase.confirmation_channel}`
                    : ''}
                  {maintenanceCase.confirmation_reference
                    ? ` · ref ${maintenanceCase.confirmation_reference}`
                    : ''}
                </p>
              )}
              {recordedOfficers.length > 0 ? (
                <div>
                  <p className="font-medium text-foreground">Officers</p>
                  <ul className="list-disc pl-5">
                    {recordedOfficers.map((o: OccurrenceOfficer) => (
                      <li key={o.id ?? `${o.guest_name}-${o.role_onsite}`}>
                        {o.guest_name || (o.user_id != null ? `User #${o.user_id}` : 'Officer')}{' '}
                        · {o.role_onsite}
                        {o.contact ? ` · ${o.contact}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {recordedAttachments.length > 0 ? (
                <div>
                  <p className="font-medium text-foreground">Attachments</p>
                  <ul className="list-disc pl-5">
                    {recordedAttachments.map((a: OccurrenceAttachment) => (
                      <li key={a.id ?? a.display_name}>
                        {a.display_name}
                        {a.category ? ` (${a.category})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {maintenanceCase.onsite_outcome === 'fault_identified' ? (
                <div className="pt-1">
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

              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Field officers</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addOfficer}>
                    Add officer
                  </Button>
                </div>
                {officers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Optional. Add FSE / ME / guest names present on site.
                  </p>
                ) : (
                  officers.map((o, idx) => (
                    <div
                      key={o.key}
                      className="grid gap-2 sm:grid-cols-3"
                    >
                      <Input
                        placeholder="Name"
                        value={o.guest_name}
                        onChange={(e) => {
                          const next = [...officers];
                          next[idx] = { ...o, guest_name: e.target.value };
                          setOfficers(next);
                        }}
                      />
                      <Input
                        placeholder="Role onsite"
                        value={o.role_onsite}
                        onChange={(e) => {
                          const next = [...officers];
                          next[idx] = { ...o, role_onsite: e.target.value };
                          setOfficers(next);
                        }}
                      />
                      <Input
                        placeholder="Contact"
                        value={o.contact}
                        onChange={(e) => {
                          const next = [...officers];
                          next[idx] = { ...o, contact: e.target.value };
                          setOfficers(next);
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Named attachments</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addAttachment}>
                    Add attachment
                  </Button>
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Optional. Display name is required per file (upload link in P2+).
                  </p>
                ) : (
                  attachments.map((a, idx) => (
                    <div key={a.key} className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Display name (required)"
                        value={a.display_name}
                        onChange={(e) => {
                          const next = [...attachments];
                          next[idx] = { ...a, display_name: e.target.value };
                          setAttachments(next);
                        }}
                      />
                      <Input
                        placeholder="Category (optional)"
                        value={a.category}
                        onChange={(e) => {
                          const next = [...attachments];
                          next[idx] = { ...a, category: e.target.value };
                          setAttachments(next);
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={handleRecordOccurrence} disabled={saving}>
                  {saving ? 'Saving…' : 'Record Occurrence Report'}
                </Button>
                {outcome === 'fault_identified' ? (
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
              {outcome === 'fault_identified' ? (
                <p className="text-xs text-muted-foreground">
                  After recording, investigation continues in parallel. The replacement
                  request CTA activates once the report is saved (starts Track A).
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
