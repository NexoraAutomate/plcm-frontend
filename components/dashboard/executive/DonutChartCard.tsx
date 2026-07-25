'use client';

import { useMemo } from 'react';
import { Pie } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecNamedValue } from './types';
import { EXEC } from './theme';

interface DonutChartCardProps {
  title: string;
  data: ExecNamedValue[];
  colors?: string[];
  className?: string;
  onSliceClick?: (item: ExecNamedValue) => void;
}

export function DonutChartCard({
  title,
  data,
  colors = [EXEC.success, EXEC.orange, EXEC.yellow, EXEC.cyan, EXEC.purple],
  className,
  onSliceClick,
}: DonutChartCardProps) {
  const total = Math.round(data.reduce((s, d) => s + d.value, 0));

  const config = useMemo(
    () =>
      ({
        data,
        angleField: 'value',
        colorField: 'name',
        innerRadius: 0.64,
        radius: 0.9,
        height: 155,
        autoFit: true,
        theme: 'classicDark',
        legend: {
          color: {
            position: 'bottom',
            itemMarker: 'circle',
            itemLabelFontSize: 10,
            itemLabelFill: EXEC.muted,
            maxRows: 2,
          },
        },
        scale: { color: { range: colors } },
        label: false,
        tooltip: true,
        style: { stroke: EXEC.card, lineWidth: 2 },
        onReady: (plot: {
          on: (event: string, cb: (evt: { data?: { data?: ExecNamedValue } }) => void) => void;
        }) => {
          if (!onSliceClick) return;
          plot.on('element:click', (evt) => {
            const item = evt?.data?.data;
            if (item) onSliceClick(item);
          });
        },
      }) as Record<string, unknown>,
    [colors, data, onSliceClick]
  );

  return (
    <DashboardCard
      className={className}
      title={title}
      headerRight={
        <span className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">
          Total <span className="text-[#F5F5F5]">{total}</span>
        </span>
      }
    >
      <div className="relative h-[155px]">
        {data.length ? <Pie {...config} /> : null}
        <div className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center">
          <div className="text-center">
            <p className="text-[18px] font-bold leading-none text-[#F5F5F5]">{total}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[#9CA3AF]">Total</p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
