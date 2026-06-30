"use client";

import { Wrench, CheckCircle2, Eye } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { MaintenanceLog } from "@/lib/dummy-data";

const statusIcons = {
  Open: Wrench,
  Resolved: CheckCircle2,
  Monitoring: Eye,
};

export function MaintenanceTimeline({ logs }: { logs: MaintenanceLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No maintenanceLogs history for this entity.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
      {logs.map((log, i) => {
        const Icon = statusIcons[log.status] || Wrench;
        return (
          <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border border-border">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{log.faultDescription}</p>
                <StatusBadge status={log.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Root Cause:</span> {log.rootCause}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Action:</span> {log.actionTaken}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                <span>{log.date}</span>
                <span>{log.engineer}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
