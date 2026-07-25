'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';
import { AnimatedNumber } from './AnimatedNumber';
import type { ExecTrend } from './types';
import { EXEC } from './theme';

interface KPICardProps {
  label: string;
  value: number;
  decimals?: number;
  accent?: string;
  trend?: ExecTrend;
  sparkline?: number[];
  className?: string;
  onClick?: () => void;
}

function TrendBadge({ trend }: { trend: ExecTrend }) {
  const Icon = trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : Minus;
  const positive = trend.positive ?? trend.direction === 'up';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-medium',
        positive ? 'text-[#4ADE80]' : 'text-[#EF4444]'
      )}
    >
      <Icon className="h-3 w-3" />
      {trend.value}
    </span>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-auto h-7 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" />
    </svg>
  );
}

export function KPICard({
  label,
  value,
  decimals = 0,
  accent = EXEC.purple,
  trend,
  sparkline,
  className,
  onClick,
}: KPICardProps) {
  return (
    <DashboardCard className={className} onClick={onClick} noPadding>
      <div className="flex h-full flex-col px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#9CA3AF]">{label}</p>
        <AnimatedNumber
          value={value}
          decimals={decimals}
          className="mt-1 text-[30px] font-bold leading-none text-[#F5F5F5]"
        />
        {trend ? (
          <div className="mt-1.5">
            <TrendBadge trend={trend} />
          </div>
        ) : null}
        {sparkline?.length ? <MiniSparkline values={sparkline} color={accent} /> : null}
      </div>
    </DashboardCard>
  );
}

export { TrendBadge };
