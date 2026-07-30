'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';

interface TopDelayedProjectsCardProps {
  data: ExecNamedValue[];
  className?: string;
  insight?: ExecInsight;
  onBarClick?: (item: ExecNamedValue) => void;
}

export function TopDelayedProjectsCard({
  data,
  className,
  insight,
  onBarClick,
}: TopDelayedProjectsCardProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value).slice(0, 5),
    [data]
  );

  const maxDays = useMemo(() => {
    const peak = sorted.reduce((m, d) => Math.max(m, d.value), 0);
    if (peak <= 0) return 50;
    return Math.max(50, Math.ceil(peak / 10) * 10);
  }, [sorted]);

  const ticks = useMemo(() => {
    const step = maxDays / 5;
    return Array.from({ length: 6 }, (_, i) => Math.round(i * step));
  }, [maxDays]);

  return (
    <DashboardCard
      className={className}
      title="Top Delayed Projects"
      subtitle="by Days Overdue"
      insight={insight}
      noPadding
      headerRight={
        <Star className="h-3.5 w-3.5 fill-[#FACC15] text-[#FACC15]" aria-hidden />
      }
    >
      <div className="flex h-[155px] flex-col px-3 pb-2">
        <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
          {sorted.length ? (
            sorted.map((item) => {
              const widthPct = Math.max(4, Math.min(100, (item.value / maxDays) * 100));
              return (
                <button
                  key={item.id ?? item.name}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => onBarClick?.(item)}
                >
                  <p className="truncate text-[11px] font-medium leading-tight text-[#F5F5F5]">
                    {item.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="h-2.5 min-w-0 flex-1 rounded-sm bg-[#1A1A1A]">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: EXEC.purple,
                        }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#EF4444]">
                      {Math.round(item.value)}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <p className="flex h-full items-center justify-center text-[11px] text-[#9CA3AF]">
              No delayed projects
            </p>
          )}
        </div>

        <div className="mt-1 border-t border-[#242424] pt-1">
          <div className="flex justify-between px-0.5">
            {ticks.map((t) => (
              <span key={t} className="text-[9px] tabular-nums text-[#9CA3AF]">
                {t}
              </span>
            ))}
          </div>
          <p className="mt-0.5 text-center text-[9px] uppercase tracking-wide text-[#9CA3AF]">
            Days
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}
