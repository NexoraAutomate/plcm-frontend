'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import type { ExecNamedValue } from './types';
import { EXEC } from './theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface RadarChartCardProps {
  title?: string;
  data: ExecNamedValue[];
  className?: string;
}

export function RadarChartCard({
  title = 'System Availability',
  data,
  className,
}: RadarChartCardProps) {
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      radar: {
        indicator: data.map((d) => ({ name: d.name, max: 100 })),
        center: ['50%', '52%'],
        radius: '62%',
        axisName: { color: EXEC.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: '#242424' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#2A2A2A' } },
      },
      series: [
        {
          type: 'radar',
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: EXEC.cyan, width: 2 },
          itemStyle: { color: EXEC.cyan },
          areaStyle: { color: 'rgba(0,194,255,0.22)' },
          data: [{ value: data.map((d) => d.value), name: 'Availability' }],
        },
      ],
      tooltip: { trigger: 'item' },
    }),
    [data]
  );

  return (
    <DashboardCard className={className} title={title}>
      <div className="h-[160px]">
        {data.length ? (
          <ReactECharts
            option={option}
            style={{ height: 160, width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge
            lazyUpdate
          />
        ) : null}
      </div>
    </DashboardCard>
  );
}
