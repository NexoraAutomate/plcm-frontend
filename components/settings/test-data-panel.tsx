'use client';

import { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsCard } from '@/components/settings/settings-card';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { useAuth } from '@/lib/auth-context';
import { inventory } from '@/lib/api';
import type { InventoryStockSeedResult } from '@/lib/models';

export type TestDataPanelProps = {
  embedded?: boolean;
};

const CONFIRM_PHRASE = 'SEED';

async function extractApiError(error: unknown, fallback: string): Promise<string> {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}

export function TestDataPanel({ embedded = false }: TestDataPanelProps) {
  const { hasAccess } = useAuth();
  const isAdmin = hasAccess(['Admin']);

  const [confirmText, setConfirmText] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastResult, setLastResult] = useState<InventoryStockSeedResult | null>(null);

  const canApply = confirmText === CONFIRM_PHRASE && !seeding && !previewing;

  async function handlePreview() {
    setPreviewing(true);
    try {
      const res = await inventory.seedTestStock({
        multiplier: 10,
        unit_cost: 10,
        location_room: 'R1',
        location_cabinet: 'C1',
        location_rack: 'R1',
        dry_run: true,
      });
      setLastResult(res.data);
      toast.success(
        `Preview: would add ${res.data.units_added} unit(s) across ${res.data.groups_processed} group(s)`
      );
    } catch (error) {
      toast.error(await extractApiError(error, 'Failed to preview stock seed'));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSeed() {
    if (!canApply) return;
    setSeeding(true);
    try {
      const res = await inventory.seedTestStock({
        multiplier: 10,
        unit_cost: 10,
        location_room: 'R1',
        location_cabinet: 'C1',
        location_rack: 'R1',
        dry_run: false,
        confirm: CONFIRM_PHRASE,
      });
      setLastResult(res.data);
      setConfirmText('');
      toast.success(
        `Seeded ${res.data.units_added} unit(s) across ${res.data.groups_processed} group(s)`
      );
    } catch (error) {
      toast.error(await extractApiError(error, 'Failed to seed inventory stock'));
    } finally {
      setSeeding(false);
    }
  }

  if (!isAdmin) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="Only Administrators can seed test inventory data."
      />
    );
  }

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test Data</h1>
          <p className="text-sm text-muted-foreground">
            Seed inventory stock for manual testing without hand-entering units
          </p>
        </div>
      )}

      <SettingsSection
        title="Seed inventory stock (10×)"
        description="Adds 10× the current quantity of each stocked catalog group in one run."
      >
        <SettingsCard>
          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Same part number and supplier original PN; serials continue from last used</li>
              <li>Location defaults to Room R1 / Cabinet C1 / Rack R1</li>
              <li>Unit cost and supplier quote cost default to 10</li>
              <li>No shelf-life expiry and no warranty</li>
              <li>Empty groups (quantity 0) are skipped</li>
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:max-w-xs sm:flex-1">
                <Label htmlFor="seed-confirm">Type {CONFIRM_PHRASE} to apply</Label>
                <Input
                  id="seed-confirm"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewing || seeding}
                >
                  {previewing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="mr-2 h-4 w-4" />
                  )}
                  Preview
                </Button>
                <Button type="button" onClick={handleSeed} disabled={!canApply}>
                  {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {seeding ? 'Seeding…' : 'Seed 10× stock'}
                </Button>
              </div>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {lastResult ? (
        <SettingsSection
          title={lastResult.dry_run ? 'Preview result' : 'Last seed result'}
          description={`Location ${lastResult.location} · unit/quote cost ${lastResult.unit_cost}`}
        >
          <SettingsCard>
            <p className="mb-3 text-sm text-muted-foreground">
              Processed {lastResult.groups_processed} · skipped {lastResult.groups_skipped} ·
              units {lastResult.dry_run ? 'would add' : 'added'} {lastResult.units_added}
            </p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Group</th>
                    <th className="px-3 py-2 font-medium">PN</th>
                    <th className="px-3 py-2 font-medium">Before</th>
                    <th className="px-3 py-2 font-medium">Added</th>
                    <th className="px-3 py-2 font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {lastResult.groups.map((group) => (
                    <tr key={group.inventory_id} className="border-t">
                      <td className="px-3 py-2">
                        #{group.inventory_id} {group.name}
                        {group.skipped_reason ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({group.skipped_reason})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{group.part_number || '—'}</td>
                      <td className="px-3 py-2">{group.previous_quantity}</td>
                      <td className="px-3 py-2">{group.units_added}</td>
                      <td className="px-3 py-2">{group.new_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SettingsCard>
        </SettingsSection>
      ) : null}
    </div>
  );
}
