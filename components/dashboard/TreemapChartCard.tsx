'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { TreemapNode } from '@/lib/types/dashboard';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import { formatChartLabel } from './chart-overlays';
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
  value?: number;
  index?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, value, index = 0 } = props;
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
        <>
          <text x={x + 6} y={y + 16} fill="white" fontSize={11} fontWeight={500}>
            {name && name.length > 14 ? `${name.slice(0, 12)}…` : name}
          </text>
          {height > 40 && value != null ? (
            <text x={x + 6} y={y + 32} fill="white" fontSize={10} opacity={0.9}>
              {formatChartLabel(value)}
            </text>
          ) : null}
        </>
      ) : null}
    </g>
  );
}

function collectEntityTypes(nodes: RechartsTreemapNode[]): string[] {
  const types = new Set<string>();
  const walk = (items: RechartsTreemapNode[]) => {
    for (const node of items) {
      if (node.entity_type) types.add(node.entity_type);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return Array.from(types);
}

export function TreemapChartCard({ title, tree, onNodeClick }: TreemapChartCardProps) {
  const data = toRechartsData(tree);
  const entityTypes = collectEntityTypes(data);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <DashboardEmptyState message="No hierarchy data" />
        ) : (
          <>
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
            {entityTypes.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
                {entityTypes.map((type, i) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="capitalize text-muted-foreground">{type.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
