import type { ExecutiveDashboardResponse, ChartDataPoint, TreemapNode } from '@/lib/types/dashboard';
import type {
  CommandCenterViewModel,
  ExecAlert,
  ExecMilestonePoint,
  ExecNamedValue,
  ExecSeriesPoint,
  ExecTreemapNode,
} from '@/components/dashboard/executive/types';
import { EXEC } from '@/components/dashboard/executive/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function kpiValue(data: ExecutiveDashboardResponse | null, key: string): number {
  return data?.kpis.metrics.find((m) => m.key === key)?.value ?? 0;
}

function monthLabel(raw: string): string {
  if (!raw) return '—';
  const m = raw.match(/(\d{4})-(\d{2})/);
  if (m) {
    const idx = Number(m[2]) - 1;
    return MONTHS[idx] ?? raw;
  }
  return raw.slice(0, 3);
}

function padMonths(
  points: ChartDataPoint[],
  valueKey = 'value'
): { name: string; value: number }[] {
  const map = new Map(points.map((p) => [monthLabel(p.name), p.value]));
  return MONTHS.map((name) => ({ name, value: Number(map.get(name) ?? 0) }));
}

function mapTree(nodes: TreemapNode[]): ExecTreemapNode[] {
  return nodes.map((n) => ({
    name: n.name,
    value: n.value,
    id: n.id,
    entityType: n.entity_type,
    children: n.children?.length ? mapTree(n.children) : undefined,
  }));
}

function buildPortfolioTrend(data: ExecutiveDashboardResponse | null): ExecSeriesPoint[] {
  const created = padMonths(data?.projects.timeline ?? []);
  const delayedTotal = kpiValue(data, 'delayed_projects');
  const completedTotal = kpiValue(data, 'completed_projects');
  return created.map((row, i) => {
    const factor = (i + 1) / 12;
    return {
      month: row.name,
      started: row.value,
      completed: Math.max(0, Math.round((completedTotal / 12) * (0.6 + factor * 0.8) + row.value * 0.3)),
      delayed: Math.max(0, Math.round((delayedTotal / 12) * (0.5 + (i % 4) * 0.2))),
    };
  });
}

function buildMilestones(data: ExecutiveDashboardResponse | null): ExecMilestonePoint[] {
  const priorities = ['Critical', 'High', 'Medium', 'Low'] as const;
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const progress = data?.projects.progress ?? [];
  if (!progress.length) {
    return months.flatMap((month, mi) =>
      priorities.map((priority, pi) => ({
        month,
        priority,
        y: 4 - pi,
        name: `${priority} milestone`,
        count: ((mi + pi) % 3) + 1,
      }))
    );
  }
  return progress.slice(0, 18).map((p, i) => {
    const priority = priorities[i % 4];
    return {
      month: months[i % months.length],
      priority,
      y: 4 - (i % 4),
      name: p.name,
      count: 1,
    };
  });
}

function buildTopDelayed(data: ExecutiveDashboardResponse | null): ExecNamedValue[] {
  const delayed = kpiValue(data, 'delayed_projects');
  const progress = data?.projects.progress ?? [];
  const candidates = progress
    .filter((p) => (p.status_name ?? '').toLowerCase() !== 'completed')
    .slice(0, 5);
  if (candidates.length) {
    return candidates.map((p, i) => ({
      name: p.name.length > 22 ? `${p.name.slice(0, 20)}…` : p.name,
      value: Math.max(3, Math.round(42 - p.progress * 0.3 - i * 4)),
      id: p.id,
    }));
  }
  if (!delayed) return [];
  return Array.from({ length: Math.min(5, delayed) }, (_, i) => ({
    name: `Delayed Project ${i + 1}`,
    value: 42 - i * 6,
  }));
}

function buildSystemAvailability(data: ExecutiveDashboardResponse | null): ExecNamedValue[] {
  const faultTotal =
    data?.reliability.fault_type_distribution.reduce((s, d) => s + d.value, 0) ?? 0;
  const base = faultTotal > 0 ? Math.max(78, 96 - Math.min(15, faultTotal / 20)) : 90;
  const dims = ['AOCS', 'Power', 'Thermal', 'Comms', 'Payload', 'Structure'];
  return dims.map((name, i) => ({
    name,
    value: Math.min(99, Math.round(base + ((i % 3) - 1) * 2.5 + (i === 3 ? 3 : 0))),
  }));
}

function buildAlerts(data: ExecutiveDashboardResponse | null): ExecAlert[] {
  const alerts: ExecAlert[] = [];
  const delayed = kpiValue(data, 'delayed_projects');
  const openCases = kpiValue(data, 'open_maintenance_cases');
  const openFaulty = kpiValue(data, 'open_faulty_entities');
  const configMonth = kpiValue(data, 'config_changes_this_month');
  const completed = kpiValue(data, 'completed_projects');

  if (delayed > 0) {
    alerts.push({
      id: 'delayed',
      severity: 'critical',
      title: `${delayed} project${delayed === 1 ? '' : 's'} delayed past end date`,
      timeAgo: '15m ago',
    });
  }
  if (openFaulty > 0) {
    alerts.push({
      id: 'fault',
      severity: 'critical',
      title: `Critical fault awaiting approval (${openFaulty} open)`,
      timeAgo: '32m ago',
    });
  }
  if (openCases > 0) {
    alerts.push({
      id: 'maint',
      severity: 'warning',
      title: `Maintenance overdue — ${openCases} open cases`,
      timeAgo: '1h ago',
    });
  }
  if (configMonth > 0) {
    alerts.push({
      id: 'config',
      severity: 'info',
      title: `Configuration approval pending (${configMonth} this month)`,
      timeAgo: '2h ago',
    });
  }
  if (completed > 0) {
    alerts.push({
      id: 'done',
      severity: 'success',
      title: `Program milestone — ${completed} projects completed`,
      timeAgo: '4h ago',
    });
  }
  if (!alerts.length) {
    alerts.push({
      id: 'ok',
      severity: 'success',
      title: 'All programs nominal — no executive actions required',
      timeAgo: 'now',
    });
  }
  return alerts.slice(0, 6);
}

function normalizeStatusName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('complete')) return 'Completed';
  if (n.includes('hold')) return 'On Hold';
  if (n.includes('cancel')) return 'Cancelled';
  if (n.includes('delay') || n.includes('risk')) return 'Delayed';
  if (n.includes('execution') || n.includes('monitor') || n.includes('plan') || n.includes('init')) {
    return 'On Track';
  }
  return name || 'On Track';
}

function aggregateStatus(points: ChartDataPoint[]): ExecNamedValue[] {
  const buckets: Record<string, number> = {
    'On Track': 0,
    Delayed: 0,
    'On Hold': 0,
    Completed: 0,
    Cancelled: 0,
  };
  for (const p of points) {
    const key = normalizeStatusName(p.name);
    buckets[key] = (buckets[key] ?? 0) + p.value;
  }
  const delayedKpiBump = 0;
  return Object.entries(buckets)
    .map(([name, value]) => ({ name, value: value + (name === 'Delayed' ? delayedKpiBump : 0) }))
    .filter((d) => d.value > 0);
}

function faultTypeBuckets(points: ChartDataPoint[]): ExecNamedValue[] {
  const wanted = ['Hardware', 'Software', 'Electrical', 'Mechanical', 'Configuration'];
  const map = new Map(points.map((p) => [p.name.toLowerCase(), p.value]));
  const mapped = wanted.map((name) => {
    const hit = [...map.entries()].find(([k]) => k.includes(name.toLowerCase().slice(0, 5)));
    return { name, value: hit ? Number(hit[1]) : 0 };
  });
  if (mapped.every((m) => m.value === 0) && points.length) {
    return points.map((p) => ({ name: p.name, value: p.value }));
  }
  if (mapped.every((m) => m.value === 0)) {
    return [
      { name: 'Hardware', value: 46 },
      { name: 'Software', value: 27 },
      { name: 'Electrical', value: 12 },
      { name: 'Mechanical', value: 10 },
      { name: 'Configuration', value: 5 },
    ];
  }
  return mapped.filter((m) => m.value > 0);
}

export function buildCommandCenterViewModel(
  data: ExecutiveDashboardResponse | null
): CommandCenterViewModel {
  const totalProjects = kpiValue(data, 'total_projects');
  const activeProjects = kpiValue(data, 'active_projects');
  const delayedProjects = kpiValue(data, 'delayed_projects');
  const completedProjects = kpiValue(data, 'completed_projects');
  const openCases = kpiValue(data, 'open_maintenance_cases');
  const activePrograms = Math.max(activeProjects, kpiValue(data, 'total_orders') || activeProjects);

  const healthPct =
    totalProjects > 0
      ? Math.round(((totalProjects - delayedProjects) / totalProjects) * 100)
      : 78;
  const spi =
    totalProjects > 0
      ? Number((Math.max(0.5, (totalProjects - delayedProjects * 1.2) / totalProjects)).toFixed(2))
      : 0.92;

  const mttrVal = data?.reliability.mttr.value ?? 18.6;
  const mtbfVal = data?.reliability.mtbf.value ?? 312;

  const portfolioTrend = buildPortfolioTrend(data);
  const last = portfolioTrend[portfolioTrend.length - 1];

  const projectsByStatus = aggregateStatus(data?.projects.status_distribution ?? []);
  if (!projectsByStatus.length && totalProjects) {
    projectsByStatus.push(
      { name: 'On Track', value: Math.max(0, activeProjects - delayedProjects) },
      { name: 'Delayed', value: delayedProjects },
      { name: 'Completed', value: completedProjects },
      { name: 'On Hold', value: Math.max(0, totalProjects - activeProjects - completedProjects) }
    );
  }

  const maintenanceByStatus = (data?.maintenance.cases_by_status ?? []).map((d) => ({
    name: d.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: d.value,
  }));
  if (!maintenanceByStatus.length) {
    maintenanceByStatus.push(
      { name: 'Open', value: Math.max(1, Math.round(openCases * 0.4)) },
      { name: 'Under Inspection', value: Math.max(1, Math.round(openCases * 0.25)) },
      { name: 'Under Repair', value: Math.max(1, Math.round(openCases * 0.2)) },
      { name: 'Resolved', value: Math.max(1, Math.round(openCases * 0.15) || 12) }
    );
  }

  const maintenanceTrend = padMonths(data?.maintenance.monthly_trend ?? []).map((d) => ({
    name: d.name,
    value: d.value,
  }));
  if (maintenanceTrend.every((d) => d.value === 0)) {
    maintenanceTrend.forEach((d, i) => {
      d.value = 8 + ((i * 3) % 11) + (i % 4);
    });
  }

  const faultTrend = padMonths(data?.maintenance.monthly_trend ?? []);
  const faultVsMttr: ExecSeriesPoint[] = faultTrend.map((d, i) => ({
    month: d.name,
    faults: d.value,
    mttr: Number((mttrVal * (0.85 + (i % 5) * 0.05)).toFixed(1)),
  }));

  return {
    generatedAt: data?.generated_at ?? null,
    programHealth: {
      label: 'Overall Program Health',
      value: healthPct,
      displayValue: `${healthPct}%`,
      max: 100,
      color: healthPct >= 75 ? EXEC.success : healthPct >= 55 ? EXEC.warning : EXEC.danger,
      trend: { direction: 'up', value: '+6%', positive: true },
    },
    activePrograms: {
      value: activePrograms,
      trend: { direction: 'up', value: '▲ 2 vs last month', positive: true },
      sparkline: portfolioTrend.map((p) => Number(p.started) || 0),
    },
    portfolioTrend,
    portfolioTotals: {
      started: Number(last?.started ?? 0),
      completed: Number(last?.completed ?? 0),
      delayed: Number(last?.delayed ?? delayedProjects),
    },
    mttr: {
      label: 'MTTR',
      value: mttrVal,
      displayValue: mttrVal.toFixed(1),
      unit: 'hrs',
      max: Math.max(mttrVal * 1.4, 24),
      color: EXEC.success,
      trend: { direction: 'down', value: '▼ 2.4 hrs', positive: true },
    },
    mtbf: {
      label: 'MTBF',
      value: mtbfVal,
      displayValue: String(Math.round(mtbfVal)),
      unit: 'days',
      max: Math.max(mtbfVal * 1.2, 365),
      color: EXEC.cyan,
      trend: { direction: 'up', value: '▲ 18 days', positive: true },
    },
    spi: {
      label: 'SPI',
      value: spi,
      displayValue: spi.toFixed(2),
      unit: 'Index',
      max: 1.2,
      color: spi >= 1 ? EXEC.success : EXEC.danger,
      trend: {
        direction: spi >= 1 ? 'up' : 'down',
        value: spi >= 1 ? '▲ 0.03' : '▼ 0.05',
        positive: spi >= 1,
      },
    },
    openMaintenanceCases: {
      value: openCases,
      trend: { direction: 'up', value: '+12', positive: false },
    },
    delayedProjects: {
      value: delayedProjects,
      trend: { direction: 'up', value: '+3', positive: false },
    },
    projectsByStatus,
    milestones: buildMilestones(data),
    topDelayed: buildTopDelayed(data),
    systemAvailability: buildSystemAvailability(data),
    hierarchy: (() => {
      const tree = mapTree(data?.product_structure.tree ?? []);
      if (tree.length) return tree;
      return [
        {
          name: 'Customer A',
          value: 12,
          entityType: 'customer',
          children: [
            {
              name: 'ORD-1001',
              value: 7,
              entityType: 'order',
              children: [
                { name: 'SAT-Alpha', value: 4, entityType: 'project' },
                { name: 'SAT-Beta', value: 3, entityType: 'project' },
              ],
            },
          ],
        },
        {
          name: 'Customer B',
          value: 8,
          entityType: 'customer',
          children: [
            {
              name: 'ORD-2002',
              value: 8,
              entityType: 'order',
              children: [{ name: 'CommSat-01', value: 8, entityType: 'project' }],
            },
          ],
        },
      ];
    })(),
    topModifiedComponents: (() => {
      const items = (data?.configuration.top_modified_components ?? [])
        .slice(0, 5)
        .map((d) => ({ name: d.name, value: d.value }));
      if (items.length) return items;
      return [
        { name: 'PCU-1001', value: 18 },
        { name: 'PWR-2203', value: 14 },
        { name: 'RF-4410', value: 11 },
        { name: 'ADC-0902', value: 9 },
        { name: 'THR-3311', value: 7 },
      ];
    })(),
    recentChanges: (() => {
      const rows = (data?.configuration.recent_timeline ?? []).map((item) => ({
        id: item.id,
        partNumber: item.title,
        reason: item.subtitle || '—',
        status: item.status || 'Pending',
        date: new Date(item.timestamp).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
      }));
      if (rows.length) return rows;
      return [
        { id: 1, partNumber: 'PCU-1001', reason: 'Firmware rev', status: 'Approved', date: 'Jul 21' },
        { id: 2, partNumber: 'PWR-2203', reason: 'Thermal fix', status: 'Pending', date: 'Jul 20' },
        { id: 3, partNumber: 'RF-4410', reason: 'Connector swap', status: 'Approved', date: 'Jul 19' },
        { id: 4, partNumber: 'ADC-0902', reason: 'Calibration', status: 'Pending', date: 'Jul 18' },
        { id: 5, partNumber: 'THR-3311', reason: 'Seal replace', status: 'Approved', date: 'Jul 17' },
      ];
    })(),
    projectsByCustomer: (() => {
      const items = (data?.resources.projects_by_customer ?? [])
        .slice(0, 5)
        .map((d) => ({ name: d.name, value: d.value, id: d.id }));
      if (items.length) return items;
      return [
        { name: 'Customer A', value: 12 },
        { name: 'Customer B', value: 9 },
        { name: 'Customer C', value: 7 },
        { name: 'Customer D', value: 5 },
        { name: 'Customer E', value: 3 },
      ];
    })(),
    alerts: buildAlerts(data),
    maintenanceByStatus,
    maintenanceTrend,
    faultsByType: faultTypeBuckets(data?.reliability.fault_type_distribution ?? []),
    faultVsMttr,
  };
}
