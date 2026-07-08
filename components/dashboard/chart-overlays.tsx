'use client';

import { LabelList, Legend } from 'recharts';

export const CHART_LABEL_STYLE = {
  fontSize: 10,
  fill: 'hsl(var(--foreground))',
  fontWeight: 500,
} as const;

export const CHART_LEGEND_WRAPPER_STYLE = {
  fontSize: 11,
  paddingTop: 8,
} as const;

export function formatChartLabel(value: unknown, suffix = ''): string {
  if (value == null) return '';
  if (typeof value === 'number') {
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return `${formatted}${suffix}`;
  }
  return `${String(value)}${suffix}`;
}

export function renderPieSliceLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    percent = 0,
    value = 0,
  } = props;

  if (percent < 0.04) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
    >
      {formatChartLabel(value)}
    </text>
  );
}

export function ChartLegend({
  verticalAlign = 'bottom',
  height = 36,
}: {
  verticalAlign?: 'top' | 'bottom' | 'middle';
  height?: number;
}) {
  return (
    <Legend
      verticalAlign={verticalAlign}
      height={height}
      iconType="circle"
      iconSize={8}
      wrapperStyle={CHART_LEGEND_WRAPPER_STYLE}
    />
  );
}

interface ValueLabelListProps {
  dataKey?: string;
  position?: 'top' | 'right' | 'left' | 'bottom' | 'inside' | 'outside' | 'insideLeft' | 'insideRight';
  suffix?: string;
}

export function ChartValueLabelList({
  dataKey = 'value',
  position = 'top',
  suffix = '',
}: ValueLabelListProps) {
  return (
    <LabelList
      dataKey={dataKey}
      position={position}
      style={CHART_LABEL_STYLE}
      formatter={(value: number) => formatChartLabel(value, suffix)}
    />
  );
}

export function HorizontalChartValueLabelList({
  dataKey = 'value',
  suffix = '',
}: Omit<ValueLabelListProps, 'position'>) {
  return <ChartValueLabelList dataKey={dataKey} position="right" suffix={suffix} />;
}
