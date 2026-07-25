export interface ExecTrend {
  direction: 'up' | 'down' | 'flat';
  value: string;
  positive?: boolean;
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
    trend: ExecTrend;
    sparkline: number[];
  };
  portfolioTrend: ExecSeriesPoint[];
  portfolioTotals: { started: number; completed: number; delayed: number };
  mttr: ExecGaugeMetric;
  mtbf: ExecGaugeMetric;
  spi: ExecGaugeMetric;
  openMaintenanceCases: { value: number; trend: ExecTrend };
  delayedProjects: { value: number; trend: ExecTrend };
  projectsByStatus: ExecNamedValue[];
  milestones: ExecMilestonePoint[];
  topDelayed: ExecNamedValue[];
  systemAvailability: ExecNamedValue[];
  hierarchy: ExecTreemapNode[];
  topModifiedComponents: ExecNamedValue[];
  recentChanges: ExecConfigChangeRow[];
  projectsByCustomer: ExecNamedValue[];
  alerts: ExecAlert[];
  maintenanceByStatus: ExecNamedValue[];
  maintenanceTrend: ExecNamedValue[];
  faultsByType: ExecNamedValue[];
  faultVsMttr: ExecSeriesPoint[];
}
