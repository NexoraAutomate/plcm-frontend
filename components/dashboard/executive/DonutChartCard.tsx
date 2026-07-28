'use client';

import { useMemo } from 'react';
import { Pie } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';

interface DonutChartCardProps {
  title: string;
  data: ExecNamedValue[];
  colors?: string[];
  className?: string;
  onSliceClick?: (item: ExecNamedValue) => void;
  insight?: ExecInsight;
  /** Side legend matches executive mock (Projects by Status). */
  legendPlacement?: 'bottom' | 'side';
}

export function DonutChartCard({
  title,
  data,
  colors = [EXEC.success, EXEC.orange, EXEC.yellow, EXEC.cyan, EXEC.purple],
  className,
  onSliceClick,
  insight,
  legendPlacement = 'bottom',
}: DonutChartCardProps) {
  const total = Math.round(data.reduce((s, d) => s + d.value, 0));
  const side = legendPlacement === 'side';

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((d, i) => {
      map.set(d.name, d.color ?? colors[i % colors.length]);
    });
    return map;
  }, [colors, data]);

  const config = useMemo(
    () =>
      ({
        data,
        angleField: 'value',
        colorField: 'name',
        innerRadius: side ? 0.68 : 0.64,
        radius: side ? 0.92 : 0.9,
        height: side ? 150 : 155,
        autoFit: true,
        theme: 'classicDark',
        legend: side
          ? false
          : {
              color: {
                position: 'bottom',
                itemMarker: 'circle',
                itemLabelFontSize: 10,
                itemLabelFill: EXEC.muted,
                maxRows: 2,
              },
            },
        scale: {
          color: {
            domain: data.map((d) => d.name),
            range: data.map((d) => colorByName.get(d.name) ?? EXEC.purple),
          },
        },
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
    [colorByName, data, onSliceClick, side]
  );

  return (
    <DashboardCard className={className} title={title} insight={insight} noPadding={side}>
      {side ? (
        <div className="grid h-[155px] grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-stretch gap-1 px-2 pb-2">
          <div className="relative min-h-0 min-w-0">
            {data.length ? <Pie {...config} /> : null}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">Total</p>
                <p className="text-[22px] font-bold leading-none text-[#F5F5F5]">{total}</p>
              </div>
            </div>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto pr-1">
            {data.map((item, i) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              const color = colorByName.get(item.name) ?? colors[i % colors.length];
              return (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-2 border-b border-[#242424] py-1.5 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="truncate text-[12px] text-[#F5F5F5]">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#F5F5F5]">
                    {Math.round(item.value)}{' '}
                    <span className="font-normal text-[#9CA3AF]">({pct}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="relative h-[155px]">
          {data.length ? <Pie {...config} /> : null}
          <div className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center">
            <div className="text-center">
              <p className="text-[18px] font-bold leading-none text-[#F5F5F5]">{total}</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[#9CA3AF]">Total</p>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
