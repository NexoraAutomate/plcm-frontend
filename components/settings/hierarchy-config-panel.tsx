'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  GitBranch,
  Maximize2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsCard } from '@/components/settings/settings-card';
import { HierarchyTemplateEditor } from '@/components/settings/hierarchy-template-editor';
import { HierarchyConfigTreeEditor } from '@/components/settings/hierarchy-config-tree-editor';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { Can } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePageDataRefresh } from '@/components/page-data-refresh';
import * as api from '@/lib/api';
import type {
  HierarchyConfigNode,
  HierarchyConfigProductType,
  HierarchyConfiguration,
  HierarchyConfigurationWrite,
} from '@/lib/models';
import {
  DEFAULT_PRODUCT_TYPES,
  TEMPLATE_NODE_LEVELS,
  newClientKey,
  normalizeInventorySource,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';
import { isEntityAssigned } from '@/lib/config-tree-layout';

export type HierarchyConfigPanelProps = {
  embedded?: boolean;
  readOnly?: boolean;
};

type Draft = HierarchyConfigurationWrite & { id?: number };

const TEMPLATE_LEVEL_SET = new Set<string>(TEMPLATE_NODE_LEVELS);
const CONFIG_PAGE_SIZE = 10;

function normalizeConfigName(name: string): string {
  return name.trim().toLowerCase();
}

/** True when another saved configuration already uses this name (case-insensitive). */
function isConfigNameTaken(
  configs: HierarchyConfiguration[],
  name: string,
  excludeId?: number
): boolean {
  const needle = normalizeConfigName(name);
  if (!needle) return false;
  return configs.some(
    (c) =>
      c.id !== excludeId && normalizeConfigName(c.name) === needle
  );
}

/** Suggest a unique name like "Foo (copy)", "Foo (copy 2)", … */
function uniqueCopyName(
  configs: HierarchyConfiguration[],
  baseName: string
): string {
  const base = baseName.trim() || 'Configuration';
  let candidate = `${base} (copy)`;
  let n = 2;
  while (isConfigNameTaken(configs, candidate)) {
    candidate = `${base} (copy ${n})`;
    n += 1;
  }
  return candidate;
}

function slugCodeFromName(name: string): string {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || `CONFIG-${Date.now().toString(36).toUpperCase()}`;
}

/** Stable snapshot for dirty-checking (ignores auto-generated code until save). */
function draftFingerprint(draft: Draft): string {
  return JSON.stringify({
    id: draft.id ?? null,
    name: (draft.name ?? '').trim(),
    description: (draft.description ?? '').trim(),
    is_available: draft.is_available ?? true,
    nodes: (draft.nodes ?? []).map((n) => ({
      client_key: n.client_key,
      parent_client_key: n.parent_client_key ?? null,
      level: n.level,
      name: (n.name ?? '').trim(),
      description: n.description ?? null,
      abbreviation: n.abbreviation ?? null,
      sort_order: n.sort_order ?? 0,
      inventory_source: normalizeInventorySource(n.inventory_source),
    })),
  });
}

function emptyDraft(): Draft {
  return {
    code: '',
    name: '',
    description: '',
    notes: null,
    is_available: true,
    product_types: DEFAULT_PRODUCT_TYPES.map((pt, index) => ({
      code: pt.code,
      name: pt.name,
      description: pt.description,
      sort_order: index,
    })),
    nodes: [],
  };
}

function toDraft(config: HierarchyConfiguration): Draft {
  return {
    id: config.id,
    code: config.code,
    name: config.name,
    description: config.description ?? '',
    notes: null,
    is_available: config.is_available,
    product_types: config.product_types.map((pt, index) => ({
      code: pt.code,
      name: pt.name,
      description: pt.description,
      sort_order: pt.sort_order ?? index,
    })),
    nodes: config.nodes.map((n, index) => ({
      client_key: n.client_key,
      parent_client_key: n.parent_client_key ?? null,
      level: n.level,
      name: n.name,
      description: n.description,
      abbreviation: n.abbreviation,
      sort_order: n.sort_order ?? index,
      inventory_source: normalizeInventorySource(n.inventory_source),
    })),
  };
}

function draftToExportPayload(draft: Draft): HierarchyConfigurationWrite {
  const productTypes = (
    draft.product_types.some((pt) => pt.code.trim())
      ? draft.product_types
      : DEFAULT_PRODUCT_TYPES.map((pt, index) => ({
          code: pt.code,
          name: pt.name,
          description: pt.description,
          sort_order: index,
        }))
  )
    .filter((pt) => pt.code.trim())
    .map((pt, index) => ({
      code: pt.code.trim(),
      name: pt.name.trim() || pt.code.trim(),
      description: pt.description ?? null,
      sort_order: index,
    }));

  return {
    code: draft.code.trim() || slugCodeFromName(draft.name),
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
    notes: null,
    is_available: draft.is_available ?? true,
    product_types: productTypes,
    nodes: (draft.nodes ?? []).map((n, index) => ({
      client_key: n.client_key,
      parent_client_key: n.parent_client_key ?? null,
      level: n.level,
      name: n.name.trim(),
      description: n.description ?? null,
      abbreviation: n.abbreviation ?? null,
      sort_order: index,
      inventory_source: normalizeInventorySource(n.inventory_source),
    })),
  };
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseConfigJson(parsed: unknown): HierarchyConfigurationWrite {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must be a configuration object.');
  }
  const raw = parsed as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    throw new Error('JSON must include a non-empty "name".');
  }
  const code =
    typeof raw.code === 'string' && raw.code.trim()
      ? raw.code.trim()
      : slugCodeFromName(name);

  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes: HierarchyConfigNode[] = rawNodes.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Node at index ${index} must be an object.`);
    }
    const node = item as Record<string, unknown>;
    const level = typeof node.level === 'string' ? node.level.trim().toLowerCase() : '';
    const nodeName = typeof node.name === 'string' ? node.name.trim() : '';
    if (!TEMPLATE_LEVEL_SET.has(level)) {
      throw new Error(
        `Node ${index}: invalid level "${level}". Expected one of: ${TEMPLATE_NODE_LEVELS.join(', ')}.`
      );
    }
    if (!nodeName) {
      throw new Error(`Node ${index}: name is required.`);
    }
    const clientKey =
      typeof node.client_key === 'string' && node.client_key.trim()
        ? node.client_key.trim()
        : newClientKey(level.slice(0, 3));
    return {
      client_key: clientKey,
      parent_client_key:
        typeof node.parent_client_key === 'string' && node.parent_client_key.trim()
          ? node.parent_client_key.trim()
          : null,
      level,
      name: nodeName,
      description: typeof node.description === 'string' ? node.description : null,
      abbreviation: typeof node.abbreviation === 'string' ? node.abbreviation : null,
      sort_order: typeof node.sort_order === 'number' ? node.sort_order : index,
      inventory_source: normalizeInventorySource(
        typeof node.inventory_source === 'string' ? node.inventory_source : null
      ),
    };
  });

  let productTypes: HierarchyConfigProductType[] = [];
  if (Array.isArray(raw.product_types) && raw.product_types.length > 0) {
    productTypes = raw.product_types.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Product type at index ${index} must be an object.`);
      }
      const pt = item as Record<string, unknown>;
      const ptCode = typeof pt.code === 'string' ? pt.code.trim() : '';
      if (!ptCode) throw new Error(`Product type ${index}: code is required.`);
      return {
        code: ptCode,
        name: typeof pt.name === 'string' && pt.name.trim() ? pt.name.trim() : ptCode,
        description: typeof pt.description === 'string' ? pt.description : null,
        sort_order: typeof pt.sort_order === 'number' ? pt.sort_order : index,
      };
    });
  } else {
    productTypes = DEFAULT_PRODUCT_TYPES.map((pt, index) => ({
      code: pt.code,
      name: pt.name,
      description: pt.description,
      sort_order: index,
    }));
  }

  return {
    code,
    name,
    description: typeof raw.description === 'string' ? raw.description : null,
    notes: null,
    is_available: typeof raw.is_available === 'boolean' ? raw.is_available : true,
    product_types: productTypes,
    nodes,
  };
}

export function HierarchyConfigPanel({
  embedded: _embedded = false,
  readOnly = false,
}: HierarchyConfigPanelProps) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can(P.hierarchy_config_manage) && !readOnly;
  const canListAll = can(P.hierarchy_config_manage);
  const [configs, setConfigs] = useState<HierarchyConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [listRefreshing, setListRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [baselineFingerprint, setBaselineFingerprint] = useState(() =>
    draftFingerprint(emptyDraft())
  );
  const [editorKey, setEditorKey] = useState(0);
  const [treeFullscreenSignal, setTreeFullscreenSignal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<HierarchyConfiguration | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateDescription, setDuplicateDescription] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(0);
  const listImportInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true;
    if (quiet) setListRefreshing(true);
    else setLoading(true);
    try {
      const res = canListAll
        ? await api.hierarchyConfigurations.list()
        : await Promise.all(
            (await api.hierarchyConfigurations.listAvailable()).data.map((summary) =>
              api.hierarchyConfigurations.get(summary.id)
            )
          ).then((results) => ({ data: results.map((r) => r.data) }));
      setConfigs(res.data ?? []);
    } catch {
      toast.error('Failed to load hierarchy configurations');
    } finally {
      if (quiet) setListRefreshing(false);
      else setLoading(false);
    }
  }, [canListAll]);

  const refreshPageData = useCallback(() => load({ quiet: true }), [load]);

  usePageDataRefresh(refreshPageData);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredConfigs = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return configs;
    return configs.filter((config) => {
      const haystack = [
        config.name,
        config.code,
        config.description ?? '',
        ...(config.product_types ?? []).flatMap((pt) => [pt.code, pt.name]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [configs, debouncedSearch]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredConfigs.length / CONFIG_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedConfigs = filteredConfigs.slice(
    safePage * CONFIG_PAGE_SIZE,
    (safePage + 1) * CONFIG_PAGE_SIZE
  );
  const rangeStart = filteredConfigs.length === 0 ? 0 : safePage * CONFIG_PAGE_SIZE + 1;
  const rangeEnd = Math.min((safePage + 1) * CONFIG_PAGE_SIZE, filteredConfigs.length);
  const rangeLabel = filteredConfigs.length === 0 ? '0' : `${rangeStart}–${rangeEnd}`;

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function openCreate() {
    const next = emptyDraft();
    setDraft(next);
    setBaselineFingerprint(draftFingerprint(next));
    setEditorKey((k) => k + 1);
    setEditing(true);
  }

  function openEdit(config: HierarchyConfiguration) {
    const next = toDraft(config);
    setDraft(next);
    setBaselineFingerprint(draftFingerprint(next));
    setEditorKey((k) => k + 1);
    setEditing(true);
  }

  function setDraftNodes(next: TemplateDraftNode[]) {
    setDraft((prev) => ({
      ...prev,
      nodes: next.map((n, index) => ({
        ...n,
        sort_order: index,
      })),
    }));
  }

  async function handleSave(input?: {
    name?: string;
    description?: string;
  }): Promise<boolean> {
    const name = (input?.name ?? draft.name).trim();
    const description =
      input?.description !== undefined
        ? input.description.trim()
        : (draft.description ?? '').trim();

    if (!name) {
      toast.error('Configuration name is required');
      return false;
    }
    if (isConfigNameTaken(configs, name, draft.id)) {
      toast.error(`Configuration name “${name}” already exists`);
      return false;
    }
    if ((draft.nodes ?? []).length === 0) {
      toast.error('Add at least one hierarchy node before saving');
      return false;
    }
    const unassigned = (draft.nodes ?? []).filter((n) => !isEntityAssigned(n));
    if (unassigned.length > 0) {
      toast.error(
        `Assign an entity to every node before saving (${unassigned.length} unassigned)`
      );
      return false;
    }

    const withMeta: Draft = {
      ...draft,
      name,
      description,
    };
    const payload = draftToExportPayload(withMeta);

    setSaving(true);
    try {
      if (draft.id) {
        const res = await api.hierarchyConfigurations.update(draft.id, payload);
        const next = toDraft(res.data);
        setDraft(next);
        setBaselineFingerprint(draftFingerprint(next));
        toast.success('Configuration saved');
      } else {
        const res = await api.hierarchyConfigurations.create(payload);
        const next = toDraft(res.data);
        setDraft(next);
        setBaselineFingerprint(draftFingerprint(next));
        toast.success('Configuration saved');
      }
      await load();
      return true;
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Failed to save configuration';
      toast.error(typeof detail === 'string' ? detail : 'Failed to save configuration');
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Duplicate current tree as a new HM-available configuration under a new name. */
  async function handleDuplicate(input: {
    name: string;
    description: string;
  }): Promise<boolean> {
    const name = input.name.trim();
    if (!name) {
      toast.error('Configuration name is required');
      return false;
    }
    if (isConfigNameTaken(configs, name)) {
      toast.error(`Configuration name “${name}” already exists`);
      return false;
    }
    if ((draft.nodes ?? []).length === 0) {
      toast.error('Add at least one hierarchy node before duplicating');
      return false;
    }
    const unassigned = (draft.nodes ?? []).filter((n) => !isEntityAssigned(n));
    if (unassigned.length > 0) {
      toast.error(
        `Assign an entity to every node before duplicating (${unassigned.length} unassigned)`
      );
      return false;
    }

    const named: Draft = {
      ...draft,
      id: undefined,
      name,
      description: input.description.trim() || (draft.description ?? ''),
      code: '',
      is_available: true,
    };
    const payload = draftToExportPayload(named);

    setSaving(true);
    try {
      const res = await api.hierarchyConfigurations.create(payload);
      const next = toDraft(res.data);
      setDraft(next);
      setBaselineFingerprint(draftFingerprint(next));
      setEditorKey((k) => k + 1);
      toast.success('Configuration duplicated and available for HM');
      await load({ quiet: true });
      return true;
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Failed to duplicate configuration';
      toast.error(typeof detail === 'string' ? detail : 'Failed to duplicate configuration');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateFromList(config: HierarchyConfiguration) {
    const next = toDraft(config);
    next.id = undefined;
    next.code = '';
    next.name = uniqueCopyName(configs, config.name);
    next.is_available = true;
    setBaselineFingerprint(draftFingerprint(emptyDraft()));
    setDraft(next);
    setEditorKey((k) => k + 1);
    setEditing(true);
    toast.message('Duplicated draft ready — rename if needed, then Save');
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['hierarchies'] });
      if (draft.id) {
        const res = await api.hierarchyConfigurations.get(draft.id);
        const next = toDraft(res.data);
        setDraft(next);
        setBaselineFingerprint(draftFingerprint(next));
        toast.success('Configuration reloaded');
      } else {
        await load({ quiet: true });
        toast.success('Refreshed');
      }
      setEditorKey((k) => k + 1);
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  function handleExportJson(source?: Draft | HierarchyConfiguration) {
    const isSavedConfig =
      source != null &&
      'version' in source &&
      typeof (source as HierarchyConfiguration).version === 'number';
    const payload = isSavedConfig
      ? draftToExportPayload(toDraft(source as HierarchyConfiguration))
      : draftToExportPayload((source as Draft | undefined) ?? draft);
    const code = payload.code || 'configuration';
    downloadJson(payload, `${code.replace(/[^\w.-]+/g, '_')}.json`);
    toast.success('Configuration exported as JSON');
  }

  function applyImportedPayload(payload: HierarchyConfigurationWrite, keepId?: number) {
    const next: Draft = {
      ...(keepId ? { id: keepId } : {}),
      ...payload,
    };
    setBaselineFingerprint(
      keepId ? draftFingerprint(draft) : draftFingerprint(emptyDraft())
    );
    setDraft(next);
    setEditorKey((k) => k + 1);
    setEditing(true);
    toast.success(
      `Loaded ${payload.nodes.length} node${payload.nodes.length === 1 ? '' : 's'} from JSON`
    );
  }

  async function handleImportFile(
    event: ChangeEvent<HTMLInputElement>,
    options?: { keepCurrentId?: boolean }
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error('Invalid JSON file');
        return;
      }
      const payload = parseConfigJson(parsed);
      applyImportedPayload(payload, options?.keepCurrentId ? draft.id : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import JSON');
    }
  }

  async function toggleAvailable(config: HierarchyConfiguration, next: boolean) {
    try {
      await api.hierarchyConfigurations.setAvailable(config.id, next);
      toast.success(next ? 'Marked available for HM' : 'Marked unavailable');
      await load({ quiet: true });
    } catch {
      toast.error('Failed to update availability');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.hierarchyConfigurations.remove(deleteTarget.id, true);
      toast.success('Configuration deleted');
      setDeleteTarget(null);
      await load({ quiet: true });
    } catch {
      toast.error('Failed to delete configuration');
    }
  }

  const draftNodes = (draft.nodes ?? []).map((n, index) => ({
    client_key: n.client_key,
    parent_client_key: n.parent_client_key ?? null,
    level: n.level as TemplateNodeLevel,
    name: n.name,
    description: n.description,
    abbreviation: n.abbreviation,
    sort_order: n.sort_order ?? index,
    inventory_source: normalizeInventorySource(n.inventory_source),
  }));

  const isDirty = draftFingerprint(draft) !== baselineFingerprint;
  const unassignedCount = draftNodes.filter((n) => !isEntityAssigned(n)).length;
  const allEntitiesAssigned =
    draftNodes.length > 0 && unassignedCount === 0;
  const nameTaken = isConfigNameTaken(configs, draft.name, draft.id);
  const canSave =
    canManage &&
    isDirty &&
    Boolean(draft.name.trim()) &&
    !nameTaken &&
    allEntitiesAssigned;

  if (editing) {
    return (
      <>
      <SettingsSection
        title={draft.id ? 'Edit configuration' : 'New configuration'}
        description="System → Component template shared by every SDLS."
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to list
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={saving || refreshing}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !canSave}
                title={
                  nameTaken
                    ? 'Configuration name already exists'
                    : !allEntitiesAssigned
                      ? unassignedCount > 0
                        ? `Assign entities to all nodes (${unassignedCount} left)`
                        : 'Add hierarchy nodes first'
                      : !draft.name.trim()
                        ? 'Enter a configuration name'
                        : !isDirty
                          ? 'No changes to save'
                          : undefined
                }
              >
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
            {canManage && draft.id ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving || !allEntitiesAssigned}
                title={
                  !allEntitiesAssigned
                    ? 'Assign entities to all nodes before duplicating'
                    : 'Duplicate as a new configuration'
                }
                onClick={() => {
                  setDuplicateName(
                    uniqueCopyName(configs, draft.name || 'Configuration')
                  );
                  setDuplicateDescription((draft.description ?? '').trim());
                  setDuplicateDialogOpen(true);
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Duplicate
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => setTreeFullscreenSignal((n) => n + 1)}
          >
            <Maximize2 className="mr-1.5 h-4 w-4" />
            Tree builder
          </Button>
        </div>

        <SettingsCard title="Configuration details">
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cfg-name">Configuration name</Label>
              <Input
                id="cfg-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. High Data Rate Standard"
                disabled={!canManage}
                aria-invalid={nameTaken}
              />
              {nameTaken ? (
                <p className="text-xs text-destructive">
                  Another configuration already uses this name.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-desc">Description</Label>
              <Input
                id="cfg-desc"
                value={draft.description ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                disabled={!canManage}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={!!draft.is_available}
                onCheckedChange={(checked) =>
                  setDraft((d) => ({ ...d, is_available: checked }))
                }
                disabled={!canManage}
              />
              <Label>Available for HM selection</Label>
            </div>
          </div>
        </SettingsCard>

        <div className="mt-6 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">System hierarchy template</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Use the indented tree (full screen) to build System → Component. This tree is
              cloned under every SDLS when a project is generated from this configuration.
            </p>
          </div>
          <HierarchyConfigTreeEditor
            key={`tree-${editorKey}`}
            nodes={draftNodes}
            onChange={setDraftNodes}
            readOnly={!canManage}
            openFullscreenSignal={treeFullscreenSignal}
            configId={draft.id}
            draftName={draft.name}
            draftDescription={draft.description ?? ''}
            suggestedDuplicateName={uniqueCopyName(
              configs,
              draft.name || 'Configuration'
            )}
            isNameTaken={(name) => isConfigNameTaken(configs, name)}
            onSave={canManage ? handleSave : undefined}
            onDuplicate={canManage ? handleDuplicate : undefined}
            saving={saving}
          />
          <details className="rounded-lg border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Classic list editor
            </summary>
            <div className="mt-4">
              <HierarchyTemplateEditor
                key={editorKey}
                nodes={draftNodes}
                onChange={setDraftNodes}
                readOnly={!canManage}
              />
            </div>
          </details>
        </div>
      </SettingsSection>
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate configuration</DialogTitle>
            <DialogDescription>
              Create a copy under a new name. It will be marked available for HM selection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cfg-dup-name">New configuration name</Label>
              <Input
                id="cfg-dup-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                autoFocus
                aria-invalid={isConfigNameTaken(configs, duplicateName)}
              />
              {isConfigNameTaken(configs, duplicateName) ? (
                <p className="text-xs text-destructive">
                  Another configuration already uses this name.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfg-dup-desc">Description (optional)</Label>
              <Input
                id="cfg-dup-desc"
                value={duplicateDescription}
                onChange={(e) => setDuplicateDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  saving ||
                  !duplicateName.trim() ||
                  isConfigNameTaken(configs, duplicateName)
                }
                onClick={() => {
                  void handleDuplicate({
                    name: duplicateName.trim(),
                    description: duplicateDescription.trim(),
                  }).then((ok) => {
                    if (ok) setDuplicateDialogOpen(false);
                  });
                }}
              >
                <Copy className="mr-1.5 h-4 w-4" />
                {saving ? 'Saving…' : 'Duplicate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Flight → SDLS → System → Subsystem → Module → Unit → Component
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search configurations by name or description…"
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load({ quiet: true })}
            disabled={loading || listRefreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-4 w-4 ${listRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          {canManage ? (
            <Can permission={P.hierarchy_config_manage}>
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => listImportInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Import JSON
                </Button>
                <input
                  ref={listImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => void handleImportFile(e)}
                />
                <Button size="sm" onClick={openCreate}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New configuration
                </Button>
              </>
            </Can>
          ) : null}
        </div>
      </div>

      <div className="relative space-y-3">
        {listRefreshing ? (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-background/40" />
        ) : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : configs.length === 0 ? (
          <SettingsCard title="No configurations yet">
            <p className="text-sm text-muted-foreground">
              Create named templates or import a JSON export so Hierarchy Managers can select them
              when drafting a project.
            </p>
          </SettingsCard>
        ) : filteredConfigs.length === 0 ? (
          <SettingsCard title="No matches">
            <p className="text-sm text-muted-foreground">
              No configurations match “{debouncedSearch.trim()}”.
            </p>
          </SettingsCard>
        ) : (
          <>
            {pagedConfigs.map((config) => (
              <SettingsCard
                key={config.id}
                title={config.name}
                description={`v${config.version}`}
                headerAction={
                  <div className="flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                          onClick={() => handleExportJson(config)}
                          aria-label="Export"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                          onClick={() => openEdit(config)}
                          aria-label={canManage ? 'Edit' : 'View'}
                        >
                          {canManage ? (
                            <Pencil className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{canManage ? 'Edit' : 'View'}</TooltipContent>
                    </Tooltip>
                    {canManage ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                            onClick={() => handleDuplicateFromList(config)}
                            aria-label="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate</TooltipContent>
                      </Tooltip>
                    ) : null}
                    {canManage ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground shadow-none hover:bg-transparent hover:text-destructive"
                            onClick={() => setDeleteTarget(config)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  {config.is_available ? (
                    <Badge className="border-emerald-800 bg-emerald-700 text-white">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="outline">Unavailable</Badge>
                  )}
                  <Badge variant="outline">
                    <GitBranch className="mr-1 h-3 w-3" />
                    {config.nodes.length} template nodes
                  </Badge>
                </div>
                {canManage ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      checked={config.is_available}
                      onCheckedChange={(checked) => void toggleAvailable(config, checked)}
                    />
                    <span className="text-sm text-muted-foreground">
                      Available for HM selection
                    </span>
                  </div>
                ) : null}
              </SettingsCard>
            ))}
            <EntityListPagination
              page={safePage}
              totalPages={totalPages}
              total={filteredConfigs.length}
              rangeLabel={rangeLabel}
              hasPrev={safePage > 0}
              hasNext={safePage < totalPages - 1}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              loading={listRefreshing}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete configuration?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be permanently removed from the database. Projects that used it will no longer reference this configuration.`
            : ''
        }
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
