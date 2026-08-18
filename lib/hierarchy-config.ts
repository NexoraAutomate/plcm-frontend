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

export type TemplateDraftNode = {
  client_key: string;
  parent_client_key?: string | null;
  level: TemplateNodeLevel;
  name: string;
  description?: string | null;
  abbreviation?: string | null;
  sort_order?: number;
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
