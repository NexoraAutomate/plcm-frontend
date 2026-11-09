'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { maintenanceCases } from '@/lib/api';
import type { ReturnedUnit } from '@/lib/models';
import { formatMaintenanceApiError } from '@/services/maintenance';

export default function ReturnedUnitsPage() {
  const [units, setUnits] = useState<ReturnedUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await maintenanceCases.listAllReturnedUnits(0, 300);
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(formatMaintenanceApiError(err, 'Failed to load returned units'));
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Returned Units</h2>
          <p className="text-sm text-muted-foreground">
            Faulty units returned from the field (Track B) across maintenance cases.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Returned items ({units.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading returned units…' : 'No returned units found.'}
            </p>
          ) : (
            units.map((unit) => (
              <div
                key={unit.id}
                className="flex flex-col gap-2 rounded-md border border-border/70 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium">
                    {unit.part_number || 'Unit'}
                    {unit.serial_number ? ` · SN ${unit.serial_number}` : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal capitalize">
                      {unit.stage?.replace(/_/g, ' ') || unit.status}
                    </Badge>
                    {unit.disposition ? (
                      <span className="capitalize">{unit.disposition.replace(/_/g, ' ')}</span>
                    ) : null}
                    {unit.case_number || unit.maintenance_case_id ? (
                      <span>
                        Case{' '}
                        {unit.maintenance_case_id ? (
                          <Link
                            href={`/maintenance/cases/${unit.maintenance_case_id}`}
                            className="font-medium text-primary underline-offset-2 hover:underline"
                          >
                            {unit.case_number || `#${unit.maintenance_case_id}`}
                          </Link>
                        ) : (
                          unit.case_number
                        )}
                      </span>
                    ) : null}
                    {unit.investigating_pd_name
                      ? ` · PD ${unit.investigating_pd_name}`
                      : unit.investigating_pd_id
                        ? ` · PD #${unit.investigating_pd_id}`
                        : ''}
                    {unit.assigned_ie_name
                      ? ` · IE ${unit.assigned_ie_name}`
                      : unit.assigned_ie_id
                        ? ` · IE #${unit.assigned_ie_id}`
                        : ''}
                    {unit.warranty_active
                      ? ' · warranty active'
                      : unit.warranty_expires_at
                        ? ' · warranty expired'
                        : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unit.maintenance_case_id ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/maintenance/cases/${unit.maintenance_case_id}`}>
                        Open case
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/inspect-queue">Inspect queue</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
