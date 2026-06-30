import type { HierarchyListDashboardConfig } from '@/components/hierarchy/hierarchy-list-dashboard';

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

export const SUBSYSTEM_STATUS_NAMES = ['Design', 'Integration', 'Testing', 'Operational'];

export const SUBSYSTEMS_DASHBOARD_CONFIG: HierarchyListDashboardConfig = {
  entityPlural: 'Subsystems',
  entityScope: 'subsystem',
  statusNames: SUBSYSTEM_STATUS_NAMES,
  statusColors: LIFECYCLE_COLORS,
  readyStatusName: 'Operational',
  childKpi: { label: 'Modules', route: '/modules' },
  parentChartTitle: 'Subsystems by System',
  parentFilterLabel: 'System',
  hierarchyChartTitle: 'Modules per Subsystem',
  hierarchyCountLabel: 'modules',
  timelineLabel: 'Growth timeline',
  gradientId: 'subsystemsPageFill',
  detailRoute: (id) => `/subsystems/${id}`,
  parentDetailRoute: (id) => `/systems/${id}`,
};

export const MODULE_STATUS_NAMES = ['Design', 'Development', 'Testing', 'Integrated'];

export const MODULES_DASHBOARD_CONFIG: HierarchyListDashboardConfig = {
  entityPlural: 'Modules',
  entityScope: 'module',
  statusNames: MODULE_STATUS_NAMES,
  statusColors: LIFECYCLE_COLORS,
  readyStatusName: 'Integrated',
  childKpi: { label: 'Units', route: '/units' },
  parentChartTitle: 'Modules by Subsystem',
  parentFilterLabel: 'Subsystem',
  hierarchyChartTitle: 'Units per Module',
  hierarchyCountLabel: 'units',
  timelineLabel: 'Growth timeline',
  gradientId: 'modulesPageFill',
  detailRoute: (id) => `/modules/${id}`,
  parentDetailRoute: (id) => `/subsystems/${id}`,
};

export const UNIT_STATUS_NAMES = ['Manufacturing', 'Assembled', 'Testing', 'Qualified'];

export const UNITS_DASHBOARD_CONFIG: HierarchyListDashboardConfig = {
  entityPlural: 'Units',
  entityScope: 'unit',
  statusNames: UNIT_STATUS_NAMES,
  statusColors: LIFECYCLE_COLORS,
  readyStatusName: 'Qualified',
  childKpi: { label: 'Components', route: '/components' },
  parentChartTitle: 'Units by Module',
  parentFilterLabel: 'Module',
  hierarchyChartTitle: 'Components per Unit',
  hierarchyCountLabel: 'components',
  timelineLabel: 'Growth timeline',
  gradientId: 'unitsPageFill',
  detailRoute: (id) => `/units/${id}`,
  parentDetailRoute: (id) => `/modules/${id}`,
};

export const COMPONENT_STATUS_NAMES = ['Procured', 'In Inspection', 'Approved', 'Rejected'];

export const COMPONENTS_DASHBOARD_CONFIG: HierarchyListDashboardConfig = {
  entityPlural: 'Components',
  entityScope: 'component',
  statusNames: COMPONENT_STATUS_NAMES,
  statusColors: LIFECYCLE_COLORS,
  readyStatusName: 'Approved',
  childKpi: { label: 'Inventory', route: '/inventory' },
  parentChartTitle: 'Components by Unit',
  parentFilterLabel: 'Unit',
  hierarchyChartTitle: 'Inventory per Component',
  hierarchyCountLabel: 'inventory',
  timelineLabel: 'Growth timeline',
  gradientId: 'componentsPageFill',
  detailRoute: (id) => `/components/${id}`,
  parentDetailRoute: (id) => `/units/${id}`,
};
