'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import { TrendBadge } from './KPICard';
import type { ExecGaugeMetric } from './types';
import { EXEC } from './theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface ProgramHealthCardProps {
  metric: ExecGaugeMetric;
  className?: string;
}

export function ProgramHealthCard({ metric, className }: ProgramHealthCardProps) {
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 0,
          endAngle: 360,
          min: 0,
          max: 100,
          radius: '100%',
          center: ['50%', '58%'],
          progress: {
            show: true,
            width: 12,
            roundCap: true,
            itemStyle: { color: metric.color },
          },
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, '#1F1F1F']],
            },
          },
          axisTick: { show: true },
          splitLine: { show: true },
          axisLabel: { show: true },
          pointer: { show: true },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '0%'],
            formatter: '{value}%',
            color: EXEC.text,
            fontSize: 22,
            fontWeight: 700,
          },  
          data: [{ value: Math.round(metric.value) }],
        },
      ],
    }),
    [metric.color, metric.value]
  );

  return (
    <DashboardCard
      className={className}
      title="Overall Program Health"
      headerRight={metric.trend ? <TrendBadge trend={metric.trend} /> : undefined}
      noPadding
    >
      <div className="h-30 px-1">
        <ReactECharts
          option={option}
          style={{ height: 150, width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge
          lazyUpdate
        />
      </div>
      {metric.trend ? (
        <p className="px-3 pb-2 text-center text-[11px] text-[#9CA3AF]">
          <span className="text-[#4ADE80]">{metric.trend.value}</span> vs last month
        </p>
      ) : null}
    </DashboardCard>
  );
}
