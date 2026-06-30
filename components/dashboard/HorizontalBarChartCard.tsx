'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ChartDataPoint, ProjectProgressItem } from '@/lib/types/dashboard';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import { DashboardEmptyState } from './DashboardEmptyState';

interface HorizontalBarChartCardProps {
  title: string;
  data: ChartDataPoint[] | ProjectProgressItem[];
  valueKey?: 'value' | 'progress';
  onBarClick?: (item: ChartDataPoint | ProjectProgressItem) => void;
}

export function HorizontalBarChartCard({
  title,
  data,
  valueKey = 'value',
  onBarClick,
}: HorizontalBarChartCardProps) {
  const chartData = data.map((d) => ({
    name: 'name' in d ? d.name : '',
    value: valueKey === 'progress' && 'progress' in d ? d.progress : (d as ChartDataPoint).value,
    id: 'id' in d ? d.id : (d as ChartDataPoint).id,
    raw: d,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <DashboardEmptyState message="No data available" />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 28)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis type="number" domain={[0, valueKey === 'progress' ? 100 : 'auto']} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                onClick={(payload) => onBarClick?.((payload as { raw: ChartDataPoint }).raw)}
                className={onBarClick ? 'cursor-pointer' : undefined}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
