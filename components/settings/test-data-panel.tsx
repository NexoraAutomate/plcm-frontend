'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FlaskConical, Loader2, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsCard } from '@/components/settings/settings-card';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { useAuth } from '@/lib/auth-context';
import { inventory, users } from '@/lib/api';
import type {
  InventorySeedCatalogOption,
  InventorySeedMissingShortage,
  InventoryStockSeedResult,
  WorkflowDemoUserOption,
  WorkflowDemoUserSeedResult,
} from '@/lib/models';

export type TestDataPanelProps = {
  embedded?: boolean;
};

const CONFIRM_PHRASE = 'SEED';
const SUPER_PASSWORD_STORAGE_KEY = 'satlife.test-data.super-password';

async function extractApiError(error: unknown, fallback: string): Promise<string> {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}

function shortageSelectionKey(item: InventorySeedMissingShortage): string {
  return `${item.inventory_type}|${item.lru_name}|${item.part_number || ''}|${item.shortage_ids.join(',')}`;
}

function readStoredSuperPassword(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(SUPER_PASSWORD_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredSuperPassword(value: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!value) sessionStorage.removeItem(SUPER_PASSWORD_STORAGE_KEY);
    else sessionStorage.setItem(SUPER_PASSWORD_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
}

export function TestDataPanel({ embedded = false }: TestDataPanelProps) {
  const { hasAccess } = useAuth();
  const isAdmin = hasAccess(['Admin']);

  const [superPassword, setSuperPassword] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [missingShortages, setMissingShortages] = useState<InventorySeedMissingShortage[]>(
    []
  );
  const [inventoryGroups, setInventoryGroups] = useState<InventorySeedCatalogOption[]>([]);
  const [selectedShortageKeys, setSelectedShortageKeys] = useState<Set<string>>(new Set());
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<Set<number>>(new Set());

  const [bootstrapMissing, setBootstrapMissing] = useState(true);
  const [multiplyStock, setMultiplyStock] = useState(true);
  const [multiplier, setMultiplier] = useState('10');
  const [unitCost, setUnitCost] = useState('10');
  const [locationRoom, setLocationRoom] = useState('R1');
  const [locationCabinet, setLocationCabinet] = useState('C1');
  const [locationRack, setLocationRack] = useState('R1');
  const [confirmText, setConfirmText] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [lastResult, setLastResult] = useState<InventoryStockSeedResult | null>(null);

  const [demoUsers, setDemoUsers] = useState<WorkflowDemoUserOption[]>([]);
  const [selectedDemoUsernames, setSelectedDemoUsernames] = useState<Set<string>>(
    new Set()
  );
  const [demoConfirmText, setDemoConfirmText] = useState('');
  const [demoPreviewing, setDemoPreviewing] = useState(false);
  const [demoSeeding, setDemoSeeding] = useState(false);
  const [lastDemoResult, setLastDemoResult] =
    useState<WorkflowDemoUserSeedResult | null>(null);

  const lockPanel = useCallback(() => {
    writeStoredSuperPassword(null);
    setSuperPassword('');
    setUnlockInput('');
    setUnlocked(false);
    setMissingShortages([]);
    setInventoryGroups([]);
    setDemoUsers([]);
    setSelectedShortageKeys(new Set());
    setSelectedInventoryIds(new Set());
    setSelectedDemoUsernames(new Set());
    setLastResult(null);
    setLastDemoResult(null);
  }, []);

  const loadOptions = useCallback(
    async (password: string) => {
      if (!password) return;
      setLoadingOptions(true);
      try {
        const [stockRes, demoRes] = await Promise.all([
          inventory.seedTestStockOptions(password),
          users.seedDemoRolesOptions(password),
        ]);
        const missing = stockRes.data.missing_shortages || [];
        const groups = stockRes.data.inventory_groups || [];
        const demo = demoRes.data.users || [];
        setMissingShortages(missing);
        setInventoryGroups(groups);
        setSelectedShortageKeys(new Set(missing.map(shortageSelectionKey)));
        setSelectedInventoryIds(
          new Set(groups.filter((group) => group.quantity > 0).map((group) => group.inventory_id))
        );
        setDemoUsers(demo);
        setSelectedDemoUsernames((prev) => {
          if (prev.size === 0) {
            return new Set(demo.map((item) => item.username));
          }
          const next = new Set<string>();
          for (const item of demo) {
            if (prev.has(item.username)) next.add(item.username);
          }
          return next.size > 0 ? next : new Set(demo.map((item) => item.username));
        });
      } catch (error) {
        const message = await extractApiError(error, 'Failed to load seed options');
        toast.error(message);
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 401 || error.response?.status === 403)
        ) {
          lockPanel();
        }
      } finally {
        setLoadingOptions(false);
      }
    },
    [lockPanel]
  );

  useEffect(() => {
    if (!isAdmin) return;
    const stored = readStoredSuperPassword();
    if (!stored) return;
    setSuperPassword(stored);
    setUnlocked(true);
    void loadOptions(stored);
  }, [isAdmin, loadOptions]);

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    const candidate = unlockInput.trim();
    if (!candidate) {
      toast.error('Enter the super password');
      return;
    }
    setUnlocking(true);
    try {
      await users.unlockTestData({ super_password: candidate });
      writeStoredSuperPassword(candidate);
      setSuperPassword(candidate);
      setUnlockInput('');
      setUnlocked(true);
      toast.success('Test Data unlocked');
      await loadOptions(candidate);
    } catch (error) {
      toast.error(await extractApiError(error, 'Invalid super password'));
      writeStoredSuperPassword(null);
      setSuperPassword('');
      setUnlocked(false);
    } finally {
      setUnlocking(false);
    }
  }

  const selectedShortageIds = useMemo(() => {
    const ids: number[] = [];
    for (const item of missingShortages) {
      if (selectedShortageKeys.has(shortageSelectionKey(item))) {
        ids.push(...item.shortage_ids);
      }
    }
    return ids;
  }, [missingShortages, selectedShortageKeys]);

  const selectedInventoryIdList = useMemo(
    () => Array.from(selectedInventoryIds),
    [selectedInventoryIds]
  );

  const multiplierValue = Number.parseInt(multiplier, 10);
  const unitCostValue = Number.parseFloat(unitCost);
  const willBootstrap = bootstrapMissing && selectedShortageIds.length > 0;
  const willMultiply = multiplyStock && selectedInventoryIdList.length > 0;
  const configValid =
    Number.isFinite(multiplierValue) &&
    multiplierValue >= 1 &&
    Number.isFinite(unitCostValue) &&
    unitCostValue >= 0 &&
    locationRoom.trim().length > 0 &&
    locationCabinet.trim().length > 0 &&
    locationRack.trim().length > 0 &&
    (willBootstrap || willMultiply);

  const canApply =
    confirmText === CONFIRM_PHRASE && !seeding && !previewing && configValid && !loadingOptions;

  function toggleShortageKey(key: string, checked: boolean) {
    setSelectedShortageKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleInventoryId(id: number, checked: boolean) {
    setSelectedInventoryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleDemoUsername(username: string, checked: boolean) {
    setSelectedDemoUsernames((prev) => {
      const next = new Set(prev);
      if (checked) next.add(username);
      else next.delete(username);
      return next;
    });
  }

  const selectedDemoUsernameList = useMemo(
    () => Array.from(selectedDemoUsernames),
    [selectedDemoUsernames]
  );

  const canApplyDemo =
    demoConfirmText === CONFIRM_PHRASE &&
    !demoSeeding &&
    !demoPreviewing &&
    !loadingOptions &&
    selectedDemoUsernameList.length > 0;

  function buildDemoPayload(dryRun: boolean) {
    const payload: Parameters<typeof users.seedDemoRoles>[0] = {
      usernames: selectedDemoUsernameList,
      dry_run: dryRun,
      super_password: superPassword,
    };
    if (!dryRun) {
      payload.confirm = CONFIRM_PHRASE;
    }
    return payload;
  }

  async function handleDemoPreview() {
    if (selectedDemoUsernameList.length === 0) {
      toast.error('Select at least one demo role');
      return;
    }
    setDemoPreviewing(true);
    try {
      const res = await users.seedDemoRoles(buildDemoPayload(true));
      setLastDemoResult(res.data);
      toast.success(
        `Preview: create ${res.data.created}, update ${res.data.updated}, skip ${res.data.skipped}`
      );
    } catch (error) {
      toast.error(await extractApiError(error, 'Failed to preview demo role seed'));
    } finally {
      setDemoPreviewing(false);
    }
  }

  async function handleDemoSeed() {
    if (!canApplyDemo) return;
    setDemoSeeding(true);
    try {
      const res = await users.seedDemoRoles(buildDemoPayload(false));
      setLastDemoResult(res.data);
      setDemoConfirmText('');
      toast.success(
        `Demo roles: created ${res.data.created}, updated ${res.data.updated}, skipped ${res.data.skipped}`
      );
      await loadOptions();
    } catch (error) {
      toast.error(await extractApiError(error, 'Failed to seed demo roles'));
    } finally {
      setDemoSeeding(false);
    }
  }

  function buildPayload(dryRun: boolean) {
    const payload: Parameters<typeof inventory.seedTestStock>[0] = {
      bootstrap_missing_shortages: willBootstrap,
      // Allow multiply-only of bootstrapped items in the same run even if the
      // inventory checklist was empty before refresh.
      multiply_stock: willMultiply || (willBootstrap && multiplyStock),
      multiplier: multiplierValue,
      unit_cost: unitCostValue,
      location_room: locationRoom.trim(),
      location_cabinet: locationCabinet.trim(),
      location_rack: locationRack.trim(),
      dry_run: dryRun,
      super_password: superPassword,
    };
    if (willBootstrap) {
      payload.shortage_ids = selectedShortageIds;
    }
    if (willMultiply) {
      payload.inventory_ids = selectedInventoryIdList;
    } else if (willBootstrap && multiplyStock) {
      // Multiply only the groups created/filled by this bootstrap pass.
      payload.inventory_ids = [];
    }
    if (!dryRun) {
      payload.confirm = CONFIRM_PHRASE;
    }
    return payload;
  }

  async function handlePreview() {
    if (!configValid) {
      toast.error('Choose at least one action and valid seed settings');
      return;
    }
    setPreviewing(true);
    try {
      const res = await inventory.seedTestStock(buildPayload(true));
      setLastResult(res.data);
      toast.success(
        `Preview: bootstrap +${res.data.bootstrap_units_added}, multiply +${res.data.units_added}`
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
      const res = await inventory.seedTestStock(buildPayload(false));
      setLastResult(res.data);
      setConfirmText('');
      toast.success(
        `Seeded: bootstrap +${res.data.bootstrap_units_added}, multiply +${res.data.units_added}`
      );
      await loadOptions();
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
        message="Only Administrators can seed test inventory data and demo roles."
      />
    );
  }

  if (!unlocked) {
    return (
      <div className="space-y-8">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Test Data</h1>
            <p className="text-sm text-muted-foreground">
              Additional super-password lock required before seeding tools are available
            </p>
          </div>
        )}
        <SettingsSection
          title="Unlock Test Data"
          description="Admin access alone is not enough. Enter the configured admin super password to continue."
        >
          <SettingsCard>
            <form className="mx-auto max-w-md space-y-4" onSubmit={handleUnlock}>
              <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This protects seed actions so not every Admin session can create demo users
                  or multiply inventory stock.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-data-super-password">Super password</Label>
                <Input
                  id="test-data-super-password"
                  type="password"
                  value={unlockInput}
                  onChange={(event) => setUnlockInput(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter super password"
                />
              </div>
              <Button type="submit" disabled={unlocking || !unlockInput.trim()}>
                {unlocking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {unlocking ? 'Unlocking…' : 'Unlock'}
              </Button>
            </form>
          </SettingsCard>
        </SettingsSection>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Test Data</h1>
          <p className="text-sm text-muted-foreground">
            Seed demo role users and inventory stock for manual test runs
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadOptions(superPassword)}
          disabled={
            loadingOptions || previewing || seeding || demoPreviewing || demoSeeding
          }
        >
          {loadingOptions ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh lists
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={lockPanel}>
          <Lock className="mr-2 h-4 w-4" />
          Lock
        </Button>
      </div>

      <SettingsSection
        title="1. Demo roles / users"
        description="Create or refresh Spec 00 workflow demo accounts (all or selected). Passwords reset to the cheat-sheet values."
      >
        <SettingsCard>
          <div className="space-y-4">
            {loadingOptions ? (
              <p className="text-sm text-muted-foreground">Loading demo roles…</p>
            ) : demoUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No demo role definitions found.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedDemoUsernames(new Set(demoUsers.map((item) => item.username)))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedDemoUsernames(
                        new Set(
                          demoUsers
                            .filter((item) => !item.exists)
                            .map((item) => item.username)
                        )
                      )
                    }
                  >
                    Missing only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDemoUsernames(new Set())}
                  >
                    Clear
                  </Button>
                  <span className="self-center text-xs text-muted-foreground">
                    {selectedDemoUsernames.size} of {demoUsers.length} selected
                  </span>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Include</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">Username</th>
                        <th className="px-3 py-2 font-medium">Password</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoUsers.map((item) => (
                        <tr key={item.username} className="border-t">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedDemoUsernames.has(item.username)}
                              onCheckedChange={(value) =>
                                toggleDemoUsername(item.username, value === true)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">{item.role}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.username}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.password}</td>
                          <td className="px-3 py-2">
                            {item.role_missing
                              ? 'Role missing'
                              : item.exists
                                ? item.is_active === false
                                  ? 'Exists (inactive)'
                                  : 'Exists'
                                : 'Missing'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-2 sm:max-w-xs sm:flex-1">
                    <Label htmlFor="demo-seed-confirm">
                      Type {CONFIRM_PHRASE} to apply demo roles
                    </Label>
                    <Input
                      id="demo-seed-confirm"
                      value={demoConfirmText}
                      onChange={(event) => setDemoConfirmText(event.target.value)}
                      placeholder={CONFIRM_PHRASE}
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleDemoPreview()}
                      disabled={
                        demoPreviewing ||
                        demoSeeding ||
                        selectedDemoUsernameList.length === 0
                      }
                    >
                      {demoPreviewing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FlaskConical className="mr-2 h-4 w-4" />
                      )}
                      Preview
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleDemoSeed()}
                      disabled={!canApplyDemo}
                    >
                      {demoSeeding ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {demoSeeding ? 'Seeding…' : 'Seed selected roles'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>

      {lastDemoResult ? (
        <SettingsSection
          title={lastDemoResult.dry_run ? 'Demo roles preview' : 'Last demo roles result'}
          description={`Created ${lastDemoResult.created} · updated ${lastDemoResult.updated} · skipped ${lastDemoResult.skipped}`}
        >
          <SettingsCard>
            <div className="max-h-48 overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Username</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lastDemoResult.items.map((item) => (
                    <tr key={`${item.username}-${item.action}`} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{item.username}</td>
                      <td className="px-3 py-2">{item.role}</td>
                      <td className="px-3 py-2">
                        {item.action}
                        {item.reason ? ` (${item.reason})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SettingsCard>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title="2. Missing shortage items → inventory (1 unit)"
        description="Active shortage catalog items not yet stocked. Adds a single AVAILABLE unit so they can be multiplied in the next tranche."
      >
        <SettingsCard>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={bootstrapMissing}
                onCheckedChange={(value) => setBootstrapMissing(value === true)}
              />
              Bootstrap selected missing shortage items as 1 unit each
            </label>

            {loadingOptions ? (
              <p className="text-sm text-muted-foreground">Loading shortage gaps…</p>
            ) : missingShortages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active shortages without inventory stock.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedShortageKeys(new Set(missingShortages.map(shortageSelectionKey)))
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedShortageKeys(new Set())}
                  >
                    Clear
                  </Button>
                  <span className="self-center text-xs text-muted-foreground">
                    {selectedShortageKeys.size} of {missingShortages.length} selected
                  </span>
                </div>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Include</th>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">PN</th>
                        <th className="px-3 py-2 font-medium">Qty short</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingShortages.map((item) => {
                        const key = shortageSelectionKey(item);
                        return (
                          <tr key={key} className="border-t">
                            <td className="px-3 py-2">
                              <Checkbox
                                checked={selectedShortageKeys.has(key)}
                                disabled={!bootstrapMissing}
                                onCheckedChange={(value) =>
                                  toggleShortageKey(key, value === true)
                                }
                              />
                            </td>
                            <td className="px-3 py-2">{item.lru_name}</td>
                            <td className="px-3 py-2">{item.inventory_type}</td>
                            <td className="px-3 py-2">{item.part_number || '—'}</td>
                            <td className="px-3 py-2">{item.qty_short_total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="3. Multiply selected inventory stock"
        description="User-defined multiplier over current quantity for the groups you select. Serials continue from last used; PN stays the same."
      >
        <SettingsCard>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={multiplyStock}
                onCheckedChange={(value) => setMultiplyStock(value === true)}
              />
              Multiply selected inventory groups
            </label>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="seed-multiplier">Multiplier</Label>
                <Input
                  id="seed-multiplier"
                  type="number"
                  min={1}
                  max={100}
                  value={multiplier}
                  onChange={(event) => setMultiplier(event.target.value)}
                  disabled={!multiplyStock}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed-unit-cost">Unit / quote cost</Label>
                <Input
                  id="seed-unit-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed-room">Room</Label>
                <Input
                  id="seed-room"
                  value={locationRoom}
                  onChange={(event) => setLocationRoom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed-cabinet">Cabinet</Label>
                <Input
                  id="seed-cabinet"
                  value={locationCabinet}
                  onChange={(event) => setLocationCabinet(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed-rack">Rack</Label>
                <Input
                  id="seed-rack"
                  value={locationRack}
                  onChange={(event) => setLocationRack(event.target.value)}
                />
              </div>
            </div>

            {loadingOptions ? (
              <p className="text-sm text-muted-foreground">Loading inventory groups…</p>
            ) : inventoryGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No inventory groups yet. Bootstrap shortage items first.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedInventoryIds(
                        new Set(inventoryGroups.map((group) => group.inventory_id))
                      )
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedInventoryIds(
                        new Set(
                          inventoryGroups
                            .filter((group) => group.quantity > 0)
                            .map((group) => group.inventory_id)
                        )
                      )
                    }
                  >
                    Stocked only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedInventoryIds(new Set())}
                  >
                    Clear
                  </Button>
                  <span className="self-center text-xs text-muted-foreground">
                    {selectedInventoryIds.size} of {inventoryGroups.length} selected
                  </span>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Include</th>
                        <th className="px-3 py-2 font-medium">Group</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">PN</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">After ×N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryGroups.map((group) => {
                        const after =
                          multiplyStock &&
                          selectedInventoryIds.has(group.inventory_id) &&
                          group.quantity > 0 &&
                          Number.isFinite(multiplierValue)
                            ? group.quantity + group.quantity * multiplierValue
                            : group.quantity;
                        return (
                          <tr key={group.inventory_id} className="border-t">
                            <td className="px-3 py-2">
                              <Checkbox
                                checked={selectedInventoryIds.has(group.inventory_id)}
                                disabled={!multiplyStock}
                                onCheckedChange={(value) =>
                                  toggleInventoryId(group.inventory_id, value === true)
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              #{group.inventory_id} {group.name}
                            </td>
                            <td className="px-3 py-2">{group.inventory_type}</td>
                            <td className="px-3 py-2">{group.part_number || '—'}</td>
                            <td className="px-3 py-2">{group.quantity}</td>
                            <td className="px-3 py-2">{after}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="4. Apply inventory seed"
        description="No shelf life / warranty. Serials increment from last used. Type SEED to confirm."
      >
        <SettingsCard>
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
                disabled={previewing || seeding || !configValid}
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
                {seeding ? 'Seeding…' : 'Apply seed'}
              </Button>
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
              Bootstrap created {lastResult.bootstrap_created_groups} group(s), added{' '}
              {lastResult.bootstrap_units_added} unit(s), skipped {lastResult.bootstrap_skipped}.
              Multiply processed {lastResult.groups_processed}, skipped {lastResult.groups_skipped},
              units {lastResult.dry_run ? 'would add' : 'added'} {lastResult.units_added}.
            </p>

            {lastResult.bootstrap_items.length > 0 ? (
              <div className="mb-4 max-h-48 overflow-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Shortage item</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                      <th className="px-3 py-2 font-medium">Inventory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastResult.bootstrap_items.map((item, index) => (
                      <tr key={`${item.lru_name}-${index}`} className="border-t">
                        <td className="px-3 py-2">{item.lru_name}</td>
                        <td className="px-3 py-2">{item.inventory_type}</td>
                        <td className="px-3 py-2">
                          {item.action}
                          {item.reason ? ` (${item.reason})` : ''}
                        </td>
                        <td className="px-3 py-2">
                          {item.inventory_id != null ? `#${item.inventory_id}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {lastResult.groups.length > 0 ? (
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
            ) : null}
          </SettingsCard>
        </SettingsSection>
      ) : null}
    </div>
  );
}
