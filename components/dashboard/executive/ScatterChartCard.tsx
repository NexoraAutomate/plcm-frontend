'use client';

import { useMemo } from 'react';
import { Scatter } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecMilestonePoint } from './types';
import { EXEC, PRIORITY_COLORS } from './theme';

interface ScatterChartCardProps {
  title?: string;
  data: ExecMilestonePoint[];
  className?: string;
}

const Y_MAP = { Critical: 4, High: 3, Medium: 2, Low: 1 } as const;

export function ScatterChartCard({
  title = 'Project Milestone Timeline',
  data,
  className,
}: ScatterChartCardProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        y: Y_MAP[d.priority] ?? d.y,
        size: 6 + (d.count ?? 1) * 2,
      })),
    [data]
  );

  const config = useMemo(
    () =>
      ({
        data: chartData,
        xField: 'month',
        yField: 'y',
        colorField: 'priority',
        sizeField: 'size',
        height: 155,
        autoFit: true,
        theme: 'classicDark',
        legend: {
          color: {
            position: 'right',
            itemLabelFontSize: 10,
            itemLabelFill: EXEC.muted,
          },
        },
        scale: {
          color: {
            domain: ['Critical', 'High', 'Medium', 'Low'],
            range: [
              PRIORITY_COLORS.Critical,
              PRIORITY_COLORS.High,
              PRIORITY_COLORS.Medium,
              PRIORITY_COLORS.Low,
            ],
          },
          y: { domain: [0.5, 4.5] },
        },
        axis: {
          x: { labelFill: EXEC.muted, labelFontSize: 10, line: false, tick: false, gridStroke: '#242424' },
          y: {
            labelFormatter: (v: number) => {
              const map: Record<number, string> = { 4: 'Critical', 3: 'High', 2: 'Medium', 1: 'Low' };
              return map[v] ?? '';
            },
            labelFill: EXEC.muted,
            labelFontSize: 10,
            gridStroke: '#242424',
            line: false,
            tick: false,
          },
        },
        tooltip: true,
      }) as Record<string, unknown>,
    [chartData]
  );

  const counts = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const d of data) c[d.priority] += d.count ?? 1;
    return c;
  }, [data]);

  return (
    <DashboardCard
      className={className}
      title={title}
      headerRight={
        <div className="hidden gap-2 text-[10px] xl:flex">
          {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
            <span key={k} style={{ color: PRIORITY_COLORS[k] }}>
              {k.slice(0, 1)}:{counts[k]}
            </span>
          ))}
        </div>
      }
    >
      <div className="h-[155px]">{chartData.length ? <Scatter {...config} /> : null}</div>
    </DashboardCard>
  );
}
