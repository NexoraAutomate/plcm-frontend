'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsCard } from '@/components/settings/settings-card';
import { HierarchyTemplateEditor } from '@/components/settings/hierarchy-template-editor';
import { Can, WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import type {
  HierarchyConfigProductType,
  HierarchyConfiguration,
  HierarchyConfigurationWrite,
} from '@/lib/models';
import {
  DEFAULT_CONFIG_NOTES,
  DEFAULT_PRODUCT_TYPES,
  FIXED_HIERARCHY_LEVELS,
  type TemplateDraftNode,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';

export type HierarchyConfigPanelProps = {
  embedded?: boolean;
  readOnly?: boolean;
};

type Draft = HierarchyConfigurationWrite & { id?: number };

function emptyDraft(): Draft {
  return {
    code: '',
    name: '',
    description: '',
    notes: DEFAULT_CONFIG_NOTES,
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
    notes: config.notes ?? DEFAULT_CONFIG_NOTES,
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
    })),
  };
}

export function HierarchyConfigPanel({
  embedded: _embedded = false,
  readOnly = false,
}: HierarchyConfigPanelProps) {
  const { can } = useAuth();
  const canManage = can(P.hierarchy_config_manage) && !readOnly;
  const canListAll = can(P.hierarchy_config_manage);
  const [configs, setConfigs] = useState<HierarchyConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<HierarchyConfiguration | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [canListAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const levelStrip = useMemo(
    () => FIXED_HIERARCHY_LEVELS.map((l) => l.label).join(' → '),
    []
  );

  function openCreate() {
    setDraft(emptyDraft());
    setEditing(true);
  }

  function openEdit(config: HierarchyConfiguration) {
    setDraft(toDraft(config));
    setEditing(true);
  }

  function updateProductType(index: number, patch: Partial<HierarchyConfigProductType>) {
    setDraft((prev) => ({
      ...prev,
      product_types: prev.product_types.map((pt, i) =>
        i === index ? { ...pt, ...patch } : pt
      ),
    }));
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

  async function handleSave() {
    if (!draft.code.trim() || !draft.name.trim()) {
      toast.error('Code and name are required');
      return;
    }
    if (!draft.product_types.some((pt) => pt.code.trim())) {
      toast.error('At least one product type is required');
      return;
    }
    if (draft.nodes.some((n) => !n.name.trim())) {
      toast.error('Every template node needs a name');
      return;
    }

    const payload: HierarchyConfigurationWrite = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      notes: draft.notes?.trim() || DEFAULT_CONFIG_NOTES,
      is_available: draft.is_available ?? true,
      product_types: draft.product_types
        .filter((pt) => pt.code.trim())
        .map((pt, index) => ({
          code: pt.code.trim(),
          name: pt.name.trim() || pt.code.trim(),
          description: pt.description ?? null,
          sort_order: index,
        })),
      nodes: draft.nodes.map((n, index) => ({
        client_key: n.client_key,
        parent_client_key: n.parent_client_key ?? null,
        level: n.level,
        name: n.name.trim(),
        description: n.description ?? null,
        abbreviation: n.abbreviation ?? null,
        sort_order: index,
      })),
    };

    setSaving(true);
    try {
      if (draft.id) {
        await api.hierarchyConfigurations.update(draft.id, payload);
        toast.success('Configuration updated');
      } else {
        await api.hierarchyConfigurations.create(payload);
        toast.success('Configuration created');
      }
      setEditing(false);
      await load();
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Failed to save configuration';
      toast.error(typeof detail === 'string' ? detail : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(config: HierarchyConfiguration, next: boolean) {
    try {
      await api.hierarchyConfigurations.setAvailable(config.id, next);
      toast.success(next ? 'Marked available for HM' : 'Marked unavailable');
      await load();
    } catch {
      toast.error('Failed to update availability');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.hierarchyConfigurations.remove(deleteTarget.id, false);
      toast.success('Configuration retired (unavailable)');
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error('Failed to retire configuration');
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
  }));

  if (editing) {
    return (
      <SettingsSection
        title={draft.id ? 'Edit configuration' : 'New configuration'}
        description="Product types and the System → Component template shared by every SDLS."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
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
          {canManage ? (
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create configuration'}
            </Button>
          ) : null}
        </div>

        <SettingsCard title="Configuration details">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-code">Code</Label>
                <Input
                  id="cfg-code"
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                  placeholder="SSDLS-HDR-STD"
                  disabled={!canManage}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfg-name">Name</Label>
                <Input
                  id="cfg-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="SSDLS-1 High Data Rate Standard"
                  disabled={!canManage}
                />
              </div>
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

            <div className="space-y-1.5">
              <Label htmlFor="cfg-notes">Rule notes</Label>
              <Textarea
                id="cfg-notes"
                rows={3}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
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

            <div className="space-y-2">
              <Label>Product types</Label>
              <div className="space-y-2">
                {draft.product_types.map((pt, index) => (
                  <div key={`${pt.code}-${index}`} className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={pt.code}
                      onChange={(e) => updateProductType(index, { code: e.target.value })}
                      placeholder="SSDLS-1"
                      disabled={!canManage}
                    />
                    <Input
                      value={pt.name}
                      onChange={(e) => updateProductType(index, { name: e.target.value })}
                      placeholder="High Data Rate"
                      disabled={!canManage}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsCard>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium">System hierarchy template</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Same layout as the former System Hierarchy settings. This tree is cloned under every
            SDLS when an HM generates a project from this configuration.
          </p>
          <HierarchyTemplateEditor
            nodes={draftNodes}
            onChange={setDraftNodes}
            readOnly={!canManage}
          />
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Named configurations"
      description="Admin-defined hierarchy templates for project creation. An HM selects one when drafting a new project."
    >
      <SettingsCard
        title="Fixed level model"
        description="Product Type → Flight → SDLS counts come from the customer order / project. Admin defines the System→Component template once per configuration."
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Layers3 className="h-4 w-4" />
          <span>{levelStrip}</span>
        </div>
      </SettingsCard>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Configurations</h3>
          <p className="text-xs text-muted-foreground">
            Only available configs appear for HM selection.
          </p>
        </div>
        {canManage ? (
          <Can permission={P.hierarchy_config_manage}>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              New configuration
            </Button>
          </Can>
        ) : null}
      </div>

      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : configs.length === 0 ? (
          <SettingsCard title="No configurations yet">
            <p className="text-sm text-muted-foreground">
              Create named templates (Config-1, Config-2, …) so Hierarchy Managers can select them
              when drafting a project.
            </p>
          </SettingsCard>
        ) : (
          configs.map((config) => (
            <SettingsCard
              key={config.id}
              title={config.name}
              description={`${config.code} · v${config.version}`}
              headerAction={
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(config)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {canManage ? 'Edit' : 'View'}
                  </Button>
                  {canManage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(config)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Retire
                    </Button>
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
                {config.product_types.map((pt) => (
                  <Badge key={pt.code} variant="secondary">
                    {pt.code}
                  </Badge>
                ))}
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
              <WorkflowCan role={['HM', 'ADMIN']}>
                {config.is_available ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Selectable when creating a project draft.
                  </p>
                ) : null}
              </WorkflowCan>
            </SettingsCard>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Retire configuration?"
        description={
          deleteTarget
            ? `${deleteTarget.name} will be marked unavailable for HM selection. Hard delete is reserved for unused configs.`
            : ''
        }
        onConfirm={() => void confirmDelete()}
      />
    </SettingsSection>
  );
}
