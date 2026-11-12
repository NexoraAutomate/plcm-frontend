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
      <div className="flex h-full min-h-0 min-w-0 items-center gap-2 px-2.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
        <Icon className="h-4 w-4 shrink-0 text-[#A78BFA] sm:h-5 sm:w-5" aria-hidden />

        <p className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-[var(--exec-text)] sm:text-[13px]">
          {label}
        </p>

        <div className="flex min-w-0 shrink-0 items-baseline gap-1.5 sm:gap-2.5">
          <AnimatedNumber
            value={value}
            className="text-[20px] font-bold leading-none tabular-nums text-[var(--exec-text)] sm:text-[24px]"
          />
          {trend ? (
            <p
              className="max-w-[7.5rem] truncate text-[10px] font-medium leading-none sm:max-w-none sm:whitespace-nowrap sm:text-[11px]"
              style={{ color: positive ? EXEC.success : EXEC.danger }}
              title={`${trendText} vs last month`}
            >
              <span className="mr-0.5 text-[9px]" aria-hidden>
                {trendGlyph}
              </span>
              {trendText}{' '}
              <span className="hidden font-normal text-[var(--exec-muted)] sm:inline">
                vs last month
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}
