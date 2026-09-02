'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Can } from '@/components/auth/can';
import { InventoryLabelScanner } from '@/components/inventory/inventory-label-scanner';
import * as api from '@/lib/api';
import type { InventoryLabelScanResponse } from '@/lib/models';
import { P } from '@/lib/permission-codes';
import { workflowStatusLabel } from '@/lib/workflow-status';

function HistorySection({ title, entries }: { title: string; entries: Record<string, unknown>[] }) {
  return (
    <section className="space-y-2">
      <h3 className="font-medium">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records available.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <pre key={`${title}-${index}`} className="overflow-x-auto rounded-md border bg-muted/20 p-2 text-xs">
              {JSON.stringify(entry, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ScanPage() {
  const [location, setLocation] = useState('');
  const [result, setResult] = useState<InventoryLabelScanResponse | null>(null);
  const [busy, setBusy] = useState(false);

  async function resolve(payload: string) {
    setBusy(true);
    try {
      const response = await api.inventory.scanLabel({
        payload,
        location: location.trim() || undefined,
        source: 'web',
      });
      setResult(response.data);
      if (!response.data.valid) toast.error(response.data.message);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Unable to resolve label');
    } finally {
      setBusy(false);
    }
  }

  async function adminAction(action: 'deactivate' | 'investigate' | 'replace') {
    const labelId = result?.label?.label_id;
    if (!labelId) return;
    const reason = window.prompt(`Reason to ${action} this label:`);
    if (!reason?.trim()) return;
    try {
      const updatedLabel =
        action === 'replace'
          ? (await api.inventory.replaceLabel(labelId, reason)).data[1]
          : action === 'deactivate'
            ? (await api.inventory.deactivateLabel(labelId, reason)).data
            : (await api.inventory.investigateLabel(labelId, reason)).data;
      setResult((current) =>
        current
          ? {
              ...current,
              label: updatedLabel,
              message: `Label ${action}d successfully.`,
            }
          : current,
      );
      toast.success(`Label ${action}d`);
    } catch {
      toast.error(`Unable to ${action} label`);
    }
  }

  const hierarchy = result?.hierarchy;
  const inventory = result?.inventory;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/inventory" aria-label="Back to inventory">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Scan inventory label</h1>
          <p className="text-sm text-muted-foreground">Resolve signed QR and barcode labels through the backend.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan or enter a label</CardTitle>
          <CardDescription>Camera access is optional. Codes are validated server-side before any record is shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label htmlFor="scan-location">Observed location (optional)</Label>
            <Input id="scan-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Warehouse, bay, or site" />
          </div>
          {busy ? <p className="text-sm text-muted-foreground">Resolving label…</p> : null}
          <InventoryLabelScanner onDetected={(payload) => void resolve(payload)} />
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {result.valid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  Scan result
                </CardTitle>
                <CardDescription>{result.message}</CardDescription>
              </div>
              <Badge variant={result.valid ? 'default' : 'destructive'}>{result.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {result.warnings?.length ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" /> Suspicious duplicate-use warnings
                </div>
                <ul className="list-disc pl-5">
                  {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
            {result.valid && inventory ? (
              <>
                <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Inventory</p><p className="font-medium">{inventory.name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Part number</p><p>{inventory.part_number || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Serial number</p><p className="font-mono">{result.label?.serial_number || '—'}</p></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current status</p>
                    <p>
                      {(() => {
                        const raw =
                          (inventory as { status_name?: string }).status_name ||
                          inventory.instance?.status_name;
                        return raw ? workflowStatusLabel(String(raw)) : '—';
                      })()}
                    </p>
                  </div>
                  <div><p className="text-xs text-muted-foreground">Label prints</p><p>{result.label?.print_count ?? 0}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Can permission={P.inventory_label_manage}>
                    <Button variant="outline" onClick={() => void adminAction('investigate')}>Investigate</Button>
                    <Button variant="outline" onClick={() => void adminAction('replace')}>Replace label</Button>
                    <Button variant="destructive" onClick={() => void adminAction('deactivate')}>Deactivate</Button>
                  </Can>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <HistorySection title="Stock and receipt history" entries={result.stock_history} />
                  <HistorySection title="Build and installation history" entries={result.build_history} />
                  <HistorySection title="Maintenance and service history" entries={result.maintenance_history} />
                  <HistorySection title="Ownership and location history" entries={result.ownership_location_history} />
                </div>
                <section className="space-y-2">
                  <h3 className="font-medium">Hierarchy</h3>
                  {!hierarchy ? <p className="text-sm text-muted-foreground">No installed hierarchy is linked to this stock item.</p> : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div><p className="mb-1 text-sm text-muted-foreground">Ancestors</p><pre className="overflow-x-auto rounded-md border bg-muted/20 p-2 text-xs">{JSON.stringify(hierarchy.ancestors, null, 2)}</pre></div>
                      <div><p className="mb-1 text-sm text-muted-foreground">Descendants</p><pre className="overflow-x-auto rounded-md border bg-muted/20 p-2 text-xs">{JSON.stringify(hierarchy.descendants, null, 2)}</pre></div>
                    </div>
                  )}
                </section>
                <HistorySection title="Label print history" entries={result.print_history as unknown as Record<string, unknown>[]} />
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
