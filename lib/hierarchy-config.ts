/**
 * Spec 01 — Smart SDLS hierarchy configuration constants & helpers.
 */

export const FIXED_HIERARCHY_LEVELS = [
  { code: 'product_type', label: 'Product Type', isTemplateLevel: false },
  { code: 'flight', label: 'Flight', isTemplateLevel: false },
  { code: 'sdls', label: 'SDLS', isTemplateLevel: false },
  { code: 'system', label: 'System', isTemplateLevel: true },
  { code: 'subsystem', label: 'Subsystem', isTemplateLevel: true },
  { code: 'module', label: 'Module', isTemplateLevel: true },
  { code: 'unit', label: 'Unit', isTemplateLevel: true },
  { code: 'component', label: 'Component', isTemplateLevel: true },
] as const;

export type TemplateNodeLevel = 'system' | 'subsystem' | 'module' | 'unit' | 'component';

export const TEMPLATE_NODE_LEVELS: TemplateNodeLevel[] = [
  'system',
  'subsystem',
  'module',
  'unit',
  'component',
];

export const PARENT_TEMPLATE_LEVEL: Record<TemplateNodeLevel, TemplateNodeLevel | null> = {
  system: null,
  subsystem: 'system',
  module: 'subsystem',
  unit: 'module',
  component: 'unit',
};

export const CHILD_TEMPLATE_LEVEL: Record<TemplateNodeLevel, TemplateNodeLevel | null> = {
  system: 'subsystem',
  subsystem: 'module',
  module: 'unit',
  unit: 'component',
  component: null,
};

export const INVENTORY_SOURCE = {
  TURNKEY: 'turnkey',
  BUILD_FROM_CHILDREN: 'build_from_children',
  GROUP: 'group',
} as const;

export type InventorySource =
  (typeof INVENTORY_SOURCE)[keyof typeof INVENTORY_SOURCE];

export const INVENTORY_SOURCE_OPTIONS: Array<{
  value: InventorySource;
  label: string;
  description: string;
  /** When true, only valid on nodes that currently have children. */
  requiresChildren: boolean;
}> = [
  {
    value: INVENTORY_SOURCE.TURNKEY,
    label: 'Turnkey / Procured',
    description:
      'This item is directly received from a vendor and can be added to inventory by the Inventory Manager.',
    requiresChildren: false,
  },
  {
    value: INVENTORY_SOURCE.BUILD_FROM_CHILDREN,
    label: 'Build from Children',
    description:
      'This item is automatically created in inventory when its required child items are installed and verified.',
    requiresChildren: true,
  },
  {
    value: INVENTORY_SOURCE.GROUP,
    label: 'Group',
    description:
      'Logical grouping only — no inventory item. Becomes install verified when all children are install verified.',
    requiresChildren: true,
  },
];

export function normalizeInventorySource(
  value?: string | null
): InventorySource {
  const raw = (value || INVENTORY_SOURCE.TURNKEY)
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, '_');
  if (raw === 'build_from_children' || raw === 'build') {
    return INVENTORY_SOURCE.BUILD_FROM_CHILDREN;
  }
  if (raw === 'group' || raw === 'logical_group') {
    return INVENTORY_SOURCE.GROUP;
  }
  return INVENTORY_SOURCE.TURNKEY;
}

export function inventorySourceLabel(value?: string | null): string {
  const source = normalizeInventorySource(value);
  if (source === INVENTORY_SOURCE.BUILD_FROM_CHILDREN) return 'Build';
  if (source === INVENTORY_SOURCE.GROUP) return 'Group';
  return 'Turnkey';
}

export function requiresChildrenSource(value?: string | null): boolean {
  const source = normalizeInventorySource(value);
  return (
    source === INVENTORY_SOURCE.BUILD_FROM_CHILDREN ||
    source === INVENTORY_SOURCE.GROUP
  );
}

export type TemplateDraftNode = {
  client_key: string;
  parent_client_key?: string | null;
  level: TemplateNodeLevel;
  name: string;
  description?: string | null;
  abbreviation?: string | null;
  sort_order?: number;
  inventory_source?: InventorySource;
};

export const DEFAULT_PRODUCT_TYPES = [
  { code: 'SSDLS-1', name: 'High Data Rate', description: 'SSDLS-1 — High Data Rate product type' },
  { code: 'SSDLS-2', name: 'Low Data Rate', description: 'SSDLS-2 — Low Data Rate product type' },
] as const;

export const DEFAULT_CONFIG_NOTES =
  'Customer order defines Product Type, number of Flights, and number of SDLS ' +
  'per Flight (project scope — Spec 02). Admin defines the common lower-level ' +
  'hierarchy (System → Component) once in this configuration.';

export function newClientKey(prefix = 'n'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** True when this node may use Build or Group (non-component with at least one child). */
export function canBuildFromChildren(
  nodes: TemplateDraftNode[],
  clientKey: string
): boolean {
  const node = nodes.find((n) => n.client_key === clientKey);
  if (!node || node.level === 'component') return false;
  return nodes.some((n) => n.parent_client_key === clientKey);
}

export function parentKeysWithChildren(nodes: TemplateDraftNode[]): Set<string> {
  const keys = new Set<string>();
  for (const n of nodes) {
    if (n.parent_client_key) keys.add(n.parent_client_key);
  }
  return keys;
}

/**
 * Coerce invalid inventory sources only:
 * - leaves / components → Turnkey
 * - parents keep Turnkey, Build, or Group as chosen
 */
export function syncInventorySources(
  nodes: TemplateDraftNode[]
): TemplateDraftNode[] {
  const parents = parentKeysWithChildren(nodes);
  return nodes.map((n) => {
    const canParent = n.level !== 'component' && parents.has(n.client_key);
    const current = normalizeInventorySource(n.inventory_source);
    if (!canParent) {
      if (current === INVENTORY_SOURCE.TURNKEY) return n;
      return { ...n, inventory_source: INVENTORY_SOURCE.TURNKEY };
    }
    if (
      current === INVENTORY_SOURCE.TURNKEY ||
      current === INVENTORY_SOURCE.BUILD_FROM_CHILDREN ||
      current === INVENTORY_SOURCE.GROUP
    ) {
      if (n.inventory_source === current) return n;
      return { ...n, inventory_source: current };
    }
    return { ...n, inventory_source: INVENTORY_SOURCE.BUILD_FROM_CHILDREN };
  });
}

/** @deprecated use syncInventorySources */
export function coerceInventorySources(
  nodes: TemplateDraftNode[]
): TemplateDraftNode[] {
  return syncInventorySources(nodes);
}
