'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsSection } from '@/components/settings/settings-section';
import { PageLoader } from '@/components/page-loader';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { useAuth } from '@/lib/auth-context';
import { TEMPLATE_PLACEHOLDER_HELP } from '@/lib/app-definitions';
import type { HierarchyEntityLevel } from '@/lib/app-definitions';
import { useDefinitionsSettings } from '@/components/settings/hooks/use-definitions-settings';
import { HierarchyConfigPanel } from '@/components/settings/hierarchy-config-panel';
import { HierarchyPanel } from '@/components/settings/hierarchy-panel';
import {
  isDefinitionsSectionId,
  type DefinitionsSectionId,
} from '@/components/settings/settings-tabs-config';
import { usePageDataRefresh } from '@/components/page-data-refresh';

export type DefinitionsPanelProps = {
  embedded?: boolean;
};

const ENTITY_ROWS = [
  {
    key: 'project' as const,
    singular: 'label_project' as const,
    plural: 'label_projects' as const,
    abbrev: 'abbrev_project' as const,
  },
  {
    key: 'system' as const,
    singular: 'label_system' as const,
    plural: 'label_systems' as const,
    abbrev: 'abbrev_system' as const,
  },
  {
    key: 'subsystem' as const,
    singular: 'label_subsystem' as const,
    plural: 'label_subsystems' as const,
    abbrev: 'abbrev_subsystem' as const,
  },
  {
    key: 'module' as const,
    singular: 'label_module' as const,
    plural: 'label_modules' as const,
    abbrev: 'abbrev_module' as const,
  },
  {
    key: 'unit' as const,
    singular: 'label_unit' as const,
    plural: 'label_units' as const,
    abbrev: 'abbrev_unit' as const,
  },
  {
    key: 'component' as const,
    singular: 'label_component' as const,
    plural: 'label_components' as const,
    abbrev: 'abbrev_component' as const,
  },
];

export function DefinitionsPanel({ embedded = false }: DefinitionsPanelProps) {
  const { can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canLabels = can(P.manage_settings);
  const canEntityList = can([P.view_hierarchy, P.create_hierarchy, P.manage_settings]);
  const canConfigs = can([P.hierarchy_config_manage, P.view_hierarchy, P.manage_settings]);
  const configsReadOnly = !can(P.hierarchy_config_manage);
  const entityListReadOnly = !can([P.create_hierarchy, P.edit_hierarchy]);

  const requestedSection = searchParams.get('section');
  const activeSection: DefinitionsSectionId = useMemo(() => {
    if (isDefinitionsSectionId(requestedSection)) {
      if (requestedSection === 'labels' && !canLabels) {
        if (canEntityList) return 'entity-list';
        return 'configurations';
      }
      if (requestedSection === 'entity-list' && !canEntityList) {
        if (canLabels) return 'labels';
        return 'configurations';
      }
      if (requestedSection === 'configurations' && !canConfigs) {
        if (canEntityList) return 'entity-list';
        return 'labels';
      }
      return requestedSection;
    }
    if (canLabels) return 'labels';
    if (canEntityList) return 'entity-list';
    return 'configurations';
  }, [canConfigs, canEntityList, canLabels, requestedSection]);

  function setSection(section: DefinitionsSectionId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'definitions');
    params.set('section', section);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (!canLabels && !canEntityList && !canConfigs) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You do not have permission to view Definitions."
      />
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Definitions</h1>
          <p className="text-sm text-muted-foreground">
            Level names, identifier templates, entity catalog, and named hierarchy configurations
          </p>
        </div>
      )}

      <Tabs
        value={activeSection}
        onValueChange={(value) => {
          if (isDefinitionsSectionId(value)) setSection(value);
        }}
      >
        <TabsList>
          {canLabels ? (
            <TabsTrigger value="labels">Labels & templates</TabsTrigger>
          ) : null}
          {canEntityList ? (
            <TabsTrigger value="entity-list">Entity List</TabsTrigger>
          ) : null}
          {canConfigs ? (
            <TabsTrigger value="configurations">Configurations</TabsTrigger>
          ) : null}
        </TabsList>

        {canLabels ? (
          <TabsContent value="labels" className="mt-6">
            <DefinitionsLabelsSection />
          </TabsContent>
        ) : null}

        {canEntityList ? (
          <TabsContent value="entity-list" className="mt-6">
            <HierarchyPanel embedded variant="entity-list" readOnly={entityListReadOnly} />
          </TabsContent>
        ) : null}

        {canConfigs ? (
          <TabsContent value="configurations" className="mt-6">
            <HierarchyConfigPanel embedded readOnly={configsReadOnly} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function DefinitionsLabelsSection() {
  const {
    draft,
    loading,
    saving,
    updateDraft,
    updateLevelTemplate,
    save,
    reload,
    resetDefaults,
    preview,
    selectedLevel,
    setSelectedLevel,
    levels,
    levelLabel,
  } = useDefinitionsSettings();

  usePageDataRefresh(reload);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <Can permission={P.manage_settings}>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetDefaults}>
            Reset templates to defaults
          </Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save definitions'}
          </Button>
        </div>
      </Can>

      <SettingsSection
        title="Level names & abbreviations"
        description="Display names for hierarchy levels and short codes used as {levelAbbr} in templates (e.g. SYS, SUB)."
      >
        <SettingsCard className="max-w-5xl py-3" contentClassName="px-3 pt-0 sm:px-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 table-fixed text-sm">
              <colgroup>
                <col className="w-28" />
                <col />
                <col />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-1.5 pr-3 text-xs font-medium">Key</th>
                  <th className="pb-1.5 pr-3 text-xs font-medium">Singular</th>
                  <th className="pb-1.5 pr-3 text-xs font-medium">Plural</th>
                  <th className="pb-1.5 text-xs font-medium">Level abbrev</th>
                </tr>
              </thead>
              <tbody>
                {ENTITY_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">{row.key}</td>
                    <td className="py-1.5 pr-3">
                      <Input
                        className="h-8 px-2 text-sm"
                        value={draft[row.singular]}
                        onChange={(e) => updateDraft({ [row.singular]: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <Input
                        className="h-8 px-2 text-sm"
                        value={draft[row.plural]}
                        onChange={(e) => updateDraft({ [row.plural]: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5">
                      <Input
                        className="h-8 px-2 font-mono text-sm uppercase"
                        value={draft[row.abbrev]}
                        onChange={(e) =>
                          updateDraft({ [row.abbrev]: e.target.value.toUpperCase() })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Inventory label printing"
        description="Only Admin decides whether inventory labels use QR codes or barcodes and controls their physical and sticker sizes."
      >
        <SettingsCard>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inventory_label_code_type">Code printed on labels</Label>
              <Select
                value={draft.inventory_label_code_type}
                onValueChange={(value) =>
                  updateDraft({ inventory_label_code_type: value as 'qr' | 'barcode' })
                }
              >
                <SelectTrigger id="inventory_label_code_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qr">QR code</SelectItem>
                  <SelectItem value="barcode">Bar code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory_qr_size_in">QR code size (inches)</Label>
              <Input
                id="inventory_qr_size_in"
                type="number"
                min="0.1"
                max="20"
                step="0.01"
                value={draft.inventory_qr_size_in}
                onChange={(event) =>
                  updateDraft({ inventory_qr_size_in: Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>QR sticker size (inches)</Label>
              <div className="flex gap-2">
                <Input
                  aria-label="QR sticker width in inches"
                  type="number"
                  min="0.1"
                  max="8.27"
                  step="0.01"
                  value={draft.inventory_qr_sticker_width_in}
                  onChange={(event) =>
                    updateDraft({ inventory_qr_sticker_width_in: Number(event.target.value) })
                  }
                />
                <Input
                  aria-label="QR sticker height in inches"
                  type="number"
                  min="0.1"
                  max="11.69"
                  step="0.01"
                  value={draft.inventory_qr_sticker_height_in}
                  onChange={(event) =>
                    updateDraft({ inventory_qr_sticker_height_in: Number(event.target.value) })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">Width × height</p>
            </div>
            <div className="space-y-2">
              <Label>Barcode size (inches)</Label>
              <div className="flex gap-2">
                <Input
                  aria-label="Barcode width in inches"
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.01"
                  value={draft.inventory_barcode_width_in}
                  onChange={(event) =>
                    updateDraft({ inventory_barcode_width_in: Number(event.target.value) })
                  }
                />
                <Input
                  aria-label="Barcode height in inches"
                  type="number"
                  min="0.1"
                  max="20"
                  step="0.01"
                  value={draft.inventory_barcode_height_in}
                  onChange={(event) =>
                    updateDraft({ inventory_barcode_height_in: Number(event.target.value) })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">Width × height</p>
            </div>
            <div className="space-y-2">
              <Label>Barcode sticker size (inches)</Label>
              <div className="flex gap-2">
                <Input
                  aria-label="Barcode sticker width in inches"
                  type="number"
                  min="0.1"
                  max="8.27"
                  step="0.01"
                  value={draft.inventory_barcode_sticker_width_in}
                  onChange={(event) =>
                    updateDraft({ inventory_barcode_sticker_width_in: Number(event.target.value) })
                  }
                />
                <Input
                  aria-label="Barcode sticker height in inches"
                  type="number"
                  min="0.1"
                  max="11.69"
                  step="0.01"
                  value={draft.inventory_barcode_sticker_height_in}
                  onChange={(event) =>
                    updateDraft({ inventory_barcode_sticker_height_in: Number(event.target.value) })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">Width × height</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            The PDF grid automatically uses these sticker dimensions. QR defaults are
            0.65 × 0.65 in; barcode defaults are 2.0 × 0.5 in.
          </p>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Per-level serial & part number templates"
        description={`Select a hierarchy level and define its templates. ${TEMPLATE_PLACEHOLDER_HELP} Preview uses the first entity from the Entity List catalog.`}
      >
        <SettingsCard>
          <div className="mb-4 max-w-sm space-y-2">
            <Label>Entity level</Label>
            <Select
              value={selectedLevel}
              onValueChange={(v) => setSelectedLevel(v as HierarchyEntityLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {levels.filter((level) => level !== 'project').map((level) => (
                  <SelectItem key={level} value={level}>
                    {levelLabel(level)} ({draft[`abbrev_${level}` as keyof typeof draft]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="part-template">
                Part number template — {levelLabel(selectedLevel)}
              </Label>
              <Input
                id="part-template"
                className="font-mono text-xs"
                value={preview.partTemplate}
                onChange={(e) => updateLevelTemplate(selectedLevel, 'part', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial-template">
                Serial number template — {levelLabel(selectedLevel)}
              </Label>
              <Input
                id="serial-template"
                className="font-mono text-xs"
                value={preview.serialTemplate}
                onChange={(e) => updateLevelTemplate(selectedLevel, 'serial', e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">
              Preview — {preview.name} as {levelLabel(selectedLevel)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              levelAbbr={preview.levelAbbr}, entityAbbr={preview.entityAbbr}, vendor=
              {preview.vendor} (vendor is entered when stocking inventory)
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs text-muted-foreground">
              <li>PN: {preview.part}</li>
              <li>SN: {preview.serial}</li>
            </ul>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Other formats"
        description="Used for configuration item and component SKU generation."
      >
        <SettingsCard>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="configuration_item_template">Configuration item template</Label>
              <Input
                id="configuration_item_template"
                value={draft.configuration_item_template}
                onChange={(e) => updateDraft({ configuration_item_template: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku_template">SKU template</Label>
              <Input
                id="sku_template"
                value={draft.sku_template}
                onChange={(e) => updateDraft({ sku_template: e.target.value })}
              />
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
