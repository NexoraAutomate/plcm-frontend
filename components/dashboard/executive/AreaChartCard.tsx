'use client';

import { useMemo } from 'react';
import { Area } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecSeriesPoint } from './types';
import { EXEC } from './theme';

interface AreaChartCardProps {
  title?: string;
  data: ExecSeriesPoint[];
  totals?: { started: number; completed: number; delayed: number };
  className?: string;
  onClick?: () => void;
}

export function AreaChartCard({
  title = 'Portfolio Progress Trend',
  data,
  totals,
  className,
  onClick,
}: AreaChartCardProps) {
  const chartData = useMemo(() => {
    const rows: { month: string; value: number; type: string }[] = [];
    for (const row of data) {
      rows.push({ month: String(row.month), value: Number(row.started ?? 0), type: 'Projects Started' });
      rows.push({ month: String(row.month), value: Number(row.completed ?? 0), type: 'Projects Completed' });
      rows.push({ month: String(row.month), value: Number(row.delayed ?? 0), type: 'Delayed Projects' });
    }
    return rows;
  }, [data]);

  const config = useMemo(
    () =>
      ({
        data: chartData,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        seriesField: 'type',
        stack: false,
        height: 150,
        autoFit: true,
        legend: false,
        theme: 'classicDark',
        style: { fillOpacity: 0.28 },
        scale: {
          color: {
            domain: ['Projects Started', 'Projects Completed', 'Delayed Projects'],
            range: [EXEC.purple, EXEC.cyan, EXEC.orange],
          },
        },
        axis: {
          x: { labelFill: EXEC.muted, labelFontSize: 10, line: false, tick: false, grid: null },
          y: { labelFill: EXEC.muted, labelFontSize: 10, gridStroke: '#242424', line: false, tick: false },
        },
        tooltip: { shared: true },
      }) as Record<string, unknown>,
    [chartData]
  );

  return (
    <DashboardCard
      className={className}
      title={title}
      onClick={onClick}
      headerRight={
        totals ? (
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#8B5CF6]">Started {totals.started}</span>
            <span className="text-[#00C2FF]">Completed {totals.completed}</span>
            <span className="text-[#FB923C]">Delayed {totals.delayed}</span>
          </div>
        ) : undefined
      }
    >
      <div className="h-[150px] w-full">
        {chartData.length ? <Area {...config} /> : null}
      </div>
    </DashboardCard>
  );
}
