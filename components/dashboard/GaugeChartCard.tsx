'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import type { GaugeMetric } from '@/lib/types/dashboard';

interface GaugeChartCardProps {
  metric: GaugeMetric;
  onClick?: () => void;
}

export function GaugeChartCard({ metric, onClick }: GaugeChartCardProps) {
  const pct = Math.min(100, Math.round((metric.value / metric.max_value) * 100));
  const chartData = [{ name: metric.label, value: pct, fill: 'oklch(0.62 0.15 250)' }];

  return (
    <Card
      className={`h-full ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={12}
            data={chartData}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="text-2xl font-bold">
          {metric.value.toFixed(1)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}
