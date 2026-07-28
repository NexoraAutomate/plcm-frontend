export interface ExecTrend {
  direction: 'up' | 'down' | 'flat';
  value: string;
  positive?: boolean;
}

/** Explains how a metric is derived and why it matters for decisions. */
export interface ExecInsight {
  calculation: string;
  benefit: string;
}

export interface ExecNamedValue {
  name: string;
  value: number;
  id?: number | null;
  color?: string;
}

export interface ExecSeriesPoint {
  month: string;
  [key: string]: string | number;
}

export interface ExecGaugeMetric {
  label: string;
  value: number;
  displayValue: string;
  unit?: string;
  max: number;
  trend?: ExecTrend;
  color: string;
  /** False when denominator is missing / metric is undefined. */
  available?: boolean;
  insight?: ExecInsight;
}

export interface ExecMilestonePoint {
  month: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  y: number;
  name: string;
  count?: number;
}

export interface ExecTreemapNode {
  name: string;
  value: number;
  id?: number | null;
  entityType?: string;
  children?: ExecTreemapNode[];
}

export interface ExecConfigChangeRow {
  id: number;
  partNumber: string;
  reason: string;
  status: string;
  date: string;
}

export interface ExecAlert {
  id: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  title: string;
  timeAgo: string;
}

export interface ExecFilterOption {
  value: string;
  label: string;
}

export interface ExecFiltersState {
  customerId?: string;
  programId?: string;
  projectId?: string;
  dateRange?: string;
}

export interface CommandCenterViewModel {
  generatedAt: string | null;
  programHealth: ExecGaugeMetric;
  activePrograms: {
    value: number;
    trend?: ExecTrend;
    sparkline: number[];
    insight: ExecInsight;
  };
  portfolioTrend: ExecSeriesPoint[];
  portfolioTotals: { started: number; completed: number; delayed: number };
  portfolioInsight: ExecInsight;
  mttr: ExecGaugeMetric;
  mtbf: ExecGaugeMetric;
  spi: ExecGaugeMetric;
  openMaintenanceCases: { value: number; trend?: ExecTrend; insight: ExecInsight };
  delayedProjects: { value: number; trend?: ExecTrend; insight: ExecInsight };
  projectsByStatus: ExecNamedValue[];
  projectsByStatusInsight: ExecInsight;
  milestones: ExecMilestonePoint[];
  milestonesInsight: ExecInsight;
  topDelayed: ExecNamedValue[];
  topDelayedInsight: ExecInsight;
  systemAvailability: ExecNamedValue[];
  systemAvailabilityInsight: ExecInsight;
  hierarchy: ExecTreemapNode[];
  hierarchyInsight: ExecInsight;
  topModifiedComponents: ExecNamedValue[];
  recentChanges: ExecConfigChangeRow[];
  configInsight: ExecInsight;
  projectsByCustomer: ExecNamedValue[];
  projectsByCustomerInsight: ExecInsight;
  alerts: ExecAlert[];
  alertsInsight: ExecInsight;
  maintenanceByStatus: ExecNamedValue[];
  maintenanceByStatusInsight: ExecInsight;
  maintenanceTrend: ExecNamedValue[];
  maintenanceTrendInsight: ExecInsight;
  faultsByType: ExecNamedValue[];
  faultsByTypeInsight: ExecInsight;
  faultVsMttr: ExecSeriesPoint[];
  faultVsMttrInsight: ExecInsight;
  filtersInsight: ExecInsight;
}
