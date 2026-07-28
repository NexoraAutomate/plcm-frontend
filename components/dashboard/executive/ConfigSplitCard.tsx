'use client';

import { useMemo } from 'react';
import { Bar } from '@ant-design/charts';
import { DashboardCard } from './DashboardCard';
import type { ExecConfigChangeRow, ExecInsight, ExecNamedValue } from './types';
import { EXEC } from './theme';

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('approv') || s.includes('resolved') || s.includes('closed')) return EXEC.success;
  if (s.includes('pend') || s.includes('review')) return EXEC.warning;
  if (s.includes('reject') || s.includes('fail')) return EXEC.danger;
  return EXEC.cyan;
}

interface ConfigSplitCardProps {
  components: ExecNamedValue[];
  rows: ExecConfigChangeRow[];
  className?: string;
  insight?: ExecInsight;
}

export function ConfigSplitCard({ components, rows, className, insight }: ConfigSplitCardProps) {
  const sorted = useMemo(
    () => [...components].slice(0, 5).sort((a, b) => a.value - b.value),
    [components]
  );

  const barConfig = useMemo(
    () =>
      ({
        data: sorted,
        xField: 'value',
        yField: 'name',
        height: 140,
        autoFit: true,
        legend: false,
        theme: 'classicDark',
        axis: {
          x: { labelFill: EXEC.muted, labelFontSize: 9, gridStroke: '#242424', line: false },
          y: { labelFill: EXEC.muted, labelFontSize: 9, line: false, tick: false },
        },
        style: {
          fill: EXEC.cyan,
          maxWidth: 14,
          radiusTopRight: 3,
          radiusBottomRight: 3,
        },
        label: false,
        tooltip: true,
      }) as Record<string, unknown>,
    [sorted]
  );

  return (
    <DashboardCard className={className} title="Configuration Changes" noPadding insight={insight}>
      <div className="grid h-[176px] grid-cols-2 gap-3 px-3 pb-2.5">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Top Modified Components
          </p>
          <div className="h-[140px]">{sorted.length ? <Bar {...barConfig} /> : null}</div>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Recent Changes
          </p>
          <div className="h-[140px] overflow-hidden rounded-md border border-[#242424]">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-[#0C0C0C] text-[9px] uppercase tracking-wide text-[#9CA3AF]">
                <tr>
                  <th className="px-1.5 py-1 font-medium">Part</th>
                  <th className="px-1.5 py-1 font-medium">Reason</th>
                  <th className="px-1.5 py-1 font-medium">Status</th>
                  <th className="px-1.5 py-1 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row) => (
                  <tr key={row.id} className="border-t border-[#242424]">
                    <td className="max-w-[70px] truncate px-1.5 py-1 font-medium text-[#F5F5F5]">
                      {row.partNumber}
                    </td>
                    <td className="max-w-[80px] truncate px-1.5 py-1 text-[#9CA3AF]">{row.reason}</td>
                    <td className="px-1.5 py-1">
                      <span
                        className="inline-flex rounded px-1 py-0.5 text-[9px] font-medium"
                        style={{
                          color: statusColor(row.status),
                          backgroundColor: `${statusColor(row.status)}22`,
                        }}
                      >
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1 text-[#9CA3AF]">{row.date}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-8 text-center text-[#9CA3AF]">
                      No recent changes
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}

export function RecentChangesTable({
  rows,
}: {
  rows: ExecConfigChangeRow[];
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[#242424]">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-[#0C0C0C] text-[10px] uppercase tracking-wide text-[#9CA3AF]">
          <tr>
            <th className="px-2 py-1.5 font-medium">Part Number</th>
            <th className="px-2 py-1.5 font-medium">Reason</th>
            <th className="px-2 py-1.5 font-medium">Status</th>
            <th className="px-2 py-1.5 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row) => (
            <tr key={row.id} className="border-t border-[#242424]">
              <td className="px-2 py-1.5 font-medium text-[#F5F5F5]">{row.partNumber}</td>
              <td className="px-2 py-1.5 text-[#9CA3AF]">{row.reason}</td>
              <td className="px-2 py-1.5">
                <span style={{ color: statusColor(row.status) }}>{row.status}</span>
              </td>
              <td className="px-2 py-1.5 text-[#9CA3AF]">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
