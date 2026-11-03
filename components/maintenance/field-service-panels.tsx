'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type {
  MaintenanceCase,
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
  { value: 'fault_identified', label: 'PN / hardware fault' },
  { value: 'inconclusive', label: 'Inconclusive' },
];

const METHOD_OPTIONS: Array<{ value: SoftFixMethod; label: string }> = [
  { value: 'reboot', label: 'Reboot' },
  { value: 'hard_reset', label: 'Hard reset' },
  { value: 'reconnect', label: 'Reconnect' },
  { value: 'other', label: 'Other' },
];

interface FieldServicePanelsProps {
  maintenanceCase: MaintenanceCase;
  onCaseUpdated: (next: MaintenanceCase) => void;
}

export function FieldServicePanels({
  maintenanceCase,
  onCaseUpdated,
}: FieldServicePanelsProps) {
  const [outcome, setOutcome] = useState<OnsiteOutcome | ''>('');
  const [method, setMethod] = useState<SoftFixMethod | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [claimBusyId, setClaimBusyId] = useState<number | null>(null);

  const returnedUnits = maintenanceCase.returned_units ?? [];
  const claims = maintenanceCase.warranty_claims ?? [];

  const claimsByRework = useMemo(() => {
    const map = new Map<number, OemWarrantyClaim>();
    for (const claim of claims) {
      if (claim.rework_case_id != null) map.set(claim.rework_case_id, claim);
    }
    return map;
  }, [claims]);

  const handleRecordOnsite = async () => {
    if (!outcome) {
      toast.error('Select an onsite outcome');
      return;
    }
    if (outcome === 'soft_fix' && !method) {
      toast.error('Select a soft-fix method');
      return;
    }
    setSaving(true);
    try {
      if (!Number.isFinite(maintenanceCase.id)) {
        toast.error('Case id is missing — refresh the page and try again.');
        return;
      }
      const { data: updated } = await maintenanceCases.recordOnsiteOutcome(
        maintenanceCase.id,
        {
          onsite_outcome: outcome,
          onsite_soft_fix_method: outcome === 'soft_fix' ? method : undefined,
          notes: notes.trim() || undefined,
          resolve_soft_fixed: outcome === 'soft_fix',
        }
      );
      onCaseUpdated(updated);
      toast.success(
        outcome === 'soft_fix'
          ? 'Soft fix recorded — case closed without inventory replace'
          : 'Onsite outcome recorded'
      );
      setOutcome('');
      setMethod('');
      setNotes('');
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to record onsite outcome'));
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SupportBadge maintenanceCase={maintenanceCase} />
        {maintenanceCase.onsite_outcome ? (
          <Badge variant="secondary" className="font-normal capitalize">
            Onsite: {String(maintenanceCase.onsite_outcome).replace(/_/g, ' ')}
            {maintenanceCase.onsite_soft_fix_method
              ? ` (${String(maintenanceCase.onsite_soft_fix_method).replace(/_/g, ' ')})`
              : ''}
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Onsite visit outcome</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {maintenanceCase.onsite_outcome ? (
            <p className="text-sm text-muted-foreground">
              Recorded
              {maintenanceCase.onsite_recorded_at
                ? ` ${new Date(maintenanceCase.onsite_recorded_at).toLocaleString()}`
                : ''}
              {maintenanceCase.onsite_notes ? ` — ${maintenanceCase.onsite_notes}` : ''}
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="What was done on site…"
                />
              </div>
              <Button type="button" onClick={handleRecordOnsite} disabled={saving}>
                {saving ? 'Saving…' : 'Record onsite outcome'}
              </Button>
              {outcome === 'fault_identified' ? (
                <p className="text-xs text-muted-foreground">
                  Continue with suspect → confirm → resolve as replaced/repaired on the
                  investigation tree.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

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
