'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type {
  ConfigChangeRequest,
  HierarchyConfigurationSummary,
  Project,
} from '@/lib/models';
import { ConfigChangeRequestStatus } from '@/lib/models';
import {
  CONFIG_CHANGE_STEPS,
  canCancelConfigChange,
  canRequestConfigChange,
  configChangeStepIndex,
} from '@/lib/config-change';
import { cn } from '@/lib/utils';

type Props = {
  project: Project;
  onUpdated: (project: Project) => void;
  onConfigChange?: (change: ConfigChangeRequest | null) => void;
  /** When true, render without the embedded card chrome (dedicated page). */
  asPage?: boolean;
};

function apiError(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export function ConfigChangeWizard({
  project,
  onUpdated,
  onConfigChange,
  asPage = false,
}: Props) {
  const router = useRouter();
  const [change, setChange] = useState<ConfigChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configs, setConfigs] = useState<HierarchyConfigurationSummary[]>([]);
  const [targetConfigId, setTargetConfigId] = useState<string>('');
  const [productType, setProductType] = useState('');
  const [reason, setReason] = useState('');
  const [newName, setNewName] = useState(`${project.name} (config change)`);
  const [flightCount, setFlightCount] = useState(String(project.flight_count ?? 1));
  const [sdlsPerFlight, setSdlsPerFlight] = useState(
    String(project.sdls_per_flight ?? 1)
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await api.projects.getConfigChange(project.id);
      const row = res.data ?? null;
      setChange(row);
      onConfigChange?.(row);
      if (opts?.silent) return;
      if (row?.target_hierarchy_config_id) {
        setTargetConfigId(String(row.target_hierarchy_config_id));
      }
      if (row?.target_product_type) setProductType(row.target_product_type);
      if (row?.reason_remarks) setReason(row.reason_remarks);
      if (row?.target_flight_count) setFlightCount(String(row.target_flight_count));
      if (row?.target_sdls_per_flight) {
        setSdlsPerFlight(String(row.target_sdls_per_flight));
      }
    } catch {
      setChange(null);
      onConfigChange?.(null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [onConfigChange, project.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.hierarchyConfigurations
      .listAvailable()
      .then((res) => setConfigs(res.data ?? []))
      .catch(() => setConfigs([]));
  }, []);

  const status = change?.status ?? '';
  const cleared = Boolean(change?.inventory_cleared);
  const currentStep = configChangeStepIndex(status, cleared);
  const preview = change?.inventory_preview;
  const canStart = canRequestConfigChange(project.status_name) && !change;
  const selectedConfig = configs.find((c) => String(c.id) === targetConfigId);
  const productTypes = selectedConfig?.product_type_codes ?? [];

  useEffect(() => {
    if (!selectedConfig) return;
    const codes = selectedConfig.product_type_codes ?? [];
    setProductType((current) => {
      if (current && codes.includes(current)) return current;
      if (project.product_type && codes.includes(project.product_type)) {
        return project.product_type;
      }
      return codes[0] || '';
    });
  }, [selectedConfig, project.product_type]);

  useEffect(() => {
    const waitingOnInspect =
      change?.status === ConfigChangeRequestStatus.REQUESTED &&
      !change.inventory_cleared;
    if (!waitingOnInspect) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, 12_000);
    return () => window.clearInterval(id);
  }, [change?.status, change?.inventory_cleared, load]);

  async function handleRequest() {
    setBusy(true);
    try {
      const res = await api.projects.requestConfigChange(project.id);
      setChange(res.data);
      onConfigChange?.(res.data);
      if (res.data.project) onUpdated(res.data.project);
      toast.success('Configuration change requested');
    } catch (error: unknown) {
      toast.error(apiError(error, 'Request failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelChange() {
    if (!change) return;
    setBusy(true);
    try {
      await api.configChanges.cancel(change.id);
      setChange(null);
      onConfigChange?.(null);
      setTargetConfigId('');
      setProductType('');
      setReason('');
      toast.success('Configuration change cancelled — you can reserve inventory again');
    } catch (error: unknown) {
      toast.error(apiError(error, 'Cancel failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    if (!change) return;
    setBusy(true);
    try {
      const res = await api.configChanges.returnInventory(change.id);
      setChange(res.data);
      onConfigChange?.(res.data);
      if (res.data.project) onUpdated(res.data.project);
      toast.success('Inventory return started — IM inspects remaining units');
    } catch (error: unknown) {
      toast.error(apiError(error, 'Return inventory failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!change || !targetConfigId || !productType || !reason.trim()) {
      toast.error('Select a target configuration, product type, and enter a reason');
      return;
    }
    setBusy(true);
    try {
      const res = await api.configChanges.submit(change.id, {
        target_hierarchy_config_id: Number(targetConfigId),
        reason_remarks: reason.trim(),
        product_type: productType || undefined,
        flight_count: Number(flightCount) || undefined,
        sdls_per_flight: Number(sdlsPerFlight) || undefined,
      });
      setChange(res.data);
      onConfigChange?.(res.data);
      toast.success('Change request submitted for Admin approval');
    } catch (error: unknown) {
      toast.error(apiError(error, 'Submit failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!change) return;
    setBusy(true);
    try {
      const res = await api.configChanges.approve(change.id);
      setChange(res.data);
      onConfigChange?.(res.data);
      toast.success('Configuration change approved');
    } catch (error: unknown) {
      toast.error(apiError(error, 'Approve failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!change) return;
    setBusy(true);
    try {
      const res = await api.configChanges.createProject(change.id, {
        name: newName.trim() || undefined,
        product_type: productType || undefined,
        flight_count: Number(flightCount) || undefined,
        sdls_per_flight: Number(sdlsPerFlight) || undefined,
      });
      setChange(res.data.change);
      onConfigChange?.(res.data.change);
      if (res.data.change.project) onUpdated(res.data.change.project);
      toast.success('New draft project created');
      const nextId = res.data.project?.id ?? res.data.change.successor_project_id;
      if (nextId) router.push(`/projects/${nextId}`);
    } catch (error: unknown) {
      toast.error(apiError(error, 'Create project failed'));
    } finally {
      setBusy(false);
    }
  }

  if (!canStart && !change && !loading) {
    if (!asPage) return null;
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Configuration change is only available while this project is{' '}
        <strong>Approved</strong> and before hierarchy is generated. After Generate
        Hierarchy, use a new project flow if the configuration must change.
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', !asPage && 'rounded-lg border p-4')}>
      {!asPage ? (
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Configuration change</h3>
            <p className="text-xs text-muted-foreground">
              CC-1 … CC-6 — new Project/Flight, not an in-place edit.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void load()}
            disabled={busy}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={busy}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      )}

      <ol className="space-y-0">
        {CONFIG_CHANGE_STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > stepNumber || (currentStep === 3 && stepNumber <= 3 && cleared);
          const isCurrent = currentStep === stepNumber || (currentStep === 1 && stepNumber === 2 && !cleared && status === ConfigChangeRequestStatus.REQUESTED);
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs',
                    isCompleted &&
                      'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950',
                    isCurrent && 'border-primary bg-primary/10 text-primary',
                    !isCompleted && !isCurrent && 'border-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                </div>
                {index < CONFIG_CHANGE_STEPS.length - 1 ? (
                  <div
                    className={cn(
                      'my-1 h-5 w-0.5',
                      isCompleted ? 'bg-emerald-500' : 'bg-border'
                    )}
                  />
                ) : null}
              </div>
              <div className="pb-3 pt-0.5">
                <p className="text-sm font-medium">
                  {step.key} {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {preview ? (
        <p className="text-xs text-muted-foreground">
          Inventory: {preview.reserved_count} reserved · {preview.recall_units_total}{' '}
          to recall · {preview.shortage_count} shortages
          {cleared ? ' — cleared' : ''}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Can permission={P.config_change_request}>
          {canStart ? (
            <Button onClick={() => void handleRequest()} disabled={busy}>
              <GitBranch className="mr-1.5 h-4 w-4" />
              Request configuration change
            </Button>
          ) : null}
          {status === ConfigChangeRequestStatus.REQUESTED && !cleared ? (
            <Button onClick={() => void handleReturn()} disabled={busy}>
              Return all inventory
            </Button>
          ) : null}
          {canCancelConfigChange(status) &&
          status !== ConfigChangeRequestStatus.INVENTORY_RETURNED ? (
            <Button
              variant="outline"
              onClick={() => void handleCancelChange()}
              disabled={busy}
            >
              Cancel configuration change
            </Button>
          ) : null}
        </Can>
        {status === ConfigChangeRequestStatus.REQUESTED && !cleared ? (
          <Button variant="outline" asChild>
            <a href="/inspect-queue">Open inspect queue</a>
          </Button>
        ) : null}
      </div>

      {status === ConfigChangeRequestStatus.INVENTORY_RETURNED ||
      status === ConfigChangeRequestStatus.SUBMITTED ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Target approved configuration</Label>
            <Select
              value={targetConfigId}
              onValueChange={(id) => {
                setTargetConfigId(id);
                setProductType('');
              }}
              disabled={busy || status === ConfigChangeRequestStatus.SUBMITTED}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select configuration" />
              </SelectTrigger>
              <SelectContent>
                {configs
                  .filter((c) => c.id !== project.hierarchy_config_id)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Product type *</Label>
            <Select
              value={productType}
              onValueChange={setProductType}
              disabled={
                busy ||
                !targetConfigId ||
                status === ConfigChangeRequestStatus.SUBMITTED
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="SSDLS-1 / SSDLS-2" />
              </SelectTrigger>
              <SelectContent>
                {productTypes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Reason remarks</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy || status === ConfigChangeRequestStatus.SUBMITTED}
              rows={3}
            />
          </div>
          <Can permission={P.config_change_request}>
            {status === ConfigChangeRequestStatus.INVENTORY_RETURNED ? (
              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={busy || !targetConfigId || !productType}
                >
                  Submit change request
                </Button>
                {canCancelConfigChange(status) ? (
                  <Button
                    variant="outline"
                    onClick={() => void handleCancelChange()}
                    disabled={busy}
                  >
                    Cancel configuration change
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Can>
        </div>
      ) : null}

      <Can permission={P.config_change_approve}>
        {status === ConfigChangeRequestStatus.SUBMITTED ? (
          <Button onClick={() => void handleApprove()} disabled={busy || !cleared}>
            Approve configuration change
          </Button>
        ) : null}
      </Can>

      {status === ConfigChangeRequestStatus.APPROVED ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>New project name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label>Flights</Label>
            <Input
              type="number"
              min={1}
              value={flightCount}
              onChange={(e) => setFlightCount(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1">
            <Label>SDLS per flight</Label>
            <Input
              type="number"
              min={1}
              value={sdlsPerFlight}
              onChange={(e) => setSdlsPerFlight(e.target.value)}
              disabled={busy}
            />
          </div>
          <Can permission={P.config_change_request}>
            <Button onClick={() => void handleCreate()} disabled={busy}>
              Create new Project / Flight
            </Button>
          </Can>
        </div>
      ) : null}

      {status === ConfigChangeRequestStatus.NEW_PROJECT_CREATED &&
      change?.successor_project_id ? (
        <Button variant="outline" asChild>
          <a href={`/projects/${change.successor_project_id}`}>
            Open successor project #{change.successor_project_id}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
