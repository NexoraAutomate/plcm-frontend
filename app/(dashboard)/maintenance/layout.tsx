'use client';

import { usePathname } from 'next/navigation';
import { MaintenanceSectionNav } from '@/components/maintenance/maintenance-section-nav';

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCaseDetail = pathname.startsWith('/maintenance/cases/');

  if (isCaseDetail) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track cases, look up equipment by serial, and manage OEM warranty claims.
          </p>
        </div>
        <MaintenanceSectionNav />
      </div>
      {children}
    </div>
  );
}
