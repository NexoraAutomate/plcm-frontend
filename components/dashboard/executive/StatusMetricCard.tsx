'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';
import { AnimatedNumber } from './AnimatedNumber';
import type { ExecInsight, ExecTrend } from './types';

interface StatusMetricCardProps {
  label: string;
  value: number;
  trend?: ExecTrend;
  className?: string;
  onClick?: () => void;
  insight?: ExecInsight;
}

export function StatusMetricCard({
  label,
  value,
  trend,
  className,
  onClick,
  insight,
}: StatusMetricCardProps) {
  const positive = trend?.positive ?? false;
  const Icon = trend?.direction === 'down' ? ArrowDown : ArrowUp;

  return (
    <DashboardCard className={className} onClick={onClick} noPadding insight={insight}>
      <div className="flex h-full items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[#9CA3AF]">
            {label}
          </p>
          <AnimatedNumber
            value={value}
            className="text-[20px] font-bold leading-none text-[#F5F5F5]"
          />
        </div>
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium',
              positive ? 'text-[#4ADE80]' : 'text-[#EF4444]'
            )}
          >
            <Icon className="h-3 w-3" />
            {trend.value}
          </span>
        ) : null}
      </div>
    </DashboardCard>
  );
}
