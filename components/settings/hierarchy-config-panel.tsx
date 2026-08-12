'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsCard } from '@/components/settings/settings-card';
import { Can, WorkflowCan } from '@/components/auth';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type {
  HierarchyConfigNode,
  HierarchyConfigProductType,
  HierarchyConfiguration,
  HierarchyConfigurationWrite,
} from '@/lib/models';
import {
  DEFAULT_CONFIG_NOTES,
  DEFAULT_PRODUCT_TYPES,
  FIXED_HIERARCHY_LEVELS,
  PARENT_TEMPLATE_LEVEL,
  TEMPLATE_NODE_LEVELS,
  newClientKey,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';

export type HierarchyConfigPanelProps = {
  embedded?: boolean;
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

export function HierarchyConfigPanel({ embedded: _embedded = false }: HierarchyConfigPanelProps) {
  const [configs, setConfigs] = useState<HierarchyConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<HierarchyConfiguration | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.hierarchyConfigurations.list();
      setConfigs(res.data ?? []);
    } catch {
      toast.error('Failed to load hierarchy configurations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const levelStrip = useMemo(
    () => FIXED_HIERARCHY_LEVELS.map((l) => l.label).join(' → '),
    []
  );

  function openCreate() {
    setDraft(emptyDraft());
    setDialogOpen(true);
  }

  function openEdit(config: HierarchyConfiguration) {
    setDraft(toDraft(config));
    setDialogOpen(true);
  }

  function updateProductType(index: number, patch: Partial<HierarchyConfigProductType>) {
    setDraft((prev) => ({
      ...prev,
      product_types: prev.product_types.map((pt, i) =>
        i === index ? { ...pt, ...patch } : pt
      ),
    }));
  }

  function addNode(level: TemplateNodeLevel) {
    const parentLevel = PARENT_TEMPLATE_LEVEL[level];
    const parents = draft.nodes.filter((n) => n.level === parentLevel);
    const parent_client_key =
      parentLevel === null ? null : parents[0]?.client_key ?? null;
    if (parentLevel && !parent_client_key) {
      toast.error(`Add a ${parentLevel} node before adding ${level}`);
      return;
    }
    setDraft((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          client_key: newClientKey(level.slice(0, 3)),
          parent_client_key,
          level,
          name: '',
          abbreviation: '',
          sort_order: prev.nodes.length,
        },
      ],
    }));
  }

  function updateNode(clientKey: string, patch: Partial<HierarchyConfigNode>) {
    setDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.client_key === clientKey ? { ...n, ...patch } : n
      ),
    }));
  }

  function removeNode(clientKey: string) {
    setDraft((prev) => {
      const removeKeys = new Set<string>([clientKey]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of prev.nodes) {
          if (
            n.parent_client_key &&
            removeKeys.has(n.parent_client_key) &&
            !removeKeys.has(n.client_key)
          ) {
            removeKeys.add(n.client_key);
            changed = true;
          }
        }
      }
      return {
        ...prev,
        nodes: prev.nodes.filter((n) => !removeKeys.has(n.client_key)),
      };
    });
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
      setDialogOpen(false);
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

  return (
    <SettingsSection
      title="Smart SDLS Configurations"
      description="Admin-defined hierarchy templates for project creation (Spec 01)."
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
            Only available configs appear for HM selection in Spec 02.
          </p>
        </div>
        <Can permission={P.hierarchy_config_manage}>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            New configuration
          </Button>
        </Can>
      </div>

      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : configs.length === 0 ? (
          <SettingsCard title="No configurations yet">
            <p className="text-sm text-muted-foreground">
              Create SSDLS-1 / SSDLS-2 templates so Hierarchy Managers can select them when
              drafting a project.
            </p>
          </SettingsCard>
        ) : (
          configs.map((config) => (
            <SettingsCard
              key={config.id}
              title={config.name}
              description={`${config.code} · v${config.version}`}
              headerAction={
                <Can permission={P.hierarchy_config_manage}>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(config)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(config)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Retire
                    </Button>
                  </div>
                </Can>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {config.is_available ? (
                  <Badge className="bg-emerald-700 text-white border-emerald-800">
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
              <Can permission={P.hierarchy_config_manage}>
                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    checked={config.is_available}
                    onCheckedChange={(checked) => void toggleAvailable(config, checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Available for HM selection
                  </span>
                </div>
              </Can>
              {/* Spec 02 handoff preview for HM role */}
              <WorkflowCan role={['HM', 'ADMIN']}>
                {config.is_available ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Selectable when creating a project draft (Spec 02).
                  </p>
                ) : null}
              </WorkflowCan>
            </SettingsCard>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? 'Edit hierarchy configuration' : 'Create hierarchy configuration'}
            </DialogTitle>
            <DialogDescription>
              Define product types and the System → Component template shared by every SDLS.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cfg-code">Code</Label>
                <Input
                  id="cfg-code"
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                  placeholder="SSDLS-HDR-STD"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfg-name">Name</Label>
                <Input
                  id="cfg-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="SSDLS-1 High Data Rate Standard"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-desc">Description</Label>
              <Input
                id="cfg-desc"
                value={draft.description ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cfg-notes">Rule notes</Label>
              <Textarea
                id="cfg-notes"
                rows={3}
                value={draft.notes ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={!!draft.is_available}
                onCheckedChange={(checked) =>
                  setDraft((d) => ({ ...d, is_available: checked }))
                }
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
                      onChange={(e) =>
                        updateProductType(index, { code: e.target.value })
                      }
                      placeholder="SSDLS-1"
                    />
                    <Input
                      value={pt.name}
                      onChange={(e) =>
                        updateProductType(index, { name: e.target.value })
                      }
                      placeholder="High Data Rate"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Lower hierarchy template (System → Component)</Label>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_NODE_LEVELS.map((level) => (
                    <Button
                      key={level}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addNode(level)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {draft.nodes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Optional for Spec 01 save — add at least System nodes for Spec 03 generation.
                </p>
              ) : (
                <div className="space-y-2 rounded-md border p-2">
                  {draft.nodes.map((node) => {
                    const level = node.level as TemplateNodeLevel;
                    const parentLevel = PARENT_TEMPLATE_LEVEL[level];
                    const parentOptions = draft.nodes.filter(
                      (n) => n.level === parentLevel && n.client_key !== node.client_key
                    );
                    return (
                      <div
                        key={node.client_key}
                        className="grid gap-2 rounded border bg-muted/20 p-2 sm:grid-cols-[110px_1fr_1fr_auto]"
                      >
                        <Badge variant="outline" className="h-8 justify-center capitalize">
                          {node.level}
                        </Badge>
                        <Input
                          value={node.name}
                          onChange={(e) =>
                            updateNode(node.client_key, { name: e.target.value })
                          }
                          placeholder="Name"
                        />
                        {parentLevel ? (
                          <Select
                            value={node.parent_client_key ?? undefined}
                            onValueChange={(value) =>
                              updateNode(node.client_key, {
                                parent_client_key: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Parent ${parentLevel}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {parentOptions.map((p) => (
                                <SelectItem key={p.client_key} value={p.client_key}>
                                  {p.name || p.client_key}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input disabled value="(root system)" />
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeNode(node.client_key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
