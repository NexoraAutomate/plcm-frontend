'use client';

import { useMemo } from 'react';
import { Line } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue, ExecSeriesPoint } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

interface LineChartCardProps {
  title: string;
  data: ExecNamedValue[];
  color?: string;
  seriesLabel?: string;
  className?: string;
  onClick?: () => void;
  insight?: ExecInsight;
}

export function LineChartCard({
  title,
  data,
  color = EXEC.purple,
  className,
  onClick,
  insight,
}: LineChartCardProps) {
  const { exec, chartTheme } = useExecTheme();
  const config = useMemo(
    () =>
      ({
        data,
        xField: 'name',
        yField: 'value',
        height: 145,
        autoFit: true,
        legend: false,
        theme: chartTheme,
        style: { stroke: color, lineWidth: 2 },
        point: {
          size: 3,
          style: { fill: color, stroke: exec.card, lineWidth: 1 },
        },
        axis: {
          x: { labelFill: exec.muted, labelFontSize: 10, line: false, tick: false },
          y: {
            labelFill: exec.muted,
            labelFontSize: 10,
            gridStroke: exec.grid,
            line: false,
          },
        },
        tooltip: true,
      }) as Record<string, unknown>,
    [chartTheme, color, data, exec.card, exec.grid, exec.muted]
  );

  return (
    <DashboardCard className={className} title={title} onClick={onClick} insight={insight}>
      <div className="h-[145px]">{data.length ? <Line {...config} /> : null}</div>
    </DashboardCard>
  );
}

interface DualLineChartCardProps {
  title: string;
  data: ExecSeriesPoint[];
  className?: string;
  insight?: ExecInsight;
}

export function DualLineChartCard({ title, data, className, insight }: DualLineChartCardProps) {
  const { exec, chartTheme } = useExecTheme();
  const chartData = useMemo(() => {
    const rows: { month: string; value: number; type: string }[] = [];
    for (const row of data) {
      rows.push({ month: String(row.month), value: Number(row.faults ?? 0), type: 'Faults' });
      rows.push({ month: String(row.month), value: Number(row.mttr ?? 0), type: 'MTTR (hrs)' });
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
        height: 145,
        autoFit: true,
        theme: chartTheme,
        legend: {
          color: {
            position: 'top',
            itemLabelFontSize: 10,
            itemLabelFill: exec.muted,
          },
        },
        scale: {
          color: {
            domain: ['Faults', 'MTTR (hrs)'],
            range: [EXEC.purple, EXEC.cyan],
          },
        },
        style: { lineWidth: 2 },
        axis: {
          x: { labelFill: exec.muted, labelFontSize: 10, line: false, tick: false },
          y: {
            labelFill: exec.muted,
            labelFontSize: 10,
            gridStroke: exec.grid,
            line: false,
          },
        },
        tooltip: { shared: true },
      }) as Record<string, unknown>,
    [chartData, chartTheme, exec.grid, exec.muted]
  );

  return (
    <DashboardCard className={className} title={title} insight={insight}>
      <div className="h-[145px]">{chartData.length ? <Line {...config} /> : null}</div>
    </DashboardCard>
  );
}
