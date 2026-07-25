'use client';

import { useMemo } from 'react';
import { Line } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecNamedValue, ExecSeriesPoint } from './types';
import { EXEC } from './theme';

interface LineChartCardProps {
  title: string;
  data: ExecNamedValue[];
  color?: string;
  seriesLabel?: string;
  className?: string;
  onClick?: () => void;
}

export function LineChartCard({
  title,
  data,
  color = EXEC.purple,
  className,
  onClick,
}: LineChartCardProps) {
  const config = useMemo(
    () =>
      ({
        data,
        xField: 'name',
        yField: 'value',
        height: 145,
        autoFit: true,
        legend: false,
        theme: 'classicDark',
        style: { stroke: color, lineWidth: 2 },
        point: {
          size: 3,
          style: { fill: color, stroke: EXEC.card, lineWidth: 1 },
        },
        axis: {
          x: { labelFill: EXEC.muted, labelFontSize: 10, line: false, tick: false },
          y: { labelFill: EXEC.muted, labelFontSize: 10, gridStroke: '#242424', line: false },
        },
        tooltip: true,
      }) as Record<string, unknown>,
    [color, data]
  );

  return (
    <DashboardCard className={className} title={title} onClick={onClick}>
      <div className="h-[145px]">{data.length ? <Line {...config} /> : null}</div>
    </DashboardCard>
  );
}

interface DualLineChartCardProps {
  title: string;
  data: ExecSeriesPoint[];
  className?: string;
}

export function DualLineChartCard({ title, data, className }: DualLineChartCardProps) {
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
        theme: 'classicDark',
        legend: {
          color: {
            position: 'top',
            itemLabelFontSize: 10,
            itemLabelFill: EXEC.muted,
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
          x: { labelFill: EXEC.muted, labelFontSize: 10, line: false, tick: false },
          y: { labelFill: EXEC.muted, labelFontSize: 10, gridStroke: '#242424', line: false },
        },
        tooltip: { shared: true },
      }) as Record<string, unknown>,
    [chartData]
  );

  return (
    <DashboardCard className={className} title={title}>
      <div className="h-[145px]">{chartData.length ? <Line {...config} /> : null}</div>
    </DashboardCard>
  );
}
