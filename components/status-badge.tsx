"use client";

import { useContext } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DEFAULT_STATUS_COLOR_BY_NAME,
  statusBadgeStyleFromColor,
} from "@/lib/status-colors";
import { DataStoreStatusesContext } from "@/lib/status-color-context";

/** Dark solid backgrounds with white text (legacy name fallbacks) */
const statusColors: Record<string, string> = {
  Available: "bg-emerald-700 text-white border-emerald-800",
  Allocated: "bg-sky-700 text-white border-sky-800",
  Installed: "bg-blue-700 text-white border-blue-800",
  Testing: "bg-amber-700 text-white border-amber-800",
  Failed: "bg-red-700 text-white border-red-800",
  "Under maintenanceLogs": "bg-orange-700 text-white border-orange-800",
  Replaced: "bg-slate-700 text-white border-slate-800",
  Retired: "bg-zinc-700 text-white border-zinc-800",
  Planning: "bg-sky-700 text-white border-sky-800",
  Building: "bg-blue-700 text-white border-blue-800",
  Delivered: "bg-emerald-700 text-white border-emerald-800",
  maintenanceLogs: "bg-orange-700 text-white border-orange-800",
  Pending: "bg-amber-700 text-white border-amber-800",
  Approved: "bg-emerald-700 text-white border-emerald-800",
  Rejected: "bg-red-700 text-white border-red-800",
  Open: "bg-blue-700 text-white border-blue-800",
  Resolved: "bg-emerald-700 text-white border-emerald-800",
  Monitoring: "bg-amber-700 text-white border-amber-800",
  open: "bg-blue-700 text-white border-blue-800",
  under_inspection: "bg-amber-700 text-white border-amber-800",
  under_repair: "bg-orange-700 text-white border-orange-800",
  resolved: "bg-emerald-700 text-white border-emerald-800",
  closed: "bg-slate-700 text-white border-slate-800",
  suspected: "bg-amber-700 text-white border-amber-800",
  confirmed_faulty: "bg-red-700 text-white border-red-800",
  healthy: "bg-emerald-700 text-white border-emerald-800",
  false_positive: "bg-slate-700 text-white border-slate-800",
  no_fault_found: "bg-zinc-700 text-white border-zinc-800",
  pass: "bg-emerald-700 text-white border-emerald-800",
  fail: "bg-red-700 text-white border-red-800",
  pending: "bg-yellow-700 text-white border-yellow-800",
  inconclusive: "bg-orange-700 text-white border-orange-800",
  dispatched: "bg-blue-700 text-white border-blue-800",
  delivered: "bg-teal-700 text-white border-teal-800",
  confirmed_by_customer: "bg-emerald-700 text-white border-emerald-800",
  Active: "bg-emerald-700 text-white border-emerald-800",
  Inactive: "bg-zinc-700 text-white border-zinc-800",
  Admin: "bg-blue-700 text-white border-blue-800",
  "Entry Operator": "bg-emerald-700 text-white border-emerald-800",
  Viewer: "bg-slate-700 text-white border-slate-800",
  System: "bg-blue-700 text-white border-blue-800",
  Subsystem: "bg-sky-700 text-white border-sky-800",
  Module: "bg-indigo-700 text-white border-indigo-800",
  Unit: "bg-cyan-700 text-white border-cyan-800",
  Component: "bg-teal-700 text-white border-teal-800",
};

export function StatusBadge({
  status,
  color,
  className,
}: {
  status: string;
  /** Hex from Status.color — overrides legacy Tailwind map when set */
  color?: string | null;
  className?: string;
}) {
  const storeColors = useContext(DataStoreStatusesContext);
  const fromStore = storeColors?.[status];
  const resolved =
    color ||
    fromStore ||
    DEFAULT_STATUS_COLOR_BY_NAME[status] ||
    null;
  const customStyle = statusBadgeStyleFromColor(resolved);

  return (
    <Badge
      variant="outline"
      style={customStyle}
      className={cn(
        "text-xs font-medium border",
        !customStyle && (statusColors[status] || "bg-slate-700 text-white border-slate-800"),
        className
      )}
    >
      {status}
    </Badge>
  );
}
