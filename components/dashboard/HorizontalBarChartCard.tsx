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
import { ChartLegend, HorizontalChartValueLabelList } from './chart-overlays';
import { DashboardEmptyState } from './DashboardEmptyState';

interface HorizontalBarChartCardProps {
  title: string;
  data: ChartDataPoint[] | ProjectProgressItem[];
  valueKey?: 'value' | 'progress';
  seriesLabel?: string;
  onBarClick?: (item: ChartDataPoint | ProjectProgressItem) => void;
}

export function HorizontalBarChartCard({
  title,
  data,
  valueKey = 'value',
  seriesLabel,
  onBarClick,
}: HorizontalBarChartCardProps) {
  const resolvedSeriesLabel = seriesLabel ?? (valueKey === 'progress' ? 'Progress' : 'Count');
  const valueSuffix = valueKey === 'progress' ? '%' : '';
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
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis type="number" domain={[0, valueKey === 'progress' ? 100 : 'auto']} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                name={resolvedSeriesLabel}
                radius={[0, 4, 4, 0]}
                onClick={(payload) => onBarClick?.((payload as { raw: ChartDataPoint }).raw)}
                className={onBarClick ? 'cursor-pointer' : undefined}
              >
                {chartData.map((entry, i) => (
                  <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
                <HorizontalChartValueLabelList suffix={valueSuffix} />
              </Bar>
              <ChartLegend />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
