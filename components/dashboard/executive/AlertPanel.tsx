'use client';

import { AlertTriangle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import type { ExecAlert, ExecInsight } from './types';
import { EXEC } from './theme';

interface AlertPanelProps {
  alerts: ExecAlert[];
  className?: string;
  insight?: ExecInsight;
}

const ICON = {
  critical: AlertTriangle,
  warning: TriangleAlert,
  success: CheckCircle2,
  info: Info,
} as const;

const COLOR = {
  critical: EXEC.danger,
  warning: EXEC.orange,
  success: EXEC.success,
  info: EXEC.cyan,
} as const;

export function AlertPanel({ alerts, className, insight }: AlertPanelProps) {
  return (
    <DashboardCard className={className} title="Executive Alerts" noPadding insight={insight}>
      <div className="h-[160px] overflow-y-auto px-2 pb-2">
        <ul className="space-y-1.5">
          {alerts.map((alert) => {
            const Icon = ICON[alert.severity];
            const color = COLOR[alert.severity];
            return (
              <li
                key={alert.id}
                className="flex items-start gap-2 rounded-md border border-transparent px-1.5 py-1.5 transition-colors hover:border-[#242424] hover:bg-white/[0.03]"
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] leading-snug text-[#F5F5F5]">{alert.title}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#9CA3AF]">
                    {alert.timeAgo}
                  </p>
                </div>
              </li>
            );
          })}
          {!alerts.length ? (
            <li className="px-2 py-6 text-center text-[11px] text-[#9CA3AF]">No alerts</li>
          ) : null}
        </ul>
      </div>
    </DashboardCard>
  );
}
