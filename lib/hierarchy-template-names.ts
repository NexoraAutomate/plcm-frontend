import * as api from '@/lib/api';
import type { Hierarchy, HierarchyConfigNode, HierarchyConfiguration } from '@/lib/models';
import type { TemplateNodeLevel } from '@/lib/hierarchy-config';
import { PARENT_TEMPLATE_LEVEL } from '@/lib/hierarchy-config';

export type TemplateNameItem = Pick<
  Hierarchy,
  'id' | 'name' | 'hierarchy_type' | 'parent_id' | 'abbreviation'
> & {
  parent_name?: string | null;
  client_key?: string;
};

const nodeCache = new Map<number, { at: number; nodes: HierarchyConfigNode[] }>();
const CACHE_MS = 15_000;

function nodeNumericId(node: HierarchyConfigNode, fallback: number): number {
  return typeof node.id === 'number' ? node.id : fallback;
}

/** Map Entity List (hierarchy table) rows to template name items. */
export function hierarchiesToNameItems(entries: Hierarchy[]): TemplateNameItem[] {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    hierarchy_type: entry.hierarchy_type,
    parent_id: entry.parent_id ?? null,
    abbreviation: entry.abbreviation ?? null,
    parent_name: entry.parent_name ?? null,
  }));
}

export function configNodesToNameItems(nodes: HierarchyConfigNode[]): TemplateNameItem[] {
  const idByKey = new Map<string, number>();
  nodes.forEach((node, index) => {
    idByKey.set(node.client_key, nodeNumericId(node, index + 1));
  });
  const nameByKey = new Map(nodes.map((n) => [n.client_key, n.name]));

  return nodes.map((node, index) => {
    const parentKey = node.parent_client_key ?? null;
    return {
      id: nodeNumericId(node, index + 1),
      name: node.name,
      hierarchy_type: node.level,
      parent_id: parentKey ? (idByKey.get(parentKey) ?? null) : null,
      abbreviation: node.abbreviation ?? null,
      parent_name: parentKey ? (nameByKey.get(parentKey) ?? null) : null,
      client_key: node.client_key,
    };
  });
}

export function filterTemplateNames(
  items: TemplateNameItem[],
  level?: string,
  parentName?: string | null
): TemplateNameItem[] {
  let next = items;
  if (level) {
    next = next.filter((item) => item.hierarchy_type === level);
  }
  if (parentName != null && parentName !== '') {
    const needle = parentName.trim().toLowerCase();
    next = next.filter((item) => (item.parent_name ?? '').trim().toLowerCase() === needle);
  }
  const seen = new Set<string>();
  return next.filter((item) => {
    const key = `${item.hierarchy_type}:${item.name}:${item.parent_name ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchConfigNodes(configId: number): Promise<HierarchyConfigNode[]> {
  const cached = nodeCache.get(configId);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.nodes;
  }
  const res = await api.hierarchyConfigurations.get(configId);
  const nodes = res.data?.nodes ?? [];
  nodeCache.set(configId, { at: Date.now(), nodes });
  return nodes;
}

export async function loadProjectConfigNodes(
  configId?: number | null
): Promise<HierarchyConfigNode[]> {
  if (!configId) return [];
  try {
    return await fetchConfigNodes(configId);
  } catch {
    return [];
  }
}

export async function loadAvailableConfigNodes(): Promise<HierarchyConfigNode[]> {
  try {
    const summaries = await api.hierarchyConfigurations.listAvailable();
    const configs = await Promise.all(
      (summaries.data ?? []).map(async (summary) => {
        try {
          return await fetchConfigNodes(summary.id);
        } catch {
          return [] as HierarchyConfigNode[];
        }
      })
    );
    return configs.flat();
  } catch {
    return [];
  }
}

export async function loadAvailableConfigurations(): Promise<HierarchyConfiguration[]> {
  try {
    const summaries = await api.hierarchyConfigurations.listAvailable();
    const results = await Promise.all(
      (summaries.data ?? []).map(async (summary) => {
        try {
          return (await api.hierarchyConfigurations.get(summary.id)).data;
        } catch {
          return null;
        }
      })
    );
    return results.filter((c): c is HierarchyConfiguration => c != null);
  } catch {
    return [];
  }
}

/** Load names from the Entity List master catalog (Settings → Definitions → Entity List). */
export async function listEntityListNames(options?: {
  level?: string;
  parentName?: string | null;
}): Promise<TemplateNameItem[]> {
  try {
    const needsParentLookup = options?.parentName != null && options.parentName !== '';
    const res = await api.hierarchies.list(needsParentLookup ? undefined : options?.level);
    return filterTemplateNames(
      hierarchiesToNameItems(res.data ?? []),
      options?.level,
      options?.parentName
    );
  } catch {
    return [];
  }
}

/** @deprecated Use listEntityListNames — kept for call-site compatibility. */
export async function listTemplateNames(options?: {
  configId?: number | null;
  level?: string;
  parentName?: string | null;
}): Promise<TemplateNameItem[]> {
  if (options?.configId) {
    const nodes = await loadProjectConfigNodes(options.configId);
    return filterTemplateNames(
      configNodesToNameItems(nodes),
      options?.level,
      options?.parentName
    );
  }
  return listEntityListNames({ level: options?.level, parentName: options?.parentName });
}

export function childLevelOf(level: TemplateNodeLevel): TemplateNodeLevel | null {
  const entry = Object.entries(PARENT_TEMPLATE_LEVEL).find(([, parent]) => parent === level);
  return (entry?.[0] as TemplateNodeLevel | undefined) ?? null;
}
