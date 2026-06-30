'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreemapNode } from '@/lib/types/dashboard';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import { DashboardEmptyState } from './DashboardEmptyState';

interface TreemapChartCardProps {
  title: string;
  tree: TreemapNode[];
  onNodeClick?: (node: TreemapNode) => void;
}

type RechartsTreemapNode = {
  name: string;
  size: number;
  entity_type: string;
  id?: number | null;
  href_key?: string | null;
  children?: RechartsTreemapNode[];
};

function toRechartsData(nodes: TreemapNode[]): RechartsTreemapNode[] {
  return nodes.map((node) => ({
    name: node.name,
    size: node.value,
    entity_type: node.entity_type,
    id: node.id,
    href_key: node.href_key,
    children: node.children?.length ? toRechartsData(node.children) : undefined,
  }));
}

function CustomizedContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  index?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, index = 0 } = props;
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={CHART_COLORS[index % CHART_COLORS.length]}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        rx={4}
        className="opacity-90"
      />
      {width > 50 && height > 24 ? (
        <text x={x + 6} y={y + 16} fill="white" fontSize={11} fontWeight={500}>
          {name && name.length > 14 ? `${name.slice(0, 12)}…` : name}
        </text>
      ) : null}
    </g>
  );
}

export function TreemapChartCard({ title, tree, onNodeClick }: TreemapChartCardProps) {
  const data = toRechartsData(tree);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <DashboardEmptyState message="No hierarchy data" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <Treemap
              data={data}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="hsl(var(--background))"
              content={<CustomizedContent />}
              onClick={(node) => {
                const payload = node as unknown as RechartsTreemapNode;
                if (!payload?.name) return;
                onNodeClick?.({
                  name: payload.name,
                  value: payload.size,
                  entity_type: payload.entity_type,
                  id: payload.id,
                  href_key: payload.href_key,
                  children: [],
                });
              }}
            >
              <Tooltip />
            </Treemap>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
