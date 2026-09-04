import type { AppDefinitions } from '@/lib/models';

export type HierarchyEntityLevel =
  | 'project'
  | 'system'
  | 'subsystem'
  | 'module'
  | 'unit'
  | 'component';

export const HIERARCHY_ENTITY_LEVELS: HierarchyEntityLevel[] = [
  'project',
  'system',
  'subsystem',
  'module',
  'unit',
  'component',
];

const LEVEL_DEFAULTS = {
  project: {
    abbrev: 'PROJ',
  },
  system: {
    abbrev: 'SYS',
    part: 'PN-{levelAbbr}-{entityAbbr}-{year}-{vendor}-{seq:5}',
    serial: 'SN-{levelAbbr}-{entityAbbr}-{year}-{pnSeq:5}-{seq:5}',
  },
  subsystem: {
    abbrev: 'SUB',
    part: 'PN-{levelAbbr}-{entityAbbr}-{year}-{vendor}-{seq:5}',
    serial: 'SN-{levelAbbr}-{entityAbbr}-{year}-{pnSeq:5}-{seq:5}',
  },
  module: {
    abbrev: 'MOD',
    part: 'PN-{levelAbbr}-{entityAbbr}-{year}-{vendor}-{seq:5}',
    serial: 'SN-{levelAbbr}-{entityAbbr}-{year}-{pnSeq:5}-{seq:5}',
  },
  unit: {
    abbrev: 'UNIT',
    part: 'PN-{levelAbbr}-{entityAbbr}-{year}-{vendor}-{seq:5}',
    serial: 'SN-{levelAbbr}-{entityAbbr}-{year}-{pnSeq:5}-{seq:5}',
  },
  component: {
    abbrev: 'COMP',
    part: 'PN-{levelAbbr}-{entityAbbr}-{year}-{vendor}-{seq:5}',
    serial: 'SN-{levelAbbr}-{entityAbbr}-{year}-{pnSeq:5}-{seq:5}',
  },
} as const;

export const DEFAULT_APP_DEFINITIONS: Omit<AppDefinitions, 'id' | 'updated_at'> = {
  serial_number_template: '{project}-{name}{seq}',
  part_number_template: '{project}-{name}{seq}-PN',
  configuration_item_template: '{project}-{name}{seq}-CI',
  sku_template: '{serial}-SKU',
  label_project: 'Project',
  label_projects: 'Projects',
  abbrev_project: LEVEL_DEFAULTS.project.abbrev,
  label_system: 'System',
  label_systems: 'Systems',
  label_subsystem: 'Subsystem',
  label_subsystems: 'Subsystems',
  label_module: 'Module',
  label_modules: 'Modules',
  label_unit: 'Unit',
  label_units: 'Units',
  label_component: 'Component',
  label_components: 'Components',
  abbrev_system: LEVEL_DEFAULTS.system.abbrev,
  abbrev_subsystem: LEVEL_DEFAULTS.subsystem.abbrev,
  abbrev_module: LEVEL_DEFAULTS.module.abbrev,
  abbrev_unit: LEVEL_DEFAULTS.unit.abbrev,
  abbrev_component: LEVEL_DEFAULTS.component.abbrev,
  part_template_system: LEVEL_DEFAULTS.system.part,
  serial_template_system: LEVEL_DEFAULTS.system.serial,
  part_template_subsystem: LEVEL_DEFAULTS.subsystem.part,
  serial_template_subsystem: LEVEL_DEFAULTS.subsystem.serial,
  part_template_module: LEVEL_DEFAULTS.module.part,
  serial_template_module: LEVEL_DEFAULTS.module.serial,
  part_template_unit: LEVEL_DEFAULTS.unit.part,
  serial_template_unit: LEVEL_DEFAULTS.unit.serial,
  part_template_component: LEVEL_DEFAULTS.component.part,
  serial_template_component: LEVEL_DEFAULTS.component.serial,
  inventory_label_code_type: 'qr',
  inventory_qr_size_in: 0.65,
  inventory_barcode_width_in: 2,
  inventory_barcode_height_in: 0.5,
  inventory_qr_sticker_width_in: 1.25,
  inventory_qr_sticker_height_in: 1.25,
  inventory_barcode_sticker_width_in: 2.25,
  inventory_barcode_sticker_height_in: 0.9,
  inventory_location_tree: [],
};

export const TEMPLATE_PLACEHOLDER_HELP =
  'Tokens: {levelAbbr}, {entityAbbr}, {vendor}, {year}, {name}, {project}, {seq}, {seq:5}, {pnSeq:5}, {n}, {serial}. Admin chooses which segments to include.';

export type IdentifierTemplateVars = {
  project?: string;
  name?: string;
  seq?: number;
  pnSeq?: number;
  level?: string;
  levelLabel?: string;
  levelAbbr?: string;
  entityAbbr?: string;
  vendor?: string;
  serial?: string;
  year?: string;
};

function formatNum(value: number, width?: number): string {
  if (width && width > 0) return String(value).padStart(width, '0');
  return String(value);
}

export function applyIdentifierTemplate(
  template: string,
  vars: IdentifierTemplateVars
): string {
  const seqN = Math.max(1, vars.seq ?? 1);
  const pnN = Math.max(1, vars.pnSeq ?? seqN);
  const year = vars.year || String(new Date().getFullYear());
  const simple: Record<string, string> = {
    project: (vars.project || '').trim(),
    name: (vars.name || '').trim(),
    level: (vars.level || '').trim().toLowerCase(),
    Level: (vars.levelLabel || vars.level || '').trim(),
    levelAbbr: (vars.levelAbbr || '').trim(),
    entityAbbr: (vars.entityAbbr || '').trim(),
    vendor: (vars.vendor || '').trim(),
    year,
    serial: (vars.serial || '').trim(),
  };

  return (template || '').replace(
    /\{(seq|pnSeq|n)(?::(\d+))?\}|\{(project|name|level|Level|levelAbbr|entityAbbr|vendor|year|serial)\}/g,
    (_full, paddedKey?: string, widthStr?: string, plain?: string) => {
      if (paddedKey) {
        const width = widthStr ? parseInt(widthStr, 10) : undefined;
        if (paddedKey === 'seq') {
          if (width == null) return seqN > 1 ? `-${seqN}` : '';
          return formatNum(seqN, width);
        }
        if (paddedKey === 'pnSeq') return formatNum(pnN, width);
        if (paddedKey === 'n') return formatNum(seqN, width);
      }
      if (plain) return simple[plain] ?? '';
      return '';
    }
  );
}

/** Latest App Definitions from context (updated when settings are loaded/saved). */
let runtimeAppDefinitions: AppDefinitions = {
  id: 0,
  ...DEFAULT_APP_DEFINITIONS,
};

/**
 * Sync definitions for non-React call sites (charts, configs, getEntityLabel, search).
 * Called by AppDefinitionsProvider whenever the server payload changes.
 */
export function setRuntimeAppDefinitions(
  definitions: Partial<AppDefinitions> | null | undefined
): void {
  runtimeAppDefinitions = {
    id: definitions?.id ?? 0,
    ...DEFAULT_APP_DEFINITIONS,
    ...definitions,
  } as AppDefinitions;
}

export function getRuntimeAppDefinitions(): AppDefinitions {
  return runtimeAppDefinitions;
}

/**
 * Resolve a hierarchy level label from the current runtime definitions
 * (falls back to defaults until /definitions loads). Prefer `useAppDefinitions().entityLabel`
 * inside React so components re-render when definitions refresh.
 */
export function resolveEntityTypeLabel(level: string, plural = false): string {
  return getEntityTypeLabel(runtimeAppDefinitions, level, plural);
}

export function getEntityTypeLabel(
  definitions: Pick<
    AppDefinitions,
    | 'label_project'
    | 'label_projects'
    | 'label_system'
    | 'label_systems'
    | 'label_subsystem'
    | 'label_subsystems'
    | 'label_module'
    | 'label_modules'
    | 'label_unit'
    | 'label_units'
    | 'label_component'
    | 'label_components'
  > | null | undefined,
  level: string,
  plural = false
): string {
  const key = level.trim().toLowerCase() as HierarchyEntityLevel;
  const fallback = DEFAULT_APP_DEFINITIONS;
  const map: Record<HierarchyEntityLevel, { singular: string; plural: string }> = {
    project: {
      singular: definitions?.label_project || fallback.label_project,
      plural: definitions?.label_projects || fallback.label_projects,
    },
    system: {
      singular: definitions?.label_system || fallback.label_system,
      plural: definitions?.label_systems || fallback.label_systems,
    },
    subsystem: {
      singular: definitions?.label_subsystem || fallback.label_subsystem,
      plural: definitions?.label_subsystems || fallback.label_subsystems,
    },
    module: {
      singular: definitions?.label_module || fallback.label_module,
      plural: definitions?.label_modules || fallback.label_modules,
    },
    unit: {
      singular: definitions?.label_unit || fallback.label_unit,
      plural: definitions?.label_units || fallback.label_units,
    },
    component: {
      singular: definitions?.label_component || fallback.label_component,
      plural: definitions?.label_components || fallback.label_components,
    },
  };
  const entry = map[key];
  if (!entry) return level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Entity';
  return plural ? entry.plural : entry.singular;
}

export function getLevelAbbrev(
  definitions: AppDefinitions | null | undefined,
  level: string
): string {
  const key = level.trim().toLowerCase() as HierarchyEntityLevel;
  const d = definitions || DEFAULT_APP_DEFINITIONS;
  const map: Record<HierarchyEntityLevel, string> = {
    project: d.abbrev_project || DEFAULT_APP_DEFINITIONS.abbrev_project,
    system: d.abbrev_system || DEFAULT_APP_DEFINITIONS.abbrev_system,
    subsystem: d.abbrev_subsystem || DEFAULT_APP_DEFINITIONS.abbrev_subsystem,
    module: d.abbrev_module || DEFAULT_APP_DEFINITIONS.abbrev_module,
    unit: d.abbrev_unit || DEFAULT_APP_DEFINITIONS.abbrev_unit,
    component: d.abbrev_component || DEFAULT_APP_DEFINITIONS.abbrev_component,
  };
  return (map[key] || key.slice(0, 4)).toUpperCase();
}

export function getLevelPartTemplate(
  definitions: AppDefinitions | null | undefined,
  level: string
): string {
  const key = level.trim().toLowerCase() as HierarchyEntityLevel;
  const d = (definitions || DEFAULT_APP_DEFINITIONS) as AppDefinitions;
  const map: Record<HierarchyEntityLevel, string | undefined> = {
    project: undefined,
    system: d.part_template_system,
    subsystem: d.part_template_subsystem,
    module: d.part_template_module,
    unit: d.part_template_unit,
    component: d.part_template_component,
  };
  return (
    map[key]?.trim() ||
    d.part_number_template ||
    DEFAULT_APP_DEFINITIONS.part_number_template
  );
}

export function getLevelSerialTemplate(
  definitions: AppDefinitions | null | undefined,
  level: string
): string {
  const key = level.trim().toLowerCase() as HierarchyEntityLevel;
  const d = (definitions || DEFAULT_APP_DEFINITIONS) as AppDefinitions;
  const map: Record<HierarchyEntityLevel, string | undefined> = {
    project: undefined,
    system: d.serial_template_system,
    subsystem: d.serial_template_subsystem,
    module: d.serial_template_module,
    unit: d.serial_template_unit,
    component: d.serial_template_component,
  };
  return (
    map[key]?.trim() ||
    d.serial_number_template ||
    DEFAULT_APP_DEFINITIONS.serial_number_template
  );
}

export function suggestAbbreviation(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9\s-]/g, ' ');
  const words = cleaned.split(/[\s-]+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) {
    const w = words[0].toUpperCase();
    return w.length <= 3 ? w : w.slice(0, 2);
  }
  return words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

export function buildEntityIdentifiersFromDefinitions(
  definitions: AppDefinitions,
  vars: {
    project?: string;
    name: string;
    seq?: number;
    pnSeq?: number;
    level?: HierarchyEntityLevel;
    entityAbbr?: string;
    vendor?: string;
  }
) {
  const level = vars.level || 'system';
  const levelLabel = getEntityTypeLabel(definitions, level);
  const levelAbbr = getLevelAbbrev(definitions, level);
  const entityAbbr = (vars.entityAbbr || suggestAbbreviation(vars.name)).toUpperCase();
  const base = {
    project: vars.project || '',
    name: vars.name,
    seq: vars.seq,
    pnSeq: vars.pnSeq ?? vars.seq,
    level,
    levelLabel,
    levelAbbr,
    entityAbbr,
    vendor: vars.vendor || '',
  };
  const part = applyIdentifierTemplate(getLevelPartTemplate(definitions, level), base);
  const serial = applyIdentifierTemplate(getLevelSerialTemplate(definitions, level), {
    ...base,
    serial: '',
  });
  const configuration_item = applyIdentifierTemplate(
    definitions.configuration_item_template || DEFAULT_APP_DEFINITIONS.configuration_item_template,
    { ...base, serial }
  );
  const sku = applyIdentifierTemplate(
    definitions.sku_template || DEFAULT_APP_DEFINITIONS.sku_template,
    { ...base, serial }
  );
  return { serial_number: serial, part_number: part, configuration_item, sku, entityAbbr };
}

/** Next counters for inventory stock of a given hierarchy name + type. */
export function nextInventorySequences(
  inventory: Array<{
    inventory_type?: string | null;
    name?: string | null;
    entityName?: string | null;
    quantity?: number | null;
    part_number?: string | null;
    partNumber?: string | null;
    serial_number?: string | null;
    serialNumber?: string | null;
    serialNumbers?: string[] | null;
  }>,
  level: string,
  entityName: string
): { pnSeq: number; snSeq: number } {
  const name = entityName.trim().toLowerCase();
  const type = level.trim().toLowerCase();
  const same = inventory.filter((item) => {
    const n = (item.entityName || item.name || '').trim().toLowerCase();
    return (item.inventory_type || '').toLowerCase() === type && n === name;
  });
  const pnSeq = same.length + 1;
  const unitCount = same.reduce((sum, item) => {
    const snList = item.serialNumbers?.length ?? 0;
    if (snList > 0) return sum + snList;
    return sum + Math.max(1, Number(item.quantity) || 1);
  }, 0);
  return { pnSeq, snSeq: unitCount + 1 };
}
