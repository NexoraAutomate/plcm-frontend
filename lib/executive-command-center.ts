import type { ExecutiveDashboardResponse, ChartDataPoint, TreemapNode } from '@/lib/types/dashboard';
import type {
  CommandCenterViewModel,
  ExecAlert,
  ExecInsight,
  ExecMilestonePoint,
  ExecNamedValue,
  ExecSeriesPoint,
  ExecTrend,
  ExecTreemapNode,
} from '@/components/dashboard/executive/types';
import { EXEC_DARK as EXEC } from '@/components/dashboard/executive/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function kpiValue(data: ExecutiveDashboardResponse | null, key: string): number {
  return data?.kpis.metrics.find((m) => m.key === key)?.value ?? 0;
}

function kpiChange(data: ExecutiveDashboardResponse | null, key: string): number | null {
  const raw = data?.kpis.metrics.find((m) => m.key === key)?.change_percent;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
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

function padCalendarMonths(
  maps: Record<string, number>[]
): { name: string; values: number[] }[] {
  // Collapse YYYY-MM keys into Jan–Dec buckets (current calendar view).
  const byMonth = maps.map(() => Object.fromEntries(MONTHS.map((m) => [m, 0])) as Record<string, number>);
  maps.forEach((map, mi) => {
    for (const [key, value] of Object.entries(map)) {
      const label = monthLabel(key);
      if (label in byMonth[mi]) {
        byMonth[mi][label] += Number(value) || 0;
      }
    }
  });
  return MONTHS.map((name) => ({
    name,
    values: byMonth.map((m) => m[name] ?? 0),
  }));
}

function toMonthMap(points: ChartDataPoint[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of points) {
    map[p.name] = (map[p.name] ?? 0) + (Number(p.value) || 0);
  }
  return map;
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

function kpiChangeValue(data: ExecutiveDashboardResponse | null, key: string): number | null {
  const raw = data?.kpis.metrics.find((m) => m.key === key)?.change_value;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function trendFromChange(
  changePercent: number | null,
  opts?: { invertPositive?: boolean; unit?: string }
): ExecTrend | undefined {
  if (changePercent === null) return undefined;
  const direction: ExecTrend['direction'] =
    changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat';
  const risingIsGood = !opts?.invertPositive;
  const positive =
    direction === 'flat' ? true : direction === 'up' ? risingIsGood : !risingIsGood;
  const abs = Math.abs(changePercent);
  const unit = opts?.unit ?? '%';
  return {
    direction,
    value: `${abs}${unit}`,
    positive,
  };
}

function trendFromAbsolute(
  delta: number | null,
  opts: { unit?: string; invertPositive?: boolean; decimals?: number }
): ExecTrend | undefined {
  if (delta === null) return undefined;
  const direction: ExecTrend['direction'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const risingIsGood = !opts.invertPositive;
  const positive =
    direction === 'flat' ? true : direction === 'up' ? risingIsGood : !risingIsGood;
  const abs = Math.abs(delta);
  const formatted =
    opts.decimals != null ? abs.toFixed(opts.decimals) : String(Math.round(abs * 10) / 10);
  const unit = opts.unit ? ` ${opts.unit}` : '';
  return {
    direction,
    value: `${formatted}${unit}`.trim(),
    positive,
  };
}

function momChange(values: number[]): number | null {
  if (values.length < 2) return null;
  const prev = values[values.length - 2];
  const curr = values[values.length - 1];
  if (prev === 0) return curr === 0 ? 0 : null;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

function healthColor(pct: number): string {
  if (pct >= 75) return EXEC.success;
  if (pct >= 55) return EXEC.warning;
  return EXEC.danger;
}

function normalizeStatusName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('complete')) return 'Completed';
  if (n.includes('hold')) return 'On Hold';
  if (n.includes('delay') || n.includes('risk')) return 'Delayed';
  if (
    n.includes('on track') ||
    n.includes('execution') ||
    n.includes('monitor') ||
    n.includes('plan') ||
    n.includes('init')
  ) {
    return 'On Track';
  }
  return name || 'On Track';
}

const PROJECT_STATUS_ORDER = ['On Track', 'Delayed', 'On Hold', 'Completed'] as const;

function aggregateStatus(points: ChartDataPoint[]): ExecNamedValue[] {
  const buckets: Record<string, number> = {
    'On Track': 0,
    Delayed: 0,
    'On Hold': 0,
    Completed: 0,
  };
  for (const p of points) {
    const key = normalizeStatusName(p.name);
    if (key in buckets) {
      buckets[key] += p.value;
    }
  }
  return PROJECT_STATUS_ORDER.map((name) => ({
    name,
    value: buckets[name],
    color:
      name === 'On Track'
        ? EXEC.success
        : name === 'Delayed'
          ? EXEC.orange
          : name === 'On Hold'
            ? EXEC.yellow
            : EXEC.cyan,
  })).filter((d) => d.value > 0);
}

function faultTypeBuckets(points: ChartDataPoint[]): ExecNamedValue[] {
  return points
    .map((p) => ({ name: p.name, value: p.value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

function buildPortfolioTrend(data: ExecutiveDashboardResponse | null): {
  series: ExecSeriesPoint[];
  totals: { started: number; completed: number; delayed: number };
} {
  const startedMap = toMonthMap(data?.projects.timeline ?? []);
  const completedMap = toMonthMap(data?.projects.completed_timeline ?? []);

  // Delayed-by-month: count overdue projects by the month their end_date fell due.
  const delayedMap: Record<string, number> = {};
  for (const p of data?.projects.progress ?? []) {
    if ((p.days_overdue ?? 0) <= 0 || !p.end_date) continue;
    const key = p.end_date.slice(0, 7);
    delayedMap[key] = (delayedMap[key] ?? 0) + 1;
  }

  const rows = padCalendarMonths([startedMap, completedMap, delayedMap]);
  const series: ExecSeriesPoint[] = rows.map((row) => ({
    month: row.name,
    started: row.values[0] ?? 0,
    completed: row.values[1] ?? 0,
    delayed: row.values[2] ?? 0,
  }));

  const delayedTotal = kpiValue(data, 'delayed_projects');
  const startedSum = series.reduce((s, r) => s + Number(r.started || 0), 0);
  const completedSum = series.reduce((s, r) => s + Number(r.completed || 0), 0);

  return {
    series,
    totals: {
      started: startedSum,
      completed: completedSum || kpiValue(data, 'completed_projects'),
      delayed: delayedTotal,
    },
  };
}

function priorityFromSchedule(daysOverdue: number | null, daysUntilDue: number | null): {
  priority: ExecMilestonePoint['priority'];
  filled: boolean;
} {
  if (daysOverdue != null && daysOverdue > 0) {
    if (daysOverdue >= 30) return { priority: 'Critical', filled: true };
    if (daysOverdue >= 14) return { priority: 'High', filled: true };
    if (daysOverdue >= 7) return { priority: 'Medium', filled: true };
    return { priority: 'Low', filled: true };
  }
  const until = daysUntilDue ?? 999;
  if (until <= 7) return { priority: 'Critical', filled: false };
  if (until <= 14) return { priority: 'High', filled: false };
  if (until <= 30) return { priority: 'Medium', filled: false };
  return { priority: 'Low', filled: false };
}

function rollingSixMonths(from = new Date()): { key: string; label: string }[] {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, label: MONTHS[d.getUTCMonth()] };
  });
}

function buildMilestones(data: ExecutiveDashboardResponse | null): ExecMilestonePoint[] {
  const window = rollingSixMonths();
  const windowKeys = new Set(window.map((w) => w.key));
  const yMap = { Critical: 4, High: 3, Medium: 2, Low: 1 } as const;
  const points: ExecMilestonePoint[] = [];

  for (const p of data?.projects.progress ?? []) {
    if (!p.end_date) continue;
    const key = p.end_date.slice(0, 7);
    // Plot overdue items that fell before the window on the first month.
    let monthIndex = window.findIndex((w) => w.key === key);
    if (monthIndex < 0) {
      if ((p.days_overdue ?? 0) > 0) monthIndex = 0;
      else continue;
    }
    if (!windowKeys.has(window[monthIndex].key) && monthIndex !== 0) continue;

    const { priority, filled } = priorityFromSchedule(
      p.days_overdue ?? null,
      p.days_until_due ?? null
    );
    points.push({
      month: window[monthIndex].label,
      monthIndex,
      priority,
      y: yMap[priority],
      name: p.name,
      count: 1,
      filled,
      id: p.id,
    });
  }

  return points.slice(0, 40);
}

function buildTopDelayed(data: ExecutiveDashboardResponse | null): ExecNamedValue[] {
  return (data?.projects.progress ?? [])
    .filter((p) => (p.days_overdue ?? 0) > 0)
    .sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0))
    .map((p) => ({
      name: p.name,
      value: p.days_overdue ?? 0,
      id: p.id,
    }));
}

/** Per-project system availability from hierarchy system counts and open fault counts. */
function buildSystemAvailability(data: ExecutiveDashboardResponse | null): ExecNamedValue[] {
  const faultSeries =
    data?.maintenance.fault_by_project?.[0]?.series?.find((s) => s.name.toLowerCase().includes('fault'))
      ?.data ??
    data?.maintenance.fault_by_project?.[0]?.series?.[0]?.data ??
    [];
  const faultMap = new Map(faultSeries.map((d) => [d.name, Number(d.value) || 0]));

  const projectNodes: { name: string; systems: number }[] = [];
  const walk = (nodes: TreemapNode[]) => {
    for (const n of nodes) {
      if (n.entity_type === 'project') {
        projectNodes.push({ name: n.name, systems: Math.max(0, Number(n.value) || 0) });
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(data?.product_structure.tree ?? []);

  const scored = projectNodes
    .map((p) => {
      const faults = faultMap.get(p.name) ?? 0;
      const systems = p.systems;
      // Availability = share of systems not implicated by open faults (capped).
      // When system count is unknown, penalize by fault count alone (each fault −10 pts).
      let value: number;
      if (systems > 0) {
        value = Math.max(0, Math.min(100, Math.round((1 - Math.min(faults, systems) / systems) * 100)));
      } else if (faults === 0) {
        value = 100;
      } else {
        value = Math.max(0, 100 - faults * 10);
      }
      return { name: p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name, value, faults };
    })
    .sort((a, b) => a.value - b.value || b.faults - a.faults)
    .slice(0, 6)
    .map(({ name, value }) => ({ name, value }));

  if (scored.length) return scored;

  // Fallback: project names from fault list only
  return faultSeries.slice(0, 6).map((d) => {
    const faults = Number(d.value) || 0;
    return {
      name: d.name.length > 14 ? `${d.name.slice(0, 12)}…` : d.name,
      value: Math.max(0, 100 - faults * 10),
    };
  });
}

function relativeLabel(iso: string | null | undefined): string {
  if (!iso) return 'Current';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'Current';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function buildAlerts(data: ExecutiveDashboardResponse | null): ExecAlert[] {
  const alerts: ExecAlert[] = [];
  const asOf = relativeLabel(data?.generated_at);
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
      timeAgo: asOf,
    });
  }
  if (openFaulty > 0) {
    alerts.push({
      id: 'fault',
      severity: 'critical',
      title: `Open faulty entities awaiting action (${openFaulty})`,
      timeAgo: asOf,
    });
  }
  if (openCases > 0) {
    alerts.push({
      id: 'maint',
      severity: 'warning',
      title: `${openCases} open maintenance case${openCases === 1 ? '' : 's'}`,
      timeAgo: asOf,
    });
  }
  if (configMonth > 0) {
    alerts.push({
      id: 'config',
      severity: 'info',
      title: `${configMonth} configuration change${configMonth === 1 ? '' : 's'} this month`,
      timeAgo: asOf,
    });
  }
  if (completed > 0 && !delayed && !openFaulty && !openCases) {
    alerts.push({
      id: 'done',
      severity: 'success',
      title: `Portfolio stable — ${completed} completed project${completed === 1 ? '' : 's'}`,
      timeAgo: asOf,
    });
  }
  if (!alerts.length) {
    alerts.push({
      id: 'ok',
      severity: 'success',
      title: 'No critical portfolio exceptions in current filter scope',
      timeAgo: asOf,
    });
  }
  return alerts.slice(0, 6);
}

function insight(calculation: string, benefit: string): ExecInsight {
  return { calculation, benefit };
}

export function buildCommandCenterViewModel(
  data: ExecutiveDashboardResponse | null
): CommandCenterViewModel {
  const totalProjects = kpiValue(data, 'total_projects');
  const activeProjects = kpiValue(data, 'active_projects');
  const delayedProjects = kpiValue(data, 'delayed_projects');
  const completedProjects = kpiValue(data, 'completed_projects');
  const openCases = kpiValue(data, 'open_maintenance_cases');
  const activePrograms = activeProjects;
  const totalOrders = kpiValue(data, 'total_orders');

  const healthAvailable = totalProjects > 0;
  const healthPct = healthAvailable
    ? Math.round(((totalProjects - delayedProjects) / totalProjects) * 100)
    : 0;
  const healthMomPts = kpiChange(data, 'program_health');
  const healthTrend = trendFromChange(healthMomPts);

  // Schedule Performance Index proxy: on-schedule share of portfolio.
  // SPI = (total − delayed) / total. Undefined when there are no projects.
  const spiAvailable = totalProjects > 0;
  const spi = spiAvailable
    ? Number(Math.max(0, (totalProjects - delayedProjects) / totalProjects).toFixed(2))
    : 0;

  const mttrVal = data?.reliability.mttr.value ?? 0;
  const mtbfVal = data?.reliability.mtbf.value ?? 0;
  const mttrMax = data?.reliability.mttr.max_value || Math.max(mttrVal, 1);
  const mtbfMax = data?.reliability.mtbf.max_value || Math.max(mtbfVal, 1);
  const mttrChange = data?.reliability.mttr.change_value ?? null;
  const mtbfChange = data?.reliability.mtbf.change_value ?? null;
  const spiChange =
    healthMomPts !== null ? Number((healthMomPts / 100).toFixed(2)) : null;

  const { series: portfolioTrend, totals: portfolioTotals } = buildPortfolioTrend(data);
  const sparkline = portfolioTrend.map((p) => Number(p.started) || 0);
  const startedMom = momChange(sparkline);

  const projectsByStatus = aggregateStatus(data?.projects.status_distribution ?? []);
  if (!projectsByStatus.length && totalProjects > 0) {
    const onTrack = Math.max(0, activeProjects - delayedProjects);
    const onHold = Math.max(0, totalProjects - activeProjects - completedProjects);
    if (onTrack) projectsByStatus.push({ name: 'On Track', value: onTrack, color: EXEC.success });
    if (delayedProjects)
      projectsByStatus.push({ name: 'Delayed', value: delayedProjects, color: EXEC.orange });
    if (onHold) projectsByStatus.push({ name: 'On Hold', value: onHold, color: EXEC.yellow });
    if (completedProjects)
      projectsByStatus.push({ name: 'Completed', value: completedProjects, color: EXEC.cyan });
  }

  const maintenanceByStatus = (data?.maintenance.cases_by_status ?? []).map((d) => ({
    name: d.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: d.value,
  }));

  const maintenanceTrendRaw = [...(data?.maintenance.monthly_trend ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const maintenanceTrend = maintenanceTrendRaw.map((d) => ({
    name: monthLabel(d.name),
    value: d.value,
  }));
  const maintMom = momChange(maintenanceTrend.map((d) => d.value));

  const faultVsMttr: ExecSeriesPoint[] = maintenanceTrendRaw.map((d) => ({
    month: monthLabel(d.name),
    faults: d.value,
    // Current measured MTTR as a reference baseline (not a fabricated monthly series).
    mttr: mttrVal,
  }));

  const topModifiedComponents = (data?.configuration.top_modified_components ?? []).map((d) => ({
    name: d.name,
    value: d.value,
    category: (d.label || undefined)?.toLowerCase(),
  }));

  const recentChanges = (data?.configuration.recent_timeline ?? []).map((item) => ({
    id: item.id,
    partNumber: item.title,
    reason: item.subtitle || '—',
    status: item.status || 'Pending',
    category: item.entity_type?.toLowerCase() || undefined,
    date: new Date(item.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
  }));

  const projectsByCustomer = (data?.resources.projects_by_customer ?? [])
    .slice(0, 5)
    .map((d) => ({ name: d.name, value: d.value, id: d.id }));

  const hierarchy = mapTree(data?.product_structure.tree ?? []);
  const topDelayed = buildTopDelayed(data);
  const systemAvailability = buildSystemAvailability(data);
  const milestones = buildMilestones(data);

  return {
    generatedAt: data?.generated_at ?? null,
    programHealth: {
      label: 'Overall Program Health',
      value: healthPct,
      displayValue: healthAvailable ? `${healthPct}%` : 'N/A',
      max: 100,
      available: healthAvailable,
      color: healthAvailable ? healthColor(healthPct) : EXEC.muted,
      trend: healthAvailable ? healthTrend : undefined,
      insight: healthAvailable
        ? insight(
            `(Total projects − Delayed projects) ÷ Total projects × 100 = (${totalProjects} − ${delayedProjects}) ÷ ${totalProjects} × 100 = ${healthPct}%. Delayed = end date in the past and status ≠ Completed.${
              healthMomPts !== null
                ? ` MoM change = current health − prior-month health (portfolio as of last month-end) = ${healthMomPts > 0 ? '+' : ''}${healthMomPts} percentage points.`
                : ' MoM change requires a prior-month portfolio (projects created before this month); none available yet.'
            }`,
            'Use this as the first glance at portfolio schedule risk. A falling score means more programs are past due — prioritize recovery plans before capacity or new commitments.'
          )
        : insight(
            'Health is undefined when Total projects = 0 (division by zero). No synthetic default is applied.',
            'Empty scope usually means filters exclude all work or onboarding has not started. Clear filters or create projects before using health for go/no-go decisions.'
          ),
    },
    activePrograms: {
      value: activePrograms,
      trend: trendFromChange(kpiChange(data, 'active_projects') ?? startedMom),
      sparkline,
      insight: insight(
        `Active programs = active_projects KPI (projects whose status is not Completed or On Hold) = ${activePrograms}. Related portfolio size: ${totalOrders} order(s), ${totalProjects} total project(s). Sparkline = projects created per month from the portfolio timeline.`,
        'Shows concurrent delivery load. Rising active programs without matching completions or staffing signals capacity risk.'
      ),
    },
    portfolioTrend,
    portfolioTotals,
    portfolioInsight: insight(
      'Started = projects created that month. Completed = projects marked Completed by end_date month. Delayed = overdue lifecycle projects counted in the month their end_date fell due. Right-side totals: annual started/completed sums and current delayed KPI. Axis shows full Jan–Dec; Y scales to 100 (or higher in steps of 20 if needed).',
      'Compare intake vs completions to spot backlog growth. Rising delayed counts mean schedule recovery should be the executive focus.'
    ),
    mttr: {
      label: 'MTTR',
      subtitle: 'Mean Time To Repair',
      value: mttrVal,
      displayValue: mttrVal ? mttrVal.toFixed(1) : '—',
      unit: 'hrs',
      max: mttrMax,
      color: EXEC.purple,
      available: mttrVal > 0,
      trend: trendFromAbsolute(mttrChange, { unit: 'hrs', invertPositive: true, decimals: 1 }),
      insight: insight(
        'Mean Time To Repair = average of (resolved_at − identified_at) in hours across resolved faulty entities in scope. MoM compares average repair time for faults resolved this month vs last month.',
        'Lower MTTR means faster restoration. Rising MTTR with stable fault volume points to repair-process or spare-parts bottlenecks.'
      ),
    },
    mtbf: {
      label: 'MTBF',
      subtitle: 'Mean Time Between Failures',
      value: mtbfVal,
      displayValue: mtbfVal ? String(Math.round(mtbfVal)) : '—',
      unit: 'days',
      max: mtbfMax,
      color: EXEC.purple,
      available: mtbfVal > 0,
      trend: trendFromAbsolute(mtbfChange, { unit: 'days', decimals: 0 }),
      insight: insight(
        'Mean Time Between Failures = average days between successive fault identifications in scope. MoM compares gaps observed this month vs last month.',
        'Higher MTBF indicates more stable hardware/software. Declining MTBF warrants design or supplier quality review before the next build wave.'
      ),
    },
    spi: {
      label: 'SPI',
      eyebrow: 'Schedule Performance',
      value: spi,
      displayValue: spiAvailable ? spi.toFixed(2) : 'N/A',
      unit: 'Index',
      max: 1.2,
      color: !spiAvailable ? EXEC.muted : EXEC.success,
      available: spiAvailable,
      trend: trendFromAbsolute(spiChange, { decimals: 2, invertPositive: false }),
      insight: spiAvailable
        ? insight(
            `Schedule Performance Index (proxy) = (Total projects − Delayed) ÷ Total = (${totalProjects} − ${delayedProjects}) ÷ ${totalProjects} = ${spi.toFixed(2)}. MoM = change in program-health percentage points ÷ 100.`,
            'Treat SPI < 1 as a portfolio red flag. Use it with Top Delayed Projects to decide which programs need executive intervention.'
          )
        : insight(
            'SPI requires Total projects > 0. No projects in scope → index is undefined.',
            'Do not compare SPI across empty filter scopes. Widen filters or wait for project data before schedule decisions.'
          ),
    },
    openMaintenanceCases: {
      value: openCases,
      trend: trendFromAbsolute(
        kpiChangeValue(data, 'open_maintenance_cases') ??
          (maintMom !== null && maintenanceTrend.length >= 2
            ? maintenanceTrend[maintenanceTrend.length - 1].value -
              maintenanceTrend[maintenanceTrend.length - 2].value
            : null),
        { invertPositive: true }
      ),
      insight: insight(
        `Count of maintenance cases in open statuses (Open, Under Inspection, Under Repair) in the current filter scope = ${openCases}. MoM compares cases reported this month vs last month.`,
        'Open cases consume engineering capacity. Growth here often precedes MTTR increases and delivery slips.'
      ),
    },
    delayedProjects: {
      value: delayedProjects,
      trend: trendFromAbsolute(kpiChangeValue(data, 'delayed_projects'), { invertPositive: true }),
      insight: insight(
        `Count of lifecycle projects where end_date < now = ${delayedProjects} of ${totalProjects} total. MoM = current delayed − delayed count as of last month-end.`,
        'Each delayed project is a contractual and resource risk. Drill into Top Delayed for days overdue and owners.'
      ),
    },
    projectsByStatus,
    projectsByStatusInsight: insight(
      'Buckets: Completed and On Hold come from project status. Lifecycle statuses (Initiation, Planning, Execution, Monitoring) become Delayed when end_date is past, otherwise On Track.',
      'A healthy mix skews to On Track and Completed. Growth in Delayed should trigger schedule recovery; On Hold growth signals stalled commitments.'
    ),
    milestones,
    milestonesInsight: insight(
      'Each point is a lifecycle project deadline (end_date) in the rolling next-6-months window. Priority from urgency: overdue ≥30d Critical, ≥14d High, ≥7d Medium; upcoming ≤7d Critical, ≤14d High, ≤30d Medium, else Low. Filled markers = overdue; hollow = upcoming. Right totals count markers by priority.',
      'Clusters of Critical/High points show where schedule risk concentrates — use them to prioritize recovery and upcoming delivery gates.'
    ),
    topDelayed,
    topDelayedInsight: insight(
      'Top 5 lifecycle projects with end_date < now, ranked by days overdue = floor((now − end_date) / 1 day).',
      'Start recovery with the longest-overdue programs; they usually carry the highest customer and cost exposure.'
    ),
    systemAvailability,
    systemAvailabilityInsight: insight(
      'Per project: if systems > 0, availability = (1 − min(open faults, systems) ÷ systems) × 100. If systems unknown, availability = max(0, 100 − faults × 10). Fault counts come from maintenance analytics.',
      'Low availability projects need reliability focus (spares, design, ops). Compare with MTTR/MTBF before approving further deployments.'
    ),
    hierarchy,
    hierarchyInsight: insight(
      'Treemap of Customer → Order → Project. Node value at project level = system count; parent values roll up child counts.',
      'Use hierarchy to see concentration risk — large nodes dominate portfolio exposure and should get proportional oversight.'
    ),
    topModifiedComponents,
    recentChanges,
    configInsight: insight(
      'Filter by System / Subsystem / Module / Unit. Bars show replacement counts for each entity name within that level (e.g. Module → BUC, RT Transmitter), aggregated across projects. Right: recent changes for the selected level.',
      'High churn on a specific module or unit type flags design or supplier risk. Use the tabs to isolate which hierarchy level needs configuration control.'
    ),
    projectsByCustomer,
    projectsByCustomerInsight: insight(
      'Project counts grouped by customer from resources analytics, top 5 by volume.',
      'Shows commercial concentration. Over-reliance on one customer increases revenue and delivery risk if that account slips.'
    ),
    alerts: buildAlerts(data),
    alertsInsight: insight(
      'Rule-based alerts from live KPIs: delayed projects, open faulty entities, open maintenance cases, and configuration changes this month. Timestamps reflect dashboard generation time.',
      'Treat Critical items as the executive action list for the current filter scope before reviewing secondary charts.'
    ),
    maintenanceByStatus,
    maintenanceByStatusInsight: insight(
      'Maintenance case counts grouped by case status in the current filter scope.',
      'Watch Under Repair / Under Inspection share — bottlenecks there drive MTTR and open-case growth.'
    ),
    maintenanceTrend,
    maintenanceTrendInsight: insight(
      'Count of maintenance cases reported per calendar month (reported_at), scoped by filters.',
      'An upward trend means rising operational friction. Pair with fault-type mix to target preventive actions.'
    ),
    faultsByType: faultTypeBuckets(data?.reliability.fault_type_distribution ?? []),
    faultsByTypeInsight: insight(
      'Open/historical faulty entities grouped by fault_type from reliability analytics.',
      'Dominant fault types guide whether to invest in hardware quality, software hardening, or process controls.'
    ),
    faultVsMttr,
    faultVsMttrInsight: insight(
      'Faults = monthly maintenance case counts. MTTR line = current measured mean repair time (hours) drawn as a constant baseline for comparison — not a fabricated per-month MTTR.',
      'If fault volume rises while MTTR stays high, recovery capacity is insufficient. If faults fall but MTTR rises, investigate repair-path efficiency.'
    ),
    filtersInsight: insight(
      'Customer / Program / Project filters narrow every KPI and chart to the selected scope. Last updated is the API generated_at timestamp.',
      'Always confirm filter scope before acting — metrics for one customer must not drive enterprise-wide decisions.'
    ),
  };
}
