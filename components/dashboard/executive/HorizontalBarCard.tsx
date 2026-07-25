'use client';

import { useMemo } from 'react';
import { Bar } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecNamedValue } from './types';
import { EXEC } from './theme';

interface HorizontalBarCardProps {
  title: string;
  data: ExecNamedValue[];
  valueLabel?: string;
  color?: string;
  className?: string;
  onBarClick?: (item: ExecNamedValue) => void;
}

export function HorizontalBarCard({
  title,
  data,
  valueLabel = 'Value',
  color = EXEC.purple,
  className,
  onBarClick,
}: HorizontalBarCardProps) {
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
        theme: 'classicDark',
        axis: {
          x: { labelFill: EXEC.muted, labelFontSize: 10, gridStroke: '#242424', line: false },
          y: { labelFill: EXEC.muted, labelFontSize: 10, line: false, tick: false },
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
          style: { fill: EXEC.muted, fontSize: 10 },
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
    [color, onBarClick, sorted, valueLabel]
  );

  return (
    <DashboardCard className={className} title={title}>
      <div className="h-[155px]">{sorted.length ? <Bar {...config} /> : null}</div>
    </DashboardCard>
  );
}
