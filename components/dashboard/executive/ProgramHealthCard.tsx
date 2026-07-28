'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import type { ExecGaugeMetric } from './types';
import { EXEC } from './theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface ProgramHealthCardProps {
  metric: ExecGaugeMetric;
  className?: string;
}

export function ProgramHealthCard({ metric, className }: ProgramHealthCardProps) {
  const available = metric.available !== false;
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 100,
          radius: '92%',
          center: ['50%', '50%'],
          silent: true,
          progress: {
            show: available,
            width: 14,
            roundCap: true,
            itemStyle: { color: metric.color },
          },
          axisLine: {
            lineStyle: {
              width: 14,
              color: [[1, '#1F1F1F']],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: available,
            offsetCenter: [0, '2%'],
            formatter: () => metric.displayValue,
            color: available ? EXEC.text : EXEC.muted,
            fontSize: available ? 26 : 22,
            fontWeight: 700,
            fontFamily: 'var(--font-exec-inter), Inter, system-ui, sans-serif',
          },
          data: [{ value: available ? Math.round(metric.value) : 0 }],
        },
      ],
    }),
    [available, metric.color, metric.displayValue, metric.value]
  );

  return (
    <DashboardCard
      className={className}
      title="Overall Program Health"
      noPadding
      insight={metric.insight}
    >
      <div className="flex h-full min-h-0 items-center gap-1 px-1.5 pb-2 pt-0">
        <div className="relative h-full min-h-[108px] min-w-0 flex-[1.35]">
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%', minHeight: 108 }}
            opts={{ renderer: 'canvas' }}
            notMerge
            lazyUpdate
          />
        </div>
        {metric.trend ? (
          <div className="mb-1 mr-2 flex shrink-0 flex-col items-start justify-center pr-1">
            <span
              className="inline-flex items-center gap-1 text-[15px] font-semibold leading-none"
              style={{ color: metric.trend.positive === false ? EXEC.danger : EXEC.success }}
            >
              <span className="text-[11px] leading-none" aria-hidden>
                {metric.trend.direction === 'down' ? '▼' : metric.trend.direction === 'flat' ? '–' : '▲'}
              </span>
              {metric.trend.value.replace(/^[▲▼+\-\s]+/, '')}
            </span>
            <span className="mt-1 text-[11px] leading-tight text-[#9CA3AF]">vs last month</span>
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
