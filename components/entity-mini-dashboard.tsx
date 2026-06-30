'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { KPICard } from '@/components/kpi-card';
import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatusCount {
  status: string;
  count: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'amber' | 'orange' | 'slate';
}

interface EntityMiniDashboardProps {
  totalCount: number;
  totalIcon: LucideIcon;
  statusCounts: StatusCount[];
  filterPath?: (status: string) => string;
  showTotalCard?: boolean;
}

export function EntityMiniDashboard({
  totalCount,
  totalIcon,
  statusCounts,
  filterPath,
  showTotalCard = true,
}: EntityMiniDashboardProps) {
  const router = useRouter();

  const handleStatusClick = (status: string) => {
    if (filterPath) {
      router.push(filterPath(status));
    }
  };

  return (
    <div className="space-y-6">
      {showTotalCard && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Overview</h3>
          <div className="grid grid-cols-1 gap-4">
            <KPICard
              title="Total Items"
              value={totalCount}
              change={0}
              icon={totalIcon}
              accentColor="blue"
            />
          </div>
        </Card>
      )}

      {statusCounts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Status Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statusCounts.map((item) => (
              <button
                key={item.status}
                onClick={() => handleStatusClick(item.status)}
                className="cursor-pointer transition-transform hover:scale-105"
              >
                <KPICard
                  title={item.status}
                  value={item.count}
                  change={0}
                  icon={item.icon}
                  accentColor={item.color}
                />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
