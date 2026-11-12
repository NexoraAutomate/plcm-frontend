'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecTreemapNode } from './types';
import { EXEC } from './theme';
import { useExecTheme } from './use-exec-theme';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface TreemapCardProps {
  title?: string;
  tree: ExecTreemapNode[];
  className?: string;
  onNodeClick?: (node: ExecTreemapNode) => void;
  insight?: ExecInsight;
}

function toEchartsTree(nodes: ExecTreemapNode[]): Record<string, unknown>[] {
  return nodes.map((n) => ({
    name: n.name,
    value: n.value || 1,
    id: n.id,
    entityType: n.entityType,
    children: n.children?.length ? toEchartsTree(n.children) : undefined,
  }));
}

export function TreemapCard({
  title = 'Program / Order / Project Hierarchy',
  tree,
  className,
  onNodeClick,
  insight,
}: TreemapCardProps) {
  const { exec } = useExecTheme();
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        appendToBody: true,
        confiner: false,
        extraCssText: 'z-index:10000;',
        formatter: (info: { name: string; value: number }) =>
          `${info.name}<br/>Systems: ${info.value}`,
      },
      series: [
        {
          type: 'treemap',
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            color: exec.text,
            fontSize: 10,
            formatter: '{b}',
          },
          upperLabel: {
            show: true,
            height: 18,
            color: exec.text,
            fontSize: 10,
          },
          itemStyle: {
            borderColor: exec.bg,
            borderWidth: 2,
            gapWidth: 2,
          },
          levels: [
            {
              itemStyle: { borderColor: exec.bg, borderWidth: 3, gapWidth: 3 },
              upperLabel: { show: false },
            },
            {
              color: [EXEC.purple, '#6366F1', '#4F46E5'],
              colorMappingBy: 'id',
              itemStyle: { borderColor: exec.bg, borderWidth: 2, gapWidth: 2 },
            },
            {
              color: [EXEC.cyan, '#0EA5E9', '#06B6D4'],
              itemStyle: { borderWidth: 1, gapWidth: 1 },
            },
            {
              color: ['#34D399', '#10B981', '#059669'],
              itemStyle: { borderWidth: 1, gapWidth: 1 },
            },
          ],
          data: toEchartsTree(tree),
        },
      ],
    }),
    [exec.bg, exec.text, tree]
  );

  return (
    <DashboardCard className={className} title={title} insight={insight} noPadding>
      <div className="relative min-h-0 flex-1 px-1 pb-1 pt-0.5">
        <div className="absolute inset-1">
          {tree.length ? (
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge
              lazyUpdate
              onEvents={{
                click: (params: { data?: ExecTreemapNode }) => {
                  if (params.data && onNodeClick) onNodeClick(params.data);
                },
              }}
            />
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}
