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
} from 'recharts';
import type { ChartDataPoint } from '@/lib/types/dashboard';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import { ChartLegend, ChartValueLabelList } from './chart-overlays';
import { DashboardEmptyState } from './DashboardEmptyState';

interface BarChartCardProps {
  title: string;
  data: ChartDataPoint[];
  seriesLabel?: string;
  onBarClick?: (item: ChartDataPoint) => void;
}

export function BarChartCard({ title, data, seriesLabel = 'Count', onBarClick }: BarChartCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <DashboardEmptyState message="No data available" />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar
                dataKey="value"
                name={seriesLabel}
                fill={CHART_COLORS[0]}
                radius={[4, 4, 0, 0]}
                onClick={(payload) => onBarClick?.(payload as unknown as ChartDataPoint)}
                className={onBarClick ? 'cursor-pointer' : undefined}
              >
                <ChartValueLabelList />
              </Bar>
              <ChartLegend />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
