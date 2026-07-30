'use client';

import type { LucideIcon } from 'lucide-react';
import { Clock, Wrench } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { AnimatedNumber } from './AnimatedNumber';
import type { ExecInsight, ExecTrend } from './types';
import { EXEC } from './theme';

interface StatusMetricCardProps {
  label: string;
  value: number;
  trend?: ExecTrend;
  className?: string;
  onClick?: () => void;
  insight?: ExecInsight;
  variant?: 'maintenance' | 'delayed';
}

const VARIANT_ICON: Record<NonNullable<StatusMetricCardProps['variant']>, LucideIcon> = {
  maintenance: Wrench,
  delayed: Clock,
};

export function StatusMetricCard({
  label,
  value,
  trend,
  className,
  onClick,
  insight,
  variant = 'maintenance',
}: StatusMetricCardProps) {
  const positive = trend?.positive ?? false;
  const trendGlyph =
    trend?.direction === 'down' ? '▼' : trend?.direction === 'flat' ? '–' : '▲';
  const Icon = VARIANT_ICON[variant];
  const trendText = trend?.value.replace(/^[▲▼+\-\s]+/, '') ?? '';

  return (
    <DashboardCard className={className} onClick={onClick} noPadding square insight={insight}>
      <div className="flex h-full min-h-[52px] items-center gap-3 px-3 py-2">
        <Icon className="h-5 w-5 shrink-0 text-[#A78BFA]" aria-hidden />

        <p className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[#F5F5F5]">
          {label}
        </p>

        <div className="flex shrink-0 items-baseline gap-2.5">
          <AnimatedNumber
            value={value}
            className="text-[24px] font-bold leading-none tabular-nums text-[#F5F5F5]"
          />
          {trend ? (
            <p
              className="whitespace-nowrap text-[11px] font-medium leading-none"
              style={{ color: positive ? EXEC.success : EXEC.danger }}
            >
              <span className="mr-0.5 text-[9px]" aria-hidden>
                {trendGlyph}
              </span>
              {trendText} <span className="font-normal text-[#9CA3AF]">vs last month</span>
            </p>
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}
