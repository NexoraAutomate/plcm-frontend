'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { ChartDataPoint } from '@/lib/types/dashboard';
import { CHART_COLORS } from '@/lib/dashboard-chart-theme';
import { DashboardEmptyState } from './DashboardEmptyState';

interface DonutChartCardProps {
  title: string;
  data: ChartDataPoint[];
  onSliceClick?: (item: ChartDataPoint) => void;
}

export function DonutChartCard({ title, data, onSliceClick }: DonutChartCardProps) {
  const chartData = data.map((d) => ({ ...d, fill: undefined }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <DashboardEmptyState message="No data for current filters" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                onClick={(_, index) => onSliceClick?.(chartData[index])}
                className={onSliceClick ? 'cursor-pointer' : undefined}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
