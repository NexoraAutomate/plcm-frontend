'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { oemWarrantyClaims } from '@/lib/api';
import type { OemWarrantyClaim } from '@/lib/models';
import { formatMaintenanceApiError } from '@/services/maintenance';

const STATUS_OPTIONS = [
  'all',
  'open',
  'submitted',
  'accepted',
  'rejected',
  'closed',
] as const;

export default function WarrantyClaimsPage() {
  const [claims, setClaims] = useState<OemWarrantyClaim[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await oemWarrantyClaims.list(0, 200, {
        status: status === 'all' ? undefined : status,
      });
      setClaims(rows);
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to load warranty claims'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setClaimStatus = async (claim: OemWarrantyClaim, next: string) => {
    setUpdatingId(claim.id);
    try {
      await oemWarrantyClaims.update(claim.id, { status: next });
      toast.success(`Claim #${claim.id} → ${next}`);
      await load();
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to update claim'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">OEM warranty claims</h1>
          <p className="text-sm text-muted-foreground">
            Claims opened for non-repairable units returned from maintenance field service.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === 'all' ? 'All statuses' : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Claims ({claims.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warranty claims found.</p>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-col gap-2 rounded-md border border-border/70 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium">
                    Claim #{claim.id}
                    {claim.oem_name ? ` · ${claim.oem_name}` : ''}
                    {claim.part_number ? ` · ${claim.part_number}` : ''}
                    {claim.serial_number ? ` · SN ${claim.serial_number}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status {claim.status}
                    {claim.warranty_expires_at
                      ? ` · warranty until ${new Date(claim.warranty_expires_at).toLocaleDateString()}`
                      : ''}
                    {claim.maintenance_case_id ? (
                      <>
                        {' · '}
                        <Link
                          className="underline underline-offset-2"
                          href={`/maintenance/cases/${claim.maintenance_case_id}`}
                        >
                          Case #{claim.maintenance_case_id}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {claim.status === 'open' ? (
                    <Button
                      size="sm"
                      disabled={updatingId === claim.id}
                      onClick={() => void setClaimStatus(claim, 'submitted')}
                    >
                      Mark submitted
                    </Button>
                  ) : null}
                  {claim.status === 'submitted' ? (
                    <>
                      <Button
                        size="sm"
                        disabled={updatingId === claim.id}
                        onClick={() => void setClaimStatus(claim, 'accepted')}
                      >
                        Accepted
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === claim.id}
                        onClick={() => void setClaimStatus(claim, 'rejected')}
                      >
                        Rejected
                      </Button>
                    </>
                  ) : null}
                  {claim.status !== 'closed' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={updatingId === claim.id}
                      onClick={() => void setClaimStatus(claim, 'closed')}
                    >
                      Close
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
