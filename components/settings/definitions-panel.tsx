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
import {
  isDefinitionsSectionId,
  type DefinitionsSectionId,
} from '@/components/settings/settings-tabs-config';

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
  const canConfigs = can([P.hierarchy_config_manage, P.view_hierarchy, P.manage_settings]);
  const configsReadOnly = !can(P.hierarchy_config_manage);

  const requestedSection = searchParams.get('section');
  const activeSection: DefinitionsSectionId = useMemo(() => {
    if (isDefinitionsSectionId(requestedSection)) {
      if (requestedSection === 'labels' && !canLabels) return 'configurations';
      if (requestedSection === 'configurations' && !canConfigs) return 'labels';
      return requestedSection;
    }
    if (canLabels) return 'labels';
    return 'configurations';
  }, [canConfigs, canLabels, requestedSection]);

  function setSection(section: DefinitionsSectionId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'definitions');
    params.set('section', section);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (!canLabels && !canConfigs) {
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
          <h1 className="text-3xl font-bold tracking-tight">Definitions</h1>
          <p className="mt-2 text-muted-foreground">
            Level names, identifier templates, and named hierarchy configurations
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
          {canConfigs ? (
            <TabsTrigger value="configurations">Configurations</TabsTrigger>
          ) : null}
        </TabsList>

        {canLabels ? (
          <TabsContent value="labels" className="mt-6">
            <DefinitionsLabelsSection />
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
    resetDefaults,
    preview,
    selectedLevel,
    setSelectedLevel,
    levels,
    levelLabel,
  } = useDefinitionsSettings();

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
        <SettingsCard>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Key</th>
                  <th className="pb-2 pr-3 font-medium">Singular</th>
                  <th className="pb-2 pr-3 font-medium">Plural</th>
                  <th className="pb-2 font-medium">Level abbrev</th>
                </tr>
              </thead>
              <tbody>
                {ENTITY_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{row.key}</td>
                    <td className="py-3 pr-3">
                      <Input
                        value={draft[row.singular]}
                        onChange={(e) => updateDraft({ [row.singular]: e.target.value })}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <Input
                        value={draft[row.plural]}
                        onChange={(e) => updateDraft({ [row.plural]: e.target.value })}
                      />
                    </td>
                    <td className="py-3">
                      <Input
                        className="font-mono uppercase"
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
        title="Per-level serial & part number templates"
        description={`Select a hierarchy level and define its templates. ${TEMPLATE_PLACEHOLDER_HELP} Preview uses the first node from an available configuration.`}
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
