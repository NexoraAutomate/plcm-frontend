'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { AppDefinitions } from '@/lib/models';
import {
  DEFAULT_APP_DEFINITIONS,
  HIERARCHY_ENTITY_LEVELS,
  buildEntityIdentifiersFromDefinitions,
  getEntityTypeLabel,
  getLevelAbbrev,
  getLevelPartTemplate,
  getLevelSerialTemplate,
  suggestAbbreviation,
  type HierarchyEntityLevel,
} from '@/lib/app-definitions';
import { useAppDefinitions } from '@/lib/app-definitions-context';
import {
  listEntityListNames,
  type TemplateNameItem,
  filterTemplateNames,
} from '@/lib/hierarchy-template-names';
import {
  normalizeLocationTree,
  type InventoryLocationTree,
} from '@/lib/inventory-location-tree';

export type AppDefinitionsDraft = Omit<AppDefinitions, 'id' | 'updated_at'>;

const DEFAULT_DRAFT: AppDefinitionsDraft = { ...DEFAULT_APP_DEFINITIONS };

function toDraft(data: AppDefinitions): AppDefinitionsDraft {
  const merged = { ...DEFAULT_DRAFT };
  for (const key of Object.keys(merged) as (keyof AppDefinitionsDraft)[]) {
    const value = data[key as keyof AppDefinitions];
    if (key === 'inventory_location_tree') {
      (merged as Record<string, unknown>)[key] = normalizeLocationTree(value);
    } else if (Array.isArray(value)) {
      (merged as Record<string, unknown>)[key] = [...value];
    } else if (value != null && String(value).length > 0) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function useDefinitionsSettings() {
  const { refresh: refreshGlobal } = useAppDefinitions();
  const [draft, setDraft] = useState<AppDefinitionsDraft>(DEFAULT_DRAFT);
  const [templateNames, setTemplateNames] = useState<TemplateNameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<HierarchyEntityLevel>('system');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const defsRes = await api.auth.getAppDefinitions();
      setDraft(toDraft(defsRes.data));
      const names = await listEntityListNames();
      setTemplateNames(names);
    } catch {
      toast.error('Failed to load definitions');
      setDraft(DEFAULT_DRAFT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = useCallback((patch: Partial<AppDefinitionsDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateLevelTemplate = useCallback(
    (level: HierarchyEntityLevel, kind: 'part' | 'serial', value: string) => {
      const key = `${kind}_template_${level}` as keyof AppDefinitionsDraft;
      updateDraft({ [key]: value } as Partial<AppDefinitionsDraft>);
    },
    [updateDraft]
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.auth.updateAppDefinitions(draft);
      setDraft(toDraft(res.data));
      await refreshGlobal();
      toast.success('Definitions saved');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save definitions';
      toast.error(typeof detail === 'string' ? detail : 'Failed to save definitions');
    } finally {
      setSaving(false);
    }
  }, [draft, refreshGlobal]);

  const resetDefaults = useCallback(() => {
    setDraft({ ...DEFAULT_DRAFT });
  }, []);

  const sampleEntity = useMemo(() => {
    const matches = filterTemplateNames(templateNames, selectedLevel);
    return matches[0] || null;
  }, [templateNames, selectedLevel]);

  const preview = useMemo(() => {
    const name = sampleEntity?.name || (selectedLevel === 'system' ? 'ACU' : 'Harness Antenna');
    const entityAbbr =
      sampleEntity?.abbreviation || suggestAbbreviation(name);
    const vendor = selectedLevel === 'system' ? 'AMP' : 'AD';
    const ids = buildEntityIdentifiersFromDefinitions(draft as AppDefinitions, {
      name,
      level: selectedLevel,
      entityAbbr,
      vendor,
      seq: 10,
      pnSeq: selectedLevel === 'system' ? 3 : 16,
      project: '',
    });
    return {
      name,
      entityAbbr,
      vendor,
      levelAbbr: getLevelAbbrev(draft as AppDefinitions, selectedLevel),
      part: ids.part_number,
      serial: ids.serial_number,
      partTemplate: getLevelPartTemplate(draft as AppDefinitions, selectedLevel),
      serialTemplate: getLevelSerialTemplate(draft as AppDefinitions, selectedLevel),
    };
  }, [draft, sampleEntity, selectedLevel]);

  const setLocationTree = useCallback((tree: InventoryLocationTree) => {
    setDraft((prev) => ({
      ...prev,
      inventory_location_tree: normalizeLocationTree(tree),
    }));
  }, []);

  return {
    draft,
    loading,
    saving,
    updateDraft,
    updateLevelTemplate,
    save,
    resetDefaults,
    reload: load,
    preview,
    selectedLevel,
    setSelectedLevel,
    levels: HIERARCHY_ENTITY_LEVELS,
    levelLabel: (level: string, plural = false) =>
      getEntityTypeLabel(draft as AppDefinitions, level, plural),
    setLocationTree,
  };
}
