'use client';

import { useMemo } from 'react';
import { Bar } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

interface HorizontalBarCardProps {
  title: string;
  data: ExecNamedValue[];
  valueLabel?: string;
  color?: string;
  className?: string;
  onBarClick?: (item: ExecNamedValue) => void;
  insight?: ExecInsight;
}

export function HorizontalBarCard({
  title,
  data,
  valueLabel = 'Value',
  color = EXEC.purple,
  className,
  onBarClick,
  insight,
}: HorizontalBarCardProps) {
  const { exec, chartTheme } = useExecTheme();
  const sorted = useMemo(() => [...data].sort((a, b) => a.value - b.value), [data]);

  const config = useMemo(
    () =>
      ({
        data: sorted,
        xField: 'value',
        yField: 'name',
        height: 155,
        autoFit: true,
        legend: false,
        theme: chartTheme,
        axis: {
          x: {
            labelFill: exec.muted,
            labelFontSize: 10,
            gridStroke: exec.grid,
            line: false,
          },
          y: { labelFill: exec.muted, labelFontSize: 10, line: false, tick: false },
        },
        style: {
          fill: color,
          maxWidth: 16,
          radiusTopRight: 4,
          radiusBottomRight: 4,
        },
        label: {
          text: 'value',
          position: 'right',
          style: { fill: exec.muted, fontSize: 10 },
        },
        tooltip: true,
        onReady: (plot: {
          on: (event: string, cb: (evt: { data?: { data?: ExecNamedValue } }) => void) => void;
        }) => {
          if (!onBarClick) return;
          plot.on('element:click', (evt) => {
            const item = evt?.data?.data;
            if (item) onBarClick(item);
          });
        },
      }) as Record<string, unknown>,
    [chartTheme, color, exec.grid, exec.muted, onBarClick, sorted, valueLabel]
  );

  return (
    <DashboardCard className={className} title={title} insight={insight}>
      <div className="h-[155px]">{sorted.length ? <Bar {...config} /> : null}</div>
    </DashboardCard>
  );
}
