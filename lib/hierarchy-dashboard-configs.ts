import type { HierarchyListDashboardConfig } from '@/components/hierarchy/hierarchy-list-dashboard';
import { resolveEntityTypeLabel } from '@/lib/app-definitions';

const LIFECYCLE_COLORS: Record<string, string> = {
  Design: 'oklch(0.62 0.15 250)',
  Development: 'oklch(0.70 0.18 45)',
  Integration: 'oklch(0.70 0.18 45)',
  Testing: 'oklch(0.60 0.12 280)',
  Operational: 'oklch(0.65 0.15 165)',
  Integrated: 'oklch(0.65 0.15 165)',
  Manufacturing: 'oklch(0.62 0.15 250)',
  Assembled: 'oklch(0.70 0.18 45)',
  Qualified: 'oklch(0.65 0.15 165)',
  Procured: 'oklch(0.62 0.15 250)',
  'In Inspection': 'oklch(0.60 0.12 280)',
  Approved: 'oklch(0.65 0.15 165)',
  Rejected: 'oklch(0.55 0.2 15)',
};

export type EntityLabelFn = (level: string, plural?: boolean) => string;

export const SUBSYSTEM_STATUS_NAMES = ['Design', 'Integration', 'Testing', 'Operational'];

export function getSubsystemsDashboardConfig(
  label: EntityLabelFn = resolveEntityTypeLabel
): HierarchyListDashboardConfig {
  return {
    entityPlural: label('subsystem', true),
    entityScope: 'subsystem',
    statusNames: SUBSYSTEM_STATUS_NAMES,
    statusColors: LIFECYCLE_COLORS,
    readyStatusName: 'Operational',
    childKpi: { label: label('module', true), route: '/modules' },
    parentChartTitle: `${label('subsystem', true)} by ${label('system')}`,
    parentFilterLabel: label('system'),
    hierarchyChartTitle: `${label('module', true)} per ${label('subsystem')}`,
    hierarchyCountLabel: label('module', true).toLowerCase(),
    timelineLabel: 'Growth timeline',
    gradientId: 'subsystemsPageFill',
    detailRoute: (id) => `/subsystems/${id}`,
    parentDetailRoute: (id) => `/systems/${id}`,
  };
}

/** @deprecated Use getSubsystemsDashboardConfig(entityLabel) for live renames */
export const SUBSYSTEMS_DASHBOARD_CONFIG = getSubsystemsDashboardConfig();

export const MODULE_STATUS_NAMES = ['Design', 'Development', 'Testing', 'Integrated'];

export function getModulesDashboardConfig(
  label: EntityLabelFn = resolveEntityTypeLabel
): HierarchyListDashboardConfig {
  return {
    entityPlural: label('module', true),
    entityScope: 'module',
    statusNames: MODULE_STATUS_NAMES,
    statusColors: LIFECYCLE_COLORS,
    readyStatusName: 'Integrated',
    childKpi: { label: label('unit', true), route: '/units' },
    parentChartTitle: `${label('module', true)} by ${label('subsystem')}`,
    parentFilterLabel: label('subsystem'),
    hierarchyChartTitle: `${label('unit', true)} per ${label('module')}`,
    hierarchyCountLabel: label('unit', true).toLowerCase(),
    timelineLabel: 'Growth timeline',
    gradientId: 'modulesPageFill',
    detailRoute: (id) => `/modules/${id}`,
    parentDetailRoute: (id) => `/subsystems/${id}`,
  };
}

/** @deprecated Use getModulesDashboardConfig(entityLabel) for live renames */
export const MODULES_DASHBOARD_CONFIG = getModulesDashboardConfig();

export const UNIT_STATUS_NAMES = ['Manufacturing', 'Assembled', 'Testing', 'Qualified'];

export function getUnitsDashboardConfig(
  label: EntityLabelFn = resolveEntityTypeLabel
): HierarchyListDashboardConfig {
  return {
    entityPlural: label('unit', true),
    entityScope: 'unit',
    statusNames: UNIT_STATUS_NAMES,
    statusColors: LIFECYCLE_COLORS,
    readyStatusName: 'Qualified',
    childKpi: { label: label('component', true), route: '/components' },
    parentChartTitle: `${label('unit', true)} by ${label('module')}`,
    parentFilterLabel: label('module'),
    hierarchyChartTitle: `${label('component', true)} per ${label('unit')}`,
    hierarchyCountLabel: label('component', true).toLowerCase(),
    timelineLabel: 'Growth timeline',
    gradientId: 'unitsPageFill',
    detailRoute: (id) => `/units/${id}`,
    parentDetailRoute: (id) => `/modules/${id}`,
  };
}

/** @deprecated Use getUnitsDashboardConfig(entityLabel) for live renames */
export const UNITS_DASHBOARD_CONFIG = getUnitsDashboardConfig();

export const COMPONENT_STATUS_NAMES = ['Procured', 'In Inspection', 'Approved', 'Rejected'];

export function getComponentsDashboardConfig(
  label: EntityLabelFn = resolveEntityTypeLabel
): HierarchyListDashboardConfig {
  return {
    entityPlural: label('component', true),
    entityScope: 'component',
    statusNames: COMPONENT_STATUS_NAMES,
    statusColors: LIFECYCLE_COLORS,
    readyStatusName: 'Approved',
    childKpi: { label: 'Inventory', route: '/inventory' },
    parentChartTitle: `${label('component', true)} by ${label('unit')}`,
    parentFilterLabel: label('unit'),
    hierarchyChartTitle: `Inventory per ${label('component')}`,
    hierarchyCountLabel: 'inventory',
    timelineLabel: 'Growth timeline',
    gradientId: 'componentsPageFill',
    detailRoute: (id) => `/components/${id}`,
    parentDetailRoute: (id) => `/units/${id}`,
  };
}

/** @deprecated Use getComponentsDashboardConfig(entityLabel) for live renames */
export const COMPONENTS_DASHBOARD_CONFIG = getComponentsDashboardConfig();
