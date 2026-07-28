'use client';

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';
import { AnimatedNumber } from './AnimatedNumber';
import type { ExecInsight, ExecTrend } from './types';
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
  insight?: ExecInsight;
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

function formatTrendValue(value: string) {
  return value.replace(/^[▲▼+\-\s]+/, '').replace(/\s*vs last month\s*/i, '').trim();
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 36;
  const coords = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return { x, y };
  });
  const linePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints = [`0,${h}`, ...coords.map((p) => `${p.x},${p.y}`), `${w},${h}`].join(' ');
  const gradientId = `spark-fill-${color.replace('#', '')}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-auto h-10 w-full"
      preserveAspectRatio="none"
      style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={areaPoints} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.25"
        points={linePoints}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  insight,
}: KPICardProps) {
  const positive = trend ? (trend.positive ?? trend.direction === 'up') : true;
  const trendGlyph =
    trend?.direction === 'down' ? '▼' : trend?.direction === 'flat' ? '–' : '▲';

  return (
    <DashboardCard
      className={className}
      onClick={onClick}
      title={label}
      noPadding
      insight={insight}
    >
      <div className="flex h-full flex-col px-3 pb-2.5 pt-1">
        <div style={{ color: accent }}>
          <AnimatedNumber
            value={value}
            decimals={decimals}
            className="text-[34px] font-bold leading-none"
          />
        </div>
        {trend ? (
          <div className="mt-2">
            <div
              className="inline-flex items-center gap-1 text-[13px] font-semibold leading-none"
              style={{ color: positive ? EXEC.success : EXEC.danger }}
            >
              <span className="text-[10px] leading-none" aria-hidden>
                {trendGlyph}
              </span>
              {formatTrendValue(trend.value)}
            </div>
            <p className="mt-1 text-[11px] leading-tight text-[#9CA3AF]">vs last month</p>
          </div>
        ) : null}
        {sparkline?.length ? <MiniSparkline values={sparkline} color={accent} /> : null}
      </div>
    </DashboardCard>
  );
}

export { TrendBadge };
