'use client';

import { ProgramHealthCard } from './ProgramHealthCard';
import { LogoCard } from './LogoCard';
import { KPICard } from './KPICard';
import { AreaChartCard } from './AreaChartCard';
import { GaugeCard } from './GaugeCard';
import { StatusMetricCard } from './StatusMetricCard';
import { FiltersPanel } from './FiltersPanel';
import { DonutChartCard } from './DonutChartCard';
import { ScatterChartCard } from './ScatterChartCard';
import { HorizontalBarCard } from './HorizontalBarCard';
import { RadarChartCard } from './RadarChartCard';
import { TreemapCard } from './TreemapCard';
import { ConfigSplitCard } from './ConfigSplitCard';
import { AlertPanel } from './AlertPanel';
import { LineChartCard, DualLineChartCard } from './LineChartCard';
import type { CommandCenterViewModel, ExecFilterOption, ExecFiltersState } from './types';
import { EXEC_MAINT_COLORS, EXEC_FAULT_COLORS, EXEC } from './theme';

interface ExecutiveCommandGridProps {
  model: CommandCenterViewModel;
  filters: ExecFiltersState;
  customers: ExecFilterOption[];
  programs: ExecFilterOption[];
  projects: ExecFilterOption[];
  onFiltersChange: (patch: Partial<ExecFiltersState>) => void;
  onNavigate?: (path: string) => void;
  fetching?: boolean;
  onRefresh?: () => void;
}

export function ExecutiveCommandGrid({
  model,
  filters,
  customers,
  programs,
  projects,
  onFiltersChange,
  onNavigate,
  fetching,
  onRefresh,
}: ExecutiveCommandGridProps) {
  return (
    <div
      className="executive-command-center grid h-full min-h-0 w-full gap-3 overflow-hidden p-3"
      style={{
        background: EXEC.bg,
        gridTemplateRows: 'minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.95fr)',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        fontFamily: 'var(--font-exec-inter), Inter, system-ui, sans-serif',
      }}
    >
      {/* ── Row 1 ── */}
      <div className="col-span-2 grid min-h-0 grid-rows-[auto_1fr] gap-3">
        <LogoCard />
        <ProgramHealthCard metric={model.programHealth} />
      </div>

      <KPICard
        className="col-span-1 min-h-0"
        label="Active Programs"
        value={model.activePrograms.value}
        trend={model.activePrograms.trend}
        sparkline={model.activePrograms.sparkline}
        insight={model.activePrograms.insight}
        onClick={() => onNavigate?.('/projects')}
      />

      <AreaChartCard
        className="col-span-4 min-h-0"
        data={model.portfolioTrend}
        totals={model.portfolioTotals}
        insight={model.portfolioInsight}
        onClick={() => onNavigate?.('/projects')}
      />

      <div className="col-span-3 grid min-h-0 grid-rows-[1fr_auto] gap-3">
        <div className="grid min-h-0 grid-cols-3 gap-3">
          <GaugeCard metric={model.mttr} compact onClick={() => onNavigate?.('/maintenance')} />
          <GaugeCard metric={model.mtbf} compact onClick={() => onNavigate?.('/maintenance')} />
          <GaugeCard metric={model.spi} compact onClick={() => onNavigate?.('/projects')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatusMetricCard
            label="Open Maintenance Cases"
            value={model.openMaintenanceCases.value}
            trend={model.openMaintenanceCases.trend}
            insight={model.openMaintenanceCases.insight}
            onClick={() => onNavigate?.('/maintenance')}
          />
          <StatusMetricCard
            label="Delayed Projects"
            value={model.delayedProjects.value}
            trend={model.delayedProjects.trend}
            insight={model.delayedProjects.insight}
            onClick={() => onNavigate?.('/projects')}
          />
        </div>
      </div>

      <div className="col-span-2 min-h-0">
        <FiltersPanel
          filters={filters}
          customers={customers}
          programs={programs}
          projects={projects}
          onChange={onFiltersChange}
          lastUpdated={model.generatedAt}
          fetching={fetching}
          onRefresh={onRefresh}
          insight={model.filtersInsight}
        />
      </div>

      {/* ── Row 2 ── */}
      <DonutChartCard
        className="col-span-3 min-h-0"
        title="Projects by Status"
        data={model.projectsByStatus}
        insight={model.projectsByStatusInsight}
        legendPlacement="side"
        colors={model.projectsByStatus.map(
          (d) =>
            d.color ??
            ({
              'On Track': EXEC.success,
              Delayed: EXEC.orange,
              'On Hold': EXEC.yellow,
              Completed: EXEC.cyan,
            }[d.name] ?? EXEC.purple)
        )}
        onSliceClick={() => onNavigate?.('/projects')}
      />
      <ScatterChartCard
        className="col-span-4 min-h-0"
        data={model.milestones}
        insight={model.milestonesInsight}
      />
      <HorizontalBarCard
        className="col-span-3 min-h-0"
        title="Top Delayed Projects"
        data={model.topDelayed}
        valueLabel="Days Overdue"
        insight={model.topDelayedInsight}
        onBarClick={(item) => item.id && onNavigate?.(`/projects/${item.id}`)}
      />
      <RadarChartCard
        className="col-span-2 min-h-0"
        data={model.systemAvailability}
        insight={model.systemAvailabilityInsight}
      />

      {/* ── Row 3 ── */}
      <TreemapCard
        className="col-span-3 min-h-0"
        tree={model.hierarchy}
        insight={model.hierarchyInsight}
        onNodeClick={(node) => {
          if (node.entityType === 'project' && node.id) onNavigate?.(`/projects/${node.id}`);
          if (node.entityType === 'customer' && node.id) onNavigate?.(`/customers/${node.id}`);
          if (node.entityType === 'order' && node.id) onNavigate?.(`/orders/${node.id}`);
        }}
      />
      <ConfigSplitCard
        className="col-span-4 min-h-0"
        components={model.topModifiedComponents}
        rows={model.recentChanges}
        insight={model.configInsight}
      />
      <HorizontalBarCard
        className="col-span-3 min-h-0"
        title="Projects by Customer"
        data={model.projectsByCustomer}
        valueLabel="Projects"
        color={EXEC.purple}
        insight={model.projectsByCustomerInsight}
        onBarClick={(item) => item.id && onNavigate?.(`/customers/${item.id}`)}
      />
      <AlertPanel
        className="col-span-2 min-h-0"
        alerts={model.alerts}
        insight={model.alertsInsight}
      />

      {/* ── Row 4 ── */}
      <DonutChartCard
        className="col-span-3 min-h-0"
        title="Maintenance Cases by Status"
        data={model.maintenanceByStatus}
        colors={[...EXEC_MAINT_COLORS]}
        insight={model.maintenanceByStatusInsight}
        onSliceClick={() => onNavigate?.('/maintenance')}
      />
      <LineChartCard
        className="col-span-3 min-h-0"
        title="Maintenance Trend"
        data={model.maintenanceTrend}
        insight={model.maintenanceTrendInsight}
        onClick={() => onNavigate?.('/maintenance')}
      />
      <DonutChartCard
        className="col-span-3 min-h-0"
        title="Faults by Type"
        data={model.faultsByType}
        colors={[...EXEC_FAULT_COLORS]}
        insight={model.faultsByTypeInsight}
        onSliceClick={() => onNavigate?.('/maintenance')}
      />
      <DualLineChartCard
        className="col-span-3 min-h-0"
        title="Fault Trend vs MTTR"
        data={model.faultVsMttr}
        insight={model.faultVsMttrInsight}
      />
    </div>
  );
}
