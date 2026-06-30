'use client';

import React from 'react';
import { KPICard } from '@/components/kpi-card';
import { AlertCircle, CheckCircle2, Wrench, Package, Lock, ClipboardCheck, type LucideIcon } from 'lucide-react';
import type { MaintenanceCase } from '@/lib/models';
import { CASE_STATUS_META, mapCaseStatusFromApi } from '@/lib/maintenance-workflow';

interface StatusCount {
  status: string;
  label: string;
  count: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate' | 'emerald' | 'purple';
}

interface MaintenanceMiniDashboardProps {
  cases: MaintenanceCase[];
  onStatusFilter?: (status: string) => void;
}

const FILTER_STATUSES = [
  'open',
  'under_inspection',
  'under_repair',
  'resolved',
  'closed',
] as const;

export function MaintenanceMiniDashboard({ cases, onStatusFilter }: MaintenanceMiniDashboardProps) {
  const totalCount = cases.length;

  const statusCounts: StatusCount[] = [
    {
      status: 'Total',
      label: 'Total',
      count: totalCount,
      icon: Package,
      color: 'emerald',
    },
    ...FILTER_STATUSES.map((apiStatus) => {
      const display = mapCaseStatusFromApi(apiStatus);
      const meta = CASE_STATUS_META[display];
      return {
        status: apiStatus,
        label: meta.label,
        count: cases.filter((c) => c.status === apiStatus).length,
        icon:
          apiStatus === 'open'
            ? AlertCircle
            : apiStatus === 'under_inspection'
            ? Wrench
            : apiStatus === 'under_repair'
            ? ClipboardCheck
            : apiStatus === 'resolved'
            ? CheckCircle2
            : Lock,
        color:
          apiStatus === 'open'
            ? ('blue' as const)
            : apiStatus === 'under_inspection'
            ? ('amber' as const)
            : apiStatus === 'under_repair'
            ? ('orange' as const)
            : apiStatus === 'resolved'
            ? ('green' as const)
            : ('slate' as const),
      };
    }),
  ];

  const handleStatusClick = (status: string) => {
    onStatusFilter?.(status);
  };

  return (
    <div className="">
      {statusCounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:grid-cols-6 items-stretch">
          {statusCounts.map((item) => (
            <button
              key={item.status}
              onClick={() =>
                item.status === 'Total' ? handleStatusClick('all') : handleStatusClick(item.status)
              }
              className="w-full h-full cursor-pointer transition-transform hover:scale-105"
            >
              <div className="h-full w-full">
                <KPICard
                  title={item.label}
                  value={item.count}
                  change={
                    item.status !== 'Total' ? Math.round((100 * item.count) / totalCount) : 0
                  }
                  icon={item.icon}
                  accentColor={item.color}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
