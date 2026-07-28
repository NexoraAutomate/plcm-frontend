export interface KpiMetric {
  key: string;
  label: string;
  value: number;
  change_percent: number | null;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string | null;
  id?: number | null;
}

export interface StackedBarSeries {
  name: string;
  data: ChartDataPoint[];
}

export interface StackedBarGroup {
  group: string;
  series: StackedBarSeries[];
}

export interface ProjectProgressItem {
  id: number;
  name: string;
  progress: number;
  status_name?: string | null;
  end_date?: string | null;
  days_overdue?: number | null;
}

export interface TreemapNode {
  name: string;
  value: number;
  entity_type: string;
  id?: number | null;
  href_key?: string | null;
  children: TreemapNode[];
}

export interface GaugeMetric {
  label: string;
  value: number;
  unit: string;
  max_value: number;
}

export interface ActivityItem {
  id: number;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  timestamp: string;
  link_type: string;
  link_id: number;
}

export interface ExecutiveKpisSection {
  metrics: KpiMetric[];
}

export interface ProjectAnalyticsSection {
  status_distribution: ChartDataPoint[];
  timeline: ChartDataPoint[];
  completed_timeline?: ChartDataPoint[];
  progress: ProjectProgressItem[];
}

export interface MaintenanceAnalyticsSection {
  cases_by_status: ChartDataPoint[];
  fault_by_project: StackedBarGroup[];
  monthly_trend: ChartDataPoint[];
}

export interface ProductStructureSection {
  tree: TreemapNode[];
}

export interface ConfigurationSection {
  changes_by_month: ChartDataPoint[];
  top_modified_components: ChartDataPoint[];
  recent_timeline: ActivityItem[];
}

export interface ReliabilitySection {
  top_faulty_components: ChartDataPoint[];
  fault_type_distribution: ChartDataPoint[];
  mttr: GaugeMetric;
  mtbf: GaugeMetric;
}

export interface ResourcesSection {
  projects_by_owner: ChartDataPoint[];
  projects_by_customer: ChartDataPoint[];
  projects_by_order: ChartDataPoint[];
}

export interface RecentActivitiesSection {
  maintenance_cases: ActivityItem[];
  configuration_changes: ActivityItem[];
  projects: ActivityItem[];
  fault_confirmations: ActivityItem[];
  user_activities: ActivityItem[];
}

export interface ExecutiveDashboardResponse {
  kpis: ExecutiveKpisSection;
  projects: ProjectAnalyticsSection;
  maintenance: MaintenanceAnalyticsSection;
  product_structure: ProductStructureSection;
  configuration: ConfigurationSection;
  reliability: ReliabilitySection;
  resources: ResourcesSection;
  activities: RecentActivitiesSection;
  generated_at: string;
}

export interface ExecutiveDashboardFilters {
  customer_id?: number;
  order_id?: number;
  project_id?: number;
  date_from?: string;
  date_to?: string;
  project_status?: string;
  maintenance_status?: string;
  configuration_status?: string;
  kpi_filter?: string;
}

export type DashboardSectionKey =
  | 'projects'
  | 'maintenance'
  | 'product_structure'
  | 'configuration'
  | 'reliability'
  | 'resources'
  | 'activities';
