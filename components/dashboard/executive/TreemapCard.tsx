'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecTreemapNode } from './types';
import { EXEC } from './theme';

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
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
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
            color: EXEC.text,
            fontSize: 10,
            formatter: '{b}',
          },
          upperLabel: {
            show: true,
            height: 18,
            color: EXEC.text,
            fontSize: 10,
          },
          itemStyle: {
            borderColor: EXEC.bg,
            borderWidth: 2,
            gapWidth: 2,
          },
          levels: [
            {
              itemStyle: { borderColor: EXEC.bg, borderWidth: 3, gapWidth: 3 },
              upperLabel: { show: false },
            },
            {
              color: [EXEC.purple, '#6366F1', '#4F46E5'],
              colorMappingBy: 'id',
              itemStyle: { borderColor: EXEC.bg, borderWidth: 2, gapWidth: 2 },
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
    [tree]
  );

  return (
    <DashboardCard className={className} title={title} insight={insight}>
      <div className="h-[160px]">
        {tree.length ? (
          <ReactECharts
            option={option}
            style={{ height: 160, width: '100%' }}
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
    </DashboardCard>
  );
}
