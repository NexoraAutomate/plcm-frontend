'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/page-loader';

export default function RolesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings?tab=roles');
  }, [router]);
  return <PageLoader />;
}
