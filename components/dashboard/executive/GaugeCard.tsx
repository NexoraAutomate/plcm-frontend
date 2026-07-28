'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import { TrendBadge } from './KPICard';
import type { ExecGaugeMetric } from './types';
import { EXEC } from './theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface GaugeCardProps {
  metric: ExecGaugeMetric;
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}

export function GaugeCard({ metric, className, compact = false, onClick }: GaugeCardProps) {
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: metric.max,
          radius: compact ? '90%' : '95%',
          center: ['50%', compact ? '58%' : '55%'],
          progress: {
            show: metric.available !== false,
            width: compact ? 8 : 10,
            roundCap: true,
            itemStyle: { color: metric.color },
          },
          axisLine: {
            lineStyle: {
              width: compact ? 8 : 10,
              color: [[1, '#1F1F1F']],
            },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, compact ? '8%' : '4%'],
            formatter: () => metric.displayValue,
            color: metric.available === false ? EXEC.muted : EXEC.text,
            fontSize: compact ? 13 : 16,
            fontWeight: 700,
          },
          title: {
            show: !!metric.unit && metric.available !== false,
            offsetCenter: [0, compact ? '42%' : '38%'],
            color: EXEC.muted,
            fontSize: 10,
          },
          data: [{ value: metric.available === false ? 0 : metric.value, name: metric.unit ?? '' }],
        },
      ],
    }),
    [compact, metric]
  );

  return (
    <DashboardCard
      className={className}
      title={metric.label}
      onClick={onClick}
      headerRight={metric.trend ? <TrendBadge trend={metric.trend} /> : undefined}
      noPadding
      insight={metric.insight}
    >
      <div className={compact ? 'h-[88px]' : 'h-[110px]'}>
        <ReactECharts
          option={option}
          style={{ height: compact ? 88 : 110, width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge
          lazyUpdate
        />
      </div>
    </DashboardCard>
  );
}
