export const CHART_COLORS = [
  'oklch(0.62 0.15 250)',
  'oklch(0.55 0.14 250)',
  'oklch(0.65 0.15 165)',
  'oklch(0.70 0.18 45)',
  'oklch(0.55 0.2 15)',
  'oklch(0.60 0.12 280)',
  'oklch(0.58 0.16 200)',
  'oklch(0.72 0.14 130)',
];

export const ACCENT_BORDER: Record<string, string> = {
  projects: 'ring-2 ring-blue-500/40 border-blue-500/30',
  maintenance: 'ring-2 ring-amber-500/40 border-amber-500/30',
  product_structure: 'ring-2 ring-violet-500/40 border-violet-500/30',
  configuration: 'ring-2 ring-cyan-500/40 border-cyan-500/30',
  reliability: 'ring-2 ring-red-500/40 border-red-500/30',
  resources: 'ring-2 ring-emerald-500/40 border-emerald-500/30',
  activities: 'ring-2 ring-slate-500/40 border-slate-500/30',
};

export const KPI_SECTION_MAP: Record<string, string[]> = {
  total_customers: ['product_structure', 'resources'],
  total_orders: ['product_structure', 'resources'],
  total_projects: ['projects', 'resources'],
  active_projects: ['projects'],
  completed_projects: ['projects'],
  delayed_projects: ['projects'],
  open_maintenance_cases: ['maintenance', 'activities'],
  open_faulty_entities: ['maintenance', 'reliability'],
  components_under_investigation: ['maintenance', 'reliability'],
  config_changes_this_month: ['configuration', 'activities'],
};
