'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy dashboard — redirects to executive dashboard for accurate aggregated KPIs. */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/executive-dashboard');
  }, [router]);

  return null;
}
