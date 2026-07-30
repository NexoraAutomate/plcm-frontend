'use client';

import { useMemo } from 'react';
import { Area } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecSeriesPoint } from './types';
import { EXEC } from './theme';

const SERIES = [
  { key: 'Projects Started', color: EXEC.purple, totalKey: 'started' as const, label: 'Started' },
  { key: 'Projects Completed', color: EXEC.cyan, totalKey: 'completed' as const, label: 'Completed' },
  { key: 'Delayed Projects', color: EXEC.orange, totalKey: 'delayed' as const, label: 'Delayed' },
] as const;

interface AreaChartCardProps {
  title?: string;
  data: ExecSeriesPoint[];
  totals?: { started: number; completed: number; delayed: number };
  className?: string;
  onClick?: () => void;
  insight?: ExecInsight;
}

export function AreaChartCard({
  title = 'Portfolio Progress Trend',
  data,
  totals,
  className,
  onClick,
  insight,
}: AreaChartCardProps) {
  const chartData = useMemo(() => {
    const rows: { month: string; value: number; type: string }[] = [];
    for (const row of data) {
      rows.push({
        month: String(row.month),
        value: Number(row.started ?? 0),
        type: 'Projects Started',
      });
      rows.push({
        month: String(row.month),
        value: Number(row.completed ?? 0),
        type: 'Projects Completed',
      });
      rows.push({
        month: String(row.month),
        value: Number(row.delayed ?? 0),
        type: 'Delayed Projects',
      });
    }
    return rows;
  }, [data]);

  const yMax = useMemo(() => {
    const peak = chartData.reduce((m, r) => Math.max(m, r.value), 0);
    if (peak <= 100) return 100;
    return Math.ceil(peak / 20) * 20;
  }, [chartData]);

  const config = useMemo(
    () =>
      ({
        data: chartData,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        seriesField: 'type',
        stack: false,
        height: 148,
        autoFit: true,
        legend: false,
        theme: 'classicDark',
        shapeField: 'smooth',
        style: {
          fillOpacity: 0.22,
          lineWidth: 1.75,
        },
        scale: {
          color: {
            domain: SERIES.map((s) => s.key),
            range: SERIES.map((s) => s.color),
          },
          y: {
            domain: [0, yMax],
            nice: false,
          },
        },
        axis: {
          x: {
            labelFill: '#9CA3AF',
            labelFontSize: 11,
            labelFontWeight: 500,
            line: false,
            tick: false,
            grid: null,
          },
          y: {
            labelFill: '#9CA3AF',
            labelFontSize: 11,
            labelFontWeight: 500,
            grid: true,
            gridStroke: '#2A2A2A',
            gridStrokeOpacity: 1,
            gridLineWidth: 1,
            line: false,
            tick: false,
            tickCount: 6,
            labelFormatter: (v: number) => String(Math.round(Number(v))),
          },
        },
        tooltip: { shared: true },
      }) as Record<string, unknown>,
    [chartData, yMax]
  );

  return (
    <DashboardCard className={className} title={title} onClick={onClick} insight={insight} noPadding>
      <div className="flex h-full min-h-0 flex-col px-3 pb-2.5 pt-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-[#E5E7EB]">
              <span
                className="inline-block h-[3px] w-4 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.key}
            </span>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_64px] gap-2">
          <div className="relative min-h-[132px] min-w-0">
            {chartData.length ? <Area {...config} /> : null}
          </div>

          {totals ? (
            <div className="flex flex-col justify-center gap-3 border-l border-[#242424] pl-2.5">
              {SERIES.map((s) => (
                <div key={s.totalKey} className="min-w-0">
                  <p className="text-[10px] font-medium leading-none text-[#9CA3AF]">{s.label}</p>
                  <p
                    className="mt-1 text-[22px] font-bold leading-none tabular-nums tracking-tight"
                    style={{ color: s.color }}
                  >
                    {totals[s.totalKey]}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}
