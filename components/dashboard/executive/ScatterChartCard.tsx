'use client';

import { useMemo } from 'react';
import { DashboardCard } from './DashboardCard';
import type { ExecInsight, ExecMilestonePoint } from './types';
import { EXEC, PRIORITY_COLORS } from './theme';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
const Y_MAP = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface ScatterChartCardProps {
  title?: string;
  data: ExecMilestonePoint[];
  className?: string;
  insight?: ExecInsight;
}

function rollingSixMonthLabels(from = new Date()): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    return MONTHS[d.getUTCMonth()];
  });
}

export function ScatterChartCard({
  title = 'Project Milestone Timeline (Next 6 Months)',
  data,
  className,
  insight,
}: ScatterChartCardProps) {
  const months = useMemo(() => {
    const byIndex = new Map<number, string>();
    for (const d of data) byIndex.set(d.monthIndex, d.month);
    if (byIndex.size >= 6) {
      return [...byIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, label]) => label);
    }
    return rollingSixMonthLabels();
  }, [data]);

  const counts = useMemo(() => {
    const c = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const d of data) c[d.priority] += d.count ?? 1;
    return c;
  }, [data]);

  /** Jitter duplicate points in the same cell so clusters remain readable. */
  const plotted = useMemo(() => {
    const groups = new Map<string, ExecMilestonePoint[]>();
    for (const d of data) {
      const key = `${d.monthIndex}-${d.priority}`;
      const list = groups.get(key) ?? [];
      list.push(d);
      groups.set(key, list);
    }
    const out: { point: ExecMilestonePoint; xPct: number; yPct: number }[] = [];
    for (const [, list] of groups) {
      list.forEach((point, i) => {
        const n = list.length;
        const jitter = n === 1 ? 0 : ((i - (n - 1) / 2) / Math.max(n, 1)) * 10;
        const col = months.length > 1 ? point.monthIndex / (months.length - 1) : 0.5;
        const row = Y_MAP[point.priority] / 3;
        out.push({
          point,
          xPct: Math.min(98, Math.max(2, col * 100 + jitter)),
          yPct: Math.min(92, Math.max(8, row * 100 + (n > 1 ? (i % 2 === 0 ? -4 : 4) : 0))),
        });
      });
    }
    return out;
  }, [data, months.length]);

  return (
    <DashboardCard className={className} title={title} insight={insight} noPadding>
      <div className="grid h-[155px] grid-cols-[52px_minmax(0,1fr)_52px] gap-1 px-2 pb-2">
        {/* Priority labels */}
        <div className="flex flex-col justify-between py-3">
          {PRIORITIES.map((p) => (
            <span
              key={p}
              className="text-[10px] font-semibold leading-none"
              style={{ color: PRIORITY_COLORS[p] }}
            >
              {p}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative min-h-0 min-w-0">
          <div className="absolute inset-x-0 bottom-5 top-1">
            {/* Vertical month guides */}
            {months.map((_, i) => {
              const left =
                months.length > 1 ? `${(i / (months.length - 1)) * 100}%` : '50%';
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-dashed border-[#3A3A3A]"
                  style={{ left }}
                />
              );
            })}
            {/* Baseline */}
            <div className="absolute inset-x-0 bottom-0 border-b border-[#3A3A3A]" />

            {plotted.map(({ point, xPct, yPct }, idx) => {
              const color = PRIORITY_COLORS[point.priority];
              return (
                <span
                  key={`${point.id ?? point.name}-${idx}`}
                  title={point.name}
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    backgroundColor: point.filled ? color : 'transparent',
                    border: `2px solid ${color}`,
                    boxShadow: point.filled ? `0 0 0 1px ${EXEC.card}` : undefined,
                  }}
                />
              );
            })}

            {!data.length ? (
              <p className="absolute inset-0 flex items-center justify-center text-[11px] text-[#9CA3AF]">
                No milestones in the next 6 months
              </p>
            ) : null}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex justify-between px-0.5">
            {months.map((m) => (
              <span key={m} className="text-[10px] font-medium text-[#D1D5DB]">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="flex flex-col justify-between border-l border-[#242424] py-1 pl-2">
          {PRIORITIES.map((p) => (
            <div key={p} className="min-w-0">
              <p className="text-[9px] leading-none text-[#E5E7EB]">{p}</p>
              <p
                className="mt-0.5 text-[16px] font-bold leading-none tabular-nums"
                style={{ color: PRIORITY_COLORS[p] }}
              >
                {counts[p]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
