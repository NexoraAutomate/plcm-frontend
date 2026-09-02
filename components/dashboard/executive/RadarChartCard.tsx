'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface RadarChartCardProps {
  title?: string;
  data: ExecNamedValue[];
  className?: string;
  insight?: ExecInsight;
}

export function RadarChartCard({
  title = 'System Availability',
  data,
  className,
  insight,
}: RadarChartCardProps) {
  const { exec } = useExecTheme();
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      radar: {
        indicator: data.map((d) => ({ name: d.name, max: 100 })),
        center: ['50%', '52%'],
        radius: '62%',
        axisName: { color: exec.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: exec.grid } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: exec.gaugeTrack } },
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
    [data, exec.gaugeTrack, exec.grid, exec.muted]
  );

  return (
    <DashboardCard className={className} title={title} insight={insight}>
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
