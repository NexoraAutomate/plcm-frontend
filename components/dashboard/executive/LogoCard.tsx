'use client';

import Image from 'next/image';
import { DashboardCard } from './DashboardCard';

export function LogoCard({ className }: { className?: string }) {
  return (
    <DashboardCard className={className} noPadding>
      <div className="flex h-full items-center gap-2.5 px-3 py-2">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#242424] bg-[#0C0C0C]">
          <Image src="/icon.svg" alt="PLCM" width={28} height={28} className="opacity-90" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-[#F5F5F5]">
            PLCM Executive Dashboard
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[#9CA3AF]">
            Product Lifecycle Management
          </p>
        </div>
      </div>
    </DashboardCard>
  );
}
