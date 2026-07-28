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
import { EXEC } from '@/components/dashboard/executive/theme';

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

function monthKeySort(a: string, b: string): number {
  return a.localeCompare(b);
}

function padMonthsFromMaps(
  maps: Record<string, number>[]
): { name: string; values: number[] }[] {
  const keys = new Set<string>();
  for (const map of maps) {
    for (const k of Object.keys(map)) keys.add(k);
  }
  const sortedKeys = [...keys].sort(monthKeySort);
  // Prefer calendar order within current year span when keys are YYYY-MM
  const labeled = sortedKeys.map((key) => ({
    name: monthLabel(key),
    values: maps.map((map) => Number(map[key] ?? 0)),
  }));
  if (labeled.length) return labeled;
  return MONTHS.map((name) => ({ name, values: maps.map(() => 0) }));
}

function toMonthMap(points: ChartDataPoint[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of points) {
    map[p.name] = Number(p.value) || 0;
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
  const delayedTotal = kpiValue(data, 'delayed_projects');

  const rows = padMonthsFromMaps([startedMap, completedMap]);
  // Only keep months that have real activity (or keep full year labels if both empty)
  const hasAny = rows.some((r) => r.values.some((v) => v > 0));
  const filtered = hasAny ? rows.filter((r) => r.values.some((v) => v > 0)) : [];

  const series: ExecSeriesPoint[] = filtered.map((row) => ({
    month: row.name,
    started: row.values[0] ?? 0,
    completed: row.values[1] ?? 0,
    // Delayed is a point-in-time KPI (projects past end date, not completed).
    // Attribute the current delayed count only to the latest month with activity.
    delayed: 0,
  }));

  if (series.length && delayedTotal > 0) {
    series[series.length - 1].delayed = delayedTotal;
  }

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

function priorityFromDaysOverdue(days: number): ExecMilestonePoint['priority'] {
  if (days >= 30) return 'Critical';
  if (days >= 14) return 'High';
  if (days >= 1) return 'Medium';
  return 'Low';
}

function buildMilestones(data: ExecutiveDashboardResponse | null): ExecMilestonePoint[] {
  const progress = data?.projects.progress ?? [];
  const overdue = progress.filter((p) => (p.days_overdue ?? 0) > 0);
  if (!overdue.length) return [];

  return overdue.slice(0, 24).map((p) => {
    const days = p.days_overdue ?? 0;
    const priority = priorityFromDaysOverdue(days);
    const yMap = { Critical: 4, High: 3, Medium: 2, Low: 1 } as const;
    const month = p.end_date ? monthLabel(p.end_date.slice(0, 7)) : '—';
    return {
      month,
      priority,
      y: yMap[priority],
      name: p.name,
      count: 1,
    };
  });
}

function buildTopDelayed(data: ExecutiveDashboardResponse | null): ExecNamedValue[] {
  return (data?.projects.progress ?? [])
    .filter((p) => (p.days_overdue ?? 0) > 0)
    .sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0))
    .slice(0, 5)
    .map((p) => ({
      name: p.name.length > 22 ? `${p.name.slice(0, 20)}…` : p.name,
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

  const topModifiedComponents = (data?.configuration.top_modified_components ?? [])
    .slice(0, 5)
    .map((d) => ({ name: d.name, value: d.value }));

  const recentChanges = (data?.configuration.recent_timeline ?? []).map((item) => ({
    id: item.id,
    partNumber: item.title,
    reason: item.subtitle || '—',
    status: item.status || 'Pending',
    date: new Date(item.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
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
      'Started = projects created that month (created_at). Completed = projects with status Completed grouped by end_date month. Delayed = current count of projects past end date (point-in-time), shown on the latest month — not a historical delayed series.',
      'Compare intake vs completions to spot backlog growth. A spike in delayed on the latest month means schedule recovery should be the executive focus.'
    ),
    mttr: {
      label: 'MTTR',
      value: mttrVal,
      displayValue: mttrVal ? mttrVal.toFixed(1) : '—',
      unit: 'hrs',
      max: mttrMax,
      color: EXEC.success,
      available: mttrVal > 0,
      insight: insight(
        'Mean Time To Repair = average of (resolved_at − identified_at) in hours across resolved faulty entities in scope.',
        'Lower MTTR means faster restoration. Rising MTTR with stable fault volume points to repair-process or spare-parts bottlenecks.'
      ),
    },
    mtbf: {
      label: 'MTBF',
      value: mtbfVal,
      displayValue: mtbfVal ? String(Math.round(mtbfVal)) : '—',
      unit: 'days',
      max: mtbfMax,
      color: EXEC.cyan,
      available: mtbfVal > 0,
      insight: insight(
        'Mean Time Between Failures from reliability analytics (average interval between fault events in scope), expressed in days.',
        'Higher MTBF indicates more stable hardware/software. Declining MTBF warrants design or supplier quality review before the next build wave.'
      ),
    },
    spi: {
      label: 'SPI',
      value: spi,
      displayValue: spiAvailable ? spi.toFixed(2) : 'N/A',
      unit: 'Index',
      max: 1.2,
      color: !spiAvailable ? EXEC.muted : spi >= 1 ? EXEC.success : EXEC.danger,
      available: spiAvailable,
      insight: spiAvailable
        ? insight(
            `Schedule Performance Index (proxy) = (Total projects − Delayed) ÷ Total = (${totalProjects} − ${delayedProjects}) ÷ ${totalProjects} = ${spi.toFixed(2)}. 1.00 means no delayed projects; below 1.00 means schedule erosion.`,
            'Treat SPI < 1 as a portfolio red flag. Use it with Top Delayed Projects to decide which programs need executive intervention.'
          )
        : insight(
            'SPI requires Total projects > 0. No projects in scope → index is undefined.',
            'Do not compare SPI across empty filter scopes. Widen filters or wait for project data before schedule decisions.'
          ),
    },
    openMaintenanceCases: {
      value: openCases,
      trend: trendFromChange(kpiChange(data, 'open_maintenance_cases') ?? maintMom, {
        invertPositive: true,
      }),
      insight: insight(
        `Count of maintenance cases in open statuses (Open, Under Inspection, Under Repair) in the current filter scope = ${openCases}.`,
        'Open cases consume engineering capacity. Growth here often precedes MTTR increases and delivery slips.'
      ),
    },
    delayedProjects: {
      value: delayedProjects,
      trend: trendFromChange(kpiChange(data, 'delayed_projects'), { invertPositive: true }),
      insight: insight(
        `Count of projects where end_date < now and status ≠ Completed = ${delayedProjects} of ${totalProjects} total.`,
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
      'Each point is a project past its end date. X = end-date month; Y/priority = Critical (≥30d), High (≥14d), Medium (≥1d) based on days overdue.',
      'Clusters of Critical/High points show where schedule risk concentrates by time window — useful for recovery sprint planning.'
    ),
    topDelayed,
    topDelayedInsight: insight(
      'Top 5 non-completed projects ranked by days overdue = max(0, floor((now − end_date) / 1 day)).',
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
      'Left: components ranked by configuration change count. Right: most recent configuration history rows (part, reason, status, date).',
      'High churn on the same part numbers signals instability. Pending approvals in the recent list are decision queues for configuration control.'
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
