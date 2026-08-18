'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { AppDefinitions, Hierarchy } from '@/lib/models';
import {
  DEFAULT_APP_DEFINITIONS,
  HIERARCHY_ENTITY_LEVELS,
  applyIdentifierTemplate,
  buildEntityIdentifiersFromDefinitions,
  getEntityTypeLabel,
  getLevelAbbrev,
  getLevelPartTemplate,
  getLevelSerialTemplate,
  suggestAbbreviation,
  type HierarchyEntityLevel,
} from '@/lib/app-definitions';
import { useAppDefinitions } from '@/lib/app-definitions-context';

export type AppDefinitionsDraft = Omit<AppDefinitions, 'id' | 'updated_at'>;

const DEFAULT_DRAFT: AppDefinitionsDraft = { ...DEFAULT_APP_DEFINITIONS };

function toDraft(data: AppDefinitions): AppDefinitionsDraft {
  const merged = { ...DEFAULT_DRAFT };
  for (const key of Object.keys(merged) as (keyof AppDefinitionsDraft)[]) {
    const value = data[key as keyof AppDefinitions];
    if (value != null && String(value).length > 0) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

export function useDefinitionsSettings() {
  const { refresh: refreshGlobal } = useAppDefinitions();
  const [draft, setDraft] = useState<AppDefinitionsDraft>(DEFAULT_DRAFT);
  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [abbrDraft, setAbbrDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAbbr, setSavingAbbr] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<HierarchyEntityLevel>('system');

  const reloadHierarchies = useCallback(async () => {
    const res = await api.hierarchies.list();
    const list = res.data ?? [];
    setHierarchies(list);
    setAbbrDraft((prev) => {
      const next: Record<number, string> = {};
      for (const h of list) {
        next[h.id] =
          (h.abbreviation?.trim() || prev[h.id] || suggestAbbreviation(h.name)).toUpperCase();
      }
      return next;
    });
    return list;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [defsRes] = await Promise.all([
        api.auth.getAppDefinitions(),
        // hierarchies loaded next
      ]);
      setDraft(toDraft(defsRes.data));
      const list = await api.hierarchies
        .list()
        .then((r) => r.data ?? [])
        .catch(() => [] as Hierarchy[]);
      setHierarchies(list);
      const map: Record<number, string> = {};
      for (const h of list) {
        map[h.id] = h.abbreviation?.trim() || suggestAbbreviation(h.name);
      }
      setAbbrDraft(map);
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

  const saveAbbreviations = useCallback(async () => {
    setSavingAbbr(true);
    try {
      const updates = hierarchies.filter((h) => {
        const next = (abbrDraft[h.id] || '').trim().toUpperCase();
        const prev = (h.abbreviation || '').trim().toUpperCase();
        return next && next !== prev;
      });
      await Promise.all(
        updates.map((h) =>
          api.hierarchies.update(h.id, {
            abbreviation: (abbrDraft[h.id] || '').trim().toUpperCase(),
          })
        )
      );
      toast.success(
        updates.length ? `Saved ${updates.length} abbreviation(s)` : 'Abbreviations up to date'
      );
      await reloadHierarchies();
    } catch {
      toast.error('Failed to save abbreviations');
    } finally {
      setSavingAbbr(false);
    }
  }, [abbrDraft, hierarchies, reloadHierarchies]);

  const createHierarchyNode = useCallback(
    async (input: {
      name: string;
      hierarchy_type: HierarchyEntityLevel;
      parent_id?: number | null;
      abbreviation?: string;
    }) => {
      const name = input.name.trim();
      if (!name) {
        toast.error('Name is required');
        return null;
      }
      const abbreviation = (input.abbreviation || suggestAbbreviation(name)).trim().toUpperCase();
      try {
        const res = await api.hierarchies.create({
          name,
          hierarchy_type: input.hierarchy_type,
          parent_id: input.parent_id ?? null,
          abbreviation,
        });
        setAbbrDraft((prev) => ({ ...prev, [res.data.id]: abbreviation }));
        await reloadHierarchies();
        toast.success(`${getEntityTypeLabel(draft as AppDefinitions, input.hierarchy_type)} created`);
        return res.data;
      } catch {
        toast.error('Failed to create hierarchy item');
        return null;
      }
    },
    [draft, reloadHierarchies]
  );

  const updateHierarchyNode = useCallback(
    async (
      id: number,
      patch: { name?: string; abbreviation?: string; parent_id?: number | null; hierarchy_type?: string }
    ) => {
      try {
        const payload: Partial<Hierarchy> = {};
        if (patch.name != null) payload.name = patch.name.trim();
        if (patch.abbreviation != null) {
          payload.abbreviation = patch.abbreviation.trim().toUpperCase();
        }
        if (patch.parent_id !== undefined) payload.parent_id = patch.parent_id;
        if (patch.hierarchy_type != null) payload.hierarchy_type = patch.hierarchy_type;
        const res = await api.hierarchies.update(id, payload);
        if (payload.abbreviation != null) {
          setAbbrDraft((prev) => ({ ...prev, [id]: payload.abbreviation! }));
        }
        await reloadHierarchies();
        toast.success('Hierarchy item updated');
        return res.data;
      } catch {
        toast.error('Failed to update hierarchy item');
        return null;
      }
    },
    [reloadHierarchies]
  );

  const deleteHierarchyNode = useCallback(
    async (id: number) => {
      // Delete deepest descendants first
      const collect = (parentId: number): number[] => {
        const kids = hierarchies.filter((h) => h.parent_id === parentId);
        return kids.flatMap((k) => [...collect(k.id), k.id]);
      };
      const order = [...collect(id), id];
      try {
        for (const nodeId of order) {
          await api.hierarchies.delete(nodeId);
        }
        setAbbrDraft((prev) => {
          const next = { ...prev };
          for (const nodeId of order) delete next[nodeId];
          return next;
        });
        await reloadHierarchies();
        toast.success(
          order.length > 1
            ? `Deleted item and ${order.length - 1} descendant(s)`
            : 'Hierarchy item deleted'
        );
        return true;
      } catch {
        toast.error('Failed to delete hierarchy item');
        await reloadHierarchies();
        return false;
      }
    },
    [hierarchies, reloadHierarchies]
  );

  const resetDefaults = useCallback(() => {
    setDraft({ ...DEFAULT_DRAFT });
  }, []);

  const sampleEntity = useMemo(() => {
    const match = hierarchies.find((h) => h.hierarchy_type === selectedLevel);
    return match || null;
  }, [hierarchies, selectedLevel]);

  const preview = useMemo(() => {
    const name = sampleEntity?.name || (selectedLevel === 'system' ? 'ACU' : 'Harness Antenna');
    const entityAbbr =
      (sampleEntity && abbrDraft[sampleEntity.id]) ||
      sampleEntity?.abbreviation ||
      suggestAbbreviation(name);
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
  }, [abbrDraft, draft, sampleEntity, selectedLevel]);

  const hierarchyByLevel = useMemo(() => {
    const map: Record<HierarchyEntityLevel, Hierarchy[]> = {
      project: [],
      system: [],
      subsystem: [],
      module: [],
      unit: [],
      component: [],
    };
    for (const h of hierarchies) {
      const t = h.hierarchy_type as HierarchyEntityLevel;
      if (map[t]) map[t].push(h);
    }
    return map;
  }, [hierarchies]);

  return {
    draft,
    loading,
    saving,
    savingAbbr,
    updateDraft,
    updateLevelTemplate,
    save,
    saveAbbreviations,
    createHierarchyNode,
    updateHierarchyNode,
    deleteHierarchyNode,
    resetDefaults,
    reload: load,
    preview,
    selectedLevel,
    setSelectedLevel,
    hierarchies,
    hierarchyByLevel,
    abbrDraft,
    setAbbrDraft,
    levels: HIERARCHY_ENTITY_LEVELS,
    levelLabel: (level: string, plural = false) =>
      getEntityTypeLabel(draft as AppDefinitions, level, plural),
  };
}
